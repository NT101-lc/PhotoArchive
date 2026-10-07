"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconStats } from "./Icons";

const LINKS = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/albums", label: "Albums", match: (p: string) => p.startsWith("/albums") },
  // Màn hình hẹp chỉ hiện icon để thanh trên không bị tràn
  { href: "/dashboard", label: "Dashboard", match: (p: string) => p.startsWith("/dashboard"), icon: IconStats },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {LINKS.map(({ href, label, match, icon: Icon }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={Icon ? label : undefined}
            title={Icon ? label : undefined}
            className={`relative flex items-center px-2.5 py-2 text-sm font-semibold transition-colors after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-[2px] after:rounded-full ${
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
