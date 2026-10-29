import { describe, expect, it } from "vitest";
import { noticePreferencesInput, outreachRequirementInput } from "./outreach";

const valid = {
  urgentOptIn: true,
  aogOptIn: false,
  mobilizationHours: 24,
  timeZone: "Europe/Madrid",
  quietStart: "22:00",
  quietEnd: "07:00",
};

const messages = (input: unknown) => {
  const result = noticePreferencesInput.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("notice preferences schema (N-10)", () => {
  it("accepts the v1.8 form, the 0–720 bounds and «not declared»", () => {
    expect(noticePreferencesInput.parse(valid)).toEqual(valid);
    for (const mobilizationHours of [0, 720, null]) {
      expect(messages({ ...valid, mobilizationHours })).toEqual([]);
    }
    expect(messages({ ...valid, quietStart: null, quietEnd: null })).toEqual([]);
    expect(noticePreferencesInput.parse({ ...valid, timeZone: " UTC " }).timeZone).toBe("UTC");
  });

  it("refuses identity and unknown fields (strict, S-2)", () => {
    for (const extra of ["profileId", "userId", "role", "recipientId"]) {
      expect(noticePreferencesInput.safeParse({ ...valid, [extra]: "x" }).success, extra).toBe(
        false,
      );
    }
  });

  it("v1.8 messages: «Zona horaria no válida.», «Horas de silencio no válidas.», 0–720 whole hours", () => {
    expect(messages({ ...valid, timeZone: "Mars/Olympus" })).toEqual([
      "timeZone:v.outreach.timeZone",
    ]);
    expect(messages({ ...valid, timeZone: "+01:00" })).toEqual(["timeZone:v.outreach.timeZone"]);
    for (const [quietStart, quietEnd] of [
      ["22:00", null],
      [null, "07:00"],
      ["22:00", "22:00"],
      ["25:00", "07:00"],
    ]) {
      expect(messages({ ...valid, quietStart, quietEnd }), `${quietStart}-${quietEnd}`).toContain(
        "quietStart:v.outreach.quietHours",
      );
    }
    // Every error at once: a bad zone does not hide one-sided quiet hours.
    expect(messages({ ...valid, timeZone: "Mars/Olympus", quietEnd: null }).sort()).toEqual([
      "quietStart:v.outreach.quietHours",
      "timeZone:v.outreach.timeZone",
    ]);
    for (const mobilizationHours of [-1, 721, 1.5, Number.NaN, "24"]) {
      expect(messages({ ...valid, mobilizationHours }), String(mobilizationHours)).toEqual([
        "mobilizationHours:v.outreach.mobilization",
      ]);
    }
  });
});

describe("outreach requirement input (v2-17)", () => {
  it("takes one requirement id and nothing else: the organization and the role come from the database", () => {
    const requirementId = "00000000-0000-4000-8000-0000000000b1";
    expect(outreachRequirementInput.parse({ requirementId })).toEqual({ requirementId });
    expect(outreachRequirementInput.safeParse({ requirementId: "../x" }).success).toBe(false);
    expect(
      outreachRequirementInput.safeParse({ requirementId, organizationId: requirementId }).success,
    ).toBe(false);
  });
});
