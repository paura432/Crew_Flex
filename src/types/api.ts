// Edge Function response contracts. Type-only module shared by Next.js and the Deno functions.
// Envelope: docs/architecture/EDGE_FUNCTIONS.md
import type {
  ApplicationActor,
  ApplicationConflict,
  ApplicationStatus,
  ApplyBlocker,
} from "../domain/applications.ts";
import type {
  AvailabilityConflict,
  AvailabilityStatus,
  CycleDay,
  Rotation,
} from "../domain/availability.ts";
import type { CapacityResult } from "../domain/capacity.ts";
import type { DocumentKind, DocumentMime, DocumentScanStatus } from "../domain/documents.ts";
import type { LogbookCategory, LogbookEnvironment } from "../domain/logbook.ts";
import type { OrganizationReviewStatus, OrganizationType } from "../domain/organization.ts";
import type { PackExperience, PackQualification } from "../domain/candidate-pack.ts";
import type {
  Aircraft,
  CandidatePassport,
  Engine,
  EnglishLevel,
  PassportDeclarations,
  PassportPrivate,
  ProfessionalCategory,
  RateUnit,
  Skill,
  TypeRating,
} from "../domain/passport.ts";
import type {
  NoticeAudience,
  NoticeKind,
  NoticeRequirementStatus,
  TrainingNoticeSubject,
} from "../domain/notices.ts";
import type { DirectoryConflict } from "../domain/directory.ts";
import type { CandidateDeclarations, CandidatePool, MatchResult } from "../domain/matching.ts";
import type { NoticePreferences, OutreachConflict, OutreachUrgency } from "../domain/outreach.ts";
import type { ProfessionalProfile } from "../domain/professional.ts";
import type { RecruiterConflict, RepresentationStatus } from "../domain/recruiter.ts";
import type {
  TrainingConflict,
  TrainingCurrency,
  TrainingFamily,
  TrainingListingStatus,
  TrainingMode,
  TrainingOutcome,
  TrainingPriceUnit,
  TrainingProviderStatus,
  TrainingRequestKind,
  TrainingRequestStatus,
  TrainingScope,
  TrainingSessionElement,
} from "../domain/training.ts";
import type { Locale } from "../i18n/config.ts";
import type {
  QualificationCategory,
  QualificationStatus,
  QualificationType,
  VerificationStatus,
} from "../domain/qualification.ts";
import type {
  EuCountry,
  RequiredQualification,
  RequirementConditions,
  RequirementProfileRules,
  RequirementShift,
  RequirementStatus,
  RequirementTimeZone,
  Shift,
  Urgency,
  WorkRequirement,
} from "../domain/work-requirement.ts";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR"
  /** Client-side only: the function could not be reached. */
  | "NETWORK_ERROR";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  issues?: { path: string; message: string }[];
  /**
   * Which server check refused a 409: applications/opportunities (D-06; `APPLICATION_CONFLICTS`), an
   * availability write that would touch a confirmed assignment (BR-4.9; `AVAILABILITY_CONFLICTS`), a refused
   * «Distribuir aviso Urgente / AOG» (BR-26; `OUTREACH_CONFLICTS`), an action for a represented client (BR-27;
   * `RECRUITER_CONFLICTS`) or a refused directory search (BR-28; `DIRECTORY_CONFLICTS`).
   */
  reason?:
    | ApplicationConflict
    | AvailabilityConflict
    | OutreachConflict
    | RecruiterConflict
    | DirectoryConflict;
}

export type ApiResponse<T> =
  { ok: true; data: T; requestId: string } | { ok: false; error: ApiErrorBody; requestId: string };

/** Display data of a candidate. External candidates: pseudonymous id, displayName null unless open. */
export interface CandidateSummary {
  id: string;
  pool: CandidatePool;
  displayName: string | null;
  baseLocation: string | null;
  yearsExperience: number | null;
  /**
   * v1.8 card declarations (`get_requirement_candidate_passports`, same visibility and pseudonym
   * rules as the pool). Absent where no card shows them (applications) or from older functions.
   */
  passport?: CandidatePassport | null;
}

export interface EvaluatedCandidate {
  candidate: CandidateSummary;
  match: MatchResult;
}

export interface HealthResponse {
  status: "ok";
  time: string;
}

export interface WorkRequirementResponse {
  requirement: WorkRequirement;
}

export interface WorkRequirementListResponse {
  requirements: WorkRequirement[];
  /** Rows matching the filters across all pages (absent from functions older than W5-02). */
  total?: number;
}

