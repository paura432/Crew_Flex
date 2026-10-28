# 18 · v1.8 inventory — the canonical parity metric (F3)

The element-by-element diff of `CrewFlex_v1.8.html` against this app, **1 587 rows** in five areas, imported on
2026-10-26 from the owner's verified report `C:\Users\perfo\Downloads\CrewFlex_DIFF_HTML_v18_vs_Next_2026-10-22-v2\`
(`diff/10…50-*.md`, `_FORMAT.md`; its captures stay outside the repo). Every row was verified on both sides on
2026-10-22 against `feat/v18-html-parity` at `5c2d1a2`; the 16 packages merged since then are **not** reflected until
each F3 package re-verifies its rows. This directory is the single place where rows change state.

| File (sha256 of the imported copy, first 16) | Area                                   | Rows |
| -------------------------------------------- | -------------------------------------- | ---: |
| `10-shell-auth-account-admin.md` (`dabe43ce6c4819bf`) | Shell, access, account, admin | 317 |
| `20-technician.md` (`707aa398c76e0be0`)      | Technician                             |  312 |
| `30-company-hiring.md` (`49f0ea561a70f2dc`)  | Organization, market, hiring           |  393 |
| `40-tools-learning.md` (`465a11fd16bef273`)  | Tools and learning                     |  259 |
| `50-visual-meta-a11y.md` (`cc402602fcb628f4`)| Visual, meta, a11y, i18n               |  306 |

## Metric

```bash
python3 recount.py 10-*.md 20-*.md 30-*.md 40-*.md 50-*.md
```

- Diff: `=` equal · `≈` equivalent · `≠` different · `−` missing in Next · `+` Next only · `✗` not ported (bug,
  demo-only, unsafe or SCOPE OUT — always with the reason).
- **Applicable** = `=` + `≈` + `≠` + `−`. **Parity** = (`=` + `≈`) / applicable. Rows held by an open decision
  (Bloqueo not starting with «—») stay in the denominator and are reported apart; `✗` rows are out of scope with a reason
  and leave it.
- Baseline (2026-10-22, the source report): 1 587 rows · = 245 · ≈ 454 · ≠ 148 · − 399 · + 210 · ✗ 131 → parity
  **699 / 1 246 = 56,1 %**; held by an open decision or SCOPE 161 (12,9 %).

## Packages (F3) → sections

| Package                    | Sections                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| P01 Technician home        | TEC-01, SHOT-01                                                           |
| P02 Passport               | TEC-02, TEC-03, TEC-08, SHOT-03                                           |
| P03 Calendar               | TEC-04, SHOT-02                                                           |
| P04 Opportunities          | MKT-03, MKT-04, MKT-05, SHOT-10                                           |
| P05 Applications           | HIRE-01…HIRE-05, SHOT-11                                                  |
| P06 Wallet                 | TEC-05                                                                    |
| P07 Logbook                | TEC-06                                                                    |
| P08 Tools                  | TOOL-01…TOOL-09, SHOT-04                                                  |
| P09 Organization dashboard | ORG-01, ORG-07, SHOT-05                                                   |
| P10 Needs and matching     | ORG-02…ORG-06, MKT-01, MKT-02, SHOT-06, SHOT-07                           |
| P11 Recruiter              | ORG-08                                                                    |
| P12 Admin                  | ADM-01…ADM-03                                                             |
| P13 Notices and messaging  | HIRE-06, HIRE-07, HIRE-08 (SCOPE OUT), TEC-07, ACC-03                     |
| P14 Shell                  | SH-01…SH-08, AUTH-01…AUTH-06, ACC-01, ACC-02, VIS-*, META-*, SHOT-08, SHOT-09, TEC-09, TOOL-09 |
| P15 Accessibility and i18n | A11Y-01…A11Y-06, I18N-01…I18N-05                                          |

## Updating a row

Re-verify both sides, then edit the row in place: Diff, Sev., Bloqueo, Acción and the Next `file:line`; add
`(F3: antes X)` when the symbol changes and the evidence (test name, smoke step or capture under
`docs/audit/evidence/parity/Pxx/`). A row only moves to `=`/`≈` with a test or smoke step that ran green. The per-package
acceptance detail lives in `17-parity-matrix-v18.md`.
