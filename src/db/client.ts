import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Tạo kết nối Drizzle tới Neon qua HTTP (không giữ connection, hợp với serverless).
 * Tách riêng khỏi `db/index.ts` để script ngoài Next (seed) dùng lại được.
 */
export function createDb(databaseUrl: string) {
  return drizzle({ client: neon(databaseUrl), schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
