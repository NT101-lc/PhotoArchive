import { handle, json, readJson } from "@/lib/api";
import { getAlbums } from "@/lib/data";
import { createAlbum, createAlbumInput } from "@/lib/mutations";

/** GET /api/albums — danh sách album, mới nhất trước. */
export const GET = handle(async () => json({ albums: await getAlbums() }));

/** POST /api/albums — tạo album { title, location, tripDate, createdById? } → { id, slug } */
export const POST = handle(async (req: Request) => {
  const input = await readJson(req, createAlbumInput);
  return json(await createAlbum(input), { status: 201 });
});
