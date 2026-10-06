import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { getAlbum, getPhotos } from "@/lib/data";
import { deleteAlbum, updateAlbum, updateAlbumInput } from "@/lib/mutations";

/** GET /api/albums/:slug — thông tin album kèm danh sách ảnh. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/albums/[slug]">) => {
  const { slug } = await ctx.params;
  const [album, photos] = await Promise.all([getAlbum(slug), getPhotos(slug)]);
  if (!album) return json({ error: "Album not found" }, { status: 404 });
  return json({ album, photos });
});

/**
 * PATCH /api/albums/:slug — { title?, location?, tripDate?, coverPhotoId? } → { slug }
 * Sửa thông tin: admin. Đổi ảnh bìa: admin hoặc người tạo album.
 */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/albums/[slug]">) => {
  const actor = await requireMember();
  const { slug } = await ctx.params;
  const input = await readJson(req, updateAlbumInput);
  return json(await updateAlbum(actor, slug, input));
});

/** DELETE /api/albums/:slug — xoá album và mọi ảnh trong đó. Chỉ admin. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/albums/[slug]">) => {
  const actor = await requireMember();
  const { slug } = await ctx.params;
  return json(await deleteAlbum(actor, slug));
});
