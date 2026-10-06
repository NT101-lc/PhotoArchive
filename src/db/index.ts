import "server-only";
import { serverEnv } from "@/lib/env";
import { createDb, type Db } from "./client";

// Một instance dùng chung cho cả app; giữ qua hot reload ở dev để không tạo lại liên tục.
const globalForDb = globalThis as unknown as { b6Db?: Db };

export const db = globalForDb.b6Db ?? createDb(serverEnv().DATABASE_URL);

if (process.env.NODE_ENV !== "production") globalForDb.b6Db = db;

export * from "./schema";
