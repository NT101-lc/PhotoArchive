import "server-only";
import { AwsClient } from "aws4fetch";
import { r2Config, type R2Config } from "./env";

// Cloudflare R2 qua API tương thích S3. Trình duyệt upload thẳng lên R2 bằng URL đã ký,
// file không đi qua server Next.

const PUT_EXPIRES_S = 10 * 60;
const GET_EXPIRES_S = 60 * 60;

let client: { cfg: R2Config; aws: AwsClient } | null = null;

function r2() {
  const cfg = r2Config();
  if (!cfg) return null;
  if (!client) {
    client = {
      cfg,
      aws: new AwsClient({
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
        service: "s3",
        region: "auto",
      }),
    };
  }
  return client;
}

export function isStorageConfigured() {
  return r2Config() !== null;
}

function objectUrl(cfg: R2Config, key: string) {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`${cfg.endpoint}/${cfg.bucket}/${path}`);
}

async function presign(
  method: "GET" | "PUT",
  key: string,
  expires: number,
  opts: { headers?: Record<string, string>; datetime?: string } = {},
) {
  const c = r2();
  if (!c) throw new StorageNotConfiguredError();
  const url = objectUrl(c.cfg, key);
  url.searchParams.set("X-Amz-Expires", String(expires));
  const signed = await c.aws.sign(new Request(url, { method, headers: opts.headers }), {
    aws: { signQuery: true, allHeaders: true, datetime: opts.datetime },
  });
  return signed.url;
}

/** URL để trình duyệt PUT file lên. Phải gửi đúng Content-Type đã ký. */
export function presignUpload(key: string, contentType: string) {
  return presign("PUT", key, PUT_EXPIRES_S, { headers: { "Content-Type": contentType } });
}

/** URL đọc tạm thời cho bucket private. */
export function presignDownload(key: string) {
  return presign("GET", key, GET_EXPIRES_S);
}

/**
 * Xoá file trên R2. Không ném lỗi nếu một số file xoá hỏng — trả về danh sách key lỗi
 * để ghi log (file mồ côi trên R2 không làm hỏng app).
 */
export async function deleteObjects(keys: string[]): Promise<string[]> {
  const c = r2();
  if (!c || keys.length === 0) return c ? [] : keys;
  const failed: string[] = [];
  const queue = [...keys];
  await Promise.all(
    Array.from({ length: Math.min(8, queue.length) }, async () => {
      for (let key = queue.shift(); key; key = queue.shift()) {
        try {
          const res = await c.aws.fetch(objectUrl(c.cfg, key), { method: "DELETE" });
          if (!res.ok && res.status !== 404) failed.push(key);
        } catch {
          failed.push(key);
        }
      }
    }),
  );
  return failed;
}

// Ảnh hiển thị: ký với mốc giờ làm tròn → trong cùng một giờ URL không đổi, nên trình duyệt
// và bộ tối ưu ảnh của Next cache được. Hạn 2 giờ ⇒ URL nào trả ra cũng còn hạn ít nhất 1 giờ.
const VIEW_WINDOW_MS = 60 * 60 * 1000;
const VIEW_EXPIRES_S = 2 * 60 * 60;

function amzDate(ms: number) {
  return new Date(ms).toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20261006T050000Z
}

/**
 * URL hiển thị của một ảnh:
 * - bucket có public URL → link thẳng
 * - bucket private → URL GET đã ký (ổn định trong từng giờ)
 * - ảnh ngoài (seed) → sourceUrl
 */
export async function resolvePhotoUrl(photo: { storageKey: string | null; sourceUrl: string | null }) {
  if (!photo.storageKey) return photo.sourceUrl ?? "";
  const cfg = r2Config();
  if (!cfg) return ""; // ảnh trên R2 nhưng server chưa cấu hình R2
  if (cfg.publicUrl) return `${cfg.publicUrl}/${photo.storageKey}`;
  const windowStart = Math.floor(Date.now() / VIEW_WINDOW_MS) * VIEW_WINDOW_MS;
  return presign("GET", photo.storageKey, VIEW_EXPIRES_S, { datetime: amzDate(windowStart) });
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage is not configured: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_ENDPOINT (or R2_ACCOUNT_ID).");
  }
}
