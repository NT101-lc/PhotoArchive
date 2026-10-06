# B6 PhotoArchive

Website riêng tư để nhóm B6 lưu và xem lại ảnh các chuyến đi.
**Hiện mới có frontend** — dữ liệu là mock, chưa có backend, database, auth hay upload thật.

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Không cần biến môi trường.
Lần đầu ảnh hơi chậm vì cần tải từ picsum.photos qua bộ tối ưu ảnh của Next.js (cần internet).

| Lệnh            | Việc làm          |
| --------------- | ----------------- |
| `npm run dev`   | Dev server        |
| `npm run build` | Build production  |
| `npm run start` | Chạy bản đã build |
| `npm run lint`  | ESLint            |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4. Không có thư viện backend / ORM / auth / storage.

Giao diện "Darkroom": giấy ảnh ấm + chấm lưới, viền mực, bóng đổ lệch, accent cam‑đỏ; có **sáng / tối**
(mặc định theo hệ điều hành, nút chuyển trên thanh trên cùng, lựa chọn lưu ở `localStorage`).

## Tính năng

- **Trang chủ**: tìm kiếm không dấu (phím `/`), lọc theo năm / nơi, sắp xếp, bộ lọc lưu trên URL để chia sẻ link.
- **Trang album**: lọc theo người chụp, chỉ xem ảnh yêu thích, xem dạng lưới masonry hoặc theo ngày, modal chi tiết chuyến đi.
- **Lightbox**: ← → / vuốt để chuyển, dải phim, slideshow (`Space`), phóng to (`Z` / nhấp đúp / chạm 2 lần),
  thả tim (`F`), thông tin ảnh (`I`), tải ảnh gốc, copy link mở thẳng tới ảnh (`?photo=…`), `Esc` để đóng.
- **Upload (chỉ UI)**: chọn ảnh, chọn thư mục hoặc kéo thả thư mục (đọc cả thư mục con), gom theo thư mục,
  gợi ý tạo album mới theo tên thư mục, bỏ qua file không phải ảnh / quá 50 MB. Bấm lưu → báo "Chưa kết nối backend".
- Ảnh yêu thích tạm lưu trong `localStorage` của từng máy.

## Cấu trúc thư mục

```
src/
├── app/
│   ├── layout.tsx              # Font, theme script chống nháy, AppBar, ToastProvider
│   ├── globals.css             # Design tokens sáng/tối + class dùng chung (btn, chip, card...)
│   ├── page.tsx                # Trang chủ
│   ├── loading.tsx             # Skeleton trang chủ
│   ├── not-found.tsx           # 404
│   ├── albums/[id]/
│   │   ├── page.tsx            # Trang album
│   │   └── loading.tsx         # Skeleton trang album
│   └── login/
│       ├── page.tsx            # Giao diện đăng nhập
│       └── GoogleLoginButton.tsx  # Nút Google (chỉ chuyển về trang chủ)
├── components/
│   ├── AppBar.tsx, Logo.tsx, ThemeToggle.tsx
│   ├── PageHero.tsx            # Tiêu đề trang + thống kê + nút hành động
│   ├── AlbumBrowser.tsx        # Tìm kiếm, lọc, sắp xếp, lưới album
│   ├── AlbumCard.tsx
│   ├── AlbumView.tsx           # Thân trang album: lọc, lưới / theo ngày, lightbox
│   ├── PhotoGrid.tsx           # Lưới masonry + nút tim
│   ├── Lightbox.tsx
│   ├── AlbumDetailButton.tsx   # Modal chi tiết chuyến đi
│   ├── UploadModal.tsx         # Upload ảnh / thư mục (chỉ UI)
│   ├── Modal.tsx, EmptyState.tsx, SmartImage.tsx, Skeletons.tsx, Toast.tsx, Icons.tsx
└── lib/
    ├── types.ts                # Album, Photo
    ├── data.ts                 # getAlbums / getAlbum / getPhotos (Promise)
    ├── mock-data.ts            # 6 album, 8–15 ảnh mỗi album
    ├── favorites.ts            # Hook ảnh yêu thích (localStorage)
    ├── theme.ts                # Script khởi tạo theme
    └── format.ts               # Định dạng ngày, bỏ dấu khi tìm kiếm...
```

## Nối backend sau này

UI chỉ lấy dữ liệu qua `src/lib/data.ts`. Khi có API, thay thân các hàm
`getAlbums`, `getAlbum`, `getPhotos` (giữ nguyên chữ ký) và xoá `mock-data.ts`.
Nhớ thêm hostname của storage ảnh vào `images.remotePatterns` trong `next.config.ts`.
Ảnh yêu thích (`lib/favorites.ts`) và upload (`UploadModal.tsx`, hàm `onSave`) là hai chỗ còn lại cần nối API.
