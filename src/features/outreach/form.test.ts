import { describe, expect, it } from "vitest";
import { noticePreferencesInput } from "@/lib/validation/outreach";
import { preferencesFromForm } from "./form";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("notice preferences form → PUT body (N-10)", () => {
  it("checked boxes are consents; empty optional fields are «not declared»", () => {
    expect(
      preferencesFromForm(
        form({
          aogOptIn: "on",
          mobilizationHours: "",
          timeZone: " Europe/Madrid ",
          quietStart: "",
        }),
      ),
    ).toEqual({
      urgentOptIn: false,
      aogOptIn: true,
      mobilizationHours: null,
      timeZone: "Europe/Madrid",
      quietStart: null,
      quietEnd: null,
    });
  });

  it("a typed value the schema refuses stays refused, never a silent null", () => {
    const body = preferencesFromForm(form({ mobilizationHours: "1.5", timeZone: "UTC" }));
    expect(body.mobilizationHours).toBe(1.5);
    expect(noticePreferencesInput.safeParse(body).success).toBe(false);
    const ok = preferencesFromForm(
      form({
        urgentOptIn: "on",
        mobilizationHours: "48",
        timeZone: "UTC",
        quietStart: "22:00",
        quietEnd: "07:00",
      }),
    );
    expect(noticePreferencesInput.parse(ok)).toMatchObject({
      mobilizationHours: 48,
      urgentOptIn: true,
    });
  });
});
