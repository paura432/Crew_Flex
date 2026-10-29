// Training («Formación», CrewFlex v1.9; ADR-003; BUSINESS_RULES BR-30). Pure: no I/O, no framework
// imports. Shared by Next.js and the `training` Edge Function. The database is the authority
// (migrations 20261029100100…100400): this module mirrors its transition table
// (`app_private.training_transitions`, compared by tests/db/training.test.ts), names the vocabulary the
// UI and the API share, and holds the price arithmetic and the edition/session validation the Zod schema
// and the SQL both apply. Derived from v1.9 `src/features/training/trainingModel.js` and
// `server/training.mjs`.

export const TRAINING_FAMILIES = [
  "type",
  "engines",
  "safety",
  "specialties",
  "systems",
  "quality",
  "language",
  "basic",
  "other",
] as const;
export type TrainingFamily = (typeof TRAINING_FAMILIES)[number];

export const TRAINING_SCOPES = ["general", "part147", "direct"] as const;
export type TrainingScope = (typeof TRAINING_SCOPES)[number];

export const TRAINING_MODES = ["onsite", "live", "mixed", "selfpaced"] as const;
export type TrainingMode = (typeof TRAINING_MODES)[number];

export const TRAINING_PRICE_UNITS = ["person", "engine", "module", "quote"] as const;
export type TrainingPriceUnit = (typeof TRAINING_PRICE_UNITS)[number];

export const TRAINING_CURRENCIES = ["EUR", "GBP", "CHF", "USD"] as const;
export type TrainingCurrency = (typeof TRAINING_CURRENCIES)[number];

export const TRAINING_SESSION_ELEMENTS = ["theory", "practical", "assessment"] as const;
export type TrainingSessionElement = (typeof TRAINING_SESSION_ELEMENTS)[number];

export const TRAINING_PROVIDER_STATUSES = ["pending", "reviewed", "rejected", "suspended"] as const;
export type TrainingProviderStatus = (typeof TRAINING_PROVIDER_STATUSES)[number];

/** Courses never reach `cancelled` (table CHECK); editions do. */
export const TRAINING_LISTING_STATUSES = [
  "draft",
  "submitted",
  "published",
  "changes",
  "rejected",
  "suspended",
  "cancelled",
] as const;
export type TrainingListingStatus = (typeof TRAINING_LISTING_STATUSES)[number];

export const TRAINING_REQUEST_KINDS = ["inquiry", "seat"] as const;
export type TrainingRequestKind = (typeof TRAINING_REQUEST_KINDS)[number];

export const TRAINING_REQUEST_STATUSES = [
  "received",
  "waitlisted",
  "offered",
  "accepted",
  "confirmed",
  "finished",
  "withdrawn",
  "rejected",
  "cancelled",
  "closed",
] as const;
export type TrainingRequestStatus = (typeof TRAINING_REQUEST_STATUSES)[number];

/** v1.9 «Completado según proveedor / Asistencia declarada / Ausencia declarada» (the provider's word). */
export const TRAINING_OUTCOMES = ["completed", "attended", "no_show"] as const;
export type TrainingOutcome = (typeof TRAINING_OUTCOMES)[number];

/** Admin decisions (`review_training`): providers and listings have different favourable words. */
export const TRAINING_PROVIDER_DECISIONS = ["reviewed", "rejected", "suspended"] as const;
export const TRAINING_LISTING_DECISIONS = [
  "published",
  "changes",
  "rejected",
  "suspended",
] as const;
export const TRAINING_REVIEW_KINDS = ["provider", "course", "edition"] as const;
export type TrainingReviewKind = (typeof TRAINING_REVIEW_KINDS)[number];

/** Who acts — from the JWT: `professional` = the requester; `provider` = admin/manager of the organization. */
export type TrainingActor = "professional" | "provider" | "system";

export interface TrainingTransition {
  from: TrainingRequestStatus;
  to: TrainingRequestStatus;
  actor: TrainingActor;
  /** A 1–2000 character reason is required (reject, cancel). */
  reason?: true;
}

/**
 * = `app_private.training_transitions` (migration 20261029100100). `system` rows are written only when
 * an edition is cancelled; inquiries may only be closed, rejected or withdrawn (the RPC enforces it);
 * seats are never `closed`.
 */
