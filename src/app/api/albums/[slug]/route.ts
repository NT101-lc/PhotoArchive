import { handle, json } from "@/lib/api";
import { getAlbum, getPhotos } from "@/lib/data";

/** GET /api/albums/:slug — thông tin album kèm danh sách ảnh. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/albums/[slug]">) => {
  const { slug } = await ctx.params;
  const [album, photos] = await Promise.all([getAlbum(slug), getPhotos(slug)]);
  if (!album) return json({ error: "Album not found" }, { status: 404 });
  return json({ album, photos });
});
