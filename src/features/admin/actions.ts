"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors } from "@/lib/validation/errors";
import { reviewOrganizationInput } from "@/lib/validation/organization";
import {
  fromProfessionalResponse,
  invalidResult,
  type ProfileActionResult,
} from "../professional/action-result";
import { submitOrganizationReview } from "./api";

/**
 * «Registrar revisión»: server-side validation (evidence required), then the Edge Function, which
 * re-reads the platform role and calls the audited RPC. Success only after the database confirmed.
 */
export async function reviewOrganizationAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = reviewOrganizationInput.safeParse(input);
  if (!parsed.success) return invalidResult(toFieldErrors(parsed.error));
  const result = await submitOrganizationReview(parsed.data);
  if (result.ok) {
    revalidatePath("/app/admin/organizations");
    revalidatePath("/app/admin");
  }
  return fromProfessionalResponse(result, []);
}
