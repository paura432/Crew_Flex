// Document wallet maintenance (D-10, review M-3) — LOCAL ONLY, not deployed, not scheduled.
//   POST /documents-maintenance?limit=25          → dry-run: counts orphans and due tombstones, writes nothing
//   POST /documents-maintenance?apply=1&limit=25  → records orphan tombstones, then purges due objects
// Fails closed twice: 404 unless DOCUMENTS_MAINTENANCE_ENABLED=true (function env), and every RPC
// re-checks `is_platform_admin()` in the database (42501 otherwise).
//
// SERVICE ROLE — written justification (AGENTS.md, docs/architecture/EDGE_FUNCTIONS.md):
// Storage objects can only be removed through the Storage API, and the objects to purge belong to
// other users (or to deleted accounts), whose folders the platform admin's own JWT cannot touch by
// design (owner-only Storage policies). The service-role client is therefore created ONLY here,
// ONLY after the caller was verified as platform admin by the database, and used ONLY for
// `storage.from('professional-documents').remove([path])` on one path at a time, right after
// `document_purge_recheck` (row lock: no document row references the path, no legal hold, due,
// not purged) allowed exactly that path. Every purge is audited (`document.purged`) through the
// caller's JWT, so the actor is the platform admin. Reads, plans and records all use the caller's
// client; the service role never queries tables.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { logEvent } from "../_shared/logger.ts";
import { parseQuery } from "../_shared/validation.ts";
import { documentsMaintenanceQuery } from "../../../src/lib/validation/documents.ts";
import type { DocumentsMaintenanceResponse } from "../../../src/types/api.ts";
import { type BatchRow, decidePurge, outcomeOf, planBatch, type Recheck } from "./plan.ts";

const FN = "documents-maintenance";
const BUCKET = "professional-documents";

export const maintenanceEnabled = () => Deno.env.get("DOCUMENTS_MAINTENANCE_ENABLED") === "true";

const batchRow = z.object({
  tombstone_id: z.string().nullable(),
  storage_path: z.string(),
  reason: z.string(),
  action: z.string(),
});
const recheckRow = z.object({ storage_path: z.string(), allowed: z.boolean(), why: z.string() });

async function requirePlatformAdmin(actor: Actor): Promise<void> {
  const { data, error } = await actor.client.rpc("is_platform_admin");
  if (error) throw fromDatabaseError(error);
  if (data !== true) throw new ApiError("FORBIDDEN");
}

/** The only service-role client in the codebase (see the justification above). */
function storageAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new ApiError("INTERNAL_ERROR");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export const handler = createHandler(FN, {
  POST: async (ctx) => {
    if (!maintenanceEnabled()) throw new ApiError("NOT_FOUND", "This service is not available.");
    const actor = await requireActor(ctx);
    await requirePlatformAdmin(actor);
    const { apply, limit } = parseQuery(ctx.url, documentsMaintenanceQuery);
    const applying = apply === "1";

    const batch = await actor.client.rpc("document_maintenance_batch", {
      p_apply: applying,
      p_limit: limit,
    });
    if (batch.error) throw fromDatabaseError(batch.error);
    const rows: BatchRow[] = z.array(batchRow).parse(batch.data ?? []);
    const plan = planBatch(rows, limit);
    const report: DocumentsMaintenanceResponse = {
      mode: applying ? "apply" : "dry-run",
      orphans: plan.orphans,
      due: plan.purge.map((p) => ({ tombstoneId: p.tombstoneId, reason: p.reason })),
      purged: 0,
      absent: 0,
      skipped: [],
      failed: 0,
    };
    if (!applying) return { data: report };

    let admin: SupabaseClient | null = null;
    for (const item of plan.purge) {
      const checked = await actor.client.rpc("document_purge_recheck", {
        p_tombstone_id: item.tombstoneId,
      });
      const recheck: Recheck | null = checked.error
        ? null
        : (z.array(recheckRow).parse(checked.data ?? [])[0] ?? null);
      const decision = decidePurge(item, recheck);
      if (!decision.delete) {
        report.skipped.push({ tombstoneId: item.tombstoneId, why: decision.why });
        continue;
      }
      admin ??= storageAdmin();
      const removed = await admin.storage
        .from(BUCKET)
        .remove([item.path])
        .catch(() => null);
      const outcome = outcomeOf(removed);
      const recorded = await actor.client.rpc("document_purge_record", {
        p_tombstone_id: item.tombstoneId,
        p_outcome: outcome,
        p_error: outcome === "failed" ? "storage_remove_failed" : null,
      });
      if (recorded.error) {
        // The object may be gone while the tombstone stays open: the next run finds it absent.
        logEvent({
          fn: FN,
          requestId: ctx.requestId,
          event: "purge_not_recorded",
          level: "warn",
          actorId: actor.id,
          documentId: item.tombstoneId,
        });
      }
      report[outcome] += 1;
    }
    return { data: report };
  },
});

if (import.meta.main) Deno.serve(handler);
