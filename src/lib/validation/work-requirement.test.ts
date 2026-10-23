import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { toFieldErrors } from "./errors.ts";
import {
  createWorkRequirementInput,
  evaluateRequirementInput,
  listWorkRequirementsQuery,
  patchRequirementInput,
  updateWorkRequirementInput,
  viableCandidatesInput,
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

describe("updateWorkRequirementInput (M05 edit, owner 2026-10-22)", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  const edit: Record<string, unknown> = {
    id: "33333333-3333-4333-8333-000000000001",
    expectedUpdatedAt: "2026-10-15T10:00:00.123Z",
    ...valid,
  };
  delete edit.organizationId; // the organization never changes and is not sent
  const errors = (input: unknown) => {
    const result = updateWorkRequirementInput.safeParse(input);
    return result.success ? {} : toFieldErrors(result.error);
  };

  it("takes the whole requirement with the version it was loaded at, and the creation rules", () => {
    expect(errors(edit)).toEqual({});
    expect(errors({ ...edit, startsAt: "2026-10-14T12:00:00Z" })).toMatchObject({
      startsAt: "v.start.future",
    });
    expect(
      errors({ ...edit, qualifications: [{ qualificationTypeId: SMS, level: "soft" }] }),
    ).toMatchObject({ qualifications: "v.qualifications.hard" });
    expect(
      updateWorkRequirementInput.safeParse({ ...edit, expectedUpdatedAt: undefined }).success,
    ).toBe(false);
  });

  it("never moves a requirement to another organization nor takes identity from the body", () => {
    for (const extra of [
      { organizationId: valid.organizationId },
      { createdBy: edit.id },
      { status: "open" },
    ])
      expect(updateWorkRequirementInput.safeParse({ ...edit, ...extra }).success).toBe(false);
  });

  it("a draft is saved incomplete; publishing it applies every creation rule", () => {
    const draft = { ...edit, qualifications: [], startsAt: "2026-10-14T12:00:00Z" };
    expect(errors({ ...draft, intent: "draft" })).toEqual({});
    expect(errors({ ...draft, intent: "publish" })).toMatchObject({
      startsAt: "v.start.future",
      qualifications: "v.qualifications.min",
    });
  });
});

describe("requirement builder terms (v2-09/10/12/14)", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  const nov = [10, 11, 12].map((d) => ({
    startsAt: `2026-11-${d}T08:00:00.000Z`,
    endsAt: `2026-11-${d}T16:00:00.000Z`,
    baseHours: 8,
  }));
  const withShifts = {
    ...valid,
    startsAt: "2026-11-10T08:00:00.000Z",
    endsAt: "2026-11-12T16:00:00.000Z",
    country: "ES",
    timeZone: "Europe/Madrid",
    shifts: nov,
  };

  it("accepts the v2-09 example and the v1.8 default conditions", () => {
    expect(
      errorsFor({
        ...withShifts,
        description: "Line support",
        conditions: {
          hourlyRate: 50,
          overtimeRate: 60,
          perDiem: 30,
          shiftHours: 8,
          contractType: "contractor",
          budgetMandatory: false,
          maxMobilizationHours: 48,
          arrival: "Antes del inicio del turno",
          flights: true,
          accommodation: true,
          localTransport: true,
          meals: false,
          ownTools: false,
        },
      }),
    ).toEqual({});
  });

  it("the period must be the envelope of the shifts", () => {
    expect(errorsFor({ ...withShifts, endsAt: "2026-11-13T16:00:00.000Z" }).shifts).toBe(
      "v.requirement.shifts.envelope",
    );
  });

  it("an overlap and two shifts on one local date are refused with the v1.8 reasons", () => {
    const overlap = [
      nov[0]!,
      {
        ...nov[0]!,
        startsAt: "2026-11-10T15:00:00.000Z",
        endsAt: "2026-11-10T20:00:00.000Z",
        baseHours: 5,
      },
    ];
    expect(
      errorsFor({ ...withShifts, endsAt: "2026-11-10T20:00:00.000Z", shifts: overlap }).shifts,
    ).toBe("v.requirement.shifts.overlap");
    const sameDay = [
      nov[0]!,
      { startsAt: "2026-11-10T17:00:00.000Z", endsAt: "2026-11-10T20:00:00.000Z", baseHours: 3 },
    ];
    expect(
      errorsFor({ ...withShifts, endsAt: "2026-11-10T20:00:00.000Z", shifts: sameDay }).shifts,
    ).toBe("v.requirement.shifts.sameLocalDay");
  });

  it("refuses a country outside the EU, an unknown zone, 4001 characters and commission fields", () => {
    expect(errorsFor({ ...withShifts, country: "GB" }).country).toBe("v.requirement.country");
    expect(errorsFor({ ...withShifts, timeZone: "America/New_York" }).timeZone).toBe(
      "v.requirement.timeZone",
    );
    expect(errorsFor({ ...withShifts, description: "x".repeat(4001) }).description).toBe(
      "v.requirement.description",
    );
    expect(errorsFor({ ...withShifts, conditions: { commissionRate: 0.023 } })).toHaveProperty(
      "conditions",
    );
    expect(errorsFor({ ...withShifts, conditions: { hourlyRate: 0 } }).conditions).toBe(
      "v.requirement.conditions.hourlyRate",
    );
  });

  it("the live count takes a period, an urgency and 1–20 hard qualifications only", () => {
    const ok = {
      organizationId: valid.organizationId,
      startsAt: "2026-11-10T08:00:00.000Z",
      endsAt: "2026-11-12T16:00:00.000Z",
      urgency: "planned",
      hardQualificationTypeIds: [B11],
    };
    expect(viableCandidatesInput.safeParse(ok).success).toBe(true);
    expect(viableCandidatesInput.safeParse({ ...ok, hardQualificationTypeIds: [] }).success).toBe(
      false,
    );
    expect(viableCandidatesInput.safeParse({ ...ok, endsAt: ok.startsAt }).success).toBe(false);
    expect(viableCandidatesInput.safeParse({ ...ok, profileId: B11 }).success).toBe(false);
    // matching-v18: the job's country (an EU member) joins the count's work-permit rule.
    expect(viableCandidatesInput.safeParse({ ...ok, country: "ES" }).success).toBe(true);
    expect(viableCandidatesInput.safeParse({ ...ok, country: "GB" }).success).toBe(false);
  });

  it("PATCH takes a status change or the archive, nothing else; the list filters archived ones", () => {
    const id = "33333333-3333-4333-8333-000000000001";
    expect(patchRequirementInput.safeParse({ id, status: "closed" }).success).toBe(true);
    expect(patchRequirementInput.safeParse({ id, archive: true }).success).toBe(true);
    expect(patchRequirementInput.safeParse({ id, archive: false }).success).toBe(false);
    expect(patchRequirementInput.safeParse({ id, status: "archived" }).success).toBe(false);
    expect(listWorkRequirementsQuery.parse({}).archived).toBe("include");
    expect(listWorkRequirementsQuery.safeParse({ archived: "only" }).success).toBe(true);
    expect(listWorkRequirementsQuery.safeParse({ archived: "yes" }).success).toBe(false);
  });
});
