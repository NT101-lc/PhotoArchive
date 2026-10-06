import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Đọc .env giống cách Next.js đọc
loadEnvConfig(process.cwd());

// `generate` / `check` không cần kết nối DB (CI chạy không có DATABASE_URL).
// `migrate` / `push` / `studio` thì cần — drizzle-kit sẽ báo lỗi kết nối nếu thiếu.
const url = process.env.DATABASE_URL ?? "postgresql://unset@localhost/unset";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
