"use client";

// Shift duration (prototype `Toolbox.jsx` → `TimeTool`): HH:MM ↔ decimal hours.
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ambiguousReading, clockToHours, formatNumber, hoursToClock } from "../engine";
import {
  Footnote,
  ResultCard,
  ToolErrorText,
  ToolField,
  ToolPanel,
  toolControlClass,
  useOutcome,
} from "./parts";

type Mode = "clock" | "decimal";

export function DurationTool() {
  const t = useTranslations("tools.duration");
  const tTools = useTranslations("tools");
  const locale = useLocale();
  const outcome = useOutcome();
  const [mode, setMode] = useState<Mode>("clock");
  const [text, setText] = useState("");

  const result =
    text === ""
      ? null
      : outcome(() =>
          mode === "clock" ? formatNumber(locale, clockToHours(text), 6) : hoursToClock(text),
        );

  const reading = mode === "decimal" ? ambiguousReading(text, locale) : null;

  // One panel with the result inside, as the prototype's TimeTool (no side column).
  return (
    <div className="max-w-2xl space-y-4">
      <ToolPanel>
        <h2 className="text-[23px] leading-tight font-bold tracking-tight text-[#122e43]">
          {t("title")}
        </h2>
        <p className="mt-3 mb-5 text-sm text-[#587083]">{t("description")}</p>
        <div className="space-y-4">
          <ToolField id="duration-mode" label={t("mode")}>
            <select
              id="duration-mode"
              className={toolControlClass}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as Mode);
                setText("");
              }}
            >
              <option value="clock">{t("clock")}</option>
              <option value="decimal">{t("decimal")}</option>
            </select>
          </ToolField>
          <ToolField
            id="duration-input"
            label={mode === "clock" ? t("inputClock") : t("inputDecimal")}
            reading={
              reading === null
                ? null
                : tTools("readAs", { value: formatNumber(locale, reading, 10) })
            }
          >
            <input
              id="duration-input"
              className={toolControlClass}
              value={text}
              autoComplete="off"
              inputMode={mode === "clock" ? "text" : "decimal"}
              placeholder={mode === "clock" ? "1:30" : "1,5"}
              aria-invalid={Boolean(result?.error)}
              aria-describedby="duration-input-reading"
              onChange={(e) => setText(e.target.value)}
            />
          </ToolField>
          <ToolErrorText error={result?.error ?? null} />
          <ResultCard
            caption={t("result")}
            value={result?.value ?? "—"}
            unit={result?.value != null && mode === "clock" ? t("hours") : undefined}
          />
        </div>
      </ToolPanel>
      <Footnote>{t("formula")}</Footnote>
    </div>
  );
}
