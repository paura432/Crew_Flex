import { describe, expect, it } from "vitest";
import {
  clockToHours,
  convert,
  convertRange,
  ambiguousReading,
  decimalSeparator,
  formatNumber,
  hoursToClock,
  MAGNITUDE_IDS,
  parseNumber,
  ToolError,
  unitsOf,
  type ToolErrorCode,
} from "./engine";

const close = (a: number, b: number, eps = 1e-8) => expect(Math.abs(a - b)).toBeLessThan(eps);
const code = (fn: () => unknown): ToolErrorCode | null => {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof ToolError) return e.code;
    throw e;
  }
};

describe("parseNumber (strict input, prototype rules)", () => {
  it("accepts decimal comma or dot, fractions and mixed fractions", () => {
    close(parseNumber("0,8"), 0.8);
    close(parseNumber("0.8"), 0.8);
    close(parseNumber(".5"), 0.5);
    close(parseNumber("3/16"), 0.1875);
    close(parseNumber("1 3/16"), 1.1875);
    close(parseNumber("-1 1/2"), -1.5);
    close(parseNumber("1e3"), 1000);
    close(parseNumber("  42  "), 42);
  });

  it("rejects empty, thousands separators, garbage and division by zero", () => {
    expect(code(() => parseNumber(""))).toBe("required");
    expect(code(() => parseNumber(null))).toBe("required");
    expect(code(() => parseNumber("1,200.4"))).toBe("thousandsSeparator");
    expect(code(() => parseNumber("1/0"))).toBe("zeroDenominator");
    expect(code(() => parseNumber("1 1/0"))).toBe("zeroDenominator");
    for (const v of ["Infinity", "2+2", "1.2.3", "abc", "0x10", "1 ,5"]) {
      expect(code(() => parseNumber(v))).toBe("invalidNumber");
    }
  });

  it("enforces the ±1e15 range and sign options", () => {
    expect(parseNumber("1e15")).toBe(1e15);
    expect(code(() => parseNumber("1.0000001e15"))).toBe("outOfRange");
    expect(code(() => parseNumber("-2e15"))).toBe("outOfRange");
    expect(code(() => parseNumber("-1", { nonnegative: true }))).toBe("mustBeNonNegative");
    expect(code(() => parseNumber("0", { positive: true }))).toBe("mustBePositive");
  });
});

describe("convert", () => {
  it("torque: inch and foot are never confused (factor 12)", () => {
    close(convert(120, "torque", "lbf_in", "lbf_ft"), 10);
    close(convert(120, "torque", "lbf_in", "Nm"), 13.558179483314);
    close(convert(1, "torque", "lbf_ft", "Nm"), 1.3558179483314004);
    close(convert(1, "torque", "kgfm", "Nm"), 9.80665);
    close(convert(1, "torque", "daNm", "Ncm"), 1000);
    close(convert(1, "torque", "ozfin", "Nm"), 0.00706155181422604375);
  });

  it("round-trips every unit pair of every magnitude", () => {
    for (const g of MAGNITUDE_IDS) {
      const ids = Object.keys(unitsOf(g));
      for (const a of ids) {
        for (const b of ids) {
          const value = g === "temperature" ? 300 : 123.456;
          close(convert(convert(value, g, a, b), g, b, a), value, 1e-7);
        }
      }
    }
  });

  it("matches independent reference factors", () => {
    close(convert("3/16", "length", "inch", "mm"), 4.7625);
    close(convert(1, "length", "thou", "mm"), 0.0254);
    close(convert(1, "volume", "USgal", "L"), 3.785411784);
    close(convert(1, "volume", "Impgal", "L"), 4.54609);
    close(convert(1, "mass", "lb", "kg"), 0.45359237);
    close(convert(1, "distance", "NM", "m"), 1852);
    close(convert(1, "speed", "kt", "kmh"), 1.852);
    close(convert(1, "pressure", "psi", "kPa"), 6.894757293168361);
    close(convert(29.92, "pressure", "inHg", "hPa"), 1013.2075888, 1e-6);
  });

  it("temperature: absolute scales include the offset, deltas do not", () => {
    close(convert(32, "temperature", "F", "C"), 0);
    close(convert(100, "temperature", "C", "F"), 212);
    close(convert(-40, "temperature", "C", "F"), -40);
    close(convert(0, "temperature", "K", "C"), -273.15);
    close(convert(20, "temperatureDelta", "dC", "dF"), 36);
    expect(code(() => convert(-274, "temperature", "C", "K"))).toBe("belowAbsoluteZero");
    expect(code(() => convert(-1, "temperature", "K", "C"))).toBe("belowAbsoluteZero");
  });

  it("signed magnitudes accept negatives; unsigned ones refuse them", () => {
    close(convert(-1, "pressure", "bar", "psi"), -14.503773773, 1e-6);
    close(convert(-90, "angle", "deg", "rad"), -Math.PI / 2);
    expect(code(() => convert(-1, "torque", "Nm", "lbf_ft"))).toBe("mustBeNonNegative");
    expect(code(() => convert(-1, "length", "mm", "inch"))).toBe("mustBeNonNegative");
  });

  it("refuses units from another magnitude", () => {
    expect(code(() => convert(1, "torque", "Nm", "mm"))).toBe("unitMismatch");
    expect(code(() => convert(1, "force", "lbf", "lb"))).toBe("unitMismatch");
  });

  it("extreme but valid inputs stay finite", () => {
    expect(Number.isFinite(convert("1e15", "pressure", "MPa", "Pa"))).toBe(true);
    close(convert(0, "torque", "Nm", "lbf_in"), 0);
  });
});

