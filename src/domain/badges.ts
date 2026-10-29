// v1.8 profile medals (N-15, T-143): `badges()` of the prototype (`src/features/progress.js:3-11`) over the
// passport's OWN declarations, plus Next's «Verificada» when a platform reviewer verified the same code.
// Pure: no I/O, no framework imports. A medal summarises what the professional declared; it never makes
// anyone eligible (matching reads the verified qualifications, BR-2/BR-3) and grants no signing authority.
import {
  declaresRestriction,
  type Aircraft,
  type LicenceCategory,
  type ProfessionalCategory,
  type Skill,
  type TypeRating,
} from "./passport.ts";

export type BadgeKind = "experience" | "category" | "aircraft" | "specialty";

/** v1.8 states («Declarado», «Revisar vigencia», «Con restricciones», «Tipo declarado», «Experiencia declarada») + «Verificada». */
export type BadgeStatus =
  "declared" | "verified" | "reviewValidity" | "restricted" | "typeDeclared" | "experienceDeclared";

export interface Badge {
  /** Stable and unique in one profile (v1.8 ids: `cat-…`, `skill-…`, `rating-…`, `experience`). */
  id: string;
  kind: BadgeKind;
  status: BadgeStatus;
  /** Category and specialty medals: the declared category (a specialty skill maps to its category code). */
  category?: ProfessionalCategory;
  /** True when a specialty comes from the skills list, not from the categories (its own v1.8 detail). */
  fromSkill?: boolean;
  /** Aircraft medals: the declared type rating. */
  aircraft?: Aircraft;
  ratingCategory?: LicenceCategory;
  /** «Con restricciones»: the professional's own restriction text (shown only to them). */
  restrictions?: string;
  /** Experience medal. */
  years?: number;
}

export interface BadgeInput {
  yearsExperience: number | null;
  primaryCategory: ProfessionalCategory | null;
  categories: readonly ProfessionalCategory[];
  skills: readonly Skill[];
  typeRatings: readonly Pick<TypeRating, "aircraft" | "category" | "expiresAt" | "restrictions">[];
  /** Codes of the professional's active qualifications that a reviewer verified and that are valid today. */
  verifiedCodes: ReadonlySet<string>;
}

/** v1.8 `['NDT','Sheet Metal']`: categories shown as a specialty (wrench), not as a licence shield. */
const SPECIALTY_CATEGORIES: ReadonlySet<ProfessionalCategory> = new Set(["NDT", "SHEET-METAL"]);
/** v1.8 `skills.includes('NDT' | 'Sheet Metal')` without that category declared. */
const SPECIALTY_SKILLS: readonly (readonly [Skill, ProfessionalCategory])[] = [
  ["ndt", "NDT"],
  ["sheet_metal", "SHEET-METAL"],
];

/**
 * Every medal of a profile, in v1.8 order: categories (the main one first), specialty skills, type
 * ratings, experience. `today` is `YYYY-MM-DD` (UTC, BR-10): a rating whose declared validity ended
 * before it is «Revisar vigencia».
 */
export function badges(input: BadgeInput, today: string): Badge[] {
  const out: Badge[] = [];
  const categories = [
    ...(input.primaryCategory && input.categories.includes(input.primaryCategory)
      ? [input.primaryCategory]
      : []),
    ...input.categories.filter((c) => c !== input.primaryCategory),
  ];
  for (const category of new Set(categories)) {
    out.push({
      id: `cat-${category}`,
      kind: SPECIALTY_CATEGORIES.has(category) ? "specialty" : "category",
      status: input.verifiedCodes.has(category) ? "verified" : "declared",
      category,
    });
  }
  for (const [skill, category] of SPECIALTY_SKILLS) {
    if (input.skills.includes(skill) && !input.categories.includes(category)) {
      out.push({
        id: `skill-${category}`,
        kind: "specialty",
        status: input.verifiedCodes.has(category) ? "verified" : "declared",
        category,
        fromSkill: true,
      });
    }
  }
  for (const rating of input.typeRatings) {
    const expired = rating.expiresAt !== null && rating.expiresAt < today;
    const restricted = declaresRestriction(rating.restrictions);
    out.push({
      id: `rating-${rating.aircraft}-${rating.category}`,
      kind: "aircraft",
      status: expired ? "reviewValidity" : restricted ? "restricted" : "typeDeclared",
      aircraft: rating.aircraft,
      ratingCategory: rating.category,
      ...(restricted && !expired ? { restrictions: rating.restrictions!.trim() } : {}),
    });
  }
  const years = input.yearsExperience;
  if (years !== null && Number.isFinite(years) && years > 0) {
    out.push({ id: "experience", kind: "experience", status: "experienceDeclared", years });
  }
  return [...new Map(out.map((badge) => [badge.id, badge])).values()];
}

/**
 * v1.8 `MedalStrip` main strip: experience, the first category, the first aircraft and the first
 * specialty; the rest behind «+N».
 */
export function primaryBadges(all: readonly Badge[]): { primary: Badge[]; others: Badge[] } {
  const primary = (["experience", "category", "aircraft", "specialty"] as const)
    .map((kind) => all.find((badge) => badge.kind === kind))
    .filter((badge): badge is Badge => badge !== undefined);
  const ids = new Set(primary.map((badge) => badge.id));
  return { primary, others: all.filter((badge) => !ids.has(badge.id)) };
}

/** v1.8 shows «A320» for «A320 Family» on the medal (the full name stays in its label). */
export const aircraftShort = (aircraft: Aircraft) => aircraft.replace(/ Family$/, "");

/**
 * `BadgeInput.verifiedCodes`: codes of the held (active) qualifications a reviewer verified whose
 * declared expiry, if any, is not before `today` (`YYYY-MM-DD`, UTC).
 */
export function verifiedCodes(
  qualifications: readonly {
    code: string;
    status: string;
    verificationStatus: string;
    expiresAt: string | null;
  }[],
  today: string,
): Set<string> {
  return new Set(
    qualifications
      .filter(
        (q) =>
          q.status === "active" &&
          q.verificationStatus === "verified" &&
          (q.expiresAt === null || q.expiresAt >= today),
      )
      .map((q) => q.code),
  );
}
