"use server";

import { toFieldErrors } from "@/lib/validation/errors";
import { updateProfessionalProfileInput } from "@/lib/validation/professional";
import { fromProfessionalResponse, invalidResult, type ProfileActionResult } from "./action-result";
import { updateProfessionalProfile } from "./api";

/** Server-side validation first (never trusts the client), then the Edge Function. */
export async function updateProfileAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = updateProfessionalProfileInput.safeParse(input);
  if (!parsed.success) return invalidResult(toFieldErrors(parsed.error));
  return fromProfessionalResponse(await updateProfessionalProfile(parsed.data), [
    "/app/professional/profile",
  ]);
}
