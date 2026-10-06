// Gọi API từ trình duyệt. Lỗi trả về `{ error }` được ném ra thành Error với đúng thông báo.

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function createAlbum(input: { title: string; location: string; tripDate: string }) {
  return api<{ id: string; slug: string }>("/api/albums", { method: "POST", body: JSON.stringify(input) });
}

export function updateAlbum(
  slug: string,
  patch: { title?: string; location?: string; tripDate?: string; coverPhotoId?: string | null },
) {
  return api<{ slug: string }>(`/api/albums/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteAlbum(slug: string) {
  return api<{ deletedPhotos: number }>(`/api/albums/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

export function deletePhoto(id: string) {
  return api<{ deleted: number }>(`/api/photos/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function updateProfile(patch: { name?: string; avatarKey?: string | null }) {
  return api<{ ok: true }>("/api/me", { method: "PATCH", body: JSON.stringify(patch) });
}

/** Thu nhỏ ảnh về khung vuông 512px (cắt giữa) rồi upload lên R2; trả về key để lưu vào profile. */
export async function uploadAvatar(file: File) {
  const blob = await squareResize(file, 512);
  const { key, contentType, uploadUrl } = await api<{ key: string; contentType: string; uploadUrl: string }>(
    "/api/me/avatar",
    { method: "POST", body: JSON.stringify({ type: blob.type, size: blob.size }) },
  );
  const res = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return key;
}

async function squareResize(file: File, size: number): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("This image format can’t be read by your browser — try a JPG or PNG.");
  }
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  canvas
    .getContext("2d")!
    .drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  if (!blob) throw new Error("Couldn’t process the image.");
  return blob;
}
