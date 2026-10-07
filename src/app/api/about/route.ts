import { getAbout, updateAbout, updateAboutInput } from "@/lib/about";
import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";

/** GET /api/about — các đoạn chữ của trang About. */
export const GET = handle(async () => json(await getAbout()));

/** PUT /api/about — ghi đè { paragraphs: string[] }. Cần đã chọn tên. */
export const PUT = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, updateAboutInput);
  return json(await updateAbout(actor, input));
});
