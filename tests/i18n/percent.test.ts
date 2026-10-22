import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { formatPercent } from "../../src/i18n/format";

// X-05: «Cubre el 48.78% del periodo» showed the English decimal mark in Spanish.
describe("percentages use the locale's decimal mark", () => {
  it("formatPercent", () => {
    expect(formatPercent("es", 48.78)).toBe("48,78%");
    expect(formatPercent("en", 48.78)).toBe("48.78%");
    expect(formatPercent("es", 86)).toBe("86%");
  });

  it("catalog messages format {percent} as a number", () => {
    const tEs = createTranslator({ locale: "es", messages: es, namespace: "matching" });
    const tEn = createTranslator({ locale: "en", messages: en, namespace: "matching" });
    expect(tEs("availability.partial", { percent: 48.78 })).toBe("Cubre el 48,78% del periodo");
    expect(tEn("availability.partial", { percent: 48.78 })).toBe("Covers 48.78% of the period");
    expect(tEs("blocker.partial", { percent: 48.78 })).toContain("48,78%");
  });
});
