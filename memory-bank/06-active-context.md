# 06 · Active context

_Last updated 2026-10-19 (evening) CEST. Keep under ~60 lines; replace, don't append history._

## Current task

Close production release 1 = commit **`65df3b9`** (availability cycle generator, «AOG only», tools).
Plan revision 2 (safe order) for owner approval: `docs/qa/ROLLOUT_PLAN_2026-10-19.md`. **Step 0
(read-only preflight) GO; step 1 executed 2026-10-19 with authorization** (matching-evaluate and
capacity-evaluate v3 from `65df3b9`). Stopped: steps 2–6 not authorized.

## State

| Item          | State                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release 1     | `65df3b9`: migrations #1–#3 (from `2216d38`, step 2) and #4–#5 (from `65df3b9`, step 4); matching + capacity (step 1), professional-availability (step 3)  |
| Production    | preflight 2026-10-19: `origin/main` `ddf5c4b`, 10/10 migrations, 8 functions, 0 flags, 0 buckets, 0 availability windows                                   |
| Compatibility | `scripts/local/release-compat/run.sh ddf5c4b 65df3b9 20261015130400 2216d38` → 111/111 (safe order); without the 4th arg 67/67; old FE 5/5; release FE 9/9 |
| Local `main`  | wallet (Supabase flag `document_wallet`, M-3 cleanup) — release 2, NOT in release 1; retention and maintenance not approved                                |
| Worktrees     | `../cf-r1` (`65df3b9`), `../cf-r1a` (`2216d38`) with copied link metadata (no secrets); CLI always from the main repo with `--workdir`                     |

## Risks

1. Run steps in order; `git push origin 65df3b9:main`, never `git push origin main`.
2. After step 4 (enum has `aog_only`, Q12 true) never reinstall `ddf5c4b` matching/capacity/availability; forward fix only; never convert `aog_only` rows.
3. `/app/admin/verifications` with the flag unset renders Not found with HTTP 200 (streaming), same in prod.
4. `pnpm db:types` targets production — use `pnpm db:types:local`.

## Blocked on the owner

- Release-1 steps 2–6 (one approval each; step 6 = production E2E, 3 approvals).
- D-06 Q2–Q6 and D-07 P1–P4: owner **proposals** recorded 2026-10-19 in the contracts; ratification
  needed before any sensitive implementation (§4.1 of each doc). P3 period needs legal criterion.
- Wallet release 2: retention periods, legal-hold procedure, maintenance mechanism (not approved).

## Next step (one)

Owner authorization of step 2 (`db push --dry-run`, then `db push`, `--workdir ../cf-r1a` = migrations #1–#3).
