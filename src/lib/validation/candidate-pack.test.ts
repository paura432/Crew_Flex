import { describe, expect, it } from "vitest";
import { applicationPackQuery, isPackView, packPreviewQuery } from "./candidate-pack";

const ID = "00000000-0000-4000-8000-0000000000aa";

describe("Candidate Pack copy queries", () => {
  it("one application's copy by id; nothing else in the query", () => {
    expect(applicationPackQuery.parse({ view: "pack", applicationId: ID })).toEqual({
      view: "pack",
      applicationId: ID,
    });
    for (const bad of [
      { view: "pack" },
      { view: "pack", applicationId: "x" },
      { view: "pack", applicationId: ID, organizationId: ID },
      { view: "pack", applicationId: ID, userId: ID },
      { view: "pack", applicationId: ID, side: "organization" },
    ])
      expect(applicationPackQuery.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });

  it("the preview takes no parameter (always the caller's own data)", () => {
    expect(packPreviewQuery.parse({ view: "pack-preview" })).toEqual({ view: "pack-preview" });
    expect(packPreviewQuery.safeParse({ view: "pack-preview", profileId: ID }).success).toBe(false);
  });

  it("only its two views are routed here", () => {
    expect(isPackView("pack")).toBe(true);
    expect(isPackView("pack-preview")).toBe(true);
    for (const other of [null, "counts", "", "PACK"]) expect(isPackView(other)).toBe(false);
  });
});
