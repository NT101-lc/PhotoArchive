// Ảnh cần chuyển định dạng trước khi xem được — hàm thuần, dùng ở mutations.ts, worker (scripts/transcode-worker.ts) và test.
//
// HEIC / HEIF (ảnh iPhone) nén bằng HEVC: Chrome, Firefox, Android không hiển thị được, bộ tối ưu ảnh của Next (sharp)
// cũng không giải mã được (bản dựng sẵn bỏ HEVC vì bản quyền). Nên ảnh HEIC vào hàng đợi như video; worker giải mã
// bằng libheif (WASM, heic-decode) rồi lưu lại thành JPEG và xoá file HEIC.

/** mozjpeg q80: ảnh iPhone 12 MP ≈ cùng dung lượng file HEIC gốc, nhìn không khác */
export const JPEG_QUALITY = 80;

const CONVERT_MIME = new Set(["image/heic", "image/heif"]);
const CONVERT_EXT = /\.(heic|heif)$/i;

/** Ảnh phải chuyển sang JPEG mới xem được (theo MIME, hoặc đuôi file khi trình duyệt không báo MIME). */
export function needsConversion(p: { mimeType?: string | null; key?: string | null }) {
  return (!!p.mimeType && CONVERT_MIME.has(p.mimeType.toLowerCase())) || (!!p.key && CONVERT_EXT.test(p.key));
}

/** Key R2 của bản JPEG, cạnh file gốc: `albums/<album>/<uuid>.heic` → `albums/<album>/<uuid>.jpg` */
export function convertedKey(originalKey: string) {
  return originalKey.replace(/\.[^./]+$/, "") + ".jpg";
}
