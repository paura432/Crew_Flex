// Typed, synthetic fixtures for domain tests. Not real people, not real organizations.
import type { HeldQualification } from "@/domain/qualification.ts";
import type { Candidate, CandidateDeclarations, MatchableRequirement } from "@/domain/matching.ts";
import type { RequiredQualification } from "@/domain/work-requirement.ts";

export const QT = {
  B11: "11111111-1111-4111-8111-000000000001",
  A320: "11111111-1111-4111-8111-000000000002",
  EWIS: "11111111-1111-4111-8111-000000000003",
  HF: "11111111-1111-4111-8111-000000000004",
  FTS: "11111111-1111-4111-8111-000000000005",
  SMS: "11111111-1111-4111-8111-000000000006",
} as const;

const CODES: Record<string, string> = {
  [QT.B11]: "B1.1",
  [QT.A320]: "TR-A320",
  [QT.EWIS]: "EWIS",
  [QT.HF]: "HF",
  [QT.FTS]: "FTS",
  [QT.SMS]: "SMS",
};

export function required(id: string, level: "hard" | "soft" = "hard"): RequiredQualification {
  return { qualificationTypeId: id, code: CODES[id] ?? id, name: CODES[id] ?? id, level };
}

/** MAD · 18–21 Oct 2026 · night · B1.1 + A320 + EWIS + HF + FTS hard, SMS soft. */
export function madRequirement(
  overrides: Partial<MatchableRequirement & { headcount: number }> = {},
) {
  return {
    location: "Madrid (MAD)",
    startsAt: "2026-10-18T20:00:00Z",
    endsAt: "2026-10-22T06:00:00Z",
    urgency: "urgent" as const, // as in the seed requirement
    headcount: 2,
    qualifications: [
      required(QT.B11),
      required(QT.A320),
      required(QT.EWIS),
      required(QT.HF),
      required(QT.FTS),
      required(QT.SMS, "soft"),
    ],
    ...overrides,
  };
}

export function held(id: string, overrides: Partial<HeldQualification> = {}): HeldQualification {
  return {
    qualificationTypeId: id,
    code: CODES[id] ?? id,
    status: "active",
    verificationStatus: "verified",
    expiresAt: "2028-12-31",
    ...overrides,
  };
}

export const FULL_HARD_SET = [QT.B11, QT.A320, QT.EWIS, QT.HF, QT.FTS].map((id) => held(id));

export const OCTOBER = [
  {
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2026-11-01T00:00:00Z",
    status: "available" as const,
  },
];

/**
 * A typical B1.1 · A320 Family passport (BR-18): English B2 and national mobility, so both v1.8 affinity
 * items are met (BR-5.6); one unrestricted A320 Family · B1.1 rating without expiry; permit for Spain.
 */
export function declared(overrides: Partial<CandidateDeclarations> = {}): CandidateDeclarations {
  return {
    primaryCategory: "B1.1",
    categories: ["B1.1"],
    aircraft: ["A320 Family"],
    engines: [],
    skills: [],
    englishLevel: "B2",
    mobility: "national",
    workPermits: ["ES"],
    typeRatings: [
      { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restricted: false },
    ],
    hasRestrictions: false,
    ...overrides,
  };
}

export function candidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id,
    pool: "external",
    displayName: null,
    baseLocation: "Madrid (MAD)",
    yearsExperience: 8,
    qualifications: FULL_HARD_SET,
    availability: OCTOBER,
    declarations: declared(),
    ...overrides,
  };
}
