import { writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { createDb } from "./client";

loadEnvConfig(process.cwd());

/**
 * Sửa một lần giờ chụp của ảnh upload trước khi có đọc EXIF: ảnh có takenAt nằm ngoài khoảng ngày của chuyến
 * (lùi 1 ngày, thêm 2 ngày — giống guessTakenAt trong lib/mutations.ts) được đưa về trưa ngày đầu chuyến,
 * cộng thêm giây theo thứ tự cũ để giữ nguyên thứ tự.
 *
 *   npx tsx src/db/fix-taken-at.ts           → chỉ xem trước (không sửa gì)
 *   npx tsx src/db/fix-taken-at.ts --apply   → sửa thật; giá trị cũ được lưu vào fix-taken-at-backup-*.json
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL trong .env");
  const db = createDb(url);
  const apply = process.argv.includes("--apply");

  const outside = sql`
    select p.id, p.taken_at, a.title,
      (a.trip_date::timestamp + interval '12 hours') at time zone 'Asia/Ho_Chi_Minh'
        + make_interval(secs => row_number() over (partition by a.id order by p.taken_at, p.created_at) - 1) as new_taken_at
    from photos p join albums a on a.id = p.album_id
    where p.taken_at < (a.trip_date::timestamp - interval '1 day') at time zone 'Asia/Ho_Chi_Minh'
       or p.taken_at >= (coalesce(a.end_date, a.trip_date)::timestamp + interval '3 days') at time zone 'Asia/Ho_Chi_Minh'`;

  const { rows } = await db.execute<{ id: string; taken_at: string; title: string; new_taken_at: string }>(outside);
  const byAlbum = new Map<string, number>();
  for (const r of rows) byAlbum.set(r.title, (byAlbum.get(r.title) ?? 0) + 1);
  console.log(`${rows.length} ảnh có giờ chụp nằm ngoài chuyến:`);
  for (const [title, n] of byAlbum) console.log(`  ${title}: ${n}`);
  if (!apply || rows.length === 0) {
    if (!apply) console.log('\nChỉ xem trước. Thêm "--apply" để sửa.');
    return;
  }

  const backup = `fix-taken-at-backup-${Date.now()}.json`;
  writeFileSync(backup, JSON.stringify(rows.map((r) => ({ id: r.id, takenAt: r.taken_at })), null, 2));
  const { rowCount } = await db.execute(sql`
    update photos set taken_at = f.new_taken_at
    from (${outside}) f
    where photos.id = f.id`);
  console.log(`\nĐã sửa ${rowCount} ảnh. Giá trị cũ lưu ở ${backup}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
