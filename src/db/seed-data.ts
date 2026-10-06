import type { Album, Photo } from "../lib/types";

// Kiểu dữ liệu mẫu: chỉ các trường cần để seed (không có các id sinh ra trong DB)
type SeedAlbum = Omit<Album, "coverPhotoId" | "createdById">;
type SeedPhoto = Omit<Photo, "uploadedById">;

// Dữ liệu mẫu để seed DB (npm run db:seed).
// Mọi giá trị đều tất định (không dùng Math.random) để server/client render giống nhau.

export const MEMBERS = ["Nam Anh", "Diệp", "Thảo", "Hoàng", "Nam", "Hưng"];

// Các tỉ lệ ảnh hay gặp: ngang 3:2, dọc 2:3, 4:3, 3:4, 16:9
const SHAPES: Array<[number, number]> = [
  [1600, 1067],
  [1067, 1600],
  [1600, 1200],
  [1200, 1600],
  [1600, 900],
];

const THUMB_WIDTH = 600;

type AlbumSeed = Omit<SeedAlbum, "coverUrl" | "photoCount"> & { count: number };

const ALBUM_SEEDS: AlbumSeed[] = [
  { id: "da-lat-2025", title: "Đà Lạt mùa sương", location: "Đà Lạt", tripDate: "2025-12-20", count: 14 },
  { id: "phu-quoc-2025", title: "Phú Quốc biển xanh", location: "Phú Quốc", tripDate: "2025-07-11", count: 12 },
  { id: "ha-giang-2024", title: "Cung đường Hà Giang", location: "Hà Giang", tripDate: "2024-10-02", count: 15 },
  { id: "hoi-an-2024", title: "Hội An đêm đèn lồng", location: "Hội An", tripDate: "2024-04-27", count: 10 },
  { id: "da-lat-2023", title: "Đà Lạt lần đầu", location: "Đà Lạt", tripDate: "2023-12-23", count: 9 },
  { id: "vung-tau-2023", title: "Vũng Tàu cuối tuần", location: "Vũng Tàu", tripDate: "2023-06-17", count: 8 },
];

function picsum(seed: string, w: number, h: number) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

function buildPhotos(album: AlbumSeed): SeedPhoto[] {
  const start = new Date(`${album.tripDate}T07:30:00+07:00`).getTime();
  const albumIndex = ALBUM_SEEDS.indexOf(album);

  return Array.from({ length: album.count }, (_, i) => {
    const [width, height] = SHAPES[(i * 7 + albumIndex * 3) % SHAPES.length];
    const seed = `b6-${album.id}-${i + 1}`;
    // Rải ảnh trong khoảng 2 ngày, mỗi ảnh cách nhau ~3 tiếng 17 phút
    const takenAt = new Date(start + i * (3 * 60 + 17) * 60 * 1000).toISOString();

    return {
      id: `${album.id}-${String(i + 1).padStart(2, "0")}`,
      albumId: album.id,
      url: picsum(seed, width, height),
      thumbUrl: picsum(seed, THUMB_WIDTH, Math.round((THUMB_WIDTH * height) / width)),
      width,
      height,
      uploadedBy: MEMBERS[(i + albumIndex) % MEMBERS.length],
      takenAt,
    };
  });
}

export const MOCK_PHOTOS: SeedPhoto[] = ALBUM_SEEDS.flatMap(buildPhotos);

export const MOCK_ALBUMS: SeedAlbum[] = ALBUM_SEEDS.map(({ count, ...album }) => ({
  ...album,
  coverUrl: picsum(`b6-${album.id}-cover`, 1200, 800),
  photoCount: count,
}));
