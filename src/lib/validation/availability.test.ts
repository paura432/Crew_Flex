import { describe, expect, it } from "vitest";
import { createAvailabilityWindowInput, availabilityWindowIdQuery } from "./availability.ts";
import { toFieldErrors } from "./errors.ts";

const valid = {
  startsAt: "2026-10-18T00:00:00Z",
  endsAt: "2026-10-22T00:00:00Z",
  status: "available",
};

const errorsFor = (input: unknown) => {
  const result = createAvailabilityWindowInput.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
};

describe("createAvailabilityWindowInput", () => {
  it("accepts a valid window", () => {
    expect(createAvailabilityWindowInput.parse(valid)).toEqual(valid);
  });

  it.each([
    [{ endsAt: "2026-10-18T00:00:00Z" }, "endsAt", "v.end.afterStart"],
    [{ endsAt: "2027-12-01T00:00:00Z" }, "endsAt", "v.window.maxDays"],
    [{ status: "maybe" }, "status", "v.window.status"],
    [{ startsAt: "18/10/2026" }, "startsAt", "v.start.required"],
  ])("rejects %o", (override, field, message) => {
    expect(errorsFor({ ...valid, ...override })[field]).toBe(message);
  });

  it("E. rejects caller-supplied ownership (strict schema)", () => {
    expect(
      createAvailabilityWindowInput.safeParse({
        ...valid,
        technicianProfileId: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });
});

describe("availabilityWindowIdQuery", () => {
  it("requires a UUID", () => {
    expect(availabilityWindowIdQuery.safeParse({ id: "1 or 1=1" }).success).toBe(false);
    expect(
      availabilityWindowIdQuery.safeParse({ id: "22222222-2222-4222-8222-000000000001" }).success,
    ).toBe(true);
  });
});
