import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { MAGNITUDE_IDS, type ToolErrorCode } from "./engine";
import { parseFavorites, TOOL_IDS } from "./components/ToolsHome";

const ERROR_CODES: ToolErrorCode[] = [
  "required",
  "thousandsSeparator",
  "zeroDenominator",
  "invalidNumber",
  "outOfRange",
  "mustBePositive",
  "mustBeNonNegative",
  "unitMismatch",
  "belowAbsoluteZero",
  "resultOutOfRange",
  "toleranceRange",
  "toleranceRequired",
  "toleranceInvalid",
  "negativeAbsolutePressure",
  "invalidClock",
];

describe("tools catalog coverage", () => {
  for (const [lang, catalog] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`${lang}: every quantity, error code and tool has a label`, () => {
      const tools = catalog.tools;
      for (const id of MAGNITUDE_IDS) expect(tools.magnitude[id].label, id).toBeTruthy();
      for (const code of ERROR_CODES) expect(tools.error[code], code).toBeTruthy();
      for (const id of TOOL_IDS) expect(tools.tile[id].title, id).toBeTruthy();
    });
  }

  it("duration placeholders follow each language's decimal mark (no literals in TSX)", () => {
    expect(es.tools.duration.placeholderDecimal).toBe("1,5");
    expect(en.tools.duration.placeholderDecimal).toBe("1.5");
    expect(es.tools.duration.placeholderClock).toBe(en.tools.duration.placeholderClock);
  });

  it("the torque notice states that it is not an approved specification", () => {
    expect(en.tools.converter.torqueNotice).toMatch(/approved maintenance data/);
    expect(es.tools.converter.torqueNotice).toMatch(/datos de mantenimiento aprobados/);
  });
});

describe("favourites parsing (untrusted localStorage)", () => {
  it("keeps only known tools, in catalogue order, and survives garbage", () => {
    expect(parseFavorites('["duration","torque","fuel","x"]')).toEqual(["torque", "duration"]);
    expect(parseFavorites("not json")).toEqual([]);
    expect(parseFavorites('{"torque":1}')).toEqual([]);
  });

  it("accepts the learning tools (L-4); fuel and v1.8's «time» stay unknown", () => {
    expect(parseFavorites('["knowledge","time","fuel","daily","translator","convert"]')).toEqual([
      "daily",
      "translator",
      "convert",
      "knowledge",
    ]);
  });
});

describe("tools home (L-4)", () => {
  it("lists the tiles in v1.8's order, without fuel (D-11)", () => {
    expect(TOOL_IDS).toEqual(["daily", "translator", "torque", "convert", "knowledge", "duration"]);
  });

  it("the privacy note mentions the challenge progress kept in this browser", () => {
    expect(es.tools.privacyNote).toMatch(/progreso de los retos se guardan en este navegador/);
    expect(en.tools.privacyNote).toMatch(/challenge progress are stored in this browser/);
  });
});
