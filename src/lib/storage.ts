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
  opts: { headers?: Record<string, string>; datetime?: string; query?: Record<string, string> } = {},
) {
  const c = r2();
  if (!c) throw new StorageNotConfiguredError();
  const url = objectUrl(c.cfg, key);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
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

/** URL đọc tạm thời cho bucket private. Có `filename` → trình duyệt tải về thay vì mở. */
export function presignDownload(key: string, filename?: string) {
  const query: Record<string, string> = filename
    ? { "response-content-disposition": `attachment; filename="${filename.replace(/["\\]/g, "")}"` }
    : {};
  return presign("GET", key, GET_EXPIRES_S, { query });
}

// ---------- Multipart (video, không giới hạn dung lượng) ----------
// R2: tối đa 10.000 phần, mỗi phần 5 MiB – 5 GiB, mọi phần (trừ phần cuối) cùng kích thước.
// Trình duyệt PUT từng phần qua URL đã ký; lúc hoàn tất, server tự đọc ETag bằng ListParts
// nên bucket không cần mở header ETag cho CORS.

const MiB = 1024 * 1024;
const MIN_PART = 16 * MiB;
const MAX_PARTS = 10_000;
const PART_EXPIRES_S = 6 * 60 * 60; // file lớn trên mạng chậm có thể upload rất lâu

/** Kích thước mỗi phần: 16 MiB, tăng dần (bội số MiB) khi file quá lớn để không vượt 10.000 phần. */
export function multipartPartSize(fileSize: number) {
  return Math.max(MIN_PART, Math.ceil(fileSize / MAX_PARTS / MiB) * MiB);
}

function multipartUrl(c: NonNullable<ReturnType<typeof r2>>, key: string, query: Record<string, string>) {
  const url = objectUrl(c.cfg, key);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url;
}

function xmlValues(xml: string, tag: string) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
}

export async function createMultipartUpload(key: string, contentType: string) {
  const c = r2();
  if (!c) throw new StorageNotConfiguredError();
  const res = await c.aws.fetch(multipartUrl(c, key, { uploads: "" }), {
    method: "POST",
    headers: { "Content-Type": contentType },
  });
  const uploadId = xmlValues(await res.text(), "UploadId")[0];
  if (!res.ok || !uploadId) throw new Error(`R2 could not start the upload (${res.status})`);
  return uploadId;
}

/** URL đã ký để PUT phần thứ `partNumber` (bắt đầu từ 1). */
export function presignUploadPart(key: string, uploadId: string, partNumber: number) {
  return presign("PUT", key, PART_EXPIRES_S, { query: { partNumber: String(partNumber), uploadId } });
}

async function listParts(c: NonNullable<ReturnType<typeof r2>>, key: string, uploadId: string) {
  const parts: Array<{ partNumber: number; etag: string }> = [];
  let marker = "";
  for (;;) {
    const query: Record<string, string> = { uploadId, "max-parts": "1000" };
    if (marker) query["part-number-marker"] = marker;
    const res = await c.aws.fetch(multipartUrl(c, key, query), { method: "GET" });
    const xml = await res.text();
    if (!res.ok) throw new Error(`R2 could not list uploaded parts (${res.status})`);
    for (const block of xmlValues(xml, "Part")) {
      parts.push({ partNumber: Number(xmlValues(block, "PartNumber")[0]), etag: xmlValues(block, "ETag")[0] });
    }
    if (xmlValues(xml, "IsTruncated")[0] !== "true") return parts;
    marker = xmlValues(xml, "NextPartNumberMarker")[0];
  }
}

/** Ghép các phần thành một object. Báo lỗi nếu thiếu phần nào so với `partCount`. */
export async function completeMultipartUpload(key: string, uploadId: string, partCount: number) {
  const c = r2();
  if (!c) throw new StorageNotConfiguredError();
  const parts = (await listParts(c, key, uploadId)).sort((a, b) => a.partNumber - b.partNumber);
  if (parts.length !== partCount) {
    throw new Error(`Upload is missing parts: got ${parts.length} of ${partCount}.`);
  }
  const body =
    "<CompleteMultipartUpload>" +
    parts.map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`).join("") +
    "</CompleteMultipartUpload>";
  const res = await c.aws.fetch(multipartUrl(c, key, { uploadId }), { method: "POST", body });
  const text = await res.text();
  // S3/R2 có thể trả 200 kèm <Error> trong body
  if (!res.ok || text.includes("<Error>")) throw new Error(`R2 could not finish the upload (${res.status})`);
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  const c = r2();
  if (!c) return;
  await c.aws.fetch(multipartUrl(c, key, { uploadId }), { method: "DELETE" }).catch(() => undefined);
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

/** URL hiển thị cho một object trên R2 (vd ảnh đại diện); null nếu không có / chưa cấu hình R2. */
export async function resolveObjectUrl(key: string | null) {
  if (!key) return null;
  return (await resolvePhotoUrl({ storageKey: key, sourceUrl: null })) || null;
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
