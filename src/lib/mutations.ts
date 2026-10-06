import "server-only";
import { eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { albums, db, members, photos } from "@/db";
import { slugify } from "./format";
import { presignUpload } from "./storage";

// Các thao tác ghi. Mọi input từ client đều đi qua schema zod bên dưới trước khi chạm DB.
// TODO(auth): khi có đăng nhập Google, kiểm tra người gọi là thành viên ở đây.

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 100;

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
} as const;
type ImageType = keyof typeof IMAGE_TYPES;
const imageType = z.enum(Object.keys(IMAGE_TYPES) as [ImageType, ...ImageType[]]);

export class NotFoundError extends Error {}
export class BadRequestError extends Error {}

// ---------- Album ----------

export const createAlbumInput = z.object({
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(120),
  tripDate: z.iso.date(),
  createdById: z.uuid().optional(),
});

/** Tạo album mới với slug không trùng (`sapa-2026`, `sapa-2026-2`, ...). */
export async function createAlbum(input: z.infer<typeof createAlbumInput>) {
  const base = slugify(`${input.title} ${input.tripDate.slice(0, 4)}`) || "album";
  const taken = await db
    .select({ slug: albums.slug })
    .from(albums)
    .where(or(eq(albums.slug, base), like(albums.slug, `${base}-%`)));
  const used = new Set(taken.map((t) => t.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const [row] = await db
    .insert(albums)
    .values({ ...input, slug })
    .returning({ id: albums.id, slug: albums.slug });
  return row;
}

async function findAlbumId(slug: string) {
  const [row] = await db.select({ id: albums.id }).from(albums).where(eq(albums.slug, slug)).limit(1);
  if (!row) throw new NotFoundError(`Album “${slug}” not found`);
  return row.id;
}

// ---------- Upload ----------

export const presignInput = z.object({
  albumSlug: z.string().min(1),
  files: z
    .array(
      z.object({
        name: z.string().max(255),
        type: imageType,
        size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
      }),
    )
    .min(1)
    .max(MAX_FILES_PER_REQUEST),
});

/** Bước 1: cấp URL đã ký để trình duyệt PUT từng file thẳng lên R2. */
export async function presignPhotoUploads(input: z.infer<typeof presignInput>) {
  const albumId = await findAlbumId(input.albumSlug);
  return Promise.all(
    input.files.map(async (f) => {
      const key = `albums/${albumId}/${crypto.randomUUID()}.${IMAGE_TYPES[f.type]}`;
      return { name: f.name, key, contentType: f.type, uploadUrl: await presignUpload(key, f.type) };
    }),
  );
}

export const addPhotosInput = z.object({
  uploadedById: z.uuid().optional(),
  photos: z
    .array(
      z.object({
        key: z.string().min(1).max(300),
        width: z.number().int().positive().max(100_000),
        height: z.number().int().positive().max(100_000),
        sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
        mimeType: imageType,
        takenAt: z.iso.datetime({ offset: true }).optional(),
      }),
    )
    .min(1)
    .max(MAX_FILES_PER_REQUEST),
});

/** Bước 2: sau khi upload xong, ghi thông tin ảnh vào DB. */
export async function addPhotos(albumSlug: string, input: z.infer<typeof addPhotosInput>) {
  const albumId = await findAlbumId(albumSlug);

  // Chỉ nhận key do bước presign của đúng album này cấp ra
  const prefix = `albums/${albumId}/`;
  const bad = input.photos.find((p) => !p.key.startsWith(prefix) || p.key.includes(".."));
  if (bad) throw new BadRequestError(`Key does not belong to this album: ${bad.key}`);

  if (input.uploadedById) {
    const [m] = await db.select({ id: members.id }).from(members).where(eq(members.id, input.uploadedById)).limit(1);
    if (!m) throw new BadRequestError("Member not found");
  }

  const rows = await db
    .insert(photos)
    .values(
      input.photos.map((p) => ({
        albumId,
        storageKey: p.key,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        mimeType: p.mimeType,
        uploadedById: input.uploadedById,
        takenAt: p.takenAt ? new Date(p.takenAt) : undefined,
      })),
    )
    .onConflictDoNothing({ target: photos.storageKey })
    .returning({ id: photos.id });
  return { added: rows.length };
}

export async function getPhotoStorageKey(photoId: string) {
  if (!z.uuid().safeParse(photoId).success) return null;
  const [row] = await db
    .select({ storageKey: photos.storageKey })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  return row?.storageKey ?? null;
}
