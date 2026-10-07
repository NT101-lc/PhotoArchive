# Kế hoạch 3 tính năng tiếp theo

Ngày viết: 2026-10-06. Cập nhật 2026-10-07: **1 (upload nền) và 2 (video) đã làm xong**, xem README mục "Video". Còn lại: 3 (planner).

## Bối cảnh nhanh

- Next.js 16 App Router (đọc `node_modules/next/dist/docs/` trước khi code, xem `AGENTS.md`), deploy Vercel từ `main`.
- DB: Neon Postgres + Drizzle (`src/db/schema.ts`, migration trong `drizzle/`, `npm run db:generate -- --name <tên>` rồi `npm run db:migrate`). Migration đang áp lên **DB thật dùng chung với Vercel** → hỏi người dùng trước khi migrate; kiểm tra bảng `drizzle.__drizzle_migrations` trước.
- File: Cloudflare R2. Upload hiện tại (`src/lib/upload-client.ts`): `POST /api/uploads` xin URL ký sẵn → trình duyệt `PUT` thẳng lên R2 (pool song song) → `POST /api/albums/[slug]/photos` để ghi DB. Giới hạn 50 MB/file, chỉ nhận ảnh (`IMAGE_TYPES` trong `src/lib/mutations.ts`, `MIME_BY_EXT` trong `upload-client.ts`, `isImage()` trong `UploadModal.tsx`).
- Quyền: `src/lib/permissions.ts` (hàm thuần, có test). Mọi input đi qua zod trong `src/lib/mutations.ts`.
- CI: `.github/workflows/ci.yml` chạy typecheck, lint, test, build. Repo **public** → GitHub Actions không giới hạn phút.
- UI: hệ "bàn soi phim" trong `src/app/globals.css` (token màu, `.btn`, `.chip`, `.print`, `.frame-no`), icon Material qua `src/components/Icons.tsx` (react-icons/md).

---

## 1. Upload chạy nền kiểu Google Drive — ĐÃ XONG (UploadManager + UploadDock)

**Mục tiêu:** thả ảnh/video xong là đóng modal, lướt sang trang khác được; góc màn hình có panel tiến độ.

**Thiết kế**
- `UploadManagerProvider` (client) đặt trong `src/app/layout.tsx`, bọc ngoài `{children}` (cạnh `ToastProvider`). Layout không unmount khi chuyển trang → upload chạy tiếp.
- Chuyển logic `uploadPhotos` từ `UploadModal` vào manager: hàng đợi các "batch" (mỗi batch = 1 album đích + danh sách file), trạng thái từng file `queued | uploading | done | failed`, % tiến độ (dùng `XMLHttpRequest` để có `upload.onprogress`, `fetch` không có).
- `UploadModal` chỉ còn chọn file + album, bấm "Upload" → `manager.enqueue(batch)` rồi đóng ngay.
- `UploadDock` (góc dưới phải, trên mobile là thanh dưới): thu gọn/mở rộng, mỗi batch một dòng (tên album, x/y file, thanh tiến độ), nút huỷ (AbortController) và thử lại file lỗi. Xong batch → toast + `router.refresh()` nếu đang xem album đó.
- `beforeunload` cảnh báo khi còn upload dở. Đóng tab/tải lại = mất upload (chấp nhận ở bản đầu; resume cần multipart, để sau).

**File chính:** `src/components/UploadModal.tsx`, `src/lib/upload-client.ts`, mới `src/components/UploadManager.tsx` + `UploadDock.tsx`, `src/app/layout.tsx`.

**Xong khi:** upload 30 ảnh, đóng modal, chuyển qua lại các trang mà tiến độ vẫn chạy; huỷ/thử lại hoạt động; album tự cập nhật khi xong.

---

## 2. Video + pipeline chuyển mã ffmpeg chạy async — ĐÃ XONG

Đã chốt: giữ file gốc + bản 720p + 1080p (chọn theo mạng), không giới hạn dung lượng video. Khác kế hoạch: trạng thái hàng đợi nằm ngay trên bảng `photos` (không có bảng `media_jobs`).

**Mục tiêu:** up video gốc (iPhone `.mov` HEVC, `.mp4`…), server tự chuyển sang MP4 H.264 xem được trên mọi trình duyệt, người dùng không phải chờ.

**Luồng**
```
Trình duyệt ─PUT file gốc─▶ R2 (originals/…)
   └▶ API ghi media (kind=video, status=queued) + job ─▶ trả về ngay
          └▶ kích hoạt worker (repository_dispatch) + cron dự phòng
Worker: nhận job (FOR UPDATE SKIP LOCKED) ─▶ tải gốc ─▶ ffmpeg ─▶ đẩy MP4 + poster lên R2
          ─▶ status=ready (hoặc failed + lỗi, tự thử lại tối đa 3 lần)
Web: video chưa ready thì hiện "Đang xử lý…", poll trạng thái vài giây/lần
```

