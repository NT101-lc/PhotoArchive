import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { createPlan, createPlanInput, getPlans } from "@/lib/plans";

/** GET /api/plans — các kế hoạch, chuyến sắp tới trước. */
export const GET = handle(async () => json({ plans: await getPlans() }));

/** POST /api/plans — tạo { title, location, startDate, endDate } → { slug }. Cần đã chọn tên. */
export const POST = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, createPlanInput);
  return json(await createPlan(actor, input), { status: 201 });
});
