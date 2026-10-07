// Định dạng ảnh / video được nhận. Dùng chung cho trình duyệt (lọc file) và server (kiểm tra input).

/** MIME → đuôi file lưu trên R2 */
export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
} as const;

export const VIDEO_TYPES = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "video/x-matroska": "mkv",
  "video/3gpp": "3gp",
} as const;

export const MEDIA_TYPES = { ...IMAGE_TYPES, ...VIDEO_TYPES } as const;

export type ImageType = keyof typeof IMAGE_TYPES;
export type VideoType = keyof typeof VIDEO_TYPES;
export type MediaType = keyof typeof MEDIA_TYPES;

export function isVideoType(type: string): type is VideoType {
  return type in VIDEO_TYPES;
}

/** Đuôi file → MIME (trình duyệt hay để trống `File.type`, nhất là HEIC trên Windows và MKV) */
export const MIME_BY_EXT: Record<string, MediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
};

/** MIME của file theo `File.type`, không có thì đoán theo đuôi; `null` nếu không nhận. */
export function mediaTypeOf(file: { name: string; type: string }): MediaType | null {
  if (file.type in MEDIA_TYPES) return file.type as MediaType;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}
