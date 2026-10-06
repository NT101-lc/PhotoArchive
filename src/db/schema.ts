import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Tên cột viết camelCase ở đây, drizzle tự đổi sang snake_case trong DB (casing: "snake_case").

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Thành viên nhóm. `email` để sau này khớp với tài khoản Google khi có auth. */
export const members = pgTable("members", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  email: text().unique(),
  ...timestamps,
});

/** Một chuyến đi. `slug` dùng trên URL (/albums/da-lat-2025). */
export const albums = pgTable(
  "albums",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    location: text().notNull(),
    tripDate: date({ mode: "string" }).notNull(),
    // Ảnh bìa; null → lấy ảnh chụp sớm nhất của album
    coverPhotoId: uuid().references((): AnyPgColumn => photos.id, { onDelete: "set null" }),
    createdById: uuid().references(() => members.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("albums_trip_date_idx").on(t.tripDate)],
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
    sizeBytes: integer(),
    mimeType: text(),
    uploadedById: uuid().references(() => members.id, { onDelete: "set null" }),
    takenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    index("photos_album_taken_idx").on(t.albumId, t.takenAt),
    check("photos_has_source", sql`${t.storageKey} is not null or ${t.sourceUrl} is not null`),
    check("photos_positive_size", sql`${t.width} > 0 and ${t.height} > 0`),
  ],
);

export type MemberRow = typeof members.$inferSelect;
export type AlbumRow = typeof albums.$inferSelect;
export type PhotoRow = typeof photos.$inferSelect;
