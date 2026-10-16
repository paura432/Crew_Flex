// Messages are i18n keys (`v.*`, messages/*.json) resolved by the UI (src/i18n/validation.ts).
import { z } from "zod";

const email = z.email("v.email.invalid").max(254, "v.email.invalid");

export const signInInput = z.strictObject({
  email,
  password: z.string("v.password.required").min(1, "v.password.required").max(72, "v.password.max"),
});
export type SignInInput = z.infer<typeof signInInput>;

export const ORGANIZATION_TYPES = [
  "mro",
  "airline",
  "operator",
  "staffing_agency",
  "other",
] as const;

const base = {
  displayName: z.string("v.name.required").trim().min(1, "v.name.required").max(120, "v.name.max"),
  email,
  password: z.string("v.password.required").min(10, "v.password.min").max(72, "v.password.max"),
};

export const signUpInput = z.discriminatedUnion("accountType", [
  z.strictObject({ accountType: z.literal("professional"), ...base }),
  z.strictObject({
    accountType: z.literal("organization"),
    ...base,
    organizationName: z
      .string("v.orgName.min")
      .trim()
      .min(2, "v.orgName.min")
      .max(160, "v.orgName.max"),
    organizationType: z.enum(ORGANIZATION_TYPES, "v.orgType.invalid"),
    country: z
      .string("v.country.invalid")
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "v.country.invalid"),
  }),
]);
export type SignUpInput = z.infer<typeof signUpInput>;
