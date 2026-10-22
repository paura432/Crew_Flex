// Professional profile vocabulary and passport completeness (BUSINESS_RULES BR-11).
// Pure: no I/O, no framework imports. Shared by Next.js and Supabase Edge Functions.
// The enum arrays mirror the database enums (`mobility`, `technician_status`,
// `profile_visibility`); the generated types in `src/types/database.generated.ts` are the check.

export const MOBILITIES = ["local", "national", "international"] as const;
export type Mobility = (typeof MOBILITIES)[number];

export const TECHNICIAN_STATUSES = ["employed", "contractor", "between_contracts"] as const;
export type TechnicianStatus = (typeof TECHNICIAN_STATUSES)[number];

/** v1.8 order: Privado · Anónimo · Empresas verificadas · Abierto (BR-8; `verified_orgs` since 20261023500000). */
export const PROFILE_VISIBILITIES = ["private", "anonymous", "verified_orgs", "open"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export const DISPLAY_NAME_MAX = 120;
export const BASE_LOCATION_MAX = 80;
export const YEARS_EXPERIENCE_MAX = 60;

/** The editable professional profile (profiles.display_name + technician_profiles). */
export interface ProfessionalProfile {
  displayName: string;
  baseLocation: string | null;
  mobility: Mobility;
  yearsExperience: number | null;
  currentStatus: TechnicianStatus;
  visibility: ProfileVisibility;
}

export type CompletenessItem =
  | "display_name"
  | "base_location"
  | "years_experience"
  | "licence_or_rating"
  | "verified_qualification"
  | "availability"
  | "visibility";

export interface CompletenessInput {
  profile: Pick<
    ProfessionalProfile,
    "displayName" | "baseLocation" | "yearsExperience" | "visibility"
  >;
  /** Held, non-withdrawn qualifications (matchable data only). */
  qualifications: { category: string; verificationStatus: string; status: string }[];
  availableWindows: number;
}

export interface Completeness {
  /** 0–100, rounded. */
  percent: number;
  /** Items still missing, in the order they should be completed. */
  missing: CompletenessItem[];
}

const ITEMS: { item: CompletenessItem; done: (input: CompletenessInput) => boolean }[] = [
  { item: "display_name", done: ({ profile }) => profile.displayName.trim().length > 0 },
  { item: "base_location", done: ({ profile }) => (profile.baseLocation ?? "").trim().length > 0 },
  { item: "years_experience", done: ({ profile }) => (profile.yearsExperience ?? 0) > 0 },
  {
    item: "licence_or_rating",
    done: ({ qualifications }) =>
      qualifications.some(
        (q) => q.status === "active" && (q.category === "LICENSE" || q.category === "TYPE_RATING"),
      ),
  },
  {
    item: "verified_qualification",
    done: ({ qualifications }) =>
      qualifications.some((q) => q.status === "active" && q.verificationStatus === "verified"),
  },
  { item: "availability", done: ({ availableWindows }) => availableWindows > 0 },
  { item: "visibility", done: ({ profile }) => profile.visibility !== "private" },
];

/** The BR-11 items in completion order (the overview checklist renders them all). */
export const COMPLETENESS_ITEMS: readonly CompletenessItem[] = ITEMS.map(({ item }) => item);

/**
 * Passport completeness: the share of the seven items a professional controls that are done,
 * plus the ordered list of what is still missing (so the UI can give a concrete hint, CF-L03).
 * Deterministic; it never looks at "today".
 */
export function profileCompleteness(input: CompletenessInput): Completeness {
  const missing = ITEMS.filter(({ done }) => !done(input)).map(({ item }) => item);
  return {
    percent: Math.round(((ITEMS.length - missing.length) / ITEMS.length) * 100),
    missing,
  };
}
