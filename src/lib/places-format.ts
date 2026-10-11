// Chọn địa điểm cho album / kế hoạch — hàm thuần, dùng chung cho server (lib/places.ts) và trình duyệt.
// Dữ liệu từ Photon (https://photon.komoot.io, OpenStreetMap): miễn phí, không cần key.

export type Coords = { lat: number; lng: number };

/** Một gợi ý: `name` là chữ được lưu vào album ("Đà Lạt"), `detail` chỉ để phân biệt khi chọn ("Lâm Đồng"). */
export type Place = Coords & { name: string; detail: string };

/** Một feature trong GeoJSON Photon trả về (chỉ những trường dùng tới) */
export type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    county?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

export const MAX_PLACE_LENGTH = 120;
/** Một chuyến đi qua tối đa chừng này nơi */
export const MAX_PLACES = 8;

/** Một nơi của chuyến đi (lưu trong albums.places): toạ độ null khi nơi được gõ tay */
export type TripPlace = { name: string; lat: number | null; lng: number | null };

export function tripPlace(p: { name: string; lat?: number | null; lng?: number | null }): TripPlace {
  return { name: p.name.trim().slice(0, MAX_PLACE_LENGTH), lat: p.lat ?? null, lng: p.lng ?? null };
}

/** Chuỗi hiển thị / tìm kiếm của cả chuyến: "Đà Lạt, Nha Trang" (lưu vào albums.location, plans.location) */
export function joinPlaces(places: Array<{ name: string }>) {
  return places.map((p) => p.name).join(", ");
}

/** Cùng một nơi khi tên giống nhau không kể hoa thường ("Đà Lạt" = "đà lạt") */
const placeKey = (name: string) => name.trim().toLocaleLowerCase("vi");
export const sameName = (a: string, b: string) => placeKey(a) === placeKey(b);

/** Tên các nơi khác nhau qua mọi chuyến (không phân biệt hoa thường) — "Đà Lạt, Nha Trang" là 2 nơi */
export function distinctPlaceNames(albums: Array<{ places: Array<{ name: string }> }>) {
  const byKey = new Map<string, string>();
  for (const a of albums) for (const p of a.places) if (!byKey.has(placeKey(p.name))) byKey.set(placeKey(p.name), p.name);
  return [...byKey.values()];
}

/** Thêm một nơi vào danh sách: bỏ chữ trống, bỏ trùng tên (không phân biệt hoa thường), tối đa MAX_PLACES. */
export function addPlace(places: TripPlace[], place: TripPlace) {
  const name = place.name.trim();
  if (!name || places.length >= MAX_PLACES) return places;
  if (places.some((p) => sameName(p.name, name))) return places;
  return [...places, { ...place, name }];
}

/** Danh sách nơi kèm chữ đang gõ dở trong ô (chưa bấm Enter) — để bấm lưu ngay cũng không mất chữ đó. */
export function withDraft(places: TripPlace[], draft: string) {
  return addPlace(places, tripPlace({ name: draft }));
}

/** Đường, trạm xe buýt, ranh giới hành chính cũ (trước khi sáp nhập tỉnh 2025) → không phải nơi để đặt tên chuyến. */
function isNoise(p: NonNullable<PhotonFeature["properties"]>) {
  return p.osm_key === "highway" || (p.osm_key === "boundary" && p.osm_value === "historic");
}

/** "Phường Xuân Hương - Đà Lạt", "Xã Tả Van"… — cấp phường / xã, quá vụn để làm dòng phụ */
const WARD = /^(phường|xã|thị trấn|đặc khu)\s/i;

function detailOf(p: NonNullable<PhotonFeature["properties"]>, name: string) {
  const parts: string[] = [];
  const add = (s: string | undefined) => {
    if (s && !WARD.test(s) && s !== name && !parts.includes(s)) parts.push(s);
  };
  if (p.city && !p.city.includes(name)) add(p.city);
  add(p.state);
  // Trong nước thì không cần ghi "Việt Nam"
  if (p.countrycode !== "VN") add(p.country);
  return parts.join(", ");
}

