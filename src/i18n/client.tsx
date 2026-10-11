"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./config";
import { dictionaries } from "./dictionaries";

// Ngôn ngữ cho Client Component: layout (server) đọc cookie rồi truyền xuống đây.

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** `const { t, locale } = useI18n()` */
export function useI18n() {
  const locale = useContext(LocaleContext);
  return { t: dictionaries[locale], locale };
}

/** Lưu lựa chọn vào cookie; trang cần router.refresh() để server vẽ lại theo ngôn ngữ mới. */
export function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
