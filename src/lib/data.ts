import { MOCK_ALBUMS, MOCK_PHOTOS } from "./mock-data";
import type { Album, Photo } from "./types";

// Lớp truy cập dữ liệu duy nhất mà UI được phép dùng.
// Khi có backend, chỉ cần thay phần thân các hàm này bằng lời gọi API thật;
// chữ ký (tham số + kiểu trả về) giữ nguyên để không phải sửa component.

const MOCK_LATENCY_MS = 350;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

/** Danh sách album, mới nhất trước. */
export async function getAlbums(): Promise<Album[]> {
  const albums = [...MOCK_ALBUMS].sort((a, b) => b.tripDate.localeCompare(a.tripDate));
  return delay(albums);
}

/** Một album theo id, `null` nếu không tồn tại. */
export async function getAlbum(id: string): Promise<Album | null> {
  return delay(MOCK_ALBUMS.find((a) => a.id === id) ?? null);
}

/** Ảnh của một album, theo thứ tự thời gian chụp. */
export async function getPhotos(albumId: string): Promise<Photo[]> {
  const photos = MOCK_PHOTOS.filter((p) => p.albumId === albumId).sort((a, b) =>
    a.takenAt.localeCompare(b.takenAt),
  );
  return delay(photos);
}
