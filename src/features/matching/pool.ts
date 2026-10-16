import type { ExternalPoolCoverage } from "@/types/api";

/**
 * How honest the "N evaluated" line can be (candidate-pool finding, remediation 2026-10-15):
 * - `complete`: every external professional holding a required qualification was evaluated;
 * - `nearMissesTrimmed`: the cap cut only candidates who fail a hard filter — every candidate who
 *   passes them was evaluated (they are selected first);
 * - `eligibleTruncated`: more candidates pass the hard filters than the cap allows — the list is
 *   a partial result and must be presented as such.
 */
export type PoolCompleteness = "complete" | "nearMissesTrimmed" | "eligibleTruncated";

export function poolCompleteness(evaluated: number, pool: ExternalPoolCoverage): PoolCompleteness {
  if (pool.hardEligible > pool.cap) return "eligibleTruncated";
  if (pool.prefiltered > evaluated) return "nearMissesTrimmed";
  return "complete";
}
