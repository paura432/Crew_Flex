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

type TermsT = ReturnType<typeof useTranslations<"organization.detail.terms">>;
type Fmt = { t: TermsT; tDomain: ReturnType<typeof useTranslations<"domain">>; locale: Locale };
type Row = [string, string];

/** The builder's preview passes what is being typed: a number that does not parse yet is not shown. */
function finiteConditions(conditions: RequirementConditions | null | undefined) {
  if (!conditions) return null;
  return Object.fromEntries(
    Object.entries(conditions).filter(
      ([, value]) => typeof value !== "number" || Number.isFinite(value),
    ),
  ) as RequirementConditions;
}

/** Rate, shift length, contract and per diem / overtime. */
function payRows(
  c: RequirementConditions | null,
  shift: Shift,
  { t, tDomain, locale }: Fmt,
): Row[] {
  if (!c) return [];
  const euro = (value: number) => formatEuro(locale, value);
  const rows: Row[] = [];
  if (c.hourlyRate !== undefined) {
    const daily = dayRate(c);
    rows.push([
      t("rate"),
      daily === null
        ? t("rateHourly", { hourly: euro(c.hourlyRate) })
        : t("rateValue", { hourly: euro(c.hourlyRate), daily: euro(daily) }),
    ]);
  }
  if (c.shiftHours !== undefined) {
    rows.push([
      t("shiftDuration"),
      t("shiftDurationValue", {
        shift: tDomain(`shift.${shift}`),
        hours: formatNumber(locale, c.shiftHours),
      }),
    ]);
  }
  if (c.contractType) {
    rows.push([
      t("contract"),
      t("contractValue", { contract: t(`contractType.${c.contractType}`) }),
    ]);
  }
  if (c.perDiem !== undefined || c.overtimeRate !== undefined) {
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
  return rows;
}

/** Arrival, maximum mobilization time and budget. */
function logisticsRows(c: RequirementConditions | null, { t, locale }: Fmt): Row[] {
  if (!c) return [];
  const rows: Row[] = [];
  if (c.arrival) rows.push([t("arrival"), c.arrival]);
  if (c.maxMobilizationHours !== undefined) {
    rows.push([
      t("mobilization"),
      t("hoursValue", { hours: formatNumber(locale, c.maxMobilizationHours) }),
    ]);
  }
  if (c.budgetMandatory !== undefined) {
    rows.push([t("budget"), t(c.budgetMandatory ? "budgetMandatory" : "budgetNegotiable")]);
  }
  return rows;
}

/** Flights, accommodation, transport, meals and tools: included or not. */
function logisticsOf(c: RequirementConditions | null, t: TermsT): string[] {
  if (!c) return [];
  const items = (["flights", "accommodation", "localTransport", "meals"] as const)
    .filter((key) => c[key] !== undefined)
    .map((key) => t(`logistics.${key}.${c[key] ? "included" : "excluded"}`));
  if (c.ownTools !== undefined) {
    items.push(t(c.ownTools ? "logistics.ownTools" : "logistics.companyTools"));
  }
  return items;
}

/** «{h} h base · {n} jornadas» and the shifts, or per-shift coverage on the organization's view. */
function ShiftList({
  shifts,
  confirmedSeats,
  headcount,
}: {
  shifts: RequirementShift[];
  confirmedSeats: number | null | undefined;
  headcount: number;
}) {
  const t = useTranslations("organization.detail.terms");
  const locale = useLocale() as Locale;
  const coverage = confirmedSeats !== undefined && confirmedSeats !== null;
  return (
    <div>
      <p className="font-semibold tabular-nums">
        {t("baseHoursSummary", {
          hours: formatNumber(locale, totalBaseHours(shifts)),
          count: shifts.length,
        })}
      </p>
      <details className="mt-1">
        <summary className="flex cursor-pointer items-center font-semibold text-blue pointer-coarse:min-h-11">
          {coverage ? t("coverageTitle") : t("shiftsTitle", { count: shifts.length })}
        </summary>
        <ol className="mt-2 space-y-1 border-l-2 border-line pl-3 tabular-nums">
          {shifts.map((s) => (
            <li key={s.startsAt}>
              {coverage
                ? t("shiftCoverage", {
                    date: formatDateTime(locale, s.startsAt),
                    filled: Math.min(confirmedSeats, headcount),
                    total: headcount,
                  })
                : t("shiftLine", {
                    span: formatShiftSpan(locale, s.startsAt, s.endsAt),
                    hours: formatNumber(locale, s.baseHours),
                  })}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
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
  const c = finiteConditions(terms.conditions);
  const shifts = sortShifts(terms.shifts ?? []);
  const fmt = { t, tDomain, locale };
  const rows = [
    ...payRows(c, terms.shift, fmt),
    // D-06 Q6: one application covers every shift (partial coverage is v2-30, blocked).
    ...(c || shifts.length > 0 ? [[t("coverage"), t("coverageValue")] as Row] : []),
    ...logisticsRows(c, fmt),
  ];
  const logistics = logisticsOf(c, t);
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
        <ShiftList shifts={shifts} confirmedSeats={confirmedSeats} headcount={terms.headcount} />
      )}
      {c && <p className="text-xs text-muted">{t("notice")}</p>}
    </div>
  );
}
