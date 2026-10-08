const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** `2025-12-20` → `20 Dec 2025` */
export function formatDate(isoDate: string) {
  return dateFmt.format(new Date(`${isoDate.slice(0, 10)}T12:00:00+07:00`));
}

/**
 * Khoảng ngày của chuyến đi, gộp phần trùng:
 * `20 Dec 2025` · `20–22 Dec 2025` · `30 Nov – 2 Dec 2025` · `30 Dec 2025 – 2 Jan 2026`
 */
export function formatDateRange(start: string, end: string | null | undefined) {
  if (!end || end <= start) return formatDate(start);
  const [a, b] = [start, end].map((d) => formatDate(d).split(" ")); // [day, month, year]
  if (a[2] !== b[2]) return `${a.join(" ")} – ${b.join(" ")}`;
  if (a[1] !== b[1]) return `${a[0]} ${a[1]} – ${b.join(" ")}`;
  return `${a[0]}–${b.join(" ")}`;
}

/** Số ngày của chuyến (tính cả ngày đầu và cuối). */
export function tripDays(start: string, end: string | null | undefined) {
  if (!end || end <= start) return 1;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

export function formatDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso));
}

export function yearOf(isoDate: string) {
  return isoDate.slice(0, 4);
}

/** Bỏ dấu tiếng Việt + chữ thường, dùng cho tìm kiếm. */
export function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/** `Đà Lạt mùa sương 2025` → `da-lat-mua-suong-2025` */
export function slugify(s: string) {
  return normalizeText(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const MAX_DESCRIPTION_LENGTH = 600;

/**
 * Chuẩn hoá mô tả chuyến đi: bỏ khoảng trắng thừa ở đầu/cuối từng dòng, gộp nhiều dòng trống thành một.
 * Rỗng → null (album không có mô tả).
 */
export function cleanDescription(s: string | null | undefined) {
  const text = (s ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** `1 photo`, `3 photos` */
export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
const dayHeadingFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** Khoá ngày theo giờ Việt Nam, `YYYY-MM-DD` — dùng để gom ảnh theo ngày. */
export function dayKey(iso: string) {
  return dayKeyFmt.format(new Date(iso));
}

/** `Saturday 20 Dec` */
export function formatDayHeading(iso: string) {
  const s = dayHeadingFmt.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Thời lượng video: `0:07`, `3:05`, `1:02:09` */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// ---- Ngày kiểu dd/mm/yyyy cho ô nhập (giá trị bên trong vẫn là ISO `YYYY-MM-DD`) ----

/** `2026-10-07` → `07/10/2026`; rỗng → rỗng */
export function isoToDmy(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Định dạng dần khi gõ: chỉ giữ chữ số, tự chèn "/" → `07`, `07/10`, `07/10/2026`. */
export function maskDmy(text: string) {
  const d = text.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
}

/**
 * `07/10/2026` hoặc `7/10/26` → `2026-10-07`. Năm 2 chữ số hiểu là 20yy.
 * Ngày không tồn tại (vd 31/02) → null.
 */
export function dmyToIso(text: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
/** `just now`, `5 min ago`, `yesterday`, `3 days ago`; quá một tháng → ngày tháng. */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const d = Math.round(h / 24);
  if (d < 30) return rtf.format(-d, "day");
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(iso),
  );
}
