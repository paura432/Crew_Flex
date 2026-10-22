import { useLocale, useTranslations } from "next-intl";
import {
  baseAmount,
  dayRate,
  type RequirementConditions,
  type RequirementShift,
  type Shift,
  sortShifts,
  totalBaseHours,
} from "@/domain/work-requirement";
import type { Locale } from "@/i18n/config";
import { formatDateTime, formatEuro, formatNumber, formatShiftSpan } from "@/i18n/format";

export interface RequirementTermsData {
  shift: Shift;
  headcount: number;
  conditions?: RequirementConditions | null;
  shifts?: RequirementShift[] | null;
  description?: string | null;
}

/**
 * The requirement builder's terms (v2-09 shifts, v2-12 conditions; v1.8 `JobDetails` / `Logistics`,
 * Marketplace.jsx:11-44, and the connected «Cobertura por jornada», Account.jsx:69): only what the organization
 * stated, informative (OD-7: no fee, commission or payment). Synchronous so the organization's detail, the
 * opportunity, the proposal and the builder's client preview render the same markup.
 */
export function RequirementTerms({
  terms,
  confirmedSeats,
  showAmount = false,
}: {
  terms: RequirementTermsData;
  /** Organization view: seats confirmed (confirmed + finished) → «Cobertura por jornada». */
  confirmedSeats?: number | null;
  /** Proposal view: v1.8 «{h} h × {tarifa} €/h = {base} para el técnico». */
  showAmount?: boolean;
}) {
  const t = useTranslations("organization.detail.terms");
  const tDomain = useTranslations("domain");
  const locale = useLocale() as Locale;
  const euro = (value: number) => formatEuro(locale, value);
  const c = terms.conditions ?? null;
  const shifts = sortShifts(terms.shifts ?? []);

  const rows: [string, string][] = [];
  if (c?.hourlyRate !== undefined) {
    const daily = dayRate(c);
    rows.push([
      t("rate"),
      daily === null
        ? t("rateHourly", { hourly: euro(c.hourlyRate) })
        : t("rateValue", { hourly: euro(c.hourlyRate), daily: euro(daily) }),
    ]);
  }
  if (c?.shiftHours !== undefined) {
    rows.push([
      t("shiftDuration"),
      t("shiftDurationValue", {
        shift: tDomain(`shift.${terms.shift}`),
        hours: formatNumber(locale, c.shiftHours),
      }),
    ]);
  }
  if (c?.contractType) {
    rows.push([
      t("contract"),
      t("contractValue", { contract: t(`contractType.${c.contractType}`) }),
    ]);
  }
  if (c && (c.perDiem !== undefined || c.overtimeRate !== undefined)) {
    rows.push([
      t("perDiemOvertime"),
      [
        c.perDiem !== undefined && t("perDiemValue", { amount: euro(c.perDiem) }),
        c.overtimeRate !== undefined && t("overtimeValue", { amount: euro(c.overtimeRate) }),
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
  }
  // D-06 Q6: one application covers every shift (partial coverage is v2-30, blocked).
  if (c || shifts.length > 0) rows.push([t("coverage"), t("coverageValue")]);
  if (c?.arrival) rows.push([t("arrival"), c.arrival]);
  if (c?.maxMobilizationHours !== undefined) {
    rows.push([
      t("mobilization"),
      t("hoursValue", { hours: formatNumber(locale, c.maxMobilizationHours) }),
    ]);
  }
  if (c?.budgetMandatory !== undefined) {
    rows.push([t("budget"), t(c.budgetMandatory ? "budgetMandatory" : "budgetNegotiable")]);
  }

  const logistics = (["flights", "accommodation", "localTransport", "meals"] as const)
    .filter((key) => c?.[key] !== undefined)
    .map((key) => t(`logistics.${key}.${c?.[key] ? "included" : "excluded"}`));
  if (c?.ownTools !== undefined) {
    logistics.push(t(c.ownTools ? "logistics.ownTools" : "logistics.companyTools"));
  }
  const amount = showAmount ? baseAmount(terms) : null;

  if (!terms.description && rows.length === 0 && shifts.length === 0) return null;
  return (
    <div className="space-y-4 text-sm">
      {terms.description && <p className="break-words whitespace-pre-line">{terms.description}</p>}
      {rows.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {logistics.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t("logisticsTitle")}
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {logistics.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {amount && (
        <p className="tabular-nums">
          {t("baseAmount", {
            hours: formatNumber(locale, amount.hours),
            rate: euro(amount.hourlyRate),
            amount: euro(amount.amount),
          })}
        </p>
      )}
      {shifts.length > 0 && (
        <div>
          <p className="font-semibold tabular-nums">
            {t("baseHoursSummary", {
              hours: formatNumber(locale, totalBaseHours(shifts)),
              count: shifts.length,
            })}
          </p>
          <details className="mt-1">
            <summary className="flex cursor-pointer items-center font-semibold text-blue pointer-coarse:min-h-11">
              {confirmedSeats === undefined || confirmedSeats === null
                ? t("shiftsTitle", { count: shifts.length })
                : t("coverageTitle")}
            </summary>
            <ol className="mt-2 space-y-1 border-l-2 border-line pl-3 tabular-nums">
              {shifts.map((s) => (
                <li key={s.startsAt}>
                  {confirmedSeats === undefined || confirmedSeats === null
                    ? t("shiftLine", {
                        span: formatShiftSpan(locale, s.startsAt, s.endsAt),
                        hours: formatNumber(locale, s.baseHours),
                      })
                    : t("shiftCoverage", {
                        date: formatDateTime(locale, s.startsAt),
                        filled: Math.min(confirmedSeats, terms.headcount),
                        total: terms.headcount,
                      })}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
      {c && <p className="text-xs text-muted">{t("notice")}</p>}
    </div>
  );
}
