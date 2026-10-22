// Data access + row → API mapping for opportunities (M07, D-12) and applications (M08, D-06).
// Rows are parsed, not cast. Eligibility always comes from the shared engine (evaluateMatch) on data the
// database returned for THIS caller; the database re-checks everything that matters at write time.
import { z } from "zod";
import {
  APPLICATION_STATUSES,
  applyBlocker,
  type ApplicationStatus,
} from "../../../src/domain/applications.ts";
import { possibleOnRest } from "../../../src/domain/availability.ts";
import {
  type Candidate,
  evaluateMatch,
  type MatchableRequirement,
} from "../../../src/domain/matching.ts";
import {
  REQUIREMENT_LEVELS,
  REQUIREMENT_STATUSES,
  SHIFTS,
  URGENCIES,
} from "../../../src/domain/work-requirement.ts";
import type {
  ApplicationEvent,
  ApplicationProposal,
  MyApplication,
  Opportunity,
  OpportunityRequirement,
  OrganizationApplication,
  OrgApplication,
} from "../../../src/types/api.ts";
import type { Actor } from "./auth.ts";
import { ApiError, fromDatabaseError } from "./errors.ts";
import {
  byLevelThenCode,
  termsColumns,
  timeZoneColumn,
  toCandidate,
  toCandidateSummary,
  toIso,
  toTerms,
} from "./requirements.ts";

const qualification = z.object({
  qualificationTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  level: z.enum(REQUIREMENT_LEVELS),
});

/** One row of `list_opportunities` (the fixed D-12 projection, snake_case columns). */
const opportunityRow = z.object({
  id: z.string(),
  organization_name: z.string(),
  title: z.string(),
  location: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  shift: z.enum(SHIFTS),
  headcount: z.number(),
  urgency: z.enum(URGENCIES),
  created_at: z.string(),
  qualifications: z.array(qualification),
  ...termsColumns,
  time_zone: timeZoneColumn,
  total: z.number(),
});

export function toOpportunityRequirement(raw: unknown): OpportunityRequirement {
  const row = opportunityRow.parse(raw);
  return {
    id: row.id,
    organizationName: row.organization_name,
    title: row.title,
    location: row.location,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    shift: row.shift,
    headcount: row.headcount,
    urgency: row.urgency,
    createdAt: toIso(row.created_at),
    qualifications: [...row.qualifications].sort(byLevelThenCode),
    ...toTerms(row, row.time_zone),
  };
}

/** The camelCase card the database builds (`app_private.requirement_cards.card`). */
const card = z.object({
  id: z.string(),
  organizationName: z.string(),
  title: z.string(),
  location: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  shift: z.enum(SHIFTS),
  headcount: z.number(),
  urgency: z.enum(URGENCIES),
  createdAt: z.string(),
  status: z.enum(REQUIREMENT_STATUSES),
  qualifications: z.array(qualification),
  // Requirement builder terms: on every card since 20261023600000, absent from older proposal versions.
  ...termsColumns,
  timeZone: timeZoneColumn,
});
const terms = card.omit({ id: true, createdAt: true, status: true });

const proposal = z
  .object({ id: z.string(), version: z.number().int(), createdAt: z.string(), terms })
  .nullable();
const history = z.array(
  z.object({
    from: z.enum(APPLICATION_STATUSES).nullable(),
    to: z.enum(APPLICATION_STATUSES),
    actor: z.enum(["technician", "organization"]),
    at: z.string(),
    proposalVersion: z.number().int().nullable(),
  }),
);

const applicationColumns = {
  application_id: z.string(),
  status: z.enum(APPLICATION_STATUSES),
  created_at: z.string(),
  updated_at: z.string(),
  reason: z.string().nullable(),
  current_proposal: proposal,
  accepted_proposal_id: z.string().nullable(),
  history,
};

function toProposal(raw: z.infer<typeof proposal>): ApplicationProposal | null {
  if (!raw) return null;
  return {
    id: raw.id,
    version: raw.version,
    createdAt: toIso(raw.createdAt),
    terms: {
      ...raw.terms,
      startsAt: toIso(raw.terms.startsAt),
      endsAt: toIso(raw.terms.endsAt),
      qualifications: [...raw.terms.qualifications].sort(byLevelThenCode),
      ...toTerms(raw.terms, raw.terms.timeZone),
    },
  };
}

function toHistory(raw: z.infer<typeof history>): ApplicationEvent[] {
  return raw.map((e) => ({ ...e, at: toIso(e.at) }));
}

function base(row: z.infer<z.ZodObject<typeof applicationColumns>>, requirementId: string) {
  return {
    id: row.application_id,
    requirementId,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    reason: row.reason,
    currentProposal: toProposal(row.current_proposal),
    acceptedProposalId: row.accepted_proposal_id,
    history: toHistory(row.history),
  };
}

const myRow = z.object({ ...applicationColumns, requirement_id: z.string(), requirement: card });

/**
 * The requirement card as the API returns it: ISO UTC instants, qualifications hard first, the builder
 * terms (absent = not stated).
 */
