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
    <div className="flex rounded-full border-2 border-line bg-surface p-0.5">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-ink text-bg" : "text-ink-soft hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
