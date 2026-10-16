import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { getSessionActor } from "@/server/session";
import { LOCALE_COOKIE } from "./config";
import { resolveLocale } from "./resolve";

/**
 * Locale without i18n routing: one set of routes, the locale comes from the user's persisted
 * preference, the cookie or the browser. Resolved once per request on the server, so Server
 * and Client Components (via NextIntlClientProvider) always agree and `<html lang>` is correct
 * on first render.
 */
export default getRequestConfig(async () => {
  const [cookieStore, headerStore, actor] = await Promise.all([
    cookies(),
    headers(),
    getSessionActor(),
  ]);
  const locale = resolveLocale({
    preference: actor?.profile.preferred_locale,
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Operational times are shown in UTC in every locale (BUSINESS_RULES BR-10); date patterns
    // are built in src/i18n/format.ts (day · month · year in both languages).
    timeZone: "UTC",
  };
});
