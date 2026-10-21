import { describe, expect, it } from "vitest";
import type { RequirementStatus, WorkRequirement } from "@/domain/work-requirement";
import { currentRequirements, dashboardRequirements, openRequirementsValue } from "./dashboard";

const NOW = Date.parse("2026-10-21T12:00:00Z");

const req = (id: string, status: RequirementStatus, startsAt: string, endsAt: string) =>
  ({
    id,
    organizationId: "org",
    title: id,
    location: "MAD",
    startsAt,
    endsAt,
    shift: "day",
    headcount: 1,
    urgency: "planned",
    status,
    createdAt: startsAt,
    qualifications: [],
  }) satisfies WorkRequirement;

// The API list order: starts_at ascending, so old history comes first.
const closedA = req("closed-a", "closed", "2026-01-01T00:00:00Z", "2026-01-05T00:00:00Z");
const closedB = req("closed-b", "closed", "2026-02-01T00:00:00Z", "2026-02-05T00:00:00Z");
const expired = req("expired", "open", "2026-09-01T00:00:00Z", "2026-09-10T00:00:00Z");
const open1 = req("open-1", "open", "2026-10-25T00:00:00Z", "2026-10-30T00:00:00Z");
const open2 = req("open-2", "open", "2026-11-02T00:00:00Z", "2026-11-04T00:00:00Z");
const open3 = req("open-3", "open", "2026-12-01T00:00:00Z", "2026-12-03T00:00:00Z");
const all = [closedA, closedB, expired, open1, open2, open3];

describe("currentRequirements", () => {
  it("keeps open requirements that have not ended, in the given order", () => {
    expect(currentRequirements(all, NOW).map((r) => r.id)).toEqual(["open-1", "open-2", "open-3"]);
  });
});

describe("dashboardRequirements", () => {
  it("lists current requirements first, then fills with the rest in list order", () => {
    const shown = dashboardRequirements(all, currentRequirements(all, NOW));
    expect(shown.map((r) => r.id)).toEqual(["open-1", "open-2", "open-3", "closed-a", "closed-b"]);
  });

  it("never repeats a requirement and stops at the limit", () => {
    const current = currentRequirements(all, NOW);
    expect(dashboardRequirements(all, current, 2).map((r) => r.id)).toEqual(["open-1", "open-2"]);
    expect(new Set(dashboardRequirements(all, current, 10).map((r) => r.id)).size).toBe(6);
  });

  it("without current requirements behaves as before (first rows of the list)", () => {
    expect(dashboardRequirements(all, []).map((r) => r.id)).toEqual([
      "closed-a",
      "closed-b",
      "expired",
      "open-1",
      "open-2",
    ]);
  });
});

describe("openRequirementsValue", () => {
  it("shows the current count, or «limit+» when the page came back full", () => {
    expect(openRequirementsValue(3, 3, 50)).toBe("3");
    expect(openRequirementsValue(0, 0, 50)).toBe("0");
    expect(openRequirementsValue(49, 50, 50)).toBe("50+");
  });
});
