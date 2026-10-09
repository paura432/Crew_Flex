import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./errors.ts";
import { createWorkRequirementInput, evaluateRequirementInput } from "./work-requirement.ts";

const B11 = "11111111-1111-4111-8111-000000000001";
const SMS = "11111111-1111-4111-8111-000000000006";

const valid = {
  organizationId: "22222222-2222-4222-8222-000000000001",
  title: "B1.1 · A320 line maintenance reinforcement",
  location: "Madrid (MAD)",
  startsAt: "2026-10-18T20:00:00Z",
  endsAt: "2026-10-22T06:00:00Z",
  shift: "night",
  headcount: 2,
  urgency: "urgent",
  qualifications: [
    { qualificationTypeId: B11, level: "hard" },
    { qualificationTypeId: SMS, level: "soft" },
  ],
};

function errorsFor(input: unknown) {
  const result = createWorkRequirementInput.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
}

describe("createWorkRequirementInput", () => {
  it("accepts a valid requirement and trims text", () => {
    const parsed = createWorkRequirementInput.parse({ ...valid, title: "  Night support  " });
    expect(parsed.title).toBe("Night support");
  });

  it.each([
    [{ headcount: 0 }, "headcount", "Headcount must be at least 1"],
    [{ headcount: 2.5 }, "headcount", "Headcount must be a whole number"],
    [{ title: "  " }, "title", "Title must have at least 3 characters"],
    [{ location: "" }, "location", "Location must have at least 2 characters"],
    [{ endsAt: "2026-10-18T19:00:00Z" }, "endsAt", "End must be after start"],
    [{ endsAt: "2027-12-01T00:00:00Z" }, "endsAt", "A requirement can last at most 366 days"],
    [{ qualifications: [] }, "qualifications", "Add at least one qualification"],
    [
      { qualifications: [{ qualificationTypeId: SMS, level: "soft" }] },
      "qualifications",
      "At least one qualification must be a hard requirement",
    ],
    [
      {
        qualifications: [
          { qualificationTypeId: B11, level: "hard" },
          { qualificationTypeId: B11, level: "soft" },
        ],
      },
      "qualifications",
      "Each qualification can only be added once",
    ],
    [{ urgency: "asap" }, "urgency", "Choose an urgency"],
    [{ startsAt: "18/10/2026" }, "startsAt", "Start date and time are required"],
  ])("rejects %o", (override, field, message) => {
    expect(errorsFor({ ...valid, ...override })[field]).toBe(message);
  });

  it("E. rejects caller-supplied identity fields (strict schema)", () => {
    const errors = errorsFor({ ...valid, userId: "00000000-0000-4000-8000-000000000001" });
    expect(Object.keys(errors)).toContain("form");
    expect(createWorkRequirementInput.safeParse({ ...valid, createdBy: "x" }).success).toBe(false);
  });

  it("rejects oversized qualification arrays", () => {
    const qualifications = Array.from({ length: 21 }, (_, i) => ({
      qualificationTypeId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      level: "hard",
    }));
    expect(errorsFor({ ...valid, qualifications }).qualifications).toBe(
      "At most 20 qualifications",
    );
  });
});

describe("evaluateRequirementInput", () => {
  it("requires a UUID and nothing else", () => {
    expect(evaluateRequirementInput.safeParse({ requirementId: "1 or 1=1" }).success).toBe(false);
    expect(
      evaluateRequirementInput.safeParse({
        requirementId: "22222222-2222-4222-8222-000000000001",
        organizationId: "22222222-2222-4222-8222-000000000001",
      }).success,
    ).toBe(false);
  });
});
