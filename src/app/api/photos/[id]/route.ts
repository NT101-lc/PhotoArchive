import { handle, json } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { deletePhoto } from "@/lib/mutations";

/** DELETE /api/photos/:id — xoá ảnh (DB + R2). Admin, hoặc người đã upload ảnh đó. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/photos/[id]">) => {
  const actor = await requireMember();
  const { id } = await ctx.params;
  return json(await deletePhoto(actor, id));
});
