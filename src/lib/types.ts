export type Album = {
  id: string;
  title: string;
  location: string;
  /** Ngày đi, định dạng ISO `YYYY-MM-DD` */
  tripDate: string;
  /** Ngày về (chuyến nhiều ngày), null nếu đi trong ngày */
  endDate: string | null;
  /** Vài dòng kể về chuyến đi; null nếu chưa ai viết */
  description: string | null;
  coverUrl: string;
  photoCount: number;
  /** Ảnh bìa đã chọn; null → bìa là ảnh đầu tiên */
  coverPhotoId: string | null;
  createdById: string | null;
};

export type Photo = {
  id: string;
  albumId: string;
  /** Ảnh gốc, độ phân giải đầy đủ */
  url: string;
  /** Ảnh thu nhỏ cho lưới */
  thumbUrl: string;
  width: number;
  height: number;
  uploadedBy: string;
  uploadedById: string | null;
  /** Thời điểm chụp, ISO datetime */
  takenAt: string;
  kind: "photo" | "video";
  /** Ảnh luôn "ready". Video: chờ / đang chuyển mã / xong / lỗi */
  status: "queued" | "processing" | "ready" | "failed";
  /** Video: thời lượng (ms) */
  durationMs: number | null;
  /** Video đã chuyển mã: URL MP4 theo độ phân giải (cạnh ngắn); thiếu bản nào thì không có key đó */
  sources: VideoSources | null;
  /** Video: lỗi chuyển mã gần nhất */
  processingError: string | null;
  /** Số bình luận / số người thả cảm xúc (cho ô ảnh); chi tiết lấy riêng khi mở lightbox */
  commentCount: number;
  reactionCount: number;
};

export type VideoSources = { "720"?: string; "1080"?: string };

export type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

/** Người đang dùng: role 0 = admin, 1 = user. */
export type Me = {
  id: string;
  name: string;
  role: number;
  avatarUrl: string | null;
};
