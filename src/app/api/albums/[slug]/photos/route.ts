import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { addPhotos, addPhotosInput } from "@/lib/mutations";

/**
 * POST /api/albums/:slug/photos — ghi ảnh đã upload lên R2 vào DB (người upload = người đang dùng).
 * Body: { photos: [{ key, width, height, sizeBytes, mimeType, takenAt? }], coverKey? }
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/albums/[slug]/photos">) => {
  const actor = await requireMember();
  const { slug } = await ctx.params;
  const input = await readJson(req, addPhotosInput);
  return json(await addPhotos(actor, slug, input), { status: 201 });
});
