// Recruiter: the agency's portfolio of represented clients and their activation by a platform admin (D-12
// provisional model; LOCAL 20261024500000; BR-27, T-130…T-136). Shared by the forms, the server actions and the
// `represented-clients` Edge Function. Deno-compatible imports (relative, `.ts`).
//
// The organization id is the TARGET, never an identity: who may act is read from the database (membership role,
// organization type, platform role). Every schema is strict, so `status`, `agencyId`, `role`… in a payload are
// rejected. Messages are i18n keys (`v.*`).
import {
  CLIENT_EMAIL_MAX,
  CLIENT_NAME_MAX,
  CLIENT_NAME_MIN,
  REPRESENTATION_NOTE_MAX,
} from "../../domain/recruiter.ts";
import { z } from "./zod.ts";

/** v1.8 «Nuevo cliente» (required) + «Correo del cliente» (optional; empty = none). */
export const addRepresentedClientInput = z.strictObject({
  organizationId: z.uuid("v.organization.required"),
  // v1.8 «Indica un cliente válido en el espacio recruiter.»
  name: z
    .string("v.recruiter.clientName")
    .trim()
    .min(CLIENT_NAME_MIN, "v.recruiter.clientName")
    .max(CLIENT_NAME_MAX, "v.recruiter.clientName"),
  contactEmail: z
    .string("v.recruiter.clientEmail")
    .trim()
    .toLowerCase()
    .pipe(
      z.union([
        z.literal(""),
        z.email("v.recruiter.clientEmail").max(CLIENT_EMAIL_MAX, "v.recruiter.clientEmail"),
      ]),
    )
    .optional()
    .transform((email) => email || undefined),
});
export type AddRepresentedClientInput = z.infer<typeof addRepresentedClientInput>;

/** «Revocar» (the agency's admin/manager) or «Activar» with evidence (a platform admin). */
export const representedClientActionInput = z.discriminatedUnion("action", [
  z.strictObject({ id: z.uuid("v.invalid"), action: z.literal("revoke") }),
  z.strictObject({
    id: z.uuid("v.invalid"),
    action: z.literal("activate"),
    note: z
      .string("v.recruiter.noteRequired")
      .trim()
      .min(1, "v.recruiter.noteRequired")
      .max(REPRESENTATION_NOTE_MAX, "v.recruiter.noteMax"),
  }),
]);
export type RepresentedClientActionInput = z.infer<typeof representedClientActionInput>;

/** `GET /represented-clients?organizationId=` (an agency's portfolio) or `?view=review` (platform admins). */
export const listRepresentedClientsQuery = z.union([
  z.strictObject({ organizationId: z.uuid("v.invalid") }),
  z.strictObject({ view: z.literal("review") }),
]);
export type ListRepresentedClientsQuery = z.infer<typeof listRepresentedClientsQuery>;
