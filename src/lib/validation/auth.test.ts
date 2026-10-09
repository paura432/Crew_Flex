import { describe, expect, it } from "vitest";
import { signUpInput } from "./auth.ts";

describe("signUpInput", () => {
  it("requires organization details for organization accounts", () => {
    const result = signUpInput.safeParse({
      accountType: "organization",
      displayName: "Admin",
      email: "admin@crewflex.test",
      password: "long-enough-password",
    });
    expect(result.success).toBe(false);
  });

  it("does not accept a role or platform role from the client", () => {
    const result = signUpInput.safeParse({
      accountType: "professional",
      displayName: "Tech",
      email: "tech@crewflex.test",
      password: "long-enough-password",
      platformRole: "platform_admin",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes the country code", () => {
    const result = signUpInput.parse({
      accountType: "organization",
      displayName: "Admin",
      email: "admin@crewflex.test",
      password: "long-enough-password",
      organizationName: "Demo MRO",
      organizationType: "mro",
      country: "es",
    });
    expect(result.accountType === "organization" && result.country).toBe("ES");
  });
});
