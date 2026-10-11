import "server-only";
import { z } from "zod";
import { BadRequestError } from "./mutations";
import { placeFromReverse, placesFromSearch, type Coords, type Place, type PhotonFeature } from "./places-format";

// Tìm địa điểm qua Photon (OpenStreetMap) — miễn phí, không cần key. Đây là máy chủ công cộng dùng chung,
// nên gọi qua server của app (không gọi thẳng từ trình duyệt) để: ghi rõ app nào đang gọi (User-Agent),
// nhớ kết quả (người gõ "da", "da l", "da la"… nhiều lần cùng một chữ), và đổi nhà cung cấp chỉ ở file này.

const PHOTON = "https://photon.komoot.io";
const HEADERS = { "User-Agent": "thesix-photoarchive (private photo archive for a group of friends)" };
/** Ưu tiên kết quả ở Việt Nam (giữa nước, phạm vi rộng) nhưng vẫn tìm được nơi ở nước ngoài */
const BIAS = { lat: "16", lon: "106", zoom: "5" };

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; value: unknown }>();

/** Nhớ kết quả trong bộ nhớ của server (đủ cho một nhóm nhỏ; mất khi server khởi động lại cũng không sao). */
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** URLSearchParams khi cần lặp một tham số (vd nhiều osm_tag) */
async function photon(path: string, params: Record<string, string> | URLSearchParams) {
  const res = await fetch(`${PHOTON}${path}?${new URLSearchParams(params)}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const body = (await res.json()) as { features?: PhotonFeature[] };
  return body.features ?? [];
}

export const placeQuery = z.string().trim().min(2).max(100);

/** Gợi ý địa điểm cho chữ đang gõ. */
export async function searchPlaces(raw: string): Promise<Place[]> {
  const parsed = placeQuery.safeParse(raw);
  if (!parsed.success) throw new BadRequestError("Type at least 2 characters.");
  const q = parsed.data.toLowerCase();
  // Lấy dư rồi lọc (bỏ đường, ranh giới cũ, tên trùng)
  return cached(`q:${q}`, async () => placesFromSearch(await photon("/api/", { q, limit: "10", ...BIAS })));
}

export const coordsInput = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Tên nơi (cấp thành phố) cho một toạ độ — dùng để gợi ý từ GPS của ảnh. */
export async function reversePlace(input: Coords): Promise<Place | null> {
  const at = coordsInput.parse(input);
  // Làm tròn ~100 m để các ảnh chụp gần nhau dùng chung kết quả đã nhớ
  const key = `r:${at.lat.toFixed(3)},${at.lng.toFixed(3)}`;
  return cached(key, async () => {
    const point = { lat: String(at.lat), lon: String(at.lng), limit: "1" };
    // Thành phố / thị trấn gần nhất trong 30 km; giữa biển, rừng… thì lấy địa chỉ của điểm đó
    const params = new URLSearchParams({ ...point, radius: "30" });
    params.append("osm_tag", "place:city");
    params.append("osm_tag", "place:town");
    const near = await photon("/reverse", params);
    return placeFromReverse(near.length ? near : await photon("/reverse", point), at);
  });
}
