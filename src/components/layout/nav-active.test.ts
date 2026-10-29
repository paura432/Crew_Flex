import { describe, expect, it } from "vitest";
import { activeItem, isActiveHref } from "./nav-active";

const items = [
  { href: "/app/professional", label: "Overview" },
  { href: "/app/professional/opportunities", label: "Opportunities" },
  { href: "/app/organization/requirements", label: "Requirements" },
  { href: "/app/tools", label: "Tools" },
  { href: "/app/settings", label: "Settings" },
];

describe("isActiveHref", () => {
  it("workspace homes match their exact path only", () => {
    expect(isActiveHref("/app/professional", "/app/professional")).toBe(true);
    expect(isActiveHref("/app/professional", "/app/professional/profile")).toBe(false);
    expect(isActiveHref("/app/admin", "/app/admin/audit")).toBe(false);
  });

  it("other entries also cover the pages under them, never a sibling with the same prefix", () => {
    expect(isActiveHref("/app/tools", "/app/tools/torque")).toBe(true);
    expect(isActiveHref("/app/settings", "/app/settings/export")).toBe(true);
    expect(isActiveHref("/app/tools", "/app/toolsx")).toBe(false);
  });
});

describe("activeItem (sidebar, dock and breadcrumb)", () => {
  it("a detail page belongs to its list entry", () => {
    expect(activeItem(items, "/app/professional/opportunities/abc")?.label).toBe("Opportunities");
    expect(activeItem(items, "/app/organization/requirements/abc/matches")?.label).toBe(
      "Requirements",
    );
  });

  it("no entry for a page outside the menu", () => {
    expect(activeItem(items, "/app/recruiter")).toBeUndefined();
    expect(activeItem(items, "/app")).toBeUndefined();
  });
});
