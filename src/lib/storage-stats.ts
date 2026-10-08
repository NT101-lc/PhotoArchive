// Tính toán dung lượng cho dashboard — hàm thuần (dùng trong lib/stats.ts và test).

/** Gói miễn phí của R2 */
export const R2_FREE_BYTES = 10 * 1000 ** 3;

export const STORAGE_CATEGORIES = {
  photos: "Photos",
  videoOriginals: "Original videos",
  videoCopies: "Compressed videos",
  posters: "Video posters",
  avatars: "Profile pictures",
} as const;
export type StorageCategory = keyof typeof STORAGE_CATEGORIES;

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv|3gp)$/i;

/** Loại file theo key trên R2 (xem cách đặt tên trong lib/transcode-plan.ts và lib/mutations.ts). */
export function categorizeKey(key: string): StorageCategory {
  if (key.startsWith("avatars/")) return "avatars";
  if (/\.(540|720|1080)\.mp4$/.test(key)) return "videoCopies";
  if (/\.poster\.jpg$/.test(key)) return "posters";
  if (VIDEO_EXT.test(key)) return "videoOriginals";
  return "photos";
}

export function storageBreakdown(objects: Array<{ key: string; size: number }>) {
  const bytes = Object.fromEntries(Object.keys(STORAGE_CATEGORIES).map((k) => [k, 0])) as Record<StorageCategory, number>;
  for (const o of objects) bytes[categorizeKey(o.key)] += o.size;
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  return { bytes, total };
}

/**
 * Dự đoán ngày vượt gói miễn phí theo tốc độ upload gần đây.
 * `recentOriginalBytes`: dung lượng file gốc upload trong `windowDays` ngày qua (từ DB);
 * nhân với tỉ lệ (tổng R2 / tổng file gốc) để tính cả bản chuyển mã, poster.
 */
export function storageForecast(input: {
  usedBytes: number;
  totalOriginalBytes: number;
  recentOriginalBytes: number;
  windowDays: number;
  now?: Date;
}) {
  const { usedBytes, totalOriginalBytes, recentOriginalBytes, windowDays } = input;
  const overhead = totalOriginalBytes > 0 ? Math.max(1, usedBytes / totalOriginalBytes) : 1;
  const bytesPerDay = (recentOriginalBytes * overhead) / windowDays;
  const left = R2_FREE_BYTES - usedBytes;
  if (left <= 0) return { bytesPerDay, daysLeft: 0, date: null, over: true };
  if (bytesPerDay <= 0) return { bytesPerDay, daysLeft: null, date: null, over: false };
  const daysLeft = Math.ceil(left / bytesPerDay);
  const date = new Date((input.now ?? new Date()).getTime() + daysLeft * 86_400_000);
  return { bytesPerDay, daysLeft, date, over: false };
}
