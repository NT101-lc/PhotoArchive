export type Album = {
  id: string;
  title: string;
  location: string;
  /** Ngày đi, định dạng ISO `YYYY-MM-DD` */
  tripDate: string;
  coverUrl: string;
  photoCount: number;
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
  /** Thời điểm chụp, ISO datetime */
  takenAt: string;
};

export type Member = {
  id: string;
  name: string;
};
