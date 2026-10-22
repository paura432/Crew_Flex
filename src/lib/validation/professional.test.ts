import { describe, expect, it } from "vitest";
import {
  AIRCRAFT,
  BLOCKED_ORGANIZATIONS_MAX,
  ENGINES,
  EU_COUNTRIES,
  GENERAL_RESTRICTIONS_MAX,
  LICENCE_CATEGORIES,
  PROFESSIONAL_CATEGORIES,
  RATING_RESTRICTIONS_MAX,
  SKILLS,
  TYPE_RATINGS_MAX,
} from "../../domain/passport";
import { BASE_LOCATION_MAX, DISPLAY_NAME_MAX } from "../../domain/professional";
import {
  createQualificationInput,
  expiryIssueFor,
  qualificationIdQuery,
  PASSPORT_BODY_MAX_BYTES,
  updateProfessionalProfileInput,
  updateQualificationInput,
} from "./professional";

const profile = {
  displayName: "  Technician Delta ",
  baseLocation: "Barcelona (BCN)",
  mobility: "international",
  yearsExperience: 12,
  currentStatus: "contractor",
  visibility: "anonymous",
  primaryCategory: "B1.1",
  categories: ["B2", "B1.1"],
  aircraft: ["B737 NG", "A320 Family"],
  engines: [],
  skills: ["borescope"],
  englishLevel: "C1",
  ownTools: false,
  baseCountry: "ES",
  workPermits: ["ES", "PT"],
  generalRestrictions: "  ",
  typeRatings: [
    { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restrictions: " No CFM56 " },
  ],
  phone: " +34 600 000 001 ",
  currentEmployerId: null,
  minRate: 45.555,
  rateUnit: "hour",
  blockedOrganizationIds: [],
};

