// Pure row → contract mapping for the platform-admin pages (figures and audit), so it can be tested
// without a database. The rows come from `get_platform_summary` and from `audit_events` under RLS.
import { z } from "@/lib/validation/zod";
import type { AuditEventItem, PlatformSummary } from "@/types/api";

export const AUDIT_PAGE_SIZE = 50;
/** Offsets stay ≤ 10 000 (PostgREST range reads beyond that are not worth paging to). */
const AUDIT_MAX_PAGE = Math.floor(10000 / AUDIT_PAGE_SIZE) + 1;

/** `?page=` as a 1-based page; anything else is page 1. */
export function parseAuditPage(param: unknown): number {
  const n = typeof param === "string" ? Number(param) : Number.NaN;
  return Number.isInteger(n) && n >= 1 ? Math.min(n, AUDIT_MAX_PAGE) : 1;
}

export const auditOffset = (page: number) => (page - 1) * AUDIT_PAGE_SIZE;

const count = z.number().int().nonnegative();
const summaryRow = z.object({
  technicians: count,
  organizations: count,
  active_requirements: count,
  working_now: count,
  aog_with_vacancies: count,
  demand: z.array(z.object({ code: z.string().nullable(), seats: count })),
});

export function toPlatformSummary(raw: unknown): PlatformSummary {
  const r = summaryRow.parse(Array.isArray(raw) ? raw[0] : raw);
  return {
    technicians: r.technicians,
    organizations: r.organizations,
    activeRequirements: r.active_requirements,
    workingNow: r.working_now,
    aogWithVacancies: r.aog_with_vacancies,
    demand: r.demand,
  };
}

const auditRow = z.object({
  id: z.string(),
  created_at: z.string(),
  action: z.string(),
  actor_profile_id: z.string().nullable(),
  organization_id: z.string().nullable(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export function toAuditEvent(raw: unknown): AuditEventItem {
  const r = auditRow.parse(raw);
  return {
    id: r.id,
    at: new Date(r.created_at).toISOString(),
    action: r.action,
    actorId: r.actor_profile_id,
    organizationId: r.organization_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    metadata: r.metadata,
  };
}

/** A uuid as its first block (the full id stays available in a `title`). */
export const shortId = (id: string) => id.slice(0, 8);

/**
 * Metadata as `key: value` pairs, keys sorted. By construction (S-9) the values are ids, codes,
 * counts and flags; lists are joined, objects shown as compact JSON, long values cut at 40.
 */
export function metadataPairs(metadata: Record<string, unknown>): string[] {
  const show = (value: unknown): string => {
    const text = Array.isArray(value)
      ? value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ")
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
    return text.length > 40 ? `${text.slice(0, 39)}…` : text;
  };
  return Object.keys(metadata)
    .sort()
    .map((key) => `${key}: ${show(metadata[key])}`);
}
