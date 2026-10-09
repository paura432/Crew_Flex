import { z } from "zod";

const email = z.email("Enter a valid email address").max(254);

export const signInInput = z.strictObject({
  email,
  password: z.string().min(1, "Enter your password").max(72),
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
  displayName: z.string().trim().min(1, "Enter your name").max(120, "At most 120 characters"),
  email,
  password: z.string().min(10, "Use at least 10 characters").max(72, "Use at most 72 characters"),
};

export const signUpInput = z.discriminatedUnion("accountType", [
  z.strictObject({ accountType: z.literal("professional"), ...base }),
  z.strictObject({
    accountType: z.literal("organization"),
    ...base,
    organizationName: z
      .string()
      .trim()
      .min(2, "Enter the organization name")
      .max(160, "At most 160 characters"),
    organizationType: z.enum(ORGANIZATION_TYPES, "Choose an organization type"),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Use a 2-letter country code, e.g. ES"),
  }),
]);
export type SignUpInput = z.infer<typeof signUpInput>;
