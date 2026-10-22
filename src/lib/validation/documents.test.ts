import { describe, expect, it } from "vitest";
import {
  documentIdQuery,
  documentUrlQuery,
  listDocumentsQuery,
  updateDocumentInput,
  uploadDocumentMetadata,
} from "./documents.ts";
import { toFieldErrors } from "./errors.ts";

const valid = {
  kind: "license",
  title: "  EASA Part-66 B1  ",
  expiresAt: "2030-01-31",
  qualificationId: "11111111-1111-4111-8111-111111111111",
};

const errorsFor = (input: unknown) => {
  const result = uploadDocumentMetadata.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
};

describe("uploadDocumentMetadata / updateDocumentInput", () => {
  it("accepts valid metadata and sanitises the title", () => {
    expect(uploadDocumentMetadata.parse(valid)).toEqual({ ...valid, title: "EASA Part-66 B1" });
    expect(
      uploadDocumentMetadata.parse({ ...valid, expiresAt: null, qualificationId: null }),
    ).toEqual({ ...valid, title: "EASA Part-66 B1", expiresAt: null, qualificationId: null });
  });

  it.each([
    [{ kind: "passport" }, "kind", "v.document.kind"],
    [{ title: "   " }, "title", "v.document.title.required"],
    [{ title: "///" }, "title", "v.document.title.required"],
    [{ title: 42 }, "title", "v.document.title.required"],
    [{ expiresAt: "31/01/2030" }, "expiresAt", "v.document.expiresAt"],
    [{ qualificationId: "not-a-uuid" }, "qualificationId", "v.document.qualificationId"],
  ])("rejects %o", (override, field, message) => {
    expect(errorsFor({ ...valid, ...override })[field]).toBe(message);
  });

  it("E. rejects caller-supplied ownership, storage and scan fields (strict)", () => {
    for (const extra of [
      { ownerId: "00000000-0000-4000-8000-000000000001" },
      { storagePath: "00000000-0000-4000-8000-000000000001/x" },
      { scanStatus: "clean" },
      { mimeType: "application/pdf" },
    ]) {
      expect(uploadDocumentMetadata.safeParse({ ...valid, ...extra }).success).toBe(false);
      expect(updateDocumentInput.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });

  it("an update requires every field", () => {
    expect(updateDocumentInput.safeParse({ kind: "other", title: "x" }).success).toBe(false);
  });
});

describe("document queries", () => {
  it("id must be a uuid; the url flag must be exactly 1", () => {
    expect(documentIdQuery.safeParse({ id: "x" }).success).toBe(false);
    expect(documentUrlQuery.safeParse({ id: valid.qualificationId, url: "1" }).success).toBe(true);
    expect(documentUrlQuery.safeParse({ id: valid.qualificationId, url: "true" }).success).toBe(
      false,
    );
    expect(
      documentUrlQuery.safeParse({ id: valid.qualificationId, url: "1", path: "../x" }).success,
    ).toBe(false);
  });
});

describe("documentsMaintenanceQuery", () => {
  it("is a dry-run by default and bounded", async () => {
    const { documentsMaintenanceQuery } = await import("./documents.ts");
    expect(documentsMaintenanceQuery.parse({})).toEqual({ limit: 25 });
    expect(documentsMaintenanceQuery.parse({ apply: "1", limit: "100" })).toEqual({
      apply: "1",
      limit: 100,
    });
    for (const bad of [{ apply: "true" }, { limit: "101" }, { limit: "0" }, { dryRun: "0" }]) {
      expect(documentsMaintenanceQuery.safeParse(bad).success).toBe(false);
    }
  });
});

describe("list view (N-19, review LOW-4)", () => {
  it("defaults to the wallet; only `active` or `trash`; nothing else is accepted", () => {
    expect(listDocumentsQuery.parse({})).toEqual({ view: "active" });
    expect(listDocumentsQuery.parse({ view: "trash" })).toEqual({ view: "trash" });
    expect(listDocumentsQuery.safeParse({ view: "archived" }).success).toBe(false);
    expect(listDocumentsQuery.safeParse({ view: "trash", ownerId: "x" }).success).toBe(false);
  });
});
