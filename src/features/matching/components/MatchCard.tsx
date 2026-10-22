import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import type { MatchResult } from "@/domain/matching";
import { categoryKey, type CandidatePassport } from "@/domain/passport";
import type { EvaluatedCandidate } from "@/types/api";
import {
  explainAvailability,
  explainBlocker,
  explainCheck,
  type CheckTone,
  type ExplainedText,
} from "../explain";

const markTone: Record<CheckTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

type Translate = Awaited<ReturnType<typeof getTranslations<"matching">>>;
type TranslateDomain = Awaited<ReturnType<typeof getTranslations<"domain">>>;

/** Resolves a structured explanation in the active locale (dates formatted, statuses labelled). */
function render(t: Translate, tDomain: TranslateDomain, locale: Locale, text: ExplainedText) {
  const p = text.params ?? {};
  return t(text.key as Parameters<Translate>[0], {
    code: p.code ?? "",
    percent: p.percent ?? 0,
    date: p.date ? formatDate(locale, p.date) : "",
    status: p.status ? tDomain(`verification.${p.status}`).toLowerCase() : "",
  });
}

/**
 * v1.8 card declarations (category, aircraft, English, work permits, «Restricciones declaradas») under
 * the base line. Declarations, not evidence: matching does not use them yet (package passport, T-30…T-35).
 * Never contact, employer, rate or the restriction text — the function does not return them.
 */
async function PassportFacts({ passport }: { passport: CandidatePassport }) {
  const [t, tCategory] = await Promise.all([
    getTranslations("passport.candidate"),
    getTranslations("passport.categories"),
  ]);
  const categories = passport.categories.map((c) =>
    c === passport.primaryCategory
      ? t("primary", { category: tCategory(categoryKey(c)) })
      : tCategory(categoryKey(c)),
  );
  const facts = [
    ...categories,
    ...passport.aircraft,
    ...(passport.englishLevel ? [t("english", { level: passport.englishLevel })] : []),
    ...(passport.workPermits.length > 0
      ? [t("permits", { countries: passport.workPermits.join(", ") })]
      : []),
  ];
  if (facts.length === 0 && !passport.hasRestrictions) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {facts.length > 0 && (
        <span className="break-words">
          <span className="sr-only">{t("declared")} </span>
          {facts.join(" · ")}
        </span>
      )}
      {passport.hasRestrictions && <StatusChip tone="warn">{t("restrictions")}</StatusChip>}
    </p>
  );
}

/** Explainable result: verdict → per-qualification checklist → availability → blockers. */
export async function MatchCard({
  item,
  footer,
}: {
  item: EvaluatedCandidate;
  footer?: ReactNode;
}) {
  const t = await getTranslations("matching");
  const { candidate, match } = item;
  const title = candidate.displayName ?? t("anonymous", { ref: candidate.id });

  return (
    <article
      aria-label={title}
      className={`rounded-xl border bg-white p-5 ${match.eligible ? "border-ok/40" : "border-line"}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusChip tone={match.eligible ? "ok" : "danger"}>
            {match.eligible ? t("eligible") : t("notEligible")}
          </StatusChip>
          <h3 className="mt-2 font-semibold break-words">{title}</h3>
          <p className="text-sm text-muted">
            {candidate.baseLocation ?? t("baseNotShared")}
            {candidate.yearsExperience !== null &&
              ` · ${t("years", { count: candidate.yearsExperience })}`}
          </p>
          {candidate.passport && <PassportFacts passport={candidate.passport} />}
        </div>
        {match.eligible && (
          <p className="text-right text-sm text-muted">
            {t("softScore")}
            <span className="block text-xl font-bold text-ink tabular-nums">{match.softScore}</span>
          </p>
        )}
      </header>

      <MatchExplanation match={match} />
      {footer}
    </article>
  );
}

/**
 * Blockers + per-qualification checklist with availability as its last row. Shared by the
 * organization's candidate cards and the professional's own eligibility (D-12: failed rules explained).
 */
export async function MatchExplanation({ match }: { match: MatchResult }) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("matching"),
    getTranslations("domain"),
    getLocale(),
  ]);
  const checks = match.qualificationChecks.map(explainCheck);
  const availability = explainAvailability(match.availability.coveredPercent);
  return (
    <>
      {match.blockers.length > 0 && (
        <div className="mt-4 rounded-lg bg-danger-bg px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-danger uppercase">
            {t("blockers")}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-danger">
            {match.blockers.map((blocker, i) => (
              <li key={i}>{render(t, tDomain, locale, explainBlocker(blocker))}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Subgrid: the label column fits its longest entry («Disponibilidad» is wider than a
          fixed 96 px column, and overlapped the detail), and every row stays aligned. */}
      <ul className="mt-4 grid grid-cols-[1rem_max-content_minmax(0,1fr)] gap-x-3 divide-y divide-line text-sm">
        {[...checks, availability].map((check) => (
          <li key={check.label} className="col-span-3 grid grid-cols-subgrid items-baseline py-1.5">
            <span aria-hidden className={`font-bold ${markTone[check.tone]}`}>
              {check.met ? "✓" : "✗"}
            </span>
            <span className={`font-semibold ${check.label === "availability" ? "" : "font-mono"}`}>
              {check.label === "availability" ? t("availabilityLabel") : check.label}
            </span>
            <span className="min-w-0 text-muted">
              <span className="sr-only">{check.met ? t("met") : t("notMet")}</span>
              {render(t, tDomain, locale, check.detail)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
