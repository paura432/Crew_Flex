// In-app notices («Avisos internos», v2 diff v2-18 / shell #1 / N-11; SCOPE-2 LATER, local only). The
// database writes them in the transaction of the event (migration 20261023800000, technical defaults
// T-70…T-73); this module names what it writes, for the Edge Function's row parsing and the UI. Pure.
import type { RequirementStatus } from "./work-requirement.ts";

/** `application`: an application reached a status · `requirement`: its requirement was paused/resumed/closed. */
export const NOTICE_KINDS = ["application", "requirement"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/**
 * Whose side the reader is on, decided by the database at read time: `technician` = the notice is
 * about the reader's own application; `organization` = about an applicant to a requirement of an
 * organization the reader is admin/manager of.
 */
export const NOTICE_AUDIENCES = ["technician", "organization"] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number];

/** Requirement changes that notify its active applicants (T-70): paused, resumed (→ open) and closed. */
export const NOTICE_REQUIREMENT_STATUSES = [
  "paused",
  "open",
  "closed",
] as const satisfies readonly RequirementStatus[];
export type NoticeRequirementStatus = (typeof NOTICE_REQUIREMENT_STATUSES)[number];
