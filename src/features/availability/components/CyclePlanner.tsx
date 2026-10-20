"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import type { AvailabilityRotation } from "@/types/api";
import { cycleStates, MAX_CYCLE_DAYS, ROTATIONS, type CycleDay, type Rotation } from "../rotation";

export interface CycleSettings {
  pattern: Rotation;
  anchor: string;
  custom: CycleDay[];
  publishRest: boolean;
  replace: boolean;
}

/** Work/rest cycle form (V1.8 "Planifica el ciclo"). Only builds a preview; saving is separate. */
export function CyclePlanner({
  today,
  saved,
  disabled,
  error,
  onPreview,
}: {
  today: string;
  /** The pattern saved with the last calendar save (V1.8 `profile.rotation`); null = defaults. */
  saved: AvailabilityRotation | null;
  disabled: boolean;
  error: string | null;
  onPreview: (settings: CycleSettings) => void;
}) {
  const t = useTranslations("availability.cycle");
  const savedCustom = saved?.customCycle.length ? saved.customCycle : null;
  const [pattern, setPattern] = useState<Rotation>(saved?.pattern ?? "7x3");
  const [anchor, setAnchor] = useState(saved?.anchor ?? today);
  const [length, setLength] = useState(String(savedCustom?.length ?? 14));
  const [custom, setCustom] = useState<CycleDay[]>(
    () => savedCustom ?? Array<CycleDay>(14).fill("off"),
  );
  const [publishRest, setPublishRest] = useState(false);
  const [replace, setReplace] = useState(false);

  function onLength(value: string) {
    setLength(value);
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= MAX_CYCLE_DAYS) {
      setCustom((old) => Array.from({ length: n }, (_, i) => old[i] ?? "off"));
    }
  }

  const customLengthValid = Number(length) === custom.length;

  return (
    <Panel title={t("title")}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="cycle-pattern" label={t("pattern")}>
          <select
            id="cycle-pattern"
            className={controlClass}
            value={pattern}
            disabled={disabled}
            onChange={(e) => setPattern(e.target.value as Rotation)}
          >
            {ROTATIONS.map((r) => (
              <option key={r} value={r}>
                {t(`rotation.${r === "7x3/7x4" ? "7x3_7x4" : r}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="cycle-anchor" label={t("anchor")} hint={t("anchorHint")}>
          <input
            id="cycle-anchor"
            type="date"
            className={controlClass}
            value={anchor}
            disabled={disabled}
            aria-describedby="cycle-anchor-hint"
            onChange={(e) => setAnchor(e.target.value)}
          />
        </Field>
      </div>

      {pattern === "custom" && (
        <div className="mt-4 space-y-3">
          <Field
            id="cycle-length"
            label={t("customLength")}
            error={customLengthValid ? undefined : t("error.customLength")}
          >
            <input
              id="cycle-length"
              type="number"
              min={1}
              max={MAX_CYCLE_DAYS}
              className={`${controlClass} max-w-32`}
              value={length}
              disabled={disabled}
              aria-invalid={!customLengthValid}
              aria-describedby={customLengthValid ? undefined : "cycle-length-error"}
              onChange={(e) => onLength(e.target.value)}
            />
          </Field>
          {/* V1.8 planner: start the custom cycle from the alternating 7–3 / 7–4 rotation. */}
          <Button
            disabled={disabled}
            onClick={() => {
              const base = cycleStates("7x3/7x4");
              setCustom(base);
              setLength(String(base.length));
            }}
          >
            {t("useAlternatingBase")}
          </Button>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("customDays")}>
            {custom.map((state, i) => (
              <button
                key={i}
                type="button"
                disabled={disabled}
                aria-pressed={state === "working"}
                aria-label={t("customDay", { n: i + 1, state: t(`state.${state}`) })}
                onClick={() =>
                  setCustom((old) =>
                    old.map((s, k) => (k === i ? (s === "off" ? "working" : "off") : s)),
                  )
                }
                className={`flex h-12 w-11 flex-col items-center justify-center rounded-lg border text-xs ${
                  state === "working"
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-white text-muted"
                }`}
              >
                <b className="text-sm tabular-nums">{i + 1}</b>
                <small className="leading-none">{t(`stateShort.${state}`)}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={publishRest}
            disabled={disabled}
            onChange={(e) => setPublishRest(e.target.checked)}
          />
          {t("publishRest")}
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={replace}
            disabled={disabled}
            onChange={(e) => setReplace(e.target.checked)}
          />
          {t("replace")}
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* V1.8: previewing is the main action of this form (orange CTA). */}
        <Button
          variant="primary"
          disabled={disabled || (pattern === "custom" && !customLengthValid)}
          onClick={() => onPreview({ pattern, anchor, custom, publishRest, replace })}
        >
          {t("preview")}
        </Button>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">{t("hint")}</p>
    </Panel>
  );
}
