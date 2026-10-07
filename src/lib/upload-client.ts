import { api } from "./api-client";
import { readTakenAt } from "./exif";
import { isVideoType, mediaTypeOf, type MediaType } from "./media";

// Upload từ trình duyệt. Luồng: xin chỗ upload → PUT thẳng lên R2 → báo server ghi vào DB.
// Ảnh: một PUT. Video: multipart (chia phần, không giới hạn dung lượng), server chuyển mã sau.

export const ACCEPT = "image/*,video/*,.heic,.heif,.mkv";
/** Giới hạn cho ảnh (khớp MAX_UPLOAD_BYTES phía server). Video không giới hạn. */
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;

const CHUNK = 100; // khớp MAX_FILES_PER_REQUEST phía server
const FILE_CONCURRENCY = 3;
const PART_CONCURRENCY = 3;
const PART_URL_BATCH = 20;
const PART_RETRIES = 3;
const FALLBACK_SIZE = { width: 1600, height: 1200 }; // khi trình duyệt không đọc được (vd HEIC, HEVC)

export function getUploadStatus() {
  return api<{ configured: boolean; maxBytes: number }>("/api/uploads");
}

export function isVideoFile(file: File) {
  const t = mediaTypeOf(file);
  return !!t && isVideoType(t);
}

type Dimensions = { width: number; height: number; durationMs?: number };

async function imageSize(file: File): Promise<Dimensions> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return FALLBACK_SIZE;
  }
}

/** Đọc kích thước + thời lượng video bằng thẻ <video>; codec trình duyệt không đọc được thì dùng số tạm (worker sẽ ghi lại). */
function videoSize(file: File): Promise<Dimensions> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const done = (d: Dimensions) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      resolve(d);
    };
    const timer = setTimeout(() => done({ width: 1920, height: 1080 }), 8000);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () =>
      done(
        v.videoWidth && v.videoHeight
          ? { width: v.videoWidth, height: v.videoHeight, durationMs: Math.round(v.duration * 1000) || undefined }
          : { width: 1920, height: 1080 },
      );
    v.onerror = () => done({ width: 1920, height: 1080 });
    v.src = url;
  });
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

class AbortedError extends Error {
  constructor() {
    super("Upload cancelled");
  }
}

/** PUT bằng XHR để có tiến độ upload (fetch không báo được). */
function put(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError());
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage returned ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new AbortedError());
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    xhr.send(body);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Presigned =
  | { name: string; key: string; contentType: MediaType; uploadUrl: string }
  | { name: string; key: string; contentType: MediaType; multipart: { uploadId: string; partSize: number; partCount: number } };

/** Upload video theo từng phần; xin URL đã ký dần theo tiến độ, mỗi phần thử lại tối đa 3 lần. */
async function uploadMultipart(
  file: File,
  up: Extract<Presigned, { multipart: unknown }>,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
) {
  const { uploadId, partSize, partCount } = up.multipart;
  const loaded = new Map<number, number>();
  const report = () => onProgress([...loaded.values()].reduce((a, b) => a + b, 0));
  // URL của phần n nằm trong loạt bắt đầu ở batchStart(n); mỗi loạt chỉ xin một lần dù nhiều phần chạy song song
  const batches = new Map<number, Promise<Map<number, string>>>();
  const batchStart = (n: number) => Math.floor((n - 1) / PART_URL_BATCH) * PART_URL_BATCH + 1;

  async function urlFor(n: number) {
    const start = batchStart(n);
    let batch = batches.get(start);
    if (!batch) {
      const want = Array.from({ length: Math.min(PART_URL_BATCH, partCount - start + 1) }, (_, i) => start + i);
      batch = api<{ parts: { partNumber: number; url: string }[] }>("/api/uploads/parts", {
        method: "POST",
        body: JSON.stringify({ key: up.key, uploadId, partNumbers: want }),
      }).then(({ parts }) => new Map(parts.map((p) => [p.partNumber, p.url])));
      // Lỗi mạng → bỏ khỏi cache để lần thử lại xin lại
      batch.catch(() => batches.delete(start));
      batches.set(start, batch);
    }
    return (await batch).get(n)!;
  }

  try {
    const numbers = Array.from({ length: partCount }, (_, i) => i + 1);
    await pool(numbers, PART_CONCURRENCY, async (n) => {
      const blob = file.slice((n - 1) * partSize, Math.min(n * partSize, file.size));
      for (let attempt = 1; ; attempt++) {
        try {
          await put(await urlFor(n), blob, {}, (l) => {
            loaded.set(n, l);
            report();
          }, signal);
          loaded.set(n, blob.size);
          report();
          return;
        } catch (err) {
          if (err instanceof AbortedError || attempt >= PART_RETRIES) throw err;
          loaded.set(n, 0);
          await sleep(1000 * attempt);
        }
      }
    });
    await api("/api/uploads/complete", { method: "POST", body: JSON.stringify({ key: up.key, uploadId, partCount }) });
  } catch (err) {
    // Huỷ phía R2 để không để lại các phần mồ côi
    api("/api/uploads/abort", { method: "POST", body: JSON.stringify({ key: up.key, uploadId }) }).catch(() => undefined);
    throw err;
  }
}

