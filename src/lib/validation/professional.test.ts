import { describe, expect, it } from "vitest";
import {
  createQualificationInput,
  expiryIssueFor,
  qualificationIdQuery,
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
};

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
