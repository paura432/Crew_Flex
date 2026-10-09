# Source inventory

Audit date: 2026-10-09. Search scope: `~/pau/Crew_Flex` (repo + `tmp/`), `~` (depth 4), and the Windows
profile `/mnt/c/Users/perfo` (`Downloads`, `Desktop`, `Documents`, `OneDrive`, `Pictures`, `Videos`, `Music`,
depth 5) by name (`*crew*`, `*jobslice*`, `*lutes*`, `*recrew*`, `index-1.html`), by extension
(`.ogg .opus .m4a .mp3 .wav`) and by content where relevant. Personal data and secrets are not copied here.

| #   | Source                                                                              | Status                        | Path searched / found                                                                               | Reviewed                                                                                               | Evidence                                                               |
| --- | ----------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| S1  | `CrewFlex_v1.1.html` (main prototype, Vite/React bundle, Spanish UI)                | FOUND                         | `/mnt/c/Users/perfo/Downloads/CrewFlex_v1.1.html` (305 KB)                                          | Full: structure, state model, actions, matching, availability, roles, all 18 role/tab screens rendered | `HTML_COMPARISON.md`, `FEATURE_INVENTORY.md`, `evidence/proto-*.jpg`   |
| S2  | `CrewFlex_Blueprint_Producto_v1.pdf`                                                | FOUND                         | `/mnt/c/Users/perfo/Downloads/` (13 pages, text extracted with pypdfium2)                           | Full                                                                                                   | `docs/product/PRODUCT.md`, `OPEN_DECISIONS.md`                         |
| S3  | `crew-flex-fable-5.1.zip` (reconstructed design handoff + Fable redesign)           | FOUND                         | `tmp/crew-flex-fable-5.1.zip` → `tmp/fable-src/`, redesign in `tmp/fable-5.1-redesign/`             | Full                                                                                                   | `HTML_COMPARISON.md` §Fable                                            |
| S4  | `crew-flex-aviation-premium-v2.html`                                                | FOUND (Phase 0.6)             | `tmp/crew-flex-fuentes-faltantes/tmp/` (169 KB, Spanish marketing landing "Crew Flex Aviation")     | Full: structure, claims, visual system, 16 candidate features; rendered 1440/390                       | `sources/S4-aviation-premium-v2.md`, `evidence/src-S4-*.jpg`           |
| S5  | `crew-flex-web-premium-v2-1.html`                                                   | FOUND (Phase 0.6)             | same folder (2.7 MB, corporate one-pager; 3 embedded PNGs incl. a 1.6 MB infographic)               | Full; rendered 1440/390                                                                                | `sources/S5-web-premium-v2-1.md`, `evidence/src-S5-*.jpg`              |
| S6  | `lutes_recrew_demo.html`                                                            | FOUND (Phase 0.6)             | same folder (41 KB, "Lutes Recrew" company-centric landing + static mock-ups, SaaS pricing)         | Full; 6 click-reachable views rendered                                                                 | `sources/S6-S7-lutes-jobslice.md`, `evidence/src-S6-*.jpg`             |
| S7  | `index-1.html`                                                                      | FOUND (Phase 0.6)             | same folder (32 KB, "JobSlice Aero — MVP Técnicos" mobile technician demo with working calculators) | Full; 9 screens rendered                                                                               | `sources/S6-S7-lutes-jobslice.md`, `evidence/src-S7-*.jpg`             |
| S8  | `JobSlice_Aero_propuesta.pdf`                                                       | FOUND (Phase 0.6)             | same folder (288 KB, 11 pages, "Propuesta de MVP y modelo de negocio", v0.1, Agosto 2026)           | Full text extraction (pypdfium2); 22 decision statements                                               | `sources/S8-jobslice-propuesta.md`, `FOUNDER_DECISIONS.md` FD-15…FD-36 |
| S9  | `WhatsApp Ptt 2026-10-07 at 10.55.46.ogg`                                           | FOUND                         | `/mnt/c/Users/perfo/Downloads/` (165 KB, Opus, ~74.7 s)                                             | See `AUDIO_INVENTORY.md`                                                                               | `FOUNDER_DECISIONS.md`                                                 |
| S10 | `WhatsApp Ptt 2026-09-28 at 13.05.23.ogg`                                           | FOUND (not listed in brief)   | `/mnt/c/Users/perfo/Downloads/` (7.5 KB, Opus, ~3.3 s)                                              | See `AUDIO_INVENTORY.md`                                                                               | —                                                                      |
| S11 | `Desktop/trabajo/pau/crew_flex.txt`                                                 | FOUND, EMPTY (0 bytes)        | `/mnt/c/Users/perfo/Desktop/trabajo/pau/`                                                           | n/a                                                                                                    | —                                                                      |
| S12 | Repository docs (`docs/product/*`, `docs/architecture/*`, `AGENTS.md`, `README.md`) | FOUND                         | repo                                                                                                | Full                                                                                                   | this audit                                                             |
| S13 | Deployed app `https://crew-flex.vercel.app`                                         | FOUND                         | public routes only (no credentials)                                                                 | Public routes at 1440/1024/768/390                                                                     | `evidence/deployed-*.jpg`                                              |
| S15 | `crew-flex-web-premium-v3.html` (referenced by S4 as a sibling link)                | **SOURCE_MISSING**            | Searched `tmp/` recursively and the scopes above                                                    | —                                                                                                      | `sources/S4-aviation-premium-v2.md` §1                                 |
| S14 | Supabase project `sbjkzrkmcekokkqiuvvh`                                             | FOUND (linked CLI, read-only) | —                                                                                                   | Migrations, functions, secrets, types, table stats                                                     | `SUPABASE_CURRENT_STATE.md`                                            |

