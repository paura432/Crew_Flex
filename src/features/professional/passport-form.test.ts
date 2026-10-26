import { describe, expect, it } from "vitest";
import { updateProfessionalProfileInput } from "@/lib/validation/professional";
import { emptyPassport, passportFromForm, withPrimary } from "./passport-form";

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

describe("emptyPassport (v1.8 «Empezar perfil vacío», T-162)", () => {
  it("empties every declaration and private value, keeps the enums, the blocks and the version", () => {
    const saved = {
      displayName: "Technician Delta",
      baseLocation: "Barcelona (BCN)",
      mobility: "international" as const,
      yearsExperience: 12,
      currentStatus: "contractor" as const,
      visibility: "anonymous" as const,
      primaryCategory: "B1.1" as const,
      categories: ["B1.1" as const, "B2" as const],
      aircraft: ["A320 Family" as const],
      engines: ["LEAP-1A" as const],
      skills: ["ndt" as const],
      englishLevel: "C1" as const,
      ownTools: true,
      baseCountry: "ES" as const,
      workPermits: ["ES" as const],
      generalRestrictions: "No run-ups",
      typeRatings: [
        {
          aircraft: "A320 Family" as const,
          category: "B1.1" as const,
          expiresAt: null,
          restrictions: null,
        },
      ],
      phone: "+34 600 000 001",
      currentEmployerId: "00000000-0000-4000-8000-000000000001",
      minRate: 45,
      rateUnit: "hour" as const,
      blockedOrganizationIds: ["00000000-0000-4000-8000-000000000002"],
      updatedAt: "2026-10-26T10:00:00.000Z",
    };
    const draft = emptyPassport(saved);
    expect(draft).toEqual({
      ...saved,
      displayName: "",
      baseLocation: null,
      yearsExperience: null,
      visibility: "private",
      primaryCategory: null,
      categories: [],
      aircraft: [],
      engines: [],
      skills: [],
      englishLevel: null,
      ownTools: false,
      baseCountry: null,
      workPermits: [],
      generalRestrictions: null,
      typeRatings: [],
      phone: null,
      currentEmployerId: null,
      minRate: null,
    });
    // The version is what the next save checks (I-3): the empty draft still replaces THIS passport.
    expect(draft.updatedAt).toBe(saved.updatedAt);
    expect(saved.categories).toEqual(["B1.1", "B2"]); // the saved passport object is untouched
    // Saving the empty draft as it is fails on the name, as v1.8 («Escribe tu nombre profesional.»).
    const { updatedAt, ...payload } = draft;
    const parsed = updateProfessionalProfileInput.safeParse({
      ...payload,
      expectedUpdatedAt: updatedAt,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toEqual(["displayName"]);
  });
});

describe("withPrimary (v1.8 connected: the main category is always ticked)", () => {
  it("adds the main category once", () => {
    expect(withPrimary(["B2"], "B1.1")).toEqual(["B2", "B1.1"]);
    expect(withPrimary(["B1.1"], "B1.1")).toEqual(["B1.1"]);
  });
});
