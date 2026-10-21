import "server-only";
import type {
  CreateWorkRequirementInput,
  RequirementListOrder,
} from "@/lib/validation/work-requirement";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { WorkRequirement } from "@/domain/work-requirement";
import type { WorkRequirementListResponse, WorkRequirementResponse } from "@/types/api";

export const listRequirements = (
  organizationId: string,
  {
    offset,
    limit,
    ...filters
  }: {
    status?: WorkRequirement["status"];
    endsAfter?: string;
    order?: RequirementListOrder;
    offset?: number;
    limit?: number;
  } = {},
) =>
  invokeEdgeFunction<WorkRequirementListResponse>("work-requirements", {
    query: {
      organizationId,
      ...filters,
      ...(offset !== undefined ? { offset: String(offset) } : {}),
      ...(limit !== undefined ? { limit: String(limit) } : {}),
    },
  });

export const getRequirement = (id: string) =>
  invokeEdgeFunction<WorkRequirementResponse>("work-requirements", { query: { id } });

export const createRequirement = (input: CreateWorkRequirementInput, idempotencyKey: string) =>
  invokeEdgeFunction<WorkRequirementResponse>("work-requirements", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const closeRequirement = (id: string) =>
  invokeEdgeFunction<WorkRequirementResponse>("work-requirements", {
    method: "PATCH",
    body: { id, status: "closed" },
  });
