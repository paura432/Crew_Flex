import { describe, expect, it } from "vitest";
import { createLogbookEntryInput } from "@/lib/validation/logbook";
import { logbookToday } from "@/domain/logbook";
import { logbookInvalidCopyKey, readLogbookForm } from "./form";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("readLogbookForm", () => {
  it("reads the form as the shared schema expects it", () => {
    const values = readLogbookForm(
      formData({
        entryDate: logbookToday(),
        aircraft: "A320 Family",
        ata: "",
        hours: "3.5",
        category: "inspection",
        environment: "workshop",
        description: "Borescope inspection.",
        cvRelevant: "on",
      }),
    );
    expect(values).toMatchObject({ hours: 3.5, ata: "", cvRelevant: true });
    expect(createLogbookEntryInput.parse(values)).toMatchObject({ ata: null, hours: 3.5 });
  });

  it("an empty hours field is missing (the schema asks for it), an unchecked box is false", () => {
    const values = readLogbookForm(formData({ hours: " " }));
    expect(values.hours).toBeUndefined();
    expect(values.cvRelevant).toBe(false);
    const parsed = createLogbookEntryInput.safeParse(values);
    expect(parsed.success).toBe(false);
  });
});

describe("logbookInvalidCopyKey", () => {
  it("uses v1.8's sentence only when the date, the task or the description is wrong", () => {
    expect(logbookInvalidCopyKey({ entryDate: "v.logbook.date.future" })).toBe("logbook.invalid");
    expect(logbookInvalidCopyKey({ description: "x", hours: "y" })).toBe("logbook.invalid");
    expect(logbookInvalidCopyKey({ hours: "v.logbook.hours" })).toBe("common.checkFields");
  });
});
