import "server-only";
import { asc, desc, eq, like, or, sql } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { db, members, plans, type PlanRow } from "@/db";
import { ForbiddenError } from "./auth";
import { slugify } from "./format";
import { resolveObjectUrl } from "./storage";
import { BadRequestError, NotFoundError } from "./mutations";
import { canDeletePlan, canEditPlan, type Actor } from "./permissions";
import { defaultSlots, PLAN_LIMITS } from "./plan-utils";

// Planner chuyến đi: một bảng lịch trình (ngày × buổi), danh sách người đi, bảng việc cần làm & chi phí.
// Sửa theo từng thao tác nhỏ (một ô, một lần join...) để hai người sửa hai chỗ khác nhau không đè nhau.

export type Plan = {
  id: string;
  slug: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  slots: PlanRow["slots"];
  cells: PlanRow["cells"];
  going: string[];
  items: PlanRow["items"];
  createdById: string | null;
  updatedAt: string;
};

function toPlan(r: PlanRow): Plan {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    location: r.location,
    startDate: r.startDate,
    endDate: r.endDate,
    slots: r.slots,
    cells: r.cells,
    going: r.going,
    items: r.items,
    createdById: r.createdById,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Danh sách kế hoạch: chuyến sắp tới trước (gần nhất trên cùng), chuyến đã qua xuống cuối. */
export const getPlans = cache(async () => {
  await connection();
  const rows = await db
    .select()
    .from(plans)
    .orderBy(sql`${plans.endDate} < current_date`, asc(plans.startDate), desc(plans.createdAt));
  return rows.map(toPlan);
});

export const getPlan = cache(async (slug: string) => {
  await connection();
  const [row] = await db.select().from(plans).where(eq(plans.slug, slug)).limit(1);
  return row ? toPlan(row) : null;
});

/** Ai tạo kế hoạch (để hiện tên). */
export async function planCreatorName(id: string | null) {
  if (!id) return null;
  const [m] = await db.select({ name: members.name }).from(members).where(eq(members.id, id)).limit(1);
  return m?.name ?? null;
}

async function uniqueSlug(title: string, startDate: string) {
  const base = slugify(`${title} ${startDate.slice(0, 4)}`) || "plan";
  const taken = await db
    .select({ slug: plans.slug })
    .from(plans)
    .where(or(eq(plans.slug, base), like(plans.slug, `${base}-%`)));
  const used = new Set(taken.map((t) => t.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

const text = (max: number) => z.string().trim().max(max);

const infoInput = z
  .object({
    title: text(120).min(1),
    location: text(120).min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "The last day can’t be before the first day.", path: ["endDate"] })
  .refine((v) => (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000 < PLAN_LIMITS.days, {
    message: `A plan can cover up to ${PLAN_LIMITS.days} days.`,
    path: ["endDate"],
  });

export const createPlanInput = infoInput;

/** Tạo kế hoạch mới; người tạo tự động nằm trong danh sách đi. */
export async function createPlan(actor: Actor, input: z.infer<typeof createPlanInput>) {
  if (!canEditPlan(actor)) throw new ForbiddenError("Choose who you are first.");
  const slug = await uniqueSlug(input.title, input.startDate);
  const [row] = await db
    .insert(plans)
    .values({ ...input, slug, slots: defaultSlots(), going: [actor.id], createdById: actor.id })
    .returning({ slug: plans.slug });
  return row;
}

const slotInput = z.object({ id: text(40).min(1), label: text(40), time: text(20) });
const itemInput = z.object({
  id: text(40).min(1),
  done: z.boolean(),
  text: text(PLAN_LIMITS.textLength),
  who: z.uuid().nullable(),
  cost: z.number().int().min(0).max(1_000_000_000_000).nullable(),
  note: text(PLAN_LIMITS.textLength),
});

/** Một thao tác sửa. `cell` chỉ đụng đúng một ô; `join` / `leave` áp cho người đang dùng. */
export const patchPlanInput = z.discriminatedUnion("op", [
  z.object({ op: z.literal("cell"), key: text(80).regex(/^\d{4}-\d{2}-\d{2}\|[\w-]+$/), value: z.string().max(PLAN_LIMITS.cellLength) }),
  z.object({ op: z.literal("slots"), slots: z.array(slotInput).min(1).max(PLAN_LIMITS.slots) }),
  z.object({ op: z.literal("items"), items: z.array(itemInput).max(PLAN_LIMITS.items) }),
  z.object({ op: z.literal("join") }),
  z.object({ op: z.literal("leave") }),
  z.object({ op: z.literal("info"), info: infoInput }),
]);

export async function patchPlan(actor: Actor, slug: string, input: z.infer<typeof patchPlanInput>) {
  if (!canEditPlan(actor)) throw new ForbiddenError("Choose who you are first.");
  const where = eq(plans.slug, slug);
  let rows: { slug: string }[];

  switch (input.op) {
    case "cell": {
      const value = input.value.replace(/\r\n?/g, "\n").trim();
      rows = await db
        .update(plans)
        .set({
          cells: value
            ? sql`${plans.cells} || jsonb_build_object(${input.key}::text, ${value}::text)`
            : sql`${plans.cells} - ${input.key}::text`,
        })
        .where(where)
        .returning({ slug: plans.slug });
      break;
    }
    case "slots": {
      const ids = new Set(input.slots.map((s) => s.id));
      if (ids.size !== input.slots.length) throw new BadRequestError("Duplicate slot id.");
      rows = await db.update(plans).set({ slots: input.slots }).where(where).returning({ slug: plans.slug });
      break;
    }
    case "items":
      rows = await db.update(plans).set({ items: input.items }).where(where).returning({ slug: plans.slug });
      break;
    case "join":
      rows = await db
        .update(plans)
        .set({
          going: sql`case when ${plans.going} ? ${actor.id}::text then ${plans.going} else ${plans.going} || to_jsonb(${actor.id}::text) end`,
        })
        .where(where)
        .returning({ slug: plans.slug });
      break;
    case "leave":
      rows = await db
        .update(plans)
        .set({ going: sql`${plans.going} - ${actor.id}::text` })
        .where(where)
        .returning({ slug: plans.slug });
      break;
    case "info":
      // Giữ nguyên slug để link cũ vẫn chạy
      rows = await db.update(plans).set(input.info).where(where).returning({ slug: plans.slug });
      break;
  }

  if (rows.length === 0) throw new NotFoundError("Plan not found.");
  const plan = await getPlanFresh(slug);
  return plan!;
}

async function getPlanFresh(slug: string) {
  const [row] = await db.select().from(plans).where(eq(plans.slug, slug)).limit(1);
  return row ? toPlan(row) : null;
}

export async function deletePlan(actor: Actor, slug: string) {
  const plan = await getPlanFresh(slug);
  if (!plan) throw new NotFoundError("Plan not found.");
  if (!canDeletePlan(actor, plan)) throw new ForbiddenError("Only the admin or whoever made this plan can delete it.");
  await db.delete(plans).where(eq(plans.id, plan.id));
}

export { getPlanFresh };

export type Crewmate = { id: string; name: string; avatarUrl: string | null };

/** Mọi thành viên, kể cả admin (ai cũng có thể tham gia chuyến), để hiện tên / avatar trong bảng. */
export const getCrew = cache(async (): Promise<Crewmate[]> => {
  const rows = await db
    .select({ id: members.id, name: members.name, avatarKey: members.avatarKey })
    .from(members)
    .orderBy(asc(members.createdAt), asc(members.name));
  return Promise.all(rows.map(async ({ avatarKey, ...m }) => ({ ...m, avatarUrl: await resolveObjectUrl(avatarKey) })));
});
