# B6 PhotoArchive

Website riêng tư để nhóm B6 lưu và xem lại ảnh các chuyến đi.
Next.js full-stack: giao diện + API trong cùng một app, dữ liệu ở Postgres (Neon) qua Drizzle, ảnh ở Cloudflare R2.
Không cần đăng nhập: thành viên chỉ chọn tên mình; riêng tài khoản **ADMIN** đăng nhập bằng mật khẩu (xem [Vai trò](#vai-trò)).

## Chạy

```bash
npm install
cp .env.example .env      # điền DATABASE_URL, SESSION_SECRET (bắt buộc) và các biến R2
npm run db:migrate        # tạo bảng + 6 thành viên + tài khoản ADMIN
npm run admin:password    # đặt mật khẩu ADMIN (in ra một lần) — hoặc: npm run admin:password -- "mật-khẩu"
npm run db:seed           # (tuỳ chọn) 6 album mẫu dùng ảnh picsum.photos
npm run dev
```

Mở http://localhost:3000. Thiếu biến R2 thì app vẫn chạy, chỉ tắt upload.

| Lệnh                  | Việc làm                                                        |
| --------------------- | --------------------------------------------------------------- |
| `npm run dev`         | Dev server                                                      |
| `npm run build`       | Build production                                                |
| `npm run start`       | Chạy bản đã build                                               |
| `npm run lint`        | ESLint                                                          |
| `npm run db:generate` | Sinh file migration SQL từ `src/db/schema.ts` vào `drizzle/`    |
| `npm run db:migrate`  | Áp migration lên DB                                             |
| `npm run db:push`     | Đẩy schema thẳng lên DB, không tạo migration (chỉ dùng khi thử) |
| `npm run db:studio`   | Mở Drizzle Studio xem dữ liệu                                   |
| `npm run db:seed`     | Seed dữ liệu mẫu; `npm run db:seed -- --reset` để xoá album / ảnh rồi seed lại (giữ thành viên) |
| `npm run admin:password` | Đặt / đổi mật khẩu ADMIN                                     |

Đổi schema: sửa `src/db/schema.ts` → `npm run db:generate` → xem lại file SQL → `npm run db:migrate` → commit cả thư mục `drizzle/`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM + Neon Postgres (`neon-http`) ·
Cloudflare R2 (S3 API, ký URL bằng `aws4fetch`) · Zod để kiểm tra input.

Giao diện "Darkroom": giấy ảnh ấm + chấm lưới, viền mực, bóng đổ lệch, accent cam‑đỏ; có **sáng / tối**
(mặc định theo hệ điều hành, nút chuyển trên thanh trên cùng, lựa chọn lưu ở `localStorage`).

## Tính năng

Giao diện hiển thị bằng tiếng Anh (tên chuyến đi / địa danh trong dữ liệu giữ nguyên).

- **Trang chủ `/`** (landing): dải phim chạy tên các chuyến, hero + thống kê, 4 lối tắt, chuyến gần nhất,
  dòng thời gian dạng trục dọc (mỗi chuyến là một mốc có ngày + thứ, mốc năm nằm trên trục).
- **Thư viện `/albums`**: tìm kiếm không dấu (phím `/`), lọc theo năm / nơi (**chọn nhiều**: cùng hàng là "hoặc",
  khác hàng là "và"; mỗi hàng có nút reset riêng, "Clear all" xoá hết kể cả sort), sắp xếp, bộ lọc lưu trên URL.
- **Trang album**: lọc theo người chụp, chỉ xem ảnh yêu thích, xem dạng lưới masonry hoặc theo ngày, modal chi tiết chuyến đi.
- **Lightbox**: ← → / vuốt để chuyển, dải phim, slideshow (`Space`), phóng to (`Z` / nhấp đúp / chạm 2 lần),
  thả tim (`F`), thông tin ảnh (`I`), tải ảnh gốc, copy link mở thẳng tới ảnh (`?photo=…`), `Esc` để đóng.
- **Upload**: chọn ảnh, chọn thư mục hoặc kéo thả thư mục (đọc cả thư mục con), gom theo thư mục,
  lưu vào album có sẵn hoặc tạo album mới (gợi ý tên theo thư mục, ngày theo file cũ nhất).
  Trình duyệt upload thẳng lên R2 qua URL đã ký, rồi server ghi thông tin ảnh vào DB.
  Người upload = người đang dùng (chọn ở trang "Who are you?").
  **Ảnh bìa**: bấm ★ trên ảnh xem trước để chọn bìa; không chọn gì thì bìa là ảnh đầu tiên (chụp sớm nhất) của album.
- Ảnh yêu thích tạm lưu trong `localStorage` của từng máy.

## Vai trò

Cột `members.role`: **0 = admin**, **1 = user**. Thành viên: Nam Anh, Thảo, Diệp, Hoàng, Nam, Hưng (user) và ADMIN.

- **User** không cần mật khẩu — chọn tên ở trang `/login` ("Who are you?").
- **ADMIN** đăng nhập bằng mật khẩu ở cùng trang (mục "Admin sign-in"). Mật khẩu lưu dạng scrypt hash trong DB.
- Danh tính lưu trong cookie `b6_session` có chữ ký HMAC (`SESSION_SECRET`) — sửa tay cookie không giả làm người khác được;
  vai trò luôn đọc lại từ DB.

| Việc                                   | User                         | Admin |
| -------------------------------------- | ---------------------------- | ----- |
| Xem album / ảnh                         | ✓ (kể cả chưa chọn tên)      | ✓     |
| Upload ảnh, tạo album mới               | ✓ (phải chọn tên trước)      | ✓     |
| Đổi ảnh bìa                             | chỉ album do mình tạo        | ✓     |
| Xoá ảnh                                 | chỉ ảnh do mình upload       | ✓     |
| Sửa tên / nơi / ngày album, xoá album   | ✗                            | ✓     |

Luật nằm ở `src/lib/permissions.ts`, dùng chung cho API (chặn thật, trả 401 / 403) và giao diện (ẩn nút).

## Database

| Bảng      | Nội dung                                                                                      |
| --------- | --------------------------------------------------------------------------------------------- |
| `members` | Thành viên: tên, `role` (0 admin / 1 user), `password_hash` (chỉ admin)                       |
| `albums`  | Chuyến đi: `slug` (dùng trên URL), tên, địa điểm, ngày đi, ảnh bìa (null → ảnh chụp sớm nhất) |
| `photos`  | Ảnh: `storage_key` trên R2 **hoặc** `source_url` ngoài (seed), kích thước, người upload, thời điểm chụp |

Xoá album sẽ xoá luôn ảnh (cascade). Số ảnh của album được đếm khi truy vấn, không lưu riêng.

## API

| Method & path                      | Việc làm                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/albums`                  | Danh sách album                                                          |
| `POST /api/albums`                 | Tạo album `{ title, location, tripDate }` → `{ id, slug }` (cần đã chọn tên) |
| `GET /api/albums/:slug`            | Album + danh sách ảnh                                                    |
| `PATCH /api/albums/:slug`          | `{ title?, location?, tripDate?, coverPhotoId? }` — thông tin: admin; bìa: admin / người tạo |
| `DELETE /api/albums/:slug`         | Xoá album + ảnh (DB và R2) — admin                                       |
| `POST /api/albums/:slug/photos`    | Ghi ảnh đã upload `{ photos: [{ key, width, height, sizeBytes, mimeType, takenAt? }], coverKey? }` |
| `DELETE /api/photos/:id`           | Xoá ảnh (DB và R2) — admin / người upload                                |
| `GET/POST/DELETE /api/session`     | Xem / chọn tên `{ memberId }` / bỏ chọn                                 |
| `POST /api/session/admin`          | Đăng nhập admin `{ name, password }`                                    |
| `GET /api/uploads`                 | R2 đã cấu hình chưa                                                      |
| `POST /api/uploads`                | Xin URL ký để PUT lên R2 `{ albumSlug, files: [{ name, type, size }] }` (tối đa 100 file, 50 MB/file) |
| `GET /api/members`                 | Thành viên thường (để chọn tên)                                          |
| `GET /api/photos/:id/raw`          | Link cố định tới ảnh gốc: chuyển hướng sang URL đọc tạm thời trên R2      |

Lỗi trả về `{ error }` với mã 400 (input sai), 401 (chưa chọn tên / sai mật khẩu), 403 (không đủ quyền), 404, 503 (chưa cấu hình R2), 500.

## Cấu hình R2

1. Tạo bucket, điền `R2_BUCKET` trong `.env`.
2. Hiển thị ảnh — chọn một trong hai:
   - **Bucket private** (mặc định): để trống `R2_PUBLIC_URL`. Server ký URL đọc cho từng ảnh khi render;
     mốc ký làm tròn theo giờ nên URL giữ nguyên trong 1 giờ (cache được), hạn 2 giờ.
   - **Bucket public**: bật r2.dev hoặc gắn custom domain, điền `R2_PUBLIC_URL`.
3. Bật **CORS** cho bucket để trình duyệt PUT được (R2 → bucket → Settings → CORS policy):

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://<domain-của-bạn>"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. Khởi động lại `npm run dev` sau khi sửa `.env`.

## Cấu trúc thư mục

```
drizzle/                        # Migration SQL do drizzle-kit sinh ra (commit vào git)
drizzle.config.ts
src/
├── app/
│   ├── layout.tsx              # Font, theme script chống nháy, AppBar, ToastProvider
│   ├── globals.css             # Design tokens sáng/tối + class dùng chung (btn, chip, card...)
│   ├── page.tsx                # Trang chủ (landing)
│   ├── albums/page.tsx         # Thư viện album
│   ├── albums/[id]/page.tsx    # Trang album
│   ├── login/                  # Giao diện đăng nhập (chưa có OAuth)
│   └── api/                    # Route handlers (xem bảng API)
├── components/                 # UI: AlbumBrowser, AlbumView, Lightbox, UploadModal, ...
├── db/
│   ├── schema.ts               # Bảng members / albums / photos
│   ├── client.ts               # createDb(): Drizzle + Neon HTTP
│   ├── index.ts                # db dùng chung trong app (server-only)
│   ├── seed.ts, seed-data.ts   # Dữ liệu mẫu
└── lib/
    ├── data.ts                 # Đọc dữ liệu (Data Access Layer, server-only) → DTO Album / Photo
    ├── mutations.ts            # Ghi dữ liệu + schema zod cho input
    ├── storage.ts              # R2: ký URL upload / download, URL hiển thị ảnh
    ├── env.ts                  # Đọc + kiểm tra biến môi trường (nơi duy nhất đọc secret)
    ├── api.ts                  # Helper route handler: đọc JSON, map lỗi → HTTP
    ├── upload-client.ts        # Luồng upload phía trình duyệt
    ├── types.ts, format.ts, favorites.ts, theme.ts
```

## Việc tiếp theo

- Đọc EXIF để lấy thời điểm chụp thật (hiện dùng thời gian sửa file).
- Lưu ảnh yêu thích theo thành viên trong DB (hiện ở `localStorage`).
- Trang quản lý thành viên cho admin.
