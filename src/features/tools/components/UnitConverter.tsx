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
const RANGE_GROUPS: MagnitudeId[] = ["torque", "length"];
type PressureReference = "gauge" | "absolute";

export function UnitConverter({ torque = false }: { torque?: boolean }) {
  const t = useTranslations("tools");
  const locale = useLocale();
  const outcome = useOutcome();
  // Dynamic catalog lookups (optional descriptions / unit labels) need the untyped form.
  const tLoose = t as unknown as ((key: string) => string) & { has: (key: string) => boolean };

  const [group, setGroup] = useState<MagnitudeId>(torque ? "torque" : "length");
  const [value, setValue] = useState("");
  const [from, setFrom] = useState(torque ? "Nm" : "mm");
  const [to, setTo] = useState(torque ? "lbf_ft" : "inch");
  const [precision, setPrecision] = useState<(typeof PRECISIONS)[number]>("6");
  const [range, setRange] = useState(false);
  const [tolerance, setTolerance] = useState("");
  const [pressureReference, setPressureReference] = useState<PressureReference>("gauge");

  const units = unitsOf(group);
  const digits = Number(precision);
  const reading = ambiguousReading(value, locale);
  const unitLabel = (id: string) =>
    tLoose.has(`unit.${id}`) ? tLoose(`unit.${id}`) : (units[id]?.symbol ?? id);
  const description = tLoose.has(`magnitude.${group}.description`)
    ? tLoose(`magnitude.${group}.description`)
    : t("converter.defaultDescription");

  const result = outcome(() => {
    const r = convert(value, group, from, to);
    if (group === "pressure" && pressureReference === "absolute" && r < 0) {
      throw new ToolError("negativeAbsolutePressure");
    }
    return r;
  });
  // Nothing to bound until there is a value: the main result already asks for it.
  const bounds =
    range && value.trim() !== ""
      ? outcome(() => convertRange(value, tolerance, group, from, to))
      : null;
  const formatted = result.value === null ? "—" : formatNumber(locale, result.value, digits);

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
  const caption =
    group === "pressure"
      ? t("converter.resultPressure", { reference: t(`converter.${pressureReference}`) })
      : t("converter.result");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)] lg:gap-6">
      <ToolPanel>
        <SectionHead
          kicker={torque ? t("converter.kickerTorque") : t("converter.kickerUnits")}
          title={torque ? t("converter.titleTorque") : t("converter.titleUnits")}
          icon={<WrenchIcon size={25} />}
        />
        <p className="mt-3 mb-5 text-sm text-[#587083]">{description}</p>

        <div className="space-y-4">
          {!torque && (
            <ToolField id="tool-magnitude" label={t("converter.magnitude")}>
              <select
                id="tool-magnitude"
                className={toolControlClass}
                value={group}
                onChange={(e) => changeGroup(e.target.value as MagnitudeId)}
              >
                {MAGNITUDE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(`magnitude.${id}.label`)}
                  </option>
                ))}
              </select>
            </ToolField>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <ToolField
              id="tool-value"
              label={t("converter.value")}
              hint={group === "length" ? t("converter.valueHintLength") : t("converter.valueHint")}
              reading={
                reading === null ? null : t("readAs", { value: formatNumber(locale, reading, 10) })
              }
            >
              <input
                id="tool-value"
                className={toolControlClass}
                value={value}
                inputMode="decimal"
                autoComplete="off"
                placeholder={t("converter.valuePlaceholder")}
                aria-describedby="tool-value-hint tool-value-reading"
                aria-invalid={value !== "" && result.error !== null}
                onChange={(e) => setValue(e.target.value)}
              />
            </ToolField>
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
            <ToolField id="tool-pressure-ref" label={t("converter.pressureReference")}>
              <select
                id="tool-pressure-ref"
                className={toolControlClass}
                value={pressureReference}
                onChange={(e) => setPressureReference(e.target.value as PressureReference)}
              >
                <option value="gauge">{t("converter.gauge")}</option>
                <option value="absolute">{t("converter.absolute")}</option>
              </select>
            </ToolField>
          )}

          {RANGE_GROUPS.includes(group) && (
            <>
              <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
                <input
                  type="checkbox"
                  className="size-[17px] shrink-0 accent-tool"
                  checked={range}
                  onChange={(e) => setRange(e.target.checked)}
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
                    onChange={(e) => setTolerance(e.target.value)}
                  />
                </ToolField>
              )}
            </>
          )}

          {value !== "" && <ToolErrorText error={result.error} />}
        </div>

        <References>
          <p>{t("converter.formula")}</p>
          {torque && <p>{t("converter.formulaTorque")}</p>}
        </References>
      </ToolPanel>

      <aside className="min-w-0 space-y-5">
        {torque && (
          <div
            role="note"
            className="rounded-[13px] border border-warn/40 bg-warn-bg p-4 text-sm text-[#6e3a0f]"
          >
            <p className="font-bold">{t("converter.torqueNoticeTitle")}</p>
            <p className="mt-1">{t("converter.torqueNotice")}</p>
          </div>
        )}

        <ResultCard caption={caption} value={formatted} unit={unitLabel(to)}>
          {result.value !== null && (
            <CopyResult
              text={`${value} ${unitLabel(from)} = ${formatted} ${unitLabel(to)} · CrewFlex ${ENGINE_VERSION}${torque ? ` · ${t("converter.copyTorqueNote")}` : ""}`}
            />
          )}
        </ResultCard>

        {range && bounds && (
          <ToolPanel>
            <h3 className="text-base font-bold text-[#122e43]">{t("converter.rangeTitle")}</h3>
            {bounds.value ? (
              <>
                <p className="mt-3 text-[23px] font-semibold text-[#203d50] tabular-nums">
                  {formatNumber(locale, bounds.value.low, digits)} –{" "}
                  {formatNumber(locale, bounds.value.high, digits)} {unitLabel(to)}
                </p>
                <p className="mt-2 text-sm text-[#587083]">
                  {t("converter.rangeNote", { tolerance })}
                </p>
              </>
            ) : (
              <div className="mt-3">
                <ToolErrorText error={bounds.error} />
              </div>
            )}
          </ToolPanel>
        )}

        {result.value !== null && (
          <ToolPanel>
            <h3 className="text-base font-bold text-[#122e43]">{t("converter.others")}</h3>
            <dl className="mt-2">
              {Object.keys(units)
                .filter((id) => id !== to)
                .map((id) => (
                  <div
                    key={id}
                    className="flex items-baseline justify-between gap-4 border-b border-[#edf1f3] py-2.5 text-xs"
                  >
                    <dt className="min-w-0 [overflow-wrap:anywhere]">{unitLabel(id)}</dt>
                    <dd className="text-right font-bold tabular-nums">
                      {formatNumber(locale, convert(value, group, from, id), digits)}
                    </dd>
                  </div>
                ))}
            </dl>
          </ToolPanel>
        )}

        <Footnote>{torque ? t("converter.footnoteTorque") : t("converter.footnoteUnits")}</Footnote>
      </aside>
    </div>
  );
}
