import { describe, expect, it } from "vitest";
import { localeFromAcceptLanguage, resolveLocale } from "./resolve";

describe("localeFromAcceptLanguage", () => {
  it("picks the best supported language by quality", () => {
    expect(localeFromAcceptLanguage("es-ES,es;q=0.9,en;q=0.8")).toBe("es");
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.5")).toBe("en");
    expect(localeFromAcceptLanguage("de;q=0.3,es;q=0.8")).toBe("es");
  });

  it("returns null for unsupported or empty headers", () => {
    expect(localeFromAcceptLanguage("fr-FR,de;q=0.8")).toBeNull();
    expect(localeFromAcceptLanguage("")).toBeNull();
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage("*")).toBeNull();
  });
});

describe("resolveLocale precedence", () => {
  it("persisted preference beats cookie, browser and fallback", () => {
    expect(resolveLocale({ preference: "es", cookie: "en", acceptLanguage: "en-US" })).toBe("es");
  });

  it("cookie beats the browser language", () => {
    expect(resolveLocale({ preference: null, cookie: "en", acceptLanguage: "es-ES" })).toBe("en");
  });

  it("browser language is used when nothing is stored", () => {
    expect(resolveLocale({ preference: null, cookie: undefined, acceptLanguage: "es" })).toBe("es");
  });

  it("falls back to English when nothing is recognised, ignoring invalid values", () => {
    expect(resolveLocale({ preference: "fr", cookie: "xx", acceptLanguage: "fr-FR" })).toBe("en");
    expect(resolveLocale({ preference: null, cookie: null, acceptLanguage: null })).toBe("en");
  });
});