describe("updateProfessionalProfileInput — v1.8 passport (N-01…N-08)", () => {
  it("normalises: catalog order, trimmed text, blanks to null, rate to cents", () => {
    const parsed = updateProfessionalProfileInput.parse(profile);
    expect(parsed.categories).toEqual(["B1.1", "B2"]);
    expect(parsed.aircraft).toEqual(["A320 Family", "B737 NG"]);
    expect(parsed.workPermits).toEqual(["PT", "ES"]);
    expect(parsed.generalRestrictions).toBeNull();
    expect(parsed.typeRatings[0]!.restrictions).toBe("No CFM56");
    expect(parsed.phone).toBe("+34 600 000 001");
    expect(parsed.minRate).toBe(45.56);
  });

  it("the main category is never the empty option and is one of the declared ones", () => {
    const issue = (input: object) =>
      updateProfessionalProfileInput.safeParse({ ...profile, ...input }).error?.issues[0];
    expect(issue({ primaryCategory: "" })).toMatchObject({ path: ["primaryCategory"] });
    expect(issue({ primaryCategory: "B3" })).toMatchObject({
      path: ["primaryCategory"],
      message: "v.passport.primary.notDeclared",
    });
    expect(issue({ primaryCategory: null })).toMatchObject({
      message: "v.passport.primary.required",
    });
    // Nothing declared yet: no main category needed.
    expect(
      updateProfessionalProfileInput.safeParse({
        ...profile,
        primaryCategory: null,
        categories: [],
        typeRatings: [],
      }).success,
    ).toBe(true);
  });

  it("a rating needs a declared aircraft and licence category, once; trades cannot be rated", () => {
    const rating = profile.typeRatings[0]!;
    const message = (typeRatings: object[], extra: object = {}) =>
      updateProfessionalProfileInput.safeParse({ ...profile, ...extra, typeRatings }).error
        ?.issues[0]?.message;
    expect(message([{ ...rating, aircraft: "A350" }])).toBe("v.passport.rating.undeclared");
    expect(message([rating, rating])).toBe("v.passport.rating.duplicate");
    expect(message([{ ...rating, category: "HELPER" }], { categories: ["B1.1", "HELPER"] })).toBe(
      "v.passport.rating.category",
    );
    expect(message(Array.from({ length: 41 }, () => rating))).toBe("v.passport.rating.max");
    // Year 0000 passes ISO-date syntax but Postgres cannot store it (review LOW-3).
    expect(message([{ ...rating, expiresAt: "0000-06-30" }])).toBe("v.date.invalid");
    expect(message([{ ...rating, documentId: "x" }])).toBeDefined(); // strict rating object
  });

  it("lists: catalog values only, no repeats; countries are the EU 27", () => {
    for (const [field, value] of [
      ["categories", ["B1.1", "B9"]],
      ["aircraft", ["A380"]],
      ["engines", ["CF6"]],
      ["skills", ["welding"]],
      ["workPermits", ["GB"]],
      ["skills", ["ndt", "ndt"]],
    ] as const) {
      expect(
        updateProfessionalProfileInput.safeParse({ ...profile, [field]: value }).success,
        field,
      ).toBe(false);
    }
    expect(
      updateProfessionalProfileInput.safeParse({ ...profile, baseCountry: "GB" }).success,
    ).toBe(false);
  });

  it("the largest valid body fits the passport body limit (security review LOW-2)", () => {
    // 3-byte UTF-8 characters at every maximum length: the worst case a valid form can send.
    const wide = (n: number) => "€".repeat(n);
    const categories = [...PROFESSIONAL_CATEGORIES];
    const aircraft = [...AIRCRAFT];
    const typeRatings = aircraft
      .flatMap((a) => LICENCE_CATEGORIES.map((c) => ({ aircraft: a, category: c })))
      .slice(0, TYPE_RATINGS_MAX)
      .map((r) => ({ ...r, expiresAt: "2030-12-31", restrictions: wide(RATING_RESTRICTIONS_MAX) }));
    const body = {
      ...profile,
      displayName: wide(DISPLAY_NAME_MAX),
      baseLocation: wide(BASE_LOCATION_MAX),
      primaryCategory: "B1.1",
      categories,
      aircraft,
      engines: [...ENGINES],
      skills: [...SKILLS],
      workPermits: [...EU_COUNTRIES],
      generalRestrictions: wide(GENERAL_RESTRICTIONS_MAX),
      typeRatings,
      phone: "+34 600 000 000 000 000 000 0000",
      currentEmployerId: "00000000-0000-4000-8000-000000000001",
      minRate: 99999.99,
      blockedOrganizationIds: Array.from(
        { length: BLOCKED_ORGANIZATIONS_MAX },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      ),
      expectedUpdatedAt: "2026-10-22T10:00:00.000Z",
    };
    expect(updateProfessionalProfileInput.safeParse(body).success).toBe(true);
    const bytes = new TextEncoder().encode(JSON.stringify(body)).length;
    expect(bytes).toBeGreaterThan(32 * 1024); // why the default limit is not enough
    expect(bytes).toBeLessThan(PASSPORT_BODY_MAX_BYTES);
  });

  it("private fields: phone shape, rate ≥ 0.01 with a unit, organization ids", () => {
    const ok = (input: object) =>
      updateProfessionalProfileInput.safeParse({ ...profile, ...input }).success;
    expect(ok({ phone: "call me" })).toBe(false);
    expect(ok({ phone: "" })).toBe(true);
    expect(ok({ minRate: 0 })).toBe(false);
    expect(ok({ minRate: null })).toBe(true);
    expect(ok({ rateUnit: "week" })).toBe(false);
    expect(ok({ currentEmployerId: "not-a-uuid" })).toBe(false);
    const id = "00000000-0000-4000-8000-000000000001";
    expect(ok({ blockedOrganizationIds: [id] })).toBe(true);
    expect(ok({ blockedOrganizationIds: [id, id] })).toBe(false);
  });
});

