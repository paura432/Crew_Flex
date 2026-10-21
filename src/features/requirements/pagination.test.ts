import { describe, expect, it } from "vitest";
import { listWorkRequirementsQuery } from "@/lib/validation/work-requirement";
import { pageCount, pageOffset, parseRequirementsPage, REQUIREMENTS_PAGE_SIZE } from "./pagination";

describe("requirements pagination", () => {
  it("reads ?page= as a 1-based page, anything else is page 1", () => {
    expect(parseRequirementsPage("3")).toBe(3);
    expect(parseRequirementsPage(undefined)).toBe(1);
    expect(parseRequirementsPage("0")).toBe(1);
    expect(parseRequirementsPage("-2")).toBe(1);
    expect(parseRequirementsPage("2.5")).toBe(1);
    expect(parseRequirementsPage(["2"])).toBe(1);
  });

  it("caps the page so the offset stays inside the schema (≤ 10 000)", () => {
    const page = parseRequirementsPage("99999");
    expect(listWorkRequirementsQuery.safeParse({ offset: pageOffset(page) }).success).toBe(true);
  });

  it("counts pages of 20 and their offsets (60 needs → 3 pages)", () => {
    expect(REQUIREMENTS_PAGE_SIZE).toBe(20);
    expect(pageCount(60)).toBe(3);
    expect(pageCount(61)).toBe(4);
    expect(pageCount(0)).toBe(1);
    expect(pageOffset(3)).toBe(40);
  });

  it("the list query keeps the dashboard defaults (soonest first, first page)", () => {
    expect(listWorkRequirementsQuery.parse({})).toMatchObject({
      offset: 0,
      order: "starts_asc",
      limit: 50,
    });
    expect(listWorkRequirementsQuery.safeParse({ order: "title" }).success).toBe(false);
    expect(listWorkRequirementsQuery.safeParse({ offset: "-1" }).success).toBe(false);
  });
});
