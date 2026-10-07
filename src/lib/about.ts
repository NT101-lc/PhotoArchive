import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { db, members, siteContent } from "@/db";
import { ForbiddenError } from "./auth";
import { ABOUT_LIMITS, cleanParagraphs } from "./about-text";
import { canEditAbout, type Actor } from "./permissions";

// Nội dung trang About: các đoạn chữ do thành viên tự viết, lưu ở bảng site_content (key "about").

const KEY = "about";

/** Chữ mặc định khi chưa ai viết gì. */
const DEFAULT_PARAGRAPHS = [
  "Six friends, a lot of trips, and photos scattered across six phones. thesix is where they all end up, sorted by trip and kept for good.",
  "Every trip ends with someone saying “send me the photos”, and half of them never arrive. So we built one place where everyone uploads and everyone sees everything.",
];

export type AboutContent = {
  paragraphs: string[];
  /** null khi vẫn là chữ mặc định */
  updatedAt: string | null;
  updatedBy: string | null;
};

const stored = z.object({ paragraphs: z.array(z.string()) });

export const getAbout = cache(async (): Promise<AboutContent> => {
  await connection();
  const [row] = await db
    .select({ value: siteContent.value, updatedAt: siteContent.updatedAt, updatedBy: members.name })
    .from(siteContent)
    .leftJoin(members, eq(members.id, siteContent.updatedById))
    .where(eq(siteContent.key, KEY))
    .limit(1);
  const parsed = stored.safeParse(row?.value);
  if (!row || !parsed.success || parsed.data.paragraphs.length === 0) {
    return { paragraphs: DEFAULT_PARAGRAPHS, updatedAt: null, updatedBy: null };
  }
  return { paragraphs: parsed.data.paragraphs, updatedAt: row.updatedAt.toISOString(), updatedBy: row.updatedBy };
});

export const updateAboutInput = z.object({
  paragraphs: z.array(z.string().max(ABOUT_LIMITS.paragraphLength)).max(ABOUT_LIMITS.paragraphs),
});

/** Ghi đè toàn bộ các đoạn chữ. Đoạn trống bị bỏ; không còn đoạn nào → về chữ mặc định. */
export async function updateAbout(actor: Actor, input: z.infer<typeof updateAboutInput>) {
  if (!canEditAbout(actor)) throw new ForbiddenError("Choose who you are first.");
  const paragraphs = cleanParagraphs(input.paragraphs);
  if (paragraphs.length === 0) {
    await db.delete(siteContent).where(eq(siteContent.key, KEY));
    return { paragraphs: DEFAULT_PARAGRAPHS };
  }
  await db
    .insert(siteContent)
    .values({ key: KEY, value: { paragraphs }, updatedById: actor.id })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { value: { paragraphs }, updatedById: actor.id, updatedAt: new Date() },
    });
  return { paragraphs };
}
