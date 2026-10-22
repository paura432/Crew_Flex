import { describe, expect, it } from "vitest";
import {
  closeAccountInput,
  closeAccountWord,
  createInvitationInput,
  normalizeInvitationCode,
} from "./account";

describe("invitation code", () => {
  const code = "0123456789abcdef".repeat(4);
  it.each([
    [code, code],
    [` ${code.toUpperCase()} `, code],
    [code.slice(1), null],
    [`${code}0`, null],
    ["g".repeat(64), null],
    [undefined, null],
    [42, null],
  ])("%j → %j", (raw, expected) => {
    expect(normalizeInvitationCode(raw)).toBe(expected);
  });
});

describe("account closure confirmation", () => {
  it("each UI language types its own word", () => {
    expect(closeAccountWord("es")).toBe("CERRAR");
    expect(closeAccountWord("en")).toBe("CLOSE");
  });

  it("the schema is strict: the word and nothing else", () => {
    expect(closeAccountInput.safeParse({ confirm: "CERRAR" }).success).toBe(true);
    expect(closeAccountInput.safeParse({ confirm: "CERRAR", profileId: "x" }).success).toBe(false);
    expect(closeAccountInput.safeParse({ confirm: "close" }).success).toBe(false);
  });
});

describe("invitation payload", () => {
  it("is an e-mail and an account type that is never the platform role", () => {
    expect(
      createInvitationInput.safeParse({ email: "a@b.example", accountType: "professional" })
        .success,
    ).toBe(true);
    expect(
      createInvitationInput.safeParse({ email: "a@b.example", accountType: "platform_admin" })
        .success,
    ).toBe(false);
  });
});
