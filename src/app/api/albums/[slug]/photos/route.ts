import { handle, json, readJson } from "@/lib/api";
import { addPhotos, addPhotosInput } from "@/lib/mutations";

/**
 * POST /api/albums/:slug/photos — ghi ảnh đã upload lên R2 vào DB.
 * Body: { uploadedById?, photos: [{ key, width, height, sizeBytes, mimeType, takenAt? }] }
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/albums/[slug]/photos">) => {
  const { slug } = await ctx.params;
  const input = await readJson(req, addPhotosInput);
  return json(await addPhotos(slug, input), { status: 201 });
});
