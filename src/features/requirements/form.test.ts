import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { WorkRequirement } from "@/domain/work-requirement";
import { createWorkRequirementInput } from "@/lib/validation/work-requirement";
import {
  autosaveKey,
  clientIssue,
  draftFromRequirement,
  draftPeriod,
  draftToFields,
  emptyDraft,
  errorField,
  keepSelectableClient,
  mobilizationFor,
  nextDayInputs,
  readAutosave,
  shiftFromInputs,
  statesProfileRules,
  toBuilderErrors,
} from "./form";

const ORG = "22222222-2222-4222-8222-000000000001";
const B11 = "11111111-1111-4111-8111-000000000001";

describe("requirement builder form (v2-09/10/12/14)", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("a new requirement starts with the v1.8 defaults and they reach the payload", () => {
    const draft = {
      ...emptyDraft("Antes del inicio del turno"),
      title: "B1.1 · A320 three days",
      location: "Madrid (MAD)",
      qualifications: [[B11, "hard"]] as [string, "hard"][],
      shifts: [10, 11, 12].map((d) => ({
        startsAt: `2026-11-${d}T08:00:00.000Z`,
        endsAt: `2026-11-${d}T16:00:00.000Z`,
        baseHours: 8,
      })),
    };
    const fields = draftToFields(draft);
    expect(fields).toMatchObject({
      country: "ES",
      timeZone: "Europe/Madrid",
      startsAt: "2026-11-10T08:00:00.000Z",
      endsAt: "2026-11-12T16:00:00.000Z",
      conditions: {
        hourlyRate: 50,
        shiftHours: 8,
        overtimeRate: 60,
        perDiem: 30,
        contractType: "contractor",
        maxMobilizationHours: 48,
        arrival: "Antes del inicio del turno",
        budgetMandatory: false,
        flights: true,
        accommodation: true,
        localTransport: true,
        meals: false,
        ownTools: false,
      },
    });
    expect(createWorkRequirementInput.safeParse({ organizationId: ORG, ...fields }).success).toBe(
      true,
    );
  });

  it("the period is the envelope of the shifts, or the two period inputs without shifts", () => {
    const draft = { ...emptyDraft(""), startsAt: "2026-12-01T08:00", endsAt: "2026-12-03T08:00" };
    expect(draftPeriod(draft)).toEqual({
      startsAt: "2026-12-01T08:00:00Z",
      endsAt: "2026-12-03T08:00:00Z",
    });
    const withShifts = {
      ...draft,
      shifts: [
        { startsAt: "2026-12-05T06:00:00.000Z", endsAt: "2026-12-05T14:00:00.000Z", baseHours: 8 },
        { startsAt: "2026-12-04T06:00:00.000Z", endsAt: "2026-12-04T14:00:00.000Z", baseHours: 8 },
      ],
    };
    expect(draftPeriod(withShifts)).toEqual({
      startsAt: "2026-12-04T06:00:00.000Z",
      endsAt: "2026-12-05T14:00:00.000Z",
    });
  });

  it("empty and unstated terms are omitted; decimals accept a comma", () => {
    const draft = emptyDraft("");
    draft.conditions = { ...draft.conditions, hourlyRate: "52,5", perDiem: "", arrival: "  " };
    draft.country = "";
    const fields = draftToFields(draft);
    expect(fields.conditions).toMatchObject({ hourlyRate: 52.5 });
    expect(fields.conditions).not.toHaveProperty("perDiem");
    expect(fields.conditions).not.toHaveProperty("arrival");
    expect(fields).not.toHaveProperty("country");
    expect(fields).not.toHaveProperty("shifts");
    expect(fields).not.toHaveProperty("description");
  });

  it("v1.8 mobilisation: 12 h for AOG, 48 h otherwise, while the value is one of those defaults", () => {
    expect(mobilizationFor("aog", "48")).toBe("12");
    expect(mobilizationFor("planned", "12")).toBe("48");
    expect(mobilizationFor("aog", "24")).toBe("24");
  });

  it("the shift inputs make a shift only when complete; the next one moves a day", () => {
    expect(
      shiftFromInputs({ startsAt: "2026-11-10T08:00", endsAt: "", baseHours: "8" }),
    ).toBeNull();
    const shift = shiftFromInputs({
      startsAt: "2026-11-10T08:00",
      endsAt: "2026-11-10T16:00",
      baseHours: "7,5",
    });
    expect(shift).toEqual({
      startsAt: "2026-11-10T08:00:00Z",
      endsAt: "2026-11-10T16:00:00Z",
      baseHours: 7.5,
    });
    expect(nextDayInputs(shift!, "7,5")).toEqual({
      startsAt: "2026-11-11T08:00",
      endsAt: "2026-11-11T16:00",
      baseHours: "7,5",
    });
  });

  it("a saved requirement round-trips; terms it never stated stay empty", () => {
    const saved: WorkRequirement = {
      id: "r1",
      organizationId: ORG,
      title: "Legacy need",
      location: "Lisboa (LIS)",
      startsAt: "2026-12-01T08:00:00.000Z",
      endsAt: "2026-12-03T08:00:00.000Z",
      shift: "day",
      headcount: 2,
      urgency: "planned",
      status: "open",
      createdAt: "2026-10-01T08:00:00.000Z",
      qualifications: [{ qualificationTypeId: B11, code: "B1.1", name: "B1.1", level: "hard" }],
      country: null,
      conditions: null,
    };
    const draft = draftFromRequirement(saved);
    expect([draft.country, draft.conditions.hourlyRate, draft.conditions.flights]).toEqual([
      "",
      "",
      false,
    ]);
    expect(draftToFields(draft)).toMatchObject({
      startsAt: "2026-12-01T08:00:00Z",
      headcount: 2,
      qualifications: [{ qualificationTypeId: B11, level: "hard" }],
    });
  });

  it("v1.8 profile rules (P10): stated ones reach the payload, unstated ones are omitted; a saved need round-trips", () => {
    const empty = emptyDraft("x");
    expect(statesProfileRules(empty)).toBe(false);
    const fields = draftToFields(empty);
    for (const key of [
      "category",
      "aircraft",
      "requiresTypeRating",
      "engines",
      "minYears",
      "requiredSkills",
    ])
      expect(fields).not.toHaveProperty(key);
    const ruled = {
      ...empty,
      category: "B1.1" as const,
      aircraft: ["A320 Family" as const],
      requiresTypeRating: true,
      minYears: " 3 ",
      requiredSkills: ["borescope" as const],
    };
    expect(statesProfileRules(ruled)).toBe(true);
    expect(draftToFields(ruled)).toMatchObject({
      category: "B1.1",
      aircraft: ["A320 Family"],
      requiresTypeRating: true,
      minYears: 3,
      requiredSkills: ["borescope"],
    });
    expect(draftToFields(ruled)).not.toHaveProperty("engines");
    const saved: WorkRequirement = {
      id: "r2",
      organizationId: ORG,
      title: "Ruled need",
      location: "Madrid (MAD)",
      startsAt: "2026-12-01T08:00:00.000Z",
      endsAt: "2026-12-03T08:00:00.000Z",
      shift: "day",
      headcount: 1,
      urgency: "planned",
      status: "draft",
      createdAt: "2026-10-01T08:00:00.000Z",
      qualifications: [],
      category: "B2",
      aircraft: ["A330", "A350"],
      requiresTypeRating: true,
      engines: ["Trent 700/1000"],
      minYears: 0,
      requiredSkills: [],
    };
    const draft = draftFromRequirement(saved);
    expect([
      draft.category,
      draft.aircraft,
      draft.requiresTypeRating,
      draft.engines,
      draft.minYears,
    ]).toEqual(["B2", ["A330", "A350"], true, ["Trent 700/1000"], "0"]);
    expect(draftToFields(draft)).toMatchObject({ minYears: 0, requiresTypeRating: true });
    // A requirement from before the columns (no rule keys at all) starts with none.
    const legacy = draftFromRequirement({
      ...saved,
      category: undefined,
      aircraft: undefined,
      minYears: undefined,
    });
    expect([legacy.category, legacy.aircraft, legacy.minYears]).toEqual(["", [], ""]);
  });

  it("condition errors keep their own field; other paths map to the top-level field", () => {
    expect(errorField("conditions.hourlyRate")).toBe("conditions.hourlyRate");
    expect(errorField("shifts.2")).toBe("shifts");
    expect(errorField("title")).toBe("title");
    const parsed = createWorkRequirementInput.safeParse({
      organizationId: ORG,
      ...draftToFields({
        ...emptyDraft(""),
        conditions: { ...emptyDraft("").conditions, hourlyRate: "0" },
      }),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(toBuilderErrors(parsed.error)["conditions.hourlyRate"]).toBe(
        "v.requirement.conditions.hourlyRate",
      );
  });

  it("an autosave is per organization and requirement, and untrusted storage is refused", () => {
    expect(autosaveKey(ORG)).toBe(`crewflex:requirement-draft:${ORG}:new`);
    expect(autosaveKey(ORG, "r1")).toBe(`crewflex:requirement-draft:${ORG}:r1`);
    const good = JSON.stringify({ savedAt: "2026-10-22T10:00:00.000Z", draft: emptyDraft("") });
    expect(readAutosave(good)?.draft.country).toBe("ES");
    for (const bad of [null, "", "{", "[]", '{"savedAt":1}', '{"savedAt":"x","draft":{}}'])
      expect(readAutosave(bad)).toBeNull();
  });
});

describe("recruiter client in the builder (BR-27.3, v1.8 «Selecciona un cliente.»)", () => {
  const CLIENT = "44444444-4444-4444-8444-000000000001";

  it("an agency publishes only with a client; a draft may wait; other organizations never need one", () => {
    expect(clientIssue(true, undefined, "")).toBe("v.requirement.client.select");
    expect(clientIssue(true, "publish", "")).toBe("v.requirement.client.select");
    expect(clientIssue(true, "draft", "")).toBeNull();
    expect(clientIssue(true, "publish", CLIENT)).toBeNull();
    expect(clientIssue(false, "publish", "")).toBeNull();
  });

  it("the client reaches the payload; none chosen sends none (full replacement clears it)", () => {
    expect(draftToFields({ ...emptyDraft(""), clientId: CLIENT }).onBehalfOfClientId).toBe(CLIENT);
    expect("onBehalfOfClientId" in draftToFields(emptyDraft(""))).toBe(false);
  });

  it("a saved client comes back on edit unless the builder no longer offers it", () => {
    const draft = { ...emptyDraft(""), clientId: CLIENT };
    expect(keepSelectableClient(draft, [{ id: CLIENT }]).clientId).toBe(CLIENT);
    expect(keepSelectableClient(draft, []).clientId).toBe("");
    expect(keepSelectableClient(emptyDraft(""), undefined).clientId).toBe("");
  });
});
