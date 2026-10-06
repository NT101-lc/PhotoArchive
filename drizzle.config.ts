import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Đọc .env giống cách Next.js đọc
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) throw new Error("Thiếu DATABASE_URL trong .env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
