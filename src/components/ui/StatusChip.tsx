import type { ReactNode } from "react";
import type { Tone } from "./tones";

export type { Tone } from "./tones";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-line",
  ok: "bg-ok-bg text-ok border-ok/20",
  warn: "bg-warn-bg text-warn border-warn/20",
  danger: "bg-danger-bg text-danger border-danger/20",
  info: "bg-info-bg text-blue border-blue/20",
};

export function StatusChip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      // V1.8 `.pill`: 12 px, 700, sentence case (never uppercase: long ES labels stay readable).
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
