"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconInfo, IconStats } from "./Icons";

const LINKS = [
  // Màn hình hẹp: bỏ "Home" (bấm logo là về trang chủ) để thanh trên không bị tràn
  { href: "/", label: "Home", match: (p: string) => p === "/", hideOnMobile: true },
  { href: "/albums", label: "Albums", match: (p: string) => p.startsWith("/albums") },
  { href: "/plans", label: "Plans", match: (p: string) => p.startsWith("/plans"), icon: IconCalendar },
  // Màn hình hẹp chỉ hiện icon để thanh trên không bị tràn
  { href: "/dashboard", label: "Dashboard", match: (p: string) => p.startsWith("/dashboard"), icon: IconStats },
  { href: "/about", label: "About", match: (p: string) => p.startsWith("/about"), icon: IconInfo },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {LINKS.map(({ href, label, match, icon: Icon, hideOnMobile }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={Icon ? label : undefined}
            title={Icon ? label : undefined}
            className={`${hideOnMobile ? "max-sm:hidden " : ""}relative flex items-center px-1.5 py-2 text-sm font-semibold transition-colors after:absolute after:inset-x-1.5 sm:px-2.5 sm:after:inset-x-2.5 after:-bottom-[13px] after:h-[2px] after:rounded-full ${
              active ? "text-ink after:bg-accent" : "text-ink-soft hover:text-ink"
            }`}
          >
            {Icon && <Icon size={18} className="sm:hidden" />}
            <span className={Icon ? "max-sm:hidden" : undefined}>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
