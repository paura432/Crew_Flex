// Calculation engine for the professional tools (V1.3/V1.8 prototype `src/tools/engine.js`, engine
// 1.0.0, scope approved under D-11 on 2026-10-19: unit conversion, torque conversion, durations).
// Pure and client-side: no value is ever sent to a server. Canonical units internally; rounding is
// presentation only. Factors: NIST SP 811 appendix B (`UNIT_SOURCE`). Errors carry an i18n code.
export const ENGINE_VERSION = "1.0.0";
export const UNIT_SOURCE =
  "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9";

export const MAX_ABS_VALUE = 1e15;

export interface Unit {
  /** Language-neutral symbol; a few have a translated label in `tools.unit.*`. */
  symbol: string;
  /** value × factor + offset = canonical value. */
  factor: number;
  offset: number;
}

const unit = (symbol: string, factor: number, offset = 0): Unit => ({ symbol, factor, offset });

export interface Magnitude {
  /** Negative values allowed (signed quantities). */
  signed?: boolean;
  units: Record<string, Unit>;
}

export const MAGNITUDES = {
  torque: {
    units: {
      Nm: unit("N·m", 1),
      lbf_ft: unit("lbf·ft", 1.3558179483314004),
      lbf_in: unit("lbf·in", 0.1129848290276167),
      Ncm: unit("N·cm", 0.01),
      daNm: unit("daN·m", 10),
      kgfm: unit("kgf·m", 9.80665),
      kgfcm: unit("kgf·cm", 0.0980665),
      ozfin: unit("ozf·in", 0.00706155181422604375),
    },
  },
  length: {
    units: {
      mm: unit("mm", 0.001),
      inch: unit("in", 0.0254),
      ft: unit("ft", 0.3048),
      m: unit("m", 1),
      cm: unit("cm", 0.01),
      um: unit("µm", 0.000001),
      thou: unit("mil / thou", 0.0000254),
    },
  },
  mass: {
    units: {
      kg: unit("kg", 1),
      lb: unit("lb", 0.45359237),
      g: unit("g", 0.001),
      tonne: unit("t", 1000),
      oz: unit("oz", 0.028349523125),
    },
  },
  volume: {
    units: {
      L: unit("L", 1),
      USgal: unit("US gal", 3.785411784),
      Impgal: unit("Imp gal", 4.54609),
      mL: unit("mL", 0.001),
      m3: unit("m³", 1000),
      USqt: unit("US qt", 0.946352946),
      Impqt: unit("Imp qt", 1.1365225),
      in3: unit("in³", 0.016387064),
    },
  },
  density: {
    units: {
      kgL: unit("kg/L", 1),
      kgm3: unit("kg/m³", 0.001),
      gmL: unit("g/mL", 1),
      lbUSgal: unit("lb/US gal", 0.45359237 / 3.785411784),
      lbImpgal: unit("lb/Imp gal", 0.45359237 / 4.54609),
    },
  },
  pressure: {
    signed: true,
    units: {
      bar: unit("bar", 100000),
      psi: unit("psi", 6894.757293168361),
      Pa: unit("Pa", 1),
      hPa: unit("hPa", 100),
      kPa: unit("kPa", 1000),
      MPa: unit("MPa", 1000000),
      mbar: unit("mbar", 100),
      inHg: unit("inHg · 0 °C", 3386.389),
    },
  },
  temperature: {
    signed: true,
    units: {
      C: unit("°C", 1, 273.15),
      F: unit("°F", 5 / 9, 255.3722222222222),
      K: unit("K", 1),
    },
  },
  temperatureDelta: {
    signed: true,
    units: { dC: unit("Δ°C", 1), dF: unit("Δ°F", 5 / 9), dK: unit("ΔK", 1) },
  },
  force: {
    units: {
      N: unit("N", 1),
      daN: unit("daN", 10),
      kN: unit("kN", 1000),
      lbf: unit("lbf", 4.4482216152605),
      kgf: unit("kgf", 9.80665),
    },
  },
  area: {
    units: {
      mm2: unit("mm²", 0.000001),
      cm2: unit("cm²", 0.0001),
      m2: unit("m²", 1),
      in2: unit("in²", 0.00064516),
      ft2: unit("ft²", 0.09290304),
    },
  },
  flowVolume: {
    units: {
      Lmin: unit("L/min", 1),
      Lh: unit("L/h", 1 / 60),
      USgpm: unit("US gal/min", 3.785411784),
      Impgpm: unit("Imp gal/min", 4.54609),
      m3h: unit("m³/h", 1000 / 60),
    },
  },
  flowMass: {
    units: {
      kgh: unit("kg/h", 1),
      lbh: unit("lb/h", 0.45359237),
      kgs: unit("kg/s", 3600),
      kgmin: unit("kg/min", 60),
    },
  },
  speed: {
    units: {
      ms: unit("m/s", 1),
      kmh: unit("km/h", 1 / 3.6),
      kt: unit("kt", 1852 / 3600),
      mph: unit("mph", 1609.344 / 3600),
      fts: unit("ft/s", 0.3048),
    },
  },
  distance: {
    units: {
      km: unit("km", 1000),
      NM: unit("NM", 1852),
      m: unit("m", 1),
      mile: unit("mi", 1609.344),
    },
  },
  power: {
    units: {
      W: unit("W", 1),
      kW: unit("kW", 1000),
      hp: unit("hp", 745.6998715822702),
      PS: unit("CV / PS", 735.49875),
    },
  },
  voltage: { units: { V: unit("V", 1), mV: unit("mV", 0.001), kV: unit("kV", 1000) } },
  current: { units: { A: unit("A", 1), mA: unit("mA", 0.001), uA: unit("µA", 0.000001) } },
  resistance: {
    units: { ohm: unit("Ω", 1), kohm: unit("kΩ", 1000), Mohm: unit("MΩ", 1000000) },
  },
  frequency: { units: { Hz: unit("Hz", 1), kHz: unit("kHz", 1000), MHz: unit("MHz", 1000000) } },
  angle: { signed: true, units: { deg: unit("°", Math.PI / 180), rad: unit("rad", 1) } },
  rotation: { units: { rpm: unit("rpm", Math.PI / 30), rads: unit("rad/s", 1) } },
  time: { units: { min: unit("min", 60), hour: unit("h", 3600), sec: unit("s", 1) } },
} as const satisfies Record<string, Magnitude>;

