import "server-only";
import type { ReviewQualificationInput } from "@/lib/validation/review";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { ReviewDecisionResponse, ReviewQueueResponse } from "@/types/api";

/** Platform-admin review queue through `qualification-reviews` (role re-checked by the function). */
export const getReviewQueue = () =>
  invokeEdgeFunction<ReviewQueueResponse>("qualification-reviews");

export const submitReview = (input: ReviewQualificationInput) =>
  invokeEdgeFunction<ReviewDecisionResponse>("qualification-reviews", {
    method: "POST",
    body: input,
  });
