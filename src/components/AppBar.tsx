import Link from "next/link";
import { IconUser } from "./Icons";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/** Thanh trên cùng, dính khi cuộn. */
export function AppBar() {
  return (
    <div className="sticky top-0 z-40 border-b-2 border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="B6 PhotoArchive — trang chủ">
          <Logo />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-extrabold tracking-tight">PhotoArchive</span>
            <span className="eyebrow mt-0.5 text-[0.6rem]">nhóm B6 · riêng tư</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn btn-icon" title="Tài khoản" aria-label="Tài khoản / đăng nhập">
            <IconUser />
          </Link>
        </nav>
      </div>
    </div>
  );
}
