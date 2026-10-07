import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { NotFoundError } from "@/lib/mutations";
import { deletePlan, getPlanFresh, patchPlan, patchPlanInput } from "@/lib/plans";

type Ctx = RouteContext<"/api/plans/[slug]">;

/** GET /api/plans/:slug — một kế hoạch (bảng tính hỏi lại định kỳ để thấy người khác sửa). */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const plan = await getPlanFresh((await params).slug);
  if (!plan) throw new NotFoundError("Plan not found.");
  return json(plan);
});

/** PATCH /api/plans/:slug — một thao tác sửa (xem patchPlanInput) → kế hoạch sau khi sửa. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const actor = await requireMember();
  const input = await readJson(req, patchPlanInput);
  return json(await patchPlan(actor, (await params).slug, input));
});

/** DELETE /api/plans/:slug — admin hoặc người tạo. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const actor = await requireMember();
  await deletePlan(actor, (await params).slug);
  return json({ ok: true });
});
