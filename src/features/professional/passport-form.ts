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
 * from an empty draft; the saved passport is untouched until «Guardar pasaporte». Exactly v1.8's reset
 * (`Professional2.jsx:113-128`): name, phone, categories, aircraft, type ratings, engines, capabilities, years and
 * rate are emptied and the visibility goes back to private; base and country, employer, English, tools, work
 * permits and restrictions are kept (v1.8 keeps location, employer, English, tools and work countries), as are the
 * enums without an empty option, the blocked organizations and the version (`updatedAt`).
 */
export function emptyPassport<P extends ProfessionalPassport>(current: P): P {
  return {
    ...current,
    displayName: "",
    phone: null,
    primaryCategory: null,
    categories: [],
    aircraft: [],
    typeRatings: [],
    yearsExperience: null,
    engines: [],
    skills: [],
    minRate: null,
    visibility: "private",
  };
}
