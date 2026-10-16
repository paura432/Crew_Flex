import type { ReactNode } from "react";

export function StateMessage({
  title,
  description,
  action,
  tone = "neutral",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-xl border px-5 py-8 text-center ${
        tone === "danger" ? "border-danger/30 bg-danger-bg" : "border-dashed border-line bg-white"
      }`}
    >
      <p className={`font-semibold ${tone === "danger" ? "text-danger" : "text-ink"}`}>{title}</p>
      {description && (
        <div className="mx-auto mt-1 max-w-prose text-sm text-muted">{description}</div>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      <div className="h-24 animate-pulse rounded-xl bg-line/60" />
      <div className="h-48 animate-pulse rounded-xl bg-line/40" />
    </div>
  );
}
