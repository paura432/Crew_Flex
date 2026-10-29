import { describe, expect, it } from "vitest";
import {
  canOpenExternal,
  exactPhrase,
  externalTranslationUrl,
  phraseIn,
  PHRASES,
  suggestPhrases,
  swappedText,
} from "./phrases";

describe("offline repertoire (v1.8 Translator.jsx)", () => {
  it("has 32 rows ES / EN / FR, none empty", () => {
    expect(PHRASES).toHaveLength(32);
    for (const row of PHRASES) for (const cell of row) expect(cell.trim()).not.toBe("");
  });
});

describe("exactPhrase", () => {
  it("matches the source language only, ignoring case, accents and spaces", () => {
    expect(phraseIn(exactPhrase(" TORQUE ", "en")!, "es")).toBe("Par de apriete");
    expect(phraseIn(exactPhrase("inspeccion", "es")!, "fr")).toBe("Inspection");
    expect(exactPhrase("torque", "es")).toBeNull();
    expect(exactPhrase("torq", "en")).toBeNull();
    expect(exactPhrase("", "en")).toBeNull();
  });
});

describe("suggestPhrases", () => {
  it("lists everything without text and filters by substring in the source language", () => {
    expect(suggestPhrases("  ", "en")).toHaveLength(32);
    expect(suggestPhrases("fu", "en").map((r) => phraseIn(r, "en"))).toEqual(["Fuel", "Fuselage"]);
    expect(suggestPhrases("fu", "es").map((r) => phraseIn(r, "es"))).toEqual(["Fuselaje", "Fuga"]);
    expect(suggestPhrases("qwerty", "en")).toEqual([]);
  });
});

describe("swappedText", () => {
  it("an exact match becomes its equivalent; anything else is kept (v1.8 emptied it, ✗ #5)", () => {
    expect(swappedText("torque", "en", "es")).toBe("Par de apriete");
    expect(swappedText("Check the torque", "en", "es")).toBe("Check the torque");
  });
});

describe("external translation link", () => {
  it("encodes the text and needs text, different languages and consent", () => {
    expect(externalTranslationUrl("en", "es", "Fuel & oil")).toBe(
      "https://translate.google.com/?sl=en&tl=es&text=Fuel%20%26%20oil&op=translate",
    );
    expect(canOpenExternal("Fuel", "en", "es", true)).toBe(true);
    expect(canOpenExternal("Fuel", "en", "es", false)).toBe(false);
    expect(canOpenExternal("Fuel", "en", "en", true)).toBe(false);
    expect(canOpenExternal("   ", "en", "es", true)).toBe(false);
  });
});
