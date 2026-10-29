import { describe, expect, it } from "vitest";
import {
  ACTIVE_TRAINING_REQUEST_STATUSES,
  availableTrainingTransitions,
  centsToDecimal,
  decimalToCents,
  editionEnd,
  editionIssue,
  editionStart,
  findTrainingTransition,
  foldText,
  priceCents,
  spansOverlap,
  TERMINAL_TRAINING_REQUEST_STATUSES,
  TRAINING_CONFLICTS,
  TRAINING_REQUEST_STATUSES,
  TRAINING_TRANSITIONS,
} from "./training";

const NOW = Date.parse("2026-10-26T08:00:00Z");
const session = (start: string, end: string) => ({ startsAt: start, endsAt: end });
const onsite = {
  mode: "onsite" as const,
  provisional: false,
  deadline: null,
  sessions: [session("2026-11-20T08:00:00Z", "2026-11-20T16:00:00Z")],
};

describe("training request transitions (ADR-003, v1.9 training.mjs)", () => {
  it("terminal states have no way out; every active state has one", () => {
    for (const s of TRAINING_REQUEST_STATUSES) {
      const out = TRAINING_TRANSITIONS.filter((t) => t.from === s);
      expect([s, out.length > 0]).toEqual([s, !TERMINAL_TRAINING_REQUEST_STATUSES.includes(s)]);
      expect(
        ACTIVE_TRAINING_REQUEST_STATUSES.includes(s) ||
          TERMINAL_TRAINING_REQUEST_STATUSES.includes(s),
      ).toBe(true);
    }
  });

  it("every state is reachable from received", () => {
    const seen = new Set(["received"]);
    for (let grew = true; grew;) {
      grew = false;
      for (const t of TRAINING_TRANSITIONS)
        if (seen.has(t.from) && !seen.has(t.to)) grew = seen.add(t.to).size > 0;
    }
    expect([...seen].sort()).toEqual([...TRAINING_REQUEST_STATUSES].sort());
  });

  it("reject and cancel need a reason; the professional accepts, withdraws and cancels a confirmed seat", () => {
    for (const t of TRAINING_TRANSITIONS) {
      expect(t.reason === true).toBe(t.to === "rejected" || t.to === "cancelled");
    }
    expect(findTrainingTransition("offered", "accepted", "professional")).toBeDefined();
    expect(findTrainingTransition("offered", "accepted", "provider")).toBeUndefined();
    expect(findTrainingTransition("accepted", "confirmed", "provider")).toBeDefined();
    expect(findTrainingTransition("accepted", "confirmed", "professional")).toBeUndefined();
    expect(findTrainingTransition("confirmed", "cancelled", "professional")?.reason).toBe(true);
    expect(findTrainingTransition("confirmed", "finished", "provider")).toBeDefined();
    expect(findTrainingTransition("received", "confirmed", "provider")).toBeUndefined();
  });

  it("system rows cancel every active request when an edition is cancelled, nothing else", () => {
    const system = TRAINING_TRANSITIONS.filter((t) => t.actor === "system");
    expect(system.map((t) => t.from).sort()).toEqual([...ACTIVE_TRAINING_REQUEST_STATUSES].sort());
    expect(system.every((t) => t.to === "cancelled" && t.reason)).toBe(true);
  });

  it("an inquiry is only closed, rejected or withdrawn; a seat is never closed", () => {
    expect(
      availableTrainingTransitions("received", "provider", "inquiry").map((t) => t.to),
    ).toEqual(["rejected", "closed"]);
    expect(availableTrainingTransitions("received", "provider", "seat").map((t) => t.to)).toEqual([
      "waitlisted",
      "offered",
      "rejected",
    ]);
    expect(
      availableTrainingTransitions("received", "professional", "inquiry").map((t) => t.to),
    ).toEqual(["withdrawn"]);
  });

  it("the conflict codes are append-only and CFT12 is the closure guard", () => {
    expect(TRAINING_CONFLICTS[0]).toBe("EDITION_NOT_AVAILABLE");
    expect(TRAINING_CONFLICTS[11]).toBe("ACTIVE_TRAINING_SEATS");
    expect(new Set(TRAINING_CONFLICTS).size).toBe(TRAINING_CONFLICTS.length);
  });
});

