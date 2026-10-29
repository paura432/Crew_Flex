import { describe, expect, it } from "vitest";
import { listNoticesQuery, markNoticesReadInput, NOTICES_PAGE_SIZE } from "./notices";

const id = "00000000-0000-4000-8000-0000000000aa";

describe("notice inputs (v2-18)", () => {
  it("the list pages by 20 by default, at most 50, and the bell asks only for the count", () => {
    expect(listNoticesQuery.parse({})).toEqual({ offset: 0, limit: NOTICES_PAGE_SIZE });
    expect(listNoticesQuery.parse({ offset: "40", limit: "20" })).toEqual({
      offset: 40,
      limit: 20,
    });
    expect(listNoticesQuery.parse({ view: "count" }).view).toBe("count");
    expect(listNoticesQuery.safeParse({ limit: "51" }).success).toBe(false);
    expect(listNoticesQuery.safeParse({ offset: "-1" }).success).toBe(false);
    // The reader is the JWT subject: no recipient in the query.
    expect(listNoticesQuery.safeParse({ recipientId: id }).success).toBe(false);
  });

  it("marking read takes exactly one notice id or `all: true`", () => {
    expect(markNoticesReadInput.safeParse({ id }).success).toBe(true);
    expect(markNoticesReadInput.safeParse({ all: true }).success).toBe(true);
    for (const body of [{}, { id, all: true }, { all: false }, { id: "x" }, { id, userId: id }]) {
      expect(markNoticesReadInput.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
    expect(markNoticesReadInput.safeParse({}).error?.issues.map((i) => i.message)).toEqual([
      "v.invalid",
    ]);
  });
});
