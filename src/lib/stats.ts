import "server-only";
import { and, asc, countDistinct, desc, eq, isNotNull, lt, ne, sql } from "drizzle-orm";
import { connection } from "next/server";
import { albums, db, members, photos } from "@/db";
import { displayUrl } from "./data";
import { listObjects, resolveObjectUrl } from "./storage";
import { storageBreakdown, storageForecast } from "./storage-stats";

// Số liệu cho trang /dashboard. Phần chung: ai đã chọn tên cũng xem; dung lượng + hàng đợi video: admin.

const TZ = "Asia/Ho_Chi_Minh";
const FORECAST_WINDOW_DAYS = 90;
/** "Ngày này năm xưa": lấy cả các ngày lân cận để ít khi trống */
const ON_THIS_DAY_RANGE = 3;

export async function getCrewStats() {
  await connection();
  const year = sql<number>`extract(year from ${albums.tripDate})::int`;

  const [[totals], [albumTotals], byYear, uploaders] = await Promise.all([
    db
      .select({
        photos: sql<number>`count(*) filter (where ${photos.kind} = 'photo')::int`,
        videos: sql<number>`count(*) filter (where ${photos.kind} = 'video')::int`,
      })
      .from(photos),
    db.select({ trips: sql<number>`count(*)::int`, places: countDistinct(albums.location) }).from(albums),
    db
      .select({
        year,
        trips: sql<number>`count(distinct ${albums.id})::int`,
        photos: sql<number>`count(${photos.id})::int`,
      })
      .from(albums)
      .leftJoin(photos, eq(photos.albumId, albums.id))
      .groupBy(year)
      .orderBy(asc(year)),
    db
      .select({
        id: members.id,
        name: members.name,
        avatarKey: members.avatarKey,
        photos: sql<number>`count(*) filter (where ${photos.kind} = 'photo')::int`,
        videos: sql<number>`count(*) filter (where ${photos.kind} = 'video')::int`,
      })
      .from(photos)
      .innerJoin(members, eq(members.id, photos.uploadedById))
      .groupBy(members.id)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
  ]);

  return {
    totals: { ...totals, ...albumTotals, years: byYear.length },
    byYear,
    uploaders: await Promise.all(
      uploaders.map(async ({ avatarKey, ...u }) => ({ ...u, avatarUrl: await resolveObjectUrl(avatarKey) })),
    ),
  };
}

/** Ảnh / video (đã xem được) chụp quanh ngày này ở các năm trước. */
export async function getOnThisDay(limit = 12) {
  await connection();
  const local = sql`(${photos.takenAt} at time zone ${TZ})`;
  const today = sql`(now() at time zone ${TZ})`;
  const dayGap = sql<number>`abs(extract(doy from ${local}) - extract(doy from ${today}))`;
  const rows = await db
    .select({
      photo: photos,
      albumSlug: albums.slug,
      albumTitle: albums.title,
      year: sql<number>`extract(year from ${local})::int`,
    })
    .from(photos)
    .innerJoin(albums, eq(albums.id, photos.albumId))
    .where(
      and(
        eq(photos.status, "ready"),
        lt(sql`extract(year from ${local})`, sql`extract(year from ${today})`),
        sql`${dayGap} <= ${ON_THIS_DAY_RANGE}`,
      ),
    )
    .orderBy(asc(dayGap), desc(photos.takenAt))
    .limit(limit);

  return Promise.all(
    rows.map(async ({ photo, albumSlug, albumTitle, year }) => ({
      id: photo.id,
      kind: photo.kind,
      thumbUrl: await displayUrl(photo),
      albumSlug,
      albumTitle,
      year,
      takenAt: photo.takenAt.toISOString(),
    })),
  );
}

/** Admin: dung lượng thật trên R2 (liệt kê bucket) + dự đoán ngày vượt gói miễn phí. */
export async function getStorageStats() {
  await connection();
  const [objects, [originals]] = await Promise.all([
    listObjects(),
    db
      .select({
        total: sql<number>`coalesce(sum(${photos.sizeBytes}), 0)::float8`,
        recent: sql<number>`coalesce(sum(${photos.sizeBytes}) filter (where ${photos.createdAt} > now() - make_interval(days => ${FORECAST_WINDOW_DAYS})), 0)::float8`,
      })
      .from(photos)
      .where(isNotNull(photos.storageKey)),
  ]);
  const { bytes, total } = storageBreakdown(objects);
  return {
    bytes,
    total,
    objectCount: objects.length,
    windowDays: FORECAST_WINDOW_DAYS,
    forecast: storageForecast({
      usedBytes: total,
      totalOriginalBytes: originals.total,
      recentOriginalBytes: originals.recent,
      windowDays: FORECAST_WINDOW_DAYS,
    }),
  };
}

/** Admin: video chưa xem được (đang chờ / đang chuyển mã / lỗi), mới nhất trước. */
export async function getVideoQueue() {
  await connection();
  const rows = await db
    .select({
      id: photos.id,
      status: photos.status,
      attempts: photos.attempts,
      error: photos.processingError,
      lockedAt: photos.lockedAt,
      createdAt: photos.createdAt,
      sizeBytes: photos.sizeBytes,
      albumSlug: albums.slug,
      albumTitle: albums.title,
      uploader: members.name,
    })
    .from(photos)
    .innerJoin(albums, eq(albums.id, photos.albumId))
    .leftJoin(members, eq(members.id, photos.uploadedById))
    .where(and(eq(photos.kind, "video"), ne(photos.status, "ready")))
    .orderBy(desc(photos.createdAt))
    .limit(50);
  // Video chờ quá 1 giờ mà chưa ai nhận → nhiều khả năng worker chưa được cấu hình
  const stuck = rows.some((r) => r.status === "queued" && Date.now() - r.createdAt.getTime() > 60 * 60 * 1000);
  return {
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), lockedAt: r.lockedAt?.toISOString() ?? null })),
    stuck,
  };
}

