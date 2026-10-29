import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES } from "./applications";
import {
  contactVisible,
  documentAccessible,
  hasPackCopy,
  PACK_ACTIVATION,
  PACK_EXPERIENCE_MAX,
  packCourseState,
  packWithheld,
  splitPackQualifications,
  type PackDocument,
  type PackQualification,
} from "./candidate-pack";

const on = { contact: true, documents: true };
const both = { contact: true, documents: true };
const clean: PackDocument = {
  selected: true,
  deleted: false,
  scanStatus: "clean",
  expiresAt: null,
};
const today = "2026-10-22";

describe("Candidate Pack (D-07) — prepared, not activated", () => {
  it("nothing is shared while the owner has not activated it (P3 and the scanner are open)", () => {
    expect(PACK_ACTIVATION).toEqual({ contact: false, documents: false });
    for (const status of APPLICATION_STATUSES) {
      expect(contactVisible(status, both)).toBe(false);
      expect(documentAccessible(status, both, clean, today)).toBe(false);
    }
  });

  it("P1/P4: contact and identity only from accepted/confirmed and with the contact consent", () => {
    const visible = APPLICATION_STATUSES.filter((s) => contactVisible(s, both, on));
    expect(visible).toEqual(["accepted", "confirmed"]);
    expect(contactVisible("accepted", { contact: false, documents: true }, on)).toBe(false);
  });

  it("the two consents are independent", () => {
    expect(contactVisible("accepted", { contact: true, documents: false }, on)).toBe(true);
    expect(
      documentAccessible("accepted", { contact: true, documents: false }, clean, today, on),
    ).toBe(false);
  });

  it("P2: only selected, kept, scanned-clean and unexpired documents", () => {
    const ok = (doc: Partial<PackDocument>) =>
      documentAccessible("confirmed", both, { ...clean, ...doc }, today, on);
    expect(ok({})).toBe(true);
    expect(ok({ selected: false })).toBe(false);
    expect(ok({ deleted: true })).toBe(false);
    expect(ok({ scanStatus: "not_scanned" })).toBe(false);
    expect(ok({ scanStatus: "infected" })).toBe(false);
    expect(ok({ expiresAt: "2026-10-21" })).toBe(false);
    expect(ok({ expiresAt: "2026-10-22" })).toBe(true);
  });

  it("a cancelled or finished application locks everything again", () => {
    for (const status of ["cancelled", "finished", "withdrawn", "rejected"] as const) {
      expect(contactVisible(status, both, on)).toBe(false);
      expect(documentAccessible(status, both, clean, today, on)).toBe(false);
    }
  });
});

describe("the dated copy (v2-15, BR-25)", () => {
  const q = (code: string, category: PackQualification["category"], expiresAt: string | null) =>
    ({ code, name: code, category, verificationStatus: "verified", expiresAt }) as const;

  it("declares identity, contact and documents withheld while PACK_ACTIVATION is off", () => {
    expect(packWithheld()).toBe(true);
    expect(packWithheld({ contact: true, documents: false })).toBe(true);
    expect(packWithheld({ contact: false, documents: true })).toBe(true);
    expect(packWithheld(on)).toBe(false);
  });

  it("courses are the TRAINING qualifications, with the v1.8 state at reading time", () => {
    const list = [q("B1.1", "LICENSE", "2030-01-01"), q("EWIS", "TRAINING", "2026-11-01")];
    const { courses, others } = splitPackQualifications(list);
    expect(courses.map((c) => c.code)).toEqual(["EWIS"]);
    expect(others.map((c) => c.code)).toEqual(["B1.1"]);
    expect(packCourseState(courses[0]!, today)).toBe("soon");
    expect(packCourseState(courses[0]!, "2026-11-02")).toBe("expired");
    expect(packCourseState(q("HF", "TRAINING", null), today)).toBe("none");
    expect(packCourseState(q("HF", "TRAINING", "2030-01-01"), today)).toBe("valid");
  });

  it("copies at most 20 logbook entries", () => {
    expect(PACK_EXPERIENCE_MAX).toBe(20);
  });

  it("ending without an engagement drops the copy; finished keeps it (T-113)", () => {
    expect(APPLICATION_STATUSES.filter((s) => !hasPackCopy(s))).toEqual([
      "rejected",
      "withdrawn",
      "cancelled",
    ]);
    expect(hasPackCopy("finished")).toBe(true);
  });
});
