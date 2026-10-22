import "server-only";
import type { ApplicationStatus } from "@/domain/applications";
import type { ApplyInput, TransitionInput } from "@/lib/validation/applications";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  ApplicationPackResponse,
  ApplicationResponse,
  CandidatePackPreviewResponse,
  ApplicationTransitionResponse,
  MyApplicationListResponse,
  OrganizationApplicationsResponse,
  RequirementApplicationCountsResponse,
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

/**
 * The Candidate Pack copy of one application (v2-15, BR-25): its two parties only (404 for anyone else);
 * `pack: null` when the application has no copy (withdrawn, rejected, cancelled, account closed, or older).
 */
export const getApplicationPack = (applicationId: string) =>
  invokeEdgeFunction<ApplicationPackResponse>("applications", {
    query: { view: "pack", applicationId },
  });

/** What the caller's copy would contain if they applied now (the apply panel's «Qué compartes»). */
export const getPackPreview = () =>
  invokeEdgeFunction<CandidatePackPreviewResponse>("applications", {
    query: { view: "pack-preview" },
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

/** v2-05: one page of the organization's applications, newest first (admin/manager). */
export const listOrganizationApplications = (
  organizationId: string,
  filters: { requirementId?: string; status?: ApplicationStatus; offset: number; limit: number },
) =>
  invokeEdgeFunction<OrganizationApplicationsResponse>("applications", {
    query: {
      organizationId,
      view: "list",
      offset: String(filters.offset),
      limit: String(filters.limit),
      ...(filters.requirementId ? { requirementId: filters.requirementId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
  });

/** v2-05 tabs and v2-08 coverage: applications per status of each requirement (admin/manager). */
export const getRequirementApplicationCounts = (organizationId: string) =>
  invokeEdgeFunction<RequirementApplicationCountsResponse>("applications", {
    query: { organizationId, view: "byRequirement" },
  });
