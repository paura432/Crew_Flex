import { describe, expect, it } from "vitest";
import { applyInput, listOpportunitiesQuery, transitionInput } from "./applications";

const id = "00000000-0000-4000-8000-0000000000aa";
const at = "2031-01-01T10:00:00.000Z";
const issues = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues.map((i) => i.message) ?? [];

describe("application inputs (D-06, owner 2026-10-22)", () => {
  it("applying needs the explicit share consent and nothing about identity", () => {
    expect(applyInput.safeParse({ requirementId: id, shareConsent: true }).success).toBe(true);
    expect(issues(applyInput.safeParse({ requirementId: id, shareConsent: false }))).toEqual([
      "v.application.consent",
    ]);
    expect(
      applyInput.safeParse({ requirementId: id, shareConsent: true, userId: id }).success,
    ).toBe(false);
  });

  it("a reason exactly for rejected/cancelled, 1–1000 characters", () => {
    const base = { applicationId: id, expectedUpdatedAt: at };
    expect(transitionInput.safeParse({ ...base, to: "rejected", reason: "No B1" }).success).toBe(
      true,
    );
    expect(issues(transitionInput.safeParse({ ...base, to: "cancelled" }))).toEqual([
      "v.application.reason",
    ]);
    expect(issues(transitionInput.safeParse({ ...base, to: "cancelled", reason: "  " }))).toContain(
      "v.application.reason",
    );
    expect(
      issues(transitionInput.safeParse({ ...base, to: "rejected", reason: "x".repeat(1001) })),
    ).toContain("v.application.reasonMax");
    expect(issues(transitionInput.safeParse({ ...base, to: "shortlisted", reason: "x" }))).toEqual([
      "v.application.reasonNotAllowed",
    ]);
  });

  it("R-08: accepting names the proposal version and says yes explicitly", () => {
    const base = { applicationId: id, expectedUpdatedAt: at, to: "accepted" };
    expect(transitionInput.safeParse({ ...base, proposalId: id, acceptTerms: true }).success).toBe(
      true,
    );
    expect(issues(transitionInput.safeParse({ ...base, proposalId: id }))).toEqual([
      "v.application.acceptTerms",
    ]);
    expect(issues(transitionInput.safeParse({ ...base, acceptTerms: true }))).toEqual([
      "v.application.proposal",
    ]);
  });

  it("nobody moves an application back to received; no actor or role in the body", () => {
    const base = { applicationId: id, expectedUpdatedAt: at };
    expect(transitionInput.safeParse({ ...base, to: "received" }).success).toBe(false);
    expect(
      transitionInput.safeParse({ ...base, to: "shortlisted", actor: "organization" }).success,
    ).toBe(false);
  });

  it("opportunity filters (v1.8 pills, search, «Compatibles»)", () => {
    expect(listOpportunitiesQuery.parse({})).toMatchObject({ offset: 0, limit: 20 });
    expect(
      listOpportunitiesQuery.parse({ urgency: "aog", eligible: "1", q: " A320 " }),
    ).toMatchObject({
      urgency: "aog",
      eligible: "1",
      q: "A320",
    });
    expect(listOpportunitiesQuery.safeParse({ urgency: "soon" }).success).toBe(false);
  });
});
