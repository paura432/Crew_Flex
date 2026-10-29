import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
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

/**
 * v1.8 «Red visible» (T-146): how many professionals this organization can find in the network
 * (`count_visible_network`, DEFINER, admin/manager only; a count, never a row). Read by the Next.js
 * server under the caller's JWT, like the platform figures (T-53). `null` when it cannot be read.
 */
export async function getVisibleNetworkCount(organizationId: string): Promise<number | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("count_visible_network", {
    p_organization_id: organizationId,
  });
  return error || typeof data !== "number" ? null : data;
}
