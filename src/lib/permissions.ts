// Luật phân quyền — hàm thuần, dùng chung cho server (chặn thật) và UI (ẩn/hiện nút).
// role: 0 = admin, 1 = user.

export type Actor = { id: string; name: string; role: number };

export const isAdmin = (a: Actor | null | undefined) => a?.role === 0;

/** Upload ảnh, tạo album mới: chỉ cần đã chọn tên. */
export const canUpload = (a: Actor | null | undefined) => !!a;

/** Sửa thông tin album (tên, nơi, ngày), xoá album: chỉ admin. */
export const canEditAlbum = (a: Actor | null | undefined) => isAdmin(a);
export const canDeleteAlbum = (a: Actor | null | undefined) => isAdmin(a);

/** Đổi ảnh bìa: admin, hoặc người đã tạo album đó. */
export const canSetCover = (a: Actor | null | undefined, album: { createdById: string | null }) =>
  isAdmin(a) || (!!a && album.createdById === a.id);

/** Xoá ảnh: admin, hoặc chính người đã upload ảnh đó. */
export const canDeletePhoto = (a: Actor | null | undefined, photo: { uploadedById: string | null }) =>
  isAdmin(a) || (!!a && photo.uploadedById === a.id);
