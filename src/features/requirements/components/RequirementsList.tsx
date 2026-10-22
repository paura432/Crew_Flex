import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { confirmedCoverage } from "@/domain/coverage";
import type { WorkRequirement } from "@/domain/work-requirement";
import { formatPeriod } from "@/i18n/format";
import { CoverageMeter } from "./CoverageMeter";
import { QualificationChips, RequirementStatusChip, UrgencyChip } from "./RequirementBadges";

const detailHref = (id: string) => `/app/organization/requirements/${id}` as const;
/** v2-05: the organization's «Candidaturas» filtered by this requirement (v1.8 «Gestionar candidaturas»). */
const applicationsHref = (id: string) => `/app/organization/applications?requirementId=${id}`;

/**
 * Table on ≥ md, stacked list on mobile (no horizontal scroll). With `seats` (admin/manager: confirmed +
 * finished per requirement, BR-23) each row shows its confirmed coverage — «{p}% cobertura confirmada»
 * on the list, «{p}% cubierto» on the dashboard (`coverageLabel`) — and the link to its applications.
 */
export async function RequirementsList({
  requirements,
  seats,
  coverageLabel = "confirmed",
}: {
  requirements: WorkRequirement[];
  seats?: ReadonlyMap<string, number>;
  coverageLabel?: "confirmed" | "covered";
}) {
  const [t, tDomain, tHiring, locale] = await Promise.all([
    getTranslations("organization.requirements"),
    getTranslations("domain"),
    getTranslations("hiring"),
    getLocale(),
  ]);
  const coverageOf = (r: WorkRequirement) => confirmedCoverage(r.headcount, seats?.get(r.id) ?? 0);
  const manageLink = (r: WorkRequirement) => (
    <Link
      href={applicationsHref(r.id)}
      className="inline-flex items-center text-sm font-semibold text-blue hover:underline pointer-coarse:min-h-11"
    >
      {tHiring("manageApplications")}
    </Link>
  );
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="border-b border-line bg-canvas text-[11px] font-semibold text-muted">
          <tr>
            <th scope="col" className="py-2 pr-4">
              {t("columns.requirement")}
            </th>
            <th scope="col" className="py-2 pr-4">
              {t("columns.period")}
            </th>
            <th scope="col" className="py-2 pr-4">
              {t("columns.need")}
            </th>
            <th scope="col" className="py-2 pr-4">
              {t("columns.qualifications")}
            </th>
            <th scope="col" className="py-2">
              {t("columns.status")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {requirements.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="py-3 pr-4">
                <Link
                  href={detailHref(r.id)}
                  className="inline-flex items-center font-semibold text-blue hover:underline pointer-coarse:min-h-11"
                >
                  {r.title}
                </Link>
                <div className="text-muted">{r.location}</div>
              </td>
              <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                {formatPeriod(locale, r.startsAt, r.endsAt)}
                <div className="text-muted">{tDomain(`shift.${r.shift}`)}</div>
              </td>
              <td className="py-3 pr-4 tabular-nums">
                <span className="font-semibold">{r.headcount}</span> ×
              </td>
              <td className="py-3 pr-4">
                <QualificationChips qualifications={r.qualifications} />
              </td>
              <td className="space-y-1 py-3">
                <UrgencyChip urgency={r.urgency} />
                <div>
                  <RequirementStatusChip requirement={r} />
                </div>
                {/* Inside the status cell: a seventh column would not fit at md width. */}
                {seats && (
                  <div className="space-y-1 pt-1">
                    <CoverageMeter coverage={coverageOf(r)} label={coverageLabel} />
                    {manageLink(r)}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden">
        {requirements.map((r) => (
          <li key={r.id} className="space-y-2 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <UrgencyChip urgency={r.urgency} />
              <RequirementStatusChip requirement={r} />
            </div>
            <Link
              href={detailHref(r.id)}
              className="block font-semibold text-blue hover:underline pointer-coarse:py-2.5"
            >
              {r.title}
            </Link>
            <p className="text-sm text-muted tabular-nums">
              {r.location} · {formatPeriod(locale, r.startsAt, r.endsAt)} ·{" "}
              {tDomain(`shift.${r.shift}`)} · {r.headcount} ×
            </p>
            <QualificationChips qualifications={r.qualifications} />
            {seats && (
              <>
                <CoverageMeter coverage={coverageOf(r)} label={coverageLabel} />
                {manageLink(r)}
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