Not found anywhere: WhatsApp chat exports (`.txt`/`.zip`), images, videos, JSON notes or other Markdown
about Crew Flex outside the repository.

**Coverage statement (updated Phase 0.6):** all 7 named sources are now reviewed (S1–S8 except S3 which is the
Fable handoff). The only missing item is S15, a sibling page referenced inside S4 that was never provided.
Per-source detail lives in `docs/audit/sources/`; screenshots in `evidence/src-S*-*.jpg` (26 files).

## Phase 0.5 re-search (2026-10-09, afternoon)

The Phase 0.5 brief stated that the five missing files had been added to `tmp/`. They were **not found**:

| Scope searched                                                                                             | Method                                                                                                                         | Result                                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `tmp/` (recursive)                                                                                         | `ls -la`, `find -iname '*.html' -o -iname '*.pdf'`                                                                             | only `crew-flex-fable-5.1.zip`, `fable-src/`, `fable-5.1-redesign/` (unchanged since 13:50) |
| Whole repo, `/home/pau` (depth 5), `/tmp`                                                                  | names `*premium*`, `*lutes*`, `*recrew*`, `index-1.html`, `*jobslice*`, `*aero*propuesta*`; HTML/PDF modified in the last 24 h | nothing related                                                                             |
| Windows profile `Downloads`, `Desktop`, `Documents`, `OneDrive`, `Pictures` (depth 6) and `/mnt/c/Users/*` | same names + `*crew*`; HTML/PDF/ZIP modified in the last 3 days                                                                | only S1, S2, S3 and an unrelated `VERSIÓN 30 JULIO (1).html` (another project)              |
| Entire WSL filesystem (`find / -xdev`, excluding system and dependency directories)                        | same names                                                                                                                     | nothing                                                                                     |

S4–S8 remain `SOURCE_MISSING`; no content was inferred and no previous decision was overwritten. If the
files exist on another machine or account, copying them into `tmp/` (ignored by git) is enough to resume
Phase A.

## Phase 0.6 recovery (2026-10-09, 16:32)

The five files appeared in `tmp/crew-flex-fuentes-faltantes/tmp/` (not directly in `tmp/`, hence the earlier
negative search by exact path; the re-search in Phase 0.5 ran before they were copied). Each was read line by
line and rendered with headless Chromium at 1440 and 390 (0 console errors except one blocked Google Fonts
request in S6; no horizontal overflow except a 3 px clipped badge in S4 at 390). No file was executed; `tmp/`
stays ignored by git. Personal data found: only fictional demo names in S6/S7 and a company `mailto:` in S4/S5;
none copied into the docs. S8's PDF metadata carries an author name, not reproduced.
