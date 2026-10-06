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
