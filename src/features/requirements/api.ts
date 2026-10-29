import "server-only";
import type {
  ChangeRequirementStatusInput,
  CreateWorkRequirementInput,
  RequirementArchiveFilter,
  RequirementListOrder,
  UpdateWorkRequirementInput,
  ViableCandidatesInput,
} from "@/lib/validation/work-requirement";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { WorkRequirement } from "@/domain/work-requirement";
import type {
  ViableCandidatesResponse,
  WorkRequirementListResponse,
  WorkRequirementResponse,
} from "@/types/api";

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
    /** v1.8 «Archivada» (T-64); the function's default is `include`. */
    archived?: RequirementArchiveFilter;
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

/** Edit (M05): only while the requirement never received an application (409 HAS_APPLICATIONS). */
export const updateRequirement = (input: UpdateWorkRequirementInput) =>
  invokeEdgeFunction<WorkRequirementResponse>("work-requirements", { method: "PUT", body: input });

/** Pause, resume / publish a draft (`open`) or close (terminal) — M05, V1.8 `job.status`. */
export const setRequirementStatus = (input: ChangeRequirementStatusInput) =>
  invokeEdgeFunction<WorkRequirementResponse>("work-requirements", {
    method: "PATCH",
    body: input,
  });

/** v1.8 «Archivar» (one way, T-64): a closed requirement or a draft. */
export const archiveRequirement = (id: string) =>
  invokeEdgeFunction<WorkRequirementResponse>("work-requirements", {
    method: "PATCH",
    body: { id, archive: true },
  });

/** The builder's live count «{n} candidatos con requisitos y bloques viables» (v2-13, T-66). */
export const countViableCandidates = (input: ViableCandidatesInput) =>
  invokeEdgeFunction<ViableCandidatesResponse>("matching-evaluate", {
    method: "POST",
    body: input,
  });
