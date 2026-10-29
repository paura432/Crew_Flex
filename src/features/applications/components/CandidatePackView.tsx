import { getLocale, getTranslations } from "next-intl/server";
import {
  PACK_EXPERIENCE_MAX,
  packCourseState,
  packWithheld,
  splitPackQualifications,
} from "@/domain/candidate-pack";
import { categoryKey } from "@/domain/passport";
import { countryName } from "@/features/organizations/countries";
import type { Locale } from "@/i18n/config";
import { formatDate, formatDateTime, INTL_LOCALE } from "@/i18n/format";
import type { CandidatePackCopy } from "@/types/api";

/** `YYYY-MM-DD` (UTC) of the request: the course states are read against it (outside render for the lint). */
const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * v1.8 «Candidate Pack» (`Workflow.jsx:17-33`) without the D-07 fields: the dated copy of the professional's
 * technical profile (`mode="copy"`, both parties of the application) or what it would be now
 * (`mode="preview"`, the apply panel's «Qué compartes»). Identity, contact, employer, blocks and documents are
 * never in the data; while `PACK_ACTIVATION` is off (`packWithheld`) the view says they stay protected.
 */
export async function CandidatePackView({
  pack,
  mode,
  intro,
}: {
  pack: CandidatePackCopy;
  mode: "copy" | "preview";
  /** One line above the content (who receives it, or who sent it). */
  intro?: string;
}) {
  const [t, tCategory, tSkill, tDomain, tLogbook, locale] = await Promise.all([
    getTranslations("candidatePack"),
    getTranslations("passport.categories"),
    getTranslations("passport.skills"),
    getTranslations("domain"),
    getTranslations("logbook"),
    getLocale() as Promise<Locale>,
  ]);
  const today = todayUtc();
  const { courses, others } = splitPackQualifications(pack.qualifications);
  const joined = (items: string[]) => (items.length > 0 ? items.join(" · ") : t("noneDeclared"));
  const expiry = (date: string | null, none: string) =>
    date ? t("expires", { date: formatDate(locale, date) }) : none;
  const categories = [
    ...(pack.primaryCategory
      ? [t("primary", { category: tCategory(categoryKey(pack.primaryCategory)) })]
      : []),
    ...pack.categories
      .filter((c) => c !== pack.primaryCategory)
      .map((c) => tCategory(categoryKey(c))),
  ];
  const summary = [
    ...(categories.length > 0 ? [categories.join(" · ")] : []),
    ...(pack.yearsExperience !== null ? [t("years", { count: pack.yearsExperience })] : []),
    ...(pack.englishLevel ? [t("english", { level: pack.englishLevel })] : []),
  ];
  const base = [
    pack.baseLocation ?? t("noBase"),
    ...(pack.baseCountry ? [countryName(locale, pack.baseCountry)] : []),
  ].join(" · ");
  const money = (amount: number) =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency: "EUR" }).format(
      amount,
    );
  const h4 = "font-semibold text-ink";

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted">{t("brand")}</span>
          <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white">
            {mode === "copy" ? t("badge") : t("previewBadge")}
          </span>
        </p>
        {intro && <p className="text-muted">{intro}</p>}
        {summary.length > 0 && <p className="font-semibold break-words">{summary.join(" · ")}</p>}
        <p className="text-muted break-words">{base}</p>
        {pack.minRate && (
          <p className="tabular-nums">
            {t("minRate", {
              amount: money(pack.minRate.amount),
              unit: t(`rateUnit.${pack.minRate.unit}`),
            })}
          </p>
        )}
      </div>

      <section className="space-y-1">
        <h4 className={h4}>{t("qualificationsTitle")}</h4>
        <p className="break-words">{t("aircraft", { list: joined(pack.aircraft) })}</p>
        <p className="break-words">{t("engines", { list: joined(pack.engines) })}</p>
        <ul className="space-y-1">
          {pack.typeRatings.map((r) => (
            <li key={`${r.aircraft}:${r.category}`} className="break-words">
              {t("rating", {
                aircraft: r.aircraft,
                category: tCategory(categoryKey(r.category)),
                expiry: expiry(r.expiresAt, t("noExpiryApplicable")),
                restrictions: r.restrictions ?? t("noRestrictions"),
              })}
            </li>
          ))}
          {others.map((q) => (
            <li key={q.code} className="break-words">
              {t("catalogItem", {
                code: q.code,
                name: q.name,
                verification: tDomain(`verification.${q.verificationStatus}`),
                expiry: expiry(q.expiresAt, t("noExpiry")),
              })}
            </li>
          ))}
        </ul>
        {pack.typeRatings.length === 0 && others.length === 0 && (
          <p className="text-muted">{t("noQualifications")}</p>
        )}
      </section>

      <section className="space-y-1">
        <h4 className={h4}>{t("coursesTitle")}</h4>
        {courses.length === 0 ? (
          <p className="text-muted">{t("noCourses")}</p>
        ) : (
          <ul className="space-y-1">
            {courses.map((c) => (
              <li key={c.code} className="break-words">
                {t("course", {
                  name: c.name,
                  expiry: c.expiresAt ? formatDate(locale, c.expiresAt) : t("noExpiry"),
                  state: t(`courseState.${packCourseState(c, today)}`),
                })}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1">
        <h4 className={h4}>{t("skillsTitle")}</h4>
        <p className="break-words">{joined(pack.skills.map((s) => tSkill(s)))}</p>
      </section>

      <section className="space-y-1">
        <h4 className={h4}>{t("permitsTitle")}</h4>
        <p className="break-words">{joined(pack.workPermits.map((c) => countryName(locale, c)))}</p>
      </section>

      <section className="space-y-1">
        <h4 className={h4}>{t("restrictionsTitle")}</h4>
        <p className="break-words whitespace-pre-line">
          {pack.generalRestrictions ?? t("noRestrictions")}
        </p>
      </section>

      <section className="space-y-1">
        <h4 className={h4}>
          {mode === "copy" ? t("experienceTitle") : t("previewExperienceTitle")}
        </h4>
        {mode === "preview" && (
          <p className="text-muted">{t("previewExperienceHint", { max: PACK_EXPERIENCE_MAX })}</p>
        )}
        {pack.experience.length === 0 ? (
          <p className="text-muted">{t("noExperience")}</p>
        ) : (
          <ul className="space-y-2">
            {pack.experience.map((e, i) => {
              const meta = {
                date: formatDate(locale, e.date),
                hours: tLogbook("hoursValue", { hours: e.hours }),
                environment: tLogbook(`environment.${e.environment}`),
              };
              return (
                <li key={i} className="break-words">
                  <p className="font-semibold">
                    {e.aircraft} · {tLogbook(`category.${e.category}`)}
                  </p>
                  <p className="text-muted tabular-nums">
                    {e.ata
                      ? t("experienceMetaAta", { ...meta, ata: e.ata })
                      : t("experienceMeta", meta)}
                  </p>
                  <p className="whitespace-pre-line">{e.description}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {packWithheld() && (
        <div className="rounded-lg border border-line bg-canvas px-4 py-3">
          <p className="font-semibold">{t("protected")}</p>
          <p className="text-muted">{t("notIncluded")}</p>
        </div>
      )}

      <p className="text-xs text-muted">
        {mode === "copy"
          ? t("copyDate", { date: formatDateTime(locale, pack.copiedAt) })
          : t("previewNote")}
      </p>
    </div>
  );
}
