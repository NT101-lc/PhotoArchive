import Link from "next/link";
import { IdentityChip } from "./Identity";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

/** Thanh trên cùng, dính khi cuộn. */
export function AppBar() {
  return (
    <div className="sticky top-0 z-40 border-b-2 border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="B6 PhotoArchive — home">
          <Logo />
          <span className="flex flex-col leading-none max-sm:hidden">
            <span className="font-display text-lg font-extrabold tracking-tight">PhotoArchive</span>
            <span className="eyebrow mt-0.5 text-[0.6rem]">B6 crew · private</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <NavLinks />
          <ThemeToggle />
          <IdentityChip />
        </nav>
      </div>
    </div>
  );
}
