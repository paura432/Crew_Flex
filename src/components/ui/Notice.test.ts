import { describe, expect, it } from "vitest";
import type { MessageResolver } from "@/i18n/validation";
import { actionErrorCopy } from "./Notice";

// Echo translator: the text says which catalog key was chosen.
const t: MessageResolver = (key: string) => `«${key}»`;
const copy = (code: string, message: string) => actionErrorCopy(t, { code, message }).text;

describe("actionErrorCopy", () => {
  it("never shows a raw server message (the Edge Functions' English defaults)", () => {
    expect(copy("VALIDATION_ERROR", "Some fields are invalid.")).toBe("«common.checkFields»");
    expect(copy("METHOD_NOT_ALLOWED", "Method not allowed.")).toBe(
      "«api.METHOD_NOT_ALLOWED.description»",
    );
    expect(copy("PAYLOAD_TOO_LARGE", "The request is too large.")).toBe(
      "«api.PAYLOAD_TOO_LARGE.description»",
    );
    expect(copy("SOMETHING_NEW", "boom")).toBe("«common.errorHint»");
  });

  it("translates the keys actions and Edge issues send", () => {
    expect(copy("VALIDATION_ERROR", "common.checkFields")).toBe("«common.checkFields»");
    expect(copy("VALIDATION_ERROR", "v.form.window")).toBe("«v.form.window»");
  });

  it("keeps the code-specific copy for the errors a user can act on", () => {
    expect(copy("NOT_FOUND", "api.NOT_FOUND.description")).toBe("«api.action.gone»");
    expect(copy("NETWORK_ERROR", "The service could not be reached.")).toBe(
      "«api.action.unreachable»",
    );
    expect(copy("UNAUTHORIZED", "Sign in to continue.")).toBe("«api.action.sessionExpired»");
  });
});
