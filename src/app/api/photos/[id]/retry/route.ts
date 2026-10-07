import { handle, json } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { retryVideo } from "@/lib/mutations";
import { kickTranscoder } from "@/lib/transcode";

/** POST /api/photos/:id/retry — cho video lỗi chuyển mã vào hàng đợi lại. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/photos/[id]/retry">) => {
  const actor = await requireMember();
  const { id } = await ctx.params;
  const result = await retryVideo(actor, id);
  kickTranscoder();
  return json(result);
});
