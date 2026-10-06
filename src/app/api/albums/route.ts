import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { getAlbums } from "@/lib/data";
import { createAlbum, createAlbumInput } from "@/lib/mutations";

/** GET /api/albums — danh sách album, mới nhất trước. */
export const GET = handle(async () => json({ albums: await getAlbums() }));

/** POST /api/albums — tạo album { title, location, tripDate } → { id, slug }. Cần đã chọn tên. */
export const POST = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, createAlbumInput);
  return json(await createAlbum(actor, input), { status: 201 });
});
