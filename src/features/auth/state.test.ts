import { describe, expect, it } from "vitest";
import {
  confirmLink,
  isRecentRecovery,
  loginNotice,
  mapAuthError,
  safeConfirmNext,
  safeNextPath,
} from "./state";

describe("safeNextPath", () => {
  it.each([
    ["/app/organization", "/app/organization"],
    ["https://evil.example/app", "/app"],
    ["//evil.example", "/app"],
    ["/app\\@evil.example", "/app"],
    ["/login", "/app"],
    [null, "/app"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("safeConfirmNext (e-mail link landing)", () => {
  it.each([
    ["/reset-password", "/reset-password"],
    ["/app/settings", "/app/settings"],
    ["https://evil.example/reset-password", "/app"],
    ["/reset-password/../login", "/app"],
    [null, "/app"],
  ])("%s → %s", (input, expected) => {
    expect(safeConfirmNext(input)).toBe(expected);
  });
});

describe("isRecentRecovery (reset-password gate)", () => {
  const now = 1_800_000_000;
  it.each([
    [[{ method: "recovery", timestamp: now - 60 }], true],
    [
      [
        { method: "password", timestamp: now - 10 },
        { method: "recovery", timestamp: now },
      ],
      true,
    ],
    [[{ method: "recovery", timestamp: now - 3600 }], true],
    [[{ method: "recovery", timestamp: now - 3601 }], false],
    [[{ method: "password", timestamp: now }], false],
    [[{ method: "otp", timestamp: now - 60 }], true], // token_hash recovery link (GoTrue v2.197)
    [[{ method: "otp", timestamp: now - 3601 }], false],
    [["recovery"], false],
    [[{ method: "recovery", timestamp: "1" }], false],
    [undefined, false],
    [null, false],
  ])("%j → %s", (amr, expected) => {
    expect(isRecentRecovery(amr, now)).toBe(expected);
  });
});

describe("loginNotice", () => {
  it("shows the sign-out banner, and the reset one wins over it", () => {
    expect(loginNotice({ signedOut: "1" })).toBe("signedOut");
    expect(loginNotice({ reset: "1" })).toBe("passwordChanged");
    expect(loginNotice({ reset: "1", signedOut: "1" })).toBe("passwordChanged");
  });

  it("names a closed account and the e-mail confirmation outcome (AUTH-03, ACC-01)", () => {
    expect(loginNotice({ closed: "1" })).toBe("accountClosed");
    expect(loginNotice({ confirmed: "1" })).toBe("emailConfirmed");
    expect(loginNotice({ confirmError: "1" })).toBe("confirmLinkInvalid");
    expect(loginNotice({ closed: "1", signedOut: "1" })).toBe("accountClosed");
    expect(loginNotice({ reset: "1", closed: "1" })).toBe("passwordChanged");
  });

  it("ignores anything else (no banner on a plain visit or with only ?next)", () => {
    expect(loginNotice({})).toBeNull();
    expect(loginNotice({ signedOut: "true" })).toBeNull();
    expect(loginNotice({ signedOut: ["1"] })).toBeNull();
  });
});

describe("confirmLink (/auth/confirm)", () => {
  it("recovery links keep their flow: code, or a recovery token_hash only", () => {
    expect(
      confirmLink({ next: "/reset-password", code: "c", tokenHash: null, type: null }),
    ).toEqual({ kind: "recovery", code: "c", tokenHash: null });
    expect(
      confirmLink({ next: "/reset-password", code: null, tokenHash: "h", type: "recovery" }),
    ).toEqual({ kind: "recovery", code: null, tokenHash: "h" });
    expect(
      confirmLink({ next: "/reset-password", code: null, tokenHash: "h", type: "magiclink" }),
    ).toEqual({ kind: "recovery", code: null, tokenHash: null });
  });

  it("sign-up links never open a session; an expired one is not sent to the reset form", () => {
    expect(confirmLink({ next: "/app", code: "c", tokenHash: null, type: null })).toEqual({
      kind: "signup_confirmed",
    });
    expect(confirmLink({ next: "/app", code: null, tokenHash: "h", type: "signup" })).toEqual({
      kind: "signup_token",
      tokenHash: "h",
      type: "signup",
    });
    // AUTH-03 #5: a fake or reused token, or an error fragment (no query), lands on the login.
    for (const type of ["recovery", "invite", "magiclink", null]) {
      expect(confirmLink({ next: "/app", code: null, tokenHash: "h", type }).kind).toBe("invalid");
    }
    expect(confirmLink({ next: "/app", code: null, tokenHash: null, type: null })).toEqual({
      kind: "invalid",
    });
  });
});

describe("mapAuthError", () => {
  it("names throttling as such (429 or Supabase rate-limit codes)", () => {
    expect(mapAuthError({ status: 429 })).toEqual({ code: "RATE_LIMITED" });
    expect(mapAuthError({ code: "over_request_rate_limit", status: 429 })).toEqual({
      code: "RATE_LIMITED",
    });
    expect(mapAuthError({ code: "over_email_send_rate_limit" })).toEqual({ code: "RATE_LIMITED" });
  });

  it("keeps the other mappings", () => {
    expect(mapAuthError({ name: "AuthRetryableFetchError" })).toEqual({ code: "NETWORK_ERROR" });
    expect(mapAuthError({ code: "invalid_credentials", status: 400 })).toEqual({
      code: "INVALID_CREDENTIALS",
    });
    expect(mapAuthError({ code: "email_exists" })).toEqual({ code: "USER_EXISTS" });
    expect(mapAuthError({ name: "AuthSessionMissingError" })).toEqual({ code: "RECOVERY_EXPIRED" });
    expect(mapAuthError({ code: "something_new", status: 500 })).toEqual({ code: "UNKNOWN" });
  });
});
