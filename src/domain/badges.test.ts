import { describe, expect, it } from "vitest";
import { aircraftShort, badges, primaryBadges, verifiedCodes, type BadgeInput } from "./badges";

const TODAY = "2026-10-23";
const none: BadgeInput = {
  yearsExperience: null,
  primaryCategory: null,
  categories: [],
  skills: [],
  typeRatings: [],
  verifiedCodes: new Set(),
};

describe("badges (v1.8 progress.js badges, N-15)", () => {
  it("an empty passport has no medals", () => {
    expect(badges(none, TODAY)).toEqual([]);
    expect(badges({ ...none, yearsExperience: 0 }, TODAY)).toEqual([]);
  });

  it("v1.8 runtime «8 AÑOS · B1.1 · A320 · SM · +3»: main strip and the rest behind +N", () => {
    const all = badges(
      {
        yearsExperience: 8,
        primaryCategory: "B1.1",
        categories: ["B1.1", "B2", "SHEET-METAL"],
        skills: ["ndt", "sheet_metal", "line_maintenance"],
        typeRatings: [
          { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restrictions: null },
          { aircraft: "ATR 72", category: "B2", expiresAt: null, restrictions: null },
        ],
        verifiedCodes: new Set(),
      },
      TODAY,
    );
    // categories (main first), the NDT skill (Sheet Metal is already a category), ratings, experience
    expect(all.map((b) => b.id)).toEqual([
      "cat-B1.1",
      "cat-B2",
      "cat-SHEET-METAL",
      "skill-NDT",
      "rating-A320 Family-B1.1",
      "rating-ATR 72-B2",
      "experience",
    ]);
    const { primary, others } = primaryBadges(all);
    expect(primary.map((b) => b.id)).toEqual([
      "experience",
      "cat-B1.1",
      "rating-A320 Family-B1.1",
      "cat-SHEET-METAL",
    ]);
    expect(others).toHaveLength(3);
    expect(all.find((b) => b.id === "cat-SHEET-METAL")?.kind).toBe("specialty");
    expect(all.find((b) => b.id === "skill-NDT")).toMatchObject({
      kind: "specialty",
      fromSkill: true,
    });
  });

  it("the main category leads even when the catalog order puts it later", () => {
    const all = badges({ ...none, primaryCategory: "B2", categories: ["B1.1", "B2"] }, TODAY);
    expect(all.map((b) => b.id)).toEqual(["cat-B2", "cat-B1.1"]);
  });

  it("rating states: an ended validity is «Revisar vigencia» before «Con restricciones»", () => {
    const all = badges(
      {
        ...none,
        typeRatings: [
          {
            aircraft: "A330",
            category: "B1.1",
            expiresAt: "2026-10-22",
            restrictions: "No engine run",
          },
          { aircraft: "A350", category: "B1.1", expiresAt: TODAY, restrictions: "  Cabin only  " },
          { aircraft: "B787", category: "B2", expiresAt: null, restrictions: "   " },
        ],
      },
      TODAY,
    );
    expect(all.map((b) => [b.aircraft, b.status, b.restrictions])).toEqual([
      ["A330", "reviewValidity", undefined],
      ["A350", "restricted", "Cabin only"],
      ["B787", "typeDeclared", undefined],
    ]);
  });

  it("«Verificada» (Next) only for a category whose qualification a reviewer verified", () => {
    const all = badges(
      {
        ...none,
        primaryCategory: "B1.1",
        categories: ["B1.1", "B2"],
        verifiedCodes: new Set(["B1.1"]),
      },
      TODAY,
    );
    expect(all.map((b) => b.status)).toEqual(["verified", "declared"]);
  });

  it("the medal shows «A320» for «A320 Family»", () => {
    expect(aircraftShort("A320 Family")).toBe("A320");
    expect(aircraftShort("B737 MAX")).toBe("B737 MAX");
  });

  it("verifiedCodes: held, verified and not expired today", () => {
    const q = (
      code: string,
      over: Partial<{ status: string; verificationStatus: string; expiresAt: string | null }> = {},
    ) => ({
      code,
      status: "active",
      verificationStatus: "verified",
      expiresAt: null,
      ...over,
    });
    const codes = verifiedCodes(
      [
        q("B1.1"),
        q("B2", { expiresAt: TODAY }),
        q("B1.3", { expiresAt: "2026-10-22" }),
        q("CAT-A", { verificationStatus: "pending" }),
        q("NDT", { status: "withdrawn" }),
      ],
      TODAY,
    );
    expect([...codes]).toEqual(["B1.1", "B2"]);
  });
});
