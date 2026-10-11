import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from "./config";
import { dictionaries } from "./dictionaries";

/** Ngôn ngữ của request hiện tại: cookie đã chọn, chưa chọn thì theo trình duyệt. */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

/** Chữ giao diện cho Server Component / generateMetadata: `const { t, locale } = await getT()` */
export async function getT() {
  const locale = await getLocale();
  return { t: dictionaries[locale], locale };
}
