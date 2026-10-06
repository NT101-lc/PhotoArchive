export type Album = {
  id: string;
  title: string;
  location: string;
  /** Ngày đi, định dạng ISO `YYYY-MM-DD` */
  tripDate: string;
  /** Ngày về (chuyến nhiều ngày), null nếu đi trong ngày */
  endDate: string | null;
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
};

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
