"use client";

// Shared pieces of the tools workbench, mirroring the prototype's Toolbox.jsx helpers
// (`Result`, `CopyResult`, `ErrorMessage`, `References`, `tb-field`, `tb-panel`).
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { controlClass } from "@/components/ui/Field";
import { ENGINE_VERSION, ToolError, UNIT_SOURCE } from "../engine";
import { CheckIcon, CopyIcon, ExternalIcon } from "./icons";

export const toolControlClass = `${controlClass} min-h-11 bg-[#fbfcfd]`;

export type Outcome<T> = { value: T; error: null } | { value: null; error: string | null };

/** Runs a calculation; a `ToolError` becomes a translated message, anything else is a bug. */
export function useOutcome() {
  const t = useTranslations("tools.error");
  return function outcome<T>(calc: () => T): Outcome<T> {
    try {
      return { value: calc(), error: null };
    } catch (error) {
      if (error instanceof ToolError) return { value: null, error: t(error.code) };
      throw error;
    }
  };
}

export function ToolPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-[13px] border border-[#dce5ea] bg-white p-5 sm:p-7 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHead({
  kicker,
  title,
  icon,
}: {
  kicker: string;
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-tool">
      <div>
        <p className="text-[10px] font-extrabold tracking-[0.17em] text-tool">{kicker}</p>
        <h2 className="mt-2 text-[23px] leading-tight font-bold tracking-tight text-[#122e43]">
          {title}
        </h2>
      </div>
      {icon}
    </div>
  );
}

export function ToolField({
  id,
  label,
  hint,
  reading,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  /**
   * How the input was read when it could be misread (`ambiguousReading`); `null` keeps the live
   * region mounted but empty. Fields that never echo a reading leave it undefined.
   */
  reading?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-[#3a5367]">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {reading !== undefined && (
        <p id={`${id}-reading`} aria-live="polite" className="text-xs font-semibold text-[#1d4458]">
          {reading}
        </p>
      )}
    </div>
  );
}

export function ToolErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="status" className="rounded-[7px] bg-[#fff1e9] p-3 text-sm text-[#a74428]">
      {error}
    </p>
  );
}

export function ResultCard({
  caption,
  value,
  unit,
  children,
}: {
  caption: string;
  value: string;
  unit?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[13px] bg-tool-result p-6 text-white [overflow-wrap:anywhere] sm:p-7">
      <p className="text-[11px] tracking-[0.09em] text-tool-caption uppercase">{caption}</p>
      <p className="my-4 flex flex-wrap items-baseline gap-3" aria-live="polite">
        <strong className="text-[31px] font-semibold tracking-tight tabular-nums sm:text-[38px]">
          {value}
        </strong>
        {unit && <b className="text-lg text-[#9ce0d3]">{unit}</b>}
      </p>
      {children}
    </div>
  );
}

export function CopyResult({ text }: { text: string }) {
  const t = useTranslations("tools");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="inline-flex min-h-10 pointer-coarse:min-h-11 items-center gap-2 rounded-lg border border-[#547e89] px-4 text-[11px] font-bold text-[#c7e9e6] hover:bg-white/5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

export function References({ children }: { children: ReactNode }) {
  const t = useTranslations("tools");
  return (
    <details className="mt-6 border-t border-[#dce5e8] pt-4 text-xs text-[#5f7788]">
      <summary className="cursor-pointer font-bold text-[#226969]">{t("references")}</summary>
      <div className="mt-3 space-y-3">
        {children}
        <p>{t("engineNote", { version: ENGINE_VERSION })}</p>
        <a
          href={UNIT_SOURCE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[#076e73] underline"
        >
          {t("nistLink")} <ExternalIcon size={13} />
        </a>
      </div>
    </details>
  );
}

export function Footnote({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-[#718492]">{children}</p>;
}
