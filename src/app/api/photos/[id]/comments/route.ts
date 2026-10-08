import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { addComment, addCommentInput } from "@/lib/social";

/** POST /api/photos/:id/comments — { body } → bình luận + cảm xúc mới của ảnh. Cần đã chọn tên. */
export const POST = handle(async (req: Request, { params }: RouteContext<"/api/photos/[id]/comments">) => {
  const actor = await requireMember();
  const input = await readJson(req, addCommentInput);
  return json(await addComment(actor, (await params).id, input), { status: 201 });
});
