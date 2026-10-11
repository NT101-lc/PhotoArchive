import { handle, json } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { BadRequestError } from "@/lib/mutations";
import { reversePlace } from "@/lib/places";

/** GET /api/places/reverse?lat=11.94&lng=108.44 — tên nơi (cấp thành phố) cho toạ độ GPS → { place | null }. Cần đã chọn tên. */
export const GET = handle(async (req: Request) => {
  await requireMember();
  const params = new URL(req.url).searchParams;
  const lat = params.get("lat");
  const lng = params.get("lng");
  // Thiếu tham số thì Number(null) = 0 → sẽ thành toạ độ (0, 0) ngoài biển
  if (!lat || !lng) throw new BadRequestError("lat and lng are required.");
  return json({ place: await reversePlace({ lat: Number(lat), lng: Number(lng) }) });
});
