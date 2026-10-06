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

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