describe("updateProfessionalProfileInput", () => {
  it("accepts a complete profile and trims text", () => {
    const parsed = updateProfessionalProfileInput.parse(profile);
    expect(parsed.displayName).toBe("Technician Delta");
    expect(parsed.baseLocation).toBe("Barcelona (BCN)");
  });

  it("turns an empty base into null and accepts null years", () => {
    const parsed = updateProfessionalProfileInput.parse({
      ...profile,
      baseLocation: "   ",
      yearsExperience: null,
    });
    expect(parsed.baseLocation).toBeNull();
    expect(parsed.yearsExperience).toBeNull();
  });

  it("rejects identity and privileged fields (strict)", () => {
    for (const extra of [
      { profileId: "00000000-0000-4000-8000-000000000011" },
      { platformRole: "platform_admin" },
      { accountType: "organization" },
      { verificationStatus: "verified" },
    ]) {
      expect(updateProfessionalProfileInput.safeParse({ ...profile, ...extra }).success).toBe(
        false,
      );
    }
  });

  it("enforces bounds and enums", () => {
    expect(updateProfessionalProfileInput.safeParse({ ...profile, displayName: "" }).success).toBe(
      false,
    );
    expect(
      updateProfessionalProfileInput.safeParse({ ...profile, displayName: "x".repeat(121) })
        .success,
    ).toBe(false);
    expect(
      updateProfessionalProfileInput.safeParse({ ...profile, baseLocation: "x".repeat(81) })
        .success,
    ).toBe(false);
    expect(
      updateProfessionalProfileInput.safeParse({ ...profile, yearsExperience: 61 }).success,
    ).toBe(false);
    expect(
      updateProfessionalProfileInput.safeParse({ ...profile, yearsExperience: 2.5 }).success,
    ).toBe(false);
    expect(
      updateProfessionalProfileInput.safeParse({ ...profile, mobility: "global" }).success,
    ).toBe(false);
    expect(
      updateProfessionalProfileInput.safeParse({ ...profile, visibility: "verified" }).success,
    ).toBe(false);
  });
});

describe("createQualificationInput / updateQualificationInput", () => {
  const typeId = "11111111-1111-4111-8111-111111111111";

  it("defaults missing dates to null", () => {
    expect(createQualificationInput.parse({ qualificationTypeId: typeId })).toEqual({
      qualificationTypeId: typeId,
      issuedAt: null,
      expiresAt: null,
    });
  });

  it("never accepts a verification status or an owner from the caller", () => {
    expect(
      createQualificationInput.safeParse({
        qualificationTypeId: typeId,
        verificationStatus: "verified",
      }).success,
    ).toBe(false);
    expect(
      createQualificationInput.safeParse({
        qualificationTypeId: typeId,
        technicianProfileId: "00000000-0000-4000-8000-000000000011",
      }).success,
    ).toBe(false);
    expect(
      updateQualificationInput.safeParse({ status: "active", verificationStatus: "verified" })
        .success,
    ).toBe(false);
  });

  it("rejects an expiry before the issue date and malformed dates", () => {
    const result = createQualificationInput.safeParse({
      qualificationTypeId: typeId,
      issuedAt: "2026-05-01",
      expiresAt: "2026-04-30",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["expiresAt"]);
    expect(
      createQualificationInput.safeParse({ qualificationTypeId: typeId, expiresAt: "30/04/2026" })
        .success,
    ).toBe(false);
  });

  it("update requires a known status and keeps the type immutable", () => {
    expect(updateQualificationInput.safeParse({ status: "withdrawn" }).success).toBe(true);
    expect(updateQualificationInput.safeParse({ status: "revoked" }).success).toBe(false);
    expect(
      updateQualificationInput.safeParse({ status: "active", qualificationTypeId: typeId }).success,
    ).toBe(false);
    expect(qualificationIdQuery.safeParse({ id: "nope" }).success).toBe(false);
  });

  it("BR-2.7: requires_expiry types need an expiry date", () => {
    expect(expiryIssueFor({ code: "B1.1", requiresExpiry: true }, null)).toEqual({
      path: "expiresAt",
      message: "v.expiry.required",
    });
    expect(expiryIssueFor({ code: "B1.1", requiresExpiry: true }, "2029-06-30")).toBeNull();
    expect(expiryIssueFor({ code: "TR-A320", requiresExpiry: false }, null)).toBeNull();
  });
});
