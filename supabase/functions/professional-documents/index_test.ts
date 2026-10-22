import { assertEquals } from "@std/assert";
import { ApiError } from "../_shared/errors.ts";
import {
  documentPatch,
  handler,
  MULTIPART_OVERHEAD_BYTES,
  objectPath,
  parseUpload,
  publicSignedUrl,
  readBodyCapped,
  sha256Hex,
  toDocument,
} from "./index.ts";
import { MAX_DOCUMENT_BYTES } from "../../../src/domain/documents.ts";

const silence = () => {
  const { log, error, warn } = console;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  return () => Object.assign(console, { log, error, warn });
};

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

function multipart(parts: [string, string | Blob, string?][]): Request {
  const form = new FormData();
  for (const [name, value, filename] of parts) {
    if (typeof value === "string") form.append(name, value);
    else form.append(name, value, filename);
  }
  return new Request("http://fn/professional-documents", { method: "POST", body: form });
}

const apiError = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return { code: error.code, issues: error.issues };
    throw error;
  }
  throw new Error("expected an ApiError");
};

for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
  Deno.test(`professional-documents ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      method === "POST"
        ? multipart([
            ["file", new Blob([PDF]), "licence.pdf"],
            ["kind", "license"],
          ])
        : new Request("http://fn/professional-documents?id=22222222-2222-4222-8222-000000000001", {
            method,
            body: method === "GET" ? undefined : JSON.stringify({ ownerId: "x" }),
          }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test("professional-documents exposes its four methods in CORS preflight", async () => {
  const restore = silence();
  const previousOrigins = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
  const res = await handler(
    new Request("http://fn/professional-documents", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  const blocked = await handler(
    new Request("http://fn/professional-documents", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    }),
  );
  if (previousOrigins === undefined) Deno.env.delete("ALLOWED_ORIGINS");
  else Deno.env.set("ALLOWED_ORIGINS", previousOrigins);
  restore();
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods"),
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  assertEquals(blocked.headers.get("Access-Control-Allow-Origin"), null);
});

Deno.test("PUT is not a method of professional-documents", async () => {
  const restore = silence();
  const res = await handler(new Request("http://fn/professional-documents", { method: "PUT" }));
  restore();
  assertEquals(res.status, 405);
});

Deno.test(
  "upload: a declared Content-Length over the limit is refused before reading",
  async () => {
    const req = new Request("http://fn/professional-documents", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
        "content-length": String(MAX_DOCUMENT_BYTES + MULTIPART_OVERHEAD_BYTES + 1),
      },
      body: "--x--",
    });
    assertEquals((await apiError(parseUpload(req))).code, "PAYLOAD_TOO_LARGE");
  },
);

Deno.test(
  "upload: the actual bytes are capped even without a truthful Content-Length",
  async () => {
    const big = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
    big.set(PDF);
    assertEquals(
      (await apiError(parseUpload(multipart([["file", new Blob([big]), "big.pdf"]])))).code,
      "PAYLOAD_TOO_LARGE",
    );
    const stream = new Request("http://fn", { method: "POST", body: new Uint8Array(1025) });
    assertEquals((await apiError(readBodyCapped(stream, 1024))).code, "PAYLOAD_TOO_LARGE");
  },
);

Deno.test("upload: unknown, duplicated or missing parts are validation errors", async () => {
  const file: [string, Blob, string] = ["file", new Blob([PDF]), "l.pdf"];
  for (const parts of [
    [file, ["ownerId", "00000000-0000-4000-8000-000000000001"]],
    [file, ["storagePath", "../x"]],
    [file, ["kind", "license"], ["kind", "other"]],
    [file, ["file", new Blob([PDF]), "second.pdf"]],
    [["kind", "license"]],
    [["file", new Blob([]), "empty.pdf"]],
  ] as [string, string | Blob, string?][][]) {
    assertEquals((await apiError(parseUpload(multipart(parts)))).code, "VALIDATION_ERROR");
  }
  const json = new Request("http://fn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assertEquals((await apiError(parseUpload(json))).issues?.[0]?.message, "v.document.file.form");
});

Deno.test("upload: the file and the fields are read; empty fields become null", async () => {
  const parsed = await parseUpload(
    multipart([
      ["file", new Blob([PDF]), "../../licence.pdf"],
      ["kind", "license"],
      ["expiresAt", ""],
    ]),
  );
  assertEquals(parsed.bytes, PDF);
  assertEquals(parsed.fields, { kind: "license", expiresAt: null });
});

Deno.test("object path: owner folder, key and hash prefix only — no user text", async () => {
  const sha = await sha256Hex(new TextEncoder().encode("abc"));
  assertEquals(sha, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assertEquals(
    objectPath("00000000-0000-4000-8000-000000000023", "6f1c2a52-7b8e-4c1e-9a3f-0d2b5e8c4a11", sha),
    "00000000-0000-4000-8000-000000000023/6f1c2a52-7b8e-4c1e-9a3f-0d2b5e8c4a11-ba7816bf8f01cfea",
  );
});

Deno.test("signed URL origin is rewritten only when STORAGE_PUBLIC_URL is a bare origin", () => {
  const signed = "http://kong:8000/storage/v1/object/sign/professional-documents/a/b?token=t";
  const previous = Deno.env.get("STORAGE_PUBLIC_URL");
  Deno.env.delete("STORAGE_PUBLIC_URL");
  assertEquals(publicSignedUrl(signed), signed);
  Deno.env.set("STORAGE_PUBLIC_URL", "http://127.0.0.1:56321");
  assertEquals(
    publicSignedUrl(signed),
    "http://127.0.0.1:56321/storage/v1/object/sign/professional-documents/a/b?token=t",
  );
  Deno.env.set("STORAGE_PUBLIC_URL", "http://127.0.0.1:56321/evil/path");
  assertEquals(publicSignedUrl(signed), signed);
  if (previous === undefined) Deno.env.delete("STORAGE_PUBLIC_URL");
  else Deno.env.set("STORAGE_PUBLIC_URL", previous);
});

Deno.test(
  "rows map to the API contract (no storage path, ISO timestamps, date-only expiry)",
  () => {
    assertEquals(
      toDocument({
        id: "d1",
        kind: "course",
        title: "Human factors",
        mime_type: "image/png",
        size_bytes: 120,
        sha256: "a".repeat(64),
        expires_at: "2030-01-31",
        qualification_id: null,
        scan_status: "not_scanned",
        archived_at: null,
        created_at: "2026-10-19T10:00:00+00:00",
        updated_at: "2026-10-19T10:00:00+00:00",
      }),
      {
        id: "d1",
        kind: "course",
        title: "Human factors",
        mimeType: "image/png",
        sizeBytes: 120,
        sha256: "a".repeat(64),
        expiresAt: "2030-01-31",
        qualificationId: null,
        scanStatus: "not_scanned",
        archivedAt: null,
        createdAt: "2026-10-19T10:00:00.000Z",
        updatedAt: "2026-10-19T10:00:00.000Z",
      },
    );
  },
);

Deno.test("N-19: an archived row maps its trash date to ISO", () => {
  const doc = toDocument({
    id: "d2",
    kind: "other",
    title: "CV",
    mime_type: "application/pdf",
    size_bytes: 10,
    sha256: "b".repeat(64),
    expires_at: null,
    qualification_id: null,
    scan_status: "not_scanned",
    archived_at: "2026-10-22T08:30:00+00:00",
    created_at: "2026-10-19T10:00:00+00:00",
    updated_at: "2026-10-22T08:30:00+00:00",
  });
  assertEquals(doc.archivedAt, "2026-10-22T08:30:00.000Z");
});

Deno.test(
  "N-19 PATCH: { archived } archives or restores (marker only); metadata bodies are unchanged; mixes are refused",
  async () => {
    const archived = documentPatch({ archived: true });
    assertEquals(Object.keys(archived), ["archived_at"]);
    assertEquals(typeof archived.archived_at, "string");
    assertEquals(documentPatch({ archived: false }), { archived_at: null });
    assertEquals(
      documentPatch({
        kind: "course",
        title: "  Human\u202Efactors ",
        expiresAt: null,
        qualificationId: null,
      }),
      { kind: "course", title: "Human factors", expires_at: null, qualification_id: null },
    );
    // Strict both ways: archiving never carries metadata (or ownership), metadata never `archivedAt`.
    for (const body of [
      { archived: true, title: "x" },
      { archived: "yes" },
      { archived: true, ownerId: "x" },
      { kind: "course", title: "x", expiresAt: null, qualificationId: null, archivedAt: null },
      null,
      [],
    ]) {
      const error = await (async () => {
        try {
          documentPatch(body);
        } catch (e) {
          return e;
        }
      })();
      assertEquals((error as ApiError).code, "VALIDATION_ERROR", JSON.stringify(body));
    }
  },
);
