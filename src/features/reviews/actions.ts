"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors } from "@/lib/validation/errors";
import { reviewQualificationInput } from "@/lib/validation/review";
import { isQualificationReviewEnabled } from "@/server/feature-flags";
import {
  fromProfessionalResponse,
  invalidResult,
  type ProfileActionResult,
} from "../professional/action-result";
import { submitReview } from "./api";

/**
 * Refused while the review is disabled (OD-3, server-side flag) without calling anything. Then
 * server-side validation and the Edge Function (which re-reads the reviewer's platform role and
 * calls the audited RPC). Success is reported only after the database confirmed the decision.
 */
export async function reviewQualificationAction(input: unknown): Promise<ProfileActionResult> {
  if (!isQualificationReviewEnabled()) {
    return { ok: false, code: "NOT_FOUND", message: "This service is not available." };
  }
  const parsed = reviewQualificationInput.safeParse(input);
  if (!parsed.success) return invalidResult(toFieldErrors(parsed.error));
  const result = await submitReview(parsed.data);
  if (result.ok) revalidatePath("/app/admin/verifications");
  return fromProfessionalResponse(result, []);
}
