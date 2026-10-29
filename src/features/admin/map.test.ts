import { describe, expect, it } from "vitest";
import {
  AUDIT_PAGE_SIZE,
  auditOffset,
  metadataPairs,
  parseAuditPage,
  shortId,
  toAuditEvent,
  toPlatformSummary,
} from "./map";

describe("platform summary mapping", () => {
  it("maps the RPC row (first row of the set) to the contract", () => {
    expect(
      toPlatformSummary([
        {
          technicians: 24,
          organizations: 4,
          active_requirements: 7,
          working_now: 1,
          aog_with_vacancies: 2,
          demand: [
            { code: "B1.1", seats: 10 },
            { code: null, seats: 2 },
          ],
        },
      ]),
    ).toEqual({
      technicians: 24,
      organizations: 4,
      activeRequirements: 7,
      workingNow: 1,
      aogWithVacancies: 2,
      demand: [
        { code: "B1.1", seats: 10 },
        { code: null, seats: 2 },
      ],
    });
  });

  it("refuses anything that is not a count (no money field can slip through unnoticed)", () => {
    expect(() => toPlatformSummary({ technicians: -1 })).toThrow();
  });
});

describe("audit page", () => {
  it("parses ?page= as 1-based, capped, and turns it into an offset", () => {
    expect(parseAuditPage(undefined)).toBe(1);
    expect(parseAuditPage("0")).toBe(1);
    expect(parseAuditPage("2.5")).toBe(1);
    expect(parseAuditPage("3")).toBe(3);
    expect(parseAuditPage("999999")).toBe(201);
    expect(auditOffset(3)).toBe(2 * AUDIT_PAGE_SIZE);
  });

  it("maps a row and shows its metadata as sorted pairs, ids shortened", () => {
    const event = toAuditEvent({
      id: "e1",
      created_at: "2026-10-23T09:00:00+00:00",
      action: "organization.updated",
      actor_profile_id: "00000000-0000-4000-8000-000000000001",
      organization_id: "o1",
      entity_type: "organization",
      entity_id: "o1",
      metadata: { review_reset: true, fields: ["tax_id", "country"] },
    });
    expect(event.at).toBe("2026-10-23T09:00:00.000Z");
    expect(metadataPairs(event.metadata)).toEqual([
      "fields: tax_id, country",
      "review_reset: true",
    ]);
    expect(metadataPairs({ request_id: "x".repeat(60) })[0]).toHaveLength(
      "request_id: ".length + 40,
    );
    expect(shortId(event.actorId!)).toBe("00000000");
  });
});
