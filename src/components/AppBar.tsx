import Link from "next/link";
import { getT } from "@/i18n/server";
import { IdentityChip } from "./Identity";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

/** Thanh trên cùng, dính khi cuộn. */
export async function AppBar() {
  const { t } = await getT();
  return (
    <div className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md" style={{ viewTransitionName: "app-bar" }}>
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={t.nav.homeLink}>
          <Logo />
          <span className="font-display text-xl font-extrabold tracking-[-0.02em] max-sm:hidden" style={{ fontStretch: "125%" }}>
            thesix
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-3">
          <NavLinks />
          <LanguageToggle />
          <ThemeToggle />
          <IdentityChip />
        </nav>
      </div>
    </div>
  );
}
