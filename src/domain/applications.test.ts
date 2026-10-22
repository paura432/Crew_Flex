import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  APPLICATION_TRANSITIONS,
  applyBlocker,
  availableTransitions,
  canFinish,
  findApplicationTransition,
  TERMINAL_APPLICATION_STATUSES,
} from "./applications";

describe("application transitions (D-06 contract, ratified 2026-10-22)", () => {
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

  it("the technician accepts, withdraws before confirmation and cancels a confirmed assignment (Q3)", () => {
    const tech = APPLICATION_TRANSITIONS.filter((t) => t.actor === "technician").map(
      (t) => `${t.from}>${t.to}`,
    );
    expect(tech.sort()).toEqual(
      [
        "received>withdrawn",
        "shortlisted>withdrawn",
        "proposed>accepted",
        "proposed>withdrawn",
        "accepted>withdrawn",
        "confirmed>cancelled",
      ].sort(),
    );
    expect(findApplicationTransition("received", "shortlisted", "technician")).toBeUndefined();
    expect(findApplicationTransition("confirmed", "withdrawn", "technician")).toBeUndefined();
  });

  it("a reason is required exactly for rejected and cancelled (V1.8 A:134)", () => {
    for (const t of APPLICATION_TRANSITIONS)
      expect([t.to, Boolean(t.reason)]).toEqual([t.to, ["rejected", "cancelled"].includes(t.to)]);
  });

  it("Q7: nobody rejects an accepted application; the organization cancels it (Q2) or re-proposes (R-08)", () => {
    for (const actor of ["organization", "technician"] as const)
      expect(findApplicationTransition("accepted", "rejected", actor)).toBeUndefined();
    expect(availableTransitions("accepted", "organization").map((t) => t.to)).toEqual([
      "proposed",
      "confirmed",
      "cancelled",
    ]);
  });

  it("Q4: only the organization finishes, and only a confirmed assignment", () => {
    expect(APPLICATION_TRANSITIONS.filter((t) => t.to === "finished")).toEqual([
      { from: "confirmed", to: "finished", actor: "organization" },
    ]);
    const endsAt = "2031-06-02T18:00:00.000Z";
    expect(canFinish({ endsAt }, Date.parse("2031-06-02T17:59:59Z"))).toBe(false);
    expect(canFinish({ endsAt }, Date.parse(endsAt))).toBe(true);
  });
});

describe("applyBlocker (Q5, Q6, T-08, T-09)", () => {
  const now = Date.parse("2031-01-01T00:00:00Z");
  const open = { status: "open" as const, startsAt: "2031-06-01T06:00:00.000Z" };

  it("an eligible technician with no application may apply", () => {
    expect(applyBlocker(open, [], true, now)).toBeNull();
  });

  it("only open requirements that have not started", () => {
    expect(applyBlocker({ ...open, status: "paused" }, [], true, now)).toBe("REQUIREMENT_NOT_OPEN");
    expect(applyBlocker({ ...open, status: "covered" }, [], true, now)).toBe(
      "REQUIREMENT_NOT_OPEN",
    );
    expect(applyBlocker(open, [], true, Date.parse(open.startsAt))).toBe("REQUIREMENT_STARTED");
  });

  it("Q5: again after withdrawn, never after rejected (nor cancelled or finished, T-09)", () => {
    expect(applyBlocker(open, ["withdrawn", "withdrawn"], true, now)).toBeNull();
    expect(applyBlocker(open, ["received"], true, now)).toBe("ALREADY_APPLIED");
    expect(applyBlocker(open, ["withdrawn", "accepted"], true, now)).toBe("ALREADY_APPLIED");
    for (const ended of ["rejected", "cancelled", "finished"] as const)
      expect(applyBlocker(open, ["withdrawn", ended], true, now)).toBe("REAPPLY_NOT_ALLOWED");
  });

  it("T-08: eligibility is required to apply", () => {
    expect(applyBlocker(open, [], false, now)).toBe("NOT_ELIGIBLE");
  });
});
