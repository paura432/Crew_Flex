# 16 · CrewFlex v1.8 HTML diff (2026-10-21) — backlog and status

Element-by-element diff of `CrewFlex_v1.8.html` (585 871 B, sha256 `0c4875ee…ee37` = `RELEASE_MANIFEST.json`; the
`dist/` bundle with JS and CSS inlined, so it holds both the demo and the connected mode) against this app at
`51c835a`. It goes one level below `09-v18-delta.md` / `10-master-matrix.md` (modules) and `13-visual-comparison.md`
(screens): every block, string, field, option, state and rule the HTML renders.

**Full report and evidence live outside the repo** (76 MB of captures, not versioned):
`C:\Users\perfo\Downloads\CrewFlex_DIFF_HTML_v18_vs_Next_2026-10-21\` — `00-INFORME.md` (summary, screen map),
`01-BACKLOG-MIGRACION.md`, `diff/10…50-*.md` (1 496 compared rows), `inventarios/` (v1.8 static + demo runtime +
connected runtime with a disposable SQLite and synthetic `@example.test` accounts; Next static), `evidencias/`
(294 PNG captures at 1440/390 px). Nothing remote was touched; Next was read, not run (no Docker in WSL).

## Headlines

1. Only **11 %** of the 2 100 UI strings of the HTML have an equivalent in `messages/es.json`; the hiring circuit
   (opportunities → application → proposal → acceptance → confirmation → assignment, Pack, notices) does not exist
   here and is blocked by D-06 / D-07 / D-12, not by engineering.
2. **Production frontend = `51c835a`**: `origin/main` was pushed on 2026-10-20 17:32 +0200 and GitHub reports
   `Vercel: success` for `51c835a`; the backend is still release 1, so the organization dashboard focus gets 400 and
   «close requirement» 405 (latent: 0 organizations in production). The memory bank still says `65df3b9` (task W4-03).
3. With OD-3 off no qualification reaches `verified`, so no external professional meets a hard requirement and profile
   completeness tops out at 86 %.
4. Next-only defects found while verifying: `/app` ↔ `/login` redirect loop with a session but an unreadable profile;
   «Disponibilidad» overlapping in `MatchCard`; past days editable in the availability calendar; no version check on
   calendar save; requirement list capped at 50 ascending; past start accepted; English action errors in the Spanish UI.
5. The unit engine is numerically identical to v1.8 (22 magnitudes, 98 units, same factors and offsets).

## Tasks (decision-free; one per loop iteration, in order)

States: TODO · IN_PROGRESS · VERIFIED (local) · BLOCKED (reason). Sources are sections of the external report.
«DB/Edge = yes» rows are implemented and tested locally; deploying them needs owner authorization.

| ID    | Task                                                                                   | Source (`diff/`)       | Size | DB/Edge | State    | Commit    | Gates                      |
| ----- | -------------------------------------------------------------------------------------- | ---------------------- | ---- | ------- | -------- | --------- | -------------------------- |
| W1-01 | Break the `/app` ↔ `/login` redirect loop (session valid, profile unreadable)          | 10 backlog 1           | S    | no      | VERIFIED | `d275254` | check, build, diff         |
| W1-02 | «Disponibilidad» label overlapping the detail in `MatchCard`                           | 50 backlog 1           | S    | no      | VERIFIED | `9a99f89` | check, build, diff, visual |
| W1-03 | Past days not editable in the availability calendar                                    | 20 B-01                | S    | no      | VERIFIED | `bfbe531` | check, build, diff         |
| W1-04 | English action errors and literal placeholder → catalog keys (NX-08)                   | 50 backlog 4 + 20 B-10 | S    | no      | VERIFIED | `135085c` | check, build, diff         |
| W1-05 | Range/tolerance error names the field and stays quiet on an empty value                | 40 backlog 1           | S    | no      | VERIFIED | `7bae7a2` | check, build, diff         |
| W1-06 | «Read as {n}» echo in converter and duration (comma decimal under `en`)                | 40 backlog 3           | S    | no      | VERIFIED | `14dfaf0` | check, build, diff         |
| W1-07 | Operations dashboard lists current (open, not expired) requirements first              | 30 backlog 1           | S    | no      | VERIFIED | `80f14a4` | check, build, diff         |
| W1-08 | Copy that contradicts code: reset «all sessions» (NX-02), reviewer wallet note (NX-04) | 10 backlog 4           | S    | no      | VERIFIED | `18b7cae` | check, build, diff         |
| W1-09 | Settings uses `primaryMembership` (NX-03)                                              | 10 backlog 8           | S    | no      | VERIFIED | `c7956b2` | check, build, diff         |
| W1-10 | Confirm before removing a qualification or deleting a window                           | 20 B-05                | S    | no      | VERIFIED | `73de8ff` | check, build, diff         |
| W2-01 | «Mi espacio» heading and identity card (initials avatar, base, experience)             | 20 B-03                | M    | no      | VERIFIED | (this)    | check, build, diff         |
| W2-02 | Completeness progress bar with ICU plural                                              | 20 B-04                | S    | no      | TODO     |           |                            |
| W2-03 | «Open requirements» KPI and dashboard description                                      | 30 backlog 2           | S    | no      | TODO     |           |                            |
| W2-04 | «Coverage» → «Internal coverage» in capacity                                           | 30 backlog 5           | S    | no      | TODO     |           |                            |
| W2-05 | Account e-mail in Settings (from verified claims)                                      | 10 backlog 5           | S    | no      | TODO     |           |                            |
| W2-06 | Account type and role visible in the shell                                             | 10 backlog 6           | S    | no      | TODO     |           |                            |
| W2-07 | «Signed out.» notice after sign-out                                                    | 10 backlog 7           | S    | no      | TODO     |           |                            |
| W2-08 | Own message for Auth 429, without account enumeration                                  | 10 backlog 2           | S    | no      | TODO     |           |                            |
| W2-09 | Copy aligned with v1.8 (overview, availability title, cycle hints)                     | 20 B-09                | S    | no      | TODO     |           |                            |
| W2-10 | Wallet filter by kind                                                                  | 20 B-06                | S    | no      | TODO     |           |                            |
| W2-11 | Linked document visible in Qualifications (wallet flag only)                           | 20 B-08                | M    | no      | TODO     |           |                            |
| W2-12 | In-app PDF/image preview (`<dialog>`) with CSP                                         | 20 B-07                | M    | no      | TODO     |           |                            |
| W3-01 | Focus ring ≥ 3:1 (navy + accent double ring)                                           | 50 backlog 2           | S    | no      | TODO     |           |                            |
| W3-02 | Favicon in brand colours                                                               | 50 backlog 3           | S    | no      | TODO     |           |                            |
| W3-03 | Placeholder and small-note contrast                                                    | 50 backlog 5           | S    | no      | TODO     |           |                            |
| W3-04 | Remaining 44 px touch targets (NX-07)                                                  | 50 backlog 6           | S    | no      | TODO     |           |                            |
| W3-05 | Arrow-key navigation in radiogroups (NX-09)                                            | 50 backlog 7           | S-M  | no      | TODO     |           |                            |
| W3-06 | `motion-safe:` on the loading skeleton                                                 | 50 backlog 8           | S    | no      | TODO     |           |                            |
| W3-07 | Same name in the menu and the `<title>`                                                | 50 backlog 9           | S    | no      | TODO     |           |                            |
| W3-08 | Duration placeholders in the catalog                                                   | 40 backlog 2           | S    | no      | TODO     |           |                            |
| W3-09 | 12 px minimum text in tools, or the documented exception (NX-05)                       | 40 backlog 5           | S    | no      | TODO     |           |                            |
| W3-10 | Numeric parity tests against the v1.8 runtime                                          | 40 backlog 4           | S    | no      | TODO     |           |                            |
| W4-01 | `docs/product/DESIGN_SYSTEM.md` to the real state                                      | 50 backlog 10          | S    | no      | TODO     |           |                            |
| W4-02 | Parity docs `09-v18-delta.md` / `10-master-matrix.md` (C1–C20, TD-55, V18-19)          | 20 B-11                | S    | no      | TODO     |           |                            |
| W4-03 | Memory bank: `origin/main` = `51c835a` live on Vercel since 2026-10-20                 | report §3.1            | S    | no      | TODO     |           |                            |
| W4-04 | This file                                                                              | —                      | S    | no      | VERIFIED | `dc744b3` | check, build, diff         |
| W5-01 | Reject requirements that start in the past (`v.start.future`)                          | 30 backlog 3           | S    | Edge    | TODO     |           |                            |
| W5-02 | Paginate and sort the requirements list                                                | 30 backlog 4           | M    | Edge    | TODO     |           |                            |
| W5-03 | Version check on calendar save (409 `CONFLICT`)                                        | 20 B-02                | M    | DB+Edge | TODO     |           |                            |

Owner first (not in the loop): Q-01 minimum password 12 (changes sign-up policy and production Auth), Q-02 free-text
requirement description (may belong to C-9; needs a migration), Q-03 production: deploy the release-2 backend in
`docs/qa/ROLLOUT_PLAN_RELEASE2.md` order or roll Vercel back.

Blocked by decisions (unchanged, see `14-decision-pack.md`): D-06, D-07, D-12, OD-3, C-9/D-08, C-10/D-02/D-03, OD-5,
OD-6, OD-7, OD-8, C-12, M-3, R-D4, R-D5, D-10, D-11, scope (logbook, daily challenge, translator, chat, commissions).

## Iteration log

| Iteration | Date       | Task  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | 2026-10-21 | W4-04 | This file; branch `feat/v18-html-parity` (local, not pushed). Gates in the commit body.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2         | 2026-10-21 | W1-01 | `requireSessionActor` throws `SessionProfileUnavailableError` when the JWT is valid but the profile is unreadable (no `/login` redirect, so no loop with `proxy.ts`); root `src/app/error.tsx` offers retry and sign-out. 5 new unit tests.                                                                                                                                                                                                                                                           |
| 3         | 2026-10-21 | W1-02 | `MatchCard` checklist on a subgrid (`1rem max-content minmax(0,1fr)`): the label column fits «Disponibilidad», rows stay aligned, monospace only for qualification codes. Visual check with the built CSS in headless Chromium at 1440/768/390: before = «Disponibilidad» overlaps the detail at every width; after = no overlap, aligned (captures in the external report, `evidencias/loop/W1-02/`). No logic change, so no unit test.                                                              |
| 4         | 2026-10-21 | W1-03 | `isDayEditable` (pure, tested): past UTC days are disabled and ignored on click with or without a draft (before: one click created, changed or deleted a past single-day window). Dead `availability.pastDay` key removed; BR-4.6 updated. Server-side refusal for single-window writes stays optional (migration, owner).                                                                                                                                                                            |
| 5         | 2026-10-21 | W1-04 | Actions return keys (`common.checkFields`, `v.form.window`, `v.form.qualification`, `api.NOT_FOUND.description`) instead of English text; `actionErrorCopy` never shows a raw server message (wider than the backlog: the Edge Functions' English defaults such as «Some fields are invalid.» reached the Spanish UI on any server-side validation error); «Madrid (MAD)» placeholder from the catalog. 6 new tests; `I18N_STRATEGY.md` states the rule.                                              |
| 6         | 2026-10-21 | W1-05 | `convertRange` gives the tolerance its own codes (`toleranceRequired`, `toleranceInvalid`; negative → `toleranceRange`), so the message names the field; the «Rango convertido» panel waits for a value instead of repeating «Introduce un valor.». Bug inherited from v1.8 (`Toolbox.jsx:19,31`). Range tests updated to the new codes (no case removed, three added).                                                                                                                               |
| 7         | 2026-10-21 | W1-06 | `ambiguousReading` (pure, tested): under the converter value and the decimal-hours input, «Se lee como {n}» / «Read as {n}» (polite live region) whenever the input holds a fraction or a decimal mark that is not the locale's. Broader than the backlog line: it also catches «1.200» under `es` (same ×1000 trap). Input rules and results unchanged.                                                                                                                                              |
| 8         | 2026-10-21 | W1-07 | Dashboard «Necesidades» lists current requirements (open, not ended; from the filtered list the focus already uses) first, then the rest without repeats; the focus is the first current one. Pure helpers `currentRequirements` / `dashboardRequirements` with 4 tests. Before: the first 5 rows of a starts-ascending list, i.e. the oldest history.                                                                                                                                                |
| 9         | 2026-10-21 | W1-08 | Copy only: the reset lead says every session ends, this one included (code: `signOut({ scope: "global" })`); the reviewer note no longer claims the wallet is not built (it is private, owner-only RLS, not shared with reviewers); `10-master-matrix.md` CX-07 corrected (`others` → `global`). No test: static copy.                                                                                                                                                                                |
| 10        | 2026-10-21 | W1-09 | Settings shows `primaryMembership(actor)` (highest role, then lowest org id), as the shell and every organization page, instead of `memberships[0]`. One line; the rule itself is already unit-tested in `session.test.ts`.                                                                                                                                                                                                                                                                           |
| 11        | 2026-10-21 | W1-10 | Reusable `ConfirmButton` (first click reveals «Sí, quitarla / eliminarla» + «Cancelar», focus on cancel and back to the trigger) on «Quitar» qualification and «Eliminar» window, which deleted on one click. The wallet keeps its own inline confirm (it also closes on edit); not refactored. Render test only (no DOM test environment in the repo). Wave 1 done.                                                                                                                                  |
| 12        | 2026-10-21 | W2-01 | «Mi espacio»: kicker «Mi espacio», h1 «Tu perfil. Tu tiempo. / Tu próxima oportunidad.» (one `<br>`, so no «tiempo.Tu» glue as in v1.8 at 390 px), «Herramientas» action, `IdentityCard` (initials avatar, name, «{base \| Base por completar} · {n} años de experiencia declarada», «Editar perfil»); KPI «Cualificaciones» counts held ones only. `PageHeader.title` accepts rich content. `initials` tested; `ui-smoke` 5m now looks for the new English heading. Eyebrow part of W2-09 done here. |