export interface CapacityResponse {
  requirementId: string;
  capacity: CapacityResult;
  internal: EvaluatedCandidate[];
}

/**
 * How complete the external evaluation is (get_requirement_external_pool_summary). `prefiltered`:
 * external professionals holding at least one required qualification; `hardEligible`: those who
 * pass every hard filter (selected first); `cap`: maximum evaluated per request. Counts only.
 */
export interface ExternalPoolCoverage {
  prefiltered: number;
  hardEligible: number;
  cap: number;
}

export interface MatchingResponse {
  requirementId: string;
  summary: { evaluated: number; eligible: number; pool: ExternalPoolCoverage };
  candidates: EvaluatedCandidate[];
}

/**
 * The builder's live count (v2-13, `POST /matching-evaluate` with `viableCandidatesInput`; T-66): internal members
 * and visible professionals who pass the hard filters for the form's period. A count only, never identities.
 */
export interface ViableCandidatesResponse {
  viable: number;
}

export interface AvailabilityWindow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AvailabilityStatus;
  updatedAt: string;
}

export interface AvailabilityRotation {
  pattern: Rotation;
  /** `YYYY-MM-DD` (UTC), day 1 of the cycle. */
  anchor: string;
  customCycle: CycleDay[];
}

export interface AvailabilityListResponse {
  windows: AvailabilityWindow[];
  /** The generator's saved pattern; private to the owner. `null` until one is saved. */
  rotation: AvailabilityRotation | null;
  /**
   * Fingerprint of the caller's calendar; send it back as `expectedVersion` when saving days.
   * Absent from backends older than migration 20261021120000 (then saves are not checked).
   */
  version?: string;
}

export interface AvailabilityWindowResponse {
  window: AvailabilityWindow;
}

export interface AvailabilityDaysResponse {
  /** Id of the applied change set (the same on an idempotent replay). */
  changeId: string;
  replayed: boolean;
}

export interface AvailabilityDeleteResponse {
  deleted: true;
  id: string;
}

/**
 * Document wallet (`professional-documents`, D-10, LOCAL ONLY). Owner-only: no organization,
 * manager or platform-admin access. Never carries the storage path or a persistent URL.
 */
export interface ProfessionalDocument {
  id: string;
  kind: DocumentKind;
  title: string;
  /** Sniffed from the uploaded bytes, never the client-declared type. */
  mimeType: DocumentMime;
  sizeBytes: number;
  /** Lower-case hex SHA-256 of the stored bytes. */
  sha256: string;
  /** YYYY-MM-DD. */
  expiresAt: string | null;
  /** One of the owner's own qualifications. */
  qualificationId: string | null;
  scanStatus: DocumentScanStatus;
  /** In the trash since (ISO, database clock); null = in the wallet (N-19). */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  /**
   * One view (`?view=`, default the wallet), at most 200: the wallet newest first, the trash most
   * recently archived first.
   */
  documents: ProfessionalDocument[];
  /** How long an archived document stays restorable before it is purged (T-100, a database setting). */
  trashRetentionDays: number;
  /** Both views in full: tells the UI the trash size and when a list was cut at 200. */
  counts: { active: number; trash: number };
}

export interface DocumentResponse {
  document: ProfessionalDocument;
}

/** Short-lived signed URL (60 s). Never store it; ask again for each view. */
export interface DocumentUrlResponse {
  url: string;
  expiresInSeconds: number;
}

export interface DocumentDeleteResponse {
  deleted: true;
  id: string;
}

/**
 * Personal logbook (`professional-logbook`, M14/N-12, LOCAL ONLY). Owner-only and self-declared: no
 * organization, manager or platform-admin access; never an official record.
 */