export type MagnitudeId = keyof typeof MAGNITUDES;
export const MAGNITUDE_IDS = Object.keys(MAGNITUDES) as MagnitudeId[];
export type UnitId<G extends MagnitudeId> = keyof (typeof MAGNITUDES)[G]["units"] & string;

export const unitsOf = (group: MagnitudeId): Record<string, Unit> => MAGNITUDES[group].units;
const isSigned = (group: MagnitudeId) => "signed" in MAGNITUDES[group];

export type ToolErrorCode =
  | "required"
  | "thousandsSeparator"
  | "zeroDenominator"
  | "invalidNumber"
  | "outOfRange"
  | "mustBePositive"
  | "mustBeNonNegative"
  | "unitMismatch"
  | "belowAbsoluteZero"
  | "resultOutOfRange"
  | "toleranceRange"
  | "toleranceRequired"
  | "toleranceInvalid"
  | "negativeAbsolutePressure"
  | "invalidClock";

export class ToolError extends Error {
  constructor(readonly code: ToolErrorCode) {
    super(code);
  }
}

const MIXED = /^(-?)(\d+)\s+(\d+)\/(\d+)$/;
const FRACTION = /^(-?\d+)\/(\d+)$/;
const DECIMAL = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i;

/**
 * Strict numeric input: comma OR dot as decimal mark (never both: no thousands separators),
 * simple and mixed fractions (`3/16`, `1 3/16`), |x| ≤ 1e15.
 */
