import Link from "next/link";
import type { WorkRequirement } from "@/domain/work-requirement";
import { formatPeriod, SHIFT_LABEL } from "@/lib/format";
import { QualificationChips, RequirementStatusChip, UrgencyChip } from "./RequirementBadges";

const detailHref = (id: string) => `/app/organization/requirements/${id}` as const;

/** Table on ≥ md, stacked list on mobile (no horizontal scroll). */
export function RequirementsList({ requirements }: { requirements: WorkRequirement[] }) {
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">Work requirements</caption>
        <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
          <tr>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Requirement
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Period (UTC)
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Need
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Qualifications
            </th>
            <th scope="col" className="py-2 font-semibold">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {requirements.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="py-3 pr-4">
                <Link href={detailHref(r.id)} className="font-semibold text-blue hover:underline">
                  {r.title}
                </Link>
                <div className="text-muted">{r.location}</div>
              </td>
              <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                {formatPeriod(r.startsAt, r.endsAt)}
                <div className="text-muted">{SHIFT_LABEL[r.shift]}</div>
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
                  <RequirementStatusChip status={r.status} />
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
              <RequirementStatusChip status={r.status} />
            </div>
            <Link href={detailHref(r.id)} className="block font-semibold text-blue hover:underline">
              {r.title}
            </Link>
            <p className="text-sm text-muted tabular-nums">
              {r.location} · {formatPeriod(r.startsAt, r.endsAt)} · {SHIFT_LABEL[r.shift]} ·{" "}
              {r.headcount} ×
            </p>
            <QualificationChips qualifications={r.qualifications} />
          </li>
        ))}
      </ul>
    </>
  );
}
