import "server-only";

/**
 * OD-3 approval checkpoint (qualification review by a platform admin). Server-side only and OFF
 * unless the Next.js server environment sets `QUALIFICATION_REVIEW_ENABLED=true` (never a
 * NEXT_PUBLIC_* value). It hides the navigation entry, turns `/app/admin/verifications` into a 404
 * and refuses the review action. It is one gate among several: the Edge Function secret of the same
 * name and the owner-only database row `app_private.feature_flags('qualification_review')` stay
 * independent, and the page, function and RPC keep re-checking the platform role.
 */
export function isQualificationReviewEnabled(): boolean {
  return process.env.QUALIFICATION_REVIEW_ENABLED === "true";
}

/** Navigation and route access: review enabled AND the profile is a platform admin. */
export function canOpenQualificationReview(profile: { platform_role: string }): boolean {
  return isQualificationReviewEnabled() && profile.platform_role === "platform_admin";
}
