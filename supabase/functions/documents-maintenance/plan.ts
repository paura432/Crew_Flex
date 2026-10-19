// Pure planning for `documents-maintenance` (no I/O): what the batch RPC returned → what to do, and
// the per-object decision taken right before a Storage delete. Unit-tested in plan_test.ts.

/** Server-derived object names only: `<uuid>/<anything without a slash>`. */
const OBJECT_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]{1,200}$/;

export interface BatchRow {
  tombstone_id: string | null;
  storage_path: string;
  reason: string;
  action: "would_tombstone" | "purge" | string;
}

export interface PurgeItem {
  tombstoneId: string;
  path: string;
  reason: string;
}

export interface Plan {
  orphans: number;
  purge: PurgeItem[];
}

/** Splits the batch, drops malformed rows and duplicates, keeps at most `limit` purges. */
export function planBatch(rows: BatchRow[], limit: number): Plan {
  const seen = new Set<string>();
  const purge: PurgeItem[] = [];
  let orphans = 0;
  for (const row of rows) {
    if (!OBJECT_PATH.test(row.storage_path)) continue;
    if (row.action === "would_tombstone" || row.reason === "orphan_upload") orphans += 1;
    if (row.action !== "purge" || !row.tombstone_id || seen.has(row.tombstone_id)) continue;
    seen.add(row.tombstone_id);
    if (purge.length < limit) {
      purge.push({ tombstoneId: row.tombstone_id, path: row.storage_path, reason: row.reason });
    }
  }
  return { orphans, purge };
}

export interface Recheck {
  storage_path: string;
  allowed: boolean;
  why: string;
}

export type Decision = { delete: true } | { delete: false; why: string };

/**
 * Last gate before the Storage delete: the database re-check (fresh, under a row lock) must allow
 * it AND name the very same, well-formed path that was planned.
 */
export function decidePurge(item: PurgeItem, recheck: Recheck | null): Decision {
  if (!recheck) return { delete: false, why: "no_recheck" };
  if (recheck.storage_path !== item.path) return { delete: false, why: "path_mismatch" };
  if (!OBJECT_PATH.test(recheck.storage_path)) return { delete: false, why: "invalid_path" };
  if (!recheck.allowed) return { delete: false, why: recheck.why || "refused" };
  return { delete: true };
}

/** Storage `remove` result → recorded outcome. */
export function outcomeOf(
  removed: { data: unknown[] | null; error: unknown } | null,
): "purged" | "absent" | "failed" {
  if (!removed || removed.error) return "failed";
  return (removed.data?.length ?? 0) > 0 ? "purged" : "absent";
}
