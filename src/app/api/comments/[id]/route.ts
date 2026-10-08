import { handle, json } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { deleteComment } from "@/lib/social";

/** DELETE /api/comments/:id — người viết hoặc admin. */
export const DELETE = handle(async (_req: Request, { params }: RouteContext<"/api/comments/[id]">) => {
  const actor = await requireMember();
  return json(await deleteComment(actor, (await params).id));
});
