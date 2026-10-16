import { getTranslations } from "next-intl/server";
import type { ExternalPoolCoverage } from "@/types/api";
import { poolCompleteness } from "../pool";

/** States whether the external evaluation covered the whole network or only part of it. */
export async function PoolCoverageNote({
  evaluated,
  pool,
}: {
  evaluated: number;
  pool: ExternalPoolCoverage;
}) {
  const t = await getTranslations("organization.matches.coverage");
  const state = poolCompleteness(evaluated, pool);
  const values = {
    evaluated,
    prefiltered: pool.prefiltered,
    hardEligible: pool.hardEligible,
    cap: pool.cap,
  };
  return state === "eligibleTruncated" ? (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn"
    >
      {t("eligibleTruncated", values)}
    </p>
  ) : (
    <p className="mb-4 text-sm text-muted">{t(state, values)}</p>
  );
}
