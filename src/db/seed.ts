// Seed DB bằng dữ liệu mẫu: npm run db:seed  (thêm -- --reset để xoá dữ liệu cũ trước)
import { loadEnvConfig } from "@next/env";
import { inArray, sql } from "drizzle-orm";
import { createDb } from "./client";
import { albums, members, photos, ROLE_USER } from "./schema";
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
    // Giữ bảng members (có tài khoản ADMIN + mật khẩu), chỉ xoá album / ảnh
    await db.execute(sql`truncate table ${photos}, ${albums} cascade`);
    console.log("Đã xoá album và ảnh cũ.");
  }

  await db
    .insert(members)
    .values(MEMBERS.map((name) => ({ name, role: ROLE_USER })))
    .onConflictDoNothing({ target: members.name });
  const memberRows = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(inArray(members.name, MEMBERS));
  const memberId = new Map(memberRows.map((m) => [m.name, m.id]));

  const albumRows = await db
    .insert(albums)
    .values(
      MOCK_ALBUMS.map((a) => ({
        slug: a.id,
        title: a.title,
        location: a.location,
        tripDate: a.tripDate,
        endDate: a.endDate ?? null,
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
