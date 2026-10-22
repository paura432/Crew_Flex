# Design System

Extracted from the CrewFlex prototypes V1.1 → V1.8 (reference: `CrewFlex_v1.8.html`, compared element by element in
`docs/integration/crewflex-v13/16-html-v18-diff.md`). Visual decisions only — no compiled code reused.

## Direction

Premium, aviation, technical, clean. High information density without saturation. Tables, status
chips, dates and qualifications over decoration.

**Avoid:** generic purple SaaS, gratuitous gradients, glassmorphism, cards inside cards, icon
overload, tiny text, decorative animation.

## Tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

| Token    | Value     | Use                                          | Origin                                           |
| -------- | --------- | -------------------------------------------- | ------------------------------------------------ |
| `navy`   | `#0c2137` | Sidebar, brand, dark surfaces                | prototype                                        |
| `ink`    | `#172c44` | Body text                                    | prototype                                        |
| `muted`  | `#5b6f84` | Secondary text (≥ 4.5:1 on white)            | prototype (darkened from `#60758b` for contrast) |
| `line`   | `#dce4ed` | Borders, dividers                            | prototype                                        |
| `canvas` | `#f5f7fa` | App background                               | prototype                                        |
| `accent` | `#ff982f` | Primary CTA background (text = ink)          | prototype                                        |
| `blue`   | `#18558f` | Links, info                                  | prototype                                        |
| `ok`     | `#16745d` | Eligible / verified / covered                | prototype                                        |
| `warn`   | `#aa5916` | Pending / urgent / **AOG day** (V1.8 orange) | prototype                                        |
| `danger` | `#ad3b44` | Blocker / gap / error                        | prototype                                        |

Calendar partial day: `bg-partial` hatched utility (V1.8 `styles/v18.css:1`, `#eef6f4`/`#dcece6`, text `ok`);
AOG-only day uses `warn` (V1.8 orange, never the error red) — second audit 2026-10-20.

Touch targets (second audit 2026-10-20, V1.8 `v12.css` min-height 44): buttons, form controls, nav links
and compact controls are **44 px on a coarse pointer** (`pointer-coarse:min-h-11`); desktop keeps 40 px
density. Checked by `ui-smoke` 25 on a touch-emulated 390 px screen.

Navigation below `lg`: sections fold behind a «Menu» disclosure (`NavDrawer`, V1.8 ≤ 760 px drawer); the
5-item bottom dock of V1.8 is not ported (C-12). Buttons: `primary` (orange CTA), `secondary`, `ghost` and
`danger` (irreversible actions, e.g. closing a requirement). Removing a row (qualification, availability
window) asks first with `ConfirmButton` (`src/components/ui/ConfirmButton.tsx`): confirm + cancel, focus on cancel.

Tools workbench sub-palette (`tool-*` tokens, used only under `/app/tools`): taken from the V1.3/V1.8
prototype `styles/v13.css` (`.toolbox`, `.tb-*`) so the workbench keeps its own identity — teal
`tool` `#057f7d`, hero `#112e40`, result card `#103b49`, mint CTA `#b5f0dc`, soft icon tile
`#e8f3f1`. Radii 13/18 px as in the prototype. Deviations kept on purpose: Inter instead of the
system font, the global focus ring (one style for the whole app: a 2 px navy ring inside a 3 px orange
outline, ≥ 3:1 on white, canvas and the navy sidebar), and the Tools link in
the shared "Account" nav section because both professional and organization accounts use it. The learning medals
(`LearningMedals`, also in Mi espacio) keep v1.8 `.cf-medal`: earned `#916413` on `#fff7e4` (4.9:1), locked `muted` on
`#f0f3f5`, dashed. A disclosure `<summary>` styled `flex` draws its own «▸/▾» with empty alternative text, so the glyph
is not part of its accessible name (T-3).

Typography: Inter (via `next/font`; V1.8 named Inter/Outfit but never loaded them). Body 15px/1.6, never below
12px, with V1.8 micro-labels kept at 11 px, and only these (a design test lists the files): table headers, sidebar
section titles (including «Ver como»), the «AVIATION» brand tag, the weekday row of the mini calendar and the state
label and the «● Asignada» mark inside an availability day cell (below `sm` the mark is only the dot; its words stay in
the cell's `aria-label`). The tools workbench follows the 12 px rule with no exception (a design
test guards it). Headings tight tracking. Numbers
in metrics use tabular figures.

## Components (`src/components/ui`)

| Component               | Purpose                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `ButtonLink` | Real `<button>` / `<a>`. Variants: primary (accent), secondary, ghost, danger, inverse (navy landing). Sizes md (40 px) and sm (32 px); 44 on touch. Colour and size only through props (X-01). |
| `StatusChip`            | Small bold sentence-case chip (v1.8 `.pill`, 12 px, never uppercase); tones: neutral, ok, warn, danger, info.                                                                                   |
| Table header            | `thead`: canvas background, 11 px, muted, sentence case (styled after v1.8 `v11.css` `th`, which no rendered V1.8 screen used: it had no tables). Uppercase stays for eyebrows/kickers only.    |
| Nav icons               | Inline 18 px stroke icons per entry (v1.8 lucide map); the active entry's icon is accent.                                                                                                       |
| `Panel`                 | Single-level white surface with border. No nested panels.                                                                                                                                       |
| `Metric`                | Label + large tabular number + optional detail.                                                                                                                                                 |
| `Field`                 | Label + control + hint + error, wired with `aria-describedby`.                                                                                                                                  |
| `StateMessage`          | Loading / empty / error states with a clear next action.                                                                                                                                        |
| `ConfirmButton`         | Two-step destructive row action: confirm + cancel, focus on cancel, back to the trigger when cancelled.                                                                                         |

## Patterns

- **Capacity strip:** Required · Internally eligible · Gap · Internal coverage. Gap uses `danger` only when
  > 0; otherwise `ok`.
- **Match card:** verdict chip in sentence case («Elegible» / «No elegible») → name, base and experience → blockers
  (when any) → checklist of qualifications (✓/✗ + verification) with availability as its last row, on an aligned
  subgrid.
- **Tables** on ≥ md; stacked lists on mobile. No accidental horizontal scroll.
- Focus ring: 2 px navy ring + 3 px accent outline (offset 2 px), ≥ 3:1 on every surface.

## Responsive

Desktop (`lg`, ≥ 1024 px): sticky navy sidebar with the name, account type/role (platform admins: the platform
role) and sign-out at the bottom; the menu scrolls inside the screen when it is taller than the viewport (X-03).
Platform admins get a «Ver como» switcher above the menu (D-13): four links (Técnico, Empresa, Recruiter,
Administración) over their own account, each showing that view's sections. Below
`lg`: the sidebar becomes a navy top bar (brand, «Cerrar sesión», «Menú») and the sections fold behind the «Menú»
disclosure, which closes on navigation. No bottom dock (C-12). Tables become stacked lists below `md`; no accidental
horizontal scroll at 390 px. Touch targets 44 px on coarse pointers.
