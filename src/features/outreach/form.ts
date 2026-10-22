// The notice-preferences form's values → the `notice-preferences` PUT body (N-10). Pure; the form and
// its tests share it. Empty optional fields mean «not declared» (null), never 0 or an empty string.

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

export function preferencesFromForm(form: FormData) {
  const hours = text(form, "mobilizationHours");
  return {
    urgentOptIn: form.get("urgentOptIn") === "on",
    aogOptIn: form.get("aogOptIn") === "on",
    // «abc» or «1.5» stay a number the schema refuses (NaN, not an integer), never a silent null.
    mobilizationHours: hours === "" ? null : Number(hours),
    timeZone: text(form, "timeZone"),
    quietStart: text(form, "quietStart") || null,
    quietEnd: text(form, "quietEnd") || null,
  };
}
