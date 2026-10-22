import "server-only";
import type { UpdateOrganizationInput } from "@/lib/validation/organization";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { OrganizationProfileResponse } from "@/types/api";

/** «Organización» through `organization-profile` (membership role re-read by the function). */
export const getOrganizationProfile = (organizationId: string) =>
  invokeEdgeFunction<OrganizationProfileResponse>("organization-profile", {
    query: { organizationId },
  });

export const updateOrganizationProfile = (input: UpdateOrganizationInput) =>
  invokeEdgeFunction<OrganizationProfileResponse>("organization-profile", {
    method: "PATCH",
    body: input,
  });
