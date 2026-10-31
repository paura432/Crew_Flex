"use client";

// Technical converter and torque converter (prototype `Toolbox.jsx` → `Converter({ torque })`).
// Same controls and behaviour: quantity (not for torque), value, from/to units, swap (carries the
// result over as the new value), max decimals, pressure reference, nominal ± tolerance for torque and
// length, other equivalents, copy with units, formula/sources. Everything runs in the browser.
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  ambiguousReading,
  convert,
  convertRange,
  ENGINE_VERSION,
  formatNumber,
  MAGNITUDE_IDS,
  ToolError,
  unitsOf,
  type MagnitudeId,
} from "../engine";
import { SwapIcon, WrenchIcon } from "./icons";
import {
  CopyResult,
  Footnote,
  References,
  ResultCard,
  SectionHead,
  ToolErrorText,
  ToolField,
  ToolPanel,
  toolControlClass,
  useOutcome,
} from "./parts";

const PRECISIONS = ["2", "4", "6", "8", "10"] as const;
const RANGE_GROUPS = new Set<MagnitudeId>(["torque", "length"]);
type PressureReference = "gauge" | "absolute";

const TORQUE_START = { group: "torque", from: "Nm", to: "lbf_ft" } as const;
const UNITS_START = { group: "length", from: "mm", to: "inch" } as const;

const TORQUE_COPY = {
  kicker: "converter.kickerTorque",
  title: "converter.titleTorque",
  footnote: "converter.footnoteTorque",
} as const;
const UNITS_COPY = {
  kicker: "converter.kickerUnits",
  title: "converter.titleUnits",
  footnote: "converter.footnoteUnits",
} as const;

type LooseT = ((key: string) => string) & { has: (key: string) => boolean };

/** An optional catalog entry, or the fallback when the catalog has none. */
const labelOf = (t: LooseT, key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

/** The conversion; an absolute pressure below zero is not a reading (prototype rule). */
function convertChecked(
  value: string,
  group: MagnitudeId,
  from: string,
  to: string,
  reference: PressureReference,
) {
  const r = convert(value, group, from, to);
  if (group === "pressure" && reference === "absolute" && r < 0) {
    throw new ToolError("negativeAbsolutePressure");
  }
  return r;
}

export function UnitConverter({ torque = false }: { torque?: boolean }) {
  const t = useTranslations("tools");
  const outcome = useOutcome();
  // Dynamic catalog lookups (optional descriptions / unit labels) need the untyped form.
  const tLoose = t as unknown as ((key: string) => string) & { has: (key: string) => boolean };

  const initial = torque ? TORQUE_START : UNITS_START;
  const [group, setGroup] = useState<MagnitudeId>(initial.group);
  const [value, setValue] = useState("");
  const [from, setFrom] = useState<string>(initial.from);
  const [to, setTo] = useState<string>(initial.to);
  const [precision, setPrecision] = useState<(typeof PRECISIONS)[number]>("6");
  const [range, setRange] = useState(false);
  const [tolerance, setTolerance] = useState("");
  const [pressureReference, setPressureReference] = useState<PressureReference>("gauge");

  const mode = torque ? TORQUE_COPY : UNITS_COPY;
  const units = unitsOf(group);
  const digits = Number(precision);
  const unitLabel = (id: string) => labelOf(tLoose, `unit.${id}`, units[id]?.symbol ?? id);
  const description = labelOf(
    tLoose,
    `magnitude.${group}.description`,
    t("converter.defaultDescription"),
  );

  const result = outcome(() => convertChecked(value, group, from, to, pressureReference));

  function changeGroup(next: MagnitudeId) {
    setGroup(next);
    const ids = Object.keys(unitsOf(next));
    setFrom(ids[0]!);
    setTo(ids[1]!);
    setRange(false);
  }

  function swap() {
    const before = result.value;
    setFrom(to);
    setTo(from);
    if (before !== null) setValue(String(before));
  }

  const unitOptions = Object.keys(units).map((id) => (
    <option key={id} value={id}>
      {unitLabel(id)}
    </option>
  ));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)] lg:gap-6">
      <ToolPanel>
        <SectionHead
          kicker={t(mode.kicker)}
          title={t(mode.title)}
          icon={<WrenchIcon size={25} />}
        />
        <p className="mt-3 mb-5 text-sm text-[#587083]">{description}</p>

        <div className="space-y-4">
          {!torque && <MagnitudeSelect value={group} onChange={changeGroup} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <ValueField
              value={value}
              onChange={setValue}
              lengthHint={group === "length"}
              invalid={value !== "" && result.error !== null}
            />
            <ToolField id="tool-from" label={t("converter.from")}>
              <select
                id="tool-from"
                className={toolControlClass}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                {unitOptions}
              </select>
            </ToolField>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={swap}
              className="inline-flex min-h-[42px] pointer-coarse:min-h-11 items-center gap-2 rounded-lg border border-[#ccd9df] px-4 text-xs font-bold text-[#1d4458] hover:bg-tool-soft"
            >
              <SwapIcon size={17} />
              {t("converter.swap")}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ToolField id="tool-to" label={t("converter.to")}>
              <select
                id="tool-to"
                className={toolControlClass}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                {unitOptions}
              </select>
            </ToolField>
            <ToolField id="tool-precision" label={t("converter.precision")}>
              <select
                id="tool-precision"
                className={toolControlClass}
                value={precision}
                onChange={(e) => setPrecision(e.target.value as (typeof PRECISIONS)[number])}
              >
                {PRECISIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </ToolField>
          </div>

          {group === "pressure" && (
            <PressureReferenceSelect value={pressureReference} onChange={setPressureReference} />
          )}

          {RANGE_GROUPS.has(group) && (
            <RangeControls
              range={range}
              onRange={setRange}
              tolerance={tolerance}
              onTolerance={setTolerance}
            />
          )}

          {value !== "" && <ToolErrorText error={result.error} />}
        </div>

        <References>
          <p>{t("converter.formula")}</p>
          {torque && <p>{t("converter.formulaTorque")}</p>}
        </References>
      </ToolPanel>

      <ConverterResults
        torque={torque}
        input={{ value, group, from, to, pressureReference }}
        result={result.value}
        digits={digits}
        range={range}
        tolerance={tolerance}
        unitLabel={unitLabel}
        unitIds={Object.keys(units)}
      />
    </div>
  );
}

