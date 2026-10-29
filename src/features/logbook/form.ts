// Form plumbing for the logbook (no rules here: the shared schema in src/lib/validation/logbook.ts
// decides). Reads the raw values of the entry form the way the schema expects them.

/** The entry form's values: `hours` is a number (or missing), the checkbox a boolean. */
export function readLogbookForm(data: FormData) {
  const text = (name: string) => {
    const value = data.get(name);
    return typeof value === "string" ? value : "";
  };
  const hours = text("hours").trim();
  return {
    entryDate: text("entryDate"),
    aircraft: text("aircraft"),
    ata: text("ata"),
    hours: hours === "" ? undefined : Number(hours),
    category: text("category"),
    environment: text("environment"),
    description: text("description"),
    cvRelevant: data.get("cvRelevant") === "on",
  };
}

/**
 * The form-level message for a refused entry: v1.8's «Indica una tarea realizada, fecha válida y
 * descripción.» when one of those is wrong, the generic «check the fields» otherwise.
 */
export const logbookInvalidCopyKey = (fieldErrors: Record<string, string>) =>
  ["entryDate", "aircraft", "description"].some((field) => field in fieldErrors)
    ? "logbook.invalid"
    : "common.checkFields";
