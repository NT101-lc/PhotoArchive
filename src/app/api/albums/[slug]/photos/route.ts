import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { addPhotos, addPhotosInput } from "@/lib/mutations";
import { kickTranscoder } from "@/lib/transcode";

/**
 * POST /api/albums/:slug/photos — ghi ảnh / video đã upload lên R2 vào DB (người upload = người đang dùng).
 * Body: { photos: [{ key, width, height, sizeBytes, mimeType, takenAt?, durationMs? }], coverKey? }
 * Có video → báo worker chuyển mã chạy ngay.
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/albums/[slug]/photos">) => {
  const actor = await requireMember();
  const { slug } = await ctx.params;
  const input = await readJson(req, addPhotosInput);
  const result = await addPhotos(actor, slug, input);
  if (result.queuedVideos > 0) kickTranscoder();
  return json(result, { status: 201 });
});