/** «Nominal ± tolerancia» for torque and length: the toggle and the tolerance field. */
function RangeControls({
  range,
  onRange,
  tolerance,
  onTolerance,
}: {
  range: boolean;
  onRange: (on: boolean) => void;
  tolerance: string;
  onTolerance: (value: string) => void;
}) {
  const t = useTranslations("tools");
  return (
    <>
      <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
        <input
          type="checkbox"
          className="size-[17px] shrink-0 accent-tool"
          checked={range}
          onChange={(e) => onRange(e.target.checked)}
        />
        {t("converter.rangeToggle")}
      </label>
      {range && (
        <ToolField
          id="tool-tolerance"
          label={t("converter.tolerance")}
          hint={t("converter.toleranceHint")}
        >
          <input
            id="tool-tolerance"
            className={toolControlClass}
            value={tolerance}
            inputMode="decimal"
            autoComplete="off"
            aria-describedby="tool-tolerance-hint"
            onChange={(e) => onTolerance(e.target.value)}
          />
        </ToolField>
      )}
    </>
  );
}

function TorqueNotice() {
  const t = useTranslations("tools");
  return (
    <div
      role="note"
      className="rounded-[13px] border border-warn/40 bg-warn-bg p-4 text-sm text-[#6e3a0f]"
    >
      <p className="font-bold">{t("converter.torqueNoticeTitle")}</p>
      <p className="mt-1">{t("converter.torqueNotice")}</p>
    </div>
  );
}

/** The converted nominal ± tolerance, or why it cannot be computed. */
function RangePanel({
  bounds,
  format,
  unit,
  tolerance,
}: {
  bounds: {
    value: { low: number; high: number } | null;
    error: Parameters<typeof ToolErrorText>[0]["error"];
  };
  format: (n: number) => string;
  unit: string;
  tolerance: string;
}) {
  const t = useTranslations("tools");
  return (
    <ToolPanel>
      <h3 className="text-base font-bold text-[#122e43]">{t("converter.rangeTitle")}</h3>
      {bounds.value ? (
        <>
          <p className="mt-3 text-[23px] font-semibold text-[#203d50] tabular-nums">
            {format(bounds.value.low)} – {format(bounds.value.high)} {unit}
          </p>
          <p className="mt-2 text-sm text-[#587083]">{t("converter.rangeNote", { tolerance })}</p>
        </>
      ) : (
        <div className="mt-3">
          <ToolErrorText error={bounds.error} />
        </div>
      )}
    </ToolPanel>
  );
}

/** The value in every other unit of the quantity. */
function OtherUnits({
  ids,
  label,
  convertTo,
}: {
  ids: string[];
  label: (id: string) => string;
  convertTo: (id: string) => string;
}) {
  const t = useTranslations("tools");
  return (
    <ToolPanel>
      <h3 className="text-base font-bold text-[#122e43]">{t("converter.others")}</h3>
      <dl className="mt-2">
        {ids.map((id) => (
          <div
            key={id}
            className="flex items-baseline justify-between gap-4 border-b border-[#edf1f3] py-2.5 text-xs"
          >
            <dt className="min-w-0 [overflow-wrap:anywhere]">{label(id)}</dt>
            <dd className="text-right font-bold tabular-nums">{convertTo(id)}</dd>
          </div>
        ))}
      </dl>
    </ToolPanel>
  );
}