export interface LogbookEntry {
  id: string;
  /** YYYY-MM-DD, never after today in Madrid (BR-17). */
  entryDate: string;
  aircraft: string;
  /** ATA chapter, free text ≤ 10. */
  ata: string | null;
  /** 0–24 in steps of 0.1. */
  hours: number;
  category: LogbookCategory;
  environment: LogbookEnvironment;
  description: string;
  /**
   * «Seleccionable para expediente»: when the professional applies, the selected, active entries are copied
   * into that application's Candidate Pack copy (v2-04, T-112; BR-25). Nothing else reads it.
   */
  cvRelevant: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LogbookListResponse {
  entries: LogbookEntry[];
  /** Entries in this view; more than `entries.length` when the list was cut at `limit`. */
  total: number;
}

export interface LogbookEntryResponse {
  entry: LogbookEntry;
}

export interface LogbookDeleteResponse {
  deleted: true;
  id: string;
}

/**
 * The whole passport as the owner edits it: V0 fields, v1.8 declarations and the owner-only data
 * (phone, employer, rate, blocks — never returned to anyone else). Same keys as the PATCH body.
 */
export type ProfessionalPassport = ProfessionalProfile & PassportDeclarations & PassportPrivate;

/** An organization the professional can name as employer or block (`list_blockable_organizations`). */
export interface OrganizationOption {
  id: string;
  name: string;
}

export interface ProfessionalProfileResponse {
  profile: ProfessionalPassport & { updatedAt: string };
  /** Organizations for «Empresa actual» and «Organizaciones bloqueadas», by name. */
  organizations: OrganizationOption[];
}

/** A qualification declared by the professional. `verificationStatus` is read-only for them. */
export interface Qualification {
  id: string;
  type: QualificationType;
  status: QualificationStatus;
  /** Calendar dates `YYYY-MM-DD` or null. */
  issuedAt: string | null;
  expiresAt: string | null;
  verificationStatus: VerificationStatus;
  /** Reviewer's reason (phase 6); always set for rejections. */
  reviewNote: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface QualificationListResponse {
  qualifications: Qualification[];
}

export interface QualificationResponse {
  qualification: Qualification;
}

export interface QualificationDeleteResponse {
  deleted: true;
  id: string;
}

export interface PreferencesResponse {
  preferences: { locale: Locale | null; updatedAt: string };
}

/** Platform-admin review queue (`qualification-reviews`, phase 6). Minimal data: no e-mail, no documents. */
export interface ReviewQueueItem {
  id: string;
  professional: {
    id: string;
    displayName: string;
    baseLocation: string | null;
    /** Declared general restrictions (N-02), shown to the reviewer as v1.8 did (ADM-03 #9); null when none. */
    restrictions: string | null;
  };
  type: { code: string; name: string; category: QualificationCategory };
  issuedAt: string | null;
  expiresAt: string | null;
  declaredAt: string;
  /** Version the decision is about (sent back as `expectedUpdatedAt`). */
  updatedAt: string;
}

export interface ReviewHistoryItem {
  qualificationId: string;
  reviewerId: string | null;
  decision: "verified" | "rejected";
  noteProvided: boolean;
  requestId: string | null;
  at: string;
}

export interface ReviewQueueResponse {
  pending: ReviewQueueItem[];
  recent: ReviewHistoryItem[];
}

export interface ReviewDecisionResponse {
  qualification: { id: string; verificationStatus: VerificationStatus; reviewedAt: string };
}

/**
 * The organization's own data («Organización», `organization-profile`; OD-5 default = v1.8, LOCAL
 * `20261023500100`). Read by every member; written by its admin. The review evidence never leaves
 * the platform side.
 */
export interface OrganizationProfile {
  id: string;
  name: string;
  type: OrganizationType;
  /** ISO 3166-1 alpha-2; the screen offers the 27 EU countries (OD-6 default). */
  country: string | null;
  taxId: string | null;
  taxAddress: string | null;
  reviewStatus: OrganizationReviewStatus;
  reviewedAt: string | null;
  /** Version the save is about (sent back as `expectedUpdatedAt`). */
  updatedAt: string;
}

/** «Actividad de esta organización» (v1.8 ORG-07 #12): the action code and when. No ids, no metadata. */
export interface OrganizationActivityItem {
  action: string;
  at: string;
}

export interface OrganizationProfileResponse {
  organization: OrganizationProfile;
  /** The caller is the organization's admin (role read from the database). */
  canEdit: boolean;
  /** Last 15 events of the organization's own audit trail; admins only (RLS), null otherwise. */
  activity: OrganizationActivityItem[] | null;
}

/** Platform-admin list (`organization-reviews`): the data under review, never members or people. */
export interface OrganizationReviewItem extends OrganizationProfile {
  /** The reviewer belongs to this organization: they may not review it. */
  ownOrganization: boolean;
}

export interface OrganizationReviewListResponse {
  organizations: OrganizationReviewItem[];
}

export interface OrganizationReviewResponse {
  organization: { id: string; reviewStatus: OrganizationReviewStatus; reviewedAt: string };
}

/** Platform figures (`get_platform_summary`, read by the Next.js server; counts only, no money). */
export interface PlatformSummary {
  technicians: number;
  organizations: number;
  activeRequirements: number;
  workingNow: number;
  aogWithVacancies: number;
  /** Seats still to fill per hard licence code (null = no licence required), most first. */
  demand: { code: string | null; seats: number }[];
}

/** One audit row as stored: ids, codes and flags only (S-9). */
export interface AuditEventItem {
  id: string;
  at: string;
  action: string;
  actorId: string | null;
  organizationId: string | null;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
}

/**
 * `documents-maintenance` (platform admin, LOCAL ONLY, not deployed): orphan reconciliation and
 * purge of tombstoned objects. Ids and counts only — never titles; paths never leave the function.
 */
export interface DocumentsMaintenanceResponse {
  mode: "dry-run" | "apply";
  /** Objects with no row and no tombstone, older than the orphan grace. */
  orphans: number;
  /** Archived documents past the trash retention (N-19): listed (dry-run) or deleted (apply). */
  expired: number;
  /** Tombstones due for purge (dry-run) or processed (apply). */
  due: { tombstoneId: string; reason: string }[];
  /** Apply only. */
  purged: number;
  absent: number;
  skipped: { tombstoneId: string; why: string }[];
  failed: number;
}

// --- M07 opportunities (D-12) and M08 applications (D-06), owner 2026-10-22 -------------------------

/**
 * What a professional may see of a published requirement (D-12): the fixed projection of
 * `list_opportunities` — organization NAME only, no ids of people, no counts of other applicants — plus
 * its v1.8 profile requirements (`get_requirement_profile_rules`, package matching-v18). The rules are
 * optional: a frozen proposal copy and older functions do not carry them.
 */
export interface OpportunityRequirement extends RequirementProfileRules {
  id: string;
  organizationName: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  shift: Shift;
  headcount: number;
  urgency: Urgency;
  createdAt: string;
  qualifications: RequiredQualification[];
  // Requirement builder terms (LOCAL 20261023600000), part of the fixed projection and of every proposal
  // version written since (R-08). Optional: absent from older functions and older proposals; null = not stated.
  country?: EuCountry | null;
  timeZone?: RequirementTimeZone | null;
  description?: string | null;
  shifts?: RequirementShift[] | null;
  conditions?: RequirementConditions | null;
  /**
   * Recruiter (BR-27, LOCAL 20261024500100): the client a staffing agency publishes for — «Publicada por {org} para el
   * cliente {cliente}», named in the consent (the professional must know who receives the data). Opportunities list
   * it only while the representation is active (T-134); application cards name it as recorded, also after a
   * revocation (LOCAL 20261027200000, T-169). Optional: absent from older functions; null = no client.
   */
  clientName?: string | null;
}

export interface Opportunity {
  requirement: OpportunityRequirement;
  /** The caller's own eligibility (shared engine), whatever their visibility; never a ranking. */
  match: MatchResult;
  /** The caller's latest application to this requirement, if any. */
  myApplication: { id: string; status: ApplicationStatus } | null;
  /** Why «Presentar candidatura» is unavailable now; null = may apply. */
  applyBlocker: ApplyBlocker | null;
  /**
   * v1.8 «Posible en descanso» (BR-14.1): only availability stops the caller from applying, and
   * publishing their rest days (no window) as available would cover the period. Optional: an older
   * function does not send it (= false).
   */
  possibleOnRest?: boolean;
}

export interface OpportunityListResponse {
  opportunities: Opportunity[];
  /** Matches of the filters across all pages. */
  total: number;
  /** Published requirements considered (the function evaluates at most `cap` of them). */
  considered: number;
  cap: number;
}

export interface OpportunityResponse {
  opportunity: Opportunity;
}

/** One step of an application's history, readable by both parties (no free text, no person ids). */
export interface ApplicationEvent {
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  actor: ApplicationActor;
  at: string;
  /** Proposal version created or accepted by this step. */
  proposalVersion: number | null;
}

/** R-08: an immutable snapshot of the requirement's published terms (T-11), version n per application. */
export interface ApplicationProposal {
  id: string;
  version: number;
  createdAt: string;
  terms: Omit<OpportunityRequirement, "id" | "createdAt">;
}

interface ApplicationBase {
  id: string;
  requirementId: string;
  status: ApplicationStatus;
  createdAt: string;
  /** Optimistic version: send it back as `expectedUpdatedAt` (ms precision). */
  updatedAt: string;
  /** Reject/cancel reason (T-10: visible to both parties). */
  reason: string | null;
  currentProposal: ApplicationProposal | null;
  acceptedProposalId: string | null;
  history: ApplicationEvent[];
}

/** The technician's view of their own application. */
export interface MyApplication extends ApplicationBase {
  requirement: OpportunityRequirement & { status: RequirementStatus };
  match: MatchResult;
}

/** The organization's view: the applicant as the candidate pool shows them (pseudonym rules, T-04). */
export interface OrgApplication extends ApplicationBase {
  candidate: CandidateSummary;
  match: MatchResult;
}

export interface MyApplicationListResponse {
  applications: MyApplication[];
}

export interface RequirementApplicationsResponse {
  requirementId: string;
  applications: OrgApplication[];
}

/** Dashboard counters for one organization: applications per status over its requirements. */
export interface ApplicationCountsResponse {
  counts: Partial<Record<ApplicationStatus, number>>;
}

/**
 * v2-05: one application of the organization, with the requirement it answers. `candidate` and `match`
 * are null when the technician closed the account (the application, its seat and history stay).
 */
export interface OrganizationApplication extends ApplicationBase {
  candidate: CandidateSummary | null;
  match: MatchResult | null;
  requirement: OpportunityRequirement & { status: RequirementStatus };
}

/** v2-05 «Candidaturas» of the organization (admin/manager), newest first. */
export interface OrganizationApplicationsResponse {
  applications: OrganizationApplication[];
  /** Applications matching the filters (requirement, status) across all pages. */
  total: number;
}

/** v2-05 tabs / v2-08 coverage: applications per status of each requirement that received any. */
export interface RequirementApplicationCountsResponse {
  requirements: {
    requirementId: string;
    headcount: number;
    startsAt: string;
    endsAt: string;
    /** Number of shifts (v2-09); null = one continuous period. */
    shiftCount: number | null;
    counts: Partial<Record<ApplicationStatus, number>>;
  }[];
}

/** v2-20 «Ofertas en la red» (organization members): the published projection, no eligibility. */
export interface NetworkOpportunityListResponse {
  opportunities: OpportunityRequirement[];
  total: number;
  considered: number;
  cap: number;
}

export interface NetworkOpportunityResponse {
  requirement: OpportunityRequirement;
}

export interface ApplicationResponse {
  application: MyApplication;
}

export interface ApplicationTransitionResponse {
  transition: {
    applicationId: string;
    status: ApplicationStatus;
    updatedAt: string;
    proposalId: string | null;
  };
  replayed: boolean;
}

/**
 * The Candidate Pack copy (v2-15 + v2-04, BR-25): the professional's technical profile frozen when they
 * applied (`get_application_pack`), or what it would be now (`get_my_candidate_pack_preview`). Never
 * identity, contact, employer, blocked organizations or documents (D-07, `PACK_ACTIVATION` off).
 */
export interface CandidatePackCopy {
  /** The application this copy belongs to; null for the preview. */
  applicationId: string | null;
  /** When the copy was frozen (the preview: the moment it was read). */
  copiedAt: string;
  primaryCategory: ProfessionalCategory | null;
  categories: ProfessionalCategory[];
  yearsExperience: number | null;
  englishLevel: EnglishLevel | null;
  baseLocation: string | null;
  baseCountry: EuCountry | null;
  aircraft: Aircraft[];
  engines: Engine[];
  skills: Skill[];
  workPermits: EuCountry[];
  generalRestrictions: string | null;
  /** v1.8 «Mínimo declarado» (T-111: shown to this organization only, previewed before the consent). */
  minRate: { amount: number; unit: RateUnit } | null;
  typeRatings: TypeRating[];
  qualifications: PackQualification[];
  /** Logbook entries marked «Seleccionable para expediente» (≤ 20, newest first, T-112). */
  experience: PackExperience[];
}

/** `GET /applications?view=pack&applicationId=`: null = this application has no copy (withdrawn, or older). */
export interface ApplicationPackResponse {
  pack: CandidatePackCopy | null;
}

/** `GET /applications?view=pack-preview`: the caller's copy as it would be frozen now. */
export interface CandidatePackPreviewResponse {
  pack: CandidatePackCopy;
}

// --- In-app notices («Avisos internos», v2-18; SCOPE-2 LATER, migration 20261023800000) -------------

/**
 * One notice as its recipient reads it, rendered by the database at read time from the kind and the
 * ids (no stored text). Technician side: the requirement and its organization's name, as «Mis
 * candidaturas» shows them. Organization side: the applicant under the candidate pool's rules (T-04):
 * `candidate.name` for internal members or `open` visibility, otherwise `candidate.ref` = `CF-…`.
 */
export interface Notice {
  id: string;
  kind: NoticeKind;
  audience: NoticeAudience;
  createdAt: string;
  readAt: string | null;
  /** Null for an `outreach` notice (about a requirement, v2-17) and for a `training` one. */
  applicationId: string | null;
  /** Null for a `training` notice (ADR-003). */
  requirementId: string | null;
  requirementTitle: string | null;
  /** Technician side only. */
  organizationName: string | null;
  /** `application`: the status the application reached (`received` = a new application). */
  applicationStatus: ApplicationStatus | null;
  /** `requirement`: paused, resumed (open) or closed. */
  requirementStatus: NoticeRequirementStatus | null;
  /** Organization side only. */
  candidate: { name: string | null; ref: string | null } | null;
  /** `outreach`: the urgency it was distributed for («Urgente» / «AOG»); null otherwise. */
  outreachUrgency: OutreachUrgency | null;
  /** `training` (ADR-003, V19-031): what it is about and the status reached; null for other kinds. */
  training: TrainingNotice | null;
}

/** A `training` notice: a request event (either side) or a review decision (provider side). */
export interface TrainingNotice {
  subject: TrainingNoticeSubject;
  requestId: string | null;
  courseId: string | null;
  editionId: string | null;
  organizationId: string | null;
  /** The status reached (request, listing or provider status, by `subject`). */
  status: string;
  /** Course title, or the provider name for a provider review. */
  title: string | null;
}

export interface NoticeListResponse {
  notices: Notice[];
  /** The caller's notices across pages (retention: 180 days, T-71). */
  total: number;
  unread: number;
}

/** The shell's bell. */
export interface NoticeCountResponse {
  unread: number;
}

export interface NoticeReadResponse {
  /** Notices matched: one id → 1 (already read included); all → how many were unread. */
  marked: number;
  unread: number;
  /** `{ id }`: the notice as the list shows it (the server derives its link from it). */
  notice: Notice | null;
}

// --- PKG account: own data export, account closure (M-3 default) and invitations (OD-8 default) ----

/** One own record as the database returned it: only the columns the export selects, names kept. */
export type ExportRecord = Record<string, unknown>;

/** A wallet document in the export: its metadata and, while under the size cap, its bytes (base64). */
export interface ExportedDocument extends ProfessionalDocument {
  contentBase64: string | null;
}

/**
 * «Exportar mis datos y archivos» (`account` GET): the caller's own records only — no other person's
 * data, no audit trail (v1.8 B §5.10). `professional` is null for organization accounts.
 */
export interface AccountExport {
  format: "crewflex-account-export/1";
  exportedAt: string;
  account: {
    id: string;
    email: string | null;
    displayName: string;
    accountType: "professional" | "organization";
    platformRole: "user" | "platform_admin";
    preferredLocale: Locale | null;
    createdAt: string;
  };
  memberships: ExportRecord[];
  professional: {
    profile: ExportRecord;
    qualifications: ExportRecord[];
    reviewNotes: ExportRecord[];
    availability: ExportRecord[];
    rotation: ExportRecord | null;
    applications: ExportRecord[];
    /** Passport declarations (owner-only parts included: they are the caller's own). */
    typeRatings: ExportRecord[];
    privateDetails: ExportRecord | null;
    organizationBlocks: ExportRecord[];
    logbook: ExportRecord[];
    /** The Candidate Pack copies frozen with own applications (`get_my_application_packs`, v2-15). */
    candidatePacks: ExportRecord[];
    /** «Avisos de oportunidades» (PKG outreach, N-10); null while never saved. */
    noticePreferences: ExportRecord | null;
  } | null;
  /** Own training requests (offers, history, messages) and favourites (`export_my_training`, V19-037). */
  training: { requests: ExportRecord[]; favorites: ExportRecord[] };
  requirementsCreated: ExportRecord[];
  documents: ExportedDocument[];
  /** Documents listed without their bytes (over the size cap): download them from «Documentos». */
  filesOmitted: number;
}

export interface AccountExportResponse {
  export: AccountExport;
}

/** «Cerrar cuenta» (`account` DELETE). `filesPending` objects are purged later by documents-maintenance. */
export interface AccountCloseResponse {
  closed: true;
  filesRemoved: number;
  filesPending: number;
}

/** What the platform admin sees of an invitation: never its code. */
export interface Invitation {
  id: string;
  email: string;
  accountType: "professional" | "organization";
  expiresAt: string;
}

export interface InvitationResponse {
  invitation: Invitation;
}

// --- Recruiter: represented clients (D-12 provisional, LOCAL 20261024500000; BR-27) ------------------------------

/** A client in an agency's portfolio (v1.8 «Cartera de clientes»), as the agency's members read it. */
export interface RepresentedClient {
  id: string;
  organizationId: string;
  name: string;
  contactEmail: string | null;
  status: RepresentationStatus;
  createdAt: string;
  activatedAt: string | null;
  revokedAt: string | null;
}

export interface RepresentedClientListResponse {
  clients: RepresentedClient[];
}

export interface RepresentedClientResponse {
  client: Pick<RepresentedClient, "id" | "status">;
}

/** A representation as a platform admin reviews it: the agency's name, and whether the reviewer belongs to it. */
export interface RepresentationReviewItem extends RepresentedClient {
  agencyName: string;
  /** The reviewer is a member of the agency: they may not activate it (BR-20 rule). */
  ownAgency: boolean;
}

export interface RepresentationReviewListResponse {
  clients: RepresentationReviewItem[];
}

// --- Urgent/AOG outreach and notice preferences (package outreach, v2-17 / N-10; BR-26) -----------------

/** The caller's own notice preferences (`notice-preferences`); `updatedAt` null = never saved. */
export interface NoticePreferencesResponse {
  preferences: NoticePreferences & { updatedAt: string | null };
}

/**
 * The one distribution of a requirement, as its admins/managers see it: the urgency it was sent for,
 * when and HOW MANY in-app notices it created — never who received them.
 */
export interface OutreachDistribution {
  requirementId: string;
  urgency: OutreachUrgency;
  /** Null = not reported: fewer than `OUTREACH_REPORT_MIN` eligible professionals (T-128). */
  notified: number | null;
  distributedAt: string;
}

/** GET `requirement-outreach?requirementId=`; null = not distributed yet. */
export interface OutreachStatusResponse {
  distribution: OutreachDistribution | null;
}

/** POST `requirement-outreach` (201). */
export interface OutreachDistributeResponse {
  distribution: OutreachDistribution;
}

/**
 * One row of «Buscar candidatos» (package directory, BR-28): the per-organization pseudonym (T-151), the name
 * only when the professional is `open`, base, declared years and the passport card as declarations
 * (engines, capabilities and type ratings always empty — T-85/T-153). Never contact, employer, rate, blocks,
 * documents, qualifications or restriction text.
 */
export interface DirectoryCandidate {
  ref: string;
  displayName: string | null;
  baseLocation: string | null;
  yearsExperience: number | null;
  declarations: CandidateDeclarations;
}

/** GET `candidate-directory?organizationId=&…filters&page=` (admin/manager). `total` counts visible rows only. */
export interface DirectorySearchResponse {
  candidates: DirectoryCandidate[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Training «Formación» (ADR-003, LOCAL 20261029100000…100400; BR-30; V19-008…037) ---------------------------

/** A live session as both sides read it (instants; shown in the edition's zone). */
export interface TrainingSession {
  id: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  element: TrainingSessionElement;
}

/** One edition / convocatoria. `remaining` = capacity − confirmed seats (the catalog shows it, as v1.9). */
export interface TrainingEdition {
  id: string;
  courseId: string;
  mode: TrainingMode;
  provisional: boolean;
  deadline: string | null;
  capacity: number;
  remaining: number;
  city: string | null;
  country: string | null;
  currency: TrainingCurrency;
  priceUnit: TrainingPriceUnit;
  /** Per unit, integer cents; null for `quote`. */
  priceCents: number | null;
  priceIncludes: string;
  policy: string;
  timeZone: string;
  status: TrainingListingStatus;
  startsAt: string | null;
  endsAt: string | null;
  sessions: TrainingSession[];
  createdAt: string;
  updatedAt: string;
  /** Provider / admin reads only. */
  reviewNote?: string | null;
  cancelReason?: string | null;
  reviewedAt?: string | null;
}

export interface TrainingCourse {
  id: string;
  organizationId: string;
  title: string;
  family: TrainingFamily;
  description: string;
  aircraft: string | null;
  engine: string | null;
  category: string | null;
  language: string;
  prerequisites: string | null;
  syllabus: string | null;
  certificateInfo: string;
  issuer: string;
  scope: TrainingScope;
  approvalRef: string | null;
  status: TrainingListingStatus;
  providerName: string;
  providerStatus: TrainingProviderStatus;
  createdAt: string;
  updatedAt: string;
  /** Provider / admin reads only. */
  reviewNote?: string | null;
  reviewedAt?: string | null;
}

/** GET `training?view=catalog` (signed-in users; 12 per page). Only published editions are listed. */
export interface TrainingCatalogResponse {
  courses: (TrainingCourse & { editions: TrainingEdition[] })[];
  total: number;
}

/** GET `training?view=course&id=`: the live course (or any state for its provider / admins). */
export interface TrainingCourseResponse {
  course: TrainingCourse & {
    editions: TrainingEdition[];
    provider: { name: string; description: string; website: string | null } | null;
    favorite: boolean;
    myRequests: {
      id: string;
      kind: TrainingRequestKind;
      status: TrainingRequestStatus;
      editionId: string | null;
    }[];
  };
}

export interface TrainingFavoritesResponse {
  courses: TrainingCourse[];
}

/** An immutable offer version (R-08): the frozen terms the professional accepts. */
export interface TrainingOffer {
  id: string;
  version: number;
  terms: Record<string, unknown>;
  totalCents: number | null;
  currency: TrainingCurrency;
  createdAt: string;
}

export interface TrainingRequestEvent {
  from: TrainingRequestStatus | null;
  to: TrainingRequestStatus;
  actor: "professional" | "provider" | "system";
  at: string;
  offerVersion: number | null;
}

/** One request as both parties read it. No e-mail, no profile id of the other party (N-5). */
export interface TrainingRequest {
  id: string;
  kind: TrainingRequestKind;
  status: TrainingRequestStatus;
  courseId: string;
  editionId: string | null;
  organizationId: string;
  applicantName: string;
  note: string | null;
  units: number;
  reason: string | null;
  outcome: TrainingOutcome | null;
  currentOffer: TrainingOffer | null;
  acceptedOfferId: string | null;
  history: TrainingRequestEvent[];
  courseTitle: string;
  providerName: string;
  edition: TrainingEdition | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingRequestsResponse {
  requests: TrainingRequest[];
}

/** GET `training?view=inbox&organizationId=` (admin/manager), paginated. */
export interface TrainingInboxResponse {
  requests: TrainingRequest[];
  total: number;
}

export interface TrainingProvider {
  organizationId: string;
  name: string;
  description: string;
  website: string | null;
  status: TrainingProviderStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET `training?view=workspace&organizationId=`: the provider's own profile, courses and editions. */
export interface TrainingWorkspaceResponse {
  provider: TrainingProvider | null;
  courses: (TrainingCourse & { editions: TrainingEdition[] })[];
}

/**
 * GET `training?view=review-queue` (platform admin): what awaits a decision, oldest first.
 * `submittedAt` = the last submission (a resubmission moves it), not the creation.
 */
export type TrainingReviewItem = {
  id: string;
  organizationId: string;
  organizationName: string;
  updatedAt: string;
  submittedAt: string;
} & (
  | {
      kind: "provider";
      item: Pick<TrainingProvider, "name" | "description" | "website" | "status">;
    }
  | { kind: "course"; item: TrainingCourse }
  | {
      kind: "edition";
      item: TrainingEdition & { courseTitle: string; courseStatus: TrainingListingStatus };
    }
);

export interface TrainingReviewQueueResponse {
  items: TrainingReviewItem[];
  total: number;
}

export interface TrainingMessage {
  id: string;
  senderSide: "professional" | "provider";
  mine: boolean;
  body: string;
  createdAt: string;
}

export interface TrainingMessagesResponse {
  messages: TrainingMessage[];
}

/** GET `training?view=sessions&from=&to=`: the caller's confirmed sessions (calendar «F», iCalendar). */
export interface TrainingCommitment {
  requestId: string;
  editionId: string;
  sessionId: string;
  courseTitle: string;
  providerName: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: string | null;
  element: TrainingSessionElement;
  mode: TrainingMode;
  city: string | null;
  status: TrainingRequestStatus;
}

export interface TrainingSessionsResponse {
  sessions: TrainingCommitment[];
}

/** POST `training` results, by `op`. Writes echo the row's new version (`updatedAt`). */
export interface TrainingSavedResponse {
  id: string;
  status: string;
  updatedAt: string;
  /** `op: edition` only. */
  sessionCount?: number;
  /** `op: listing` cancel only. */
  requestsCancelled?: number;
}

export interface TrainingFavoriteResponse {
  courseId: string;
  saved: boolean;
}

export interface TrainingRequestResponse {
  request: TrainingRequest;
  replayed: boolean;
}

export interface TrainingTransitionResponse {
  transition: {
    requestId: string;
    status: TrainingRequestStatus;
    updatedAt: string;
    offerId: string | null;
  };
  replayed: boolean;
}

export interface TrainingMessageResponse {
  id: string;
  replayed: boolean;
}

/** `reason` of a 409 from the training RPCs (`TRAINING_CONFLICTS`). */
export type TrainingConflictReason = TrainingConflict;
