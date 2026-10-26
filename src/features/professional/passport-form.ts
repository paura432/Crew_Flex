// Form → payload of the passport save (ProfileForm). Pure, so the mapping is tested without React.
// The result is still validated by the shared schema (src/lib/validation/professional.ts) in the
// browser, the server action and the Edge Function.
import type { Aircraft, LicenceCategory, ProfessionalCategory } from "@/domain/passport";
import type { ProfileVisibility } from "@/domain/professional";
import type { ProfessionalPassport } from "@/types/api";

/** A rating row while it is being edited (`key` only keeps React rows stable). */
export interface RatingDraft {
  key: string;
  aircraft: Aircraft;
  category: LicenceCategory;
  expiresAt: string;
  restrictions: string;
}

/** What the form keeps in React state (the rest is read from the form fields). */
export interface PassportFormState {
  visibility: ProfileVisibility;
  primaryCategory: ProfessionalCategory | null;
  categories: ProfessionalCategory[];
  aircraft: Aircraft[];
  ratings: RatingDraft[];
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "");
const orNull = (value: string) => (value.trim() === "" ? null : value);
const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

/** Builds the unvalidated PATCH body (every field: the save is a full replacement). */
export function passportFromForm(
  form: FormData,
  state: PassportFormState,
  expectedUpdatedAt: string,
) {
  return {
    displayName: text(form, "displayName"),
    baseLocation: text(form, "baseLocation"),
    mobility: text(form, "mobility"),
    yearsExperience: numberOrNull(text(form, "yearsExperience")),
    currentStatus: text(form, "currentStatus"),
    visibility: state.visibility,
    primaryCategory: state.primaryCategory,
    categories: state.categories,
    aircraft: state.aircraft,
    engines: form.getAll("engines").map(String),
    skills: form.getAll("skills").map(String),
    englishLevel: orNull(text(form, "englishLevel")),
    ownTools: form.get("ownTools") === "on",
    baseCountry: orNull(text(form, "baseCountry")),
    workPermits: form.getAll("workPermits").map(String),
    generalRestrictions: text(form, "generalRestrictions"),
    typeRatings: state.ratings.map((r) => ({
      aircraft: r.aircraft,
      category: r.category,
      expiresAt: orNull(r.expiresAt),
      restrictions: r.restrictions,
    })),
    phone: text(form, "phone"),
    currentEmployerId: orNull(text(form, "currentEmployerId")),
    minRate: numberOrNull(text(form, "minRate")),
    rateUnit: text(form, "rateUnit"),
    blockedOrganizationIds: form.getAll("blockedOrganizationIds").map(String),
    expectedUpdatedAt,
  };
}

/**
 * v1.8 connected: choosing the main category ticks it too, and its checkbox stays ticked (disabled)
 * while it is the main one.
 */
export function withPrimary(
  categories: readonly ProfessionalCategory[],
  primary: ProfessionalCategory,
): ProfessionalCategory[] {
  return categories.includes(primary) ? [...categories] : [...categories, primary];
}

/**
 * v1.8 «Empezar perfil vacío» → «Preparar borrador» (`Professional2.jsx`, T-162): the form starts again
 * from an empty draft; the saved passport is untouched until «Guardar pasaporte». Every declaration,
 * text and optional value is emptied and the visibility goes back to private (v1.8); the enums without
 * an empty option (mobility, status, rate unit), the blocked organizations (a privacy choice, as the
 * v1.8 `blockEmployer`) and the version (`updatedAt`) are kept.
 */
export function emptyPassport<P extends ProfessionalPassport>(current: P): P {
  return {
    ...current,
    displayName: "",
    phone: null,
    baseLocation: null,
    baseCountry: null,
    currentEmployerId: null,
    primaryCategory: null,
    categories: [],
    aircraft: [],
    typeRatings: [],
    generalRestrictions: null,
    yearsExperience: null,
    englishLevel: null,
    engines: [],
    skills: [],
    ownTools: false,
    minRate: null,
    workPermits: [],
    visibility: "private",
  };
}
