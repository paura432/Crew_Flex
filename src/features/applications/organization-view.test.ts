import { describe, expect, it } from "vitest";
import {
  applicationsPageCount,
  applicationsPageOffset,
  countAll,
  organizationApplicationsHref,
  parseOrganizationApplicationsFilters,
  tabCounts,
} from "./organization-view";

const R = "9e280aa3-0000-4000-8000-0000000000aa";

describe("organization «Candidaturas» URL state (v2-05)", () => {
  it("parses leniently: a uuid, a known status, a page ≥ 1 (bounded)", () => {
    expect(parseOrganizationApplicationsFilters({})).toEqual({
      requirementId: null,
      status: null,
      page: 1,
    });
    expect(
      parseOrganizationApplicationsFilters({
        requirementId: R.toUpperCase(),
        status: "accepted",
        page: "3",
      }),
    ).toEqual({ requirementId: R, status: "accepted", page: 3 });
    expect(
      parseOrganizationApplicationsFilters({
        requirementId: "x' or 1=1",
        status: "hired",
        page: "-2",
      }),
    ).toEqual({ requirementId: null, status: null, page: 1 });
    expect(parseOrganizationApplicationsFilters({ page: "999999" }).page).toBe(501);
    expect(parseOrganizationApplicationsFilters({ status: ["shortlisted", "x"] }).status).toBe(
      "shortlisted",
    );
  });

  it("builds the URL: a new tab or requirement goes back to page 1; «Ver todas» drops the requirement", () => {
    const f = { requirementId: R, status: "received" as const, page: 4 };
    expect(organizationApplicationsHref(f)).toBe(
      `/app/organization/applications?requirementId=${R}&status=received`,
    );
    expect(organizationApplicationsHref(f, { page: 4 })).toBe(
      `/app/organization/applications?requirementId=${R}&status=received&page=4`,
    );
    expect(organizationApplicationsHref(f, { requirementId: null, status: null })).toBe(
      "/app/organization/applications",
    );
  });

  it("pages of 20; tab counts for the organization or one requirement", () => {
    expect([
      applicationsPageCount(0),
      applicationsPageCount(20),
      applicationsPageCount(21),
    ]).toEqual([1, 1, 2]);
    expect(applicationsPageOffset(3)).toBe(40);
    const rows = [
      { requirementId: R, counts: { received: 2, confirmed: 1 } },
      { requirementId: "other", counts: { received: 1 } },
    ];
    expect(tabCounts(rows, null)).toEqual({ received: 3, confirmed: 1 });
    expect(tabCounts(rows, R)).toEqual({ received: 2, confirmed: 1 });
    expect(tabCounts(rows, "none")).toEqual({});
    expect(countAll(tabCounts(rows, null))).toBe(4);
  });
});
