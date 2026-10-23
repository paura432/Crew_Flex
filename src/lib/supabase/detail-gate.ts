import type { SupabaseClient } from "@supabase/supabase-js";
import { actingOrganizationId } from "@/lib/acting-organization";
import { isUuid, type DetailRoute } from "@/lib/detail-routes";
import type { OrganizationRole } from "@/types/database";

/**
 * Whether a detail page has something to show to this caller, decided by the proxy BEFORE the
 * /app loading boundary streams a 200 (area 50 #15, SH-07 #14; same idea as X-11). The same reads
 * and rules as the pages, under the caller's JWT (RLS): a requirement of the ACTING organization
 * (platform admins read every tenant, X-22); an opportunity the published projection returns
 * (`list_opportunities`: D-12, T-90) to a professional, or to a member for «Ofertas en la red».
 *
 * `false` → 404. `true` → render. `null` → let the page decide (a failed read shows its error state;
 * a caller without the workspace is redirected by the page, as before). UX only: the Edge Functions
 * and RLS still decide what anyone can read.
 */
export async function detailVisible(
  route: DetailRoute,
  client: SupabaseClient,
  userId: string,
): Promise<boolean | null> {
  if (!isUuid(route.id)) return false; // the API answers VALIDATION_ERROR, the page notFound()

  if (route.kind === "requirement") {
    const [requirement, memberships] = await Promise.all([
      client.from("work_requirements").select("organization_id").eq("id", route.id).maybeSingle(),
      client.from("organization_members").select("role, organization_id").eq("profile_id", userId),
    ]);
    if (requirement.error || memberships.error) return null;
    const rows = (memberships.data ?? []) as { role: OrganizationRole; organization_id: string }[];
    if (rows.length === 0) return null; // requireOrganizationContext redirects
    if (!requirement.data) return false;
    const acting = actingOrganizationId(
      rows.map((m) => ({ role: m.role, organizationId: m.organization_id })),
    );
    return (requirement.data as { organization_id: string }).organization_id === acting;
  }

  const [published, workspace] = await Promise.all([
    client
      .rpc("list_opportunities", { p_id: route.id, p_urgency: null, p_q: null, p_limit: 1 })
      .select("id"),
    route.kind === "opportunity"
      ? client.from("profiles").select("account_type").eq("id", userId).maybeSingle()
      : client
          .from("organization_members")
          .select("organization_id")
          .eq("profile_id", userId)
          .limit(1),
  ]);
  if (workspace.error) return null;
  if (route.kind === "opportunity") {
    // The page is for professional accounts only (notFound otherwise).
    if ((workspace.data as { account_type?: string } | null)?.account_type !== "professional")
      return false;
  } else if (((workspace.data as unknown[] | null) ?? []).length === 0) {
    return null; // not a member: requireOrganizationContext redirects
  }
  if (published.error) return null;
  return Array.isArray(published.data) && published.data.length > 0;
}
