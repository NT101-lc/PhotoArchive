import "server-only";
import { and, eq, ilike, isNotNull, like, ne, or } from "drizzle-orm";
import { z } from "zod";
import { albums, db, members, photos } from "@/db";
import { ForbiddenError } from "./auth";
import { slugify } from "./format";
import {
  canDeleteAlbum,
  canDeletePhoto,
  canEditAlbum,
  canEditAlbumDate,
  canRenameSelf,
  canSetCover,
  type Actor,
} from "./permissions";
import { deleteObjects, presignUpload } from "./storage";

// Các thao tác ghi. Mọi input từ client đi qua schema zod, mọi thao tác nhận `actor`
// (người đang dùng, lấy từ cookie đã ký) và kiểm tra quyền theo lib/permissions.ts.

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

async function findAlbum(slug: string) {
  const [row] = await db
    .select({ id: albums.id, createdById: albums.createdById })
    .from(albums)
    .where(eq(albums.slug, slug))
    .limit(1);
  if (!row) throw new NotFoundError(`Album “${slug}” not found`);
  return row;
}

async function uniqueSlug(title: string, tripDate: string, exceptId?: string) {
  const base = slugify(`${title} ${tripDate.slice(0, 4)}`) || "album";
  const taken = await db
    .select({ id: albums.id, slug: albums.slug })
    .from(albums)
    .where(or(eq(albums.slug, base), like(albums.slug, `${base}-%`)));
  const used = new Set(taken.filter((t) => t.id !== exceptId).map((t) => t.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

// ---------- Album ----------

// Ngày về trùng ngày đi → coi như đi trong ngày (lưu null)
const endDateInput = z.iso.date().nullable();
const END_BEFORE_START = "The last day can’t be before the first day.";

/** Chuẩn hoá khoảng ngày: ngày về rỗng / trùng ngày đi → null; ngày về trước ngày đi → lỗi. */
export function normalizeEndDate(tripDate: string, endDate: string | null | undefined) {
  if (!endDate || endDate === tripDate) return null;
  if (endDate < tripDate) throw new BadRequestError(END_BEFORE_START);
  return endDate;
}

export const createAlbumInput = z.object({
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(120),
  tripDate: z.iso.date(),
  endDate: endDateInput.optional(),
});

/** Tạo album mới (mọi thành viên). Slug không trùng: `sapa-2026`, `sapa-2026-2`, ... */
export async function createAlbum(actor: Actor, input: z.infer<typeof createAlbumInput>) {
  const slug = await uniqueSlug(input.title, input.tripDate);
  const endDate = normalizeEndDate(input.tripDate, input.endDate);
  const [row] = await db
    .insert(albums)
    .values({ ...input, endDate, slug, createdById: actor.id })
    .returning({ id: albums.id, slug: albums.slug });
  return row;
}

export const updateAlbumInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    location: z.string().trim().min(1).max(120),
    tripDate: z.iso.date(),
    endDate: endDateInput,
    // null = bỏ ảnh bìa đã chọn, quay về ảnh đầu tiên
    coverPhotoId: z.uuid().nullable(),
  })
  .partial();

/** Sửa album. Tên / nơi: chỉ admin. Ngày đi / về: mọi thành viên. Ảnh bìa: admin hoặc người tạo album. */
export async function updateAlbum(actor: Actor, slug: string, input: z.infer<typeof updateAlbumInput>) {
  const album = await findAlbum(slug);
  const { coverPhotoId, ...info } = input;

  if ((info.title !== undefined || info.location !== undefined) && !canEditAlbum(actor)) {
    throw new ForbiddenError("Only the admin can rename an album or change its place.");
  }
  if ((info.tripDate !== undefined || info.endDate !== undefined) && !canEditAlbumDate(actor)) {
    throw new ForbiddenError("Choose who you are first.");
  }
  if (coverPhotoId !== undefined && !canSetCover(actor, album)) {
    throw new ForbiddenError("Only the admin or the album’s creator can change its cover.");
  }
  if (coverPhotoId) {
    const [p] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.id, coverPhotoId), eq(photos.albumId, album.id)))
      .limit(1);
    if (!p) throw new BadRequestError("Cover photo must belong to this album.");
  }

  const patch: Partial<typeof albums.$inferInsert> = { ...info };
  if (coverPhotoId !== undefined) patch.coverPhotoId = coverPhotoId;
  if (info.title || info.tripDate || info.endDate !== undefined) {
    const [cur] = await db.select().from(albums).where(eq(albums.id, album.id));
    const start = info.tripDate ?? cur.tripDate;
    // Đổi ngày đi mà không gửi ngày về → giữ ngày về cũ nếu vẫn sau ngày đi, không thì bỏ
    patch.endDate =
      info.endDate !== undefined
        ? normalizeEndDate(start, info.endDate)
        : cur.endDate && cur.endDate > start
          ? cur.endDate
          : null;
    if (info.title || info.tripDate) patch.slug = await uniqueSlug(info.title ?? cur.title, start, album.id);
  }
  if (Object.keys(patch).length === 0) return { slug };

  const [row] = await db.update(albums).set(patch).where(eq(albums.id, album.id)).returning({ slug: albums.slug });
  return row;
}