describe("convertRange (tolerance comes from the user's source)", () => {
  it("converts both ends of nominal ± p %", () => {
    const r = convertRange(120, 10, "torque", "lbf_in", "lbf_ft");
    close(r.nominal, 10);
    close(r.low, 9);
    close(r.high, 11);
    const zero = convertRange(50, 0, "torque", "Nm", "Nm");
    expect([zero.low, zero.high]).toEqual([50, 50]);
  });

  it("tolerance must be 0–100 %", () => {
    expect(code(() => convertRange(10, 101, "torque", "Nm", "lbf_in"))).toBe("toleranceRange");
    expect(code(() => convertRange(10, -1, "torque", "Nm", "lbf_in"))).toBe("toleranceRange");
  });

  it("tolerance errors name the tolerance field, value errors stay the value's", () => {
    expect(code(() => convertRange(10, "", "torque", "Nm", "lbf_in"))).toBe("toleranceRequired");
    expect(code(() => convertRange(10, "abc", "torque", "Nm", "lbf_in"))).toBe("toleranceInvalid");
    expect(code(() => convertRange(10, "1.000,5", "torque", "Nm", "lbf_in"))).toBe(
      "toleranceInvalid",
    );
    expect(code(() => convertRange("", 5, "torque", "Nm", "lbf_in"))).toBe("required");
  });
});

describe("durations", () => {
  it("H:MM ↔ decimal hours", () => {
    close(clockToHours("1:30"), 1.5);
    close(clockToHours("0:01"), 1 / 60);
    close(clockToHours("99999:59"), 99999 + 59 / 60);
    expect(hoursToClock(1.5)).toBe("1:30");
    expect(hoursToClock("0,25")).toBe("0:15");
    expect(hoursToClock(0)).toBe("0:00");
  });

  it("rounds to the nearest minute, carrying into the hour", () => {
    expect(hoursToClock(1.999)).toBe("2:00"); // 119.94 min → 120
    expect(hoursToClock(0.0083)).toBe("0:00"); // 0.498 min
    expect(hoursToClock(0.0084)).toBe("0:01"); // 0.504 min
  });

  it("rejects malformed clocks and negative hours", () => {
    for (const v of ["1:60", "1:5", "1", ":30", "-1:00", "100000:00", "1:30:00", "a:bc"]) {
      expect(code(() => clockToHours(v))).toBe("invalidClock");
    }
    expect(code(() => hoursToClock(-1))).toBe("mustBeNonNegative");
  });
});

describe("formatNumber (presentation only)", () => {
  it("uses the locale's decimal mark and caps the decimals", () => {
    expect(formatNumber("es", 1.23456789, 4)).toBe("1,2346");
    expect(formatNumber("en", 1.23456789, 2)).toBe("1.23");
    expect(formatNumber("en", 10, 6)).toBe("10");
  });
});

describe("ambiguousReading (W1-06: show how a number was read)", () => {
  it("knows each locale's decimal mark", () => {
    expect(decimalSeparator("es")).toBe(",");
    expect(decimalSeparator("en")).toBe(".");
  });

  it("echoes a decimal mark that is not the locale's: the ×1000 trap", () => {
    expect(ambiguousReading("1,200", "en")).toBe(1.2);
    expect(ambiguousReading("1.200", "es")).toBe(1.2);
  });

  it("echoes fractions in any locale", () => {
    expect(ambiguousReading("3/16", "es")).toBe(0.1875);
    expect(ambiguousReading(" 1 3/16 ", "en")).toBe(1.1875);
  });

  it("stays quiet for the locale's own mark, plain integers and invalid input", () => {
    expect(ambiguousReading("1,5", "es")).toBeNull();
    expect(ambiguousReading("1.5", "en")).toBeNull();
    expect(ambiguousReading("1200", "en")).toBeNull();
    expect(ambiguousReading("", "es")).toBeNull();
    expect(ambiguousReading("abc,", "en")).toBeNull();
    expect(ambiguousReading("1.000,5", "es")).toBeNull(); // thousandsSeparator error, shown elsewhere
  });

  it("never changes what the engine computes", () => {
    expect(convert("1,200", "mass", "kg", "kg")).toBe(1.2);
    expect(convert("1.200", "mass", "kg", "kg")).toBe(1.2);
  });
});
