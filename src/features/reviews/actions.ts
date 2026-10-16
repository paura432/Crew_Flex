"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors } from "@/lib/validation/errors";
import { reviewQualificationInput } from "@/lib/validation/review";
import {
  fromProfessionalResponse,
  invalidResult,
  type ProfileActionResult,
} from "../professional/action-result";
import { submitReview } from "./api";

/**
 * Server-side validation, then the Edge Function (which re-reads the reviewer's platform role and
 * calls the audited RPC). Success is reported only after the database confirmed the decision.
 */
export async function reviewQualificationAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = reviewQualificationInput.safeParse(input);
  if (!parsed.success) return invalidResult(toFieldErrors(parsed.error));
  const result = await submitReview(parsed.data);
  if (result.ok) revalidatePath("/app/admin/verifications");
  return fromProfessionalResponse(result, []);
}
