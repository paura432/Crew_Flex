import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { formatMoneyCents, formatMonth, formatPercent } from "../../src/i18n/format";

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

// X-18: the editable calendar read «octubre de 2026»; the mini calendar capitalised it in CSS.
describe("month titles", () => {
  it("start with a capital in both languages", () => {
    expect(formatMonth("es", "2026-10-01T00:00:00Z")).toBe("Octubre de 2026");
    expect(formatMonth("en", "2026-10-01T00:00:00Z")).toBe("October 2026");
  });
});

// ADR-003: training prices are integer cents in EUR, GBP, CHF or USD; no floating point is stored.
describe("money in cents", () => {
  it("formatMoneyCents", () => {
    const nb = (t: string) => t.replace(/\u00a0|\u202f/g, " ");
    expect(nb(formatMoneyCents("es", 125000, "EUR"))).toBe("1250 €");
    expect(nb(formatMoneyCents("es", 125050, "EUR"))).toBe("1250,50 €");
    expect(formatMoneyCents("en", 125050, "GBP")).toBe("£1,250.50");
    expect(formatMoneyCents("en", 9900, "USD")).toBe("US$99");
  });
});
