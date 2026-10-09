export const QUALIFICATION_CATEGORIES = [
  "LICENSE",
  "TYPE_RATING",
  "TRAINING",
  "APPROVAL",
  "SKILL",
] as const;
export type QualificationCategory = (typeof QUALIFICATION_CATEGORIES)[number];

export const VERIFICATION_STATUSES = ["pending", "verified", "rejected", "expired"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const QUALIFICATION_STATUSES = ["active", "withdrawn"] as const;
export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

export interface QualificationType {
  id: string;
  code: string;
  name: string;
  category: QualificationCategory;
  requiresExpiry: boolean;
}

/** A qualification held by a technician (matchable data only — no documents). */
export interface HeldQualification {
  qualificationTypeId: string;
  code: string;
  status: QualificationStatus;
  verificationStatus: VerificationStatus;
  /** Calendar date `YYYY-MM-DD`, valid through the whole UTC day. `null` = no expiry. */
  expiresAt: string | null;
}

export type PeriodValidity = "valid" | "expired" | "expires_during";

function utcDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

/**
 * Validity of an expiry date for a period `[startsAt, endsAt)` (BR-2).
 * Evaluated against the requirement period, never against "today".
 */
export function validityForPeriod(
  expiresAt: string | null,
  startsAt: string,
  endsAt: string,
): PeriodValidity {
  if (expiresAt === null) return "valid";
  const firstDay = utcDate(Date.parse(startsAt));
  const lastDay = utcDate(Date.parse(endsAt) - 1);
  if (expiresAt < firstDay) return "expired";
  if (expiresAt < lastDay) return "expires_during";
  return "valid";
}
