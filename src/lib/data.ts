import "server-only";
import { asc, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { albums, db, members, photos, ROLE_USER, type AlbumRow } from "@/db";
import { resolveObjectUrl, resolvePhotoUrl } from "./storage";
import type { Album, Member, Photo } from "./types";

// Data Access Layer: nơi duy nhất UI đọc dữ liệu. Chỉ chạy phía server,
// trả về DTO gọn (Album / Photo) thay vì nguyên hàng trong DB.

// Hàm (không phải hằng) để không đụng tới DB lúc import module
const photoCount = () => db.$count(photos, eq(photos.albumId, albums.id));

/** URL ảnh bìa cho từng album: ảnh bìa đã chọn, nếu không có thì ảnh chụp sớm nhất. */
async function coverUrls(rows: AlbumRow[]): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();
  const chosenIds = rows.map((r) => r.coverPhotoId).filter((id): id is string => !!id);
  const [chosen, earliest] = await Promise.all([
    chosenIds.length
      ? db.select().from(photos).where(inArray(photos.id, chosenIds))
      : Promise.resolve([]),
    db
      .selectDistinctOn([photos.albumId])
      .from(photos)
      .where(inArray(photos.albumId, rows.map((r) => r.id)))
      .orderBy(photos.albumId, asc(photos.takenAt)),
  ]);
  const byId = new Map(chosen.map((p) => [p.id, p]));
  const firstByAlbum = new Map(earliest.map((p) => [p.albumId, p]));
  return new Map(
    await Promise.all(
      rows.map(async (r) => {
        const p = (r.coverPhotoId && byId.get(r.coverPhotoId)) || firstByAlbum.get(r.id);
        return [r.id, p ? await resolvePhotoUrl(p) : ""] as const;
      }),
    ),
  );
}

function toAlbum(row: AlbumRow & { photoCount: number }, coverUrl: string): Album {
  return {
    id: row.slug,
    title: row.title,
    location: row.location,
    tripDate: row.tripDate,
    endDate: row.endDate,
    description: row.description,
    coverUrl,
    photoCount: row.photoCount,
    coverPhotoId: row.coverPhotoId,
    createdById: row.createdById,
  };
}

/** Danh sách album, mới nhất trước. */
export const getAlbums = cache(async (): Promise<Album[]> => {
  await connection(); // luôn đọc dữ liệu mới theo từng request
  const rows = await db
    .select({ ...getTableColumns(albums), photoCount: photoCount() })
    .from(albums)
    .orderBy(desc(albums.tripDate), desc(albums.createdAt));
  const covers = await coverUrls(rows);
  return rows.map((r) => toAlbum(r, covers.get(r.id) ?? ""));
});

/** Một album theo slug, `null` nếu không tồn tại. */
export const getAlbum = cache(async (slug: string): Promise<Album | null> => {
  await connection();
  const [row] = await db
    .select({ ...getTableColumns(albums), photoCount: photoCount() })
    .from(albums)
    .where(eq(albums.slug, slug))
    .limit(1);
  if (!row) return null;
  const covers = await coverUrls([row]);
  return toAlbum(row, covers.get(row.id) ?? "");
});

/** Ảnh của một album (theo slug), theo thứ tự thời gian chụp. */
export const getPhotos = cache(async (slug: string): Promise<Photo[]> => {
  await connection();
  const rows = await db
    .select({ photo: photos, uploader: members.name })
    .from(photos)
    .innerJoin(albums, eq(albums.id, photos.albumId))
    .leftJoin(members, eq(members.id, photos.uploadedById))
    .where(eq(albums.slug, slug))
    .orderBy(asc(photos.takenAt), asc(photos.createdAt));

  return Promise.all(
    rows.map(async ({ photo, uploader }) => {
      const url = await resolvePhotoUrl(photo);
      return {
        id: photo.id,
        albumId: slug,
        url,
        // next/image tự resize khi hiển thị lưới, nên thumb dùng chung file gốc
        thumbUrl: url,
        width: photo.width,
        height: photo.height,
        uploadedBy: uploader ?? "Unknown",
        uploadedById: photo.uploadedById,
        takenAt: photo.takenAt.toISOString(),
      };
    }),
  );
});

/** Thành viên thường (role 1) để chọn "Bạn là ai". Tài khoản admin không nằm trong danh sách này. */
export const getMembers = cache(async (): Promise<Member[]> => {
  await connection();
  const rows = await db
    .select({ id: members.id, name: members.name, avatarKey: members.avatarKey })
    .from(members)
    .where(eq(members.role, ROLE_USER))
    .orderBy(asc(members.createdAt), asc(members.name));
  return Promise.all(
    rows.map(async ({ avatarKey, ...m }) => ({ ...m, avatarUrl: await resolveObjectUrl(avatarKey) })),
  );
});

