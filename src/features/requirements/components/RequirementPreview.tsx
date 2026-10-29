"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { RequiredQualification, WorkRequirement } from "@/domain/work-requirement";
import type { Locale } from "@/i18n/config";
import { formatCountry, formatDateTime } from "@/i18n/format";
import { ProfileRuleChips } from "./ProfileRuleChips";
import { QualificationChipList, UrgencyBadge } from "./RequirementChips";
import { RequirementTerms } from "./RequirementTerms";

export type PreviewRequirement = Pick<
  WorkRequirement,
  "title" | "location" | "startsAt" | "endsAt" | "shift" | "headcount" | "urgency"
> &
  Pick<
    WorkRequirement,
    | "country"
    | "timeZone"
    | "description"
    | "shifts"
    | "conditions"
    | "category"
    | "aircraft"
    | "requiresTypeRating"
    | "engines"
    | "minYears"
    | "requiredSkills"
  > & {
    qualifications: RequiredQualification[];
  };

/**
 * v1.8 «Previsualizar requisitos» → «Vista previa» (Company2.jsx:125): the requirement as it would be published,
 * from what the form holds now (nothing is saved). A native modal dialog: Escape closes it and focus returns
 * to the button that opened it.
 */
export function RequirementPreview({ requirement }: { requirement: PreviewRequirement }) {
  const t = useTranslations("organization.new.preview");
  const tFacts = useTranslations("organization.detail.facts");
  const tDomain = useTranslations("domain");
  const tNew = useTranslations("organization.new");
  const locale = useLocale() as Locale;
  const dialog = useRef<HTMLDialogElement>(null);
  const instant = (iso: string) =>
    Number.isNaN(Date.parse(iso)) ? "—" : formatDateTime(locale, iso);
  const facts: [string, string][] = [
    [
      tFacts("location"),
      [
        requirement.location || "—",
        requirement.country ? formatCountry(locale, requirement.country) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [tFacts("starts"), instant(requirement.startsAt)],
    [tFacts("ends"), instant(requirement.endsAt)],
    [tFacts("shift"), tDomain(`shift.${requirement.shift}`)],
    [
      tFacts("headcount"),
      Number.isFinite(requirement.headcount) ? String(requirement.headcount) : "—",
    ],
  ];
  if (requirement.timeZone) facts.push([tFacts("timeZone"), requirement.timeZone]);

  return (
    <>
      <Button variant="inverse" onClick={() => dialog.current?.showModal()}>
        {t("open")}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="requirement-preview-title"
        className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-xl border border-line bg-white p-0 text-ink backdrop:bg-navy/60"
      >
        <div className="space-y-4 p-5 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                {t("title")}
              </p>
              <h2 id="requirement-preview-title" className="text-lg font-semibold break-words">
                {requirement.title.trim() || tNew("summary.untitled")}
              </h2>
            </div>
            <Button onClick={() => dialog.current?.close()}>{t("close")}</Button>
          </header>
          <UrgencyBadge urgency={requirement.urgency} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {label}
                </dt>
                <dd className="font-medium break-words tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {requirement.qualifications.length > 0 ? (
            <QualificationChipList qualifications={requirement.qualifications} />
          ) : (
            <p className="text-sm text-muted">{t("noQualifications")}</p>
          )}
          <ProfileRuleChips rules={requirement} />
          <RequirementTerms terms={requirement} />
        </div>
      </dialog>
    </>
  );
}
