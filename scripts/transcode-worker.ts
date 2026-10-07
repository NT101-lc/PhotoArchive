// Worker chuyển mã video: npx tsx scripts/transcode-worker.ts
// Chạy trong GitHub Actions (.github/workflows/transcode.yml), cũng chạy được trên máy có ffmpeg.
//
// Mỗi vòng: nhận một video đang chờ trong bảng photos (FOR UPDATE SKIP LOCKED nên nhiều worker
// chạy cùng lúc không đụng nhau) → tải file gốc từ R2 → ffmpeg ra MP4 720p / 1080p + poster
// → đẩy lên R2 → đánh dấu "ready". Lỗi thì trả về hàng đợi, quá MAX_TRANSCODE_ATTEMPTS lần thì "failed".
// Chạy tới khi hết việc (hoặc gần hết giờ của job).

import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { AwsClient } from "aws4fetch";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { MAX_TRANSCODE_ATTEMPTS } from "../src/db/schema";
import {
  encodeArgs,
  outputKeys,
  plannedRenditions,
  posterArgs,
  sourceInfo,
  videoFilter,
  type Probe,
  type Rendition,
} from "../src/lib/transcode-plan";

loadEnvConfig(process.cwd());

/** Bỏ việc đang "processing" quá lâu (worker chết giữa chừng) → cho chạy lại. */
const STALE_LOCK = "3 hours";
/** GitHub Actions cắt job ở 6 giờ; dừng nhận việc mới sau 5 giờ. */
const STOP_AFTER_MS = 5 * 60 * 60 * 1000;
const SINGLE_PUT_MAX = 256 * 1024 * 1024;
const PART_SIZE = 64 * 1024 * 1024;

function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

const sql = neon(env("DATABASE_URL"));
const bucket = env("R2_BUCKET");
const endpoint = (process.env.R2_ENDPOINT?.trim() || `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`).replace(
  /\/+$/,
  "",
);
const aws = new AwsClient({
  accessKeyId: env("R2_ACCESS_KEY_ID"),
  secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});

function objectUrl(key: string, query: Record<string, string> = {}) {
  const url = new URL(`${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url;
}

// ---------- R2 ----------

async function download(key: string, dest: string) {
  const res = await aws.fetch(objectUrl(key));
  if (!res.ok || !res.body) throw new Error(`Could not download original (${res.status})`);
  await pipeline(Readable.fromWeb(res.body as WebReadableStream), createWriteStream(dest));
}

/** Đẩy file lên R2: file nhỏ PUT một lần, file lớn chia phần để không nạp cả file vào RAM. */
async function upload(key: string, path: string, contentType: string) {
  const { size } = await stat(path);
  if (size <= SINGLE_PUT_MAX) {
    const res = await aws.fetch(objectUrl(key), {
      method: "PUT",
      body: await readFile(path),
      headers: { "Content-Type": contentType },
    });
    if (!res.ok) throw new Error(`Upload of ${key} failed (${res.status})`);
    return;
  }

  const created = await aws.fetch(objectUrl(key, { uploads: "" }), {
    method: "POST",
    headers: { "Content-Type": contentType },
  });
  const uploadId = (await created.text()).match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!created.ok || !uploadId) throw new Error(`Could not start upload of ${key} (${created.status})`);
  try {
    const file = await open(path);
    const etags: string[] = [];
    try {
      for (let offset = 0, n = 1; offset < size; offset += PART_SIZE, n++) {
        const buf = Buffer.alloc(Math.min(PART_SIZE, size - offset));
        await file.read(buf, 0, buf.length, offset);
        const res = await aws.fetch(objectUrl(key, { partNumber: String(n), uploadId }), { method: "PUT", body: buf });
        const etag = res.headers.get("etag");
        if (!res.ok || !etag) throw new Error(`Upload of ${key} part ${n} failed (${res.status})`);
        etags.push(etag);
      }
    } finally {
      await file.close();
    }
    const body =
      "<CompleteMultipartUpload>" +
      etags.map((e, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${e}</ETag></Part>`).join("") +
      "</CompleteMultipartUpload>";
    const done = await aws.fetch(objectUrl(key, { uploadId }), { method: "POST", body });
    const text = await done.text();
    if (!done.ok || text.includes("<Error>")) throw new Error(`Could not finish upload of ${key} (${done.status})`);
  } catch (err) {
    await aws.fetch(objectUrl(key, { uploadId }), { method: "DELETE" }).catch(() => undefined);
    throw err;
  }
}

async function remove(keys: string[]) {
  await Promise.all(keys.map((k) => aws.fetch(objectUrl(k), { method: "DELETE" }).catch(() => undefined)));
}

// ---------- ffmpeg ----------