export const TRAINING_TRANSITIONS: readonly TrainingTransition[] = [
  { from: "received", to: "waitlisted", actor: "provider" },
  { from: "received", to: "offered", actor: "provider" },
  { from: "received", to: "rejected", actor: "provider", reason: true },
  { from: "received", to: "closed", actor: "provider" },
  { from: "received", to: "withdrawn", actor: "professional" },
  { from: "waitlisted", to: "offered", actor: "provider" },
  { from: "waitlisted", to: "rejected", actor: "provider", reason: true },
  { from: "waitlisted", to: "withdrawn", actor: "professional" },
  { from: "offered", to: "offered", actor: "provider" }, // a new offer version (R-08)
  { from: "offered", to: "accepted", actor: "professional" }, // current offer id + explicit acceptance
  { from: "offered", to: "waitlisted", actor: "provider" },
  { from: "offered", to: "rejected", actor: "provider", reason: true },
  { from: "offered", to: "withdrawn", actor: "professional" },
  { from: "accepted", to: "offered", actor: "provider" }, // terms changed: a new version to accept
  { from: "accepted", to: "confirmed", actor: "provider" }, // transactional seat (capacity + overlaps)
  { from: "accepted", to: "waitlisted", actor: "provider" },
  { from: "accepted", to: "rejected", actor: "provider", reason: true },
  { from: "accepted", to: "withdrawn", actor: "professional" },
  { from: "confirmed", to: "cancelled", actor: "professional", reason: true },
  { from: "confirmed", to: "cancelled", actor: "provider", reason: true },
  { from: "confirmed", to: "finished", actor: "provider" }, // after the last session; outcome required
  { from: "received", to: "cancelled", actor: "system", reason: true },
  { from: "waitlisted", to: "cancelled", actor: "system", reason: true },
  { from: "offered", to: "cancelled", actor: "system", reason: true },
  { from: "accepted", to: "cancelled", actor: "system", reason: true },
  { from: "confirmed", to: "cancelled", actor: "system", reason: true },
];

export const ACTIVE_TRAINING_REQUEST_STATUSES: readonly TrainingRequestStatus[] = [
  "received",
  "waitlisted",
  "offered",
  "accepted",
  "confirmed",
];

export const TERMINAL_TRAINING_REQUEST_STATUSES: readonly TrainingRequestStatus[] = [
  "finished",
  "withdrawn",
  "rejected",
  "cancelled",
  "closed",
];

/** Transitions an inquiry may take (everything else is a seat's). */
export const INQUIRY_TARGETS: readonly TrainingRequestStatus[] = [
  "closed",
  "rejected",
  "withdrawn",
];

export const findTrainingTransition = (
  from: TrainingRequestStatus,
  to: TrainingRequestStatus,
  actor: TrainingActor,
) => TRAINING_TRANSITIONS.find((t) => t.from === from && t.to === to && t.actor === actor);

/** What this actor may do from this status for this kind — the buttons the UI shows (the server re-checks). */
export const availableTrainingTransitions = (
  from: TrainingRequestStatus,
  actor: TrainingActor,
  kind: TrainingRequestKind,
) =>
  TRAINING_TRANSITIONS.filter(
    (t) =>
      t.from === from &&
      t.actor === actor &&
      (kind === "inquiry" ? INQUIRY_TARGETS.includes(t.to) : t.to !== "closed"),
  );

/** i18n keys of the statuses (v1.9 TRAINING_LABELS), under `training.status.*`. */
export const TRAINING_STATUS_LABEL_KEYS: Record<
  TrainingRequestStatus | TrainingListingStatus | TrainingProviderStatus | TrainingOutcome,
  string
> = {
  draft: "draft",
  submitted: "submitted",
  published: "published",
  changes: "changes",
  suspended: "suspended",
  rejected: "rejected",
  cancelled: "cancelled",
  received: "received",
  waitlisted: "waitlisted",
  offered: "offered",
  accepted: "accepted",
  confirmed: "confirmed",
  withdrawn: "withdrawn",
  finished: "finished",
  closed: "closed",
  pending: "pending",
  reviewed: "reviewed",
  completed: "completed",
  attended: "attended",
  no_show: "noShow",
};

/**
 * Stable reasons the API returns with a 409 (`reason`), one per server check. The SQL raises them as
 * SQLSTATE `CFT01`…`CFT13` in this order (`_shared/errors.ts`). Append only: the position is the code.
 */
export const TRAINING_CONFLICTS = [
  "EDITION_NOT_AVAILABLE", // CFT01: course/edition not published, provider not reviewed, dates past
  "PROVISIONAL_DATES", // CFT02: provisional dates admit inquiries only (no seat, no offer)
  "ALREADY_REQUESTED", // CFT03: an active request of this professional for this edition exists
  "OWN_ORGANIZATION", // CFT04: requesting a course of an organization the professional belongs to
  "OFFER_STALE", // CFT05: the accepted offer is not the current version (R-08)
  "TERMS_CHANGED", // CFT06: the course or edition changed since the accepted offer; send terms again
  "CAPACITY_REACHED", // CFT07: every seat is confirmed (use the waiting list)
  "OVERLAPPING_COMMITMENT", // CFT08: a session overlaps confirmed employment or another confirmed training
  "SESSIONS_NOT_ENDED", // CFT09: finish before the last session ended
  "HAS_CONFIRMED_SEATS", // CFT10: editing an edition with confirmed seats (cancel it with a reason instead)
  "PROVIDER_NOT_REVIEWED", // CFT11: publishing a course before its provider, or an edition before its course
  "ACTIVE_TRAINING_SEATS", // CFT12: closing an account with a future confirmed seat
  "CONVERSATION_CLOSED", // CFT13: a message on a withdrawn, rejected, cancelled or closed request
] as const;
export type TrainingConflict = (typeof TRAINING_CONFLICTS)[number];

