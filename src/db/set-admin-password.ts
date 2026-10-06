// Đặt mật khẩu cho tài khoản ADMIN:
//   npm run admin:password -- "mật-khẩu-mới"     (tự chọn)
//   npm run admin:password                       (tạo ngẫu nhiên và in ra một lần)
import { randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "../lib/password";
import { createDb } from "./client";
import { members, ROLE_ADMIN } from "./schema";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL trong .env");
  const db = createDb(url);

  const given = process.argv[2];
  if (given !== undefined && given.length < 8) throw new Error("Mật khẩu cần ít nhất 8 ký tự.");
  const password = given ?? randomBytes(9).toString("base64url");

  const updated = await db
    .update(members)
    .set({ passwordHash: await hashPassword(password) })
    .where(and(eq(members.name, "ADMIN"), eq(members.role, ROLE_ADMIN)))
    .returning({ id: members.id });
  if (updated.length === 0) throw new Error("Không có tài khoản ADMIN — chạy npm run db:migrate trước.");

  console.log(given ? "Đã đặt mật khẩu ADMIN." : `Mật khẩu ADMIN mới: ${password}\n(lưu lại, sẽ không hiện lần nữa)`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
