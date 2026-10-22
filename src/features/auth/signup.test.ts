import { beforeEach, describe, expect, it, vi } from "vitest";

// signUpAction with and without the invitation flag (T-40). Supabase is mocked: the database rules
// themselves are proven in tests/db/account.test.ts.
vi.mock("server-only", () => ({}));
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "http://localhost:3000" }),
}));
const rpc = vi.fn();
const signUp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc, auth: { signUp } }),
}));

const { signUpAction } = await import("./actions");
const { initialAuthState } = await import("./state");

const CODE = "ab".repeat(32);
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const professional = {
  accountType: "professional",
  displayName: "New Person",
  email: "new.person@crewflex.test",
  password: "a-long-enough-password",
};
const answers = (flag: boolean, ...statuses: { status: string; account_type: string | null }[]) => {
  rpc.mockImplementation(async (name: string) =>
    name === "invitation_signup_required"
      ? { data: flag, error: null }
      : { data: [statuses.shift() ?? { status: "invalid", account_type: null }], error: null },
  );
};

beforeEach(() => vi.clearAllMocks());

describe("open sign-up (flag off)", () => {
  it("is unchanged, and the confirmation link lands on /auth/confirm?next=/app", async () => {
    answers(false);
    signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    const state = await signUpAction(initialAuthState, form(professional));
    expect(state).toEqual({ status: "check_email", email: professional.email });
    const call = signUp.mock.calls[0]![0];
    expect(call.options.emailRedirectTo).toBe("http://localhost:3000/auth/confirm?next=/app");
    expect(call.options.data).toEqual({ account_type: "professional", display_name: "New Person" });
    expect(rpc).not.toHaveBeenCalledWith("invitation_status", expect.anything());
  });

  it("an existing address gets the new-address answer even when Auth says user_already_exists (T-41)", async () => {
    answers(false);
    signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { name: "AuthApiError", status: 422, code: "user_already_exists", message: "x" },
    });
    const state = await signUpAction(initialAuthState, form(professional));
    expect(state).toEqual({ status: "check_email", email: professional.email });
  });

  it("ignores an invitation code: the form's type and no code in the metadata", async () => {
    answers(false);
    signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    await signUpAction(initialAuthState, form({ ...professional, invitationCode: CODE }));
    expect(signUp.mock.calls[0]![0].options.data).not.toHaveProperty("invitation_code");
  });
});

describe("sign-up by invitation (flag on)", () => {
  it("without a code: its own message, Auth is not called", async () => {
    answers(true);
    const state = await signUpAction(initialAuthState, form(professional));
    expect(state).toMatchObject({ status: "error", code: "INVITATION_REQUIRED" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("an unknown, used or expired code: one message, Auth is not called", async () => {
    answers(true, { status: "invalid", account_type: null });
    const state = await signUpAction(
      initialAuthState,
      form({ ...professional, invitationCode: CODE }),
    );
    expect(state).toMatchObject({ status: "error", code: "INVITATION_INVALID" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("a code of another address: its own message, nothing consumed", async () => {
    answers(
      true,
      { status: "valid", account_type: "professional" },
      { status: "other_email", account_type: null },
    );
    const state = await signUpAction(
      initialAuthState,
      form({ ...professional, invitationCode: CODE }),
    );
    expect(state).toMatchObject({ status: "error", code: "INVITATION_OTHER_EMAIL" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("a valid code: the invitation's type wins and the code reaches the trigger", async () => {
    answers(
      true,
      { status: "valid", account_type: "organization" },
      { status: "valid", account_type: "organization" },
    );
    signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    const state = await signUpAction(
      initialAuthState,
      form({
        ...professional,
        invitationCode: ` ${CODE.toUpperCase()} `,
        organizationName: "Invited MRO",
        organizationType: "mro",
        country: "es",
      }),
    );
    expect(state).toEqual({ status: "check_email", email: professional.email });
    expect(signUp.mock.calls[0]![0].options.data).toEqual({
      account_type: "organization",
      display_name: "New Person",
      organization_name: "Invited MRO",
      organization_type: "mro",
      country: "ES",
      invitation_code: CODE,
    });
  });
});
