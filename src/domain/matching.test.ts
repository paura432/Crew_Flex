import { describe, expect, it } from "vitest";
import {
  candidate,
  FULL_HARD_SET,
  held,
  madRequirement,
  QT,
  required,
} from "../../fixtures/domain";
import { compareMatches, evaluateMatch } from "./matching.ts";

const requirement = madRequirement();

describe("evaluateMatch — hard filters", () => {
  it("1. all hard requirements fulfilled → eligible", () => {
    const result = evaluateMatch(requirement, candidate("c1"));
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.reasons).toContainEqual({ code: "HARD_QUALIFICATIONS_MET", count: 5 });
    expect(result.reasons).toContainEqual({ code: "AVAILABILITY_COVERS_REQUIREMENT" });
  });

  it("2. missing hard qualification → not eligible, score 0", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c2", {
        qualifications: [
          ...FULL_HARD_SET.filter((q) => q.qualificationTypeId !== QT.B11),
          held(QT.SMS),
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      { code: "MISSING_HARD_QUALIFICATION", qualification: "B1.1" },
    ]);
    expect(result.softScore).toBe(0);
  });

  it("2b. a high soft score never compensates a missing hard requirement", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c2b", { qualifications: [held(QT.SMS), held(QT.A320)] }),
    );
    expect(result.eligible).toBe(false);
    expect(result.softScore).toBe(0);
    expect(result.reasons).toContainEqual({
      code: "SOFT_QUALIFICATION_MET",
      qualification: "SMS",
      verificationStatus: "verified",
    });
  });

  it("2c. withdrawn qualification counts as missing", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c2c", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.FTS ? { ...q, status: "withdrawn" as const } : q,
        ),
      }),
    );
    expect(result.blockers).toEqual([{ code: "MISSING_HARD_QUALIFICATION", qualification: "FTS" }]);
  });

  it("3. expired hard qualification → not eligible", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c3", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.FTS ? { ...q, expiresAt: "2026-09-30" } : q,
        ),
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      { code: "HARD_QUALIFICATION_EXPIRED", qualification: "FTS", expiresAt: "2026-09-30" },
    ]);
  });

  it("3b. hard qualification expiring inside the period → not eligible", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c3b", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.EWIS ? { ...q, expiresAt: "2026-10-20" } : q,
        ),
      }),
    );
    expect(result.blockers).toEqual([
      {
        code: "HARD_QUALIFICATION_EXPIRES_DURING_REQUIREMENT",
        qualification: "EWIS",
        expiresAt: "2026-10-20",
      },
    ]);
  });

  it("3c. expiring on the last day of the period is still valid", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c3c", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.EWIS ? { ...q, expiresAt: "2026-10-22" } : q,
        ),
      }),
    );
    expect(result.eligible).toBe(true);
  });

  it("3d. self-declared (pending) hard qualification → not eligible", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c3d", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.B11 ? { ...q, verificationStatus: "pending" as const } : q,
        ),
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      {
        code: "HARD_QUALIFICATION_NOT_VERIFIED",
        qualification: "B1.1",
        verificationStatus: "pending",
      },
    ]);
  });

  it("7. multiple hard qualifications → all are required, all failures reported", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c7", { qualifications: [held(QT.B11), held(QT.A320)] }),
    );
    expect(result.eligible).toBe(false);
    expect(
      result.blockers.map((b) => b.code === "MISSING_HARD_QUALIFICATION" && b.qualification),
    ).toEqual(["EWIS", "HF", "FTS"]);
  });
});

describe("evaluateMatch — soft score", () => {
  it("4. missing soft qualification → still eligible, lower score", () => {
    const withSoft = evaluateMatch(
      requirement,
      candidate("with", { qualifications: [...FULL_HARD_SET, held(QT.SMS)] }),
    );
    const withoutSoft = evaluateMatch(requirement, candidate("without"));
    expect(withSoft.eligible).toBe(true);
    expect(withoutSoft.eligible).toBe(true);
    expect(withSoft.softScore).toBe(100);
    expect(withoutSoft.softScore).toBe(0);
    expect(withoutSoft.reasons).toContainEqual({
      code: "SOFT_QUALIFICATION_MISSING",
      qualification: "SMS",
    });
  });

  it("pending soft qualification counts as met and is flagged", () => {
    const result = evaluateMatch(
      requirement,
      candidate("pending-soft", {
        qualifications: [...FULL_HARD_SET, held(QT.SMS, { verificationStatus: "pending" })],
      }),
    );
    expect(result.softScore).toBe(100);
    expect(result.reasons).toContainEqual({
      code: "SOFT_QUALIFICATION_MET",
      qualification: "SMS",
      verificationStatus: "pending",
    });
  });

  it("no soft requirements → eligible candidates score 100", () => {
    const hardOnly = madRequirement({ qualifications: [required(QT.B11)] });
    expect(evaluateMatch(hardOnly, candidate("c")).softScore).toBe(100);
  });
});

describe("evaluateMatch — availability", () => {
  it("5. candidate unavailable → not eligible", () => {
    const result = evaluateMatch(requirement, candidate("c5", { availability: [] }));
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([{ code: "NOT_AVAILABLE" }]);
  });

  it("5b. an unavailable window overrides an available one", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c5b", {
        availability: [
          ...[
            {
              startsAt: "2026-10-01T00:00:00Z",
              endsAt: "2026-11-01T00:00:00Z",
              status: "available" as const,
            },
          ],
          {
            startsAt: "2026-10-20T00:00:00Z",
            endsAt: "2026-10-21T00:00:00Z",
            status: "unavailable",
          },
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers[0]?.code).toBe("PARTIAL_AVAILABILITY");
  });

  it("6. partial overlap → explicitly NOT eligible in V0, with covered percentage", () => {
    // Available until 20 Oct 12:00; requirement runs 18 Oct 20:00 → 22 Oct 06:00 (82 h).
    const result = evaluateMatch(
      requirement,
      candidate("c6", {
        availability: [
          { startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-20T12:00:00Z", status: "available" },
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([{ code: "PARTIAL_AVAILABILITY", coveredPercent: 48.78 }]);
    expect(result.availability.coveredPercent).toBe(48.78);
  });

  it("adjacent windows merge into full coverage", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c-adjacent", {
        availability: [
          { startsAt: "2026-10-18T00:00:00Z", endsAt: "2026-10-20T00:00:00Z", status: "available" },
          { startsAt: "2026-10-20T00:00:00Z", endsAt: "2026-10-23T00:00:00Z", status: "available" },
        ],
      }),
    );
    expect(result.eligible).toBe(true);
  });
});

describe("compareMatches", () => {
  it("orders eligible first, then score, then id", () => {
    const results = [
      evaluateMatch(requirement, candidate("z-ineligible", { availability: [] })),
      evaluateMatch(requirement, candidate("b-eligible")),
      evaluateMatch(requirement, candidate("a-eligible")),
      evaluateMatch(
        requirement,
        candidate("c-best", { qualifications: [...FULL_HARD_SET, held(QT.SMS)] }),
      ),
    ].sort(compareMatches);
    expect(results.map((r) => r.candidateId)).toEqual([
      "c-best",
      "a-eligible",
      "b-eligible",
      "z-ineligible",
    ]);
  });
});
