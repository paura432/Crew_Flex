import { describe, expect, it } from "vitest";
import type { ProfessionalDocument } from "@/types/api";
import {
  trashPurgeDate,
  viewerFailure,
  viewerKind,
  walletList,
  walletView,
  WALLET_FILTERS,
} from "./map";

const doc = (
  id: string,
  kind: ProfessionalDocument["kind"],
  archivedAt: string | null = null,
): ProfessionalDocument => ({
  id,
  kind,
  title: id,
  mimeType: "application/pdf",
  sizeBytes: 1,
  sha256: "a".repeat(64),
  expiresAt: null,
  qualificationId: null,
  scanStatus: "not_scanned",
  archivedAt,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
});

const docs = [
  doc("lic", "license"),
  doc("course", "course"),
  doc("cv", "other"),
  doc("old-lic", "license", "2026-10-20T09:00:00.000Z"),
];

describe("wallet view model (N-19 trash, N-20 filter)", () => {
  it("only `trash` opens the trash; anything else is the wallet", () => {
    expect(walletView("trash")).toBe("trash");
    for (const raw of [undefined, "", "archived", ["trash"], "TRASH"]) {
      expect(walletView(raw)).toBe("active");
    }
  });

  it("the v1.8 tabs map to the three kinds, «Todos» first", () => {
    expect(WALLET_FILTERS).toEqual(["all", "license", "course", "other"]);
  });

  it("the wallet never shows archived documents and the trash shows only them; the counter follows the filter", () => {
    const all = walletList(docs, "active", "all");
    expect(all.shown.map((d) => d.id)).toEqual(["lic", "course", "cv"]);
    expect([all.inView, all.inTrash]).toEqual([3, 1]);
    expect(walletList(docs, "active", "license").shown.map((d) => d.id)).toEqual(["lic"]);
    expect(walletList(docs, "active", "other").shown.map((d) => d.id)).toEqual(["cv"]);
    const trash = walletList(docs, "trash", "all");
    expect(trash.shown.map((d) => d.id)).toEqual(["old-lic"]);
    // A filter with nothing of its type: empty list, but the view itself is not empty.
    const none = walletList(docs, "trash", "course");
    expect([none.shown.length, none.inView]).toEqual([0, 1]);
    expect(walletList([], "active", "all")).toEqual({ shown: [], inView: 0, inTrash: 0 });
    // A list from a function older than N-19 (no `archivedAt`) is all wallet, no trash.
    const legacy = [{ ...doc("x", "course"), archivedAt: undefined as unknown as null }];
    expect(walletList(legacy, "active", "all").shown).toHaveLength(1);
    expect(walletList(legacy, "trash", "all").inTrash).toBe(0);
  });

  it("the purge date is archive date + retention, as a UTC day", () => {
    expect(trashPurgeDate("2026-10-20T09:00:00.000Z", 30)).toBe("2026-11-19");
    expect(trashPurgeDate("2026-12-31T23:59:59.000Z", 1)).toBe("2027-01-01");
  });
});

describe("in-app viewer decisions (N-21)", () => {
  it("PDFs go to the frame, PNG/JPEG to an image", () => {
    expect(viewerKind("application/pdf")).toBe("pdf");
    expect(viewerKind("image/png")).toBe("image");
    expect(viewerKind("image/jpeg")).toBe("image");
  });

  it("an expired or refused link is «expired», a missing object or network failure «failed», 2xx shows the file", () => {
    expect(viewerFailure(200)).toBeNull();
    for (const status of [400, 401, 403]) expect(viewerFailure(status)).toBe("expired");
    for (const status of [404, 500, null]) expect(viewerFailure(status)).toBe("failed");
  });
});
