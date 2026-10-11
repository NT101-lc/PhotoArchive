"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { saveLocale, useI18n } from "@/i18n/client";

/** Nút EN / VI trên thanh trên cùng: đổi cookie rồi để server vẽ lại trang theo ngôn ngữ mới (URL giữ nguyên). */
export function LanguageToggle() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = locale === "en" ? "vi" : "en";
    saveLocale(next);
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="btn btn-icon font-display text-xs font-extrabold tracking-wide"
      title={t.language.switchTo}
      aria-label={t.language.switchTo}
    >
      {t.language.short}
    </button>
  );
}
