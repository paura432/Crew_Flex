import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { categoryKey } from "@/domain/passport";
import { countryName } from "@/features/organizations/countries";
import type { ExplainedText } from "./explain";

export type Translate = Awaited<ReturnType<typeof getTranslations<"matching">>>;

export interface Resolvers {
  t: Translate;
  tDomain: Awaited<ReturnType<typeof getTranslations<"domain">>>;
  tCategory: Awaited<ReturnType<typeof getTranslations<"passport.categories">>>;
  tSkill: Awaited<ReturnType<typeof getTranslations<"passport.skills">>>;
  locale: Locale;
}

export async function resolvers(): Promise<Resolvers> {
  const [t, tDomain, tCategory, tSkill, locale] = await Promise.all([
    getTranslations("matching"),
    getTranslations("domain"),
    getTranslations("passport.categories"),
    getTranslations("passport.skills"),
    getLocale() as Promise<Locale>,
  ]);
  return { t, tDomain, tCategory, tSkill, locale };
}

/**
 * Resolves a structured explanation in the active locale: dates formatted, statuses, categories and
 * capabilities labelled, countries named; aircraft and engine designations as they are.
 */
export function render(r: Resolvers, text: ExplainedText) {
  const p = text.params ?? {};
  return r.t(text.key as Parameters<Translate>[0], {
    code: p.code ?? "",
    percent: p.percent ?? 0,
    date: p.date ? formatDate(r.locale, p.date) : "",
    status: p.status ? r.tDomain(`verification.${p.status}`).toLowerCase() : "",
    country: p.country ? countryName(r.locale, p.country) : "",
    category: p.category ? r.tCategory(categoryKey(p.category)) : "",
    skill: p.skill ? r.tSkill(p.skill) : "",
    list: p.list ?? "",
    count: p.count ?? 0,
    level: p.level ?? "",
  });
}
