import { describe, expect, it } from "vitest";
import { countryName, euCountryOptions, initialCountry } from "./countries";

describe("EU country select (OD-6 default)", () => {
  it("names the countries in the UI language and sorts by that name", () => {
    const es = euCountryOptions("es");
    expect(es).toHaveLength(27);
    expect(es.find((c) => c.code === "DE")?.name).toBe("Alemania");
    expect(es[0]?.code).toBe("DE"); // Alemania first in Spanish
    const en = euCountryOptions("en");
    expect(en[0]?.code).toBe("AT"); // Austria first in English
    expect(countryName("en", "ES")).toBe("Spain");
  });

  it("keeps a stored EU country and leaves a non-EU or missing one for the admin to choose", () => {
    expect(initialCountry("PT")).toBe("PT");
    expect(initialCountry("US")).toBe("");
    expect(initialCountry(null)).toBe("");
  });
});