describe("prices in integer cents (OD-7: no float, no payment)", () => {
  it("per person ignores units; per engine/module multiplies; quote is null", () => {
    expect(priceCents({ priceUnit: "person", priceCents: 20000 }, 3)).toBe(20000);
    expect(priceCents({ priceUnit: "engine", priceCents: 25000 }, 2)).toBe(50000);
    expect(priceCents({ priceUnit: "module", priceCents: 999 }, 3)).toBe(2997);
    expect(priceCents({ priceUnit: "quote", priceCents: null })).toBeNull();
    expect(() => priceCents({ priceUnit: "engine", priceCents: 100 }, 0)).toThrow(RangeError);
  });

  it("converts decimals both ways without floating point surprises", () => {
    expect(decimalToCents("250")).toBe(25000);
    expect(decimalToCents("0,1")).toBe(10);
    expect(decimalToCents("19.99")).toBe(1999);
    expect(decimalToCents("1.999")).toBeNull();
    expect(decimalToCents("-5")).toBeNull();
    expect(centsToDecimal(1999)).toBe("19.99");
    expect(centsToDecimal(5)).toBe("0.05");
  });
});

describe("edition validation (v1.9 normalizeEdition)", () => {
  it("accepts a live edition with future sessions and reports its bounds", () => {
    expect(editionIssue(onsite, NOW)).toBeNull();
    expect(editionStart(onsite)).toBe("2026-11-20T08:00:00Z");
    expect(editionEnd(onsite)).toBe("2026-11-20T16:00:00Z");
  });

  it("refuses sessions that end before they start, exceed 24 h or overlap", () => {
    expect(
      editionIssue(
        { ...onsite, sessions: [session("2026-11-20T16:00:00Z", "2026-11-20T08:00:00Z")] },
        NOW,
      ),
    ).toBe("SESSION_ORDER");
    expect(
      editionIssue(
        { ...onsite, sessions: [session("2026-11-20T08:00:00Z", "2026-11-21T09:00:00Z")] },
        NOW,
      ),
    ).toBe("SESSION_TOO_LONG");
    expect(
      editionIssue({ ...onsite, sessions: [onsite.sessions[0]!, onsite.sessions[0]!] }, NOW),
    ).toBe("SESSIONS_OVERLAP");
    expect(editionIssue({ ...onsite, sessions: Array(61).fill(onsite.sessions[0]) }, NOW)).toBe(
      "SESSIONS_TOO_MANY",
    );
  });

  it("self-paced has no sessions and needs a deadline; confirmed dates need a session; dates are ahead", () => {
    expect(editionIssue({ ...onsite, mode: "selfpaced" }, NOW)).toBe("SELFPACED_HAS_SESSIONS");
    expect(editionIssue({ ...onsite, mode: "selfpaced", sessions: [] }, NOW)).toBe(
      "DEADLINE_REQUIRED",
    );
    expect(
      editionIssue(
        { ...onsite, mode: "selfpaced", sessions: [], deadline: "2027-01-31T23:00:00Z" },
        NOW,
      ),
    ).toBeNull();
    expect(editionIssue({ ...onsite, sessions: [] }, NOW)).toBe("SESSIONS_REQUIRED");
    expect(editionIssue({ ...onsite, sessions: [], provisional: true }, NOW)).toBeNull();
    expect(editionIssue(onsite, Date.parse("2026-11-21T00:00:00Z"))).toBe("DATES_PAST");
    expect(
      editionStart({
        ...onsite,
        mode: "selfpaced",
        sessions: [],
        deadline: "2027-01-31T23:00:00Z",
      }),
    ).toBe("2027-01-31T23:00:00Z");
  });

  it("overlaps are hour-based: adjacent ranges do not touch", () => {
    expect(
      spansOverlap(
        session("2026-11-20T08:00Z", "2026-11-20T16:00Z"),
        session("2026-11-20T16:00Z", "2026-11-20T18:00Z"),
      ),
    ).toBe(false);
    expect(
      spansOverlap(
        session("2026-11-20T08:00Z", "2026-11-20T16:00Z"),
        session("2026-11-20T15:59Z", "2026-11-20T18:00Z"),
      ),
    ).toBe(true);
  });

  it("folds accents and case like the catalog query", () => {
    expect(foldText("FACTORES HUMANOS · Formación Aérea")).toBe(
      "factores humanos · formacion aerea",
    );
  });
});
