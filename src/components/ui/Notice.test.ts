import { describe, expect, it } from "vitest";
import type { MessageResolver } from "@/i18n/validation";
import { redirect } from "next/navigation";
import { actionErrorCopy, callAction } from "./action-result";

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

describe("callAction (X-02)", () => {
  it("a failed request becomes NETWORK_ERROR with the «offline» copy instead of throwing", async () => {
    const result = await callAction(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(result).toMatchObject({ ok: false, status: "error", code: "NETWORK_ERROR" });
    expect(actionErrorCopy(t, result).text).toBe("«api.action.offline»");
  });

  it("a server-side throw is a server error, not «check your connection» (review R-X M2)", async () => {
    const result = await callAction(() => Promise.reject(new Error("boom")));
    expect(result).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
    expect(actionErrorCopy(t, result).text).toBe("«api.INTERNAL_ERROR.description»");
  });

  it("an action unknown to the deployed server asks for a reload (open tab across a deploy)", async () => {
    const { UnrecognizedActionError } =
      await import("next/dist/client/components/unrecognized-action-error");
    const result = await callAction(() => Promise.reject(new UnrecognizedActionError("gone")));
    expect(actionErrorCopy(t, result).text).toBe("«api.action.reload»");
  });

  it("passes results through and lets Next's redirect propagate", async () => {
    expect(await callAction(async () => ({ ok: true }))).toEqual({ ok: true });
    await expect(callAction(async () => redirect("/app"))).rejects.toThrow("NEXT_REDIRECT");
  });
});
