// Account data rights and invitations (PKG account): shared by the server actions and the Edge Functions
// `account` and `invitations`. Messages are i18n keys (`v.*`).
import { z } from "./zod.ts";

/** Account types an invitation may carry. `platform_admin` is a platform role, never invited. */
export const INVITABLE_ACCOUNT_TYPES = ["professional", "organization"] as const;
export type InvitableAccountType = (typeof INVITABLE_ACCOUNT_TYPES)[number];

/** The word typed to confirm the closure (v1.8 «Escribe CERRAR»); each UI language asks for its own. */
export const CLOSE_ACCOUNT_WORDS = ["CERRAR", "CLOSE"] as const;
export const closeAccountWord = (locale: string) => (locale === "en" ? "CLOSE" : "CERRAR");

export const closeAccountInput = z.strictObject({
  confirm: z.enum(CLOSE_ACCOUNT_WORDS, "v.invalid"),
});
export type CloseAccountInput = z.infer<typeof closeAccountInput>;

export const createInvitationInput = z.strictObject({
  email: z.email("v.email.invalid").max(254, "v.email.invalid"),
  accountType: z.enum(INVITABLE_ACCOUNT_TYPES, "v.invalid"),
});
export type CreateInvitationInput = z.infer<typeof createInvitationInput>;

/** An invitation code as the database issues it (two v4 UUIDs without dashes: 64 lower-case hex). */
export const INVITATION_CODE = /^[0-9a-f]{64}$/;

/** `?invite=` / form value → a well-formed code or null (case and spaces forgiven, nothing else). */
export function normalizeInvitationCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return INVITATION_CODE.test(code) ? code : null;
}