function coordsOf(f: PhotonFeature): Coords | null {
  const c = f.geometry?.coordinates;
  if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
  return { lat: round(c[1]), lng: round(c[0]) };
}

/** 5 chữ số thập phân ≈ 1 m — đủ cho một chuyến đi */
const round = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * Thứ tự ưu tiên: trong nước trước nước ngoài (gõ dở "da la" thì Đà Lạt phải đứng trên mấy làng ở Myanmar);
 * trong đó địa danh (thành phố, thị trấn, đảo… — thứ người ta đặt tên chuyến) trước địa điểm khác (quán, nhà ga…);
 * cấp phường / xã cuối cùng. Cùng hạng thì giữ thứ tự độ khớp của Photon.
 */
function rank(p: NonNullable<PhotonFeature["properties"]>) {
  if (p.name && WARD.test(p.name)) return 4;
  return (p.countrycode === "VN" ? 0 : 2) + (p.osm_key === "place" ? 0 : 1);
}

/** Kết quả tìm kiếm Photon → danh sách gợi ý (bỏ nhiễu, bỏ trùng tên + dòng phụ). */
export function placesFromSearch(features: PhotonFeature[], limit = 6): Place[] {
  const out: Place[] = [];
  const seen = new Set<string>();
  // sort ổn định (giữ thứ tự gốc trong cùng hạng)
  const ranked = features.map((f, i) => ({ f, i, r: f.properties ? rank(f.properties) : 3 })).sort((a, b) => a.r - b.r || a.i - b.i);
  for (const { f } of ranked) {
    const p = f.properties;
    const coords = coordsOf(f);
    const name = p?.name?.trim().slice(0, MAX_PLACE_LENGTH);
    if (!p || !coords || !name || isNoise(p)) continue;
    const detail = detailOf(p, name);
    const key = `${name}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, detail, ...coords });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Tìm ngược toạ độ (GPS của ảnh) → tên nơi ở cấp thành phố, cho tên chuyến ("Đà Lạt", không phải "Hùng Vương").
 * - Kết quả là địa danh (lib/places.ts hỏi thành phố / thị trấn gần nhất trước) → lấy luôn tên + toạ độ của nó.
 *   Cách này đúng cả sau đợt sáp nhập 2025: phố cổ Hội An ra "Hội An" chứ không phải "Đà Nẵng".
 * - Không thì là địa chỉ (con đường gần nhất) → lấy cấp hành chính lớn dần, bỏ phường / xã.
 */
export function placeFromReverse(features: PhotonFeature[], at: Coords): Place | null {
  const f = features[0];
  const p = f?.properties;
  if (!p) return null;
  if (p.osm_key === "place" && p.name) {
    const name = p.name.trim().slice(0, MAX_PLACE_LENGTH);
    return { name, detail: detailOf(p, name), ...(coordsOf(f) ?? { lat: round(at.lat), lng: round(at.lng) }) };
  }
  const name = [p.city, p.county, p.state, p.name].find((s) => s && !WARD.test(s))?.trim().slice(0, MAX_PLACE_LENGTH);
  if (!name) return null;
  return { name, detail: detailOf(p, name), lat: round(at.lat), lng: round(at.lng) };
}

/**
 * Gom toạ độ GPS của nhiều ảnh thành vài cụm (ô lưới ~11 km), cụm đông ảnh nhất trước —
 * để gợi ý nơi chụp mà chỉ phải tìm ngược vài lần dù album có cả nghìn ảnh.
 */
export function gpsClusters(points: Coords[], max = 3): Array<Coords & { count: number }> {
  const cells = new Map<string, { lat: number; lng: number; count: number }>();
  for (const pt of points) {
    if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng) || (pt.lat === 0 && pt.lng === 0)) continue;
    const key = `${Math.round(pt.lat * 10)},${Math.round(pt.lng * 10)}`;
    const c = cells.get(key) ?? { lat: 0, lng: 0, count: 0 };
    c.lat += pt.lat;
    c.lng += pt.lng;
    c.count++;
    cells.set(key, c);
  }
  return [...cells.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
    .map((c) => ({ lat: round(c.lat / c.count), lng: round(c.lng / c.count), count: c.count }));
}
