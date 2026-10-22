import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ReviewOrganizationInput } from "@/lib/validation/organization";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  AuditEventItem,
  OrganizationReviewListResponse,
  OrganizationReviewResponse,
  PlatformSummary,
} from "@/types/api";
import { AUDIT_PAGE_SIZE, auditOffset, toAuditEvent, toPlatformSummary } from "./map";

/**
 * Platform figures, read by the Next.js server under the caller's JWT from the DEFINER RPC that
 * checks the platform role in its body (T-18: read-only, no Edge Function). `null` when the read
 * fails (the page says so); a non-admin never gets here (the proxy and the page answer 404 first)
 * and would get 42501 anyway.
 */
export async function getPlatformSummary(): Promise<PlatformSummary | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("get_platform_summary");
  if (error) return null;
  try {
    return toPlatformSummary(data);
  } catch {
    return null;
  }
}

/**
 * One page of the audit trail, newest first, under RLS (`audit_events_select`: a platform admin
 * reads every row). Rows are ids, codes and flags by construction (S-9). One extra row is read to
 * know whether an older page exists.
 */
export async function listAuditEvents(
  page: number,
): Promise<{ events: AuditEventItem[]; hasMore: boolean } | null> {
  const supabase = await createServerSupabase();
  const from = auditOffset(page);
  const { data, error } = await supabase
    .from("audit_events")
    .select(
      "id, created_at, action, actor_profile_id, organization_id, entity_type, entity_id, metadata",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE); // inclusive: AUDIT_PAGE_SIZE + 1 rows
  if (error) return null;
  try {
    const rows = (data ?? []).map(toAuditEvent);
    return { events: rows.slice(0, AUDIT_PAGE_SIZE), hasMore: rows.length > AUDIT_PAGE_SIZE };
  } catch {
    return null;
  }
}

/** Organizations under review through `organization-reviews` (platform role re-checked there). */
export const listOrganizationReviews = () =>
  invokeEdgeFunction<OrganizationReviewListResponse>("organization-reviews");

export const submitOrganizationReview = (input: ReviewOrganizationInput) =>
  invokeEdgeFunction<OrganizationReviewResponse>("organization-reviews", {
    method: "POST",
    body: input,
  });