function MagnitudeSelect({
  value,
  onChange,
}: {
  value: MagnitudeId;
  onChange: (next: MagnitudeId) => void;
}) {
  const t = useTranslations("tools");
  return (
    <ToolField id="tool-magnitude" label={t("converter.magnitude")}>
      <select
        id="tool-magnitude"
        className={toolControlClass}
        value={value}
        onChange={(e) => onChange(e.target.value as MagnitudeId)}
      >
        {MAGNITUDE_IDS.map((id) => (
          <option key={id} value={id}>
            {t(`magnitude.${id}.label`)}
          </option>
        ))}
      </select>
    </ToolField>
  );
}

/** The value, with «se lee como …» when its decimal mark is ambiguous in this locale. */
function ValueField({
  value,
  onChange,
  lengthHint,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  lengthHint: boolean;
  invalid: boolean;
}) {
  const t = useTranslations("tools");
  const locale = useLocale();
  const reading = ambiguousReading(value, locale);
  return (
    <ToolField
      id="tool-value"
      label={t("converter.value")}
      hint={lengthHint ? t("converter.valueHintLength") : t("converter.valueHint")}
      reading={reading === null ? null : t("readAs", { value: formatNumber(locale, reading, 10) })}
    >
      <input
        id="tool-value"
        className={toolControlClass}
        value={value}
        inputMode="decimal"
        autoComplete="off"
        placeholder={t("converter.valuePlaceholder")}
        aria-describedby="tool-value-hint tool-value-reading"
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
      />
    </ToolField>
  );
}

function PressureReferenceSelect({
  value,
  onChange,
}: {
  value: PressureReference;
  onChange: (next: PressureReference) => void;
}) {
  const t = useTranslations("tools");
  return (
    <ToolField id="tool-pressure-ref" label={t("converter.pressureReference")}>
      <select
        id="tool-pressure-ref"
        className={toolControlClass}
        value={value}
        onChange={(e) => onChange(e.target.value as PressureReference)}
      >
        <option value="gauge">{t("converter.gauge")}</option>
        <option value="absolute">{t("converter.absolute")}</option>
      </select>
    </ToolField>
  );
}

/** The result card, the tolerance range, the other equivalents and the footnote. */
function ConverterResults({
  torque,
  input: { value, group, from, to, pressureReference },
  result,
  digits,
  range,
  tolerance,
  unitLabel,
  unitIds,
}: {
  torque: boolean;
  input: {
    value: string;
    group: MagnitudeId;
    from: string;
    to: string;
    pressureReference: PressureReference;
  };
  /** The main conversion, or null while it cannot be computed. */
  result: number | null;
  digits: number;
  range: boolean;
  tolerance: string;
  unitLabel: (id: string) => string;
  unitIds: string[];
}) {
  const t = useTranslations("tools");
  const locale = useLocale();
  const outcome = useOutcome();
  const format = (n: number) => formatNumber(locale, n, digits);
  // Nothing to bound until there is a value: the main result already asks for it.
  const bounds =
    range && value.trim() !== ""
      ? outcome(() => convertRange(value, tolerance, group, from, to))
      : null;
  const formatted = result === null ? "—" : format(result);
  const caption =
    group === "pressure"
      ? t("converter.resultPressure", { reference: t(`converter.${pressureReference}`) })
      : t("converter.result");
  const torqueNote = torque ? ` · ${t("converter.copyTorqueNote")}` : "";
  const copyText = `${value} ${unitLabel(from)} = ${formatted} ${unitLabel(to)} · CrewFlex ${ENGINE_VERSION}${torqueNote}`;
  return (
    <aside className="min-w-0 space-y-5">
      {torque && <TorqueNotice />}

      <ResultCard caption={caption} value={formatted} unit={unitLabel(to)}>
        {result !== null && <CopyResult text={copyText} />}
      </ResultCard>

      {bounds && (
        <RangePanel bounds={bounds} format={format} unit={unitLabel(to)} tolerance={tolerance} />
      )}

      {result !== null && (
        <OtherUnits
          ids={unitIds.filter((id) => id !== to)}
          label={unitLabel}
          convertTo={(id) => format(convert(value, group, from, id))}
        />
      )}

      <Footnote>{t((torque ? TORQUE_COPY : UNITS_COPY).footnote)}</Footnote>
    </aside>
  );
}
