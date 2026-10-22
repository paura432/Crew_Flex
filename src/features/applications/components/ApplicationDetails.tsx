import { getLocale, getTranslations } from "next-intl/server";
import { QualificationChips } from "@/features/requirements/components/RequirementBadges";
import type { Locale } from "@/i18n/config";
import { formatDateTime, formatPeriod } from "@/i18n/format";
import type { MyApplication, OrgApplication } from "@/types/api";

/** Proposal (R-08 version, frozen terms), reason (T-10) and history of one application, both sides. */
export async function ApplicationDetails({
  application,
}: {
  application: MyApplication | OrgApplication;
}) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("applications"),
    getTranslations("domain"),
    getLocale() as Promise<Locale>,
  ]);
  const proposal = application.currentProposal;
  const accepted = proposal !== null && application.acceptedProposalId === proposal.id;
  return (
    <div className="space-y-3 text-sm">
      {proposal && (
        <section className="rounded-lg border border-line bg-canvas px-4 py-3">
          <p className="font-semibold">
            {accepted
              ? t("proposal.accepted", { version: proposal.version })
              : t("proposal.title", { version: proposal.version })}
            {!accepted && application.status === "proposed" && (
              <span className="ml-2 font-normal text-muted">· {t("proposal.pending")}</span>
            )}
          </p>
          <p className="text-muted">
            {t("proposal.sent", { date: formatDateTime(locale, proposal.createdAt) })}
          </p>
          <p className="mt-1 tabular-nums">
            {proposal.terms.location} ·{" "}
            {formatPeriod(locale, proposal.terms.startsAt, proposal.terms.endsAt)} ·{" "}
            {tDomain(`shift.${proposal.terms.shift}`)}
          </p>
          <div className="mt-2">
            <QualificationChips qualifications={proposal.terms.qualifications} />
          </div>
          <p className="mt-2 text-xs text-muted">{t("proposal.notice")}</p>
        </section>
      )}
      {application.reason && <p>{t("card.reason", { reason: application.reason })}</p>}
      <details>
        <summary className="flex cursor-pointer items-center font-semibold text-blue pointer-coarse:min-h-11">
          {t("card.history")}
        </summary>
        <ol className="mt-2 space-y-1 border-l-2 border-line pl-3 text-muted">
          {application.history.map((event, i) => (
            <li key={i} className="tabular-nums">
              {t("card.event", {
                status: tDomain(`applicationStatus.${event.to}`),
                date: formatDateTime(locale, event.at),
                actor: t(`card.actor.${event.actor}`),
              })}
              {event.proposalVersion !== null && ` · v${event.proposalVersion}`}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
