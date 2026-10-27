import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import { canFinish } from "@/domain/applications";
import { hasPackCopy } from "@/domain/candidate-pack";
import type { MatchResult } from "@/domain/matching";
import {
  requirementDays,
  type RequirementShift,
  type RequirementStatus,
  type WorkRequirement,
} from "@/domain/work-requirement";
import { MatchExplanation } from "@/features/matching/components/MatchCard";
import type { Locale } from "@/i18n/config";
import { formatPeriod } from "@/i18n/format";
import type { CandidateSummary, OrgApplication } from "@/types/api";
import { APPLICATION_TONE } from "../view";
import { ApplicationActions } from "./ApplicationActions";
import { ApplicationDetails } from "./ApplicationDetails";
import { PackDisclosure } from "./PackDisclosure";

type CardRequirement = Pick<
  WorkRequirement,
  "id" | "title" | "location" | "startsAt" | "endsAt"
> & {
  status: RequirementStatus;
  /** Published shifts (v2-09): «{n} jornadas» counts them, else the period's UTC days (T-165). */
  shifts?: readonly RequirementShift[] | null;
  /** A staffing agency's represented client, as recorded (BR-27.6, T-169): the copy's recipient line names it. */
  clientName?: string | null;
};

/** An application as the organization reads it; no applicant = the technician closed the account. */
type CardApplication = Omit<OrgApplication, "candidate" | "match"> & {
  candidate: CandidateSummary | null;
  match: MatchResult | null;
};

const REQUIREMENT_NOTE = {
  paused: "requirementPaused",
  closed: "requirementClosed",
  covered: "requirementCovered",
} as const;

/** Request time (dynamic pages): render must stay pure for React's lint. */
const periodEndedNow = (r: Pick<WorkRequirement, "endsAt">) => canFinish(r, Date.now());

/**
 * One application as the organization sees it (M08): the applicant under the pool's rules (T-04),
 * their live eligibility, proposal, history and the admin/manager actions. On the organization-wide
 * «Candidaturas» (v2-05, `showRequirement`) the heading is the requirement, as v1.8 `Workflow.jsx:57`,
 * with its period and status note; on a requirement's own page it is the applicant. A closed account
 * keeps its status and history and shows «Cuenta cerrada» instead of an applicant (and has no Candidate
 * Pack copy). Both pages pass `pack` for «Ver expediente» (v2-15, BR-25).
 */
export async function OrgApplicationCard({
  application,
  requirement,
  showRequirement = false,
  pack,
}: {
  application: CardApplication;
  requirement: CardRequirement;
  showRequirement?: boolean;
  /**
   * v2-15 «Ver expediente»: whether this card's Candidate Pack copy is open (`?pack=` names it) and the page
   * URL to toggle it on. Shown while the application keeps a copy (T-113) and its applicant has an account.
   */
  pack?: { open: boolean; baseHref: string };
}) {
  const [t, tHiring, tMatching, tDomain, tPack, locale] = await Promise.all([
    getTranslations("applications"),
    getTranslations("hiring.applications"),
    getTranslations("matching"),
    getTranslations("domain"),
    getTranslations("candidatePack"),
    getLocale() as Promise<Locale>,
  ]);
  const { candidate, match } = application;
  const name = candidate
    ? (candidate.displayName ?? tMatching("anonymous", { ref: candidate.id }))
    : tHiring("closedAccount");
  const profile = candidate
    ? `${candidate.baseLocation ?? tMatching("baseNotShared")}${
        candidate.yearsExperience !== null
          ? ` · ${tMatching("years", { count: candidate.yearsExperience })}`
          : ""
      }`
    : tHiring("closedAccountNote");
  const note =
    requirement.status in REQUIREMENT_NOTE
      ? REQUIREMENT_NOTE[requirement.status as keyof typeof REQUIREMENT_NOTE]
      : null;
  return (
    <article
      id={`a-${application.id}`} // a notice links here (v2-18)
      aria-label={showRequirement ? `${requirement.title} · ${name}` : name}
      className="space-y-3 rounded-xl border border-line bg-white p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={APPLICATION_TONE[application.status]}>
          {tDomain(`applicationStatus.${application.status}`)}
        </StatusChip>
        {match && (
          <StatusChip tone={match.eligible ? "ok" : "danger"}>
            {match.eligible ? tMatching("eligible") : tMatching("notEligible")}
          </StatusChip>
        )}
      </div>
      {showRequirement ? (
        <div>
          <h2 className="text-lg font-semibold break-words">
            <Link
              href={`/app/organization/requirements/${requirement.id}`}
              className="text-blue hover:underline pointer-coarse:inline-block pointer-coarse:py-2.5"
            >
              {requirement.title}
            </Link>
          </h2>
          {/* v1.8 «{candidato} · {n} fechas» (Workflow.jsx:57): the period and its days (T-165). */}
          <p className="text-sm text-muted tabular-nums">
            {requirement.location} ·{" "}
            {formatPeriod(locale, requirement.startsAt, requirement.endsAt)} ·{" "}
            {t("card.days", { count: requirementDays(requirement) })}
          </p>
          <p className="mt-1 font-semibold break-words">{name}</p>
          <p className="text-sm text-muted">{profile}</p>
          {note && <p className="mt-1 text-sm text-muted">{t(`card.${note}`)}</p>}
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold break-words">{name}</h2>
          <p className="text-sm text-muted">{profile}</p>
        </div>
      )}
      {match && <MatchExplanation match={match} />}
      <ApplicationDetails application={application} />
      {pack && candidate && hasPackCopy(application.status) && (
        <PackDisclosure
          applicationId={application.id}
          open={pack.open}
          baseHref={pack.baseHref}
          intro={
            requirement.clientName
              ? tPack("orgIntroClient", { client: requirement.clientName })
              : tPack("orgIntro")
          }
        />
      )}
      {/* A closed account's applications are terminal (account closure), so no button shows. */}
      <ApplicationActions
        applicationId={application.id}
        status={application.status}
        updatedAt={application.updatedAt}
        actor="organization"
        proposal={
          application.currentProposal
            ? { id: application.currentProposal.id, version: application.currentProposal.version }
            : null
        }
        periodEnded={periodEndedNow(requirement)}
        requirementOpen={requirement.status === "open"}
      />
    </article>
  );
}
