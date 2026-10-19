import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
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

/** Explainable result: verdict → per-qualification checklist → availability → blockers. */
export async function MatchCard({
  item,
  footer,
}: {
  item: EvaluatedCandidate;
  footer?: ReactNode;
}) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("matching"),
    getTranslations("domain"),
    getLocale(),
  ]);
  const { candidate, match } = item;
  const title = candidate.displayName ?? t("anonymous", { ref: candidate.id });
  const checks = match.qualificationChecks.map(explainCheck);
  const availability = explainAvailability(match.availability.coveredPercent);

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
        </div>
        {match.eligible && (
          <p className="text-right text-sm text-muted">
            {t("softScore")}
            <span className="block text-xl font-bold text-ink tabular-nums">{match.softScore}</span>
          </p>
        )}
      </header>

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

      <ul className="mt-4 divide-y divide-line text-sm">
        {[...checks, availability].map((check) => (
          <li key={check.label} className="flex items-baseline gap-3 py-1.5">
            <span aria-hidden className={`w-4 font-bold ${markTone[check.tone]}`}>
              {check.met ? "✓" : "✗"}
            </span>
            <span className="w-24 shrink-0 font-mono font-semibold">
              {check.label === "availability" ? t("availabilityLabel") : check.label}
            </span>
            <span className="min-w-0 text-muted">
              <span className="sr-only">{check.met ? t("met") : t("notMet")}</span>
              {render(t, tDomain, locale, check.detail)}
            </span>
          </li>
        ))}
      </ul>
      {footer}
    </article>
  );
}
