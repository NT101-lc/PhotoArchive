// Seed DB bằng dữ liệu mẫu: npm run db:seed  (thêm -- --reset để xoá dữ liệu cũ trước)
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { createDb } from "./client";
import { albums, members, photos } from "./schema";
import { MEMBERS, MOCK_ALBUMS, MOCK_PHOTOS } from "./seed-data";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL trong .env");
  const db = createDb(url);
  const reset = process.argv.includes("--reset");

  const existing = await db.$count(albums);
  if (existing > 0 && !reset) {
    console.log(`DB đã có ${existing} album — bỏ qua. Chạy "npm run db:seed -- --reset" để xoá và seed lại.`);
    return;
  }
  if (reset) {
    await db.execute(sql`truncate table ${photos}, ${albums}, ${members} restart identity cascade`);
    console.log("Đã xoá dữ liệu cũ.");
  }

  const memberRows = await db
    .insert(members)
    .values(MEMBERS.map((name) => ({ name })))
    .returning({ id: members.id, name: members.name });
  const memberId = new Map(memberRows.map((m) => [m.name, m.id]));

  const albumRows = await db
    .insert(albums)
    .values(
      MOCK_ALBUMS.map((a) => ({
        slug: a.id,
        title: a.title,
        location: a.location,
        tripDate: a.tripDate,
        createdById: memberId.get(MEMBERS[0]),
      })),
    )
    .returning({ id: albums.id, slug: albums.slug });
  const albumId = new Map(albumRows.map((a) => [a.slug, a.id]));

  await db.insert(photos).values(
    MOCK_PHOTOS.map((p) => ({
      albumId: albumId.get(p.albumId)!,
      sourceUrl: p.url,
      width: p.width,
      height: p.height,
      uploadedById: memberId.get(p.uploadedBy),
      takenAt: new Date(p.takenAt),
    })),
  );

  console.log(`Seed xong: ${memberRows.length} thành viên, ${albumRows.length} album, ${MOCK_PHOTOS.length} ảnh.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
