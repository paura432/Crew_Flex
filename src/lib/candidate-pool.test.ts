import { describe, expect, it } from "vitest";
import { availabilityStatus, toCandidate } from "./candidate-pool";

const row = (status: string) => ({
  candidate_ref: "CF-0000000001",
  candidate_pool: "external",
  candidate_display_name: null,
  candidate_base_location: null,
  candidate_years_experience: null,
  candidate_qualifications: [],
  candidate_availability: [
    { startsAt: "2026-11-01T00:00:00+00:00", endsAt: "2026-11-02T00:00:00+00:00", status },
  ],
});

describe("pool row availability status (review HIGH-1)", () => {
  it("keeps known statuses", () => {
    for (const s of ["available", "unavailable", "aog_only"] as const) {
      expect(availabilityStatus(s)).toBe(s);
      expect(toCandidate(row(s)).availability[0]!.status).toBe(s);
    }
  });

  it("reads an unknown status as unavailable instead of failing the whole pool", () => {
    expect(toCandidate(row("some_future_value")).availability[0]!.status).toBe("unavailable");
  });
});
