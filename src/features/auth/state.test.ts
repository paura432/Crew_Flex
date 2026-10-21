import { describe, expect, it } from "vitest";
import { isRecentRecovery, loginNotice, safeConfirmNext, safeNextPath } from "./state";

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

  it("ignores anything else (no banner on a plain visit or with only ?next)", () => {
    expect(loginNotice({})).toBeNull();
    expect(loginNotice({ signedOut: "true" })).toBeNull();
    expect(loginNotice({ signedOut: ["1"] })).toBeNull();
  });
});
