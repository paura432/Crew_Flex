import type { Tone } from "./StatusChip";

const valueTone: Record<Tone, string> = {
  neutral: "text-ink",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-blue",
};

export function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${valueTone[tone]}`}>
        {value}
      </dd>
      {detail && <dd className="mt-1 text-sm text-muted">{detail}</dd>}
    </div>
  );
}