**Dữ liệu (migration mới)**
- Bảng `photos` (hoặc đổi tên khái niệm thành "media"): thêm `kind` (`photo|video`, mặc định photo), `durationMs`, `posterKey`, `status` (`ready|queued|processing|failed`, ảnh luôn ready), `playbackKey` (MP4 đã chuyển mã), giữ `storageKey` = file gốc.
- Bảng `media_jobs`: `id, photoId, status, attempts, lastError, lockedAt, createdAt, updatedAt`. Job `processing` quá 30 phút → đưa lại `queued`.

**Worker chạy ở đâu (đã cân nhắc)**
- **Chọn mặc định: GitHub Actions** (workflow `transcode.yml`, `on: repository_dispatch` + `schedule` mỗi 10 phút). Miễn phí, không cần server; độ trễ 1–3 phút.
- Phương án khác: container Fly.io/Cloud Run Jobs (nhanh hơn, ~vài $/tháng; dùng lại cùng script worker trong Docker), hoặc Cloudflare Stream (không cần ffmpeg, ~$5/1000 phút lưu trữ, nhận webhook).
- **Không** chạy ffmpeg trong function Vercel (giới hạn thời gian/RAM).
- Worker là script Node trong repo (`scripts/transcode-worker.ts`), đọc `DATABASE_URL` + R2 từ secrets. Cần thêm secret GitHub: `DATABASE_URL`, `R2_*`, và token để API gọi `repository_dispatch` (lưu ở env Vercel).

**Lệnh ffmpeg gợi ý**
- Video: `-c:v libx264 -preset veryfast -crf 23 -vf "scale='min(1920,iw)':-2" -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart`.
- Video HDR iPhone: thêm tonemap (`zscale` + `tonemap=hable`) nếu không sẽ nhạt màu — kiểm tra bằng video thật.
- Poster: `-ss 1 -frames:v 1` → JPEG; `ffprobe` lấy thời lượng, kích thước, độ xoay.

**Upload video**
- Cho phép `mp4, mov, webm, m4v`; giới hạn riêng cho video (~1–2 GB). File > 5 GB cần multipart R2 (để sau); 100 MB–2 GB vẫn PUT một lần được nhưng nên dùng multipart nếu đã làm resume ở tính năng 1.

**UI**
- `PhotoGrid`: ô video có ▶ + thời lượng; trạng thái xử lý/lỗi + nút thử lại.
- `Lightbox`: `kind=video` → `<video controls playsInline poster>`; slideshow bỏ qua hoặc chờ video hết.
- Ảnh bìa album: không chọn video chưa ready.


---

## 3. Planner lên kế hoạch đi chơi (làm thứ hai)

**Mục tiêu:** lên kế hoạch chuyến sắp tới; đi xong biến kế hoạch thành album.

**Bản đầu (MVP)**
- `trips_planned`: `id, slug, title, location, startDate, endDate, notes, status (planning|done), albumId?, createdById`.
- Thành viên tham gia: `plan_members (planId, memberId)`.
- Lịch trình: `plan_items (planId, day (date), time?, title, place?, notes?, position)` — kéo thả sắp xếp trong ngày.
- Checklist: `plan_tasks (planId, text, done, assigneeId?, position)` (đồ cần mang / việc cần làm).
- Nút "Tạo album từ kế hoạch": tạo album với title/location/ngày/mô tả lấy từ plan, gắn `albumId`, status=done.
- Trang: `/plans` (danh sách, sắp tới trước), `/plans/[slug]` (lịch trình theo ngày + checklist). Thêm "Plans" vào `NavLinks`. Trang chủ có thể hiện "Chuyến sắp tới" nếu có.
- Quyền: mọi thành viên đã chọn tên sửa được (như ngày/mô tả album); xoá plan: admin hoặc người tạo. Viết hàm trong `permissions.ts` + test.

**Để sau:** bản đồ (Leaflet + OSM, miễn phí), chia tiền kiểu Splitwise, sửa đồng thời realtime (bản đầu: last-write-wins + `router.refresh()`).

**Quyết định còn mở:** MVP có cần bản đồ / chia tiền không?

---

## Lưu ý chung cho phiên sau
- Mỗi tính năng: migration riêng, chạy `npm run typecheck && npm run lint && npm test && npm run build` trước khi commit; người dùng thường push thẳng `main` (deploy Vercel ngay) — vẫn hỏi trước.
- Dev server: Next chỉ cho 1 `next dev` mỗi thư mục; nếu phiên khác đang chạy thì dùng server đó hoặc `next build && next start -p <port>` để kiểm tra.
- Giữ ngôn ngữ thiết kế hiện có (token trong `globals.css`), copy tiếng Anh, sentence case.
