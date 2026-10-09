import { StatusChip } from "@/components/ui/StatusChip";
import type { EvaluatedCandidate } from "@/types/api";
import { explainAvailability, explainBlocker, explainCheck, type CheckTone } from "../explain";

const markTone: Record<CheckTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

function candidateTitle({ candidate }: EvaluatedCandidate) {
  if (candidate.displayName) return candidate.displayName;
  return `Anonymous professional ${candidate.id}`;
}

/** Explainable result: verdict → per-qualification checklist → availability → blockers. */
export function MatchCard({ item }: { item: EvaluatedCandidate }) {
  const { candidate, match } = item;
  const checks = match.qualificationChecks.map(explainCheck);
  const availability = explainAvailability(match.availability.coveredPercent);

  return (
    <article
      aria-label={candidateTitle(item)}
      className={`rounded-xl border bg-white p-5 ${match.eligible ? "border-ok/40" : "border-line"}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusChip tone={match.eligible ? "ok" : "danger"}>
            {match.eligible ? "Eligible" : "Not eligible"}
          </StatusChip>
          <h3 className="mt-2 font-semibold break-words">{candidateTitle(item)}</h3>
          <p className="text-sm text-muted">
            {candidate.baseLocation ?? "Base not shared"}
            {candidate.yearsExperience !== null &&
              ` · ${candidate.yearsExperience} years experience`}
          </p>
        </div>
        {match.eligible && (
          <p className="text-right text-sm text-muted">
            Soft score
            <span className="block text-xl font-bold text-ink tabular-nums">{match.softScore}</span>
          </p>
        )}
      </header>

      {match.blockers.length > 0 && (
        <div className="mt-4 rounded-lg bg-danger-bg px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-danger uppercase">Blockers</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-danger">
            {match.blockers.map((blocker, i) => (
              <li key={i}>{explainBlocker(blocker)}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 divide-y divide-line text-sm">
        {[...checks, availability].map((check) => (
          <li key={check.label} className="flex items-baseline gap-3 py-1.5">
            <span aria-hidden className={`w-4 font-bold ${markTone[check.tone]}`}>
              {check.met ? "✓" : "✗"}
            </span>
            <span className="w-24 shrink-0 font-mono font-semibold">{check.label}</span>
            <span className="min-w-0 text-muted">
              <span className="sr-only">{check.met ? "Met: " : "Not met: "}</span>
              {check.detail}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
