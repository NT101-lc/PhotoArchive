const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const dateTimeFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** `2025-12-20` → `20/12/2025` */
export function formatDate(isoDate: string) {
  return dateFmt.format(new Date(`${isoDate.slice(0, 10)}T12:00:00+07:00`));
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

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
const dayHeadingFmt = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** Khoá ngày theo giờ Việt Nam, `YYYY-MM-DD` — dùng để gom ảnh theo ngày. */
export function dayKey(iso: string) {
  return dayKeyFmt.format(new Date(iso));
}

/** `Thứ Bảy, 20/12` */
export function formatDayHeading(iso: string) {
  const s = dayHeadingFmt.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
