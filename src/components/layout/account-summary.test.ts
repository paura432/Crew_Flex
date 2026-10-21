import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

import { accountSummaryKeys } from "./account-summary";

const actor = (
  account_type: "professional" | "organization",
  roles: ("admin" | "manager" | "member")[],
) =>
  ({
    profile: { account_type },
    memberships: roles.map((role, i) => ({
      role,
      organization: { id: `org-${i}`, name: `Org ${i}`, type: "mro", country: "ES" },
    })),
  }) as never;

describe("accountSummaryKeys", () => {
  it("a professional without an organization shows the account type only", () => {
    expect(accountSummaryKeys(actor("professional", []))).toEqual(["accountType.professional"]);
  });

  it("adds the role in the primary organization (highest role)", () => {
    expect(accountSummaryKeys(actor("organization", ["member", "admin"]))).toEqual([
      "accountType.organization",
      "role.admin",
    ]);
    expect(accountSummaryKeys(actor("professional", ["member"]))).toEqual([
      "accountType.professional",
      "role.member",
    ]);
  });
});
