// Ngôn ngữ giao diện — dùng chung server và trình duyệt.
// Lưu trong cookie (không đổi URL: link ảnh đã chia sẻ, hiệu ứng bìa album vẫn giữ nguyên).

export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "thesix-lang";
/** Nhớ lựa chọn một năm */
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Tên trong Intl (ngày tháng, số) theo từng ngôn ngữ */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", vi: "vi-VN" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/**
 * Chưa chọn lần nào → đoán theo ngôn ngữ trình duyệt (header Accept-Language, vd "vi-VN,vi;q=0.9,en;q=0.8"):
 * ngôn ngữ đứng trước (q cao hơn) thắng; không có tiếng Việt thì tiếng Anh.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const langs = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((l) => l.lang && Number.isFinite(l.q))
    .sort((a, b) => b.q - a.q);
  return langs.find((l) => isLocale(l.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}
