import { describe, expect, it } from "vitest";
import { sectionsOfView, switcherViews, viewOfPath } from "./views";

const actor = (
  platform_role: "user" | "platform_admin",
  account_type: "professional" | "organization",
  memberships: number,
) =>
  ({
    profile: { platform_role, account_type },
    memberships: Array.from({ length: memberships }, (_, i) => ({
      role: "admin",
      organization: { id: `o${i}` },
    })),
  }) as never;

describe("switcherViews", () => {
  it("nobody but a platform admin gets the switcher", () => {
    expect(switcherViews(actor("user", "professional", 1))).toEqual([]);
    expect(switcherViews(actor("user", "organization", 1))).toEqual([]);
  });

  it("a platform admin with a professional account and an organization gets the four views", () => {
    expect(switcherViews(actor("platform_admin", "professional", 1))).toEqual([
      "professional",
      "organization",
      "recruiter",
      "admin",
    ]);
  });

  it("drops the views the admin's own account cannot fill", () => {
    expect(switcherViews(actor("platform_admin", "professional", 0))).toEqual([
      "professional",
      "recruiter",
      "admin",
    ]);
    expect(switcherViews(actor("platform_admin", "organization", 1))).toEqual([
      "organization",
      "recruiter",
      "admin",
    ]);
  });
});

describe("viewOfPath", () => {
  it("maps each workspace and its sub-pages", () => {
    expect(viewOfPath("/app/professional")).toBe("professional");
    expect(viewOfPath("/app/professional/availability")).toBe("professional");
    expect(viewOfPath("/app/organization/requirements/abc/matches")).toBe("organization");
    expect(viewOfPath("/app/recruiter")).toBe("recruiter");
    expect(viewOfPath("/app/admin/verifications")).toBe("admin");
  });

  it("shared routes and look-alike prefixes belong to no view", () => {
    expect(viewOfPath("/app/tools")).toBeNull();
    expect(viewOfPath("/app/settings")).toBeNull();
    expect(viewOfPath("/app/administration")).toBeNull();
  });
});

describe("sectionsOfView", () => {
  const sections = [
    { label: "Org", view: "organization" as const },
    { label: "Pro", view: "professional" as const },
    { label: "Platform", view: "admin" as const },
    { label: "Account" },
  ];
  const labels = (view: Parameters<typeof sectionsOfView>[1]) =>
    sectionsOfView(sections, view).map((s) => s.label);

  it("keeps the view's own section and the untagged ones", () => {
    expect(labels("organization")).toEqual(["Org", "Account"]);
    expect(labels("professional")).toEqual(["Pro", "Account"]);
    expect(labels("admin")).toEqual(["Platform", "Account"]);
    expect(labels("recruiter")).toEqual(["Account"]);
  });

  it("no view yet (a shared page opened first) shows everything", () => {
    expect(labels(null)).toEqual(["Org", "Pro", "Platform", "Account"]);
  });
});