// --- Money (bigint cents; no float, no payment) -------------------------------------------------

/** v1.9 `trainingPrice`: the total in integer cents, or null for «a consultar» (quote). */
export function priceCents(
  edition: { priceUnit: TrainingPriceUnit; priceCents: number | null },
  units = 1,
): number | null {
  if (edition.priceUnit === "quote" || edition.priceCents === null) return null;
  if (!Number.isInteger(units) || units < 1)
    throw new RangeError("units must be a positive integer");
  return edition.priceCents * (edition.priceUnit === "person" ? 1 : units);
}

/** Cents → "1234.56" (locale formatting is the UI's business). */
export const centsToDecimal = (cents: number) =>
  `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;

/** "1234.56" / "1234,5" → cents; null when not a non-negative amount with at most two decimals. */
export function decimalToCents(text: string): number | null {
  const m = /^\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

// --- Editions and sessions (v1.9 normalizeEdition) -------------------------------------------

export const SESSIONS_MAX = 60;
export const SESSION_MAX_HOURS = 24;
export const CAPACITY_MAX = 500;
export const UNITS_MAX = 50;
/** Price per unit, in cents (v1.9: 100 000 per unit). */
export const PRICE_CENTS_MAX = 10_000_000;
/** The agreed total of a quote, in cents (v1.9: 5 000 000). */
export const QUOTE_TOTAL_CENTS_MAX = 500_000_000;
export const CATALOG_PAGE_SIZE = 12;

export interface SessionInput {
  startsAt: string;
  endsAt: string;
}

export interface EditionShape {
  mode: TrainingMode;
  provisional: boolean;
  deadline: string | null;
  sessions: readonly SessionInput[];
}

export type EditionIssue =
  | "SESSIONS_TOO_MANY"
  | "SESSION_ORDER"
  | "SESSION_TOO_LONG"
  | "SESSIONS_OVERLAP"
  | "SELFPACED_HAS_SESSIONS"
  | "SESSIONS_REQUIRED"
  | "DEADLINE_REQUIRED"
  | "DATES_PAST";

/**
 * The edition rules the form, the Edge Function and the SQL apply alike: ≤ 60 sessions of ≤ 24 h, end
 * after start, no overlap, none for self-paced, at least one unless provisional, a deadline for
 * confirmed self-paced dates, every date ahead of `nowMs`. Returns the first issue or null.
 */
export function editionIssue(edition: EditionShape, nowMs: number): EditionIssue | null {
  if (edition.sessions.length > SESSIONS_MAX) return "SESSIONS_TOO_MANY";
  const spans = edition.sessions
    .map((s) => ({ start: Date.parse(s.startsAt), end: Date.parse(s.endsAt) }))
    .sort((a, b) => a.start - b.start);
  for (const s of spans) {
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end <= s.start)
      return "SESSION_ORDER";
    if (s.end - s.start > SESSION_MAX_HOURS * 3_600_000) return "SESSION_TOO_LONG";
  }
  for (let i = 1; i < spans.length; i++) {
    if (spans[i]!.start < spans[i - 1]!.end) return "SESSIONS_OVERLAP";
  }
  if (edition.mode === "selfpaced" && spans.length > 0) return "SELFPACED_HAS_SESSIONS";
  if (edition.mode !== "selfpaced" && !edition.provisional && spans.length === 0)
    return "SESSIONS_REQUIRED";
  const deadline = edition.deadline === null ? null : Date.parse(edition.deadline);
  if (edition.mode === "selfpaced" && !edition.provisional && deadline === null)
    return "DEADLINE_REQUIRED";
  if (spans.some((s) => s.start <= nowMs) || (deadline !== null && deadline <= nowMs))
    return "DATES_PAST";
  return null;
}

/** First start / last end of an edition (sessions, or the self-paced deadline), as ISO or null. */
export const editionStart = (e: EditionShape) =>
  e.sessions.length > 0
    ? [...e.sessions].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]!.startsAt
    : e.deadline;
export const editionEnd = (e: EditionShape) =>
  e.sessions.length > 0
    ? [...e.sessions].sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))[0]!.endsAt
    : e.deadline;

/** Hour-based overlap of two half-open instant ranges (V19-028; the SQL uses `&&` on tstzrange). */
export const spansOverlap = (a: SessionInput, b: SessionInput) =>
  Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

/** v1.9 catalog search: accents and case do not matter (the SQL folds the same way, `fold_text`). */
export const foldText = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
