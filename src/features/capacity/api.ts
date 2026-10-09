import "server-only";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { CapacityResponse } from "@/types/api";

export const evaluateRequirementCapacity = (requirementId: string) =>
  invokeEdgeFunction<CapacityResponse>("capacity-evaluate", {
    method: "POST",
    body: { requirementId },
  });
