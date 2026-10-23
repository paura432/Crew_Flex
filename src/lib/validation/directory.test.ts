import { describe, expect, it } from "vitest";
import { directoryBlockInput, directorySearchQuery } from "./directory";

const ORG = "22222222-2222-4222-8222-000000000001";
const today = new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe("directorySearchQuery (shared with the candidate-directory function)", () => {
  it("accepts the seven filters as query strings and refuses identities, unknown values and bad windows", () => {
    const full = directorySearchQuery.parse({
      organizationId: ORG,
      category: "B1.1",
      aircraft: "A320 Family",
      englishLevel: "B2",
      minYears: "5",
      country: "ES",
      base: " Madrid ",
      from: today,
      to: plusDays(10),
      blocked: "1",
      page: "2",
    });
    expect(full).toMatchObject({ minYears: 5, page: 2, base: "Madrid", blocked: "1" });
    expect(directorySearchQuery.parse({ organizationId: ORG })).toEqual({ organizationId: ORG });
    for (const bad of [
      { userId: ORG },
      { profileId: ORG },
      { role: "admin" },
      { category: "B9" },
      { englishLevel: "D1" },
      { minYears: "61" },
      { minYears: "x" },
      { country: "UK" },
      { base: "x".repeat(81) },
      { from: today },
      { from: plusDays(3), to: today },
      { from: today, to: plusDays(366) },
      { from: plusDays(-1), to: plusDays(2) },
      { blocked: "true" },
      { page: "0" },
      { page: "501" },
    ]) {
      expect(
        directorySearchQuery.safeParse({ organizationId: ORG, ...bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
    const window = directorySearchQuery.safeParse({ organizationId: ORG, from: today });
    expect(window.success).toBe(false);
    if (!window.success) expect(window.error.issues[0]?.message).toBe("v.directory.window");
    const years = directorySearchQuery.safeParse({ organizationId: ORG, minYears: "99" });
    if (!years.success) expect(years.error.issues[0]?.message).toBe("v.directory.minYears");
  });
});

describe("directoryBlockInput", () => {
  it("is strict: the organization, the organization's ref and a boolean", () => {
    expect(
      directoryBlockInput.parse({
        organizationId: ORG,
        candidateRef: "CF-0123456789",
        blocked: true,
      }),
    ).toEqual({ organizationId: ORG, candidateRef: "CF-0123456789", blocked: true });
    for (const bad of [
      { organizationId: ORG, candidateRef: ORG, blocked: true },
      { organizationId: ORG, candidateRef: "cf-0123456789", blocked: true },
      { organizationId: ORG, candidateRef: "CF-0123456789", blocked: "1" },
      { organizationId: ORG, candidateRef: "CF-0123456789", blocked: true, userId: ORG },
    ]) {
      expect(directoryBlockInput.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
