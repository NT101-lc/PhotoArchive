import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { REACTIONS } from "../lib/photo-social";

// Tên cột viết camelCase ở đây, drizzle tự đổi sang snake_case trong DB (casing: "snake_case").

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const MEDIA_KINDS = ["photo", "video"] as const;
/** queued → processing → ready (hoặc failed sau MAX_TRANSCODE_ATTEMPTS lần). Ảnh luôn "ready". */
export const MEDIA_STATUSES = ["queued", "processing", "ready", "failed"] as const;
export const MAX_TRANSCODE_ATTEMPTS = 3;

/** Vai trò: 0 = admin (toàn quyền, đăng nhập bằng mật khẩu), 1 = user (chỉ chọn tên, không mật khẩu). */
export const ROLE_ADMIN = 0;
export const ROLE_USER = 1;

/** Thành viên nhóm. */
export const members = pgTable(
  "members",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull().unique(),
    email: text().unique(),
    role: smallint().notNull().default(ROLE_USER),
    // Chỉ admin có mật khẩu (scrypt, dạng `salt:hash` hex)
    passwordHash: text(),
    // Ảnh đại diện trên R2 (`avatars/<memberId>/<uuid>.<ext>`); null → hiện chữ cái đầu
    avatarKey: text(),
    ...timestamps,
  },
  (t) => [check("members_role_valid", sql`${t.role} in (0, 1)`)],
);

/** Một chuyến đi. `slug` dùng trên URL (/albums/da-lat-2025). */
export const albums = pgTable(
  "albums",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    location: text().notNull(),
    tripDate: date({ mode: "string" }).notNull(),
    // Ngày về (chuyến nhiều ngày); null → đi trong một ngày
    endDate: date({ mode: "string" }),
    // Vài dòng kể về chuyến đi (không bắt buộc); null → không có
    description: text(),
    // Ảnh bìa; null → lấy ảnh chụp sớm nhất của album
    coverPhotoId: uuid().references((): AnyPgColumn => photos.id, { onDelete: "set null" }),
    createdById: uuid().references(() => members.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("albums_trip_date_idx").on(t.tripDate),
    check("albums_end_after_start", sql`${t.endDate} is null or ${t.endDate} >= ${t.tripDate}`),
  ],
);

/**
 * Một tấm ảnh. File nằm trên R2 (`storageKey`), hoặc ở URL ngoài (`sourceUrl`, dùng cho dữ liệu seed).
 * Phải có ít nhất một trong hai.
 */
export const photos = pgTable(
  "photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    albumId: uuid()
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    storageKey: text().unique(),
    sourceUrl: text(),
    width: integer().notNull(),
    height: integer().notNull(),
    // bigint: video có thể lớn hơn 2 GB
    sizeBytes: bigint({ mode: "number" }),
    mimeType: text(),
    uploadedById: uuid().references(() => members.id, { onDelete: "set null" }),
    takenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),

    // ---- Video ----
    // Video được worker (scripts/transcode-worker.ts) chuyển mã thành một MP4 H.264 + ảnh poster; trong lúc đó
    // `status` khác "ready". Xong thì `storageKey` trỏ sang bản nén và file gốc bị xoá khỏi R2.
    kind: text({ enum: MEDIA_KINDS }).notNull().default("photo"),
    status: text({ enum: MEDIA_STATUSES }).notNull().default("ready"),
    durationMs: integer(),
    posterKey: text(),
    video720Key: text(),
    video1080Key: text(),
    // Hàng đợi chuyển mã: số lần đã thử, lúc worker nhận việc, lỗi gần nhất
    attempts: smallint().notNull().default(0),
    lockedAt: timestamp({ withTimezone: true }),
    processingError: text(),

    // ---- Backup Google Drive — CHƯA DÙNG ----
    // Cột đã có trên DB (migration 0010) cho tính năng backup đang làm dở ở nhánh feature/drive-backup.
    // App chỉ thêm file lên Drive, không bao giờ sửa / xoá trên Drive.
    driveFileId: text(),
    backedUpAt: timestamp({ withTimezone: true }),
    backupAttempts: smallint().notNull().default(0),
    backupError: text(),
    // Video: file gốc còn giữ trên R2 vì chuyển mã xong mà chưa backup được; xoá sau khi backup xong
    originalKey: text(),
    ...timestamps,
  },
  (t) => [
    index("photos_album_taken_idx").on(t.albumId, t.takenAt),
    index("photos_status_idx").on(t.status),
    check("photos_has_source", sql`${t.storageKey} is not null or ${t.sourceUrl} is not null`),
    check("photos_positive_size", sql`${t.width} > 0 and ${t.height} > 0`),
    check("photos_kind_valid", sql`${t.kind} in ('photo', 'video')`),
    check("photos_status_valid", sql`${t.status} in ('queued', 'processing', 'ready', 'failed')`),
  ],
);

/**
 * Nội dung tự viết của các trang tĩnh, mỗi trang một dòng theo `key` (vd "about").
 * `value` là JSON tuỳ trang; trang About: { paragraphs: string[] }.
 */
export const siteContent = pgTable("site_content", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedById: uuid().references(() => members.id, { onDelete: "set null" }),
  ...timestamps,
});

/** Một buổi trong lịch trình (dòng của bảng): `id` cố định để ô không lệch khi đổi tên / xoá buổi. */
export type PlanSlot = { id: string; label: string; time: string };
/** Một dòng của bảng việc cần làm & chi phí. `cost` tính bằng VND. */
export type PlanItem = { id: string; done: boolean; text: string; who: string | null; cost: number | null; note: string };

/**
 * Kế hoạch chuyến đi (planner kiểu bảng tính), không gắn với album.
 * `cells`: chữ trong bảng lịch trình, key `<YYYY-MM-DD>|<slotId>`. `going`: id các thành viên tham gia.
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    location: text().notNull(),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }).notNull(),
    slots: jsonb().$type<PlanSlot[]>().notNull(),
    cells: jsonb().$type<Record<string, string>>().notNull().default({}),
    going: jsonb().$type<string[]>().notNull().default([]),
    items: jsonb().$type<PlanItem[]>().notNull().default([]),
    createdById: uuid().references(() => members.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("plans_start_date_idx").on(t.startDate),
    check("plans_end_after_start", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

/** Bình luận dưới một ảnh / video. Xoá ảnh → xoá luôn bình luận. */
export const photoComments = pgTable(
  "photo_comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    photoId: uuid()
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    authorId: uuid().references(() => members.id, { onDelete: "set null" }),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photo_comments_photo_idx").on(t.photoId, t.createdAt), index("photo_comments_created_idx").on(t.createdAt)],
);

/** Cảm xúc thả vào ảnh: mỗi người một cái cho mỗi ảnh, chọn cái khác thì đổi. */
export const photoReactions = pgTable(
  "photo_reactions",
  {
    photoId: uuid()
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    memberId: uuid()
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    emoji: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.photoId, t.memberId] }),
    check("photo_reactions_emoji_valid", sql.raw(`emoji in (${REACTIONS.map((r) => `'${r}'`).join(", ")})`)),
  ],
);

export type MemberRow = typeof members.$inferSelect;
export type AlbumRow = typeof albums.$inferSelect;
export type PhotoRow = typeof photos.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;
