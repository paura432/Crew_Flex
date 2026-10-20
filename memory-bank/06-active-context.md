# 06 · Active context

_Last updated 2026-10-20 CEST. Keep under ~60 lines; replace, don't append history._

## Current task

V1.8 → Next.js functional migration, LOCAL only. **Target = v1.8** (owner 2026-10-20; v1.1/v1.3 context only).
Second independent audit done: `docs/integration/crewflex-v13/11-independent-parity-audit.md` (zip integrity,
v1.3→v1.8 diff, v1.1 located, connected contract, false positives, decision pack), matrix corrected
(`10-master-matrix.md` §8, +58 rows), roadmap `12-completion-roadmap.md`.
Batches since: 5 reset gate + compare persistence (`5007fde`, `1d5d818`), 6 close requirement
(`cd4856f` + frozen/409 fix), 7 AOG orange + hatched partial day (`0abbe2a`). All VERIFIED_LOCAL.
Local gotchas: `pkill -f "next …"` kills the calling shell (exit 144) — find the PID instead; Next dev logs
a `performance.measure` negative-timestamp error (dev only) → run `ui-smoke` on `next build && next start`.

## State

| Item         | State                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Production   | `origin/main` `65df3b9`, unchanged; 15 migrations; 8 functions                                                     |
| Local `main` | ahead of `65df3b9`, not pushed; local-only migrations `1602xx`, `20261020120000`, `20261020120100`                 |
| Gates        | `pnpm check` 0 (397 pass, 32 SKIPPED = E2E suites without env), build 0, local E2E 42/42, smoke 90/90 (prod build) |

## Risks

1. Never `git push origin main`: it would publish the wallet and every local batch.
2. T22: Supabase Auth accepts a password change from any session while `secure_password_change` is false
   (local; production value unknown) — owner Auth setting.
3. `aog_only` enum in production: forward fixes only.

## Blocked on the owner (decision pack: `11-independent-parity-audit.md` §11)

- D-06 Q2–Q6 (applications), D-07 P1–P4 (pack), D-12 visibility, requirement pause/edit lifecycle, C-10/D-02/D-03,
  OD-6, OD-7, retention (account/documents), AOG opt-in (V1_SCOPE NEXT vs LATER conflict), audit view, C-12 dock, T22.
- Production E2E (seed/run/cleanup approvals); incident of 2026-10-19 (401 seeding) still open.

## Next step (one)

Batch 9 of `12-completion-roadmap.md` (offer «Vencida» derived state) or batch 10 (44 px touch targets), then
batch 11 (applications contract, design only, nothing activated) — all decision-free.
