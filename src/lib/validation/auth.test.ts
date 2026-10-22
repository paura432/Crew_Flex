import { describe, expect, it } from "vitest";
import { forgotPasswordInput, resetPasswordInput, signUpInput } from "./auth.ts";

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

describe("password recovery inputs", () => {
  it("forgot: a valid e-mail only", () => {
    expect(forgotPasswordInput.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(forgotPasswordInput.safeParse({ email: "nope" }).success).toBe(false);
    expect(forgotPasswordInput.safeParse({ email: "a@b.co", role: "admin" }).success).toBe(false);
  });

  it("reset: same rules as sign-up and both entries must match", () => {
    // Q-01 (owner, 2026-10-22): 12 characters is the boundary (was 10)
    expect(
      resetPasswordInput.safeParse({ password: "0123456789ab", confirm: "0123456789ab" }).success,
    ).toBe(true);
    const short = resetPasswordInput.safeParse({ password: "0123456789a", confirm: "0123456789a" });
    expect(short.error?.issues[0]?.message).toBe("v.password.min");
    const mismatch = resetPasswordInput.safeParse({
      password: "0123456789ab",
      confirm: "0123456789ac",
    });
    expect(mismatch.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      ["confirm", "v.password.mismatch"],
    ]);
    expect(
      resetPasswordInput.safeParse({ password: "x".repeat(73), confirm: "x".repeat(73) }).success,
    ).toBe(false);
  });
});
