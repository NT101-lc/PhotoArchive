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

async function presign(method: "GET" | "PUT", key: string, expires: number, headers?: Record<string, string>) {
  const c = r2();
  if (!c) throw new StorageNotConfiguredError();
  const url = objectUrl(c.cfg, key);
  url.searchParams.set("X-Amz-Expires", String(expires));
  const signed = await c.aws.sign(new Request(url, { method, headers }), {
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

/** URL để trình duyệt PUT file lên. Phải gửi đúng Content-Type đã ký. */
export function presignUpload(key: string, contentType: string) {
  return presign("PUT", key, PUT_EXPIRES_S, { "Content-Type": contentType });
}

/** URL đọc tạm thời cho bucket private. */
export function presignDownload(key: string) {
  return presign("GET", key, GET_EXPIRES_S);
}

/**
 * URL hiển thị của một ảnh:
 * - bucket có public URL → link thẳng
 * - bucket private → qua /api/photos/:id/raw (redirect sang URL đã ký)
 * - ảnh ngoài (seed) → sourceUrl
 */
export function resolvePhotoUrl(photo: { id: string; storageKey: string | null; sourceUrl: string | null }) {
  if (photo.storageKey) {
    const publicUrl = r2Config()?.publicUrl;
    return publicUrl ? `${publicUrl}/${photo.storageKey}` : `/api/photos/${photo.id}/raw`;
  }
  return photo.sourceUrl ?? "";
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage is not configured: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_ENDPOINT (or R2_ACCOUNT_ID).");
  }
}
