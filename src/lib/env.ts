import "server-only";
import { z } from "zod";

// Nơi duy nhất đọc process.env cho secret — chỉ chạy phía server.

const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_ENDPOINT: z.url().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.url().optional(),
});

type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  // Biến để trống trong .env coi như chưa đặt
  const raw = Object.fromEntries(
    Object.keys(schema.shape).map((k) => [k, process.env[k]?.trim() || undefined]),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${fields}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  publicUrl?: string;
};

let cachedR2: R2Config | null | undefined;

/** Cấu hình R2, `null` nếu còn thiếu biến (vd chưa đặt R2_BUCKET). */
export function r2Config(): R2Config | null {
  if (cachedR2 === undefined) cachedR2 = buildR2Config(serverEnv());
  return cachedR2;
}

function buildR2Config(e: ServerEnv): R2Config | null {
  if (!e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY || !e.R2_BUCKET) return null;
  const endpoint = e.R2_ENDPOINT ?? (e.R2_ACCOUNT_ID ? `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null);
  if (!endpoint) return null;
  return {
    accessKeyId: e.R2_ACCESS_KEY_ID,
    secretAccessKey: e.R2_SECRET_ACCESS_KEY,
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket: e.R2_BUCKET,
    publicUrl: e.R2_PUBLIC_URL?.replace(/\/+$/, ""),
  };
}