export type FileEvents = {
  onProgress: (index: number, loaded: number) => void;
  onDone: (index: number) => void;
  onFailed: (index: number, error: string) => void;
  /** Vừa ghi thêm ảnh / video vào album (để trang album làm mới) */
  onRegistered: (count: number) => void;
};

/**
 * Upload file vào album (người upload = người đang dùng, server lấy từ cookie).
 * `coverIndex`: vị trí ảnh được chọn làm bìa; bỏ trống → bìa là ảnh đầu tiên.
 * Video được ghi vào album ngay khi upload xong (để bắt đầu chuyển mã sớm); ảnh ghi theo từng đợt.
 */
export async function uploadFiles(
  albumSlug: string,
  files: File[],
  coverIndex: number | undefined,
  events: FileEvents,
  signal: AbortSignal,
) {
  let added = 0;

  for (let start = 0; start < files.length; start += CHUNK) {
    if (signal.aborted) break;
    const chunk = files.slice(start, start + CHUNK);
    let uploads: Presigned[];
    try {
      ({ uploads } = await api<{ uploads: Presigned[] }>("/api/uploads", {
        method: "POST",
        body: JSON.stringify({
          albumSlug,
          files: chunk.map((f) => ({ name: f.name, type: mediaTypeOf(f), size: f.size })),
        }),
      }));
    } catch (err) {
      chunk.forEach((_, i) => events.onFailed(start + i, err instanceof Error ? err.message : "Upload failed"));
      continue;
    }

    type Entry = { key: string; width: number; height: number; sizeBytes: number; mimeType: MediaType; takenAt?: string; modifiedAt?: string; durationMs?: number };
    let pending: Entry[] = [];
    let coverKey: string | undefined;

    const flush = async () => {
      if (pending.length === 0) return;
      const batch = pending;
      pending = [];
      const cover = coverKey && batch.some((e) => e.key === coverKey) ? coverKey : undefined;
      const res = await api<{ added: number }>(`/api/albums/${encodeURIComponent(albumSlug)}/photos`, {
        method: "POST",
        body: JSON.stringify({ photos: batch, coverKey: cover }),
      });
      added += res.added;
      events.onRegistered(res.added);
    };

    await pool(
      chunk.map((file, i) => ({ file, up: uploads[i], index: start + i })),
      FILE_CONCURRENCY,
      async ({ file, up, index }) => {
        if (signal.aborted) return events.onFailed(index, "Cancelled");
        try {
          const video = isVideoType(up.contentType);
          const [size, takenAt] = await Promise.all([
            video ? videoSize(file) : imageSize(file),
            video ? undefined : readTakenAt(file),
            "multipart" in up
              ? uploadMultipart(file, up, (l) => events.onProgress(index, l), signal)
              : put(up.uploadUrl, file, { "Content-Type": up.contentType }, (l) => events.onProgress(index, l), signal),
          ]);
          pending.push({
            key: up.key,
            ...size,
            sizeBytes: file.size,
            mimeType: up.contentType,
            // Giờ chụp trong EXIF; không có thì server tự chọn giữa thời gian sửa file và ngày chuyến đi
            takenAt,
            modifiedAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
          });
          if (index === coverIndex) coverKey = up.key;
          if (video) await flush();
          events.onDone(index);
        } catch (err) {
          events.onFailed(index, err instanceof AbortedError ? "Cancelled" : err instanceof Error ? err.message : "Upload failed");
        }
      },
    );

    try {
      await flush();
    } catch (err) {
      // Ảnh đã lên R2 nhưng chưa ghi được vào album
      console.error(err);
      throw err;
    }
  }

  return { added };
}
