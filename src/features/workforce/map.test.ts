import { describe, expect, it } from "vitest";
import type { TechnicianQualificationRow } from "@/types/database";
import { toWorkforceMembers, type WorkforceRow } from "./map";

const qualification = (code: string) =>
  ({
    id: `q-${code}`,
    status: "active",
    issued_at: null,
    expires_at: null,
    verification_status: "verified",
    qualification_types: { code, name: code, category: "LICENSE" },
  }) as unknown as TechnicianQualificationRow;

describe("toWorkforceMembers", () => {
  it("maps technicians and organization users, sorted by name and qualification code", () => {
    const rows: WorkforceRow[] = [
      {
        profile_id: "b",
        role: "member",
        profiles: {
          display_name: "Zulu",
          technician_profiles: {
            base_location: "MAD",
            years_experience: 4,
            technician_qualifications: [qualification("EWIS"), qualification("B1.1")],
          },
        },
      },
      {
        profile_id: "a",
        role: "admin",
        profiles: { display_name: "Alpha", technician_profiles: null },
      },
    ];
    const members = toWorkforceMembers(rows);
    expect(members.map((m) => m.displayName)).toEqual(["Alpha", "Zulu"]);
    expect(members[0]?.technician).toBeNull();
    expect(members[1]?.technician?.qualifications.map((q) => q.qualification_types.code)).toEqual([
      "B1.1",
      "EWIS",
    ]);
  });

  // Regression: a plain member's embed returns `profiles: null` for colleagues (RLS), which used
  // to crash the page with a TypeError.
  it("omits rows whose profile RLS hides instead of dereferencing null", () => {
    const rows: WorkforceRow[] = [
      {
        profile_id: "self",
        role: "member",
        profiles: { display_name: "Me", technician_profiles: null },
      },
      { profile_id: "hidden", role: "admin", profiles: null },
    ];
    expect(toWorkforceMembers(rows).map((m) => m.profileId)).toEqual(["self"]);
  });
});
