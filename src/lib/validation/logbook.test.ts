import { describe, expect, it } from "vitest";
import { logbookToday } from "../../domain/logbook";
import { toFieldErrors } from "./errors";
import {
  createLogbookEntryInput,
  listLogbookQuery,
  logbookEntryIdQuery,
  updateLogbookEntryInput,
} from "./logbook";

const today = logbookToday();
const valid = {
  entryDate: today,
  aircraft: "  A320 EC-QAA ",
  ata: " 32 ",
  hours: 3.5,
  category: "component_replacement",
  environment: "line_maintenance",
  description: " Main wheel replaced. ",
};

const errorsOf = (schema: typeof createLogbookEntryInput, input: unknown) => {
  const parsed = schema.safeParse(input);
  return parsed.success ? {} : toFieldErrors(parsed.error);
};

describe("createLogbookEntryInput (BR-17)", () => {
  it("trims the text fields, defaults the selection flag and keeps today's date", () => {
    expect(createLogbookEntryInput.parse(valid)).toEqual({
      ...valid,
      aircraft: "A320 EC-QAA",
      ata: "32",
      description: "Main wheel replaced.",
      cvRelevant: false,
    });
  });

  it("an empty or missing ATA is null", () => {
    expect(createLogbookEntryInput.parse({ ...valid, ata: "   " }).ata).toBeNull();
    expect(createLogbookEntryInput.parse({ ...valid, ata: null }).ata).toBeNull();
    const withoutAta: Partial<typeof valid> = { ...valid };
    delete withoutAta.ata;
    expect(createLogbookEntryInput.parse(withoutAta).ata).toBeUndefined();
  });

  it("refuses a future date with the v1.8 message key", () => {
    const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(errorsOf(createLogbookEntryInput, { ...valid, entryDate: tomorrow })).toEqual({
      entryDate: "v.logbook.date.future",
    });
    expect(errorsOf(createLogbookEntryInput, { ...valid, entryDate: "2026-02-30" })).toEqual({
      entryDate: "v.logbook.date.invalid",
    });
  });

  it("enforces the v1.8 limits (aircraft ≤ 100, ATA ≤ 10, description 1–3000, hours 0–24 by 0.1)", () => {
    expect(errorsOf(createLogbookEntryInput, { ...valid, aircraft: " " })).toEqual({
      aircraft: "v.logbook.aircraft.required",
    });
    expect(errorsOf(createLogbookEntryInput, { ...valid, aircraft: "A".repeat(101) })).toEqual({
      aircraft: "v.logbook.aircraft.max",
    });
    expect(errorsOf(createLogbookEntryInput, { ...valid, ata: "12345678901" })).toEqual({
      ata: "v.logbook.ata",
    });
    expect(errorsOf(createLogbookEntryInput, { ...valid, description: "" })).toEqual({
      description: "v.logbook.description.required",
    });
    expect(errorsOf(createLogbookEntryInput, { ...valid, description: "x".repeat(3001) })).toEqual({
      description: "v.logbook.description.max",
    });
    for (const hours of [-1, 24.5, 1.25, "3.5"]) {
      expect(errorsOf(createLogbookEntryInput, { ...valid, hours }), String(hours)).toEqual({
        hours: "v.logbook.hours",
      });
    }
    expect(createLogbookEntryInput.parse({ ...valid, hours: 0 }).hours).toBe(0);
    expect(createLogbookEntryInput.parse({ ...valid, hours: 24 }).hours).toBe(24);
  });

  it("only the v1.8 categories and environments", () => {
    expect(errorsOf(createLogbookEntryInput, { ...valid, category: "Inspection" })).toEqual({
      category: "v.logbook.category",
    });
    expect(errorsOf(createLogbookEntryInput, { ...valid, environment: "hangar" })).toEqual({
      environment: "v.logbook.environment",
    });
  });

  it("is strict: identity and status cannot be supplied", () => {
    for (const extra of [
      { technicianProfileId: "00000000-0000-4000-8000-000000000021" },
      { userId: "x" },
      { status: "verified" },
      { archived: true },
    ]) {
      expect(createLogbookEntryInput.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });
});

describe("updateLogbookEntryInput", () => {
  it("accepts a subset, including the archive and selection flags", () => {
    expect(updateLogbookEntryInput.parse({ archived: true })).toEqual({ archived: true });
    expect(updateLogbookEntryInput.parse({ cvRelevant: true })).toEqual({ cvRelevant: true });
    expect(updateLogbookEntryInput.parse({ hours: 2, ata: "" })).toEqual({ hours: 2, ata: null });
  });

  it("refuses an empty body, unknown keys and invalid values", () => {
    expect(updateLogbookEntryInput.safeParse({}).success).toBe(false);
    expect(updateLogbookEntryInput.safeParse({ technicianProfileId: "x" }).success).toBe(false);
    expect(updateLogbookEntryInput.safeParse({ hours: 25 }).success).toBe(false);
    expect(updateLogbookEntryInput.safeParse({ archived: "yes" }).success).toBe(false);
  });
});

describe("queries", () => {
  it("list: active by default, at most 500", () => {
    expect(listLogbookQuery.parse({})).toEqual({ view: "active", limit: 200 });
    expect(listLogbookQuery.parse({ view: "archived", limit: "20" })).toEqual({
      view: "archived",
      limit: 20,
    });
    expect(listLogbookQuery.safeParse({ limit: "501" }).success).toBe(false);
    expect(listLogbookQuery.safeParse({ view: "all" }).success).toBe(false);
    expect(listLogbookQuery.safeParse({ owner: "x" }).success).toBe(false);
  });

  it("entry id is a uuid", () => {
    expect(logbookEntryIdQuery.safeParse({ id: "nope" }).success).toBe(false);
    expect(
      logbookEntryIdQuery.safeParse({ id: "3c9e1d7a-5b2f-4e8a-9c1d-2f3a4b5c6d7e" }).success,
    ).toBe(true);
  });
});
