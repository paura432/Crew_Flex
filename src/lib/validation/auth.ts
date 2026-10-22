// Messages are i18n keys (`v.*`, messages/*.json) resolved by the UI (src/i18n/validation.ts).
import { ORGANIZATION_TYPES } from "../../domain/organization.ts";
import { z } from "./zod.ts";

const email = z.email("v.email.invalid").max(254, "v.email.invalid");

export const signInInput = z.strictObject({
  email,
  password: z.string("v.password.required").min(1, "v.password.required").max(72, "v.password.max"),
});
export type SignInInput = z.infer<typeof signInInput>;

/** One definition (src/domain/organization.ts); re-exported for the sign-up form. */
export { ORGANIZATION_TYPES };

/** Q-01 (owner, 2026-10-22): 12, as v1.8. Production Auth keeps its own minimum until the owner changes it. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 72;

const newPassword = z
  .string("v.password.required")
  .min(PASSWORD_MIN, "v.password.min")
  .max(PASSWORD_MAX, "v.password.max");

const base = {
  displayName: z.string("v.name.required").trim().min(1, "v.name.required").max(120, "v.name.max"),
  email,
  password: newPassword,
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

export const forgotPasswordInput = z.strictObject({ email });

export const resetPasswordInput = z
  .strictObject({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "v.password.mismatch" });
