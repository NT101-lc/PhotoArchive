"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { IconCalendar, IconInfo, IconStats } from "./Icons";

const LINKS = [
  // Màn hình hẹp: bỏ "Home" (bấm logo là về trang chủ) để thanh trên không bị tràn
  { href: "/", label: "home", match: (p: string) => p === "/", hideOnMobile: true },
  { href: "/albums", label: "albums", match: (p: string) => p.startsWith("/albums") },
  { href: "/plans", label: "plans", match: (p: string) => p.startsWith("/plans"), icon: IconCalendar },
  // Màn hình hẹp chỉ hiện icon để thanh trên không bị tràn
  { href: "/dashboard", label: "dashboard", match: (p: string) => p.startsWith("/dashboard"), icon: IconStats },
  { href: "/about", label: "about", match: (p: string) => p.startsWith("/about"), icon: IconInfo },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      {LINKS.map((link) => {
        const { href, match } = link;
        const Icon = "icon" in link ? link.icon : undefined;
        const hideOnMobile = "hideOnMobile" in link && link.hideOnMobile;
        const label = t.nav[link.label];
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
