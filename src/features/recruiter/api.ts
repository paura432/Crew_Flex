import "server-only";
import type {
  AddRepresentedClientInput,
  RepresentedClientActionInput,
} from "@/lib/validation/recruiter";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  RepresentationReviewListResponse,
  RepresentedClientListResponse,
  RepresentedClientResponse,
} from "@/types/api";

/** An agency's portfolio (every member reads it; the function re-checks the membership). */
export const listRepresentedClients = (organizationId: string) =>
  invokeEdgeFunction<RepresentedClientListResponse>("represented-clients", {
    query: { organizationId },
  });

/** Every agency's representations, pending first (platform admins; the function re-checks the role). */
export const listRepresentationReviews = () =>
  invokeEdgeFunction<RepresentationReviewListResponse>("represented-clients", {
    query: { view: "review" },
  });

export const addRepresentedClient = (input: AddRepresentedClientInput) =>
  invokeEdgeFunction<RepresentedClientResponse>("represented-clients", {
    method: "POST",
    body: input,
  });

/** «Revocar» (the agency's admin/manager) or «Registrar evidencia y activar» (a platform admin). */
export const actOnRepresentedClient = (input: RepresentedClientActionInput) =>
  invokeEdgeFunction<RepresentedClientResponse>("represented-clients", {
    method: "PATCH",
    body: input,
  });
