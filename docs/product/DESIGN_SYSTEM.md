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

Brand (T-140, v1.8 `.brand-symbol`): `BrandMark` = orange (`accent`) rounded square with the navy lucide plane,
next to «CrewFlex» and the 11 px «AVIATION» tag (`Brand`, sidebar, landing, auth, public tools); the favicon is
the inverse, a navy square with the orange plane (`src/app/icon.svg`, same path, `tests/design/icon.test.ts`).

«Mi espacio» hero (v1.8 `.personal-passport`, T-143): `bg-hero` = 140° gradient `hero-from #103a4c → hero-to
#186c72`; white text (12.1:1 / 6.1:1 on the two stops) and `hero-text #d7ecee` (9.9:1 / 5.0:1); progress value
`hero-bar #9ad9ca` on a translucent track. The initials avatar `bg-avatar` (`#0c4959 → #24807a`, v1.8's end stop
`#2b9188` darkened so white reads 4.7:1) has a 3 px white ring. Medals (v1.8 `.tiny-medal`, BR-29): experience gold
`medal-gold #82611d` on `medal-gold-bg #fff8e8` (5.4:1), category `blue` on `info-bg` (6.8:1), aircraft `ok` on
`ok-bg` (5.1:1), specialty `medal-violet #72558a` on `medal-violet-bg #f3eef9` (5.4:1), «Revisar vigencia» dashed
`warn`; 12 px text, 38 px tall (44 px on touch).

Organization «Resumen» hero (v1.8 `.dashboard-hero`, T-167): `bg-navy` (v1.8 `#0d2945` → the `navy` token), white
h2 (16.3:1), body `#a9bfd2` (8.6:1) and the dark chip `#acc3d9` on `white/10` (6.7:1), the brand chip `warn` on
`warn-bg` (v1.8 `.pill.orange`, 4.5:1), CTA `inverse`; the «CF / AVIATION» mark is decorative (`aria-hidden`,
`min-[981px]:flex`, v1.8 hides it up to 980 px) and reuses `PLANE_PATH`.

Calendar partial day: `bg-partial` hatched utility (V1.8 `styles/v18.css:1`, `#eef6f4`/`#dcece6`, text `ok`);
AOG-only day uses `warn` (V1.8 orange, never the error red) — second audit 2026-10-20.

Touch targets (second audit 2026-10-20, V1.8 `v12.css` min-height 44): buttons, form controls, nav links
and compact controls are **44 px on a coarse pointer** (`pointer-coarse:min-h-11`); desktop keeps 40 px
density. Linked list titles use `block` + `pointer-coarse:py-2.5` (one ≥ 15 px line) or `inline-flex` +
`pointer-coarse:min-h-11`; the compact brand link of the navy bar adds `pointer-coarse:min-w-11`. Checked by `ui-smoke`
25 and `PKG P15` on a touch-emulated 390 px screen; `tests/design/a11y.test.ts` holds the static side.

Navigation below `lg`: sections fold behind a «Menu» disclosure (`NavDrawer`, V1.8 ≤ 760 px drawer), and the
V1.8 bottom dock «Accesos rápidos» (`MobileDock`, T-141) keeps up to five shortcuts of the current workspace in
reach: white bar fixed at the bottom with `env(safe-area-inset-bottom)` (the viewport is `viewport-fit=cover`),
44 px targets, 11 px labels in `muted` (5.2:1), the current one `ok` on `ok-bg` (5.1:1) with `aria-current="page"`;
the app column reserves its height so the footer is never covered. Buttons: `primary` (orange CTA), `secondary`, `ghost` and
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
section titles (including «Ver como»), the «AVIATION» brand tag (`Brand`), the mobile dock labels (v1.8 9 px; the
longest, «Herramientas», fits a 71 px cell at 360 px), the weekday row of the mini calendar and the state
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
| `FilterPill`            | A filter as a link (works without JavaScript); the active one is navy with `aria-current="true"` — `"page"` stays the menu entry's (area 50 #14).                                               |
| `MedalStrip`            | v1.8 medals of the own passport (BR-29): up to four + «+N», a detail with the v1.8 footnote in a polite status region (`features/professional`).                                                |
| `ConfirmButton`         | Two-step destructive row action: confirm + cancel, focus on cancel, back to the trigger when cancelled.                                                                                         |

## Patterns

- **Capacity strip:** Required · Internally eligible · Gap · Internal coverage. Gap uses `danger` only when
  > 0; otherwise `ok`.
- **Match card:** verdict chip in sentence case («Elegible» / «No elegible») → name, base and experience → blockers
  (when any) → checklist of qualifications (✓/✗ + verification) with availability as its last row, on an aligned
  subgrid.
- **Tables** on ≥ md; stacked lists on mobile. No accidental horizontal scroll.
- Focus ring: 2 px navy ring + 3 px accent outline (offset 2 px), ≥ 3:1 on every surface. `:focus-visible` also sets
  `--tw-ring-shadow` to the navy ring so a `shadow-*` utility (which rewrites `box-shadow`) keeps it; a control with its
  own `ring-*` (today in the mini calendar) adds `focus-visible:ring-navy` (P15). Known residuals (P15 review): the daily challenge's pressed option keeps its 1 px teal `ring-[#07877e]` when focused, and a hovered + focused calendar day mixes in `hover:ring-navy/30`. Landmarks of one kind carry distinct
  names: the dock is «Accesos rápidos», the dashboard quick links «Accesos directos».

## Responsive

Desktop (`lg`, ≥ 1024 px): sticky navy sidebar with the name, account type/role (platform admins: the platform
role) and sign-out at the bottom; the menu scrolls inside the screen when it is taller than the viewport (X-03).
Above the content a 76 px white header (`TopBar`, v1.8/v1.9 `.workspace-header`, T-142) reads «CrewFlex / {menu entry}»
(12 px `muted`, 5.2:1; the entry the path belongs to, e.g. «Necesidades» on a requirement's detail; the decorative «/»
in v1.9's light `#acb8c4`) with the notices bell on the right as v1.9's `.icon-button`: 44 × 44, 1 px `line` border,
white, icon `#426078` (6.6:1). At the end of every `/app` page the v1.8 footer «CREWFLEX AVIATION» · «Cualificación ·
Disponibilidad · Confianza» (12 px `muted` on canvas, 4.8:1; the motto from `md`, no version label, T-148).
Platform admins get a «Ver como» switcher above the menu (D-13): four links (Técnico, Empresa, Recruiter,
Administración) over their own account, each showing that view's sections. Below
`lg`: the sidebar becomes a navy top bar (brand, notices bell, «Cerrar sesión», «Menú»; below 420 px the brand shows
only the CF mark — its name stays for assistive tech — so the bar fits at 360–390 px) and the sections fold behind the
«Menú» disclosure, which closes on navigation. The notices bell (v2-18) sits next to the brand below `lg` and in the
white header from `lg` (one count, read once per request): a link to «Avisos» with an accent count badge (12 px,
«99+» cap; the count is in the accessible name), and the «Avisos» menu entry repeats the count. Below `lg` the
bottom dock (T-141) holds the workspace's shortcuts. Tables become stacked lists below `md`; no accidental
horizontal scroll at 390 or 360 px (measured with the dock). Touch targets 44 px on coarse pointers.

«Estado de mi perfil ↗» (N-18, T-148) and the requirement preview are native modal `<dialog>`s: Escape or «Cerrar»
closes them and focus returns to the button that opened them. The 404 page (root `not-found`, with its `h1`) has no
sidebar: a missing or someone else's detail answers it with a real 404 from the proxy (T-147, as X-11).
