import "server-only";
import type { ApplyInput, TransitionInput } from "@/lib/validation/applications";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  ApplicationCountsResponse,
  ApplicationResponse,
  ApplicationTransitionResponse,
  MyApplicationListResponse,
  RequirementApplicationsResponse,
} from "@/types/api";

/** The caller's own applications (technician side). */
export const listMyApplications = () =>
  invokeEdgeFunction<MyApplicationListResponse>("applications");

/** Applications to one requirement (admin/manager of its organization). */
export const listRequirementApplications = (requirementId: string) =>
  invokeEdgeFunction<RequirementApplicationsResponse>("applications", {
    query: { requirementId },
  });

/** Applications per status over an organization's requirements (dashboard). */
export const getApplicationCounts = (organizationId: string) =>
  invokeEdgeFunction<ApplicationCountsResponse>("applications", {
    query: { organizationId, view: "counts" },
  });

export const applyToRequirement = (input: ApplyInput, idempotencyKey: string) =>
  invokeEdgeFunction<ApplicationResponse>("applications", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const transitionApplication = (input: TransitionInput, idempotencyKey: string) =>
  invokeEdgeFunction<ApplicationTransitionResponse>("applications", {
    method: "PATCH",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });
