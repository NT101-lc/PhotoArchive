// Gọi API upload từ trình duyệt. Luồng: xin URL đã ký → PUT thẳng lên R2 → báo server ghi vào DB.

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};
export const ACCEPTED_EXT = new RegExp(`\\.(${Object.keys(MIME_BY_EXT).join("|")})$`, "i");

const CHUNK = 100; // khớp MAX_FILES_PER_REQUEST phía server
const CONCURRENCY = 4;
const FALLBACK_SIZE = { width: 1600, height: 1200 }; // khi trình duyệt không đọc được ảnh (vd HEIC)

/** Trình duyệt Windows hay để trống `type` với HEIC → đoán theo đuôi file. */
export function mimeOf(file: File) {
  if (file.type && Object.values(MIME_BY_EXT).includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? file.type;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function getUploadStatus() {
  return api<{ configured: boolean; maxBytes: number }>("/api/uploads");
}

export async function getMembers() {
  return (await api<{ members: { id: string; name: string }[] }>("/api/members")).members;
}

export function createAlbum(input: { title: string; location: string; tripDate: string; createdById?: string }) {
  return api<{ id: string; slug: string }>("/api/albums", { method: "POST", body: JSON.stringify(input) });
}

async function imageSize(file: File) {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return FALLBACK_SIZE;
  }
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

export type UploadProgress = { done: number; failed: number; total: number };

/** Upload file vào album; trả về số ảnh đã lưu và số file lỗi. */
export async function uploadPhotos(
  albumSlug: string,
  files: File[],
  uploadedById: string | undefined,
  onProgress: (p: UploadProgress) => void,
) {
  const progress = { done: 0, failed: 0, total: files.length };
  onProgress({ ...progress });
  let added = 0;

  for (let start = 0; start < files.length; start += CHUNK) {
    const chunk = files.slice(start, start + CHUNK);
    const { uploads } = await api<{ uploads: { key: string; contentType: string; uploadUrl: string }[] }>(
      "/api/uploads",
      {
        method: "POST",
        body: JSON.stringify({
          albumSlug,
          files: chunk.map((f) => ({ name: f.name, type: mimeOf(f), size: f.size })),
        }),
      },
    );

    const uploaded: Array<{
      key: string;
      width: number;
      height: number;
      sizeBytes: number;
      mimeType: string;
      takenAt: string;
    }> = [];

    await pool(
      chunk.map((file, i) => ({ file, up: uploads[i] })),
      CONCURRENCY,
      async ({ file, up }) => {
        try {
          const [size, res] = await Promise.all([
            imageSize(file),
            fetch(up.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": up.contentType } }),
          ]);
          if (!res.ok) throw new Error(`R2 ${res.status}`);
          uploaded.push({
            key: up.key,
            ...size,
            sizeBytes: file.size,
            mimeType: up.contentType,
            // Chưa đọc EXIF: tạm dùng thời gian sửa file làm thời điểm chụp
            takenAt: new Date(file.lastModified || Date.now()).toISOString(),
          });
          progress.done++;
        } catch {
          progress.failed++;
        }
        onProgress({ ...progress });
      },
    );

    if (uploaded.length > 0) {
      const res = await api<{ added: number }>(`/api/albums/${encodeURIComponent(albumSlug)}/photos`, {
        method: "POST",
        body: JSON.stringify({ uploadedById, photos: uploaded }),
      });
      added += res.added;
    }
  }

  return { added, failed: progress.failed };
}
