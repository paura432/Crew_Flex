"use client";

// Shift duration (prototype `Toolbox.jsx` → `TimeTool`): HH:MM ↔ decimal hours.
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { clockToHours, formatNumber, hoursToClock } from "../engine";
import { ClockIcon } from "./icons";
import {
  Footnote,
  ResultCard,
  SectionHead,
  ToolErrorText,
  ToolField,
  ToolPanel,
  toolControlClass,
  useOutcome,
} from "./parts";

type Mode = "clock" | "decimal";

export function DurationTool() {
  const t = useTranslations("tools.duration");
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

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)] lg:gap-6">
      <ToolPanel>
        <SectionHead kicker={t("kicker")} title={t("title")} icon={<ClockIcon size={25} />} />
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
          >
            <input
              id="duration-input"
              className={toolControlClass}
              value={text}
              autoComplete="off"
              inputMode={mode === "clock" ? "text" : "decimal"}
              placeholder={mode === "clock" ? "1:30" : "1,5"}
              aria-invalid={Boolean(result?.error)}
              onChange={(e) => setText(e.target.value)}
            />
          </ToolField>
          <ToolErrorText error={result?.error ?? null} />
        </div>
      </ToolPanel>
      <aside className="min-w-0 space-y-5">
        <ResultCard
          caption={t("result")}
          value={result?.value ?? "—"}
          unit={result?.value != null && mode === "clock" ? t("hours") : undefined}
        />
        <Footnote>{t("formula")}</Footnote>
      </aside>
    </div>
  );
}
