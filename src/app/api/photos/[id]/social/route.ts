import { handle, json } from "@/lib/api";
import { getCurrentMember } from "@/lib/auth";
import { getPhotoSocial } from "@/lib/social";

/** GET /api/photos/:id/social — bình luận + cảm xúc của một ảnh. */
export const GET = handle(async (_req: Request, { params }: RouteContext<"/api/photos/[id]/social">) => {
  const [{ id }, me] = await Promise.all([params, getCurrentMember()]);
  return json(await getPhotoSocial(id, me));
});
