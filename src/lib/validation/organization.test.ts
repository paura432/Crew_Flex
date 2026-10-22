import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./errors";
import {
  organizationIdQuery,
  reviewOrganizationInput,
  updateOrganizationInput,
} from "./organization";

const ORG = "3f0c6a52-1d4b-4c55-9a4e-2f1f6f0e9a10";
const valid = {
  organizationId: ORG,
  expectedUpdatedAt: "2026-10-23T09:00:00.123Z",
  name: "  Demo MRO Madrid ",
  type: "mro",
  country: "ES",
  taxId: " ESB00000000 ",
  taxAddress: "Calle Ficticia 1, 28042 Madrid",
};

describe("updateOrganizationInput («Organización»)", () => {
  it("accepts the full replacement and trims the text", () => {
    const parsed = updateOrganizationInput.parse(valid);
    expect(parsed.name).toBe("Demo MRO Madrid");
    expect(parsed.taxId).toBe("ESB00000000");
  });

  it("rejects identity, role and review fields in the payload (strict, S-2)", () => {
    for (const extra of [
      { reviewStatus: "reviewed" },
      { reviewedAt: "2026-10-23T09:00:00Z" },
      { role: "admin" },
      { organizationRole: "admin" },
      { userId: ORG },
      { platformRole: "platform_admin" },
    ]) {
      expect(
        updateOrganizationInput.safeParse({ ...valid, ...extra }).success,
        JSON.stringify(extra),
      ).toBe(false);
    }
  });

  it("requires every field, an EU country and the length limits (v1.8)", () => {
    const errors = (input: object) => {
      const result = updateOrganizationInput.safeParse(input);
      return result.success ? {} : toFieldErrors(result.error);
    };
    expect(errors({ ...valid, country: "US" })).toEqual({ country: "v.organization.countryEu" });
    expect(errors({ ...valid, country: "es" })).toEqual({ country: "v.organization.countryEu" });
    expect(errors({ ...valid, taxId: "   " })).toEqual({ taxId: "v.organization.taxIdRequired" });
    expect(errors({ ...valid, taxId: "x".repeat(81) })).toEqual({
      taxId: "v.organization.taxIdMax",
    });
    expect(errors({ ...valid, taxAddress: "x".repeat(401) })).toEqual({
      taxAddress: "v.organization.taxAddressMax",
    });
    expect(errors({ ...valid, name: "A" })).toEqual({ name: "v.orgName.min" });
    expect(errors({ ...valid, type: "bank" })).toEqual({ type: "v.orgType.invalid" });
    expect(errors({ ...valid, expectedUpdatedAt: undefined })).toEqual({
      expectedUpdatedAt: "v.invalid",
    });
  });
});

describe("reviewOrganizationInput («Registrar revisión»)", () => {
  const review = {
    organizationId: ORG,
    expectedUpdatedAt: valid.expectedUpdatedAt,
    note: "Checked",
  };

  it("needs evidence (1-2000 characters, trimmed)", () => {
    expect(reviewOrganizationInput.parse({ ...review, note: "  ok  " }).note).toBe("ok");
    expect(reviewOrganizationInput.safeParse({ ...review, note: "   " }).success).toBe(false);
    expect(reviewOrganizationInput.safeParse({ ...review, note: "x".repeat(2001) }).success).toBe(
      false,
    );
  });

  it("rejects a decision, a reviewer id or a status in the payload", () => {
    for (const extra of [{ approve: true }, { reviewerId: ORG }, { reviewStatus: "reviewed" }]) {
      expect(reviewOrganizationInput.safeParse({ ...review, ...extra }).success).toBe(false);
    }
  });

  it("the GET query takes only a uuid", () => {
    expect(organizationIdQuery.safeParse({ organizationId: "x" }).success).toBe(false);
    expect(organizationIdQuery.safeParse({ organizationId: ORG, role: "admin" }).success).toBe(
      false,
    );
  });
});
