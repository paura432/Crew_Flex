// Locale precedence (docs/product/I18N_STRATEGY.md §3), pure and testable:
//   1. persisted preference of the authenticated user
//   2. locale cookie (set by the switcher, also before sign-in)
//   3. browser Accept-Language
//   4. DEFAULT_LOCALE
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/** First supported language from an Accept-Language header, by quality then order. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number(q);
      return {
        tag: tag.trim().toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((item) => item.tag && item.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

export function resolveLocale(input: {
  preference: unknown;
  cookie: unknown;
  acceptLanguage: string | null | undefined;
}): Locale {
  if (isLocale(input.preference)) return input.preference;
  if (isLocale(input.cookie)) return input.cookie;
  return localeFromAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE;
}
