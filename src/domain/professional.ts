// Professional profile vocabulary and passport completeness (BUSINESS_RULES BR-11, T-36).
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

/**
 * The ten v1.8 items (connected `readiness`, `src/beta/connectedModel.js:4`; R-D5 default T-36), in
 * v1.8 order. «Document» only counts while the document wallet is on. A verified qualification and the
 * visibility are not items (v1.8 does not count them; the overview shows verification on its own).
 */
export type CompletenessItem =
  | "display_name"
  | "base_location"
  | "primary_category"
  | "aircraft"
  | "years_experience"
  | "min_rate"
  | "work_permits"
  | "availability"
  | "courses"
  | "document";

export interface CompletenessInput {
  profile: Pick<ProfessionalProfile, "displayName" | "baseLocation" | "yearsExperience"> & {
    primaryCategory: string | null;
    aircraft: readonly string[];
    workPermits: readonly string[];
    minRate: number | null;
  };
  /** Own qualifications (catalog category and held status); a held TRAINING one is a course. */
  qualifications: { category: string; status: string }[];
  /** Published windows that have not ended yet (`futureAvailabilityCount`). */
  futureAvailableWindows: number;
  /** Own wallet documents; `null` when the wallet is off — the item is then left out. */
  documents: number | null;
}

export interface Completeness {
  /** 0–100, rounded. */
  percent: number;
  /** The items that count, in completion order (the overview checklist renders them all). */
  items: CompletenessItem[];
  /** Items still missing, in the order they should be completed. */
  missing: CompletenessItem[];
}

const ITEMS: { item: CompletenessItem; done: (input: CompletenessInput) => boolean }[] = [
  { item: "display_name", done: ({ profile }) => profile.displayName.trim().length > 0 },
  { item: "base_location", done: ({ profile }) => (profile.baseLocation ?? "").trim().length > 0 },
  { item: "primary_category", done: ({ profile }) => profile.primaryCategory !== null },
  { item: "aircraft", done: ({ profile }) => profile.aircraft.length > 0 },
  { item: "years_experience", done: ({ profile }) => (profile.yearsExperience ?? 0) > 0 },
  { item: "min_rate", done: ({ profile }) => (profile.minRate ?? 0) > 0 },
  { item: "work_permits", done: ({ profile }) => profile.workPermits.length > 0 },
  { item: "availability", done: ({ futureAvailableWindows }) => futureAvailableWindows > 0 },
  {
    item: "courses",
    done: ({ qualifications }) =>
      qualifications.some((q) => q.status === "active" && q.category === "TRAINING"),
  },
  { item: "document", done: ({ documents }) => (documents ?? 0) > 0 },
];

/** Every BR-11 item in completion order. */
export const COMPLETENESS_ITEMS: readonly CompletenessItem[] = ITEMS.map(({ item }) => item);

/**
 * v1.8 «Disponibilidad futura»: windows that publish availability (`available` or `aog_only`, BR-4.8)
 * and end after `now`. A past window says nothing about the professional's time any more.
 */
export function futureAvailabilityCount(
  windows: readonly { endsAt: string; status: string }[],
  now: Date,
): number {
  return windows.filter((w) => w.status !== "unavailable" && Date.parse(w.endsAt) > now.getTime())
    .length;
}

/**
 * Passport completeness: the share of the items a professional controls that are done, plus the
 * ordered list of what is still missing (so the UI can give a concrete hint, CF-L03). Deterministic:
 * the caller passes the counts, the future windows included (measured against its own `now`).
 */
export function profileCompleteness(input: CompletenessInput): Completeness {
  const counted = ITEMS.filter(({ item }) => item !== "document" || input.documents !== null);
  const missing = counted.filter(({ done }) => !done(input)).map(({ item }) => item);
  return {
    percent: Math.round(((counted.length - missing.length) / counted.length) * 100),
    items: counted.map(({ item }) => item),
    missing,
  };
}
