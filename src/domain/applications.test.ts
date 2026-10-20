import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  APPLICATION_TRANSITIONS,
  findApplicationTransition,
  TERMINAL_APPLICATION_STATUSES,
} from "./applications";

describe("application transitions (D-06 contract, pure table)", () => {
  it("terminal states have no way out; every other state has one", () => {
    for (const s of APPLICATION_STATUSES) {
      const out = APPLICATION_TRANSITIONS.filter((t) => t.from === s);
      expect([s, out.length > 0]).toEqual([s, !TERMINAL_APPLICATION_STATUSES.includes(s)]);
    }
  });

  it("every state is reachable from received", () => {
    const seen = new Set(["received"]);
    for (let grew = true; grew;) {
      grew = false;
      for (const t of APPLICATION_TRANSITIONS)
        if (seen.has(t.from) && !seen.has(t.to)) grew = seen.add(t.to).size > 0;
    }
    expect([...seen].sort()).toEqual([...APPLICATION_STATUSES].sort());
  });

  it("V1.8 A:115-117: the technician only accepts or withdraws (plus the unratified Q3 cancel)", () => {
    const tech = APPLICATION_TRANSITIONS.filter((t) => t.actor === "technician");
    expect(new Set(tech.filter((t) => !t.pending).map((t) => t.to))).toEqual(
      new Set(["accepted", "withdrawn"]),
    );
    expect(findApplicationTransition("received", "shortlisted", "technician")).toBeUndefined();
    expect(findApplicationTransition("confirmed", "withdrawn", "technician")).toBeUndefined();
  });

  it("a reason is required exactly for rejected and cancelled (V1.8 A:134)", () => {
    for (const t of APPLICATION_TRANSITIONS)
      expect([t.to, Boolean(t.reason)]).toEqual([t.to, ["rejected", "cancelled"].includes(t.to)]);
  });

  it("rows depending on unratified owner proposals are marked, and only those (Q2–Q4)", () => {
    expect(
      APPLICATION_TRANSITIONS.filter((t) => t.pending).map((t) => `${t.from}>${t.to}:${t.pending}`),
    ).toEqual([
      "accepted>cancelled:Q2",
      "confirmed>finished:Q4",
      "confirmed>cancelled:Q3",
      "confirmed>cancelled:Q3",
    ]);
  });

  it("R-08 (decided): after acceptance the organization can only re-propose as a new version", () => {
    expect(
      findApplicationTransition("accepted", "proposed", "organization")?.pending,
    ).toBeUndefined();
  });
});
