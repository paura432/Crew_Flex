import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { WorkRequirement } from "@/domain/work-requirement";
import { formatPeriod } from "@/i18n/format";
import { QualificationChips, RequirementStatusChip, UrgencyChip } from "./RequirementBadges";

const detailHref = (id: string) => `/app/organization/requirements/${id}` as const;

/** Table on ≥ md, stacked list on mobile (no horizontal scroll). */
export async function RequirementsList({ requirements }: { requirements: WorkRequirement[] }) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("organization.requirements"),
    getTranslations("domain"),
    getLocale(),
  ]);
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
          </li>
        ))}
      </ul>
    </>
  );
}
