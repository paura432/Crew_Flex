import "server-only";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { MatchingResponse } from "@/types/api";

export const evaluateRequirementMatches = (requirementId: string) =>
  invokeEdgeFunction<MatchingResponse>("matching-evaluate", {
    method: "POST",
    body: { requirementId },
  });
