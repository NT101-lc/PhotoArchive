import "server-only";
import { serverEnv } from "@/lib/env";
import { createDb, type Db } from "./client";

// Một instance dùng chung cho cả app; giữ qua hot reload ở dev để không tạo lại liên tục.
const globalForDb = globalThis as unknown as { b6Db?: Db };

function getDb(): Db {
  if (!globalForDb.b6Db) globalForDb.b6Db = createDb(serverEnv().DATABASE_URL);
  return globalForDb.b6Db;
}

/**
 * Khởi tạo lười: chỉ đọc DATABASE_URL khi có truy vấn đầu tiên, không phải lúc import.
 * Nhờ vậy `next build` (bước "collect page data" có import các route) không cần biến môi trường.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export * from "./schema";
