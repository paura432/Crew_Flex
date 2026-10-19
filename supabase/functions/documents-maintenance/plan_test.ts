import { assertEquals } from "@std/assert";
import { decidePurge, outcomeOf, planBatch } from "./plan.ts";

const U = "00000000-0000-4000-8000-000000000021";
const path = (n: number) => `${U}/6f1c2a52-7b8e-4c1e-9a3f-0d2b5e8c4a1${n}-0123456789abcdef`;

Deno.test("planBatch: dry-run orphans are counted, never purged", () => {
  const plan = planBatch(
    [
      {
        tombstone_id: null,
        storage_path: path(1),
        reason: "orphan_upload",
        action: "would_tombstone",
      },
      { tombstone_id: "t2", storage_path: path(2), reason: "owner_delete", action: "purge" },
    ],
    10,
  );
  assertEquals(plan, {
    orphans: 1,
    purge: [{ tombstoneId: "t2", path: path(2), reason: "owner_delete" }],
  });
});

Deno.test("planBatch: drops malformed paths and duplicates, honours the limit", () => {
  const plan = planBatch(
    [
      { tombstone_id: "a", storage_path: "../etc/passwd", reason: "owner_delete", action: "purge" },
      { tombstone_id: "b", storage_path: `${U}/sub/x`, reason: "owner_delete", action: "purge" },
      { tombstone_id: "c", storage_path: path(3), reason: "owner_delete", action: "purge" },
      { tombstone_id: "c", storage_path: path(3), reason: "owner_delete", action: "purge" },
      { tombstone_id: "d", storage_path: path(4), reason: "account_deleted", action: "purge" },
      { tombstone_id: "e", storage_path: path(5), reason: "owner_delete", action: "purge" },
    ],
    2,
  );
  assertEquals(
    plan.purge.map((p) => p.tombstoneId),
    ["c", "d"],
  );
});

Deno.test(
  "decidePurge: deletes only what the fresh database re-check allows, for the same path",
  () => {
    const item = { tombstoneId: "t", path: path(1), reason: "owner_delete" };
    assertEquals(decidePurge(item, { storage_path: path(1), allowed: true, why: "ok" }), {
      delete: true,
    });
    for (const why of ["referenced", "legal_hold", "already_purged", "not_due"]) {
      assertEquals(decidePurge(item, { storage_path: path(1), allowed: false, why }), {
        delete: false,
        why,
      });
    }
    assertEquals(decidePurge(item, null), { delete: false, why: "no_recheck" });
    assertEquals(decidePurge(item, { storage_path: path(2), allowed: true, why: "ok" }), {
      delete: false,
      why: "path_mismatch",
    });
    const bad = { ...item, path: `${U}/../x/y` };
    assertEquals(decidePurge(bad, { storage_path: bad.path, allowed: true, why: "ok" }), {
      delete: false,
      why: "invalid_path",
    });
  },
);

Deno.test("outcomeOf: removed → purged, nothing removed → absent, error → failed", () => {
  assertEquals(outcomeOf({ data: [{ name: "x" }], error: null }), "purged");
  assertEquals(outcomeOf({ data: [], error: null }), "absent");
  assertEquals(outcomeOf({ data: null, error: new Error("x") }), "failed");
  assertEquals(outcomeOf(null), "failed");
});
