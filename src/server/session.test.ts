import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

import { primaryMembership } from "./session";

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