/** Xoá album + toàn bộ ảnh (DB và file trên R2). Chỉ admin. */
export async function deleteAlbum(actor: Actor, slug: string) {
  if (!canDeleteAlbum(actor)) throw new ForbiddenError("Only the admin can delete albums.");
  const album = await findAlbum(slug);
  const files = await db
    .select({ key: photos.storageKey })
    .from(photos)
    .where(and(eq(photos.albumId, album.id), isNotNull(photos.storageKey)));
  await db.delete(albums).where(eq(albums.id, album.id)); // ảnh xoá theo (cascade)
  const failed = await deleteObjects(files.map((f) => f.key!));
  if (failed.length) console.error(`R2: could not delete ${failed.length} file(s) of album ${slug}`, failed);
  return { deletedPhotos: files.length };
}

// ---------- Ảnh ----------

/** Xoá một ảnh: admin, hoặc người đã upload. Nếu ảnh đang là bìa thì album quay về ảnh đầu tiên. */
export async function deletePhoto(actor: Actor, photoId: string) {
  if (!z.uuid().safeParse(photoId).success) throw new NotFoundError("Photo not found");
  const [p] = await db
    .select({ id: photos.id, uploadedById: photos.uploadedById, storageKey: photos.storageKey })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  if (!p) throw new NotFoundError("Photo not found");
  if (!canDeletePhoto(actor, p)) throw new ForbiddenError("You can only delete photos you uploaded.");

  await db.delete(photos).where(eq(photos.id, p.id)); // cover_photo_id tự về null (on delete set null)
  if (p.storageKey) {
    const failed = await deleteObjects([p.storageKey]);
    if (failed.length) console.error("R2: could not delete", failed);
  }
  return { deleted: 1 };
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
export async function presignPhotoUploads(_actor: Actor, input: z.infer<typeof presignInput>) {
  const album = await findAlbum(input.albumSlug);
  return Promise.all(
    input.files.map(async (f) => {
      const key = `albums/${album.id}/${crypto.randomUUID()}.${IMAGE_TYPES[f.type]}`;
      return { name: f.name, key, contentType: f.type, uploadUrl: await presignUpload(key, f.type) };
    }),
  );
}

export const addPhotosInput = z.object({
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
  // Ảnh được chọn làm bìa (một trong các key ở trên). Bỏ trống → bìa vẫn là ảnh đầu tiên.
  coverKey: z.string().optional(),
});

/** Bước 2: sau khi upload xong, ghi ảnh vào DB (người upload = actor) và đặt ảnh bìa nếu có chọn. */
export async function addPhotos(actor: Actor, albumSlug: string, input: z.infer<typeof addPhotosInput>) {
  const album = await findAlbum(albumSlug);

  // Chỉ nhận key do bước presign của đúng album này cấp ra
  const prefix = `albums/${album.id}/`;
  const bad = input.photos.find((p) => !p.key.startsWith(prefix) || p.key.includes(".."));
  if (bad) throw new BadRequestError(`Key does not belong to this album: ${bad.key}`);
  if (input.coverKey && !input.photos.some((p) => p.key === input.coverKey)) {
    throw new BadRequestError("coverKey must be one of the uploaded photos.");
  }
  if (input.coverKey && !canSetCover(actor, album)) {
    throw new ForbiddenError("Only the admin or the album’s creator can change its cover.");
  }

  const rows = await db
    .insert(photos)
    .values(
      input.photos.map((p) => ({
        albumId: album.id,
        storageKey: p.key,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        mimeType: p.mimeType,
        uploadedById: actor.id,
        takenAt: p.takenAt ? new Date(p.takenAt) : undefined,
      })),
    )
    .onConflictDoNothing({ target: photos.storageKey })
    .returning({ id: photos.id, storageKey: photos.storageKey });

  const cover = input.coverKey && rows.find((r) => r.storageKey === input.coverKey);
  if (cover) await db.update(albums).set({ coverPhotoId: cover.id }).where(eq(albums.id, album.id));

  return { added: rows.length, coverSet: !!cover };
}

// ---------- Profile ----------

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const avatarUploadInput = z.object({
  type: imageType,
  size: z.number().int().positive().max(MAX_AVATAR_BYTES),
});

/** URL ký để upload ảnh đại diện của chính mình. */
export async function presignAvatarUpload(actor: Actor, input: z.infer<typeof avatarUploadInput>) {
  const key = `avatars/${actor.id}/${crypto.randomUUID()}.${IMAGE_TYPES[input.type]}`;
  return { key, contentType: input.type, uploadUrl: await presignUpload(key, input.type) };
}

export const updateProfileInput = z
  .object({
    name: z.string().trim().min(1).max(40),
    // null = gỡ ảnh đại diện
    avatarKey: z.string().max(300).nullable(),
  })
  .partial();

/** Đổi tên / ảnh đại diện của chính mình. ADMIN không đổi tên (dùng để đăng nhập). */
export async function updateProfile(actor: Actor, input: z.infer<typeof updateProfileInput>) {
  const patch: Partial<typeof members.$inferInsert> = {};

  if (input.name !== undefined && input.name !== actor.name) {
    if (!canRenameSelf(actor)) throw new ForbiddenError("The admin account name can’t be changed.");
    if (input.name.toLowerCase() === "admin") throw new BadRequestError("That name is reserved.");
    const [taken] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(ilike(members.name, input.name), ne(members.id, actor.id)))
      .limit(1);
    if (taken) throw new BadRequestError(`“${input.name}” is already taken.`);
    patch.name = input.name;
  }

  let oldAvatar: string | null = null;
  if (input.avatarKey !== undefined) {
    if (input.avatarKey && (!input.avatarKey.startsWith(`avatars/${actor.id}/`) || input.avatarKey.includes(".."))) {
      throw new BadRequestError("Avatar must be uploaded through /api/me/avatar.");
    }
    const [cur] = await db.select({ key: members.avatarKey }).from(members).where(eq(members.id, actor.id));
    oldAvatar = cur?.key ?? null;
    patch.avatarKey = input.avatarKey;
  }

  if (Object.keys(patch).length > 0) await db.update(members).set(patch).where(eq(members.id, actor.id));
  // Xoá file avatar cũ trên R2 (sau khi DB đã trỏ sang file mới)
  if (oldAvatar && oldAvatar !== input.avatarKey) await deleteObjects([oldAvatar]);
  return { ok: true };
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
