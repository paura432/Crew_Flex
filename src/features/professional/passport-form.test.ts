import { describe, expect, it } from "vitest";
import { updateProfessionalProfileInput } from "@/lib/validation/professional";
import { passportFromForm, withPrimary } from "./passport-form";

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
}

const state = {
  visibility: "anonymous" as const,
  primaryCategory: "B1.1" as const,
  categories: ["B1.1" as const],
  aircraft: ["A320 Family" as const],
  ratings: [
    {
      key: "k1",
      aircraft: "A320 Family" as const,
      category: "B1.1" as const,
      expiresAt: "",
      restrictions: "",
    },
  ],
};

describe("passportFromForm", () => {
  it("maps every field of the full-replacement save; blanks become null for optional ones", () => {
    const payload = passportFromForm(
      form([
        ["displayName", "Technician Delta"],
        ["phone", ""],
        ["baseLocation", "Barcelona (BCN)"],
        ["baseCountry", ""],
        ["currentEmployerId", ""],
        ["generalRestrictions", ""],
        ["yearsExperience", "12"],
        ["currentStatus", "contractor"],
        ["mobility", "international"],
        ["englishLevel", "B2"],
        ["engines", "LEAP-1A"],
        ["skills", "borescope"],
        ["skills", "ndt"],
        ["ownTools", "on"],
        ["minRate", ""],
        ["rateUnit", "day"],
        ["workPermits", "ES"],
        ["blockedOrganizationIds", "00000000-0000-4000-8000-000000000001"],
      ]),
      state,
      "2026-10-22T10:00:00.000Z",
    );
    expect(payload).toMatchObject({
      yearsExperience: 12,
      englishLevel: "B2",
      baseCountry: null,
      currentEmployerId: null,
      minRate: null,
      ownTools: true,
      engines: ["LEAP-1A"],
      skills: ["borescope", "ndt"],
      typeRatings: [
        { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restrictions: "" },
      ],
    });
    // The shared schema accepts it and normalises the rest (catalog order, blank text → null).
    const parsed = updateProfessionalProfileInput.parse(payload);
    expect(parsed.skills).toEqual(["ndt", "borescope"]);
    expect(parsed.typeRatings[0]!.restrictions).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  it("an unticked switch is false and an empty rate stays undeclared", () => {
    const payload = passportFromForm(form([["minRate", " "]]), state, "x");
    expect(payload.ownTools).toBe(false);
    expect(payload.minRate).toBeNull();
  });
});

describe("withPrimary (v1.8 connected: the main category is always ticked)", () => {
  it("adds the main category once", () => {
    expect(withPrimary(["B2"], "B1.1")).toEqual(["B2", "B1.1"]);
    expect(withPrimary(["B1.1"], "B1.1")).toEqual(["B1.1"]);
  });
});
