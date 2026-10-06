import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { IconArrowLeft, IconImage } from "@/components/Icons";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <EmptyState
        icon={<IconImage size={26} />}
        title="Không tìm thấy album"
        action={
          <Link href="/" className="btn btn-primary">
            <IconArrowLeft size={16} /> Về trang chủ
          </Link>
        }
      >
        Album này không tồn tại hoặc đã bị xoá. Quay lại kho ảnh để chọn chuyến đi khác.
      </EmptyState>
    </main>
  );
}
