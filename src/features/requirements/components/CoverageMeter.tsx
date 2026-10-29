import { getLocale, getTranslations } from "next-intl/server";
import type { ConfirmedCoverage } from "@/domain/coverage";
import type { Locale } from "@/i18n/config";
import { formatPercent } from "@/i18n/format";

/**
 * v1.8 «{p}% cobertura confirmada» + bar (`Company2.jsx:162`), «{p}% cubierto» on the dashboard rows,
 * optionally «{x} / {n} plazas confirmadas» (BR-23). The bar is a native <progress> (no inline style
 * under the CSP); the sentence carries the value, so the bar is hidden from assistive technology.
 */
export async function CoverageMeter({
  coverage,
  label = "confirmed",
  seats = false,
}: {
  coverage: ConfirmedCoverage;
  label?: "confirmed" | "covered";
  seats?: boolean;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("hiring.coverage"),
    getLocale() as Promise<Locale>,
  ]);
  return (
    <div className="min-w-32 space-y-1">
      <p className="text-sm tabular-nums">
        {t(label, { percent: formatPercent(locale, coverage.percent) })}
      </p>
      <progress
        aria-hidden
        value={coverage.percent}
        max={100}
        className="block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-line [&::-moz-progress-bar]:bg-ok [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-ok"
      />
      {seats && (
        <p className="text-xs text-muted tabular-nums">
          {t("seats", { filled: coverage.filled, total: coverage.total })}
        </p>
      )}
    </div>
  );
}