/** Tối đa số khung trên "cuộn phim" ở đầu dashboard (mới nhất trước khi vượt) */
const ROLL_LIMIT = 600;

/**
 * "The roll": mọi ảnh / video xem được, gom theo chuyến (chuyến mới nhất trên cùng),
 * trong chuyến theo thứ tự chụp. Mỗi ảnh một khung nhỏ.
 */
export async function getRoll() {
  await connection();
  const rows = await db
    .select({
      photo: photos,
      albumId: albums.id,
      albumSlug: albums.slug,
      albumTitle: albums.title,
      tripDate: albums.tripDate,
    })
    .from(photos)
    .innerJoin(albums, eq(albums.id, photos.albumId))
    .where(eq(photos.status, "ready"))
    .orderBy(desc(albums.tripDate), desc(albums.createdAt), asc(photos.takenAt), asc(photos.createdAt))
    .limit(ROLL_LIMIT);

  const groups = new Map<string, { slug: string; title: string; tripDate: string; frames: Array<{ id: string; kind: "photo" | "video"; thumbUrl: string }> }>();
  const urls = await Promise.all(rows.map((r) => displayUrl(r.photo)));
  rows.forEach((r, i) => {
    const g = groups.get(r.albumId) ?? { slug: r.albumSlug, title: r.albumTitle, tripDate: r.tripDate, frames: [] };
    g.frames.push({ id: r.photo.id, kind: r.photo.kind, thumbUrl: urls[i] });
    groups.set(r.albumId, g);
  });
  return { trips: [...groups.values()], truncated: rows.length === ROLL_LIMIT };
}

/** Những nơi đã đến: số chuyến, số ảnh, lần gần nhất. */
export async function getPlaces() {
  await connection();
  return db
    .select({
      location: albums.location,
      trips: sql<number>`count(distinct ${albums.id})::int`,
      photos: sql<number>`count(${photos.id})::int`,
      lastTrip: sql<string>`max(${albums.tripDate})::text`,
    })
    .from(albums)
    .leftJoin(photos, eq(photos.albumId, albums.id))
    .groupBy(albums.location)
    .orderBy(desc(sql`count(distinct ${albums.id})`), desc(sql`max(${albums.tripDate})`))
    .limit(8);
}

/** Đợt upload gần đây: gom theo người + album + giờ upload. */
export async function getRecentUploads(limit = 6) {
  await connection();
  const hour = sql`date_trunc('hour', ${photos.createdAt})`;
  const rows = await db
    .select({
      name: members.name,
      avatarKey: members.avatarKey,
      albumSlug: albums.slug,
      albumTitle: albums.title,
      photos: sql<number>`count(*) filter (where ${photos.kind} = 'photo')::int`,
      videos: sql<number>`count(*) filter (where ${photos.kind} = 'video')::int`,
      at: sql<string>`max(${photos.createdAt})::text`,
    })
    .from(photos)
    .innerJoin(albums, eq(albums.id, photos.albumId))
    .leftJoin(members, eq(members.id, photos.uploadedById))
    .groupBy(members.id, albums.id, hour)
    .orderBy(desc(sql`max(${photos.createdAt})`))
    .limit(limit);
  return Promise.all(
    rows.map(async ({ avatarKey, at, ...r }) => ({
      ...r,
      at: new Date(at).toISOString(),
      avatarUrl: await resolveObjectUrl(avatarKey),
    })),
  );
}

/** Thành viên chưa upload gì (để mời). */
export async function getQuietMembers() {
  await connection();
  const rows = await db
    .select({ id: members.id, name: members.name, avatarKey: members.avatarKey })
    .from(members)
    .where(
      and(
        eq(members.role, 1),
        sql`not exists (select 1 from ${photos} where ${photos.uploadedById} = ${members.id})`,
      ),
    )
    .orderBy(asc(members.name));
  return Promise.all(rows.map(async ({ avatarKey, ...m }) => ({ ...m, avatarUrl: await resolveObjectUrl(avatarKey) })));
}

/** "From the archive": vài khung ngẫu nhiên, cố định trong ngày (đổi mỗi ngày). */
export async function getRandomFrames(limit = 8) {
  await connection();
  const rows = await db
    .select({ photo: photos, albumSlug: albums.slug, albumTitle: albums.title, tripDate: albums.tripDate })
    .from(photos)
    .innerJoin(albums, eq(albums.id, photos.albumId))
    .where(eq(photos.status, "ready"))
    .orderBy(sql`md5(${photos.id}::text || (now() at time zone ${TZ})::date::text)`)
    .limit(limit);
  return Promise.all(
    rows.map(async ({ photo, albumSlug, albumTitle, tripDate }) => ({
      id: photo.id,
      kind: photo.kind,
      thumbUrl: await displayUrl(photo),
      albumSlug,
      albumTitle,
      year: Number(tripDate.slice(0, 4)),
      takenAt: photo.takenAt.toISOString(),
    })),
  );
}
