import { describe, expect, it } from "vitest";
import { upcomingReviews } from "./reviews";

const q = (id: string, status: string, expires_at: string | null) => ({
  id,
  status,
  expires_at,
  qualification_types: { code: id.toUpperCase(), name: `Name ${id}` },
});

describe("upcomingReviews (v1.8 «Documentos y cursos próximos a revisar», 60 days)", () => {
  it("lists held qualifications and documents due within 60 days, expired first, soonest first", () => {
    const items = upcomingReviews(
      [
        q("ewis", "active", "2026-12-20"), // 55 days: listed
        q("fts", "active", "2026-12-30"), // 65 days: not yet
        q("hf", "active", "2026-10-01"), // already passed: listed first
        q("b2", "withdrawn", "2026-11-01"), // not held: never
        q("tr", "active", null), // no date: never
      ],
      [{ id: "d1", title: "Licence scan", expiresAt: "2026-11-15" }],
      "2026-10-26",
    );
    expect(items.map((i) => [i.key, i.expiresAt, i.href])).toEqual([
      ["q-hf", "2026-10-01", "/app/professional/qualifications"],
      ["d-d1", "2026-11-15", "/app/professional/documents"],
      ["q-ewis", "2026-12-20", "/app/professional/qualifications"],
    ]);
    expect(items[0]!.title).toBe("HF · Name hf");
  });

  it("without the wallet (null) only the qualifications count", () => {
    expect(upcomingReviews([q("ewis", "active", "2026-11-01")], null, "2026-10-26")).toHaveLength(
      1,
    );
    expect(upcomingReviews([], null, "2026-10-26")).toEqual([]);
  });
});
