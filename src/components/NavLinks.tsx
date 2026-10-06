"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/albums", label: "Albums", match: (p: string) => p.startsWith("/albums") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative px-2.5 py-2 text-sm font-semibold transition-colors after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-[2px] after:rounded-full ${
              active ? "text-ink after:bg-accent" : "text-ink-soft hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
