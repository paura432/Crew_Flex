import { describe, expect, it } from "vitest";
import {
  documentExpiryState,
  isDueForReview,
  canShareWithThirdParties,
  DOCUMENT_SCAN_STATUSES,
  DOCUMENT_TITLE_MAX,
  InvalidDocumentTitleError,
  MAX_DOCUMENT_BYTES,
  sanitizeDocumentTitle,
  sniffDocumentMime,
} from "./documents.ts";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === "string" ? [...new TextEncoder().encode(v)] : [v])),
  );

describe("sniffDocumentMime", () => {
  it.each([
    [bytes("%PDF-1.7\n%âãÏÓ\n"), "application/pdf"],
    [bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13), "image/png"],
    [bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, "JFIF"), "image/jpeg"],
  ] as const)("recognises %s by magic bytes", (input, expected) => {
    expect(sniffDocumentMime(input)).toBe(expected);
  });

  it.each([
    ["a Windows executable renamed .pdf", bytes("MZ", 0x90, 0, 3, 0)],
    ["plain text", bytes("hello, this is a licence")],
    ["HTML", bytes("<!doctype html><script>alert(1)</script>")],
    ["SVG", bytes('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ["PDF signature not at offset 0", bytes(" %PDF-1.7")],
    ["truncated PDF signature", bytes("%PDF")],
    ["truncated PNG signature", bytes(0x89, 0x50, 0x4e, 0x47)],
    ["truncated JPEG signature", bytes(0xff, 0xd8)],
    ["GIF", bytes("GIF89a")],
    ["empty", bytes()],
  ])("rejects %s", (_name, input) => {
    expect(sniffDocumentMime(input)).toBeNull();
  });
});

describe("sanitizeDocumentTitle", () => {
  it.each([
    ["  B1 licence  ", "B1 licence"],
    ["../../etc/passwd", ".. .. etc passwd"],
    ["C:\\Users\\me\\licence.pdf", "C: Users me licence.pdf"],
    ["\"quoted\" 'title' `x`", "quoted title x"],
    ["line\r\nbreak\ttab", "line break tab"],
    ["null\u0000byte", "null byte"],
    ["invoice\u202Efdp.exe", "invoice fdp.exe"], // right-to-left override spoofing
    ["zero\u200Bwidth", "zero width"],
    ["many     spaces", "many spaces"],
    ["Cafe\u0301", "Café"], // NFC
  ])("%j → %j", (input, expected) => {
    expect(sanitizeDocumentTitle(input)).toBe(expected);
  });

  it(`keeps at most ${DOCUMENT_TITLE_MAX} code points (emoji are not split)`, () => {
    expect(sanitizeDocumentTitle("a".repeat(500))).toHaveLength(DOCUMENT_TITLE_MAX);
    const emoji = sanitizeDocumentTitle("😀".repeat(200));
    expect(Array.from(emoji)).toHaveLength(DOCUMENT_TITLE_MAX);
  });

  it.each(["", "   ", "///", "\r\n", '""', "\u202E\u200B"])(
    "%j has nothing left → error code",
    (input) => {
      expect(() => sanitizeDocumentTitle(input)).toThrow(InvalidDocumentTitleError);
      try {
        sanitizeDocumentTitle(input);
      } catch (error) {
        expect((error as InvalidDocumentTitleError).code).toBe("v.document.title.required");
      }
    },
  );
});

describe("canShareWithThirdParties", () => {
  it("only a document an approved scanner marked clean could ever be shared", () => {
    expect(
      DOCUMENT_SCAN_STATUSES.filter((s) => canShareWithThirdParties({ scanStatus: s })),
    ).toEqual(["clean"]);
  });

  it("a new upload (not_scanned, the only value written today) is never shareable", () => {
    expect(canShareWithThirdParties({ scanStatus: "not_scanned" })).toBe(false);
  });
});

it("the size limit is 5 MiB (bucket file_size_limit and size_bytes CHECK)", () => {
  expect(MAX_DOCUMENT_BYTES).toBe(5_242_880);
});

describe("documentExpiryState (V1.8 documentStatus)", () => {
  const today = "2026-10-19";
  it.each([
    [null, "none"],
    ["2026-10-18", "expired"],
    ["2026-10-19", "soon"],
    ["2026-12-03", "soon"], // 45 days
    ["2026-12-04", "valid"], // 46 days
  ] as const)("%s → %s", (expiresAt, state) => {
    expect(documentExpiryState(expiresAt, today)).toBe(state);
  });
});

describe("isDueForReview (V1.8 Badges «próximos a revisar», 60 days, expired included)", () => {
  const today = "2026-10-20";
  it.each([
    [null, false],
    ["2020-01-01", true], // expired stays listed («Fecha superada»)
    ["2026-10-20", true],
    ["2026-12-19", true], // 60 days
    ["2026-12-20", false], // 61 days
  ] as const)("%s → %s", (expiresAt, due) => {
    expect(isDueForReview(expiresAt, today)).toBe(due);
  });
});
