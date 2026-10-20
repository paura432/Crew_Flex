# 06 · Active context

_Last updated 2026-10-20 (afternoon) CEST. Keep under ~60 lines; replace, don't append history._

## Current task

V1.8 → Next.js migration, LOCAL only. **Target = v1.8** (`tmp/CrewFlex_v1.8.zip`, sha256 `53ee5b61…`; v1.1/v1.3
context). Second audit `docs/integration/crewflex-v13/11-…`; visual comparison `13-…` (isolated browser,
0 external requests); decision pack `14-…`; roadmap `12-…`.
Done since the audit: batches 5–7 and, today, 8 (T22 evidence + reset hardening), 9 («Expired» derived),
10 (44 px touch), 11 (mobile «Menu», folded checklist, danger button), 12 (application transition table,
pure, unused) + review fixes. Every batch had an independent reviewer; Medium findings fixed.
Local gotchas: `pkill -f "next …"` kills the calling shell — kill the PID from `ss -ltnp`; run `ui-smoke` on
`next build && next start` (dev has a false `performance.measure` error); after
`release-compat/run.sh` re-insert the `qualification_review` flag and restart `functions serve`.

## State

| Item         | State                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Production   | `origin/main` `65df3b9` (release 1), unchanged; 15 migrations; 8 functions; Auth untouched                                        |
| Local `main` | ahead of `65df3b9`, not pushed; local-only migrations `1602xx`, `20261020120000`, `20261020120100`                                |
| Gates        | `pnpm check` 0 (408 pass, 32 SKIPPED = E2E without env), build 0, E2E 42/42, ui-smoke 97/97, reset 20/20, release-1 browser 24/24 |

## Risks

1. Never `git push origin main`: it would publish the wallet and every local batch.
2. T22: production Auth accepts a password change from any session until «require current password» is on.
3. `release-compat` expectations are hard-coded for release 1 (8 mismatches on 65df3b9→HEAD are not
   regressions); a release-2 plan needs its own expectations.

## Blocked on the owner — only `14-decision-pack.md` §2

D-06 Q2–Q6 ratification, D-07 P1–P4 (+ P3 period), D-12 visibility, requirement lifecycle, C-10/D-02/D-03,
OD-6, OD-7, account/wallet retention, AOG opt-in (NEXT vs LATER), audit view, LATER scheduling, C-12, T22,
OD-3 activation. Production E2E and demo users: paused by the owner.

## Next step (one)

Decision-free work is nearly exhausted: remaining safe items are visual P2 (sidebar icons, table header,
chips) and the TD-44 «due within 60 days» passport summary; everything else waits for §2 of the pack.
