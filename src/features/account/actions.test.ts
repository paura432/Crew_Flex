import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
vi.mock("next/navigation", () => ({ redirect }));
let locale = "es";
vi.mock("next-intl/server", () => ({ getLocale: async () => locale }));
const signOut = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { signOut } }),
}));
const invokeEdgeFunction = vi.fn();
vi.mock("@/server/edge-functions", () => ({ invokeEdgeFunction }));

const { closeAccountAction, createInvitationAction } = await import("./actions");
const { initialCloseAccountState, initialInviteState } = await import("./state");

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  locale = "es";
});

describe("closeAccountAction", () => {
  it("needs the word of the UI language; nothing is sent otherwise", async () => {
    for (const confirm of ["", "cerrar", "CLOSE", "BORRAR"]) {
      expect(await closeAccountAction(initialCloseAccountState, form({ confirm }))).toEqual({
        status: "error",
        code: "CONFIRM_WORD",
      });
    }
    locale = "en";
    expect(
      await closeAccountAction(initialCloseAccountState, form({ confirm: "CERRAR" })),
    ).toMatchObject({ code: "CONFIRM_WORD" });
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it("explains a refusal for accepted or confirmed commitments", async () => {
    invokeEdgeFunction.mockResolvedValueOnce({
      ok: false,
      error: { code: "CONFLICT", message: "x", reason: "ACTIVE_COMMITMENTS" },
      requestId: "r-1",
    });
    expect(
      await closeAccountAction(initialCloseAccountState, form({ confirm: " CERRAR " })),
    ).toEqual({ status: "error", code: "ACTIVE_COMMITMENTS", requestId: "r-1" });
    expect(invokeEdgeFunction).toHaveBeenCalledWith("account", {
      method: "DELETE",
      body: { confirm: "CERRAR" },
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("explains a refusal for a future confirmed training seat (CFT12)", async () => {
    invokeEdgeFunction.mockResolvedValueOnce({
      ok: false,
      error: { code: "CONFLICT", message: "x", reason: "ACTIVE_TRAINING_SEATS" },
      requestId: "r-2",
    });
    expect(await closeAccountAction(initialCloseAccountState, form({ confirm: "CERRAR" }))).toEqual(
      { status: "error", code: "ACTIVE_TRAINING_SEATS", requestId: "r-2" },
    );
  });

  it("closed: this device's cookies go and the login says so", async () => {
    invokeEdgeFunction.mockResolvedValueOnce({
      ok: true,
      data: { closed: true, filesRemoved: 1, filesPending: 0 },
      requestId: "r-2",
    });
    await expect(
      closeAccountAction(initialCloseAccountState, form({ confirm: "CERRAR" })),
    ).rejects.toThrow("NEXT_REDIRECT /login?closed=1");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("createInvitationAction", () => {
  it("validates e-mail and account type before calling the function", async () => {
    const state = await createInvitationAction(
      initialInviteState,
      form({ email: "nope", accountType: "platform_admin" }),
    );
    expect(state).toMatchObject({
      status: "error",
      code: "VALIDATION_ERROR",
      fieldErrors: { email: "v.email.invalid", accountType: "v.invalid" },
    });
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it("sent: the notice names the address, never a code", async () => {
    invokeEdgeFunction.mockResolvedValueOnce({
      ok: true,
      data: {
        invitation: {
          id: "i-1",
          email: "new@crewflex.test",
          accountType: "professional",
          expiresAt: "2026-10-29T10:00:00.000Z",
        },
      },
      requestId: "r-3",
    });
    const state = await createInvitationAction(
      initialInviteState,
      form({ email: " new@crewflex.test ", accountType: "professional" }),
    );
    expect(state).toEqual({ status: "sent", email: "new@crewflex.test" });
    expect(invokeEdgeFunction).toHaveBeenCalledWith("invitations", {
      method: "POST",
      body: { email: "new@crewflex.test", accountType: "professional" },
    });
  });
});
