import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Like Next's redirect(): it throws, so nothing after it runs.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  getSessionActor,
  primaryMembership,
  requireSessionActor,
  SessionProfileUnavailableError,
} from "./session";

/** Supabase stub: `sub` in the verified claims, and what the profiles query returns. */
function stubSupabase(
  sub: string | null,
  profile: { data: unknown; error: unknown },
  email: unknown = "delta@crewflex.test",
) {
  const query = (result: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: () => q,
      overrideTypes: () => Promise.resolve(result),
    };
    return q;
  };
  vi.mocked(createServerSupabase).mockResolvedValue({
    auth: { getClaims: async () => ({ data: sub ? { claims: { sub, email } } : null }) },
    from: (table: string) =>
      table === "profiles" ? query(profile) : query({ data: [], error: null }),
  } as never);
}

const profile = {
  id: "u1",
  display_name: "Delta",
  account_type: "professional",
  platform_role: "user",
  preferred_locale: "es",
};

describe("requireSessionActor", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  it("returns the actor when the profile is readable", async () => {
    stubSupabase("u1", { data: profile, error: null });
    await expect(requireSessionActor()).resolves.toMatchObject({
      id: "u1",
      email: "delta@crewflex.test",
      profile,
    });
  });

  it("takes the e-mail from the verified claims only, null when missing or not a string", async () => {
    stubSupabase("u1", { data: profile, error: null }, null);
    await expect(requireSessionActor()).resolves.toMatchObject({ email: null });
    stubSupabase("u1", { data: profile, error: null }, 42);
    await expect(requireSessionActor()).resolves.toMatchObject({ email: null });
  });

  it("sends a signed-out visitor to /login", async () => {
    stubSupabase(null, { data: null, error: null });
    await expect(requireSessionActor()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it.each([
    ["the profile row is missing", { data: null, error: null }],
    ["the profile query fails", { data: null, error: { message: "boom" } }],
  ])("does not redirect to /login when signed in but %s (proxy would loop)", async (_, result) => {
    stubSupabase("u1", result);
    await expect(requireSessionActor()).rejects.toBeInstanceOf(SessionProfileUnavailableError);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("getSessionActor stays null in that case (locale and preference callers)", async () => {
    stubSupabase("u1", { data: null, error: null });
    await expect(getSessionActor()).resolves.toBeNull();
  });
});

const m = (role: "admin" | "manager" | "member", id: string) =>
  ({ role, organization: { id, name: id, type: "mro", country: "ES" } }) as never;

describe("primaryMembership", () => {
  it("picks the highest role, then the lowest organization id", () => {
    expect(
      primaryMembership({ memberships: [m("member", "b"), m("admin", "z"), m("manager", "a")] })
        ?.organization.id,
    ).toBe("z");
    expect(
      primaryMembership({ memberships: [m("manager", "b"), m("manager", "a")] })?.organization.id,
    ).toBe("a");
  });
  it("is undefined without memberships", () => {
    expect(primaryMembership({ memberships: [] })).toBeUndefined();
  });
});
