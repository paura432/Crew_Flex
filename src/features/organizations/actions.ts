"use server";

import { toFieldErrors } from "@/lib/validation/errors";
import { updateOrganizationInput } from "@/lib/validation/organization";
import {
  fromProfessionalResponse,
  invalidResult,
  type ProfileActionResult,
} from "../professional/action-result";
import { updateOrganizationProfile } from "./api";

/**
 * «Guardar organización»: server-side validation first (never trusts the client), then the Edge
 * Function (organization admin from the database, optimistic version). The shell shows the
 * organization's name, so the whole `/app` layout is revalidated on success.
 */
export async function updateOrganizationAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = updateOrganizationInput.safeParse(input);
  if (!parsed.success) return invalidResult(toFieldErrors(parsed.error));
  return fromProfessionalResponse(await updateOrganizationProfile(parsed.data), [
    "/app/organization/settings",
  ]);
}
