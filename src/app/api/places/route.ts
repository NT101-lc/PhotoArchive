import { handle, json } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { searchPlaces } from "@/lib/places";

/** GET /api/places?q=da lat — gợi ý địa điểm (Photon / OpenStreetMap) → { places: [{ name, detail, lat, lng }] }. Cần đã chọn tên. */
export const GET = handle(async (req: Request) => {
  await requireMember();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return json({ places: await searchPlaces(q) });
});