/** Chạy lệnh, trả stdout; lỗi thì kèm vài dòng cuối của stderr. */
function run(cmd: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => {
      err = (err + d).slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited with ${code}: ${err.trim().split("\n").slice(-3).join(" | ")}`)),
    );
  });
}

async function probe(path: string) {
  return JSON.parse(await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", path])) as Probe;
}

let tonemapSupported: boolean | undefined;
/** Tone-map HDR cần filter zscale (libzimg); bản ffmpeg thiếu thì chỉ chuyển thẳng (màu có thể nhạt). */
async function canTonemap() {
  tonemapSupported ??= /\bzscale\b/.test(await run("ffmpeg", ["-hide_banner", "-filters"]).catch(() => ""));
  return tonemapSupported;
}

// ---------- Hàng đợi ----------

type Job = { id: string; storage_key: string; attempts: number };

async function claim(): Promise<Job | null> {
  // Việc bị bỏ dở mà đã hết lượt thử → failed
  await sql`
    update photos set status = 'failed', locked_at = null,
      processing_error = coalesce(processing_error, 'Processing took too long and was stopped.')
    where kind = 'video' and status = 'processing' and locked_at < now() - ${STALE_LOCK}::interval
      and attempts >= ${MAX_TRANSCODE_ATTEMPTS}`;
  const rows = await sql`
    update photos set status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
    where id = (
      select id from photos
      where kind = 'video' and attempts < ${MAX_TRANSCODE_ATTEMPTS}
        and (status = 'queued' or (status = 'processing' and locked_at < now() - ${STALE_LOCK}::interval))
      order by created_at
      for update skip locked
      limit 1
    )
    returning id, storage_key, attempts`;
  return (rows[0] as Job | undefined) ?? null;
}

async function processJob(job: Job) {
  const dir = await mkdtemp(join(tmpdir(), "transcode-"));
  const keys = outputKeys(job.storage_key);
  const uploaded: string[] = [];
  try {
    const input = join(dir, "original");
    await download(job.storage_key, input);
    const src = sourceInfo(await probe(input));
    const tonemap = src.hdr && (await canTonemap());
    if (src.hdr && !tonemap) console.warn("  HDR source but ffmpeg has no zscale — colors may look washed out");

    const renditions = plannedRenditions(src);
    const outputs: Partial<Record<Rendition, string>> = {};
    for (const r of renditions) {
      const out = join(dir, `${r}.mp4`);
      console.log(`  encoding ${r}p…`);
      await run("ffmpeg", encodeArgs(input, out, videoFilter(src, r, { tonemap }), r));
      outputs[r] = out;
    }

    // Poster + kích thước hiển thị lấy từ bản nét nhất (đã SDR, đã xoay đúng chiều)
    const best = outputs[1080] ?? outputs[720]!;
    const poster = join(dir, "poster.jpg");
    await run("ffmpeg", posterArgs(best, poster, src.durationMs));
    const out = sourceInfo(await probe(best));

    for (const r of renditions) {
      await upload(keys.video(r), outputs[r]!, "video/mp4");
      uploaded.push(keys.video(r));
    }
    await upload(keys.poster, poster, "image/jpeg");
    uploaded.push(keys.poster);

    const done = await sql`
      update photos set status = 'ready', locked_at = null, processing_error = null, updated_at = now(),
        width = ${out.width}, height = ${out.height}, duration_ms = ${out.durationMs || src.durationMs},
        poster_key = ${keys.poster},
        video720_key = ${outputs[720] ? keys.video(720) : null},
        video1080_key = ${outputs[1080] ? keys.video(1080) : null}
      where id = ${job.id}
      returning id`;
    // Video bị xoá trong lúc đang xử lý → dọn file vừa sinh
    if (done.length === 0) await remove(uploaded);
  } catch (err) {
    await remove(uploaded);
    throw err;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const started = Date.now();
  let processed = 0;
  let failed = 0;
  while (Date.now() - started < STOP_AFTER_MS) {
    const job = await claim();
    if (!job) break;
    console.log(`Video ${job.id} (attempt ${job.attempts}/${MAX_TRANSCODE_ATTEMPTS})`);
    const t = Date.now();
    try {
      await processJob(job);
      processed++;
      console.log(`  done in ${Math.round((Date.now() - t) / 1000)}s`);
    } catch (err) {
      failed++;
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      console.error(`  failed: ${message}`);
      await sql`
        update photos set locked_at = null, processing_error = ${message}, updated_at = now(),
          status = case when attempts >= ${MAX_TRANSCODE_ATTEMPTS} then 'failed' else 'queued' end
        where id = ${job.id}`;
    }
  }
  console.log(`Finished: ${processed} processed, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