export function parseNumber(
  input: string | number | null | undefined,
  { nonnegative = false, positive = false } = {},
): number {
  if (input === null || input === undefined || String(input).trim() === "") {
    throw new ToolError("required");
  }
  const s = String(input).trim();
  if (s.includes(",") && s.includes(".")) throw new ToolError("thousandsSeparator");
  const mixed = s.match(MIXED);
  const fraction = s.match(FRACTION);
  let result: number;
  if (mixed) {
    if (Number(mixed[4]) === 0) throw new ToolError("zeroDenominator");
    result = (Number(mixed[2]) + Number(mixed[3]) / Number(mixed[4])) * (mixed[1] ? -1 : 1);
  } else if (fraction) {
    if (Number(fraction[2]) === 0) throw new ToolError("zeroDenominator");
    result = Number(fraction[1]) / Number(fraction[2]);
  } else {
    if (!DECIMAL.test(s)) throw new ToolError("invalidNumber");
    result = Number(s.replace(",", "."));
  }
  if (!Number.isFinite(result) || Math.abs(result) > MAX_ABS_VALUE) {
    throw new ToolError("outOfRange");
  }
  if (positive && result <= 0) throw new ToolError("mustBePositive");
  if (nonnegative && result < 0) throw new ToolError("mustBeNonNegative");
  return result;
}

/** value × factor(from) + offset(from) → canonical → − offset(to) ÷ factor(to). */
export function convert(
  value: string | number,
  group: MagnitudeId,
  from: string,
  to: string,
): number {
  const units = unitsOf(group);
  const a = units[from];
  const b = units[to];
  if (!a || !b) throw new ToolError("unitMismatch");
  const n = parseNumber(value, { nonnegative: !isSigned(group) });
  const canonical = n * a.factor + a.offset;
  if (group === "temperature" && canonical < -1e-10) throw new ToolError("belowAbsoluteZero");
  const result =
    ((group === "temperature" ? Math.max(0, canonical) : canonical) - b.offset) / b.factor;
  if (!Number.isFinite(result)) throw new ToolError("resultOutOfRange");
  return result;
}

/** Nominal ± p % (0–100, from the user's source, never a default), converted at both ends. */
export function convertRange(
  value: string | number,
  tolerancePercent: string | number,
  group: MagnitudeId,
  from: string,
  to: string,
): { nominal: number; low: number; high: number } {
  const n = parseNumber(value, { nonnegative: true });
  const p = parseTolerance(tolerancePercent);
  return {
    nominal: convert(n, group, from, to),
    low: convert(n * (1 - p / 100), group, from, to),
    high: convert(n * (1 + p / 100), group, from, to),
  };
}

/** The tolerance field's own errors, so the message names it and never reads like the value's. */
function parseTolerance(input: string | number): number {
  let p: number;
  try {
    p = parseNumber(input);
  } catch (error) {
    if (error instanceof ToolError && error.code === "required") {
      throw new ToolError("toleranceRequired");
    }
    throw new ToolError("toleranceInvalid");
  }
  if (p < 0 || p > 100) throw new ToolError("toleranceRange");
  return p;
}

/** `H:MM` (1–5 digit hours, minutes 00–59) → decimal hours. */
export function clockToHours(text: string): number {
  const match = String(text)
    .trim()
    .match(/^(\d{1,5}):([0-5]\d)$/);
  if (!match) throw new ToolError("invalidClock");
  return Number(match[1]) + Number(match[2]) / 60;
}

/** Decimal hours → `H:MM`, rounded to the nearest minute. */
export function hoursToClock(value: string | number): string {
  const minutes = Math.round(parseNumber(value, { nonnegative: true }) * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The locale's decimal mark («,» in es, «.» in en). */
export function decimalSeparator(locale: string): string {
  return (
    new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? "."
  );
}

/**
 * What the engine reads when the input could be misread: a fraction, or a decimal mark that is not
 * the locale's («1,200» under `en` is 1.2 here, not one thousand two hundred; «1.200» under `es`
 * too). Null when nothing is ambiguous or the input is not a number (its error is shown elsewhere).
 */
export function ambiguousReading(input: string, locale: string): number | null {
  const s = input.trim();
  const foreignMark = decimalSeparator(locale) === "," ? "." : ",";
  if (!s.includes("/") && !s.includes(foreignMark)) return null;
  try {
    return parseNumber(s);
  } catch {
    return null;
  }
}

/** Presentation rounding only. */
export function formatNumber(locale: string, n: number, maximumFractionDigits = 6): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits, minimumFractionDigits: 0 }).format(
    n,
  );
}