function toCardRequirement(raw: z.infer<typeof card>) {
  return {
    ...raw,
    startsAt: toIso(raw.startsAt),
    endsAt: toIso(raw.endsAt),
    createdAt: toIso(raw.createdAt),
    qualifications: [...raw.qualifications].sort(byLevelThenCode),
    ...toTerms(raw, raw.timeZone),
  };
}

/** A row of `get_my_applications()`, evaluated on the caller's own data. */
export function toMyApplication(raw: unknown, own: Candidate): MyApplication {
  const row = myRow.parse(raw);
  const requirement = toCardRequirement(row.requirement);
  return {
    ...base(row, row.requirement_id),
    requirement,
    match: evaluateMatch(requirement, own),
  };
}

const orgRow = z.object(applicationColumns);

/**
 * A row of `get_requirement_applications()`: the applicant as the candidate pool shows them (pseudonym
 * unless internal, name for internal or `open`), evaluated against the requirement.
 */
export function toOrgApplication(
  raw: unknown,
  requirement: MatchableRequirement & { id: string },
): OrgApplication {
  const row = orgRow.parse(raw);
  const candidate = toCandidate(raw);
  return {
    ...base(row, requirement.id),
    candidate: toCandidateSummary(candidate),
    match: evaluateMatch(requirement, candidate),
  };
}

const organizationRow = z.object({
  ...applicationColumns,
  requirement_id: z.string(),
  requirement: card,
  total: z.number(),
  candidate_ref: z.string().nullable(),
});

/**
 * A row of `get_organization_applications()` (v2-05): the same applicant columns as
 * `get_requirement_applications()` plus its requirement card, evaluated against that requirement. A
 * technician who closed the account (no applicant columns) is `candidate: null, match: null`.
 */
export function toOrganizationApplication(raw: unknown): {
  application: OrganizationApplication;
  total: number;
} {
  const row = organizationRow.parse(raw);
  const requirement = toCardRequirement(row.requirement);
  const application: OrganizationApplication =
    row.candidate_ref === null
      ? { ...base(row, requirement.id), candidate: null, match: null, requirement }
      : { ...toOrgApplication(raw, requirement), requirement };
  return { application, total: row.total };
}

export interface OwnApplication {
  id: string;
  requirementId: string;
  status: ApplicationStatus;
  createdAt: string;
}

/** One opportunity for this caller: own eligibility, own latest application and why they cannot apply. */
export function toOpportunity(
  requirement: OpportunityRequirement,
  own: Candidate,
  mine: readonly OwnApplication[],
  nowMs: number,
): Opportunity {
  const match = evaluateMatch(requirement, own);
  const forThis = mine
    .filter((a) => a.requirementId === requirement.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = forThis[0];
  // list_opportunities returns `open` requirements only.
  const blocker = applyBlocker(
    { status: "open", startsAt: requirement.startsAt },
    forThis.map((a) => a.status),
    match.eligible,
    nowMs,
  );
  return {
    requirement,
    match,
    myApplication: latest ? { id: latest.id, status: latest.status } : null,
    applyBlocker: blocker,
    // BR-14.1: nothing but availability stands between the caller and applying (not started, no
    // application) and their rest days would cover it. A hint, never eligibility.
    possibleOnRest:
      blocker === "NOT_ELIGIBLE" && possibleOnRest(match, own.availability, requirement),
  };
}

/** The period that covers every requirement given (own windows are read once for all of them). */
export function periodOf(requirements: readonly { startsAt: string; endsAt: string }[]) {
  if (requirements.length === 0) return null;
  return {
    from: requirements.reduce(
      (min, r) => (r.startsAt < min ? r.startsAt : min),
      requirements[0]!.startsAt,
    ),
    to: requirements.reduce((max, r) => (r.endsAt > max ? r.endsAt : max), requirements[0]!.endsAt),
  };
}

/** The caller's own matchable data (INVOKER RPC, own rows). No technician profile → 403. */
export async function loadOwnCandidate(
  actor: Actor,
  period: { from: string; to: string } | null,
): Promise<Candidate> {
  const { data, error } = await actor.client.rpc("own_candidate_profile", {
    p_from: period?.from ?? null,
    p_to: period?.to ?? null,
  });
  if (error) throw fromDatabaseError(error);
  const rows = z.array(z.unknown()).parse(data);
  if (!rows[0]) throw new ApiError("FORBIDDEN");
  return toCandidate(rows[0]);
}

const ownApplicationRow = z.object({
  id: z.string(),
  requirement_id: z.string(),
  status: z.enum(APPLICATION_STATUSES),
  created_at: z.string(),
});

/**
 * The caller's own applications (RLS: own rows; the explicit filter keeps a platform admin, who may read
 * every row for support, to their own).
 */
export async function loadOwnApplications(actor: Actor): Promise<OwnApplication[]> {
  const { data, error } = await actor.client
    .from("applications")
    .select("id, requirement_id, status, created_at")
    .eq("technician_profile_id", actor.id);
  if (error) throw fromDatabaseError(error);
  return z
    .array(ownApplicationRow)
    .parse(data ?? [])
    .map((r) => ({
      id: r.id,
      requirementId: r.requirement_id,
      status: r.status,
      createdAt: toIso(r.created_at),
    }));
}
