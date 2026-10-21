import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { toFieldErrors } from "./errors.ts";
import {
  createWorkRequirementInput,
  evaluateRequirementInput,
  listWorkRequirementsQuery,
} from "./work-requirement.ts";

const B11 = "11111111-1111-4111-8111-000000000001";
const SMS = "11111111-1111-4111-8111-000000000006";

const valid = {
  organizationId: "22222222-2222-4222-8222-000000000001",
  title: "B1.1 · A320 line maintenance reinforcement",
  location: "Madrid (MAD)",
  startsAt: "2026-10-18T20:00:00Z",
  endsAt: "2026-10-22T06:00:00Z",
  shift: "night",
  headcount: 2,
  urgency: "urgent",
  qualifications: [
    { qualificationTypeId: B11, level: "hard" },
    { qualificationTypeId: SMS, level: "soft" },
  ],
};

function errorsFor(input: unknown) {
  const result = createWorkRequirementInput.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
}

describe("createWorkRequirementInput", () => {
  // The fixture starts on 2026-10-18; «now» is pinned before it so the past-start rule stays out of the way.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("refuses a start in the past, with a 15 min grace for filling the form", () => {
    expect(errorsFor({ ...valid, startsAt: "2026-10-14T12:00:00Z" })).toMatchObject({
      startsAt: "v.start.future",
    });
    expect(errorsFor({ ...valid, startsAt: "2026-10-15T11:50:00Z" })).toEqual({});
    expect(errorsFor({ ...valid, startsAt: "2026-10-15T11:40:00Z" })).toMatchObject({
      startsAt: "v.start.future",
    });
    expect(errorsFor({ ...valid, startsAt: "2026-10-15T13:00:00Z" })).toEqual({});
  });

  it("accepts a valid requirement and trims text", () => {
    const parsed = createWorkRequirementInput.parse({ ...valid, title: "  Night support  " });
    expect(parsed.title).toBe("Night support");
  });

  it.each([
    [{ headcount: 0 }, "headcount", "v.headcount.min"],
    [{ headcount: 2.5 }, "headcount", "v.headcount.int"],
    [{ title: "  " }, "title", "v.title.min"],
    [{ location: "" }, "location", "v.location.min"],
    [{ endsAt: "2026-10-18T19:00:00Z" }, "endsAt", "v.end.afterStart"],
    [{ endsAt: "2027-12-01T00:00:00Z" }, "endsAt", "v.requirement.maxDays"],
    [{ qualifications: [] }, "qualifications", "v.qualifications.min"],
    [
      { qualifications: [{ qualificationTypeId: SMS, level: "soft" }] },
      "qualifications",
      "v.qualifications.hard",
    ],
    [
      {
        qualifications: [
          { qualificationTypeId: B11, level: "hard" },
          { qualificationTypeId: B11, level: "soft" },
        ],
      },
      "qualifications",
      "v.qualifications.duplicate",
    ],
    [{ urgency: "asap" }, "urgency", "v.urgency.invalid"],
    [{ startsAt: "18/10/2026" }, "startsAt", "v.start.required"],
  ])("rejects %o", (override, field, message) => {
    expect(errorsFor({ ...valid, ...override })[field]).toBe(message);
  });

  it("E. rejects caller-supplied identity fields (strict schema)", () => {
    const errors = errorsFor({ ...valid, userId: "00000000-0000-4000-8000-000000000001" });
    expect(Object.keys(errors)).toContain("form");
    expect(createWorkRequirementInput.safeParse({ ...valid, createdBy: "x" }).success).toBe(false);
  });

  it("rejects oversized qualification arrays", () => {
    const qualifications = Array.from({ length: 21 }, (_, i) => ({
      qualificationTypeId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      level: "hard",
    }));
    expect(errorsFor({ ...valid, qualifications }).qualifications).toBe("v.qualifications.max");
  });
});

describe("listWorkRequirementsQuery (batch 15 filters)", () => {
  const ok = (q: Record<string, string>) => listWorkRequirementsQuery.safeParse(q).success;
  it("accepts the known statuses and an offset ISO instant", () => {
    expect(ok({ status: "open", endsAfter: "2026-10-20T10:00:00.000Z" })).toBe(true);
    expect(ok({ endsAfter: "2026-10-20T12:00:00+02:00" })).toBe(true);
  });
  it("rejects unknown statuses, date-only values and unknown keys", () => {
    expect(ok({ status: "nope" })).toBe(false);
    expect(ok({ endsAfter: "2026-10-20" })).toBe(false);
    expect(ok({ endsAfter: "x' or 1=1" })).toBe(false);
    expect(ok({ foo: "bar" })).toBe(false);
  });
});

describe("evaluateRequirementInput", () => {
  it("requires a UUID and nothing else", () => {
    expect(evaluateRequirementInput.safeParse({ requirementId: "1 or 1=1" }).success).toBe(false);
    expect(
      evaluateRequirementInput.safeParse({
        requirementId: "22222222-2222-4222-8222-000000000001",
        organizationId: "22222222-2222-4222-8222-000000000001",
      }).success,
    ).toBe(false);
  });
});
