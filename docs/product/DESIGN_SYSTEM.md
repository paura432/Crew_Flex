# Design System

Extracted from the prototype `CrewFlex_v1.1.html` (visual decisions only — no compiled code reused).

## Direction

Premium, aviation, technical, clean. High information density without saturation. Tables, status
chips, dates and qualifications over decoration.

**Avoid:** generic purple SaaS, gratuitous gradients, glassmorphism, cards inside cards, icon
overload, tiny text, decorative animation.

## Tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

| Token    | Value     | Use                                 | Origin                                           |
| -------- | --------- | ----------------------------------- | ------------------------------------------------ |
| `navy`   | `#0c2137` | Sidebar, brand, dark surfaces       | prototype                                        |
| `ink`    | `#172c44` | Body text                           | prototype                                        |
| `muted`  | `#5b6f84` | Secondary text (≥ 4.5:1 on white)   | prototype (darkened from `#60758b` for contrast) |
| `line`   | `#dce4ed` | Borders, dividers                   | prototype                                        |
| `canvas` | `#f5f7fa` | App background                      | prototype                                        |
| `accent` | `#ff982f` | Primary CTA background (text = ink) | prototype                                        |
| `blue`   | `#18558f` | Links, info                         | prototype                                        |
| `ok`     | `#16745d` | Eligible / verified / covered       | prototype                                        |
| `warn`   | `#aa5916` | Pending / partial / urgent          | prototype                                        |
| `danger` | `#ad3b44` | Blocker / gap / AOG                 | prototype                                        |

Typography: Inter (via `next/font`). Body 15px/1.6, never below 12px. Headings tight tracking.
Numbers in metrics use tabular figures.

## Components (`src/components/ui`)

| Component               | Purpose                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `Button` / `ButtonLink` | Real `<button>` / `<a>`. Variants: primary (accent), secondary, ghost. Min height 40px. |
| `StatusChip`            | Small uppercase chip; tones: neutral, ok, warn, danger, info.                           |
| `Panel`                 | Single-level white surface with border. No nested panels.                               |
| `Metric`                | Label + large tabular number + optional detail.                                         |
| `Field`                 | Label + control + hint + error, wired with `aria-describedby`.                          |
| `StateMessage`          | Loading / empty / error states with a clear next action.                                |

## Patterns

- **Capacity strip:** Required · Internally eligible · Gap · Coverage. Gap uses `danger` only when
  > 0; otherwise `ok`.
- **Match card:** verdict chip (ELIGIBLE / NOT ELIGIBLE) → checklist of qualifications (✓/✗ +
  verification) → availability → location → blockers.
- **Tables** on ≥ md; stacked lists on mobile. No accidental horizontal scroll.
- Focus ring: 3px accent outline, offset 2px.

## Responsive

Desktop (≥1024): fixed sidebar. Tablet (768–1023): sidebar collapses into top nav. Mobile (<768):
top nav + stacked content.
