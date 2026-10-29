import { assertEquals } from "@std/assert";
import { DOCUMENT_COLUMNS, handler, toBase64 } from "./index.ts";
import { toDocument } from "../professional-documents/index.ts";
import { closeAccountInput } from "../../../src/lib/validation/account.ts";

const silence = () => {
  const { log, error, warn } = console;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  return () => Object.assign(console, { log, error, warn });
};

for (const method of ["GET", "DELETE"] as const) {
  Deno.test(`account ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/account", {
        method,
        body: method === "GET" ? undefined : JSON.stringify({ confirm: "CERRAR", userId: "x" }),
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test("account has no POST/PATCH/PUT", async () => {
  const restore = silence();
  for (const method of ["POST", "PATCH", "PUT"]) {
    const res = await handler(new Request("http://fn/account", { method }));
    assertEquals(res.status, 405);
  }
  restore();
});

Deno.test(
  "closing needs exactly the confirmation word and nothing else (never an account id)",
  () => {
    assertEquals(closeAccountInput.safeParse({ confirm: "CERRAR" }).success, true);
    assertEquals(closeAccountInput.safeParse({ confirm: "CLOSE" }).success, true);
    for (const bad of [
      {},
      { confirm: "cerrar" },
      { confirm: "CERRAR " },
      { confirm: "CERRAR", userId: "00000000-0000-4000-8000-000000000011" },
    ]) {
      assertEquals(closeAccountInput.safeParse(bad).success, false, JSON.stringify(bad));
    }
  },
);

Deno.test("toBase64 round-trips small and multi-chunk files", () => {
  for (const size of [0, 1, 3, 0x8000 + 7, 100_000]) {
    const bytes = Uint8Array.from({ length: size }, (_, i) => (i * 31) % 256);
    const decoded = Uint8Array.from(atob(toBase64(bytes)), (c) => c.charCodeAt(0));
    assertEquals(decoded, bytes);
  }
  assertEquals(toBase64(new TextEncoder().encode("%PDF-1.4")), btoa("%PDF-1.4"));
});

Deno.test(
  "export rows carry every column toDocument reads (wallet-extras: a trashed document keeps its archivedAt)",
  () => {
    const columns = DOCUMENT_COLUMNS.split(",").map((c) => c.trim());
    const value: Record<string, unknown> = {
      id: "d1",
      kind: "other",
      title: "CV",
      mime_type: "application/pdf",
      size_bytes: 3,
      sha256: "c".repeat(64),
      expires_at: null,
      qualification_id: null,
      scan_status: "not_scanned",
      archived_at: "2026-10-22T08:00:00+00:00",
      created_at: "2026-10-20T08:00:00+00:00",
      updated_at: "2026-10-22T08:00:00+00:00",
      storage_path: "x/y",
    };
    // Exactly the selected columns, as PostgREST returns them.
    const raw = Object.fromEntries(columns.map((c) => [c, value[c]]));
    assertEquals(columns.includes("storage_path"), true);
    assertEquals(toDocument(raw).archivedAt, "2026-10-22T08:00:00.000Z");
  },
);
