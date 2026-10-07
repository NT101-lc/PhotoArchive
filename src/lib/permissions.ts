// Luật phân quyền — hàm thuần, dùng chung cho server (chặn thật) và UI (ẩn/hiện nút).
// role: 0 = admin, 1 = user.

export type Actor = { id: string; name: string; role: number };

export const isAdmin = (a: Actor | null | undefined) => a?.role === 0;

/** Upload ảnh, tạo album mới: chỉ cần đã chọn tên. */
export const canUpload = (a: Actor | null | undefined) => !!a;

/** Sửa tên / nơi của album, xoá album: chỉ admin. */
export const canEditAlbum = (a: Actor | null | undefined) => isAdmin(a);
export const canDeleteAlbum = (a: Actor | null | undefined) => isAdmin(a);

/** Sửa ngày đi của album: mọi thành viên đã chọn tên. */
export const canEditAlbumDate = (a: Actor | null | undefined) => !!a;

/** Viết / sửa mô tả chuyến đi: mọi thành viên đã chọn tên (như ngày đi). */
export const canEditAlbumDescription = (a: Actor | null | undefined) => !!a;

/** Sửa chữ trang About: mọi thành viên đã chọn tên. */
export const canEditAbout = (a: Actor | null | undefined) => !!a;

/** Tạo / sửa kế hoạch chuyến đi: mọi thành viên đã chọn tên. */
export const canEditPlan = (a: Actor | null | undefined) => !!a;

/** Xoá kế hoạch: admin, hoặc người đã tạo kế hoạch đó. */
export const canDeletePlan = (a: Actor | null | undefined, plan: { createdById: string | null }) =>
  isAdmin(a) || (!!a && plan.createdById === a.id);

/** Đổi ảnh bìa: admin, hoặc người đã tạo album đó. */
export const canSetCover = (a: Actor | null | undefined, album: { createdById: string | null }) =>
  isAdmin(a) || (!!a && album.createdById === a.id);

/** Đổi tên của mình: user. Tên ADMIN cố định vì dùng để đăng nhập. */
export const canRenameSelf = (a: Actor | null | undefined) => !!a && !isAdmin(a);

/** Xoá ảnh: admin, hoặc chính người đã upload ảnh đó. */
export const canDeletePhoto = (a: Actor | null | undefined, photo: { uploadedById: string | null }) =>
  isAdmin(a) || (!!a && photo.uploadedById === a.id);
