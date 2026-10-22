import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

import { accountSummaryKeys } from "./account-summary";

const actor = (
  account_type: "professional" | "organization",
  roles: ("admin" | "manager" | "member")[],
  platform_role = "none",
) =>
  ({
    profile: { account_type, platform_role },
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

  it("a platform admin reads the platform role, not the role in their own organization (X-13)", () => {
    expect(accountSummaryKeys(actor("professional", ["admin"], "platform_admin"))).toEqual([
      "accountType.professional",
      "platformRole.platform_admin",
    ]);
  });
});
