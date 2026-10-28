# 50 · Diff de sistema visual, meta/PWA, accesibilidad, i18n y capturas — v1.8 ↔ Next

**F3 (28/10, P14a — SHOT-08 y SHOT-09 re-verificadas, 1 fila cambia de símbolo `(F3: antes X)`; `recount.py`):** filas 306 · = 71 · ≈ 103 · ≠ 41 · − 23 · + 49 · ✗ 19 → paridad 174/238 = 73,1 %, 9 filas retenidas por una decisión abierta (antes de P14a, `recount.py` sobre `887d4a2`: = 70 · ≈ 103 · ≠ 41 · − 24 → 173/238 = 72,7 %, 9 retenidas; 26/10, tras P02, P03 y P04 — SHOT-03, SHOT-02 y SHOT-10: = 66 · ≈ 93 · ≠ 51 · − 28 · + 49 · ✗ 19 → 159/238 = 66,8 %, 12 retenidas). Las líneas siguientes son el estado histórico del 22/10.

Filas 306 · = 62 · ≈ 87 · ≠ 59 · − 30 · + 49 · ✗ 19 · Sev. P1 0 · P2 33 · P3 75 · sin sev. 198 (v2, 22/10 tarde, Next `821c24f`; xhigh: 282 · = 56 · ≈ 81 · ≠ 53 · − 32 · + 41 · ✗ 19 · P1 3 · P2 30 · P3 71 · sin sev. 178; refresco de la mañana: 274 · = 55 · ≈ 77 · ≠ 51 · − 32 · + 40 · ✗ 19; 21/10: 269 · = 48 · ≈ 77 · ≠ 55 · − 39 · + 30 · ✗ 20)

## Verificación v2 (22/10/2026, tras el bucle)

**Método.**
- Código: cada fila releída contra el SNAP (`821c24f`). Un script (`work/50/remap.py`) alineó con `difflib` cada cita `archivo:línea` y `es:N` de la copia xhigh (`snapshot-1116`) con el SNAP: 186 citas iguales, 142 movidas (101 corregidas en las tablas de elementos; las tablas históricas de abajo se dejan con sus líneas de entonces) y 46 con contenido cambiado o fichero borrado (`CloseRequirement.tsx` desaparece con M05), revisadas a mano.
- Next en ejecución: `next start` en `localhost:3003` con la BD local, Playwright (Chromium 1248), sin escrituras salvo el inicio de sesión (sesiones guardadas y reutilizadas por el límite de 30 inicios cada 5 min). Se midieron 27 páginas tituladas en ES y EN, a 1440/768/390: contraste calculado y anillo de cada enfocable, objetivos con `hasTouch`, teclado, `reduce`, anunciador de rutas y cabeceras con `curl -I`. Los datos de M05/M07/M08 vienen del recorrido del área 30 («E2E diff v2 · A/B»): candidatura confirmada y luego finalizada de delta, rechazada de echo, cancelada y aceptada.
- v1.8 demo (`56390`): re-medidas oportunidades, candidaturas (técnico y empresa), «Ofertas y cobertura», filtros, leyenda del calendario y capturas a 1440/390. El resto de la columna v1.8 viene de la xhigh: v1.8 no ha cambiado.
- v1.8 conectado (`3125`, sesiones del README del conectado; solo navegación): shell, iconos, dock, salto, «Asignado», login, contraste y foco en 13 pantallas (técnico 1, empresa y sin sesión) y cabeceras HTTP.

**Cobertura.** 306 filas de elementos (282 + 24 nuevas):
- En código: 306 de 306.
- En Next en ejecución hoy: unas 110, repartidas por todas las secciones salvo VIS-01, VIS-04, VIS-09, I18N-03 e I18N-04. Las 24 nuevas están todas medidas.
- En v1.8 demo: unas 25 re-medidas hoy, sobre todo las nuevas; las otras ~140 se apoyan en la medida xhigh de esta mañana (v1.8 sin cambios).
- En v1.8 conectado: 23 medidas hoy: VIS-02 #2 y #11, VIS-06 #4, #7, #11, #14 y #15, VIS-07 #5, #7, #12, #20 y #21, VIS-08 #7, META-03 #6, A11Y-01 #2, A11Y-02 #1, A11Y-06 #20, I18N-03 #4 y SHOT-08 #1-#5. Son las filas que la xhigh no pudo medir porque el conectado no estaba levantado.

**No verificado y por qué:**
- **Estados que escriben en Next:** el `Notice` tras una acción con éxito o error y el «Guardando…» (A11Y-03 #2-#4). Pausar, reanudar, cerrar y enviar candidaturas o transiciones se verifican solo en código; sí se abrieron, sin enviar, el paso de cierre y el de cancelar una candidatura aceptada.
- **Conectado:** «Cambios guardados.» con `role=status` (A11Y-03 #2), porque pide guardar; tampoco se midieron allí los objetivos táctiles.
- **Datos que cambian durante la revisión:** la necesidad `47ef2c3c…` con candidatura cancelada se borró a mitad de la medida (404 en `raw/contrast-mgr.json`). La candidatura confirmada de delta pasó a finalizada, así que la marca «Asignada» se midió antes, en `raw/assigned.txt`. El título enlazado de «Mis candidaturas» (A11Y-05 #11) se queda en código: con los datos actuales ninguno es enlace.
- **Fuera de medición:** impresión (VIS-05 #5), zoom de iOS (VIS-03 #12), idioma por defecto sin cookie (I18N-01 #3), zona horaria (I18N-01 #5) y la tabla de comparación de matching con porcentajes (I18N-01 #9), que pide elegir candidatos.
- **No ejecutado:** `ui-smoke` y las puertas (el brief no permite arrancar servidores ni puertas).

**Hallazgos nuevos de Next (medidos):**
- **Marca «● Asignada» (VIS-02 #11, P3).** A 390 se sale de la celda de 41,7px (`AvailabilityManager.tsx:405-409`). Además falta en el mini calendario y en la leyenda, y desaparece al finalizar la candidatura (v1.8 la mantiene).
- **Foco perdido al cancelar un paso en línea (A11Y-02 #4, P3).** Al cancelar en `RequirementStatusActions.tsx:60` y en `ApplicationActions.tsx:153-158` el foco cae en `body`, y Escape no cierra el paso.
- **Doble `aria-current="page"` (A11Y-01 #7, P3).** El menú y el filtro activo lo llevan a la vez en oportunidades y candidaturas.
- **Detalle inexistente (META-02 #5, P3).** Responde 200 con el título «Oportunidad»/«Necesidad», y la página «No encontrado» no tiene encabezado.
- **Objetivos de menos de 44px que quedan (A11Y-05 #11, P3).** La marca de auth (36px), los títulos de la tabla de necesidades en tableta, los de las tarjetas de oportunidad (41px) y los del feed del inicio (37px).
- **Nota «La necesidad está cubierta.» en ámbar (SHOT-11 #4, P3).** Sale así también cuando la asignación confirmada es la tuya.

**Confirmado en ejecución:**
- X-01: portada legible.
- X-03: menú lateral desplazable, sin anillos recortados.
- X-05: «48,78%».
- X-09: 44px en el pie, las casillas, el ES/EN y los enlaces de auth y herramientas.
- X-10: nota de privacidad a 4,82.
- X-11: 404 con título neutro.
- X-18: «Octubre de 2026».
- 27 `<title>` en ES y EN.
- Anunciador de rutas en 7 de 7 navegaciones con `next start`.
- 911 enfocables con anillo doble.
- 0 animaciones con `reduce`.
- `scrollWidth` 390 en 54 cargas.
- 0 cadenas de interfaz en inglés en 98 cargas en ES.
- 0 textos bajo 4,5:1 en las páginas nuevas.

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| VIS-02 #11 | símbolo, sev., bloqueo y las dos columnas | `−` P2 D-06 «no existe» | `≠` P3 —: marca «● Asignada» en el editable; falta en el mini, se sale a 390; conectado medido | `VIS-02-11-next-*.jpg`, `VIS-02-11-v18c-*.jpg`, `raw/assigned.txt` |
| VIS-03 #13 | símbolo y sev. | `=` P3 (minúscula en los dos) | `+` — (X-18, `53c8633`) | `raw/contrast-alpha.json` |
| VIS-07 #7 | símbolo, sev. y bloqueo | `−` P1 D-06 | `≈` — (maletín y portapapeles, `db05af1`) | `SHOT-10-1-next-1440.jpg`, `raw/v18c-facts.txt` |
| META-02 #4 | símbolo y sev. | `≈` P3 (anunciador mudo en `next dev`) | `+` —: 7 de 7 con `next start` | `raw/announcer.txt` |
| A11Y-05 #2, #5, #10, #12 | símbolo y sev. | `≈`/`+` P3 | `=`/`+` — (X-09, `5d85caa`) | `raw/touch-*.json`, `raw/misc.txt` |
| A11Y-06 #17 | símbolo y sev. | `≠` P3, 3,96 | `=` —, 4,82 (X-10, `cac7461`) | `raw/contrast-alpha.json` |
| A11Y-06 #19 | sev. y Next | P1, blanco sobre blanco | — 16,3:1 y borde 3,71 (X-01) | `A11Y-06-19-next-1440.jpg`, `raw/misc.txt` |
| I18N-01 #9 | símbolo y sev. | `≠` P3 «48.78%» | `≈` — «48,78%» (X-05, `f740447`) | `raw/contrast-mgr.json` |
| SHOT-01 #6 | sev., bloqueo y Next | P1 D-06/D-07 | P2 default v1.8: ya hay feed, candidaturas y contadores; faltan hero, medallas y tarifa | `SHOT-01-9-next-1440.jpg` |
| SHOT-05 #3 | símbolo, sev. y Next | `≠` P2 | `≈` P3: «Candidaturas en curso» y «Asignaciones confirmadas» | `SHOT-05-7-next-1440.jpg` |
| A11Y-02 #4 | sev. y medida | `≈` — (solo código) | `≈` P3: el foco cae en `body` al cancelar; Escape no cierra | `A11Y-04-7-next-1440.jpg`, `A11Y-02-4-next-1440.jpg`, `raw/kbd-*.txt` |
| 29 filas (27 existentes y 2 nuevas) | bloqueo → «— (v2: default v1.8)» | C-12, C-10/OD-7, D-07/D-10/OD-3, D-12, C-9/D-08 | default técnico v1.8, reversible (dock, marca, pie, hero, medallas, directorio…) | V2_BRIEF, alcance del owner |
| 12 filas | bloqueo → «(v2: desbloqueado)» | D-06, SCOPE (LATER), D-11 | portables (asignado, puntos, avisos, logbook, reto, tarifas, logística, Candidate Pack) | `V1_SCOPE.md` LATER |
| VIS-06 #4, #5 | acción | «no portar» (AB-29) | «portar» (copiar todo) | — |
| 24 filas nuevas | filas | — | META-02 #5, A11Y-01 #7, A11Y-04 #8-#9, A11Y-05 #13, A11Y-06 #20, SHOT-01 #9, SHOT-05 #7, SHOT-10 #1-#9, SHOT-11 #1-#7 | ver cada fila |
| VIS-09 #8, A11Y-02 #4, A11Y-04 #7 | cita | `CloseRequirement.tsx` (borrado) | `RequirementStatusActions.tsx:48-82` | SNAP |
| SHOT-01 #2 | cita errónea | `IdentityCard.tsx:216-233` (el fichero tiene 39 líneas) | `src/app/app/professional/page.tsx:218-235` | SNAP |
| VIS-01 #1, #19; VIS-03 #4, #6; I18N-01 #2; I18N-04 #1 | recuentos | 93/48/31/18; 57 hex; 114/56; 11px ×8; 856 claves; 13 ICU | 113/59/39/27; 59 hex; 139/51; 11px ×9; 1 020 claves; 17 ICU | `grep` en el SNAP |
| I18N-02 | tabla entera | 11,7 % (214 + 31), 43 ficheros vivos | 14,1 % (260 + 37), 58 ficheros con el reparto de `string-coverage-v2.md` | `textos/string-coverage-v2.md` |
| META-03 #6 | medida | sin medir | CSP report-only, `X-Frame-Options`, `nosniff`, `Referrer-Policy` medidos en los dos lados | `curl -I` |
| VIS-06 #4, #7, #11, #14, #15; VIS-07 #5, #7, #12, #20, #21; VIS-08 #7; A11Y-01 #2; A11Y-02 #1; I18N-03 #4; SHOT-08 | lado v1.8 conectado | solo código y capturas del 21/10 | medido en ejecución | `raw/v18c-facts.txt`, `raw/contrast-v18c-*.json`, `SHOT-08-1-v18c-*.jpg` |
| 101 citas | línea | líneas de `snapshot-1116` | líneas del SNAP | `work/50/remap.py`, `apply_remap.py` |
| Backlog | reescrito | 18 tareas (9 HECHO + 9 pendientes) | lista portable con el alcance nuevo | ver el final |


Auditoría «diff exhaustivo» CrewFlex v1.8 (HTML prototipo) ↔ app Next.js `~/pau/Crew_Flex` (solo lectura).
- Next actual: rama `feat/v18-html-parity` @ `5c2d1a2` **más el árbol de trabajo sin commit** (decisión D-13, «Ver como»), revisado el 22/10/2026 hasta las 11:00. El árbol cambiaba durante la revisión (`AppShell.tsx`, `ViewSwitcher.tsx` y `views.ts` se reescribieron a las 10:50-10:51); las filas de D-13 describen esa última versión. Base del informe anterior: `main` @ `51c835a` (21/10/2026).
- v1.8: sin cambios (sha256 del zip re-verificado el 22/10/2026); las columnas v1.8 se mantienen salvo error evidente (ver «Cambios»).
- Formato: `_FORMAT.md`.

**Fuentes.**
- v1.8 estático: `out/parts/A-css-meta.md`, comprobado contra `v18-pkg/dist/assets/index-CaNXyzVh.css` (92 512 B; las 8 hojas «vivas» ocupan los bytes 0–75 157 y `index.css` del 75 157 al final) y `v18-pkg/src/styles/*.css`.
- v1.8 runtime: `out/v18-runtime-demo.md` §1 y §2.M; `out/v18-runtime-connected.md` §1.
- Next: `out/next-static.md` §2, §6, §7 y §8 (estado de `51c835a`), re-verificado el 22/10 en el código actual (`src/app/globals.css`, `src/app/layout.tsx`, `src/app/icon.svg`, `src/components/**`, `src/features/**`, `tests/design/*.test.ts`, `tests/i18n/titles.test.ts`), `docs/product/DESIGN_SYSTEM.md` y `docs/integration/crewflex-v13/13-visual-comparison.md`. Las afirmaciones «VERIFIED» de `16-html-v18-diff.md` se han comprobado en el código, no se han copiado.
- Textos: `textos/string-diff.json` y `textos/string-coverage.md` (21/10); diff de cadenas re-ejecutado el 22/10 sobre el `messages/es.json` actual (856 claves).
- Contrastes: recalculados con la fórmula WCAG 2.x a partir de los tokens de `src/app/globals.css` actuales.

**Rutas.**
- v1.8: relativas a `v18-pkg/`.
- Next: relativas a `~/pau/Crew_Flex`; `es:N` = `messages/es.json:N`.
- Capturas v1.8: `evidencias/shots/demo/…` y `evidencias/shots/connected/…` (2026-10-21).
- v2: capturas nuevas en `evidencias/v2/50/` (`<SECCION>-<n>-{next,v18,v18c}-<ancho>.jpg`) y medidas en `evidencias/v2/50/raw/`; las rutas `evidencias/xhigh/50/…` son de la xhigh (en la entrega xhigh). Scripts en `herramientas/v2/50/`.
- Capturas Next:
  - `docs/audit/evidence/v18-compare/next-after/*.jpg` son del **lote 11** (commit `14bd7c4`, 2026-10-20 11:23). Son **anteriores a los lotes 13-19**: no tienen iconos de navegación, las cabeceras de tabla y los chips salen aún en MAYÚSCULAS y, además, están **en inglés** (el navegador de captura envió `Accept-Language: en` y el defecto es `en`).
  - Cuando lo indico uso tres capturas posteriores: `local-19-matches-es-*.jpg` y `local-21-login-es.jpg` (lote 13, `108a244`) y `local-23-overview-nav-390.jpg` (lote 14, `67fd62f`).
  - **22/10: no se han tomado capturas nuevas de Next.** Todas las citadas siguen siendo las de los lotes 11, 13 y 14, anteriores a `51c835a`. Cuando el código actual cambia lo que muestran, la fila lo dice y cita `archivo:línea`; la captura queda como referencia histórica.
  - **xhigh (22/10, tarde):** sí hay capturas nuevas de Next y de v1.8 en `evidencias/xhigh/50/` (ES, 1440 y 390, código vivo = copia de las 11:16). Las líneas «Capturas:» las citan al final, tras «xhigh:».

**Cómo leer la columna Bloqueo.**
- v2 (owner, 22/10): el alcance es NOW + NEXT + LATER de `V1_SCOPE.md`. Una decisión abierta (C-12, C-10, C-9/D-08, D-12 de empresa, OD-7 salvo dinero real…) se marca «— (v2: default v1.8)»: se porta el comportamiento de v1.8 como default técnico reversible. LATER se marca «(v2: desbloqueado)». Siguen bloqueados OUT, D-07 P3 + D-10 (documentos de terceros), OD-3 en producción, D-11 (combustible) y lo DEMO-ONLY o inseguro (`✗`). Las definiciones de abajo son las de la xhigh.
- C-12: identidad de marca y dock (`14-decision-pack.md:42`).
- D-06: máquina de candidaturas (oportunidades, candidaturas, asignaciones y avisos dependen de ella).
- D-07/D-10/OD-3: hero con avatar y medallas (`13-visual-comparison.md:21`).
- C-5: bilingüe con defecto `en` (decidido).
- SCOPE: fuera de `docs/product/V1_SCOPE.md` NOW.
- DEMO-ONLY: no se porta (`13-visual-comparison.md:47`).

## Verificación exhaustiva (xhigh, 22/10/2026)

**Método.** Cada fila se ha contrastado en el código de los dos lados: Next en la copia congelada `snapshot-1116` (todas las citas `archivo:línea` y `es:N` releídas con un script, `work/50/refs.py`) y v1.8 en `src/` y en el CSS real de `dist/` (`index-CaNXyzVh.css`, regla a regla y con la cascada). Después se ha medido en ejecución con Playwright (Chromium 1248), sin enviar nada que escriba: un guardián aborta cualquier petición que no sea GET salvo el inicio de sesión. Contraste con `getComputedStyle` (fondos compuestos, opacidad y `::placeholder`) en todos los textos visibles y el anillo de cada elemento enfocable; objetivos táctiles con `hasTouch: true` (`pointer: coarse` comprobado = true) a 390×844 y 1024×768; recorridos con Tab, flechas y Escape; `<title>`, `<html lang>` y favicon en ES y EN; `prefers-reduced-motion: reduce` emulado; `scrollWidth` a 390; barrido de palabras del catálogo inglés en la UI en español. Cuentas: alpha, manager.mro y platform.admin (ES); admin.mro y delta (idioma guardado en inglés) y platform.admin con la cookie `en` (EN). Medidas en bruto: `evidencias/xhigh/50/raw/`; capturas: `evidencias/xhigh/50/`.

**Cobertura.** 282 filas de elementos (274 + 8 nuevas):
- En código, los dos lados: 282 de 282. En el lado v1.8, las filas que solo describen el modo conectado se han comprobado en `src/beta/*` y en las capturas del 21/10.
- En Next en ejecución: unas 196, en todas las secciones. Más tocadas: A11Y-05 (11 de 12), A11Y-06 (15 de 19), META-02 (4 de 4), SHOT-01…09 (49 de 51) e I18N-05 (8 de 10).
- En v1.8 en ejecución (modo demo): unas 143.
- El recuento por fila es aproximado: una fila cuenta como medida cuando su afirmación se ha comparado con una medida o una captura de hoy.

**No verificado y por qué:**
- **Modo conectado de v1.8 (no está levantado):** la parte conectada de VIS-06 #4, #14 y #15, VIS-07 #5, #20 y #21, VIS-08 #7, A11Y-01 #2, A11Y-03 #2 y la columna v1.8 de SHOT-08. Se apoyan en el código y en las capturas del 21/10.
- **Estados que piden escribir en Next:** el `Notice` tras guardar y «Guardando…» (A11Y-03 #2-#4, VIS-06 #16), el foco de `ConfirmButton` (A11Y-04 #7, A11Y-02 #4 en su parte de Next) y «Quitar comparación» (A11Y-05 #7). Quedan solo verificados en código.
- **Fuera del alcance de la medición:**
  - VIS-05 #5: impresión, sin emular.
  - VIS-03 #12: el zoom de iOS.
  - META-03 #6: CSP.
  - I18N-01 #3 y #5: idioma por defecto sin cookie y zona horaria.
  - META-02 #4: el anunciador de rutas en un `next build`; solo se ha medido en `next dev`.
- **El `ui-smoke` 25** no se ha ejecutado: el brief no permite arrancar servidores ni puertas.
- **La necesidad del brief `9f50725f-…`** ya no existe en la BD local: sale «No encontrado», aunque el `<title>` sigue siendo «Necesidad». Se ha usado la abierta actual de Demo MRO, `9e280aa3-8b30-4704-93fb-ee6e297cf6a4`.

**Hallazgos nuevos de Next (medidos):**
- **Portada (A11Y-06 #19, P1).** El botón «Iniciar sesión» sale blanco sobre blanco (1:1) y el ES/EN muestra el estado al revés.
- **Nota de privacidad de herramientas (A11Y-06 #17).** 3,96:1, y no está «heredada»: en v1.8 se ve a 4,82:1.
- **Objetivos de menos de 44px con puntero grueso (A11Y-05 #5, #10-#12).** Casillas con etiqueta de 20-41px, enlaces sueltos de 16-24px y el ES/EN de 33px de ancho.
- **Anunciador de rutas mudo en 4 de 5 navegaciones (META-02 #4).**
- **Mes en minúscula en el calendario editable (VIS-03 #13).**
- **Porcentajes con punto decimal en la UI en español (I18N-01 #9).** Por ejemplo, «48.78%» en matching.

**Confirmado en ejecución:**
- Anillo doble en los 390 enfocables de 21 páginas, sin recortes.
- Radiogroups con una sola parada de Tab y flechas.
- Salto «Saltar al contenido» correcto.
- 23 `<title>` y `lang` correctos en ES y EN.
- Ninguna animación con `reduce`.
- Ningún desborde a 390.
- Ningún texto de interfaz en inglés en ES.

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| VIS-01 #7 | línea del doc y medida | `DESIGN_SYSTEM.md:19` | `:20`; muted medido 5,18 / 4,83 | `raw/contrast-padmin.json` |
| VIS-01 #17 | línea del doc | `DESIGN_SYSTEM.md:39-44` | `:41-44` | `snapshot-1116/docs/product/DESIGN_SYSTEM.md` |
| VIS-02 #4 | línea del doc | `DESIGN_SYSTEM.md:39-41` | `:41-44` | ídem |
| VIS-02 #8 | literal v1.8 (descanso) | `#8998a6/#f5f7f9` 2,75:1 | celda `#758892/#f5f6f8` 3,41 (`.availability-v17` anula la regla base en los dos calendarios), chip 4,22, mini 3,67 | `raw/contrast-v18.json`; CSS de `dist` |
| VIS-03 #13 | fila nueva | — | `=` P3: «octubre de 2026» en minúscula en el calendario editable de los dos lados; el mini de Next lo capitaliza | `SHOT-02-next-1440.jpg`, `raw/contrast-v18.json` |
| VIS-05 #4 | medida | — | 0 animaciones con `reduce` en 24 rutas; esqueleto `none` con `reduce`; v1.8 sigue `smooth` | `raw/crawl-rm-*.json`, `raw/misc.txt`, `raw/v18crawl-w1440r.json` |
| VIS-06 #17 | medida | — | `scrollWidth` 390 en 24 rutas de Next y 19 pantallas de v1.8 | `raw/crawl-es390-*.json`, `raw/v18crawl-w390.json` |
| VIS-06 #18 | literal v1.8 | «Probar como» oculto por CSS; `max-width:130px` a ≤760 | visible por encima de 1200px (oculto a ≤1200, ≤600 y en vista móvil); `max-width:130px` a ≤980 | `raw/contrast-v18.json`, `v11.css:5-6` |
| VIS-08 #7 | acción | — | remite a A11Y-06 #19 (portada) | `A11Y-06-landing-boton-invisible-next-1440.jpg` |
| META-01 #1 | medida | — | `lang` correcto; la preferencia guardada gana a la cookie | `raw/crawl-en-adminmro.json` |
| META-02 #2 | medida | — | 23 títulos en ES y EN; portada «Crew Flex»; favicon en todas | `raw/crawl-es-*.json`, `raw/crawl-en-*.json` |
| META-02 #4 | símbolo y sev. | `+` — | `≈` P3: anunciador vacío en 4 de 5 navegaciones (`next dev`) | `raw/announcer.txt` |
| A11Y-01 #2, #3 | medida | — | salto v1.8 → `#home`; salto Next → `#main` y Tab al `main`; sin salto en `/login` | `raw/kbd-pro.txt`, `raw/kbd-v18.txt`, `A11Y-01-skip-next-1440.jpg` |
| A11Y-02 #1 | medida de los dos lados | — | Next: 390 enfocables con anillo doble, 0 recortes; v1.8: 2,90 sobre la banda verde, 3,00 sobre `.demo-banner` y 119 anillos recortados por `overflow` | `raw/contrast-*.json` |
| A11Y-02 #3 | literal v1.8 | «dock y medallas `#e59135`» | solo el dock (2,49); medallas y mini-días salen teal (gana `.v11-shell :focus-visible`) | `raw/v18focus.txt`, `A11Y-02-3-dock-foco-v18-390.jpg` |
| A11Y-02 #4, #5 | medida | — | modal v1.8: foco en la X, `#e88b26` 2,58, Escape devuelve el foco; drawer v1.8 sin `aria-expanded` y sin Escape; «Menú» de Next como se describe | `raw/v18focus.txt`, `raw/kbd-viewas.txt`, `raw/kbd-v18.txt` |
| A11Y-02 #7 | fila nueva | — | `=` P3: la 4.ª parada de `input type=date` sin indicador en los dos lados | `A11Y-02-date-stop3-next-1440.jpg`, `A11Y-02-date-stop3-v18-1440.jpg` |
| A11Y-04 #1 | medida | — | ES/EN y visibilidad: una parada, flechas, Inicio/Fin; v1.8 sin flechas | `raw/kbd-login.txt`, `raw/kbd-pro.txt` |
| A11Y-04 #6 | precisión | `aria-current="date"` en hoy | solo en el mini calendario | `AvailabilityMonth.tsx:72` |
| A11Y-05 (estado) | texto | «queda corto el Cerrar sesión del pie» | lista medida de lo que queda por debajo de 44 | `raw/touch-*.json` |
| A11Y-05 #2 | medida | «unos 20px» | 89,2×20 a 1024×768 con `hasTouch` | `raw/touch-padmin1024.json` |
| A11Y-05 #4, #8, #9 | medidas v1.8 y Next | «unos 32px», «unos 40», «unos 34px» | 32×38; 42,3×60-70 frente a 41,7×64; 105×34; «Ver como» ≥44 | `raw/touch-v18-390.json`, `raw/touch-alpha390.json` |
| A11Y-05 #5 | símbolo y sev. | `+` — («casillas con etiqueta de 44») | `≈` P3: las casillas de «Nueva necesidad» miden 21/41px | `raw/touch-mgr390.json` |
| A11Y-05 #10, #11, #12 | filas nuevas | — | casillas con etiqueta (`≈` P3), enlaces sueltos y marca (`≈` P3), ES/EN de 33px de ancho (`+` P3) | `raw/touch-*.json` |
| A11Y-06 (estado) | texto | «Queda uno, heredado tal cual de v1.8» | dos fallos propios de Next (nota de privacidad y portada) | `raw/contrast-*.json` |
| A11Y-06 #9 | literal v1.8 y valor de Next | descanso 2,75; días pasados 2,29-2,41 | descanso 3,41 / 4,22 / 3,67; días pasados 2,40 (sin exención en el mini) | `raw/contrast-v18.json`, `raw/contrast-padmin.json` |
| A11Y-06 #10 | valor | 3,35 | 3,34 (medido a 390) | `raw/contrast-v18-390.json` |
| A11Y-06 #14 | valor v1.8 | «el del navegador» | `#757575` sobre `#fafcfe` → 4,48 | `raw/contrast-v18.json` |
| A11Y-06 #15 | medida | — | v1.8: 4,86 sobre navy, 2,90 y 3,00 sobre bandas; Next: todo medido | `raw/contrast-*.json` |
| A11Y-06 #17 | símbolo y literal v1.8 | `=` P3, «3,96 en los dos lados» | `≠` P3: v1.8 `#587083` 4,82 (`.toolbox p` pisa el teal); Next 3,96 | `raw/contrast-v18.json`, `raw/contrast-padmin.json` |
| A11Y-06 #18 | símbolo y literal v1.8 | `=`; «Probar como» oculto | `+`: «Probar como» visible a 1440 con 3,56:1; «VER COMO» 6,77 | `raw/contrast-v18.json` |
| A11Y-06 #19 | fila nueva | — | `+` P1: «Iniciar sesión» de la portada a 1:1 y estado del ES/EN invertido | `A11Y-06-landing-boton-invisible-next-1440.jpg`, `-390.jpg`, `raw/misc.txt` |
| I18N-01 #9 | fila nueva | — | `≠` P3: «48.78%» en ES (argumento ICU simple impreso con `String()`) | `SHOT-06-next-1440.jpg`, `intl-messageformat@11.2.15/index.js:78-79` |
| I18N-02 fila 31 y Σ | recuento | 18; Σ 2 100 / 1 855 | 19; Σ 2 101 / 1 856 («Enter», solo en código muerto) | `raw/string-diff-snapshot.json` |
| I18N-03 #10 | literal v1.8 | «Probar como» (oculto por CSS) | visible solo por encima de 1200px | CSS de `dist` |
| I18N-05 (estado) | barrido | — | 0 cadenas de interfaz en inglés en las 24 rutas en ES (65 cargas) | `raw/crawl-es*.json` (`leaks`) |
| I18N-05 #9 | añadido | — | «Type ratings» (es:433), inglés por glosario | `SHOT-07-next-1440.jpg` |
| I18N-05 #10 | fila nueva | — | `=`: nombres del catálogo de cualificaciones en inglés en los dos lados | `raw/crawl-es-*.json` |
| SHOT-02 #3 | literal de Next | «Preview the cycle in this month» (lote 11) | «Previsualizar ciclo en el mes» | `SHOT-02-next-1440.jpg` |
| SHOT-05 #2 | estado de los datos | — | con 0 necesidades abiertas no se muestra el panel de capacidad | `SHOT-05-next-1440.jpg` |
| Capturas de 21 secciones | evidencias | lotes 11, 13 y 14 | más capturas y medidas de hoy (`evidencias/xhigh/50/`) | — |

Recuento (script sobre las tablas de elementos, sin la tabla de cambios ni la de cobertura I18N-02):
- **Esta mañana:** 274 · = 55 · ≈ 77 · ≠ 51 · − 32 · + 40 · ✗ 19.
- **xhigh:** 282 · = 56 · ≈ 81 · ≠ 53 · − 32 · + 41 · ✗ 19.
- **Cambios:** cambian de símbolo 4 filas (A11Y-05 #5, A11Y-06 #17, A11Y-06 #18 y META-02 #4) y hay 8 nuevas.
- **Severidades:** P1 3 · P2 30 · P3 71 · sin severidad 178. Esta mañana: P1 2 · P2 30 · P3 63 · sin severidad 179.

## Cambios desde el 21/10/2026

Origen: commit de `51c835a..5c2d1a2` (tarea W de `16-html-v18-diff.md`) o «árbol de trabajo» (D-13, sin commit). Las capturas de Next **no** se han rehecho: las filas que cambian lo hacen por el código, no por capturas nuevas.

| Fila | Elemento | Antes | Ahora | Origen (commit o «árbol de trabajo») |
|---|---|---|---|---|
| VIS-01 #1 | Mecanismo de tokens | ≠ P3; usos `muted` 86, `line` 47, `danger` 31, `navy` 17 | ≠ P3; 93 / 48 / 31 / 18 | varios W1-W5 + árbol de trabajo |
| VIS-01 #19 | Colores literales | ≈; 51 hex en 8 ficheros | ≈; 57 hex (mismos 32 distintos) en 9 ficheros | `d12164a` + árbol de trabajo (`ViewSwitcher.tsx`) |
| VIS-01 #20 | Degradados | − P2; sin avatar | − P2; avatar de iniciales navy liso, sin degradado | `1764e8e` (W2-01) |
| VIS-02 #2 | Títulos de sección del menú | ≠ P3 | ≠ P3; + etiqueta «VER COMO» y menú filtrado por vista para admins | árbol de trabajo |
| VIS-03 #4 | Cuerpo | ≈; `text-sm` 107, `text-xs` 44 | ≈; 114 / 56 | varios |
| VIS-03 #6 | Tamaño mínimo | ≈ P3; 10px ×3 + 11px ×11; corregir `DESIGN_SYSTEM.md:46` | ≈ P3; mínimo 11px (×8); el doc nombra 3 de 6 usos | `9483667` (W3-09), `c0673ba` (W4-01), árbol de trabajo |
| VIS-04 #5 | Sombras | − P3; ninguna | − P3; solo el `box-shadow` del anillo de foco | `674b8b5` (W3-01) |
| VIS-05 #1 | `@keyframes` | +; `animate-pulse` | +; `motion-safe:animate-pulse` | `6ac67d2` (W3-06) |
| VIS-05 #4 | `prefers-reduced-motion` | ≈ P3 | + | `6ac67d2` (W3-06) |
| VIS-06 #2 | Cuándo se oculta el sidebar | ≠ P3; corregir `DESIGN_SYSTEM.md:71-74` | ≠ P3; doc ya corregido (`:78-83`) | `c0673ba` (W4-01) |
| VIS-06 #6 | Selector de rol / «Vista móvil» | ✗ DEMO-ONLY | ≠ (selector «Ver como» para admins; «Vista móvil» sigue sin portar) | árbol de trabajo |
| VIS-06 #15 | Pie del sidebar | ≈; nombre + «Cerrar sesión» | ≈; + tipo de cuenta y rol | `d12164a` (W2-06) |
| VIS-06 #17 | Desbordes a 390 | ✗ | ✗; el titular de v1.8 se porta sin su fallo «Tu tiempo.Tu» | `1764e8e` (W2-01) |
| VIS-06 #18 | Selector «Probar como» ↔ «Ver como» | (no existía) | ≈ (nueva) | árbol de trabajo |
| VIS-07 #12 | Icono de Admin | ≠ | ≠; + vista «Administración» sin icono | árbol de trabajo |
| VIS-07 #23 | Iconos fuera del menú | ≈ P3 | ≈ P3; cita también el «○» del inicio (ya existía en `51c835a`) | precisión |
| VIS-08 #4 | Favicon | ≠ P3; colores fuera de paleta (NX-06) | ≈ P3 (C-12); colores de marca, figura y fondo invertidos frente a v1.8 | `b9cd6e1` (W3-02) |
| VIS-09 #8 | Modal | − P3 | − P3; + `ConfirmButton` en línea | `73de8ff` (W1-10) |
| VIS-09 #11 | Cabecera de tabla | +; corregir `DESIGN_SYSTEM.md:55` | +; doc corregido (`:60`) | `c0673ba` (W4-01) |
| META-02 (encabezado) | Número de páginas | «20 páginas» (error: eran 21) | 23 páginas | árbol de trabajo (+2) y corrección |
| META-02 #2 | Títulos por ruta | +; 21 títulos | +; 23 títulos con los nombres del menú | `fd01c52` (W3-07) + árbol de trabajo |
| META-02 #3 | Coherencia título ↔ menú | ≠ P3 | + | `fd01c52` (W3-07) |
| A11Y-01 #4 | Landmarks | ≈ | ≈; + `nav` «Ver como» | árbol de trabajo |
| A11Y-01 #6 | Enlace activo | = | =; + `aria-current` en «Ver como» | árbol de trabajo |
| A11Y-02 #1 | Anillo del shell | ≠ P2; 2,15 / 2,00:1 | +; navy 16,30 / 15,19 + naranja 7,59 | `674b8b5` (W3-01) |
| A11Y-02 #4 | Foco inicial | ≈ | ≈; + foco en «Cancelar» de `ConfirmButton` | `73de8ff` (W1-10) |
| A11Y-03 #2 | Resultado de acción | ≈ | ≈; nunca muestra el mensaje bruto del servidor | `135085c` (W1-04) |
| A11Y-03 #5 | Regiones vivas | ≈ | ≈; + «Se lee como {valor}» en herramientas | `14dfaf0` (W1-06) |
| A11Y-03 #6 | Carga | +; «ver VIS-05 #4» | +; `motion-safe:` | `6ac67d2` (W3-06) |
| A11Y-04 #1 | Opciones exclusivas | ≈ P3 (NX-09) | + | `e37e95c` (W3-05) |
| A11Y-04 #5 | Nombres inválidos | + | +; + avatar `aria-hidden` en `section` etiquetada | `1764e8e` (W2-01) |
| A11Y-04 #6 | Calendario | ≈ | ≈; + días pasados `disabled` | `bfbe531` (W1-03) |
| A11Y-04 #7 | Destructivo | ≈ P3 | ≈ —; confirmación en las cuatro acciones | `73de8ff` (W1-10) |
| A11Y-05 #2 | Menú | = | ≈ P3; el «Cerrar sesión» del pie (`lg+`) no llega a 44px con puntero grueso | omisión del 21/10 (anterior a `51c835a`) |
| A11Y-05 #3 | Navegación del mes | ≠ P3; 36px | ≈; 36 / 44 con puntero grueso | `7255055` (W3-04) |
| A11Y-05 #4 | Favorito | ≈ P3; 40px | +; 40 / 44 | `7255055` (W3-04) |
| A11Y-05 #7 | Botones de texto | ≈ P3 | + | `7255055` (W3-04) |
| A11Y-05 #9 | Selector de espacio | (no existía) | + (nueva) | árbol de trabajo |
| A11Y-06 #9 | Calendario | + P3 | + P3; + días pasados del calendario editable | `bfbe531` (W1-03) |
| A11Y-06 #12 | Kickers de herramientas | =; 10px | =; 12px | `9483667` (W3-09) |
| A11Y-06 #13 | Nota de herramientas | − P3; v1.8 «—» (error) | + ; v1.8 corregido: `.tb-footnote` 11px 3,88 | `ac28483` (W3-03) + corrección |
| A11Y-06 #14 | Placeholder | − P3; 2,87 | +; 5,18 | `ac28483` (W3-03) |
| A11Y-06 #15 | Anillo de foco | ≠ P2 | + | `674b8b5` (W3-01) |
| A11Y-06 #16 | Favicon | =; 8,31 | =; 7,59 con los tokens de marca | `b9cd6e1` (W3-02) |
| A11Y-06 #17 | Nota de privacidad de herramientas | (no comparada) | = P3; 3,96 en los dos lados | anterior a `51c835a` |
| A11Y-06 #18 | Contraste del selector | (no existía) | = (nueva) | árbol de trabajo |
| I18N-01 #2 | Idiomas | +; 802 claves | +; 856 claves | varios + árbol de trabajo |
| I18N-01 #7 | Validación | + | +; las acciones devuelven claves | `135085c` (W1-04) |
| I18N-02 #3, 4, 5, 8, 9, 12, 21, 23, 25, 28, 29, 36 y Σ | Cobertura por fichero | 199 exactas + 28 aproximadas (10,8 %) | 214 + 31 (11,7 %); Next 856 claves, 569 sin contrapartida | W2-01…W2-09, W5-01 + árbol de trabajo (D-13) |
| I18N-03 #3 | `nav` | ≈ | ≈; + `nav` «Ver como» | árbol de trabajo |
| I18N-03 #7 | Rol en el sidebar | ≈ | ≈; + tipo de cuenta/rol y vistas «Técnico/Empresa/Recruiter/Administración» | `d12164a` + árbol de trabajo |
| I18N-03 #9 | Error genérico | ≠ | ≠; + página de error raíz traducida | `d275254` (W1-01) |
| I18N-03 #10 | Textos del selector | (no existía) | ≈ P3 (nueva) | árbol de trabajo |
| I18N-04 #1 | Mecanismo de plurales | +; 10 ICU | +; 13 ICU | `c6d380b`, `1764e8e`, `ad03283` |
| I18N-04 #2 | Sin plural | ✗ | ✗; Next pluraliza ya «N apartados por completar» | `c6d380b` (W2-02) |
| I18N-04 #3 | Contadores | = | =; + paginación de necesidades | `ad03283` (W5-02) |
| I18N-05 #1 | «Check the highlighted fields.» | − P3 | = | `135085c` (W1-04) |
| I18N-05 #2 | «Invalid window.» | − P3 | = | `135085c` (W1-04) |
| I18N-05 #3 | «Invalid qualification.» | − P3 | = | `135085c` (W1-04) |
| I18N-05 #4 | «This service is not available.» | − P3 | = (el literal queda como mensaje interno, no llega a la UI) | `135085c` (W1-04) |
| I18N-05 #5 | Placeholder «Madrid (MAD)» | ≈ P3 | = | `135085c` (W1-04) |
| I18N-05 #6 | Otros literales | ≈ | ≈; «1:30»/«1,5» salen del catálogo | `69210ac` (W3-08) |
| I18N-05 #9 | Inglés técnico | ≈ | ≈; «Wallet documental» solo como H1 | `fd01c52` (W3-07) |
| SHOT-01 #1, #2, #5, #6 | Inicio técnico | ≠ / ≠ P2 / ≈ P2 / − P1 | mismos símbolos; la columna Next describe el código actual (titular, tarjeta de identidad, barra de progreso, 44px) | `1764e8e`, `c6d380b`, `7255055` |
| SHOT-02 #1 | Cabecera de disponibilidad | ≈ P3 | ≈ P3; título igual que v1.8 | `c188801` (W2-09) |
| SHOT-05 #1, #3 | Inicio empresa | ≈ / ≠ P2 | mismos símbolos; descripción igual que v1.8 y KPI «Necesidades abiertas» | `07eb07a` (W2-03), `d82450e` (W2-04) |
| SHOT-06 #5 | Bug visual de Next | − P2 | = | `9a99f89` (W1-02) |
| Solo `archivo:línea` | VIS-02 #1, #5, #14; VIS-03 #9; VIS-04 #8; VIS-05 #2; VIS-06 #9, #13, #16; VIS-07 #2, #5; VIS-08 #1, #2, #3; META-01 #4; A11Y-01 #1; A11Y-05 #8; I18N-01 #4; I18N-03 #2, #6; I18N-05 #7 | — | — | líneas movidas por los commits y el árbol de trabajo |
| Backlog derivado | Tareas 1-10 | pendientes | 1-9 HECHO; 10 HECHO salvo (c); nuevas 11-13 PENDIENTE | ver el final |

Recuento del refresco de la mañana (script sobre las tablas de elementos, sin esta tabla ni la de cobertura I18N-02; el recuento xhigh, 282 filas, está en «Verificación exhaustiva»): 274 filas (269 + 5 nuevas) · = 55 (+7) · ≈ 77 (±0) · ≠ 51 (−4) · − 32 (−7) · + 40 (+10) · ✗ 19 (−1). Cambian de símbolo 19 filas; 5 son nuevas. Se reescriben además las líneas «Estado global» de VIS-05, VIS-08, A11Y-02, A11Y-04, A11Y-05, A11Y-06, I18N-02, I18N-05, SHOT-01 y SHOT-06.

---

## VIS-01 · Tokens de color (token a token) — v1.8 `index.css:5-46`, `v11.css:2`, literales vivos ↔ Next `globals.css:4-40`

**Estado global:** PARCIAL. Next ha convertido en tokens los colores que v1.8 pinta como literales (no los tokens que v1.8 declara). La paleta visible coincide casi al 100 %, con dos excepciones: el gris secundario, oscurecido para el contraste, y los colores que no se llegan a pintar.

| # | Elemento | v1.8 (valor efectivo tras la cascada / uso real) | Next (`archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Mecanismo | 35 custom properties en `:root` de `index.css:5-46`, que gana a los 16 homónimos de `v11.css:2` porque `index.css` es la **última** hoja del bundle (`main.jsx:3-4`). En las 8 hojas vivas (bytes 0–75 157 del CSS de dist) hay **0** `var(--…)`: solo `body` consume tokens (`--font-main`, `--navy-dark`, `--ink`; `index.css:58-64`). La UI pinta **literales** | Tailwind v4 `@theme` con 27 colores + `--font-sans` (`globals.css:4-35`), **todos usados** como utilidades (v2, `821c24f`: `muted` 113, `line` 59, `danger` 39, `navy` 27 usos en TSX; el mismo recuento da 93/48/38/20 en la copia xhigh; 21/10: 86/47/31/17); utilidad `bg-partial` (`:38-40`) | ≠ | P3 | — | mantener (mejora en Next) |
| 2 | Navy de marca | token efectivo `--navy #07182f` (sin consumo); `v11` `#0c2137` (pisado); **literal pintado `#0c2137`** en `.sidebar`, `.brand-symbol`, `.saving-indicator`, favicon y fondos `#0c2137aa`/`#0c213799` | `--color-navy: #0c2137` (`globals.css:5`) | = | — | — | — |
| 3 | Navy activo | literal `#203b54` (`.sidebar button.active`, `v11.css:3`) | `--color-navy-700: #203b54` (`:6`) | = | — | — | — |
| 4 | Fondo del documento | `--navy-dark #050d1a` en `body` (`index.css:60`); se ve fuera de `.v11-shell` (>1920 px y en la vista móvil simulada, `evidencias/shots/demo/D-GEN-03-vista-movil-preview-1440.png`) | `html{background:var(--color-canvas)}` (`globals.css:43-46`) | ✗ | P3 | — | no portar (efecto colateral de la cascada) |
| 5 | Canvas | `--app-bg #f4f7fb` (sin uso); literal `.v11-shell{background:#f5f7fa}` | `--color-canvas: #f5f7fa` (`:10`) | = | — | — | — |
| 6 | Tinta | `--ink #142036` (color efectivo de `body`); `v11` `#172c44` pisado | `--color-ink: #172c44` (`:7`) | ≈ | P3 | — | mantener (diferencia imperceptible) |
| 7 | Gris secundario | `--muted #66768d` (sin uso); `v11` `#60758b`. Literales vivos: `#718396` (`.page-title p`, 3,63:1 sobre canvas), `#536b80` (`.secondary`, v12), `#667c90` (`.metric span`, 4,33:1), `#8393a2` (`.metric small`, 3,15:1) | `--color-muted: #5b6f84` único (`:8`; 5,18:1 sobre blanco y 4,83:1 sobre canvas); `DESIGN_SYSTEM.md:20` «darkened from #60758b for contrast»; medido en ejecución: 5,18 sobre blanco y 4,83 sobre canvas | ≈ | P3 | — | mantener (mejora de contraste) |
| 8 | Líneas | `--line #dbe5f1` (sin uso); `v11` `#dce4ed`. Literales `#e3e9ef` (`.panel`), `#dce5ea`×10 (`.tb-*`, `.ops-*`, `.cf-badges`), `#e2e8ef` (`.metric`) | `--color-line: #dce4ed` (`:9`) | ≈ | — | — | — |
| 9 | Acento naranja | `--orange #ff8a1f` efectivo (sin consumo); `v11` `#ff982f`; **literal pintado `#ff982f`** (`.brand-symbol`, `.action.primary`, `.dark-panel .action.primary`) | `--color-accent: #ff982f` (`:11`) | = | — | — | — |
| 10 | Acento hover | `#ffa747` (`.action.primary:hover`) | `--color-accent-hover: #ffa747` (`:12`) | = | — | — | — |
| 11 | Icono activo del menú | `#ffad54` (`.sidebar button.active svg`, `.nav-plus`) | `text-accent` `#ff982f` (`NavLinks.tsx:65`) | ≈ | P3 | — | mantener (un único acento) |
| 12 | Azul enlaces/info | `--blue #18558f` (index = v11) y `a{color:#18558f}` (`v11.css:3`) | `--color-blue: #18558f` (`:13`) | = | — | — | — |
| 13 | Verde de estado | `--green #37d399` efectivo / `v11` `#16836b` (ambos sin uso); literal `.pill.green` `#16745d`/`#e7f5ee` | `--color-ok #16745d` / `--color-ok-bg #e7f5ee` (`:14-15`) | = | — | — | — |
| 14 | Ámbar/naranja de estado | `--amber #ffbd66` (sin uso); literal `.pill.orange` `#aa5916`/`#fff0e1` | `--color-warn` / `-bg` (`:16-17`) | = | — | — | — |
| 15 | Rojo de estado | `--red #ff6b6b` / `v11` `#b83b42` (sin uso); literal `.pill.red` `#ad3b44`/`#fbecee` | `--color-danger` / `-bg` (`:18-19`) | = | — | — | — |
| 16 | Info | `.pill.blue` `#316d9a` sobre `#eaf2fa` | `--color-info-bg #eaf2fa` (`:20`); texto del chip info = `blue #18558f` (`StatusChip.tsx:18`) | ≈ | — | — | — |
| 17 | Familia teal (herramientas) | `.tb-button.primary #057f7d` y unas 20 variantes casi idénticas (`#087f7d`, `#087f7c`, `#07877e`, `#146c6e`…); `.tb-tile-icon #e8f3f1/#12716f`; `.tb-hero #112e40`; `.tb-result #103b49`; CTA del hero `#b5f0dc`/`#153c3d` (`v13.css:1`) | 11 tokens `--color-tool-*` (`globals.css:21-33`), solo bajo `/app/tools` (`DESIGN_SYSTEM.md:41-44`) | = | — | — | — |
| 18 | Tokens sin equivalente | `--sky`, `--sky-light`, `--navy-light`, `--navy-surface`, `--blue-hover`, `--orange-hover`, `--mint`, `--red-dark`, `--purple`, `--bg-gradient`, `--card-dark-bg`, `--shadow-*` (4), `--r-*` (4), `--font-display`: ninguno se usa en la UI viva (A-css-meta 8.1) | — | ✗ | — | — | no portar (CSS muerto) |
| 19 | Colores literales | 654 apariciones y **519 hex distintos** en las hojas vivas del CSS de dist. Los más repetidos: `#fff`×63 (incluye `white` minificado), `#dce5ea`×10 (bordes tb/ops), `#ff982f`×6, `#0c2137`×5, `#edf1f5`×5 (`.opportunity-row`, `.document-row`, `.course-row`, `.privacy-mini`, `.ops-status`), `#dce7ec`×4 | v2: 59 hex en TSX (los mismos 32 distintos) en 9 ficheros; +2 `#587083` en la nota de privacidad de herramientas (X-10, `ToolsHome.tsx:160-161`, uno en un comentario) (xhigh: 57; 21/10: 51 en 8): sidebar/landing `#c4d3e1`×6 (`AppShell.tsx:76,102,127`, `NavLinks.tsx:59`, `src/app/page.tsx:10`, `ViewSwitcher.tsx:68`) y `#91aac1`×4 (`AppShell.tsx:92,119`, `ViewSwitcher.tsx:26,52`); herramientas `#587083`×9, `#122e43`×6, `#1d4458`×4, `#ccd9df`×3… (`src/features/tools/components/*`) | ≈ | P3 | — | mantener |
| 20 | Degradados | `.cf-avatar` `#0c4959→#2b9188`, `.cf-identity.profile-full` `#12394b→#176d75` y `.personal-passport` `#103a4c→#186c72`, todos teal (`v15.css:2,7`, `v17.css:3`) | ninguno («Avoid: gratuitous gradients», `DESIGN_SYSTEM.md:11`); solo el rayado `bg-partial`. Desde `1764e8e` (W2-01) hay avatar de iniciales en el inicio, pero en navy liso, sin degradado (`IdentityCard.tsx:22-27`) | − | P2 | — (v2: default v1.8; hero y avatar son datos del propio técnico, sin acceso de terceros) | portar el degradado teal del avatar y del hero con SHOT-01 #2 (default v1.8) |

Capturas: `evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `evidencias/shots/demo/D-TOOL-00-herramientas-1440.png`; Next `docs/audit/evidence/v18-compare/next-after/tech-home-1440.jpg`, `tools-1440.jpg` (lote 11).

---

## VIS-02 · Paleta por rol y zona — v1.8 `S-*`/`D-*` (todas) ↔ Next `N-*` (todas)

**Estado global:** PARCIAL. Las zonas coinciden: navy en el menú, naranja en la acción principal, teal en herramientas y verde/ámbar/rojo en los estados. Next no tiene las superficies que dependen de pantallas aún no portadas (asignado, punto de oportunidad, hero) y usa un único acento naranja fuera de herramientas.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Menú lateral | bg `#0c2137`; botones `#aabed1` (8,53:1); hover `#ffffff0b`; activo `#203b54` + blanco; icono activo `#ffad54` (`v11.css:3`) | `bg-navy text-[#c4d3e1]` (10,67:1); hover `bg-white/5`; activo `bg-navy-700 text-white`, icono `text-accent` (`AppShell.tsx:76`, `NavLinks.tsx:59-65`) | ≈ | — | — | — |
| 2 | Títulos de sección del menú | `.sidebar-label`: 10px, 600, `.16em`, `#819bb2`; una sola etiqueta de rol («PROFESIONAL»/«EMPRESA»/«RECRUITER»; conectado además «ADMINISTRACIÓN»/«BETA LOCAL») (`LegacyApp.jsx:78`, `ConnectedShell.jsx:13`) (v2, conectado medido: «PROFESIONAL», «EMPRESA», «ADMINISTRACIÓN», «BETA LOCAL») | 11px semibold `.16em` `#91aac1`, una por sección (nombre de la organización, «Profesional», «Plataforma», «Cuenta»; `AppShell.tsx:48-65`, `ViewSwitcher.tsx:26`, es:58-60,69). D-13 (`d3b876f`): para administradores de plataforma, «VER COMO» con el mismo estilo encima de las secciones (`ViewSwitcher.tsx:50-55`), y el menú muestra solo la sección de la vista elegida más «Cuenta» (`ViewSwitcher.tsx:20-32`, `views.ts:30-33`), como v1.8 cambiaba el menú con el rol v2: con M07/M08 (`db05af1`) la sección «Profesional» suma «Oportunidades» y «Mis candidaturas» tras «Disponibilidad», en el orden de v1.8 (`AppShell.tsx:33-35`) | ≠ | P3 | — | mantener |
| 3 | CTA principal | `.action.primary` `#ff982f`/texto `#172b3e` (6,74:1), 27 usos | `Button` primary `bg-accent text-ink` (6,61:1, `Button.tsx:17`) | = | — | — | — |
| 4 | Color de acción por pantalla | naranja en la demo; **teal** `.tb-button.primary #057f7d` en herramientas, reto, traductor, cuenta conectada (incluido el login), admin y calendario/directorio conectados | naranja en toda la app; teal solo en `/app/tools` (`DESIGN_SYSTEM.md:41-44`). Login con CTA naranja (`local-21-login-es.jpg`) | ≠ | P3 | — | mantener (decisión: un acento) |
| 5 | Teal de herramientas | hero `#112e40`, CTA menta `#b5f0dc`/`#153c3d`, ficha `#e8f3f1`/`#12716f`, favorito activo `#bb7714` | `tool-*`, favorito `#bb7714` (`ToolsHome.tsx:135`) | = | — | — | — |
| 6 | Chips de estado | `.pill` (`Badge`, `Shared.jsx:31`) 12px/700, radio 5: neutro `#597084/#edf2f6`, `green`, `orange`, `blue`, `red`, `dark` (`#acc3d9/#ffffff13`) | `StatusChip` 12px bold, `rounded-md` (6px), borde, tonos neutral/ok/warn/danger/info (`StatusChip.tsx:13-27`); sin tono `dark` | ≈ | P3 | — | mantener |
| 7 | Disponible | `.calendar-day.available` `#e9f6ef`/`#247459`/borde `#bcdccb` (5,08:1) | `border-ok/40 bg-ok-bg text-ok` (`src/features/availability/calendar.ts:33`; 5,07:1) | ≈ | — | — | — |
| 8 | Descanso / trabajo | `off`, medido en ejecución: celda `#758892` sobre `#f5f6f8` (**3,41:1**; `.availability-v17 .calendar-day.off` anula en los dos calendarios, demo y conectado, la regla base `#8998a6/#f5f7f9` de 2,75:1), chip «Descanso» `#607784/#f0f3f6` (4,22) y mini del inicio `#69828d/#f1f4f7` (3,67); `working` («Trabajo») `#eaf2f9`/`#367199` (azul, 4,67) | `unavailable` («Bloqueado») `bg-canvas text-muted` (4,83:1); `none` blanco/muted (`calendar.ts:34,38`). No hay estado azul «Trabajo» | ≠ | P3 | — | mantener (semántica cubierta en el diff de Disponibilidad) |
| 9 | AOG | `.calendar-day.aog` `#fff3e6`/`#bd752b` (3,35:1) | `warn` `#fff0e1`/`#aa5916` (4,53:1; `calendar.ts:36`; «AOG is orange, never the error red») | ≈ | — | — | — |
| 10 | Parcial rayado | `repeating-linear-gradient(135deg,#eef6f4,#eef6f4 5px,#dcece6 5px,#dcece6 10px)`, texto `#4b776d` (`v18.css:1`) | `bg-partial`, mismo patrón (`globals.css:38-40`); texto `ok #16745d` (`calendar.ts:37`; 5,18/4,66:1) | = | — | — | — |
| 11 | Asignado | `.calendar-day.assigned` `#183e5e` en toda la celda (demo: texto blanco; conectado: `#a3b2bf`, 5,11:1, porque `.availability-v17` cambia el texto; medido v2 con el técnico 1 en el 22 y el 30 de octubre, `evidencias/v2/50/VIS-02-11-v18c-calendar-1440.jpg`); `.mini-day.assigned` `#dce7fb`/`#375f9d` (5,13:1, `VIS-02-11-v18c-home-1440.jpg`) y leyenda «Asignado» en el mini | v2 (`db05af1`, M08): marca «● Asignada» de 11px en negrita navy bajo el número del día en el calendario editable (`AvailabilityManager.tsx:405-409`), sobre el color del estado (14,51:1 sobre `ok-bg`, medido con delta) y `aria-label` «…, asignación confirmada» (`:398`; es:742-743). Los días salen solo de las candidaturas `confirmed` (`availability/page.tsx:34-44`, `calendar.ts:159-167`): al finalizar la de delta (área 30, 22/10) la marca desapareció, mientras que el conectado mantiene «Asignado» en el 22/10 de J1, ya finalizado; solo marcan, no bloquean (T-13). Sin entrada en la leyenda y **sin marca en el mini calendario del inicio** (0 marcas medidas). A 390 la marca mide 50,7px en dos líneas y **se sale de la celda de 41,7px** (`evidencias/v2/50/VIS-02-11-next-390.jpg`; a 768 y 1440 cabe) | ≠ (v2: antes −) | P3 | — (v2: desbloqueado; D-06 ratificada y M08 implementado) | ajustar: marca también en el mini calendario, entrada «Asignada» en la leyenda y días de candidaturas `finished` (como v1.8); por debajo de `sm`, solo el punto (texto `sr-only`) para que no se salga de la celda |
| 12 | Hoy | `.mini-day.today` borde teal `#258c84` (`v17.css:3`) | `ring-2 ring-accent` (`AvailabilityMonth.tsx:73`) | ≠ | P3 | — | mantener (AB-04 NOT_A_GAP) |
| 13 | Punto de oportunidad | `.mini-day i` 5px `#d84d59` y leyenda «Oportunidades» | no existe: el mini calendario del inicio no marca oportunidades (medido v2 con alpha: 0 marcas con «Oportunidades compatibles» = 1, `evidencias/v2/50/SHOT-01-9-next-1440.jpg`), aunque M07 ya existe | − | P2 | — (v2: desbloqueado; D-06/D-12 ratificadas y M07 implementado) | portar: punto y leyenda «Oportunidades» en los días cubiertos por oportunidades compatibles (`listOpportunities` con `eligible`) |
| 14 | Día sin guardar | `.unsaved-day` contorno discontinuo `#b98231` (`v18.css:1`) | `outline-2 -outline-offset-4 outline-accent outline-dashed` (`AvailabilityManager.tsx:399`) | ≈ | — | — | — |
| 15 | Medallas de especialidad | violeta `#7955a0/#e9dff5`, `#72558a/#f3eef9`; años `#fff8e8`; categoría `#eaf2fb` (`v17.css:2`) | no existen | − | P2 | — (v2: default v1.8; las medallas salen del propio pasaporte, sin acceso de terceros) | portar con el hero (SHOT-01 #2) |
| 16 | Bandas de modo | `.workspace-mode` verde `#e5f1ed/#286a60`, `.demo-banner` `#edf3f9/#60768c`, `.connected-banner` `#e8f4ef/#2d6c5b`, `.demo-switcher` blanco | no existen | ✗ | — | DEMO-ONLY | no portar |
| 17 | Modo oscuro | no existe (sin `prefers-color-scheme`) | no existe (sin `dark:`) | = | — | — | — |

Capturas: `evidencias/shots/demo/D-TEC-03-disponibilidad-1440.png`, `evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `evidencias/shots/connected/C-ANON-01-login-1440.png`; Next `v18-compare/next-after/tech-availability-1440.jpg`, `tech-home-1440.jpg` (lote 11), `local-21-login-es.jpg` (lote 13). v2: `evidencias/v2/50/VIS-02-11-next-1440.jpg`, `VIS-02-11-next-768.jpg`, `VIS-02-11-next-390.jpg` (marca «Asignada»), `VIS-02-11-v18c-calendar-1440.jpg`, `VIS-02-11-v18c-home-1440.jpg` (conectado); `raw/assigned.txt`, `raw/v18c-facts.txt`.

---

## VIS-03 · Tipografía — v1.8 `v11.css:2-3`, `index.css:44-45,58-64` ↔ Next `layout.tsx:4-7,22-23`, `globals.css:34,47-50`

**Estado global:** PARCIAL. En v1.8, Inter está declarada pero **nunca se carga**: se ve la fuente del sistema (DejaVu Sans en las capturas de Linux, más ancha y pesada). Next carga Inter. Es la diferencia de «aspecto» más evidente entre todas las capturas.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Familia declarada | `body{font-family:var(--font-main)}` = `'Inter', ui-sans-serif, system-ui…` (`index.css:44,59`); `h1,h2,h3{font-family:Inter,system-ui,sans-serif}` (`v11.css:3`) | `--font-sans: var(--font-inter), ui-sans-serif…` (`globals.css:34`); `body.font-sans` (`layout.tsx:23`) | = | — | — | — |
| 2 | Familia cargada | **ninguna**: sin `@font-face`, `@import` ni `<link>`; la CSP fija `font-src 'self'` (`server/app.mjs:151`). Se ve la fuente del sistema, distinta en cada dispositivo | Inter vía `next/font/google`, autoalojada en el build, subset latin (`layout.tsx:4,7`) | ≠ | P2 | — | mantener (mejora de Next) |
| 3 | Fuente display | `--font-display: 'Outfit'…` solo en reglas muertas | no | ✗ | — | — | no portar (`13-visual-comparison.md:48`) |
| 4 | Cuerpo | `body` sin tamaño (16px); `p` 15px/1.65 (`v11.css:3`); en la práctica la UI usa **12px** (84 reglas) | `body` 15px/1.6 (`globals.css:47-50`); lo más usado es `text-sm` 14px (v2: 139; xhigh: 114; 21/10: 107) y `text-xs` 12px (v2: 51; xhigh: 56; 21/10: 44) | ≈ | — | — | — |
| 5 | H1 | 32px/1.2 (27 a ≤760px); `.personal-heading h1` `clamp(26px,3vw,38px)`; `.toolbox h1` 34px | `PageHeader` `text-2xl sm:text-3xl` (24/30px, bold; `PageHeader.tsx:20`); herramientas `text-[34px]`… | ≈ | P3 | — | mantener |
| 6 | Tamaño mínimo | 7px!important (`.medal-year small`), 8px (pie en móvil), 9px ×15 (pie, dock, `AVIATION`, leyendas), 10px ×46 | 22/10: **11px** como mínimo. 10px ×0: los kickers de herramientas pasan a 12px (`ToolsHeader.tsx:10`, `parts.tsx:56`, `ToolsHome.tsx:72`; `9483667`, W3-09) y un test lo vigila en `/app/tools` (`tests/design/contrast.test.ts:94-115`). 11px ×8: cabeceras de tabla (`RequirementsList.tsx:20`, `MatchList.tsx:188`, `verifications/page.tsx:59`), secciones del menú (`ViewSwitcher.tsx:26`), `AVIATION` (`AppShell.tsx:92`), días de la semana (`AvailabilityMonth.tsx:57`), etiqueta del día (`AvailabilityManager.tsx:404`) y la etiqueta «Ver como» (D-13, `d3b876f`) (`ViewSwitcher.tsx:52`). 21/10: 10px ×3 y 11px ×11 v2: 9 usos en 7 ficheros; nuevo, la marca «● Asignada» del día (`AvailabilityManager.tsx:406`, M08). El test `contrast.test.ts:94-106` fija los 7 ficheros permitidos y `DESIGN_SYSTEM.md:49-53` ya los enumera (X-20, `c9f9826`) | ≈ | P3 | — | v2: el doc y el test ya cubren los usos (X-20, `c9f9826`); falta nombrar la marca «Asignada» en `DESIGN_SYSTEM.md:50-52` o subirla a 12px |
| 7 | Pesos | 400, 500, 600, **650**, 700, **750**, 800; los intermedios se redondean sin una fuente variable | `font-semibold`/`bold`/`extrabold`/`black` (600/700/800/900) | ≈ | — | — | — |
| 8 | Tracking | negativo en titulares (−.035em… −2px); kickers `.16–.32em` | `tracking-tight`; kickers `tracking-[0.16em]`/`[0.17em]`/`[0.2em]`/`[0.28em]` | ≈ | — | — | — |
| 9 | Cifras | `tabular-nums` en `.tb-result`, `.ops-revenue`, `.fuel-*` | `tabular-nums` en `Metric` (`Metric.tsx:27`) y calendarios (`AvailabilityManager.tsx:401`) | = | — | — | — |
| 10 | Mayúsculas en chips | `.pill` nunca en mayúsculas | `StatusChip` en sentence case (`StatusChip.tsx:24-25`); lote 11 aún en MAYÚSCULAS (`next-after/org-home-1440.jpg`) | = | — | — | — |
| 11 | Capitalización del mes | `.home-calendar h2{text-transform:capitalize}` → «Octubre **De** 2026» (`evidencias/shots/demo/D-TEC-01-inicio-1440.png`) | v2: `formatMonth` pone la inicial en mayúscula → «Octubre de 2026» (`src/i18n/format.ts:39-43`, X-18 `53c8633`; antes `first-letter:uppercase` en `AvailabilityMonth.tsx:37`) | ✗ | — | — | no portar (bug de v1.8) |
| 12 | Tamaño de texto en campos | `.control` 13px, `.role-control select` 12px: menos de 16px hace que iOS amplíe la página al enfocar | `controlClass` 15px (`Field.tsx:4`) | ≈ | — | — | mantener |
| 13 (nueva xhigh) | Capitalización del mes en el calendario editable | `#calendar`: «octubre de 2026» en minúscula; el `capitalize` solo afecta a `.home-calendar h2` (medido en ejecución) | v2 (X-18, `53c8633`): `formatMonth` capitaliza en los dos calendarios: «Octubre de 2026» en el editable (`AvailabilityManager.tsx:341`, medido en `/app/professional/availability`) y en el mini (`src/i18n/format.ts:39-43`). xhigh: «octubre de 2026» en minúscula en el editable | + (v2: antes =) | — | — | — (HECHO, X-18) |

Capturas: `evidencias/shots/demo/D-TEC-01-inicio-1440.png`; Next `v18-compare/next-after/tech-home-1440.jpg` (lote 11). xhigh: `evidencias/xhigh/50/SHOT-02-next-1440.jpg` (mes del calendario editable en minúscula). v2: `evidencias/v2/50/raw/contrast-alpha.json` («Octubre de 2026» en el editable).

---

## VIS-04 · Radios, sombras, espaciado y z-index — v1.8 (A-css-meta 8.4) ↔ Next `src/components/ui/*`

**Estado global:** PARCIAL. Los radios son equivalentes. Next no tiene sombras ni capas superpuestas: no hay modales, toasts ni dock.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Radio de controles y botones | 7px (campos, chips) y 8px (`.action`, `.tb-button`, `.icon-button`) | `rounded-lg` 8px (`Button.tsx:11`, `Field.tsx:4`) | ≈ | — | — | — |
| 2 | Radio de paneles | 13px (`.panel`, `.tb-panel`, `.job-card`); métricas 12px | `rounded-xl` 12px (`Panel.tsx:15`, `Metric.tsx:25`); herramientas 13/18px | ≈ | — | — | — |
| 3 | Radio de chips | `.pill` 5px | `rounded-md` 6px (`StatusChip.tsx:25`) | ≈ | — | — | — |
| 4 | Radio de hero/diálogo | 15px (`.dashboard-hero`, `.dialog`), 16px (`.personal-passport`), 18px (`.tb-hero`) | 18px solo en el hero de herramientas | ≈ | — | — | — |
| 5 | Sombras | vivas: `.panel` `0 3px 10px #19324e02` (invisible), `.dialog` `0 30px 100px #0003`, `.v11-toast`, `.phone-preview`, `.cf-avatar`, `.personal-passport`, `.mobile-dock`, `.tb-tabs` activa | **ninguna** decorativa (sin `shadow-*` en `src/`); desde `674b8b5` (W3-01) el único `box-shadow` es el anillo navy de 2px del foco (`globals.css:57`) | − | P3 | — | mantener (`13-visual-comparison.md:50`; las demás pertenecen a componentes ausentes) |
| 6 | `backdrop-filter` | `blur(4px)` en el fondo del modal y `blur(14px)` en el dock | no | − | — | — | no aplica (sin modal ni dock) |
| 7 | Espaciado | sin escala: `gap` con 23 valores y más de 80 combinaciones de `padding` | escala de Tailwind (`p-5/6`, `gap-1…4`, `px-4 py-6 sm:px-6 lg:px-10`) | ≠ | — | — | mantener (mejora) |
| 8 | z-index | sidebar 35, dock 70 (el 90 del media query queda anulado, `v17.css:7,10`), `.nav-backdrop` 75, drawer 80, modal 100, «Guardando…» 100, toast 150 (por encima del modal), enlace de salto 200 | solo `focus:z-50` del enlace de salto (`AppShell.tsx:72`) | ≠ | — | — | mantener |
| 9 | Densidad del shell (1440) | contenido `34px 38px`, máx. 1440px; panel `padding:23px`; cabecera blanca de 76px y tres bandas antes del contenido | contenido `lg:px-10 lg:py-10`, `max-w-6xl` (1152px); `Panel` `p-5 sm:p-6`; sin cabecera | ≠ | P3 | — | ver SHOT-01 |

Capturas: `evidencias/shots/demo/D-EMP-01-resumen-1440.png`; Next `v18-compare/next-after/org-home-1440.jpg` (lote 11).

---

## VIS-05 · Animación, movimiento, impresión y modo oscuro — v1.8 `v11.css:3,10`, `v17.css:12`, `index.css:54-56` ↔ Next `Button.tsx:7`, `StateMessage.tsx:34-35`

**Estado global:** PARCIAL. Ninguna de las dos apps tiene animaciones decorativas. La regla de movimiento reducido de v1.8 no funciona; desde `6ac67d2` (W3-06) el único `animate-pulse` de Next va bajo `motion-safe:` y un test lo vigila. Quedan las diferencias de impresión.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | `@keyframes` | `fadeIn`, `slideUp` y `sheetUp` (`index.css:281,737,782`), todas en clases muertas: **no se ejecuta ninguna** | `motion-safe:animate-pulse` en `LoadingState` (`StateMessage.tsx:34-35`) | + | — | — | — |
| 2 | Transiciones | `button{transition:background .15s,color .15s,transform .15s}` (`v11.css:3`) | `transition-colors` en `Button` (`Button.tsx:11`), `LocaleSwitcher.tsx:101`, `ProfileForm.tsx:167`, `AvailabilityManager.tsx:399` | ≈ | — | — | — |
| 3 | Desplazamiento suave | `html{scroll-behavior:smooth}` (`index.css:55`) siempre activo; el código fuerza `behavior:'instant'` (`LegacyApp.jsx:42,93`) | sin desplazamiento suave; Next sube arriba al navegar | ≈ | — | — | — |
| 4 | `prefers-reduced-motion` | `@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}` (`v17.css:12`), **anulada** por `index.css:54-56`, que va después | la única animación va bajo `motion-safe:` (`motion-safe:animate-pulse`, `StateMessage.tsx:34-35`; `6ac67d2`, W3-06); `tests/design/contrast.test.ts:85-92` falla si aparece un `animate-*` sin `motion-safe:` en `src/**/*.tsx`. Sin regla de `scroll-behavior` (no hay desplazamiento suave). Medido (xhigh) con `reducedMotion: 'reduce'` emulado: el esqueleto de `loading.tsx` calcula `animation-name: none` (sin emular, `pulse 2s infinite`); `document.getAnimations()` vacío y ninguna `animation-name` distinta de `none` en las 24 rutas, también con `reduce` emulado (`evidencias/xhigh/50/raw/crawl-rm-*.json`); los `transition-colors` de 150 ms siguen (color, no movimiento). v1.8 con `reduce`: `scroll-behavior: smooth` (medido), lo que confirma la regla anulada v2: 0 animaciones con `reduce` en 30 cargas (alpha, manager.mro y sin sesión; incluye oportunidades, detalle y candidaturas) y esqueleto `animation-name: none` (`evidencias/v2/50/raw/crawl-rm-*.json`, `raw/misc.txt`) | + (antes ≈) | — | — | — |
| 5 | Impresión | `@media print` (`v11.css:10`): oculta el shell y muestra `.pack-print` del modal «Candidate Pack» (`Workflow.jsx:28-32`); imprimir desde otra vista da una página **en blanco** | sin estilos de impresión: se imprime la página con el menú | ≠ | P3 | SCOPE (v2: el Candidate Pack pasa a LATER; su impresión/PDF sigue OUT) | no portar ahora (Candidate Pack en LATER; el PDF del Candidate Pack está en OUT) |
| 6 | Modo oscuro | no | no | = | — | — | — |

Capturas: — (no visibles en captura estática). xhigh: animaciones medidas en `evidencias/xhigh/50/raw/crawl-*.json` y `raw/crawl-rm-*.json` (24 rutas de Next, con y sin `reduce`) y `raw/v18crawl-w1440r.json`; esqueleto con y sin `reduce` en `raw/misc.txt`. v2: `evidencias/v2/50/raw/crawl-rm-*.json`, `raw/misc.txt`.

---

## VIS-06 · Breakpoints y layout del shell — v1.8 `LegacyApp.jsx:78-87`, `ConnectedShell.jsx:12-13`, `v11.css:3-9`, `v17.css:5-10` ↔ Next `AppShell.tsx`, `NavDrawer.tsx`, `NavLinks.tsx`, `ViewSwitcher.tsx`

**Estado global:** PARCIAL. El corte móvil es distinto: v1.8 a ≤760px, Next por debajo de `lg` (1024px). En móvil, Next sustituye la hamburguesa, el drawer superpuesto y el **dock de 5 iconos** por una barra superior con un desplegable «Menú». Tampoco tiene cabecera ni pie en escritorio. v2: con M07/M08 implementados y el alcance nuevo, el dock (C-12, «revisit after M07/M08 exist») pasa a portable con el default v1.8, igual que la cabecera con breadcrumb y el pie; el menú lateral de escritorio se desplaza dentro de la pantalla (X-03).

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Breakpoints | 14 valores sin escala: 390, 520, 600, 650, 700, 760/761, 800, 980, 1000, 1050, 1180, 1200 y ≥1500 (768, muerto) | los de Tailwind (sm 640, md 768, lg 1024, xl 1280), sin redefinir | ≠ | — | — | mantener |
| 2 | Cuándo se oculta el sidebar | ≤760px (`v11.css:7`); a 761–980px mide 210px y a ≤1200px, 225px | `<lg` (1023px): `lg:sticky lg:w-64` (`AppShell.tsx:76`); ancho fijo de 256px desde `lg` | ≠ | P3 | — | mantener (lote 11). `DESIGN_SYSTEM.md:80-88` ya describe el desplegable «Menú» (`c0673ba`, W4-01) |
| 3 | Ancho del sidebar | 254px (225 a ≤1200, 210 a ≤980) | 256px (`w-64`) | ≈ | — | — | — |
| 4 | Cabecera superior (escritorio) | blanca, 76px (≤760: 66), **no sticky**. Contiene el breadcrumb «CrewFlex / {sección}», «Probar como» + select, el botón «Vista móvil» y la campana «Ver notificaciones» con punto `#f09634` (`LegacyApp.jsx:84-87`). En conectado: rol en texto + «Ver demo» (v2, medido en el conectado: «CrewFlex / Mi espacio», «Técnico», «Ver demo», `evidencias/v2/50/raw/v18c-facts.txt`) | no hay cabecera en `lg+`; el contenido empieza en el `PageHeader` | − | P3 | — | portar (v2, copiar todo): cabecera blanca con breadcrumb (fila 5) y campana (fila 7); sin «Probar como» ni «Vista móvil» (fila 6) |
| 5 | Breadcrumb | «CrewFlex / {etiqueta}», 12px, oculto a ≤760px | no; la jerarquía la lleva el eyebrow del `PageHeader` | − | P3 | — | portar con la fila 4 (v2: AB-29 era una elección técnica, `13-visual-comparison.md:50-51`; el objetivo ahora es copiar v1.8) |
| 6 | Selector de rol / «Vista móvil» | `select` «Rol de demostración» y botón «Vista móvil»/«Vista escritorio» | «Vista móvil»: no. Selector de rol: con D-13 (`d3b876f`, 22/10) existe «Ver como», solo para administradores de plataforma y sobre su propia cuenta (fila 18) | ≠ (antes ✗) | — | — | «Vista móvil»: no portar (DEMO-ONLY). Selector: mantener tal como lo fija D-13 |
| 7 | Campana de notificaciones | `icon-button` de 44×44 con punto de no leídas, enlaza a `#notifications` (conectado medido v2: «Avisos» con `lucide-bell` en el menú, no en la cabecera) | no hay avisos | − | P2 | — (v2: desbloqueado; avisos in-app en LATER) | portar con los avisos in-app |
| 8 | Bandas de demo | `.workspace-mode`, `.demo-banner` y `.demo-switcher`: unos 190px antes del contenido a 1440 y unos 320px a 390 | no | ✗ | — | DEMO-ONLY | no portar |
| 9 | Hamburguesa | `icon-button` de 44×44 con icono `Menu`, a la izquierda de la cabecera blanca; `aria-label="Abrir menú"`; visible ≤760px (`LegacyApp.jsx:81`) | botón de texto «Menú» (es:29) con borde, en la barra navy a la derecha, junto a «Cerrar sesión»; `aria-expanded`/`aria-controls`; visible `<lg` (`NavDrawer.tsx:33-42`) | ≠ | P3 | — | mantener; (v2: al portar el dock, fila 11, valorar el botón de icono de v1.8 conservando `aria-expanded`/`aria-controls`) |
| 10 | Drawer | `position:fixed`, 265px, por encima (z 80), con fondo `#0c213799` (`.nav-backdrop`, «Cerrar menú») y una X de 30×44; se cierra al elegir; `nav` con scroll interno | desplegable dentro del flujo bajo la barra superior (empuja el contenido); enlaces en filas que envuelven (`NavLinks.tsx:47`); se cierra con cualquier cambio de ruta y con Escape (`NavDrawer.tsx:22-25,38`) | ≠ | P3 | — | mantener; (v2: el drawer superpuesto de v1.8 se puede portar con el dock, con Escape y foco dentro, que v1.8 no tiene) |
| 11 | **Dock inferior** | ≤760px: `nav.mobile-dock` «Accesos rápidos», fijo abajo (390×67), **5 iconos con etiqueta 9px**, activo `#e8f4ef/#1b7a68`, `env(safe-area-inset-bottom)` (`v17.css:7`). Técnico: Inicio · Ofertas · Calendario · Candidaturas · Herramientas. Empresa/recruiter: Inicio · Ofertas · Candidatos · Candidaturas · Herramientas. Conectado: de 2 a 5 columnas (`ConnectedShell.jsx:12`) (v2, conectado medido: de 2 a 5 columnas, p. ej. admin 2×190px y técnico/empresa 5×76px, `evidencias/v2/50/VIS-06-11-v18c-390.jpg`) | no existe; `DESIGN_SYSTEM.md:37,87` dice «No bottom dock (C-12)». v2: los destinos ya existen salvo «Candidatos» como directorio global: Ofertas → `/app/professional/opportunities`, Candidaturas → `/app/professional/applications` (M07/M08) | − | P2 | — (v2: default v1.8, C-12; «revisit after M07/M08 exist», `14-decision-pack.md:48`, y M07/M08 ya existen) | portar: dock ≤760px con los 5 accesos de v1.8 por rol (técnico: Inicio, Ofertas, Calendario, Candidaturas, Herramientas; empresa: Inicio, Ofertas → Necesidades, Candidatos, Candidaturas, Herramientas), etiqueta ≥11px y ≥4,5:1, `aria-current`, `env(safe-area-inset-bottom)`; actualizar `DESIGN_SYSTEM.md` |
| 12 | Vista móvil simulada | `.phone-preview`: columna de 520px sobre navy `#050d1a`; **no** muestra el dock y el `nav-backdrop` entra en el flujo (A-css-meta, hallazgo 7) | no | ✗ | — | DEMO-ONLY | no portar |
| 13 | Ancho máximo | `.v11-shell` máx. 1920px centrado (navy a los lados); `.content` máx. 1440px | contenido `max-w-6xl` 1152px centrado (`AppShell.tsx:135`); shell sin máximo | ≠ | P3 | — | mantener |
| 14 | Pie | `.app-footer` 9px `#95a3b0` (**2,40:1**): «CREWFLEX AVIATION» · «Cualificación · Disponibilidad · Confianza» · «V1.8 · Unificada» (conectado: «V1.8 · Beta local conectada»); a ≤760px se oculta el lema y se añade `padding-bottom:100px` (v2, conectado medido: «CREWFLEX AVIATION» y «V1.8 · Beta local conectada», sin el lema) | no hay pie | − | P3 | — (v2: default v1.8, C-12) | portar el pie con «CREWFLEX AVIATION» y el lema, sin etiquetas de versión, a ≥4,5:1 (v1.8: 2,40) y ≥11px |
| 15 | Pie del sidebar | avatar de 36px + nombre + «Identidad profesional» / «Organización de demo» (conectado: «Cuenta autenticada» / «Servidor local · datos propios») + «Volver a la demo» (v2: conectado medido) | `display_name` + tipo de cuenta y rol («Profesional» u «Organización · Manager», `domain.accountType.*`/`domain.role.*`, 12px `#91aac1`; `d12164a`, W2-06) + «Cerrar sesión» (`AppShell.tsx:117-132`, `account-summary.ts:15-26`); `<lg`: «Cerrar sesión» en la barra. Sin avatar v2: desde X-13 (`745c1fc`) el administrador de plataforma lee su rol de plataforma; a 256px se trunca («Profesional · Administración de la pl…», `evidencias/v2/50/A11Y-02-8-next-1440.jpg`) | ≈ | — | — | — |
| 16 | Toast / «Guardando…» | `.v11-toast` abajo en el centro (sube a 90px a ≤760px por el dock) y `.saving-indicator` abajo a la izquierda | sin toasts: resultado en línea con `Notice` (`Notice.tsx:25-92`) y `aria-busy` | ≠ | P3 | — | mantener (igual que el v1.8 conectado, que tampoco tiene toasts) |
| 17 | Desbordes a 390 | sin scroll horizontal; **las etiquetas de los días del calendario se pisan** («DescansoDescanso», `evidencias/shots/demo/D-TEC-03-disponibilidad-390.png`); el H1 del inicio pierde el espacio al ocultar `<br>` («Tu tiempo.Tu», `v17.css:8`, `TechnicianHome.jsx:15`) | etiqueta del día oculta por debajo de `sm` (`AvailabilityManager.tsx:404`); el titular «Tu perfil. Tu tiempo. / Tu próxima oportunidad.», portado en `1764e8e` (W2-01), conserva el salto `<br />` en todos los anchos (`src/app/app/professional/page.tsx:114`), así que no se pegan las frases. Medido (xhigh) a 390: `scrollWidth` = 390 en las 24 rutas de Next (ES; sin elementos que se salgan) y en 19 pantallas de v1.8 (`evidencias/xhigh/50/es390-*.jpg`, `v18-w390-*.jpg`) v2: `scrollWidth` = 390 en 49 cargas con sesión y 5 sin ella (incluidas oportunidades, su detalle y las candidaturas de los dos lados, `evidencias/v2/50/raw/crawl-es390-*.json`); pero la marca «● Asignada» se sale de su celda (VIS-02 #11) | ✗ | — | — | no portar (bugs de v1.8) |
| 18 (nueva) | Selector de espacio de trabajo («Probar como» ↔ «Ver como», D-13) | en la cabecera blanca, `label.role-control` con el texto «Probar como» (visible solo por encima de 1200px, 11px `#788a9a`; oculto a ≤1200px, `v11.css:5`, a ≤600px, `refinement.css:6`, y en la vista móvil; medido a 1440) y `select aria-label="Rol de demostración"` con «Técnico», «Empresa», «Recruiter» (`LegacyApp.jsx:84`, `v11.css:3`). Cambia el rol al elegir (`onChange`), sin confirmación, y con él todo el menú. Oculto en «Mi cuenta», «Herramientas», «Reto diario» y «Control CrewFlex»; a ≤980px el `select` se limita a `max-width:130px` (`v11.css:6`) y a ≤760px sigue en la cabecera (105×34 medido a 390). «Control CrewFlex» es una entrada del menú, no una opción. Lo ve cualquiera (demo) | `d3b876f` (D-13): solo administradores de plataforma (`views.ts:39-48`). `<nav>` «Ver como» con 4 enlaces en dos columnas dentro del sidebar: Técnico (exige cuenta profesional), Empresa (exige membresía), Recruiter y Administración (`ViewSwitcher.tsx:38-77`, `AppShell.tsx:109-114`). Son enlaces, no un `select` que navegue al cambiar (WCAG 3.2.2). Visible en todas las páginas; por debajo de `lg` queda dentro del desplegable «Menú». El menú muestra solo la sección de la vista elegida (`ViewSwitcher.tsx:20-32`). Cada vista enseña la cuenta del propio admin, sin suplantación, y `/app` lleva al admin a «Administración» (`src/app/app/page.tsx:7`) | ≈ | — | — | mantener (D-13); la banda `.demo-switcher` de personajes sigue sin portar (fila 8) |

Capturas: `evidencias/shots/demo/D-TEC-01-inicio-viewport-390.png`, `evidencias/shots/demo/D-GEN-04-menu-movil-390.png`, `evidencias/shots/demo/D-GEN-03-vista-movil-preview-1440.png`, `evidencias/shots/connected/C-TEC-44-mobile-menu-390-390.png`; Next `v18-compare/next-after/tech-home-390.jpg` (lote 11), `docs/audit/evidence/local-23-overview-nav-390.jpg` (lote 14, menú abierto con iconos). xhigh: `evidencias/xhigh/50/VIS-06-18-ver-como-next-1440.jpg`, `SHOT-09-menu-next-390.jpg`, `SHOT-09-menu-v18-390.jpg`; anchos del sidebar y del dock por breakpoint en `raw/facts.txt`; desbordes a 390 en `raw/crawl-es390-*.json` y `raw/v18crawl-w390.json`. v2: `evidencias/v2/50/VIS-06-11-v18c-390.jpg` (dock del conectado), `VIS-06-18-next-1440.jpg`, `A11Y-02-8-next-1440.jpg` (pie y menú desplazable), `SHOT-09-1-next-390.jpg`; `raw/facts.txt`, `raw/v18c-facts.txt`, `raw/crawl-es390-*.json`.

---

## VIS-07 · Iconografía de navegación por clave — v1.8 `Shared.jsx:4-18` (`icons`, lucide 0.453, respaldo `Briefcase`) ↔ Next `NavLinks.tsx:11-37`

**Estado global:** PARCIAL. v1.8 importa 62 lucide (60 en el bundle; faltan `Printer` y `Medal`) y renderiza 19px en el menú y 20px en el dock. Next dibuja SVG en línea de 18px, stroke 2, sin dependencia, uno por `href` y con el mismo respaldo maletín. Next da icono propio a todas sus entradas; v1.8 usa el maletín en 5 de 12 (técnico) y 6 de 11 (empresa). v2: las entradas «Oportunidades» y «Mis candidaturas» ya existen (maletín y portapapeles con check); quedan sin entrada directorio, avisos, logbook, reto y organización.

| # | Elemento | v1.8 (clave → icono) | Next (`href` → trazado) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Tamaño y estilo | lucide 19px en el menú y 20px en el dock; activo `#ffad54` | SVG de 18px, `strokeWidth 2`, `aria-hidden`; activo `text-accent` (`NavLinks.tsx:62-73`) | ≈ | — | — | — |
| 2 | Inicio técnico | `home` → `LayoutDashboard` («Mi espacio») | `/app/professional` → `DASHBOARD` (4 rectángulos, `:13,19`) «Mi espacio» (es:64) | = | — | — | — |
| 3 | Pasaporte | `profile` → `User` | `/app/professional/profile` → user (`:20-21`) | = | — | — | — |
| 4 | Disponibilidad | `calendar` → `CalendarDays` | calendario con puntos (`:24-25`; rectángulo sin radio) | ≈ | — | — | — |
| 5 | Documentos | demo `docs` → `FileText` («Wallet documental»); conectado `documents` → **Briefcase** (clave que no está en el mapa) (v2, conectado medido: «Documentos» con `lucide-briefcase`) | `/app/professional/documents` → file-text (`:26-27`) «Documentos» (es:72) | ≈ | — | — | — |
| 6 | Cualificaciones | sin entrada (forman parte del asistente del pasaporte) | award/medalla (`:22-23`) | + | — | — | — |
| 7 | Oportunidades / candidaturas | `jobs` y `applications` → `Briefcase` (ambos) (v2, conectado medido: «Oportunidades» y «Candidaturas» con `lucide-briefcase`) | v2 (`db05af1`, M07/M08): `/app/professional/opportunities` → maletín (`NavLinks.tsx:26`) y `/app/professional/applications` → portapapeles con check (`:27-28`), tras «Disponibilidad» como en v1.8 (`AppShell.tsx:33-35`) | ≈ (v2: antes −) | — | — (v2: D-06/D-12 ratificadas) | — |
| 8 | Logbook | `logbook` → `BookOpen` | no existe | − | P2 | — (v2: desbloqueado, alcance LATER) | portar con el logbook |
| 9 | Herramientas | `tools` → `Wrench` | llave inglesa (`:28-29`) | = | — | — | — |
| 10 | Privacidad / cuenta | `privacy` → `Shield` («Privacidad»; conectado: «Mi cuenta»); `account` → Briefcase | `/app/settings` → engranaje «Configuración» (`:30-31`) | ≈ | — | — | — |
| 11 | Reto diario | `learning` → Briefcase (respaldo) | no existe | − | P3 | — (v2: desbloqueado, alcance LATER; D-11 solo afecta a combustible) | portar con el reto diario |
| 12 | Admin | `admin-demo` → Briefcase («Control CrewFlex», demo); `admin` → Briefcase (v2, conectado medido: «Administración» con `lucide-briefcase`) | `/app/admin/verifications` → escudo con check (`:32-33`), con flag OD-3. D-13 (`d3b876f`): la vista «Administración» (`/app/admin`) se abre desde el selector «Ver como», cuyos enlaces son de texto, sin icono (`ViewSwitcher.tsx`) | ≠ | — | DEMO-ONLY / OD-3 | — |
| 13 | Datos y alcance | `Info` 18 | no | ✗ | — | DEMO-ONLY | no portar |
| 14 | Resumen empresa | `home` → `LayoutDashboard` | `/app/organization` → DASHBOARD | = | — | — | — |
| 15 | Nueva necesidad | `create` → `Plus` + «+» naranja `.nav-plus` | sin entrada en el menú: botón primario «Nueva necesidad» en el `PageHeader` de necesidades y del panel | ≠ | P3 | — | mantener |
| 16 | Ofertas y cobertura / Necesidades | `manage` → Briefcase | `/app/organization/requirements` → BRIEFCASE «Necesidades» | ≈ | — | — | — |
| 17 | Buscar candidatos | `candidates` → `Search` | sin entrada: los matches cuelgan de cada necesidad | − | P2 | — (v2: default v1.8) | portar con el directorio (área 30) |
| 18 | Ofertas en la red | `jobs` → Briefcase | no existe | − | P2 | — (v2: default v1.8; D-12 solo ratificó la vista del profesional) | portar con «Ofertas en la red» (área 30) |
| 19 | Organización | `settings` → `Settings` | no hay pantalla de organización; «Plantilla» → users (`:17-18`) | ≠ | P2 | — | ver el diff de organización |
| 20 | Avisos (conectado) | `notifications` → `Bell` (v2, conectado medido: `lucide-bell`) | no existe | − | P2 | — (v2: desbloqueado; avisos in-app en LATER) | portar con los avisos in-app |
| 21 | Comisiones (conectado) | `invoices` → Briefcase (v2, conectado medido) | no existe | ✗ | — | SCOPE (OUT) | no portar |
| 22 | Iconos del dock | Inicio `LayoutDashboard`, Ofertas `Briefcase`, Calendario `CalendarDays`, Candidaturas `Briefcase` (repite), Herramientas `Wrench`; empresa: Candidatos `Search` | sin dock | − | P2 | — (v2: default v1.8) | portar con el dock (VIS-06 #11) |
| 23 | Iconos fuera del menú | 62 lucide en pantallas (flechas, `Plane`, `Zap`, `Shield`, `Award`, `Star`, `Copy`…) | SVG sueltos en herramientas; textos «←/→» y «✓/✗/○» en calendario, matching y lista de comprobación del inicio (`MatchCard.tsx:111-113`, `AvailabilityMonth.tsx:46,53`, `src/app/app/professional/page.tsx:251`) | ≈ | P3 | — | mantener |

Capturas: `evidencias/shots/demo/D-GEN-04-menu-movil-390.png`, `evidencias/shots/demo/D-EMP-01-resumen-1440.png`; Next `docs/audit/evidence/local-23-overview-nav-390.jpg` (lote 14), `local-19-matches-es-1440.jpg` (lote 13). Las capturas `next-after/*` del lote 11 **no** tienen iconos. v2: `evidencias/v2/50/raw/v18c-facts.txt` (iconos del conectado), `SHOT-10-1-next-1440.jpg` (menú con las entradas nuevas).

---

## VIS-08 · Marca, favicon y nombre del producto — v1.8 `LegacyApp.jsx:78`, `dist/index.html:7` ↔ Next `AppShell.tsx:77-90`, `src/app/icon.svg`, `src/app/page.tsx`

**Estado global:** PARCIAL. Next sustituye el avión naranja por un monograma «CF» y el nombre «CrewFlex» por «Crew Flex». Desde `b9cd6e1` (W3-02) el favicon usa los colores de marca (antes, colores fuera de la paleta). v2: con el alcance nuevo, C-12 se trata como default v1.8 (avión, «CrewFlex»); la portada ya no tiene el botón invisible (X-01).

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Isotipo en el menú | `.brand-symbol` de 42×42, radio 12, `#ff982f`, con `Plane` 23 en navy | cuadrado de 36×36 (`size-9`), `rounded-lg`, `bg-accent`, «CF» en `font-black` navy, `aria-hidden` (`AppShell.tsx:84-89`) | ≠ | P2 | — (v2: default v1.8, C-12) | portar el default v1.8 (avión `Plane` navy sobre naranja), reversible |
| 2 | Logotipo | «CrewFlex» blanco 22px −.04em + «AVIATION» 9px `.32em` 500 `#91aac1` | «Crew Flex» `text-lg` bold (es:3) + «AVIATION» 11px `.28em` `#91aac1` (`AppShell.tsx:90-95`, es:4) | ≠ | P2 | — (v2: default v1.8, C-12) | portar «CrewFlex» + «AVIATION» (default v1.8; «AVIATION» a ≥11px) |
| 3 | Nombre del producto | «CrewFlex» siempre (título, menú, pie «CREWFLEX AVIATION», «Entrar en CrewFlex», «Control CrewFlex») | «Crew Flex» ×6 en es.json (`common.appName`, es:3,25,107,212,812,941) **pero** «CREWFLEX · WORKBENCH» (es:1009), «CrewFlex intermedia; …» en la nota de cada propuesta (es:1331, M08, nuevo en v2; visto en las dos vistas de candidaturas) y «· CrewFlex {versión}» en el texto que copia el conversor (`UnitConverter.tsx:269`) | ≠ | P3 | — (v2: default v1.8, C-12) | unificar en «CrewFlex» (default v1.8) en el catálogo, el `<title>` y `icon.svg` |
| 4 | Favicon | SVG en data URI: `rect rx=14 fill=#0c2137` + avión `#ff982f` (`dist/index.html:7`) | `src/app/icon.svg:2-3`: `rect rx=14 fill=#ff982f` (accent) + «CF» `#0c2137` (navy) en peso 900, como el isotipo del menú (`b9cd6e1`, W3-02; antes `#f59e0b`/`#0f172a`, NX-06). `tests/design/icon.test.ts:11-19` lee ambos tokens de `globals.css`. Mismos dos colores que v1.8, pero con figura y fondo invertidos (v1.8: fondo navy y avión naranja) | ≈ (antes ≠) | P3 | — (v2: default v1.8, C-12) | portar el favicon de v1.8 (fondo navy, avión naranja) con la fila 1 |
| 5 | Otros iconos | ninguno (sin apple-touch-icon ni PNG) | ninguno (sin `apple-icon`, `favicon.ico` ni `public/`) | = | — | — | — |
| 6 | Marca en el hero | `.flight-mark`: `Plane` 80 con `strokeWidth 1` + «CF / AVIATION» rotado −8° (`Dashboard.jsx:24`), oculto a ≤980px | no | − | P3 | — (v2: default v1.8) | portar con el hero (SHOT-01 #2) |
| 7 | Marca en landing y auth | sin landing (abre la demo); login conectado con marca en el menú y «Entrar en CrewFlex» (v2, conectado medido: `evidencias/v2/50/SHOT-08-1-v18c-1440.jpg`) | landing navy con «CF» de 40px y «Crew Flex» (`src/app/page.tsx:12-20`); auth con CF + «Crew Flex» y ES/EN (`local-21-login-es.jpg`). v2: corregido (X-01, `ef4d9b7`/`409c744`): «Iniciar sesión» blanco sobre navy 16,3:1 con borde 3,71:1 (`variant="inverse"`, `src/app/page.tsx:36-38`, `Button.tsx:23`; `evidencias/v2/50/A11Y-06-19-next-1440.jpg`) | + | — | — | — |
| 8 | Etiqueta de espacio | «● V1.8 · Espacio unificado» / «● V1.8 · Cuenta conectada» (`.workspace-tag`, punto `#47c9a5`) | no | ✗ | — | — | no portar |

Capturas: `evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `evidencias/shots/connected/C-ANON-01-login-1440.png`; Next `local-21-login-es.jpg` (lote 13), `v18-compare/next-after/tech-home-1440.jpg` (lote 11). xhigh: `evidencias/xhigh/50/A11Y-06-landing-boton-invisible-next-1440.jpg`; `GET /icon.svg`, `/favicon.ico`, `/apple-icon.png` en `raw/facts.txt`. v2: `evidencias/v2/50/A11Y-06-19-next-1440.jpg`, `A11Y-06-19-next-390.jpg`, `SHOT-08-1-v18c-1440.jpg`; `raw/facts.txt` (`/icon.svg`).

---

## VIS-09 · Componentes base — v1.8 `Shared.jsx:28-156`, `.tb-*` ↔ Next `src/components/ui/*`

**Estado global:** PARCIAL. Las primitivas equivalen (botón, chip, panel, métrica, campo, estado vacío). Next no tiene modal, toast ni pestañas porque las pantallas que los usan no se han portado.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Botón | `.action` (blanco, borde `#d8e2eb`, 13px, 650, `min-height:44px`) con variantes `primary`, `danger`, `link` y `ghost` (sin uso); además `.tb-button` paralelo (12px, 700, 42px, primario teal) | `Button`/`ButtonLink` en variantes `primary`, `secondary`, `ghost`, `danger` e `inverse` (portada navy, X-01) y tamaños `md` (`min-h-10`, 40px, `text-sm`) y `sm` (`min-h-8`, 32px, `text-xs`), los dos a 44px con puntero grueso; color y tamaño solo por props (`Button.tsx:4-28`; `tests/design/contrast.test.ts:66-83` prohíbe sobrescribirlos con `className`, `409c744`) | ≈ | — | — | — |
| 2 | Deshabilitado | opacidad .6 (`.tb-button` .5, `.mini-day` .4) + `not-allowed` | `disabled:opacity-50 cursor-not-allowed` | ≈ | — | — | — |
| 3 | Chip | `.pill` (ver VIS-02 #6) | `StatusChip` | ≈ | — | — | — |
| 4 | Panel | `.panel` con padding 23, borde `#e3e9ef`, radio 13 y `h2` 16px | `Panel` con `p-5/6`, borde `line`, `rounded-xl` y `h2` `text-base` (`Panel.tsx:15-18`) | ≈ | — | — | — |
| 5 | Métrica | `.metric`: `span` 12px, `strong` **31px**/750 (27 a 761–1200px y 29 a ≤760px: no monótono), `small` 10px `#8393a2` (3,15:1) | `Metric`: `dt` 12px en MAYÚSCULAS (muted), `dd` `text-3xl` (30px) bold `tabular-nums` y detalle `text-sm` muted (`Metric.tsx:25-30`) | ≈ | — | — | — |
| 6 | Campo | `.control` con etiqueta implícita (`<label>` envolvente, `Shared.jsx:49`), 13px, `min-height:44px`, sin `htmlFor` | `Field` con `<label htmlFor>`, hint y error con `aria-describedby`, 15px (`Field.tsx:20-41`) | + | — | — | — |
| 7 | Estado vacío / error | `Empty` (`h3` + texto + acción, icono `Briefcase` 32); `.notice`, `.tb-notice`, `.inline-error`, `.tb-error` | `StateMessage` (neutro con borde discontinuo o danger), `ApiErrorState`, `Notice` | ≈ | — | — | — |
| 8 | Modal | `Modal` con portal a `body`, `#root.inert`, Escape, bucle de Tab y restauración del foco (`Shared.jsx:98-141`) | no hay modales; las confirmaciones van en línea: cerrar necesidad (`RequirementStatusActions.tsx:48-64`, M05), pasos de candidatura con motivo o aceptación explícita (`ApplicationActions.tsx:101-161`, M08) y, desde `73de8ff` (W1-10), `ConfirmButton` de dos pasos (`src/components/ui/ConfirmButton.tsx:11-75`) | − | P3 | — | portar solo cuando una pantalla lo necesite |
| 9 | Toast | `.v11-toast` `role=status`, unos 5 s | no | − | P3 | — | mantener (`Notice` en línea) |
| 10 | Pestañas | `aria-pressed` en lugar de `role=tab` (`Toolbox.jsx:59`, `Account.jsx:45`, `.ops-tabs`) | no hay pestañas | = | — | — | — |
| 11 | Cabecera de tabla | v1.8 **no tiene `<table>` alcanzable**: `th{background:#f3f7fb;font-size:11px;color:#647f95}` (`v11.css:3`) es CSS muerto | `thead` `bg-canvas text-[11px] font-semibold text-muted`, sentence case (`RequirementsList.tsx:20`, `MatchList.tsx:188`, `verifications/page.tsx:59`), copiado de esa regla muerta (AB-02). `DESIGN_SYSTEM.md:62` ya lo dice («which no rendered V1.8 screen used: it had no tables», `c0673ba`) | + | — | — | — |

Capturas: `evidencias/shots/demo/D-TEC-02-pasaporte-1440.png`; Next `v18-compare/next-after/tech-passport-1440.jpg` (lote 11).

---

## META-01 · Documento HTML — v1.8 `dist/index.html:1-11` ↔ Next `src/app/layout.tsx:9-27`

**Estado global:** PARCIAL. Ambos documentos son mínimos. Next añade `lang` dinámico y una fuente cargada, pero no exporta `viewport`. v2: CSP en report-only medida en ejecución (META-03 #6).

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | `lang` | `<html lang="es">` estático (`dist/index.html:2`) | `<html lang={locale}>` resuelto por petición, `es` o `en` (`layout.tsx:20-22`); medido (xhigh): `es`/`en` correcto en las 23 páginas tituladas y la portada; la preferencia guardada gana a la cookie (admin.mro con cookie `es` sale en `en`) v2: `es`/`en` correcto en las 27 páginas tituladas, la portada y el 404 (`evidencias/v2/50/raw/crawl-*.json`, `raw/notfound.txt`) | + | — | C-5 | — |
| 2 | `charset` | `UTF-8` (`:4`) | la inyecta Next | = | — | — | — |
| 3 | `viewport` | `width=device-width, initial-scale=1.0, viewport-fit=cover` (`:5`), sin bloqueo de zoom | el de Next por defecto (`width=device-width, initial-scale=1`); sin `viewport-fit=cover` | ≈ | — | — | mantener; si se porta el dock (VIS-06 #11), exportar `viewport` con `viewportFit: "cover"` para `safe-area-inset-bottom` |
| 4 | `description` | «Plataforma profesional para técnicos de mantenimiento aeronáutico (TMA) y empresas MRO.» (`:8`) | `meta.description`: «Convierte cualificaciones, disponibilidad y demanda operativa en capacidad técnica movilizable.» (es:32; EN «Turn qualifications…») (`layout.tsx:13`) | ≠ | P3 | — | mantener |
| 5 | Fuente | ninguna petición de fuentes (0 orígenes externos, `v18-runtime-demo.md` §1.7) | Inter autoalojada por `next/font` | + | — | — | — |
| 6 | `<noscript>` | no | no (las páginas son Server Components: el contenido se ve sin JS, salvo los formularios cliente) | ≈ | — | — | — |
| 7 | OG/Twitter, `robots`, `preload` | no | no | = | — | — | — |

Capturas: —. xhigh: `meta` y `lang` medidos en `evidencias/xhigh/50/raw/facts.txt`. v2: `evidencias/v2/50/raw/facts.txt`, `raw/crawl-*.json`.

---

## META-02 · `<title>` por pantalla — v1.8 `dist/index.html:6` ↔ Next `generateMetadata` (27 páginas en v2; 23 en xhigh; 21 en `51c835a`)

**Estado global:** SOLO EN NEXT. v1.8 tiene un título estático para todas las vistas; Next titula cada ruta con la plantilla `%s · Crew Flex`. v2: 27 páginas tituladas y el anunciador de rutas funciona con `next start`; un detalle inexistente responde 200 con el título de la página (fila 5).

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Título base | «CrewFlex V1.8 — Aviation»; ningún código cambia `document.title` (A-css-meta 9.1) | `{default:"Crew Flex", template:"%s · Crew Flex"}` (`layout.tsx:12`) | ≠ | P3 | — | mantener |
| 2 | Títulos por ruta | — (el mismo en S-TEC-01…S-CON-14) | `meta.*` (es:31-56), 23 páginas con `generateMetadata`: «Iniciar sesión», «Crear cuenta», «Restablecer contraseña» (×2: forgot y reset), «Mi espacio» (`/app/professional`), «Mi pasaporte», «Cualificaciones», «Disponibilidad», «Documentos», «Resumen» (`/app/organization`), «Necesidades», «Nueva necesidad», «Necesidad», «Profesionales elegibles», «Plantilla», «Configuración», «Verificaciones», «Herramientas» y tres títulos de herramienta (`tools.tile.*.title`); con D-13 (`d3b876f`), «Administración» (`/app/admin`, `src/app/app/admin/page.tsx:10-13`) y «Recruiter» (`/app/recruiter`, `src/app/app/recruiter/page.tsx:8-11`). 21/10: «Profesional», «Pasaporte», «Wallet documental», «Panel de la organización», «Necesidades de personal», «Revisión de cualificaciones». Medido (xhigh) en ejecución: los 23 `<title>` en ES (alpha, manager.mro, platform.admin) y en EN (admin.mro y delta, con el idioma guardado en inglés; platform.admin con la cookie `en` para «Administration», «Verifications» y «Recruiter»), p. ej. «Mi espacio · Crew Flex» / «Overview · Crew Flex», «Profesionales elegibles · Crew Flex» / «Eligible professionals · Crew Flex»; la portada `/` queda en «Crew Flex» (sin `generateMetadata`). Favicon: `link rel=icon` `/icon.svg?…` (`image/svg+xml`, `sizes=any`) en todas v2 (`db05af1`, M07/M08): 27 páginas; nuevas «Oportunidades», «Oportunidad», «Mis candidaturas» (`/app/professional/*`) y «Candidaturas» (`/app/organization/requirements/[id]/applications`) (es:52-55). Medido v2: los 27 `<title>` en ES (alpha, manager.mro, platform.admin, echo, admin.other, sin sesión) y 20 en EN («Opportunities», «Opportunity», «My applications», «Applications»…; delta, admin.mro, platform.admin con la cookie `en`), con `lang` y favicon en todas (`evidencias/v2/50/raw/crawl-*.json`) | + | — | — | — |
| 3 | Coherencia título ↔ menú | — | cada página del menú se titula con su etiqueta, como el breadcrumb de v1.8 («CrewFlex / {etiqueta}»): «Documentos», «Mi espacio», «Resumen», «Mi pasaporte», «Necesidades», «Verificaciones» (`fd01c52`, W3-07; es:35-48 ↔ es:61-72); `tests/i18n/titles.test.ts:7-45` lo comprueba en ES y EN, también para las dos vistas nuevas (`meta.admin` = `nav.views.admin`, `meta.recruiter` = `nav.views.recruiter`). Las subpáginas mantienen su título («Nueva necesidad», «Necesidad», «Profesionales elegibles») v2: el test incluye ya `opportunities` y `applications` (`titles.test.ts:25-26`) | + (antes ≠) | — | — | — |
| 4 | Anuncio de cambio de ruta | ninguno (enrutado por hash; el título no cambia) | anunciador de rutas de Next (`next-route-announcer`, `node_modules/next/dist/client/components/app-router-announcer.js`: lee `document.title` en un efecto tras cambiar el árbol). Medido (xhigh, `next dev` 16.4.0): en 5 navegaciones por el menú quedó vacío en 4 (el `<title>` nuevo llega después del efecto y no difiere del anterior) y en la 5.ª anunció el H1 «Tu tiempo, a tu manera.» porque `document.title` estaba vacío en ese instante; el foco se queda en el enlace pulsado (`evidencias/xhigh/50/raw/announcer.txt`) v2, con `next start` (build de producción del SNAP): 7 de 7 navegaciones por el menú anuncian el `<title>` nuevo («Resumen · Crew Flex» … «Mis candidaturas · Crew Flex», `evidencias/v2/50/raw/announcer.txt`); el fallo era propio de `next dev` | + (v2: antes ≈) | — | — | — (verificado con `next start`) |
| 5 (nueva v2) | Página «No encontrado» | no hay 404: un hash desconocido abre Inicio (`LegacyApp.jsx:45`); título fijo | las páginas de plataforma denegadas y las rutas inexistentes responden **404** con el título neutro «Crew Flex» (X-11, `552415c`; medido v2: `/app/admin` y `/app/admin/verifications` como alpha, `/app/no-existe`, `/no-existe`). Pero un detalle inexistente (`/app/professional/opportunities/<id>`, `/app/organization/requirements/<id>`) responde **200** con el título de la página («Oportunidad · Crew Flex», «Necesidad · Crew Flex») y el cuerpo «No encontrado»: `notFound()` llega cuando `app/app/loading.tsx` ya ha empezado el streaming y `generateMetadata` no mira el recurso. La página «No encontrado» no tiene encabezado: `StateMessage` usa `<p>` (`src/app/not-found.tsx:8-13`, `StateMessage.tsx:21`) (`evidencias/v2/50/raw/notfound.txt`) | + | P3 | — | ajustar: título neutro en los detalles cuando el recurso no existe y un `h1` en «No encontrado» |

Capturas: —. xhigh: títulos y `lang` de las 23 páginas en `evidencias/xhigh/50/raw/crawl-es-*.json` y `raw/crawl-en-*.json`; anunciador en `raw/announcer.txt`. v2: `evidencias/v2/50/raw/crawl-es-*.json`, `raw/crawl-en-*.json`, `raw/announcer.txt`, `raw/notfound.txt`.

---

## META-03 · PWA, service worker y caché — v1.8 `dist/sw.js`, `main.jsx:6` ↔ Next (ninguno)

**Estado global:** PARCIAL. v1.8 no es instalable. Solo registra un SW de precarga cuando se sirve por `http(s)` (nunca desde `file://`, que es como se abre el HTML). Next no tiene SW ni manifest.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Service worker | `/sw.js`: caché `crewflex-…` con 4 ficheros (`/`, `/index.html`, CSS y JS); `install` precarga; navegación primero red con respaldo `/index.html`; assets primero caché; ignora `/api/`; **sin `skipWaiting` ni `clients.claim`** (`dist/sw.js`, `scripts/build.mjs:5-10`). Desde `file://` no se registra; en la sesión servida, `GET /sw.js` dio 404 en consola | no | − | P3 | SCOPE (AB-37 DEFERRED: «tools-only offline needs a scope decision; sessions must never be cached») (v2: sigue; el offline no figura en `V1_SCOPE.md` y un SW que cachee HTML con sesión sería inseguro) | no portar ahora |
| 2 | Manifest | no existe | no existe | = | — | — | — |
| 3 | `theme-color` / `color-scheme` | no | no | = | — | — | — |
| 4 | apple-touch-icon / `apple-mobile-web-app-*` | no | no | = | — | — | — |
| 5 | Offline de herramientas | herramientas en cliente; offline solo con el SW servido | motor de herramientas en cliente («calculations run in your browser», `tools-1440.jpg`), pero sin SW | ≈ | P3 | SCOPE (AB-37) (v2: sigue) | — |
| 6 | Cabeceras de seguridad | CSP estricta (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'…`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` y `Permissions-Policy` (`server/app.mjs:151`) (v2, medido en el conectado con `curl -I`: CSP aplicada y `Referrer-Policy: no-referrer`) | medido v2 (`curl -I`): CSP con nonce en **report-only** (`Content-Security-Policy-Report-Only`, `src/proxy.ts:11-17`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` (`next.config.ts:7-10`) | ≈ | — | — | fuera de alcance de este diff (seguridad); pasar a CSP obligatoria tras la ventana limpia (T18) |

Capturas: —. xhigh: `GET /sw.js` (404 en los dos), `manifest.webmanifest` (404) y registros de SW (0) en `evidencias/xhigh/50/raw/facts.txt`. v2: `evidencias/v2/50/raw/facts.txt` (404 de `/sw.js`, `/manifest.webmanifest`); cabeceras con `curl -I` (META-03 #6).

---

## A11Y-01 · Enlace de salto y landmarks — v1.8 `LegacyApp.jsx:45,78,87`, `ConnectedShell.jsx:10,13` ↔ Next `AppShell.tsx:70-75,134`, `NavLinks.tsx:46`, `ViewSwitcher.tsx:49`

**Estado global:** PARCIAL. En v1.8 el enlace de salto **rompe la navegación**. Next lo resuelve, pero solo lo ofrece dentro de `/app`.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Texto | «Ir al contenido» (`.skip-link`, fijo, `top:-100px`; al enfocar, `top:10px`; z 200) | «Saltar al contenido» (es:5), `sr-only focus:not-sr-only` (`AppShell.tsx:70-75`) | ≈ | — | — | — |
| 2 | Comportamiento | `href="#main"` cambia el hash y dispara `hashchange`. En la demo, `sync` no reconoce `main` y fuerza `activeTab='home'` (`LegacyApp.jsx:45`): **lleva a Inicio desde cualquier pantalla** y vuelve a montar `<main>`. En conectado, `page='main'`, así que se muestra la primera pestaña, el breadcrumb pasa a «Mi cuenta» y ningún ítem queda activo (`ConnectedShell.jsx:10`). Medido (xhigh): desde `#profile`, Enter en el salto lleva a `#home` y al H1 del inicio (v2, conectado medido: desde `#jobs` el salto lleva a `#main`, enseña el H1 de «Mi espacio» y ningún ítem queda activo, `evidencias/v2/50/raw/v18c-facts.txt`) | ancla normal a `<main id="main">`; el enrutado por rutas no se ve afectado. Medido (xhigh, 1440): primer Tab = «Saltar al contenido» visible (156×40, fondo blanco, arriba a la izquierda); Enter → `#main` y el Tab siguiente entra en el `main` («Herramientas» del inicio) v2: igual (`evidencias/v2/50/raw/kbd-pro.txt`, `A11Y-01-2-next-1440.jpg`) | ✗ | — | — | no portar (bug de v1.8); Next es correcto |
| 3 | Cobertura | en todos los shells (demo y conectado) | solo en el shell `/app`; no en landing ni en `(auth)` (medido: en `/login` el primer Tab va a la marca «CF Crew Flex») (v2: igual, `raw/kbd-login.txt`) | ≈ | P3 | — | mantener (páginas de un solo bloque) |
| 4 | Landmarks | `<aside>`, `<header>`, `<main id="main">`, `<footer>`; `nav` «Menú principal» y `nav` «Accesos rápidos» (dock) | `<aside>`, un `<nav aria-label={sección}>` por sección y `<main id="main">`; sin `header`/`footer` de shell. D-13 (`d3b876f`): para administradores, otro `<nav aria-labelledby>` «Ver como» (`ViewSwitcher.tsx:49-55`) v2 (M07/M08): `form role=search`, `nav` «Filtrar oportunidades», un `article` por tarjeta y `nav` «Páginas de oportunidades» (`opportunities/page.tsx:77-112,146`); `nav` de filtros en «Mis candidaturas» (`applications/page.tsx:92`); `article` etiquetado por candidatura en los dos lados | ≈ | — | — | — |
| 5 | Breadcrumb | `<span>`, no `nav` | no hay | = | — | — | — |
| 6 | Enlace activo | `aria-current="page"` en el menú y el dock | `aria-current="page"` (`NavLinks.tsx:58`); en «Ver como» (D-13), `page` en la portada de la vista y `true` en sus subpáginas (`ViewSwitcher.tsx:61-67`) | = | — | — | — |
| 7 (nueva v2) | Estado de los filtros (oportunidades y candidaturas) | «Todas / Compatibles / Planificado / Urgente / AOG» y los estados de candidatura son `button` en `div.filter-tabs` con solo la clase `active`: ni `aria-pressed` ni `aria-current` (medido v2 en `#jobs` y `#applications`) | enlaces con `aria-current="page"` en el filtro activo (`opportunities/page.tsx:104`, `applications/page.tsx:70`), así que la página tiene dos `aria-current="page"` a la vez: el menú («Oportunidades») y «Todas» (medido, `evidencias/v2/50/raw/kbd-newpages.txt`) | + | P3 | — | ajustar: `aria-current="true"` en los filtros (la página ya la marca el menú) |

Capturas: —. xhigh: `evidencias/xhigh/50/A11Y-01-skip-next-1440.jpg`; recorridos en `raw/kbd-pro.txt`, `raw/kbd-login.txt`, `raw/kbd-v18.txt`. v2: `evidencias/v2/50/A11Y-01-2-next-1440.jpg`; `raw/kbd-pro.txt`, `raw/kbd-login.txt`, `raw/kbd-newpages.txt`, `raw/v18c-facts.txt`.

---

## A11Y-02 · Foco visible, modales y drawer — v1.8 `v11.css:3`, `v17.css:2`, `v15.css:1`, `v13.css:1`, `refinement.css:4`, `Shared.jsx:98-141` ↔ Next `globals.css:51-58`, `NavDrawer.tsx`, `ConfirmButton.tsx`

**Estado global:** PARCIAL. Los dos tienen anillos de 3px, pero v1.8 mezcla cuatro colores y Next usa un único estilo. Desde `674b8b5` (W3-01) el anillo de Next es doble (navy + naranja) y pasa de 3:1 en blanco, canvas y menú navy; v1.8 (teal) queda en 3,12-3,35:1. Lo que falta son los modales, que Next no tiene. v2: 911 enfocables medidos en 50 cargas, todos con el anillo doble; al cancelar un paso de confirmación en línea el foco se pierde (fila 4).

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Anillo del shell | `.v11-shell :focus-visible{outline:3px solid #329b96;outline-offset:3px}` (teal; 3,35:1 sobre blanco, 3,12:1 sobre canvas). Medido (xhigh) en 479 enfocables de 10 pantallas: además 4,86 sobre el menú navy, **2,90** sobre la banda verde `#e5f1ed` («Entrar en mi cuenta conectada») y 3,00 sobre `.demo-banner` («Ver alcance»); 119 anillos quedan recortados por el `overflow:auto` del `nav` lateral y de otros contenedores (v2, conectado medido: el mismo teal `3px #329b96` y los campos `2px #369c98`, `evidencias/v2/50/raw/contrast-v18c-*.json`) | `:focus-visible{outline:3px solid var(--color-accent);outline-offset:2px;box-shadow:0 0 0 2px var(--color-navy)}` (`globals.css:54-58`; `674b8b5`, W3-01): el navy rellena el hueco junto al control (16,30:1 sobre blanco, 15,19:1 sobre canvas) y el naranja queda fuera (7,59:1 frente al navy; 5,39:1 sobre `navy-700`). Recalculado con los tokens actuales. Matiz: en los días con borrador del calendario las utilidades `outline-*` (`AvailabilityManager.tsx:399`) sustituyen el contorno naranja y el foco se ve solo por el navy (≥15:1). Descrito en `DESIGN_SYSTEM.md:44-46,78`. 21/10: solo naranja, 2,15:1 sobre blanco y 2,00:1 sobre canvas. Medido (xhigh, colores calculados) en los 390 enfocables de 21 páginas (ES, 1440): todos con `3px solid #ff982f` + sombra `#0c2137` de 2px y ninguno recortado; naranja frente a canvas 2,00, blanco 2,15, navy 7,59 y hero de herramientas 6,57; navy frente a blanco 16,30 y canvas 15,19. En `Button` el `transition-colors` también anima `outline-color` (150 ms desde `currentColor`): medir el anillo pasado ese tiempo v2 (`821c24f`): 911 enfocables en 50 cargas (incluidas oportunidades, el detalle con consentimiento, las candidaturas de los dos lados y las acciones de estado), todos con `3px solid #ff982f` + sombra `#0c2137`. Ningún anillo recortado al navegar con Tab: el menú lateral se desplaza dentro de la pantalla (X-03, `52929c9`) y el foco lo trae a la vista con 12px de margen (`evidencias/v2/50/A11Y-02-8-next-1440.jpg`, `raw/focus-clip.txt`); el barrido sin desplazamiento dio 2 falsos recortes | + (antes ≠) | — | — | — |
| 2 | Anillo en modales | `#e88b26` global (2,58:1): el portal queda fuera de `.v11-shell` | no hay modales | = | — | — | — |
| 3 | Anillos particulares | dock `#e59135` (2,49:1, medido a 390); medallas y mini-días lo declaran (`.tiny-medal:focus-visible,.mini-day:focus-visible`), pero en ejecución gana `.v11-shell :focus-visible` (teal, 3,12-3,35:1, medido); admin `#39a39b`; campos tb `2px #369c98`, incluso con foco de ratón (`:focus`) | uno solo | + | — | — | — |
| 4 | Foco inicial en modal | siempre la X «Cerrar ventana» (medido en «Estado de mi perfil»: anillo `#e88b26`, 2,58:1; Escape cierra y devuelve el foco al disparador); el bucle de Tab no excluye `select`/`textarea` deshabilitados; `inert` en `#root` | sin modales; `autoFocus` en «Mantenerla abierta» (`RequirementStatusActions.tsx:60`) y en «Cancelar» de `ConfirmButton`, que devuelve el foco al disparador si se cancela (`ConfirmButton.tsx:30-34,62-72`; `73de8ff`, W1-10) Medido v2: Enter en «Cerrar necesidad» lleva el foco a «Mantenerla abierta»; al cancelar, el foco cae en `body` (no vuelve al disparador, a diferencia de `ConfirmButton`) y Escape no cierra el paso (`raw/kbd-newpages.txt`, `A11Y-04-7-next-1440.jpg`). Lo mismo en las candidaturas: medido en «Cancelar candidatura aceptada», el foco entra en el motivo, el botón de confirmar sigue deshabilitado sin motivo, Escape no cierra y «Volver» deja el foco en `body` (`ApplicationActions.tsx:101-161`; `evidencias/v2/50/A11Y-02-4-next-1440.jpg`, `raw/kbd-appstep.txt`) | ≈ | P3 | — | ajustar: devolver el foco al botón que abrió el paso al cancelar y cerrar con Escape, como el modal de v1.8 y `ConfirmButton` |
| 5 | Drawer | sin `aria-expanded`/`aria-controls`; el foco no se mueve al menú; sin Escape ni trampa de foco. Medido (xhigh, 390): tras Enter en «Abrir menú» el foco sigue en la hamburguesa y el Tab avanza por la cabecera («Rol de demostración», «Vista móvil»…), porque el drawer está antes en el DOM; Escape no lo cierra (`evidencias/xhigh/50/SHOT-09-menu-abierto-foco-v18-390.jpg`) | `aria-expanded` + `aria-controls`; Escape solo con el foco en el botón; disclosure sin trampa (correcto para un panel en el flujo) (`NavDrawer.tsx:33-42`). Medido (xhigh, 390): orden salto → marca → «Cerrar sesión» → «Menú»; Enter abre (`aria-expanded=true`) con el foco en el botón y el Tab siguiente entra en «Ver como» y los enlaces; Escape con el foco dentro no cierra; con el foco en «Menú» sí; al elegir un enlace se cierra y el foco cae en `body` (el Tab siguiente va al `main`) (`evidencias/xhigh/50/SHOT-09-menu-abierto-foco-next-390.jpg`) (v2: igual, `raw/kbd-viewas.txt`, `A11Y-02-5-next-390.jpg`) | + | — | — | — |
| 6 | `outline:none` | ninguno vivo | ninguno | = | — | — | — |
| 7 (nueva xhigh) | Paradas internas de `input type=date` | `#calendar`: el campo de fecha tiene 4 paradas; las 3 de día/mes/año con anillo teal y la 4.ª (botón del selector nativo) sin indicador (`:focus-visible` no se aplica; medido) | igual en «Día 1 del ciclo (UTC)» (`CyclePlanner.tsx:74-76`): 3 paradas con anillo y la 4.ª sin indicador (`evidencias/xhigh/50/A11Y-02-date-stop3-next-1440.jpg`, `A11Y-02-date-stop3-v18-1440.jpg`) (v2: igual, `evidencias/v2/50/A11Y-02-7-next-1440-stop3.jpg`) | = | P3 | — | mantener (control nativo); opcional: contorno en `::-webkit-calendar-picker-indicator:focus-visible` |

Capturas: —. xhigh: `evidencias/xhigh/50/A11Y-02-dia-borrador-foco-next-1440.jpg`, `A11Y-02-2-modal-foco-v18-1440.jpg`, `A11Y-02-3-dock-foco-v18-390.jpg`, `A11Y-02-date-stop3-next-1440.jpg`, `A11Y-02-date-stop3-v18-1440.jpg`, `SHOT-09-menu-abierto-foco-next-390.jpg`, `SHOT-09-menu-abierto-foco-v18-390.jpg`; anillo de cada enfocable en `raw/contrast-*.json`; recorridos en `raw/kbd-*.txt` y `raw/v18focus.txt`. v2: `evidencias/v2/50/A11Y-02-8-next-1440.jpg`, `A11Y-02-5-next-390.jpg`, `A11Y-02-7-next-1440-stop3.jpg`, `A11Y-04-7-next-1440.jpg`; `raw/contrast-*.json`, `raw/focus-clip.txt`, `raw/kbd-*.txt`.

---

## A11Y-03 · Anuncios, toasts y estados — v1.8 `LegacyApp.jsx:87`, `Shared.jsx:113`, `Account.jsx:33-34` ↔ Next `Notice.tsx`, `StateMessage.tsx`, `AvailabilityMonth.tsx:37`

**Estado global:** PARCIAL. En v1.8 los toasts **no se anuncian** con un modal abierto (`#root` queda `inert`). Next no tiene toasts: anuncia en línea con `role=status`/`alert`.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Toast | `.v11-toast role=status` dentro de `#root`; con el modal abierto se ve (z 150) pero no se anuncia (A-css-meta 9, hallazgo 2) | sin toasts | ≈ | — | — | — |
| 2 | Resultado de acción | demo: toast; conectado: `<p role=status>` («Cambios guardados.») o `<p role=alert>` en línea (`Account.jsx:33-34`) (conectado: solo en código; guardar escribe) | `Notice`: `role=alert` (danger) o `status` (ok), con referencia de petición (`Notice.tsx:43-56`); desde `135085c` (W1-04) nunca muestra el mensaje bruto del servidor (`Notice.tsx:100-129`) v2: las acciones nuevas (candidatura, transiciones, pausar/reanudar/cerrar) usan el mismo `Notice` a través de `callAction`, que conserva la página y el borrador si la petición falla (X-02, `1c2616c`) | ≈ | — | — | — |
| 3 | «Guardando…» | `.saving-indicator role=status` | `common.saving` en el botón + `aria-busy` | ≈ | — | — | — |
| 4 | Error de almacenamiento | `.storage-error role=alert` | `ApiErrorState role=alert` por código (`ApiErrorState.tsx:14-36`) | ≈ | — | — | — |
| 5 | Regiones vivas | `role=log aria-live=polite` (mensajes, `Workflow.jsx:100`); `aria-live=polite` (combustible) | `aria-live` en resultados de herramientas, en la lectura «Se lee como {valor}» de los campos ambiguos (`parts.tsx:94-98`; `14dfaf0`, W1-06) y en el mes del mini calendario (`AvailabilityMonth.tsx:37`); `LoadingState` `role=status aria-live`; v2: contador «N oportunidades · página X de Y» con `role=status` (`opportunities/page.tsx:148-150`) | ≈ | — | — | — |
| 6 | Carga | sin esqueleto | esqueleto `motion-safe:animate-pulse` + texto `sr-only` (`StateMessage.tsx:30-37`) | + | — | — | — |

Capturas: —. v2: `evidencias/v2/50/raw/kbd-newpages.txt`.

---

## A11Y-04 · Controles personalizados, formularios, tablas y nombres accesibles — v1.8 A-css-meta 9.4 ↔ Next §8

**Estado global:** PARCIAL. Next mejora las etiquetas, `describedby` y las tablas. Desde `e37e95c` (W3-05) sus `radiogroup` siguen el patrón WAI-ARIA (flechas, Inicio/Fin y una sola parada de Tab; antes NX-09). v1.8 usa `aria-pressed` en todo. v2: las páginas de M05/M07/M08 añaden confirmaciones con motivo o casilla (fila 7), consentimiento (fila 8) e historial plegable (fila 9).

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Opciones exclusivas | `aria-pressed` en botones: visibilidad (`Professional2.jsx:251`), modo, pestañas, vista compacta/ampliada, días… | `role=radiogroup` + `role=radio aria-checked` con `tabindex` itinerante (una parada: la opción marcada) y flechas/Inicio/Fin que mueven foco y selección (`src/components/ui/radio-group.ts:7-44`; idioma: `LocaleSwitcher.tsx:50-52,56-77,87-110`; visibilidad: `ProfileForm.tsx:150-178`). `radioKeyTarget` tiene test (`radio-group.test.ts`). Idioma usa `aria-disabled` mientras cambia, para no perder el foco; visibilidad sigue con `disabled` durante el envío (`ProfileForm.tsx:165`). 21/10: sin flechas (NX-09). Medido (xhigh): en `/login`, ES/EN es una sola parada (`tabindex` 0/−1) y →/← mueven foco y selección (cambia `<html lang>`); en «Mi pasaporte», → recorre las tres opciones y vuelve a la primera, Inicio/Fin van a los extremos, Tab sale a «Guardar cambios» y Mayús+Tab vuelve a la opción marcada (`evidencias/xhigh/50/A11Y-04-radio-visibilidad-next-1440.jpg`); en Configuración, una sola parada (sin probar flechas: guardaría en BD). v1.8 (`#privacy`, medido): las flechas no mueven el foco v2: igual en ES/EN y visibilidad (`raw/kbd-login.txt`, `raw/kbd-pro.txt`, `A11Y-04-1-next-1440.jpg`); las páginas nuevas no añaden grupos de opciones exclusivas | + (antes ≈) | — | — | — |
| 2 | Toggles | `aria-pressed` | `aria-pressed` (selector de estado, días del ciclo, favoritos) | = | — | — | — |
| 3 | Etiquetas | implícitas (`<label>` envolvente), sin `htmlFor`; `aria-invalid` sin `aria-describedby` (`Professional2.jsx:80`) | `label htmlFor` + `aria-describedby` a hint/error (`Field.tsx`) | + | — | — | — |
| 4 | Tablas | no hay `<table>` alcanzable | `caption` sr-only + `th scope` (`RequirementsList.tsx:19`, `verifications/page.tsx:58`) | + | — | — | — |
| 5 | Nombres inválidos | `aria-label` en `<span class="cf-avatar">` y `<div class="medal-strip">` sin `role` (genéricos); punto de no leídas sin texto | `aria-hidden` en los iconos; prefijos sr-only «Cumple:»/«No cumple:» (`MatchCard.tsx:118`); el avatar de iniciales del inicio es `aria-hidden` dentro de una `section` con `aria-label` «Tu identidad profesional» (`IdentityCard.tsx:18-27`) | + | — | — | — |
| 6 | Calendario | `aria-label` «{fecha ISO}: {estado}[, sin guardar]» (`ConnectedCalendar.jsx:12`); en el mini, «…{n} oportunidades» sin plural | «{AAAA-MM-DD}: {estado}» (ISO, sin localizar) (`AvailabilityMonth.tsx:71`, `AvailabilityManager.tsx:398`); `aria-current="date"` en hoy solo en el mini calendario (`AvailabilityMonth.tsx:72`; el editable no lo lleva); desde `bfbe531` (W1-03) los días pasados del calendario editable son botones `disabled` (`AvailabilityManager.tsx:396`), como `.mini-day:disabled` de v1.8 v2: los días con asignación confirmada añaden «, asignación confirmada» a la etiqueta (`:398`) y la marca visible es `aria-hidden` (`:406`) | ≈ | — | — | — |
| 7 | Destructivo | sin confirmación nativa en conectado; modales de confirmación en la demo | confirmación en línea en las cuatro acciones irreversibles: cerrar necesidad (`RequirementStatusActions.tsx:48-64`; «Pausar» y «Reanudar» son de un clic porque se deshacen, `:66-82`, M05), borrar documento y, desde `73de8ff` (W1-10), quitar cualificación y eliminar ventana con `ConfirmButton` (`QualificationsManager.tsx:346`, `AvailabilityManager.tsx:513`); el foco va a «Cancelar» v2 (M08): rechazar y cancelar piden motivo, aceptar pide marcar la versión de la propuesta, y proponer, confirmar y retirar piden un segundo paso; solo «Preseleccionar» es de un clic (`ApplicationActions.tsx:20-25,99-161`). Medido: el paso de cierre de la necesidad (`evidencias/v2/50/A11Y-04-7-next-1440.jpg`) | ≈ | — | — | — |
| 8 (nueva v2) | Consentimiento al presentar candidatura | modal «Preparar Candidate Pack»: fechas, documentos y experiencia a compartir, dos casillas («Autorizo compartir este expediente con la organización de la oferta», obligatoria; «Autorizo desbloquear identidad, contacto y archivos seleccionados si acepto la propuesta», opcional) y vista previa; «Enviar candidatura» deshabilitado hasta cumplir las reglas y el consentimiento (`D-TEC-04e-preparar-candidatura-1440.png`, `v18-runtime-demo.md` §D-TEC-04) | panel «Candidatura» del detalle: lista de lo que verá la organización y de lo que no (`ApplyPanel.tsx:78-86`) y una casilla con `<label>` envolvente («Autorizo compartir con {organización} estos datos para esta necesidad.», es:1285; nombre accesible medido); «Presentar candidatura» deshabilitado hasta marcarla (`:87-99`). Medido v2: Espacio la marca (solo estado local, sin enviar) y habilita el botón; 44px con puntero grueso (`evidencias/v2/50/A11Y-04-8-next-1440.jpg`, `raw/consent.txt`) | ≠ | P3 | D-07 P3/D-10 (documentos); Q6 (una candidatura = todo el periodo, decidido); desbloqueo de contacto: M09 preparado y apagado | mantener; la casilla de desbloqueo y los documentos llegan con el Candidate Pack (D-07) |
| 9 (nueva v2) | Historial de la candidatura | «Ver expediente» abre un modal con la línea de tiempo «Recibida … Finalizada» (`D-TEC-05b-expediente-1440.png`) | `details`/`summary` «Historial» con triángulo ▸/▾ (X-07, `globals.css:59-71`) y 44px con puntero grueso (`ApplicationDetails.tsx:47-63`); lista de eventos con actor y versión. Medido v2: Enter lo abre y el marcador pasa a «▾» (`evidencias/v2/50/A11Y-04-9-next-1440.jpg`) | ≠ | — | — | mantener |

Capturas: —. xhigh: `evidencias/xhigh/50/A11Y-04-radio-visibilidad-next-1440.jpg`, `A11Y-kbd-login-radio-next-1440.jpg`; `raw/kbd-login.txt`, `raw/kbd-pro.txt`, `raw/kbd-v18.txt`. v2: `evidencias/v2/50/A11Y-04-1-next-1440.jpg`, `A11Y-04-1b-next-1440.jpg`, `A11Y-04-7-next-1440.jpg`, `A11Y-04-8-next-1440.jpg`, `A11Y-04-9-next-1440.jpg`; `raw/kbd-*.txt`, `raw/consent.txt`.

---

## A11Y-05 · Objetivos táctiles (44px) — v1.8 A-css-meta 9.7 ↔ Next `pointer-coarse:min-h-11` (NX-07)

**Estado global:** PARCIAL. Los dos cumplen en botones, campos y menú. Desde `7255055` (W3-04) Next también cubre los controles compactos que faltaban (flechas del mes, favorito, `summary`, «Quitar comparación»); sigue aplicando los 44px solo con puntero grueso. Medido (xhigh) con `hasTouch` (`pointer: coarse` = true) en las 24 rutas de Next a 390 (menú cerrado y abierto) y a 1024, y en 11 pantallas de v1.8 a 390: Next queda por debajo de 44 en el «Cerrar sesión» del pie (89×20 a 1024), las casillas con etiqueta (filas 5 y 10), varios enlaces de texto sueltos y la marca (fila 11) y el ancho del ES/EN (fila 12); v1.8 tiene muchos más (43 en su inicio, 61 en «Crear oferta»). v2 (X-09, `5d85caa`): resueltos el «Cerrar sesión» del pie, las casillas con etiqueta, el ES/EN, la marca del shell y los enlaces de auth y herramientas; quedan la marca de auth (36px) y algunos títulos enlazados de listas y tarjetas (fila 11).

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Botones y campos | `.action` 44, `.control` 44, `.tb-field` 44, `.icon-button` 44×44; `.tb-button` **42**; `.action.link` **28** | 40px en escritorio y 44 con puntero grueso (`Button.tsx:11-14`, `Field.tsx:4`) | ≈ | — | — | — |
| 2 | Menú | `.sidebar button` 44; dock 53 | `pointer-coarse:min-h-11` (`NavLinks.tsx:59`); «Menú» y el «Cerrar sesión» de la barra superior igual (`NavDrawer.tsx:39`, `AppShell.tsx:102`). v2 (X-09, `5d85caa`): también el «Cerrar sesión» del pie del sidebar (`AppShell.tsx:125-130`); medido a 1024×768 con `hasTouch`: ningún objetivo del shell por debajo de 44 (`evidencias/v2/50/raw/touch-padmin1024.json`). xhigh: 89,2×20 | = (v2: antes ≈) | — | — | — (HECHO, X-09) |
| 3 | Navegación del mes | flechas `Button` 44 | 36px en escritorio y 44 con puntero grueso (`size-9 pointer-coarse:size-11`, `AvailabilityMonth.tsx:44,51`; `7255055`, W3-04) | ≈ (antes ≠) | — | — | — |
| 4 | Favorito | `.tb-favorite` 32×38 (medido a 390) | 40px en escritorio y 44 con puntero grueso (`size-10 pointer-coarse:size-11`, `ToolsHome.tsx:135`; W3-04) | + (antes ≈) | — | — | — |
| 5 | Chips, filtros y medallas | 38 / 36 (44 a ≤600) / 38 / cierre de detalle 32 (medido a 390: chips de aeronave, motor y días de «Crear oferta» 38 de alto; medallas 38-42) | medido con puntero grueso a 390: «Comparar» y «Solo elegibles» a 44 (`MatchList.tsx:61,92`) y el `select` de nivel `min-h-9 pointer-coarse:min-h-11` (`RequirementForm.tsx:212`); **pero** las casillas de cualificación de «Nueva necesidad» no: la etiqueta mide 21px (41 en dos líneas) (`RequirementForm.tsx:192-206`; ver fila 10). El 21/10 decía «casillas `size-4` con etiqueta de 44», que solo es cierto en matching v2 (X-09): las casillas de «Nueva necesidad» llevan `pointer-coarse:py-3` en la etiqueta (`RequirementForm.tsx:200-203`) y miden ≥44 a 390 y 1024 (`raw/touch-mgr390.json`, `raw/touch-mgr1024.json`) | + (v2: antes ≈) | — | — | — |
| 6 | Cierre del drawer | X de **30**×44 | sin X: el mismo botón «Menú» | + | — | — | — |
| 7 | Botones de texto | `.demo-banner button` y `.beta-links button` de unos 16-19px (el reset `*` de `index.css` les quita el padding) | `pointer-coarse:min-h-11` en «Quitar comparación» (`MatchList.tsx:174-179`), en el `summary` «Fórmula, fuentes y alcance» (`parts.tsx:168`) y en el `summary` de la lista de comprobación del inicio (`src/app/app/professional/page.tsx:238`); `ui-smoke` 25 mide enlaces etiquetados y `summary` (no re-ejecutado: sin Docker) | + (antes ≈) | — | — | — |
| 8 | Celdas del calendario | 60-70 de alto y unos 40 de ancho en móvil (medido: 42,3×60-70 a 390) | `min-h-16 sm:min-h-20` (`AvailabilityManager.tsx:399`); mini `min-h-9` (no interactivo). Medido: 41,7×64 a 390 (7 columnas en 316px; el ancho no llega a 44 en ninguno de los dos) | = | — | — | — |
| 9 (nueva) | Selector de espacio (D-13) | `select` de «Probar como»: 12px con `padding:8px 10px`, 105×34 (medido a 390; `v11.css:3`) | enlaces de «Ver como» `py-2 text-sm` (unos 36px) con `pointer-coarse:min-h-11` (`ViewSwitcher.tsx:68`; D-13, `d3b876f`); medido: ≥44 con puntero grueso a 390 y 1024 | + | — | — | — |
| 10 (nueva xhigh) | Casillas con etiqueta | filas de casilla de 22px con puntero grueso (medido a 390: `#privacy` ×4, `#create` ×8, «Solo elegibles con cobertura» 200×22 en `#candidates`) | medido a 390 con `hasTouch`: «Nueva necesidad», 17 casillas cuya etiqueta mide 21px (41 en dos líneas) (`RequirementForm.tsx:192-206`); ciclo, «Publicar descansos generados como disponibles» y «Reemplazar también…», 40px a 390 y 20px a 1024 (`CyclePlanner.tsx:146-167`); conversor, «Convertir también nominal ± tolerancia», 20px (`UnitConverter.tsx:217-224`) v2 (X-09, `5d85caa`): todas ≥44 con puntero grueso a 390: casillas de «Nueva necesidad», del ciclo (`CyclePlanner.tsx:146-167`) y del conversor (316×44), y la casilla nueva de consentimiento (`ApplyPanel.tsx:87`) (`raw/touch-*.json`, `raw/misc.txt`) | + (v2: antes ≈) | — | — | — (HECHO, X-09) |
| 11 (nueva xhigh) | Enlaces de texto sueltos y marca | medido a 390: «Ver alcance» 77×16, «Abrir herramienta» 148×19, «Ver todas» 94×32 | v2 (X-09): ya miden 44 «¿Has olvidado tu contraseña?» y «Volver a iniciar sesión» (`login/page.tsx:30-35`, `forgot-password/page.tsx:27-32`), la marca del shell (`AppShell.tsx:80-83`), «NIST · unidades y factores» (166,7×44) y los títulos de la lista móvil de necesidades (`RequirementsList.tsx:76-81`). Siguen por debajo con puntero grueso: la marca «CF Crew Flex» de auth, 128,5×36 (`src/app/(auth)/layout.tsx:12`; ya medida en xhigh, no listada); los títulos de la tabla de necesidades de ≥md, 37px en dos líneas a 1024 (`RequirementsList.tsx:43`); los títulos de las tarjetas de oportunidad, 41px (`OpportunityCard.tsx:41`), y los del feed del inicio, 37px (`ProfessionalActivity.tsx:69-74`): `pointer-coarse:py-2.5` sobre un enlace en línea no llega a 44; el título enlazado de «Mis candidaturas» no lleva ajuste (`applications/page.tsx:117-122`; solo código, con los datos actuales ninguno es enlace). «Crea una», «Inicia sesión», «Solicitar un enlace nuevo» y «Abrir documentos» van dentro de una frase (excepción de WCAG 2.5.8) (`raw/touch-*.json`) | ≈ | P3 | — | ajustar: `inline-flex pointer-coarse:min-h-11` en esos enlaces (el `py-2.5` no basta con una línea) |
| 12 (nueva xhigh) | Selector ES/EN compacto (portada y auth) | no existe | v2 (X-09, `5d85caa`): `pointer-coarse:min-w-11` (`LocaleSwitcher.tsx:68`): 44×44 en la portada y en auth a 390 con `hasTouch` (`raw/touch-anon390.json`, `raw/misc.txt`). xhigh: 33×44 y 34×44 | + | — | — | — (HECHO, X-09) |
| 13 (nueva v2) | Filtros y acciones de M05/M07/M08 | `.filter-tabs` de `#jobs` y `#applications` y botones de `#manage`: medido v2 a 390 con puntero grueso, solo quedan por debajo de 44 los controles del shell de demo («Rol de demostración» 105×34, «Ver alcance» 77×16) (`raw/touch-v18-new-390.json`) | filtros `min-h-9 pointer-coarse:min-h-11` (`opportunities/page.tsx:105`, `applications/page.tsx:71`), «Pausar»/«Reanudar»/«Cerrar necesidad», acciones de candidatura, casilla de consentimiento y `summary` «Historial» ≥44; medido v2 a 390 en oportunidades, detalle, candidaturas de los dos lados y detalle de necesidad: 0 objetivos por debajo salvo los títulos enlazados de la fila 11 (`raw/touch-*390.json`) | = | — | — | — |

Capturas: `evidencias/shots/demo/D-TEC-03-disponibilidad-390.png`; Next `v18-compare/next-after/tech-availability-390.jpg` (lote 11). xhigh: medidas en `evidencias/xhigh/50/raw/touch-*.json`; menú abierto `evidencias/xhigh/50/touch-alpha390-menu.jpg`, `touch-v18-390-menu.jpg`. v2: `evidencias/v2/50/SHOT-09-1-next-390.jpg` (menú abierto); medidas en `raw/touch-*.json` (390 y 1024, con `hasTouch`) y `raw/misc.txt`.

---

## A11Y-06 · Contraste (WCAG 2.x, calculado) — pares clave de ambos lados

**Estado global:** PARCIAL. Medido en ejecución (xhigh) con los colores calculados (`getComputedStyle`, fondos compuestos y opacidad) en todos los textos visibles de 21 páginas de Next (ES, 1440) y 10 pantallas de v1.8 (1440, más el dock a 390). Next sube el texto secundario por encima de 4,5:1 y elimina los fallos de v1.8 (pie 2,40, descanso 3,41, AOG 3,35, dock 3,34, «Probar como» 3,56). Desde `674b8b5` y `ac28483` (W3-01, W3-03) también resuelve los tres puntos débiles del 21/10: anillo de foco (≥7,59:1 en su parte de mayor contraste), placeholder (5,18) y nota de herramientas (5,17 a 12px). Quedan dos fallos propios de Next: la nota de privacidad de herramientas (3,96:1; en v1.8 el texto es `#587083`, 4,82:1, así que es una regresión, fila 17) y el botón «Iniciar sesión» de la portada, blanco sobre blanco (1:1, fila 19). Por debajo de 4,5 solo quedan además los días pasados atenuados (2,40), exentos en el calendario editable (botones `disabled`) pero no en el mini calendario del inicio. v2: resueltos los dos fallos propios de Next (nota de privacidad, X-10; portada, X-01) y 0 textos bajo umbral en las páginas nuevas (fila 20); solo quedan los días pasados del mini calendario (2,40-2,45).

| # | Elemento | v1.8 (fg/bg → ratio) | Next (fg/bg → ratio) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Texto secundario sobre canvas | `.page-title p` `#718396/#f5f7fa` → **3,63** | `PageHeader` `#5b6f84/#f5f7fa` → 4,83 | + | — | — | — |
| 2 | Texto secundario sobre blanco | `.metric span` `#667c90` → 4,33; `.metric small` `#8393a2` → **3,15**; `.secondary` v12 `#536b80` → 5,55 | `muted` `#5b6f84/#fff` → 5,18 | + | — | — | — |
| 3 | Pie | `#95a3b0/#f5f7fa` → **2,40** (9px) | sin pie | ✗ | — | — | — |
| 4 | Menú navy | botón `#aabed1` → 8,53; etiqueta `#819bb2` → 5,64; «AVIATION» `#91aac1` → 6,77; activo blanco/`#203b54` → 11,57; icono activo `#ffad54/#203b54` → 6,26 | `#c4d3e1` → 10,67; etiqueta `#91aac1` → 6,77; activo → 11,57; icono `#ff982f/#203b54` → 5,39 | = | — | — | — |
| 5 | Acento sobre navy (isotipo) | `#0c2137/#ff982f` → 7,59 | igual (CF) → 7,59 | = | — | — | — |
| 6 | CTA principal | `#172b3e/#ff982f` → 6,74 | `#172c44/#ff982f` → 6,61 | = | — | — | — |
| 7 | CTA teal | blanco/`#057f7d` → 4,84 | igual → 4,84 | = | — | — | — |
| 8 | Chips | neutro `#597084/#edf2f6` 4,57; verde 5,07; naranja 4,53; azul `#316d9a` 4,91; rojo 5,26 | neutral `#5b6f84/#f5f7fa` 4,83; ok 5,07; warn 4,53; info `#18558f/#eaf2fa` 6,79; danger 5,26 | = | — | — | — |
| 9 | Calendario | medido: descanso **3,41** en la celda (`#758892/#f5f6f8`; el 2,75 de `.calendar-day.off` es la regla base, anulada por `.availability-v17`), 4,22 en el chip y 3,67 en el mini; AOG `#bd752b/#fff3e6` **3,35**; disponible 5,08; trabajo 4,67; parcial `#4b776d` 4,60/4,13; días pasados del mini `.mini-day:disabled` (.4) → 1,57 | bloqueado 4,83; AOG 4,53; disponible 5,07; parcial `#16745d` 5,18/4,66; **días pasados con `opacity-60` → 2,40 medido** (`#9da9b5` efectivo sobre blanco; `AvailabilityMonth.tsx:73`; en el mini no son controles, así que la exención de 1.4.3 no aplica allí). Desde `bfbe531` (W1-03) también en el calendario editable, donde son botones `disabled` (`AvailabilityManager.tsx:396,399`): WCAG 1.4.3 exime los controles inactivos v2: también los días disponibles pasados: `#6aa897` sobre `ok-bg` → 2,45 (mini del inicio, no exento; en el editable, botones `disabled`) (`evidencias/v2/50/raw/contrast-*.json`) | + | P3 | — | mantener (días pasados = información atenuada a propósito) |
| 10 | Dock | etiqueta `#78909d/#fff` → **3,34** (9px, medido a 390); activo `#1b7a68/#e8f4ef` → 4,62 | sin dock | − | — | — (v2: default v1.8, C-12) | si se porta el dock, etiqueta ≥4,5:1 y ≥11px |
| 11 | Bandas | `.workspace-mode` 5,46; `.demo-banner` 4,21 (11px) | — | ✗ | — | DEMO-ONLY | — |
| 12 | Kickers de herramientas | `.tb-kicker #157877/#f5f7fa` → 4,91 (10px) | igual `#157877` → 4,91, ahora a 12px (`ToolsHeader.tsx:10`; `9483667`, W3-09); hero `#7bd5cc/#112e40` → 8,22; caption `#91c7c9/#103b49` → 6,43 | = | — | — | — |
| 13 | Nota de herramientas | `.tb-footnote{font-size:11px;color:#718492!important}` (`v13.css`; Toolbox ×3, Badges, Translator…) en paneles blancos → **3,88** (11px). Corregido el 22/10: el informe anterior ponía «—» | `Footnote` `#587083`, 12px (`parts.tsx:187-190`; `ac28483`, W3-03) → 5,17 (blanco) / 4,82 (canvas); `tests/design/contrast.test.ts:37-45` lo comprueba | + (antes −) | — | — | — |
| 14 | Placeholder | `.control` sin color propio: el del navegador, `#757575` sobre `#fafcfe` → 4,48 (medido en `#candidates`) | `placeholder:text-muted` → `#5b6f84/#fff` 5,18 (`Field.tsx:4`; `ac28483`, W3-03; test en `contrast.test.ts:33-35`). 21/10: `muted/70` → 2,87. Medido (xhigh): 5,18 en «Madrid (MAD)», «Escribe un valor» y los campos de auth | + (antes −) | — | — | — |
| 15 | Anillo de foco | teal `#329b96` 3,35 (blanco) / 3,12 (canvas) / 4,86 (navy) / **2,90** (banda `#e5f1ed`) / 3,00 (`.demo-banner`); naranja de los modales `#e88b26` **2,58**; dock `#e59135` **2,49**; todo medido en ejecución | doble: navy `#0c2137` 16,30 (blanco) / 15,19 (canvas) junto al control + naranja `#ff982f` 7,59 frente al navy del menú (`globals.css:54-58`); medido en los 390 enfocables de 21 páginas (ver A11Y-02 #1). 21/10: solo naranja, **2,15** / **2,00** | + (antes ≠) | — | — | ver A11Y-02 #1 |
| 16 | Favicon | avión `#ff982f` sobre `#0c2137` → 7,59 | «CF» `#0c2137` sobre `#ff982f` → 7,59 (`icon.svg:2-3`; 21/10: `#0f172a`/`#f59e0b` → 8,31) | = | — | — | ver VIS-08 #4 |
| 17 (nueva) | Nota de privacidad de herramientas | `.tb-bottom-note{color:#4a857c}` (`v13.css`) solo llega al icono: el texto lo pisa `.toolbox p{color:#587083}` (más específico que la herencia), así que se ve `#587083` a 12px sobre `#f5f7fa` → **4,82** (medido en `#tools`) | v2 (X-10, `cac7461`): el texto lleva `text-[#587083]` y el teal queda en el icono (`ToolsHome.tsx:158-162`) → 4,82 sobre canvas, como v1.8 (medido: 0 textos bajo 4,5:1 en `/app/tools`, `raw/contrast-alpha.json`); test `contrast.test.ts:56-64`. xhigh: `text-[#4a857c]` heredado por el texto, 3,96 | = (v2: antes ≠) | — | — | — (HECHO, X-10) |
| 18 (nueva) | Selector «Ver como» (D-13, `d3b876f`) | «Probar como»: `select` `#1b3853` sobre `#f1f5f9` → 11,03 (12px; `v11.css:3`); su texto «Probar como» (`#788a9a`, 11px) se ve por encima de 1200px y da **3,56:1** sobre blanco (medido a 1440; oculto a ≤1200px) | medido: etiqueta «VER COMO» `#91aac1/#0c2137` → 6,77 (11px, 600); enlaces `#c4d3e1/#0c2137` → 10,67; vista actual blanco/`#203b54` → 11,57 con borde naranja 5,39 (`ViewSwitcher.tsx`; D-13, `d3b876f`) | + (xhigh: antes =) | — | — | — |
| 19 (nueva xhigh) | Portada: botón «Iniciar sesión» y estado del ES/EN | no hay portada (el HTML abre la demo) | v2 (X-01, `ef4d9b7`, `409c744`): variante `inverse` (`Button.tsx:23`, `src/app/page.tsx:36-38`): texto blanco sobre navy 16,3:1 y borde 3,71:1; ES/EN con `onDark`: la opción marcada es blanca con texto navy (16,3:1) y la no marcada lleva borde blanco/40 (3,71:1) (`LocaleSwitcher.tsx:68-72`, `src/app/page.tsx:22`); 44×44 con puntero grueso a 390. Test `contrast.test.ts:66-83` (`evidencias/v2/50/A11Y-06-19-next-1440.jpg`, `-390.jpg`, `raw/misc.txt`). xhigh: blanco sobre blanco, 1:1, y estado del ES/EN invertido | + | — (v2: antes P1) | — | — (HECHO, X-01) |
| 20 (nueva v2) | Páginas de oportunidades, candidaturas y acciones (M05/M07/M08) | medido v2 en la demo: filtros inactivos y estados «Recibida» 3,72 (11px), «/ día ·» 3,64, «Cumples requisitos y disponibilidad» 4,44, contador «1» 3,75, «Selecciona otra oferta o prepara una candidatura.» 2,82 (12px), descripción de cabecera 3,63; en el conectado, en oportunidades, candidaturas y avisos solo falla el pie (2,40) (`raw/contrast-v18-new.json`, `raw/contrast-v18c-*.json`) | medido v2: 0 textos bajo 4,5:1 en oportunidades, detalle, «Mis candidaturas», candidaturas de una necesidad, detalle con acciones de estado y contadores de los dos inicios (14 cargas con datos); único caso, «Finalizar» deshabilitado 3,02, exento; «● Asignada» navy sobre `ok-bg` 14,51; chips de veredicto ok/danger/warn ≥4,53 (`raw/contrast-*.json`) | + | — | — | — |

Capturas: —. (Cálculo propio con la fórmula WCAG 2.x de luminancia relativa; los valores de v1.8 coinciden con A-css-meta 9.7.) xhigh: todos los pares texto/fondo medidos en `evidencias/xhigh/50/raw/contrast-padmin.json`, `contrast-mgr.json`, `contrast-anon.json`, `contrast-v18.json`, `contrast-v18-390.json`; `A11Y-06-landing-boton-invisible-next-1440.jpg`, `-390.jpg`. v2: `evidencias/v2/50/A11Y-06-19-next-1440.jpg`, `A11Y-06-19-next-390.jpg`; todos los pares en `raw/contrast-*.json` (Next, demo `contrast-v18-new.json` y conectado `contrast-v18c-*.json`).

---

## I18N-01 · Arquitectura de idioma — v1.8 (sin i18n) ↔ Next `next-intl` (`src/i18n/*`, `messages/{es,en}.json`)

**Estado global:** SOLO EN NEXT. v1.8 es monolingüe en español, con literales en el JSX y sin catálogo. Next es bilingüe ES/EN con catálogos paritarios y **defecto `en`** (C-5, decidido).

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Librería | ninguna; unas 2 100 cadenas de prosa en literales JSX/JS (`string-diff.json` `v18_prose` = 2 101) | `next-intl` 4.14.9 sin routing por locale (`next.config.ts:33-35`, `src/i18n/request.ts:13-31`) | + | — | — | — |
| 2 | Idiomas | solo `es` (`lang="es"` fijo) | `es`, `en` (`src/i18n/config.ts:3`); 1 020 claves hoja en cada catálogo (v2; xhigh 856; 21/10: 802), paridad 0/0 (`tests/i18n/messages.test.ts`) | + | — | C-5 | — |
| 3 | Idioma por defecto | español siempre | **`en`** si no deciden la preferencia guardada, la cookie `crewflex-locale` ni `Accept-Language` (`config.ts:7`; `I18N_STRATEGY.md:33-39`). Consecuencia visible: **todas las capturas `next-after` del lote 11 están en inglés** | ≠ | P3 | C-5 | mantener; recordar en QA que se capture con `Accept-Language: es` |
| 4 | Selector de idioma | no | en `/app/settings` (tarjetas `radiogroup`), y ES/EN compacto en landing y auth (`settings/page.tsx:41`, `(auth)/layout.tsx:21`, `src/app/page.tsx:22`); no hay selector en el shell | + | — | — | — |
| 5 | Zona horaria | la local del navegador (Europe/Madrid en la sesión) | UTC fijo (`request.ts`, BR-10) | ≠ | P3 | — | mantener (decisión BR-10) |
| 6 | Formatos | `toLocaleString('es-ES')` en casi todo, pero sin locale en `Account.jsx:71,74,79` (depende del navegador); moneda `es-ES` EUR (`Account.jsx:16`, `ConnectedHome.jsx:13`…); fechas «5 dic → 11 dic» | `src/i18n/format.ts`: `en-GB`/`es-ES`, UTC, fecha corta en MAYÚSCULAS («18 OCT → 22 OCT», `format.ts:20`); sin moneda (no hay tarifas) v2: `formatMonth` con mayúscula inicial (`format.ts:39-43`, X-18) y `formatPercent` con la coma del idioma (`:45-46`, X-05) | ≠ | P3 | — (v2: desbloqueado; tarifas en LATER) | mantener; formato de moneda EUR por idioma al portar las tarifas |
| 7 | Validación | mensajes en español en el código (p. ej. «El ciclo debe caber en 31 días.», `planning.js`) | claves `v.*` emitidas por zod y traducidas en cliente (`src/i18n/validation.ts:14-26`); desde `135085c` (W1-04) las acciones del servidor también devuelven claves (`common.checkFields`, `v.form.*`) | + | — | — | — |
| 8 | Lo que no se traduce | — | códigos de licencia, tipos de aeronave y datos del usuario (`I18N_STRATEGY.md:30`) | + | — | — | — |
| 9 (nueva xhigh) | Porcentajes con decimales | porcentajes enteros («Tu pasaporte está al {score}%», `TechnicianHome.jsx:15`; «0%» medido en el inicio) | v2 (X-05, `f740447`): `{percent, number}` en los mensajes (es:928, es:936; también es:492-493,511) y `formatPercent` en la tabla de comparación (`MatchList.tsx:254`) y en la métrica del inicio (`src/app/app/professional/page.tsx:127`); medido: «Disponible solo el 48,78% del periodo de la necesidad» y «Cubre el 41,46% del periodo» en ES (`evidencias/v2/50/raw/contrast-mgr.json`), «86%» en el inicio. xhigh: «48.78%» con punto (argumento ICU simple impreso con `String()`) | ≈ (v2: antes ≠) | — | — | — (HECHO, X-05); v1.8 redondea a entero |

Capturas: Next `v18-compare/next-after/*.jpg` (lote 11, EN) frente a `local-19-matches-es-1440.jpg` y `local-21-login-es.jpg` (lote 13, ES). v2: `evidencias/v2/50/raw/contrast-mgr.json` («48,78%»).

---

## I18N-02 · Cobertura de cadenas v1.8 → `messages/es.json` — `textos/string-coverage-v2.md`, `textos/string-diff-v2.json` (v2; xhigh: `string-coverage.md`)

**Estado global:** PARCIAL. v2 (`821c24f`): **el 14,1 %** de las 2 101 cadenas de interfaz de v1.8 tiene equivalente en el catálogo ES de Next: 260 exactas y 37 aproximadas (297). Quedan 1 804 solo en v1.8. Desde el otro lado, 667 de las 1 020 claves de Next no tienen contrapartida en v1.8. xhigh: 11,7 % (214 + 31), 856 claves, 569 sin contrapartida.

v2 (22/10, tarde): tabla tomada de `textos/string-coverage-v2.md` (mismo método y mismas 2 101 cadenas; solo cambia el catálogo). Ese fichero reparte cada cadena al **primer fichero v1.8 que la contiene**, incluido el código muerto (`components/screens/*`, `components/company/*`, `Header`, `Navbar`, `App.jsx`), así que el reparto por fichero no coincide con el de la xhigh (que solo contaba ficheros vivos): por ejemplo, `Company2.jsx` pasa de 141 a 114 cadenas y aparecen 15 ficheros muertos. Los totales sí son comparables. La columna «Lectura» conserva la de la xhigh y, entre paréntesis, sus exactas/aproximadas y cobertura cuando el fichero estaba en la tabla.

| # | Fichero v1.8 | Cadenas | Exactas en Next | Aproximadas | Solo v1.8 | Cobertura | Lectura |
|---|---|---|---|---|---|---|---|
| 1 | `src/tools/knowledge.js` | 308 | 4 | 0 | 304 | 1 % | glosario/ATA: LATER, ya en alcance (xhigh: 4/0, 1 %) |
| 2 | `src/tools/Toolbox.jsx` | 183 | 63 | 2 | 118 | 36 % | portadas: par, conversiones, duración (xhigh: 62/2, 35 %) |
| 3 | `src/beta/Account.jsx` | 165 | 13 | 5 | 147 | 11 % | cuenta conectada: textos propios de Next (xhigh: 8/5, 8 %) |
| 4 | `src/business.js` | 118 | 20 | 3 | 95 | 19 % | reglas y estados (xhigh: 15/4, 16 %) |
| 5 | `src/components/v11/Company2.jsx` | 114 | 9 | 1 | 104 | 9 % | constructor y organización: C-9/D-08, OD-7 (xhigh: 14/3, 12 %) |
| 6 | `src/features/AdminOverview.jsx` | 98 | 0 | 0 | 98 | 0 % | DEMO-ONLY (xhigh: 0/0, 0 %) |
| 7 | `src/components/v11/Workflow.jsx` | 86 | 10 | 1 | 75 | 13 % | candidaturas: M08 (D-06 ratificada) (xhigh: 6/1, 7 %) |
| 8 | `src/components/v11/Professional2.jsx` | 82 | 10 | 0 | 72 | 12 % | pasaporte, wallet, privacidad (xhigh: 15/1, 17 %) |
| 9 | `src/LegacyApp.jsx` | 77 | 15 | 3 | 59 | 23 % | shell demo (casi todo DEMO-ONLY) (xhigh: 13/3, 21 %) |
| 10 | `src/components/v11/Marketplace.jsx` | 64 | 12 | 4 | 48 | 25 % | oportunidades: M07 (D-12 ratificada) (xhigh: 4/2, 8 %) |
| 11 | `src/features/Translator.jsx` | 63 | 0 | 0 | 63 | 0 % | LATER (xhigh: 0/0, 0 %) |
| 12 | `src/tools/FuelSheet.jsx` | 54 | 2 | 0 | 52 | 4 % | combustible: D-11 (xhigh: 2/0, 4 %) |
| 13 | `src/components/v11/Dashboard.jsx` | 52 | 6 | 0 | 46 | 12 % | inicio empresa y avisos (xhigh: 6/0, 11 %) |
| 14 | `src/tools/engine.js` | 47 | 31 | 0 | 16 | 66 % | motor de unidades (xhigh: 31/0, 66 %) |
| 15 | `src/context/AppState.jsx` | 42 | 1 | 0 | 41 | 2 % | estado de la demo (xhigh: 1/0, 2 %) |
| 16 | `src/features/CandidateDirectory.jsx` | 41 | 2 | 1 | 38 | 7 % | directorio: C-10/OD-7 (xhigh: 2/1, 7 %) |
| 17 | `src/data/demoWorld.js` | 34 | 0 | 0 | 34 | 0 % | datos ficticios (xhigh: 0/0, 0 %) |
| 18 | `src/features/DailyLearning.jsx` | 31 | 0 | 0 | 31 | 0 % | LATER (xhigh: 0/0, 0 %) |
| 19 | `src/beta/ConnectedHome.jsx` | 28 | 3 | 2 | 23 | 18 % | inicio conectado (xhigh: 1/0, 4 %) |
| 20 | `src/features/progress.js` | 28 | 0 | 0 | 28 | 0 % | medallas: D-07/OD-3 (xhigh: 0/0, 0 %) |
| 21 | `src/components/v11/DataPanel.jsx` | 27 | 0 | 0 | 27 | 0 % | DEMO-ONLY (xhigh: 0/0, 0 %) |
| 22 | `src/beta/Operations.jsx` | 24 | 0 | 0 | 24 | 0 % | admin (xhigh: 0/0, 0 %) |
| 23 | `src/features/TechnicianHome.jsx` | 23 | 6 | 2 | 15 | 35 % | inicio técnico (xhigh: 3/1, 17 %) |
| 24 | `src/beta/ConnectedCalendar.jsx` | 22 | 10 | 4 | 8 | 64 % | disponibilidad (xhigh: 12/3, 62 %) |
| 25 | `src/storage.js` | 20 | 5 | 0 | 15 | 25 % | errores de almacenamiento (xhigh: 1/0, 5 %) |
| 26 | `src/beta/ConnectedDirectory.jsx` | 20 | 0 | 0 | 20 | 0 % | directorio conectado (xhigh: 0/0, 0 %) |
| 27 | `src/features/AvailabilityPlanner.jsx` | 18 | 2 | 1 | 15 | 17 % | ciclos (xhigh: 2/1, 17 %) |
| 28 | `src/components/v11/Logbook2.jsx` | 18 | 0 | 1 | 17 | 6 % | LATER (xhigh: 0/1, 4 %) |
| 29 | (sin fuente literal: plantilla, concatenación o librería) | 18 | 0 | 0 | 18 | 0 % | — |
| 30 | `src/features/adminModel.js` | 18 | 0 | 0 | 18 | 0 % | DEMO-ONLY (xhigh: 0/0, 0 %) |
| 31 | `src/components/screens/AuthScreen.jsx` | 17 | 9 | 4 | 4 | 76 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 32 | `src/beta/ConnectedShell.jsx` | 17 | 3 | 0 | 14 | 18 % | shell conectado (xhigh: 3/0, 17 %) |
| 33 | `src/components/screens/LogbookScreen.jsx` | 16 | 2 | 0 | 14 | 12 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 34 | `src/data/v11.js` | 16 | 0 | 0 | 16 | 0 % | catálogos (xhigh: 0/1, 6 %) |
| 35 | `src/features/Badges.jsx` | 13 | 2 | 1 | 10 | 23 % | insignias (xhigh: 2/1, 23 %) |
| 36 | `src/components/company/CreateJobForm.jsx` | 10 | 1 | 0 | 9 | 10 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 37 | `src/features/ProfileIdentity.jsx` | 10 | 0 | 0 | 10 | 0 % | avatar (xhigh: 0/0, 0 %) |
| 38 | `src/beta/connectedModel.js` | 7 | 1 | 1 | 5 | 29 % | — (xhigh: 1/1, 25 %) |
| 39 | `src/components/screens/CalendarScreen.jsx` | 6 | 4 | 0 | 2 | 67 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 40 | `src/components/screens/PrivacyScreen.jsx` | 6 | 2 | 1 | 3 | 50 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 41 | `src/features/DemoSwitcher.jsx` | 6 | 0 | 0 | 6 | 0 % | DEMO-ONLY (xhigh: 0/0, 0 %) |
| 42 | `src/features/planning.js` | 5 | 2 | 0 | 3 | 40 % | patrones de ciclo (xhigh: 5/0, 62 %) |
| 43 | `src/components/Header.jsx` | 5 | 1 | 0 | 4 | 20 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 44 | `src/components/v11/Pricing.jsx` | 5 | 1 | 0 | 4 | 20 % | OD-7 (xhigh: 1/0, 20 %) |
| 45 | `src/components/screens/CandidatePackModal.jsx` | 5 | 2 | 0 | 3 | 40 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 46 | `src/components/screens/HomeScreen.jsx` | 4 | 1 | 0 | 3 | 25 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 47 | `src/features/MedalStrip.jsx` | 4 | 0 | 0 | 4 | 0 % | medallas (xhigh: 0/0, 0 %) |
| 48 | `src/data/mockData.js` | 4 | 0 | 0 | 4 | 0 % | — (xhigh: 0/0, 0 %) |
| 49 | `src/features/homeModel.js` | 4 | 0 | 0 | 4 | 0 % | — (xhigh: 0/0, 0 %) |
| 50 | `src/components/Navbar.jsx` | 3 | 2 | 0 | 1 | 67 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 51 | `src/components/screens/ToolsScreen.jsx` | 3 | 1 | 0 | 2 | 33 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 52 | `src/components/company/AircraftCategoryDiagram.jsx` | 3 | 0 | 0 | 3 | 0 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 53 | `src/components/screens/PassportScreen.jsx` | 2 | 0 | 0 | 2 | 0 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 54 | `src/components/v11/Shared.jsx` | 2 | 0 | 0 | 2 | 0 % | — (xhigh: 0/0, 0 %) |
| 55 | `src/components/screens/JobsScreen.jsx` | 2 | 0 | 0 | 2 | 0 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 56 | `src/components/screens/DocsScreen.jsx` | 1 | 1 | 0 | 0 | 100 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 57 | `src/App.jsx` | 1 | 1 | 0 | 0 | 100 % | código muerto: no llega al HTML (la cadena también está en el bundle, el reparto la asigna aquí) |
| 58 | `src/main.jsx` | 1 | 0 | 0 | 1 | 0 % | — (xhigh: 0/0, 0 %) |
| Σ | **Total** | **2 101** | **260** | **37** | **1 804** | **14,1 %** | Next: 1 020 claves, 667 sin contrapartida (xhigh: 214/31/1 856, 11,7 %; 856 claves, 569) |

Notas de lectura:
- v2: 52 cadenas de v1.8 ganan equivalente, casi todas de M07/M08 y de los contadores: `Marketplace.jsx` pasa del 8 % al 25 % («Trabajo que encaja contigo.», «Compatibles», «Cumples requisitos y disponibilidad», «Sin ofertas para este filtro»…), `Workflow.jsx` del 7 % al 13 % («Tus candidaturas.», «Preseleccionar», «Confirmar asignación», «Cancelar asignación»…), `TechnicianHome.jsx` al 35 % («Ver seguimiento», «Tu próxima candidatura empieza aquí») y `storage.js` al 25 % (estados «Propuesta», «Aceptada», «Confirmada», «Finalizada»). Ninguna cadena pierde su equivalente.
- Algunas aproximadas del fichero v2 son falsos positivos del umbral 0,86 (p. ej. «Preparar candidatura» y «Revisar candidaturas» ↔ `applications.action.withdrawn`; «Asignado» ↔ `availability.assignedShort` «Asignada», con otro género).
- `only18` incluye ruido de identificadores de librería («Fragment», «Portal», «Context»), así que la cifra real de prosa no portada es algo menor.
- La columna «Sev./Bloqueo» no aplica a esta tabla: cada pantalla la valora en su diff. Con el alcance nuevo dejan de estar bloqueados por SCOPE `knowledge.js`, `Translator.jsx`, `DailyLearning.jsx` y `Logbook2.jsx` (LATER); `FuelSheet.jsx` sigue con D-11 y `AdminOverview.jsx`, `DataPanel.jsx`, `DemoSwitcher.jsx`, `adminModel.js` siguen DEMO-ONLY.

Capturas: —.

---

## I18N-03 · Textos globales del shell y etiquetas de versión — v1.8 `LegacyApp.jsx:78-87`, `ConnectedShell.jsx:13`, `AppState.jsx:96`, `DataPanel.jsx:29-41`, `Company2.jsx:220-222` ↔ Next `common.*`, `nav.*` (es:1-82)

**Estado global:** PARCIAL. Los textos del shell de v1.8 son en gran parte de demo o llevan etiquetas de versión mezcladas. Next tiene un conjunto pequeño y sin versión.

| # | Elemento | v1.8 (literal) | Next (literal, `es:N`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Enlace de salto | «Ir al contenido» | «Saltar al contenido» (es:5) | ≈ | — | — | — |
| 2 | Menú móvil | `aria-label` «Abrir menú» / «Cerrar menú» (icono) | «Menú» visible (es:29) | ≈ | — | — | — |
| 3 | `nav` | «Menú principal», «Accesos rápidos» | `aria-label` = nombre de la sección («Profesional», «Cuenta»…); para administradores, además, `nav` «Ver como» (D-13, `d3b876f`) | ≈ | — | — | — |
| 4 | Cerrar sesión | conectado: «Cerrar sesión» (cabecera de contenido) (medido v2: «Actualizar datos» · «Cerrar sesión» en la cabecera) | «Cerrar sesión» (es:6) | = | — | — | — |
| 5 | Pie | «CREWFLEX AVIATION» · «Cualificación · Disponibilidad · Confianza» · «V1.8 · Unificada» / «V1.8 · Beta local conectada» | sin pie | − | P3 | — (v2: default v1.8, C-12) | portar el pie sin versiones (VIS-06 #14) |
| 6 | Etiquetas de versión mezcladas | «CrewFlex V1.8 — Aviation» (título); «V1.8 · Espacio unificado», «V1.8 · Cuenta conectada» (sidebar); «CREWFLEX V1.6» (eyebrow), «Qué cambia en V1.6», «Se sustituirá el estado de esta V1.6…», «La V1.1 conserva sus datos.» (`DataPanel.jsx:29,41`); «Restablecer ejemplo V1.6», «Restablecer V1.6», «La V1.1 original se conserva.» (`Company2.jsx:220-222`); «CrewFlex V1.2» y «Abrir ejemplo nuevo V1.2» en la pantalla de recuperación (`AppState.jsx:96,120`). En total: V1.1 ×2, V1.2 ×2, V1.6 ×7, V1.8 ×4 + título | ninguna en la UI; solo la versión del motor de herramientas en el texto copiado (`UnitConverter.tsx:269`, `ENGINE_VERSION`) | ✗ | — | — | no portar |
| 7 | Rol en el sidebar | «PROFESIONAL»/«EMPRESA»/«RECRUITER»/«ADMINISTRACIÓN»/«BETA LOCAL» | «Profesional», «Cuenta», «Plataforma» y el nombre de la organización (es:58-60,69), en mayúsculas por CSS; bajo el nombre, tipo de cuenta y rol («Profesional», «Organización · Manager»; `d12164a`, W2-06). Para administradores (D-13), las vistas «Técnico», «Empresa», «Recruiter», «Administración» (es:75-78): las cuatro coinciden con v1.8 | ≈ | — | — | — |
| 8 | Respaldo del breadcrumb | «Datos y alcance», «Actividad», «Mi cuenta» | no hay breadcrumb | − | — | — | — |
| 9 | Error genérico | «La última operación no pudo guardarse y no se ha aplicado. Conserva un respaldo desde Datos y alcance e inténtalo de nuevo.» | `api.*` por código (es:181-227), p. ej. «Servicio no disponible / Crew Flex no ha podido contactar con el backend…»; desde `d275254` (W1-01), página de error raíz traducida «No se ha podido mostrar esta página» + «Reintentar» / «Cerrar sesión» (`src/app/error.tsx:17-39`, `common.errorTitle`, es:26) | ≠ | — | — | mantener |
| 10 (nueva) | Selector de espacio (D-13) | «Probar como» (visible solo por encima de 1200px), `aria-label` «Rol de demostración», opciones «Técnico», «Empresa», «Recruiter»; entrada de menú «Control CrewFlex»; eyebrow «ESPACIO RECRUITER» del inicio en modo recruiter (`Dashboard.jsx:24`) | «Ver como» (`nav.viewAs`, es:73), vistas «Técnico», «Empresa», «Recruiter», «Administración» (`nav.views.*`, es:75-78; EN «Technician», «Company», «Recruiter», «Administration»); páginas «Administración» (`admin.home.*`) y «Espacio recruiter» como H1 / «Próximamente» (`recruiter.*`). D-13, `d3b876f` | ≈ | P3 | — | mantener; «Ver como» frente a «Probar como» es una diferencia de redacción (v1.8 era un simulador; aquí es la cuenta propia) |

Capturas: `evidencias/shots/demo/D-TEC-01-inicio-1440.png` (pie y sidebar), `evidencias/shots/demo/D-GEN-01-datos-alcance-1440.png` (V1.6).

---

## I18N-04 · Plurales y concordancia — v1.8 (ternarios manuales) ↔ Next (ICU)

**Estado global:** PARCIAL. v1.8 pluraliza a mano solo unos pocos textos y deja varios sin concordancia: en pantalla se lee «1 apartados por completar». Next usa ICU `plural`.

| # | Elemento | v1.8 | Next | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Mecanismo | ternarios: `{job.people === 1 ? 'persona' : 'personas'}` (`Marketplace.jsx:43,90`); `stats.current===1?'día':'días'` (`DailyLearning.jsx:15` ×2); `n===1?'día':'días seguidos'` (`Badges.jsx:10`) | 17 mensajes ICU `{count, plural, one {…} other {…}}` en es.json (v2; es:484,494,505,507,508,540,728,731,733,759,766,864,872,910,1256,1264,1266; xhigh 13; 21/10: 10); nuevos con M07/M08: «{count} pendientes de confirmar», «{total} oportunidades · página…», «{count} requisitos obligatorios pendientes» y «{count} personas» | + | — | — | — |
| 2 | Sin plural | «{missing.length} apartados por completar» → **«1 apartados por completar»** (`TechnicianHome.jsx:15`, visible en `evidencias/shots/demo/D-TEC-01-inicio-1440.png`); `aria-label` «…{n} oportunidades» (`TechnicianHome.jsx:15`, `ConnectedHome.jsx:15`); «Ver {n} insignias adicionales» (`MedalStrip.jsx:9`); «{job.days.length} días» (`Marketplace.jsx:90`) | en ICU: `availability.pending` / `saved` / `splitWarning`, `matching.pageInfo`, `compareTitle`, `professional…years`; y desde `c6d380b` (W2-02) justo el texto que v1.8 rompe: `professional.overview.toComplete` «{count, plural, one {# apartado} other {# apartados}} por completar» (es:494, `src/app/app/professional/page.tsx:231-233`) | ✗ | — | — | no portar los literales sin plural; al portar estas pantallas, usar ICU |
| 3 | Contadores de resultados | «8 resultados · página 1 de 1» (`D-EMP-04`) | `{total, plural, …} · página {page} de {pages}` (es:872) y, desde `ad03283` (W5-02), «{total, plural, one {# necesidad} other {# necesidades}} · página {page} de {pages}» (es:766, `RequirementsPager.tsx:23-25`, `role=status`) v2: también «{total, plural, one {# oportunidad} other {# oportunidades}} · página {page} de {pages}» (es:1256, `opportunities/page.tsx:148-150`, `role=status`) | = | — | — | — |

Capturas: `evidencias/shots/demo/D-TEC-01-inicio-1440.png`.

---

## I18N-05 · Fugas de idioma y literales sin catálogo — v1.8 (todo literal) ↔ Next NX-08

**Estado global:** PARCIAL. Desde `135085c` (W1-04, NX-08) ningún mensaje en inglés llega a la UI en español: las acciones devuelven claves y `actionErrorCopy` nunca muestra el mensaje bruto del servidor. Quedan el nombre del producto sin unificar (C-12) y algunos símbolos fuera del catálogo, a propósito. Barrido en ejecución (xhigh): las 24 rutas en ES (65 cargas) con alpha, manager.mro, platform.admin y sin sesión, a 1440 y 390, comparando el texto visible y los `aria-label`/`title`/`placeholder` con las 731 palabras que solo aparecen en `messages/en.json`: ninguna cadena de interfaz en inglés; solo datos (nombres de cuenta como «Technician Alpha», títulos de necesidad y nombres del catálogo de cualificaciones, fila 10). `grep` de literales en inglés en el JSX: ninguno. v2: el barrido se repite en 98 cargas en ES, a 1440 y 390 (incluidas las páginas de M05/M07/M08) sin ninguna cadena de interfaz en inglés; solo datos (nombres de cuenta, títulos de necesidad, catálogo de cualificaciones).

| # | Elemento | v1.8 | Next (`archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | «Check the highlighted fields.» | — | las acciones devuelven la clave `common.checkFields` (`src/features/availability/actions.ts:54`, `src/features/documents/actions.ts:41`; es:21); `src/features/action-errors.test.ts` lo comprueba | = (antes −) | — | — | — |
| 2 | «Invalid window.» | — | `v.form.window` (`availability/actions.ts:75,83`; es:345) | = (antes −) | — | — | — |
| 3 | «Invalid qualification.» | — | `v.form.qualification` (`src/features/qualifications/actions.ts:36,44`; es:346) | = (antes −) | — | — | — |
| 4 | «This service is not available.» / «…not available yet.» | — | `reviews/actions.ts:21` devuelve `api.NOT_FOUND.description`. El literal sigue en `src/server/edge-functions.ts:84` y en las Edge Functions como mensaje interno (registro y clientes de la API, `I18N_STRATEGY.md` §2), pero no llega a la UI: `actionErrorCopy` traduce por código y nunca muestra el mensaje bruto (`Notice.tsx:100-129`), y `ApiErrorState` usa `api.<CODE>.*` | = (antes −) | — | — | — |
| 5 | Placeholder «Madrid (MAD)» | «Madrid (MAD)» en el catálogo de bases | `t("basePlaceholder")` «Madrid (MAD)» (`ProfileForm.tsx:108`, es:551); en el requisito, `locationPlaceholder` (es:829) | = (antes ≈) | — | — | — |
| 6 | Otros literales | — | «CF», «←/→», «✓/✗/○», «—», «B/KB/MB». Los ejemplos «1:30»/«1,5» de duración salen ya del catálogo (`tools.duration.placeholderClock/Decimal`, es:1076-1077; EN «1.5»; `DurationTool.tsx:74`; `69210ac`, W3-08) | ≈ | — | — | mantener (símbolos o ejemplos de formato) |
| 7 | Nombre del producto | «CrewFlex» | «Crew Flex» frente a «CREWFLEX · WORKBENCH» (es:1009), «CrewFlex intermedia; …» (es:1331, M08) y «CrewFlex» (`UnitConverter.tsx:269`) | ≠ | P3 | — (v2: default v1.8, C-12) | ver VIS-08 #3 |
| 8 | Claves sin uso | — | `common.utcNote`, `common.back` (NX-08) | + | — | — | — |
| 9 | Inglés técnico en v1.8 | «Candidate Pack», «Wallet documental», «Logbook», «Line Maintenance», «Troubleshooting», «Engine Change», «Workbench» sin traducir | «Wallet documental» queda solo como H1 de la página (`documents.title`, es:1192); menú y pestaña dicen «Documentos» desde `fd01c52` (W3-07). «Workbench»; «Type ratings» como título de categoría en ES (`domain.category.TYPE_RATING`, es:451; visto en «Nueva necesidad»), en inglés por el glosario (`docs/product/AVIATION_GLOSSARY_ES_EN.md:39`); los códigos no se traducen por diseño | ≈ | — | — | — |
| 10 (nueva xhigh) | Nombres del catálogo de cualificaciones | en inglés también en los datos de la demo («Human Factors», `business.js:9`, `data/v11.js:5`) | en inglés en la UI en español: «Part-66 Category A — Line maintenance certifying mechanic», «Human Factors», «Type rating — Airbus A320 family»… salen de `qualification_catalog` (`supabase/migrations/20261009120100_qualification_catalog.sql:19`) en cualificaciones, documentos, «Nueva necesidad», verificaciones y en los `aria-label` de los requisitos («Human Factors — requisito obligatorio») (medido, xhigh) | = | — | — | mantener (nombres y códigos no se traducen, `I18N_STRATEGY.md:30`) |

Capturas: `local-19-matches-es-1440.jpg` (lote 13, ES). xhigh: barrido en `evidencias/xhigh/50/raw/crawl-es-*.json` (campo `leaks`); `SHOT-07-next-1440.jpg` («Type ratings» y nombres del catálogo). v2: `evidencias/v2/50/raw/crawl-es*.json` (campo `leaks`, 98 cargas).

---

## SHOT-01 · Inicio técnico — v1.8 `S-TEC-01` (`D-TEC-01`) ↔ Next `N-PRO-01`

**Estado global:** IGUAL salvo matices (F3: antes PARCIAL). P01 (`4d78d6d`, `17-parity-matrix-v18.md` §P01) portó la composición de la demo: hero teal con avatar, medallas, acciones, progreso y cifras junto al calendario; feeds a todo el ancho; los paneles propios de Next debajo (T-161). Columna Next re-verificada en F3 (2026-10-26) contra el código y las capturas `docs/audit/evidence/parity/P01/`; quedan sin ver pintadas la tarifa de una fila y la marca (datos de prueba, P04).

| # | Elemento | v1.8 (`evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `-viewport-390.png`) | Next (`next-after/tech-home-1440.jpg`, `-390.jpg`, lote 11, EN; `local-23-overview-nav-390.jpg`, lote 14) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cromo antes del contenido (1440) | unos 260px: cabecera blanca con breadcrumb, «Probar como», «Vista móvil» y campana, más tres bandas de demo | 0px: el eyebrow empieza en y≈45 (lote 11: «PROFESSIONAL SPACE»; código actual: «Mi espacio», `src/app/app/professional/page.tsx:113`) | ≠ | P3 | DEMO-ONLY | — |
| 2 | Jerarquía | H1 de marketing de dos líneas «Tu perfil. Tu tiempo. / Tu próxima oportunidad.» y botón «Herramientas»; debajo, la tarjeta pasaporte (hero teal con degradado, avatar «MB», medallas 8 años · B1.1 · A320 · SM · +3, «Editar perfil», «Estado de mi perfil», barra «Tu pasaporte está al 90%», KPIs 9/0) junto al calendario | Código actual (P01, `4d78d6d`): eyebrow «Mi espacio», H1 literal de v1.8 en dos líneas + botón «Herramientas» con icono; hero teal con degradado (`bg-hero`), avatar de 104 px (foto o iniciales), nombre, «Barcelona (BCN) · 12 años de experiencia declarada», medallas «12 AÑOS · B1.1 · A320 · +1», «Editar perfil» (icono), «Estado de mi perfil ↗» (modal), «Tu pasaporte está al 90%» + barra + nota, cifras «0 oportunidades compatibles» / «0 asignaciones confirmadas»; a la derecha el calendario (`xl:grid-cols-[1.15fr_1fr]`). Los KPIs propios, «Próximos pasos», la revisión a 60 días, los logros y «Perfil» van debajo (T-161) (`ProfessionalHero.tsx`, `HomeOpportunities.tsx`; `docs/audit/evidence/parity/P01/P01-home-after-1440-es.jpg`) | ≈ (F3: antes ≠) | P3 (F3: antes P2) | — | Hecho (P01-02…P01-12, `17-parity-matrix-v18.md`). Diferencia: el nombre y los años en 14 px por la regla «nunca < 12 px»; KPIs propios debajo |
| 3 | Densidad | baja: hero de unos 470px y feed de 5 oportunidades con tarifa y «Ver oferta» | Media-alta: hero de unos 470 px junto al calendario; feed de hasta 5 oportunidades con marca, «{org} · {ubicación} · {códigos}», periodo, tarifa si existe y «Ver oferta»; «Mis candidaturas» de 5 filas; debajo, los paneles propios de Next alargan la página | ≈ (F3: antes ≠) | P3 | — | Mantener (P01-21…P01-28); los añadidos de Next se pliegan debajo (T-161) |
| 4 | Color | hero teal oscuro (`#103a4c→#186c72`), sidebar navy, CTA blanco sobre teal | Hero teal oscuro con degradado (`bg-hero`), sidebar navy, «Editar perfil» blanco sobre teal, «Estado de mi perfil ↗» como texto claro sin borde (`inverseLink`), barra menta; anillo naranja en «hoy» | = (F3: antes ≠) | — | — | Hecho (P01-04/08, `17-parity-matrix-v18.md`) |
| 5 | Calendario | mini calendario con puntos rojos de oportunidad, leyenda de 5 estados («Trabajo», «Descanso», «Disponible», «Asignado», «Oportunidades»), «Octubre **De** 2026» (bug de capitalize) y botón «Actualizar disponibilidad» | Panel con kicker «Tu disponibilidad», h2 «Octubre de 2026» (X-18 corrige «De»), «L M X J V S D», días `aria-pressed` con punto rojo y «Asignado», leyenda «Bloqueado · Descanso · Disponible · Solo AOG · Parcial · Asignado · ● Oportunidades», nota del punto rojo y «Actualizar disponibilidad» con icono al pie (`AvailabilityMonth.tsx`) | = (F3: antes ≈) | — | — | Hecho (N-03; P01-13…P01-20, `17-parity-matrix-v18.md`). Smoke `PKG P02 6` (nota), pc5/pc6 |
| 6 | Qué falta en Next | feed «Oportunidades para ti», «Mis candidaturas» (estado vacío «Tu próxima candidatura empieza aquí»), medallas, avatar, KPIs de oportunidades y asignaciones | Hecho: feed «Oportunidades para ti» (5, con marca y botón), «Mis candidaturas» con su vacío completo, medallas, avatar en degradado y las dos cifras en el hero. La tarifa de una fila solo cuando la necesidad la publica (`conditions.hourlyRate`, T-62): no se ha visto pintada por falta de datos de prueba (P01-23) | ≈ (F3: antes −) | P3 (F3: antes P2) | — (tarifa: alcance LATER, OD-7 sin dinero real) | Hecho (P01-06/22/23); la fila con tarifa queda IMPLEMENTED_UNVERIFIED hasta P04 |
| 7 | Qué sobra en Next | — | tarjeta «Profile» (base, movilidad, experiencia, estado, visibilidad) y métrica «Verified» | + | — | — | — |
| 8 | 390 | hamburguesa + 3 bandas apiladas (unos 380px antes del H1), H1 sin espacio «Tu tiempo.Tu», toast superpuesto y **dock** fijo de 5 iconos | Barra navy con hamburguesa y dock fijo de 5 iconos («Inicio · Ofertas · Calendario · Candidaturas · Herramientas», T-141, PKG shell-visual); sin bandas de demo; h1 fluye con espacio («Tu tiempo. Tu próxima», el `br` se oculta bajo `sm`); hero con el avatar encima del nombre; sin scroll horizontal a 390/360 (`docs/audit/evidence/parity/P01/P01-home-after-390-es.jpg`, `-360-es.jpg`) | ≈ (F3: antes ≠) | P3 (F3: antes P2) | — | Hecho (P01-02/29, T-141). Diferencia: sin toast superpuesto ni bandas (solo demo) |
| 9 (nueva v2) | Contadores y feed de M07/M08 | demo: en el hero, «9» oportunidades compatibles y «0» asignaciones; feed «Oportunidades para ti» de 5 ofertas con tarifa y «Ver oferta»; «Mis candidaturas» con «Ver todas» y el estado vacío «Tu próxima candidatura empieza aquí» + «Buscar oportunidades» (`evidencias/v2/50/SHOT-01-9-v18-1440.jpg`); conectado: «4 oportunidades compatibles» (técnico 1, medido) | Las dos cifras de v1.8 en el hero («{n}» 30 px + «oportunidades compatibles» / «asignaciones confirmadas», minúsculas); los KPIs propios (Candidaturas en curso, Propuestas por aceptar y los del perfil) en una `dl` debajo de los bloques de v1.8; paneles «Oportunidades para ti» y «Mis candidaturas» a todo el ancho con kicker y «Ver todas ↗»; un fallo de carga se dice en su sección (`ProfessionalHero.tsx`, `ProfessionalActivity.tsx`) | ≈ | P3 | — | Mantener (P01-11/31/32, `17-parity-matrix-v18.md`) |

Capturas: `evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `evidencias/shots/demo/D-TEC-01-inicio-viewport-390.png`; Next `docs/audit/evidence/v18-compare/next-after/tech-home-1440.jpg`, `tech-home-390.jpg` (lote 11), `docs/audit/evidence/local-23-overview-nav-390.jpg` (lote 14). xhigh (22/10, ES, código actual): `evidencias/xhigh/50/SHOT-01-next-1440.jpg`, `SHOT-01-next-390.jpg`, `SHOT-01-v18-390.jpg`. v2: `evidencias/v2/50/SHOT-01-9-next-1440.jpg`, `SHOT-01-9-next-390.jpg`, `SHOT-01-9-v18-1440.jpg`, `SHOT-01-9-v18-390.jpg`. F3 / P01 (26/10): `docs/audit/evidence/parity/P01/P01-home-after-{1440,1024,768,390,360}-es.jpg`, `P01-home-after-{1440,390}-en.jpg`, `P01-home-empty-{1440,390}-es.jpg`, `P01-home-error-1440-es.jpg`.

---

## SHOT-02 · Disponibilidad — v1.8 `S-TEC-03` (`D-TEC-03`) ↔ Next `N-PRO-04`

**Estado global:** IGUAL salvo matices (F3: antes PARCIAL). La estructura es la misma (formulario de ciclo, previsualizar, mes pintable) y el visual está muy cerca. Next añade las métricas, no tiene el estado azul «Trabajo» (es «Bloqueado») y, desde T-141, lleva el mismo dock fijo bajo `lg`.

| # | Elemento | v1.8 (`D-TEC-03-disponibilidad-1440.png`, `-390.png`) | Next (`next-after/tech-availability-1440.jpg`, `-390.jpg`, lote 11, EN) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cabecera | «TU CALENDARIO» / «Tu tiempo, a tu manera.» / descripción | F3 (P03): «Tu calendario» (mayúsculas por CSS) / **«Tu tiempo, a tu manera.»** / descripción propia con UTC (TEC-04 #5) (`docs/audit/evidence/parity/P03/P03-availability-after-1440.jpg`; lote 11 decía «MY TIME» / «Chosen availability») | ≈ | — (F3: antes P3) | — | Hecho (P03-01): kicker y h1 iguales a la demo; smoke `PKG P03 1b` |
| 2 | Métricas | no hay | 4 métricas (disponibles, bloqueados, solo AOG, ventanas; 2×2 a 390) | + | — | — | — |
| 3 | CTA de previsualizar | botón naranja a **todo el ancho** «Previsualizar patrón en octubre de 2026» | botón naranja ajustado al contenido «Previsualizar ciclo en el mes» (re-verificado F3: `P03-availability-after-1440.jpg`) | ≈ | P3 | — | mantener |
| 4 | Selector de estado | chips «Disponible» (seleccionado con contorno navy), «Descanso», «Solo AOG» y «Trabajo» de colores | «Disponible», «Bloqueado», «Solo AOG» y «Descanso (limpiar)» (es, `PKG P03 1b`); el seleccionado con anillo | ≈ | P3 | — | — |
| 5 | Celdas | 7 columnas de unos 143×70 a 1440 con número + etiqueta; a 390 las etiquetas **se pisan** | `min-h-20` con número + etiqueta a `sm+`; por debajo de `sm`, solo el número y el punto de «Asignada» (`P03-availability-after-390.jpg`) | + | — | — | — |
| 6 | 390 | el dock queda superpuesto a media página en la captura full-page (es fijo) | F3: el mismo dock fijo de v1.8 bajo `lg` («Accesos rápidos»: Inicio · Ofertas · Calendario · Candidaturas · Herramientas, con «Calendario» actual; T-141, `src/components/layout/MobileDock.tsx`), que en la captura full-page también queda a media página (`P03-availability-after-390.jpg`); `position: fixed` pegado al borde inferior a 390 y 360, sin scroll horizontal (`PKG P03 7`) | = (F3: antes ≠) | — | — (v2: default v1.8, C-12) | Hecho (T-141, SH-05; verificado aquí en P03-20) |

Capturas: `evidencias/shots/demo/D-TEC-03-disponibilidad-1440.png`, `D-TEC-03-disponibilidad-390.png`; Next `v18-compare/next-after/tech-availability-1440.jpg`, `tech-availability-390.jpg` (lote 11). xhigh: `evidencias/xhigh/50/SHOT-02-next-1440.jpg`, `SHOT-02-next-390.jpg`, `SHOT-02-v18-390.jpg`. v2: `evidencias/v2/50/VIS-02-11-next-1440.jpg`, `VIS-02-11-next-390.jpg`. F3: `docs/audit/evidence/parity/P03/P03-availability-after-{1440,1024,768,390,360}.jpg`, `-1440-en.jpg`, `P03-availability-preview-after-1440.jpg`.

---

## SHOT-03 · Pasaporte — v1.8 `S-TEC-02` (`D-TEC-02`) ↔ Next `N-PRO-02`

**Estado global:** IGUAL salvo matices (F3: antes PARCIAL). v1.8 es un asistente de 5 pasos con un «pasaporte visual» oscuro arriba; Next (P02, 2026-10-26) tiene la misma cabecera con «Empezar perfil vacío» y el chip, el pasaporte visual (blanco) con foto, medallas, lista de 60 días y logros, y los 5 pasos como paneles de un único formulario con «Guardar pasaporte».

| # | Elemento | v1.8 (`D-TEC-02-pasaporte-1440.png`) | Next (`next-after/tech-passport-1440.jpg`, lote 11, EN) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cabecera | «MI PASAPORTE» / «Tu perfil, conectado.» y, a la derecha, «Empezar perfil vacío» + chip «90% completado · 0 evidencias» | «Mi pasaporte» (mayúsculas por CSS) / «Tu perfil, conectado.» / descripción y, a la derecha, «Empezar perfil vacío» + chip «90% completado · 0 evidencias» (delta) (`profile/page.tsx`; `docs/audit/evidence/parity/P02/P02-passport-after-1440.jpg`) | = (F3: antes ≈) | — | — | Hecho (N-25, T-162). Smoke `PKG P02 1/5` |
| 2 | Pasaporte visual | panel teal oscuro con avatar «MB», «Añadir foto», nota «Foto guardada solo en este navegador…», 7 medallas, «Documentos y cursos próximos a revisar» (plegable) y «Logros de aprendizaje» con 3 insignias y la racha | Panel «Pasaporte visual» (blanco con borde, no teal: el teal es del hero de Mi espacio) con avatar «TD» + «Añadir foto» y la nota «Foto guardada solo en este navegador…», las 4 medallas de delta, «Documentos y cursos próximos a revisar» plegable y el pie; debajo, el panel «Logros de aprendizaje» con las 3 insignias y la racha (`PassportVisual.tsx`, `LearningAchievements.tsx`) | ≈ (F3: antes −) | P3 (F3: antes P2) | — | Hecho (N-15, N-23, T-163). Diferencia: panel blanco en vez de teal. Smoke `PKG P02 1/5` |
| 3 | Navegación | pasos 1-5 en pastillas («Identidad», «Cualificaciones», «Experiencia y cursos», «Disponibilidad y tarifa», «Resumen») + «Anterior» / «Guardar pasaporte» (naranja) / «Siguiente» | 5 paneles numerados con los nombres de los pasos de la demo («01 · Identidad», «02 · Cualificaciones», «03 · Experiencia y cursos», «04 · Tarifa y permisos de trabajo», «05 · Visibilidad en la red») + «Guardar pasaporte» (naranja); sin pastillas ni «Anterior» / «Siguiente» | ≈ (F3: antes ≠) | P3 (F3: antes P2) | — | Mantener (TD-25: un formulario). Smoke `PKG P02 5` |
| 4 | Visibilidad | `.visibility-option` con `aria-pressed` (paso propio en Privacidad) | 3 tarjetas `radio` con la seleccionada en fondo `info-bg` y borde navy | ≈ | — | — | — |
| 5 | Densidad y color | campos con fondo `#fafcfe` y texto en negrita (650); muchas medallas de colores | Campos blancos de 15 px en peso normal (`controlClass` del DESIGN_SYSTEM); color en la tarjeta de visibilidad seleccionada, en las medallas del pasaporte visual y en el chip de la cabecera | ≠ | P3 | — | Mantener: los controles son del sistema de diseño (`src/components/ui/Field.tsx`), no por pantalla |
| 6 | Texto sin estilo | «Privados en este navegador · separados de las cualificaciones.» y «Racha actual: 0 días · Mejor racha: 0…» a 15-16px sin clase (destacan sobre el resto) | — | ✗ | — | — | no portar |

Capturas: `evidencias/shots/demo/D-TEC-02-pasaporte-1440.png`; Next `v18-compare/next-after/tech-passport-1440.jpg` (lote 11). xhigh: `evidencias/xhigh/50/SHOT-03-next-1440.jpg`, `SHOT-03-v18-390.jpg`. F3 / P02 (26/10): `docs/audit/evidence/parity/P02/P02-passport-after-{1440,390}.jpg`, `P02-passport-after-1440-en.jpg`, `P02-passport-dialog-after-1440.jpg`, `P02-passport-draft-after-1440.jpg`.

---

## SHOT-04 · Herramientas — v1.8 `S-COM-01` (`D-TOOL-00`) ↔ Next `N-TOOL-01`

**Estado global:** IGUAL salvo el combustible (F3: antes PARCIAL). F3 (P08, 27/10): 6 de las 7 fichas en el orden de v1.8 (`558654f`); solo falta Combustible (D-11). Es la pantalla más fiel: la misma identidad teal, el mismo hero «N·m ⇆ lbf·in», las mismas fichas y la misma nota de privacidad. Verificado en `PKG P08 0b/6`; captura `docs/audit/evidence/parity/P08/P08-tools-after-1440.jpg`.

| # | Elemento | v1.8 (`D-TOOL-00-herramientas-1440.png`) | Next (`next-after/tools-1440.jpg`, lote 11, EN) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cabecera | «TU CAJA DE HERRAMIENTAS» / «Para cada jornada.» / «Cálculos claros. Unidades visibles. Referencias a mano.» | «YOUR TOOLBOX» / «For every shift.» / igual, con línea divisoria | = | — | — | — |
| 2 | Hero | `#112e40`, «CREWFLEX · WORKBENCH», «Tu oficio, un poco más sencillo.», CTA menta «Abrir conversor de par ›», arte «N·m ⇆ lbf·in / Precisión en cada unidad.» | idéntico en composición y color | = | — | — | — |
| 3 | Fichas | **7**: Reto diario, Traductor, Par de apriete, Combustible, Conversiones, Inglés y siglas, Duración | **6** en el orden de v1.8: Reto diario, Traductor, Par de apriete, Conversiones, Inglés y siglas, Duración (`src/features/tools/ids.ts`, `ToolsHome.tsx`; `558654f`). F3 en ejecución: `PKG P08 0b` (es), 28a (en); `parity/P08/P08-tools-after-1440.jpg` | ≈ (F3: antes −) | P2 | D-11 (combustible) | Combustible tras la revisión técnica D-11 (F-1 del área 40) |
| 4 | Ficha | icono `#e8f3f1`, estrella de favorito, título, subtítulo y «Abrir herramienta ›» teal | igual | = | — | — | — |
| 5 | Nota de privacidad | «Tu uso de herramientas es privado. Los cálculos de combustible se descartan al salir; se guardan tus favoritos y el progreso de los retos en este navegador.» | «Tu uso de herramientas es privado: los cálculos se hacen en tu navegador y no se envían a ningún servidor. Tus favoritos y el progreso de los retos se guardan en este navegador.» (es:1621; `558654f`): favoritos y progreso de los retos como v1.8, sin la frase del combustible (D-11). F3: `PKG P08 0b` | ≈ | — | — | — (TOOL-01 #33) |
| 6 | Banda | «**Herramientas de trabajo** · Conversores, combustible e inglés en tu espacio CrewFlex.» + bandas de demo | — | ✗ | — | DEMO-ONLY | — |

Capturas: `evidencias/shots/demo/D-TOOL-00-herramientas-1440.png`; Next `v18-compare/next-after/tools-1440.jpg` (lote 11). xhigh: `evidencias/xhigh/50/SHOT-04-next-1440.jpg`, `SHOT-04-next-390.jpg`, `SHOT-04-v18-390.jpg`.

---

## SHOT-05 · Inicio empresa — v1.8 `S-EMP-01` (`D-EMP-01`) ↔ Next `N-ORG-01`

**Estado global:** PARCIAL → IGUAL salvo cabecera y forma de la lista (F3, P09 2026-10-27). Next tiene ahora el hero (T-167), los 4 KPIs de la v1.8, la lista con «% cubierto», la guía y los accesos, y además la capacidad de la necesidad foco; la cabecera sigue el patrón de Next (SHOT-05 #1).

| # | Elemento | v1.8 (`D-EMP-01-resumen-1440.png`, `-390.png`) | Next (`next-after/org-home-1440.jpg`, lote 11, EN) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cabecera | «CENTRO DE OPERACIONES» / «AeroLine MRO» / «De una necesidad concreta a un equipo disponible.» + CTA naranja «Publicar necesidad ↗» | lote 11: «DEMO MRO MADRID» / «Operations» + CTA «New requirement». Código actual (`07eb07a`, W2-03): nombre de la organización / «Operaciones» / **«De una necesidad concreta a un equipo disponible.»** (igual que v1.8) + CTA naranja «Nueva necesidad» (`src/app/app/organization/page.tsx:78-83`) | ≈ | — | — | — |
| 2 | Hero | `.dashboard-hero` `#0d2945` con chips «CrewFlex Aviation» / «Capacidad técnica flexible», «El técnico adecuado. Las fechas adecuadas.», «Explorar candidatos →» y avión decorativo | F3 (P09, `d41a5a4`, T-167): el mismo hero sobre `navy`, entre la cabecera y los KPIs, con los dos chips, la h2, la frase, «Explorar candidatos →» (admin/manager) y el avión «CF / AVIATION» desde 601 px (`OrganizationHero.tsx`); debajo, cuando hay necesidad foco, sigue el panel «Capacidad técnica» de Next (ORG-01 #13-#19) | ≈ (F3: antes ≠) | — | — | Hecho (`PKG P09 0b`; `parity/P09/P09-home-after-1440.jpg`) |
| 3 | KPIs | 4 tarjetas: necesidades activas, red visible, candidaturas y jornadas cubiertas | Las cuatro, en el orden de la v1.8: «Necesidades abiertas · De tu organización» (X-06), «Candidaturas en curso · N pendientes de confirmar» (T-93), «Jornadas cubiertas · Solo asignaciones confirmadas» (T-92, `7d6fda7`), «Red visible · Según permisos y privacidad» (T-146, `fb2ef99`); el `member` solo la primera (`OrganizationOverview.tsx:132-170`). F3 en ejecución: 0 / 0 / 0 / 12 | ≈ | P3 | — (v2: D-06 ratificada) | Hecho (F3: `PKG P09 1/3/6`; «Red visible» = total del directorio) |
| 4 | Lista | «Necesidades en seguimiento»: icono (avión azul / rayo naranja para AOG), «0 % cubierto» y flecha | Panel «Necesidades» (5 filas, vigentes primero) con chips de urgencia/estado, periodo, «N ×», cualificaciones, «{p} % cubierto» con barra (T-92) y «Gestionar candidaturas» (`RequirementsList.tsx`); tabla en escritorio, tarjetas apiladas en 390 | ≈ (F3: antes ≠) | P3 | — | Hecho (F3: `PKG P09 2`; la forma —tabla— es la diferencia que queda) |
| 5 | Qué falta en Next | «Cómo cerrar una cobertura» (4 pasos) y 3 accesos (Constructor, Red profesional, Candidate Packs) | `CoverageGuide` (v2-21): los 4 pasos literales, «Constructor» y «Candidate Packs» como accesos, «Red profesional» en la cabecera y en el hero, y la nota del conectado (ORG-01 #25-#27) | = (F3: antes −) | — | — | Hecho (`PKG P09 2`, `PKG hiring-polish 9`) |
| 6 | 390 | CTA, hero y KPIs 2×2 apilados; el dock tapa el hero en la captura | F3 (`parity/P09/P09-home-after-390.jpg`): CTA, hero (sin avión) y KPIs 2×2 apilados, dock «Inicio · Ofertas · Candidatos · Candidaturas · Herramientas» (T-141) fijo abajo sin tapar el hero; sin scroll horizontal a 1440/1024/768/390/360 | ≈ (F3: antes ≠) | — | — (v2: default v1.8, C-12) | Hecho (`PKG P09 5`) |
| 7 (nueva v2) | Acciones de estado de la necesidad (M05) | «Ofertas y cobertura»: por oferta `Ver condiciones`, `Buscar candidatos`, `Gestionar candidaturas`, `Editar`, `Duplicar`, `Archivar` y `Pausar` (→ `Reabrir`) (`v18-runtime-demo.md` §D-EMP-03, `evidencias/v2/50/SHOT-05-8-v18-1440.jpg`); conectado: «Reanudar» / «Cerrar oferta» en la pausada (README del conectado) | En el detalle: «Candidaturas (N)», «Editar», «Duplicar» (`[id]/page.tsx:90`, es:1119), «Pausar» / «Reanudar», «Cerrar necesidad» y «Archivar» con paso de confirmación (`RequirementStatusActions.tsx:14-48`; archivo y borradores en `4aca94e`, T-64); ≥ 44 px con puntero grueso | ≈ (F3: antes ≠) | P3 | — | Hecho (duplicar y archivar: ORG-05, P10 re-verifica) |

Capturas: `evidencias/shots/demo/D-EMP-01-resumen-1440.png`, `D-EMP-01-resumen-390.png`; Next `v18-compare/next-after/org-home-1440.jpg`, `org-home-390.jpg` (lote 11). xhigh: `evidencias/xhigh/50/SHOT-05-next-1440.jpg`, `SHOT-05-next-390.jpg`, `SHOT-05-v18-390.jpg`. v2: `evidencias/v2/50/SHOT-05-7-next-1440.jpg`, `SHOT-05-7-next-390.jpg`, `SHOT-05-7-v18-1440.jpg`, `SHOT-05-7-v18-390.jpg`, `SHOT-05-8-next-1440.jpg`, `SHOT-05-8-next-390.jpg`, `SHOT-05-8-v18-1440.jpg`, `SHOT-05-8-v18-390.jpg`.

---

## SHOT-06 · Directorio / matches — v1.8 `S-EMP-04` (`D-EMP-04`) ↔ Next `N-ORG-05`

**Estado global:** PARCIAL (F3 P10, 27/10). El directorio «Buscar candidatos» (v2-22/v2-23) es la pantalla de la v1.8 (cabecera, filtros, tarjeta con medallas, Compacta/Ampliada, paginador); `/matches` sigue siendo la lista explicativa por necesidad. Sin tarifa (T-33) y sin «Comparar» en el directorio.

| # | Elemento | v1.8 (`D-EMP-04-buscar-candidatos-1440.png`) | Next (`local-19-matches-es-1440.jpg` y `-390.jpg`, lote 13, ES; `next-after/org-matches-1440.jpg`, lote 11) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cabecera | «RED PROFESIONAL» / «Encuentra a tu próximo técnico.» | Directorio `/app/organization/candidates`: «RED PROFESIONAL» / «Encuentra a tu próximo técnico.» (PKG directory, BR-28); `/matches` conserva «RED EXTERNA · VISTA PREVIA DEL MATCHING» + título de la necesidad. `PKG directory a`; `PKG P09 3` | = (F3: antes ≠) | — | — | Mantener (hecho v2-22) |
| 2 | Filtros | «Evaluar para la oferta» (select), «Buscar candidato», «Más filtros» plegable, «Solo elegibles con cobertura» **marcado**, «Limpiar filtros» | Directorio: «Evaluar para la oferta» (select de publicadas vigentes), «Base habitual», «Más filtros» plegable con los 7 controles, «Aplicar filtros», «Limpiar filtros» (T-154/T-155); `/matches`: «Buscar», «Ordenar por», «Solo elegibles» **marcada por defecto** (T-94), «Aplicar», «Limpiar». `PKG directory d/e`; `PKG matching-v18 1` | ≈ | P3 | — | Mantener (hecho v2-23 / v2-25) |
| 3 | Tarjeta | una fila por técnico: avatar con iniciales teal, nombre, medallas (años · B1.1 · A320 · SM · +N), base, tarifa «48,75 € / h» y su origen, «6/7 jornadas · cobertura viable», «Abrir perfil», casilla «Comparar» | Directorio: una tarjeta por profesional con avatar de iniciales/«CF», nombre o «Profesional anónimo CF-…», `MedalStrip`, base, bloque ampliado (experiencia · inglés, aeronaves, países), «Abrir perfil» (`DirectoryCard.tsx`); sin tarifa (T-33) ni «6/7 jornadas» (no evalúa, T-155) ni «Comparar» (solo en `/matches`). `/matches`: la tarjeta explicativa con checklist y «Requisitos del perfil». `PKG directory c/g/h` | ≈ (F3: antes ≠) | P3 | — · tarifa: T-33 | Mantener (hecho v2-23) |
| 4 | Vista | «Compacta» / «Ampliada» y paginación «1 / 1 · 20 perfiles por página» | Directorio: «Compacta» / «Ampliada» (`aria-pressed`, recordado) y «{p} / {P} · 20 perfiles por página» (T-152). `PKG directory b/f/g` | = (F3: antes ≈) | — | — | Mantener (hecho v2-23) |
| 5 | **Bug visual de Next** | — | corregido en `9a99f89` (W1-02): la lista va en un subgrid `1rem max-content minmax(0,1fr)`, la columna de etiqueta se ajusta a «Disponibilidad» y la monoespaciada queda solo para los códigos (`MatchCard.tsx:108-122`). La captura `local-19-matches-es-1440.jpg` (lote 13) es anterior y aún muestra el solape; no se ha regenerado | = (antes −) | — | — | — |
| 6 | 390 | filtros apilados; tarjeta en 2 columnas internas | filtros apilados; tarjeta a una columna | ≈ | — | — | — |

Capturas: `evidencias/shots/demo/D-EMP-04-buscar-candidatos-1440.png`, `D-EMP-04-buscar-candidatos-390.png`; Next `docs/audit/evidence/local-19-matches-es-1440.jpg`, `local-19-matches-es-390.jpg` (lote 13), `v18-compare/next-after/org-matches-1440.jpg` (lote 11). xhigh: `evidencias/xhigh/50/SHOT-06-next-1440.jpg`, `SHOT-06-next-390.jpg` (con el subgrid de `9a99f89`, sin solape), `SHOT-06-v18-390.jpg`.

---

## SHOT-07 · Nueva necesidad — v1.8 `S-EMP-02` (`D-EMP-02`) ↔ Next `N-ORG-03`

**Estado global:** PARCIAL (F3 P10, 27/10). El constructor es el de la v1.8 en 4 bloques con el lateral navy (v2-09/v2-12/v2-13) y, desde P10, los chips del «Perfil técnico»; sin el desglose de comisión (SCOPE OUT).

| # | Elemento | v1.8 (`D-EMP-02-nueva-necesidad-1440.png`) | Next (`next-after/org-new-requirement-1440.jpg`, lote 11, EN) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cabecera | «CONSTRUCTOR» / «Define el trabajo real.» / «Guarda un borrador, revisa requisitos y publica cuando esté completo.» | «DEMO MRO MADRID» / «New work requirement» / «…Crew Flex evaluates your internal capacity first.» | ≈ | — | — | — |
| 2 | Títulos de bloque | `Panel` con `h2` 16px: «01 · Perfil técnico», «02 · Tiempo y cobertura», «03 · Condiciones y logística» | Eyebrows «01 · NECESIDAD», «02 · PERIODO (UTC)» (h3 «Jornadas»), «03 · CUALIFICACIONES» (h3 «Perfil técnico», P10), «04 · CONDICIONES Y LOGÍSTICA» en un panel; lateral navy «Revisar antes de publicar». `PKG P10 0b` | ≈ (F3: antes ≠) | P3 | — | Mantener |
| 3 | Selección | chips «Aeronaves aceptadas», «Motores», «Cursos», «Capacidades obligatorias/deseables» y días «5 dic…11 dic» | P10: chips de casilla «Aeronaves aceptadas», «Motores», «Capacidades obligatorias» (navy al marcar), select «Categoría obligatoria», «Experiencia mínima (años)», casilla de habilitación de tipo; cualificaciones del catálogo en listas con código monoespaciado; días como lista de jornadas (`ShiftEditor`, v2-09) en vez del day-picker. `PKG P10 0b/3`; capturas `docs/audit/evidence/parity/P10/P10-builder-rules-after-{1440,390}.jpg` | ≈ (F3: antes ≠) | P3 | — | Mantener (hecho v2-09 + P10) |
| 4 | Resumen lateral | panel navy sticky «Revisar antes de publicar» (chip «Planificado», «400,00 €», desglose de comisión) con scroll interno (`v12.css:6`) | Panel navy sticky «Revisar antes de publicar»: chip «Planificado», «{€} / jornada de {h} h», «{n} jornadas requeridas», recuento de candidatos, vista previa y botones (v2-13, T-66); sin desglose de comisión (SCOPE OUT). `PKG requirement-builder prb2`; `PKG P10 1` | ≈ (F3: antes −) | P3 | — · desglose de comisión: SCOPE OUT (ORG-03 #10) | Mantener (hecho v2-13) |
| 5 | Logística | casillas de vuelos, alojamiento, transporte, comidas y herramientas | Casillas «Vuelos incluidos», «Alojamiento incluido», «Transporte local incluido», «Comidas incluidas», «Herramientas propias requeridas» (v2-12, T-62). `PKG requirement-builder prb3`; `PKG P10 3` (captura) | = (F3: antes −) | — | — | Mantener (hecho v2-12) |

Capturas: `evidencias/shots/demo/D-EMP-02-nueva-necesidad-1440.png`; Next `v18-compare/next-after/org-new-requirement-1440.jpg` (lote 11). xhigh: `evidencias/xhigh/50/SHOT-07-next-1440.jpg`, `SHOT-07-next-390.jpg`, `SHOT-07-v18-390.jpg`.

---

## SHOT-08 · Acceso (login) — v1.8 `S-AUTH-01` (`C-ANON-01`) ↔ Next `N-AUTH-02`

**Estado global:** PARCIAL. v1.8 muestra el login dentro del shell completo, con el sidebar navy y un mensaje de beta. Next usa una tarjeta centrada y sin shell.

| # | Elemento | v1.8 (`evidencias/shots/connected/C-ANON-01-login-1440.png`, `-390.png`) | Next (`local-21-login-es.jpg`, lote 13) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Composición | shell con sidebar («BETA LOCAL»: «Acceder a mi cuenta», «Herramientas»), breadcrumb «CrewFlex / Acceder a mi cuenta», «Ver demo» y banda verde; 2 columnas (mensaje + tarjeta) (v2: medido en el conectado, `evidencias/v2/50/SHOT-08-1-v18c-1440.jpg`, `-390.jpg`) | tarjeta de 448 px centrada sobre `canvas`, con la marca v1.8 (isotipo del avión + «CrewFlex» + «AVIATION», T-140) enlazando a `/` y ES/EN (`src/app/(auth)/layout.tsx:6-19`); sin lateral ni banda. F3 P14a: sin cambio de forma; el cierre de sesión aterriza aquí con «Sesión cerrada.» (`PKG P14a 6`) | ≠ | P3 | — | mantener |
| 2 | Mensaje | «BETA POR INVITACIÓN» / «Tu siguiente etapa empieza aquí.» / «Tu perfil y tu disponibilidad, bajo tu control. Las herramientas se pueden utilizar sin abrir una cuenta.» + aviso ámbar «Pruebas locales…» | «Iniciar sesión» / «Accede a tu espacio de CrewFlex.» (es:125-126); desde T-145, bajo los enlaces, la frase de v1.8 «Las herramientas se pueden utilizar sin abrir una cuenta.» + «Abrir herramientas» → `/tools` (`login/page.tsx:54-60`, es:2549-2550; `PKG shell-visual 12`). Sin «BETA POR INVITACIÓN» ni el aviso ámbar (beta local) | ≠ | P3 | — | — |
| 3 | Botón | **teal** `.tb-button.primary` «Iniciar sesión» | **naranja** a todo el ancho «Iniciar sesión» | ≠ | P3 | — | mantener |
| 4 | Enlaces | «Tengo una invitación» y «He olvidado mi contraseña» (teal, subrayados) | «¿Has olvidado tu contraseña?» y «¿Sin cuenta? Crea una» (azul, negrita) | ≠ | P3 | — | registro abierto frente a invitación: ver el diff de auth |
| 5 | Campos | «Email» y «Contraseña» | «Correo electrónico» y «Contraseña» | ≈ | — | — | — |

Capturas: `evidencias/shots/connected/C-ANON-01-login-1440.png`, `C-ANON-01-login-390.png`; Next `docs/audit/evidence/local-21-login-es.jpg` (lote 13), `deployed-390-login.jpg` (2026-10-09, anterior). xhigh: `evidencias/xhigh/50/SHOT-08-next-390.jpg` (el modo conectado de v1.8 no está levantado). v2: `evidencias/v2/50/SHOT-08-1-v18c-1440.jpg`, `SHOT-08-1-v18c-390.jpg` (conectado medido).
F3 (P14a, 28/10): filas re-verificadas sobre el código y en `PKG P14a 6`; sin captura nueva del login (AUTH-01 y la captura del acceso se revisan en P14b).

---

## SHOT-09 · Menú móvil y vista móvil — v1.8 `D-GEN-03`, `D-GEN-04`, `C-*-mobile-menu-390` ↔ Next shell `<lg`

**Estado global:** PARCIAL. Ver VIS-06. v1.8 usa un drawer superpuesto con fondo oscurecido y el dock siempre visible; Next, un desplegable en el flujo.

| # | Elemento | v1.8 (`D-GEN-04-menu-movil-390.png`, `D-GEN-03-vista-movil-preview-1440.png`) | Next (`local-23-overview-nav-390.jpg`, lote 14) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Apertura | drawer de 265px desde la izquierda, sobre el contenido oscurecido; X para cerrar; 11 entradas con scroll interno + «Datos y alcance» y la persona | panel navy bajo la barra (isotipo, campana, «Cerrar sesión», «Menú») con las entradas en filas que envuelven, sin títulos de sección; F3 P14a: «Mi espacio · Mi pasaporte · Cualificaciones · Disponibilidad · Oportunidades · Mis candidaturas · Documentos · Logbook» y «Avisos · Herramientas · Configuración», 11 entradas, sin desbordamiento (`PKG P14a 2`; `docs/audit/evidence/parity/P14a/P14a-menu-after-390.jpg`); v2: `evidencias/v2/50/SHOT-09-1-next-390.jpg` | ≠ | P3 | — | mantener |
| 2 | Dock | visible bajo el drawer (Inicio, Ofertas, Calendario, Candidaturas, Herramientas) | dock fijo abajo `<lg` con «Inicio · Ofertas · Calendario · Candidaturas · Herramientas» (T-141, `44045db`), visible también con el desplegable abierto (captura `P14a-menu-after-390.jpg`); empresa «Inicio · Ofertas · Candidatos · Candidaturas · Herramientas», admin «Administración · Herramientas» (`PKG P14a 2b/7/9`, `PKG shell-visual 7`; `docs/audit/evidence/parity/P14a/P14a-shell-after-390.jpg`, `P14a-org-dock-after-390.jpg`) | = (F3: antes −) | — | — (T-141, default v1.8 C-12) | — (VIS-06 #11 en P14c) |
| 3 | Vista móvil simulada | columna de 520px sobre navy, sin dock | no | ✗ | — | DEMO-ONLY | — |

Capturas: `evidencias/shots/demo/D-GEN-04-menu-movil-390.png`, `evidencias/shots/demo/D-GEN-03-vista-movil-preview-1440.png`, `evidencias/shots/connected/C-EMP-30-mobile-menu-390-390.png`; Next `docs/audit/evidence/local-23-overview-nav-390.jpg` (lote 14). xhigh: `evidencias/xhigh/50/SHOT-09-menu-next-390.jpg`, `SHOT-09-menu-v18-390.jpg`, `SHOT-09-menu-abierto-foco-next-390.jpg`, `SHOT-09-menu-abierto-foco-v18-390.jpg`. v2: `evidencias/v2/50/SHOT-09-1-next-390.jpg`.
F3 (P14a, 28/10): Next `docs/audit/evidence/parity/P14a/P14a-shell-after-390.jpg` (dock), `P14a-menu-after-390.jpg` (desplegable abierto), `P14a-org-dock-after-390.jpg`.

---

## SHOT-10 · Oportunidades (lista y detalle) — v1.8 `S-TEC-04` (`D-TEC-04`) ↔ Next `/app/professional/opportunities` y `/[id]` (nueva v2)

**Estado global:** PARCIAL (F3 2026-10-26: 8 de 9 filas en paridad). La página existe desde `db05af1` (M07, D-12) con la misma cabecera,
los mismos filtros y el mismo estado vacío que v1.8; la tarjeta lleva ya tarifa, días, personas, bloque y los botones de la v1.8
(sin afinidad, T-03); el detalle es una página con la ficha completa y un 404 real; la candidatura enseña la copia del expediente
antes del consentimiento. Queda ≠ solo el modal «Preparar Candidate Pack» (fechas: D-06 Q6; documentos: D-07 P3 + D-10).

| # | Elemento | v1.8 (`D-TEC-04-oportunidades-1440.png`; v2: `evidencias/v2/50/SHOT-10-1-v18-1440.jpg`, `SHOT-10-1b-v18-1440.jpg`, `-390.jpg`) | Next (`evidencias/v2/50/SHOT-10-1-next-1440.jpg`, `-768.jpg`, `-390.jpg`; detalle `SHOT-10-5-next-1440.jpg`, `-390.jpg`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 (nueva v2) | Cabecera | `OPORTUNIDADES` / «Trabajo que encaja contigo.» / «Elegibilidad técnica y disponibilidad se evalúan por separado. Un porcentaje no sustituye un requisito obligatorio.» | igual (`opportunities.*`; `opportunities/page.tsx:40-42`). F3: `PKG P04 4b`; `docs/audit/evidence/parity/P04/P04-opportunities-after-1440.jpg` | = | — | — | — |
| 2 (nueva v2) | Búsqueda | campo «Buscar oportunidad» (placeholder «Aeronave, base o empresa…») que filtra en vivo, sin botón | el mismo campo en un `form role=search` GET con botón «Buscar» (`OpportunitiesToolbar.tsx:27-44`). F3: `PKG P04 4b` | ≈ | P3 | — | mantener (funciona sin JS) |
| 3 (nueva v2) | Filtros | 5 pastillas de 11px junto al buscador («Todas», «Compatibles», «Planificado», «Urgente», «AOG»), la activa en navy; inactivas 3,72:1 (medido) | las mismas 5, de 14px y 44px con puntero grueso, debajo del buscador, la activa en navy (`OpportunitiesToolbar.tsx:45-56`); ver A11Y-01 #7 (`aria-current`). F3: `PKG P04 4b/5` | ≈ | P3 | — | mantener |
| 4 (nueva v2) | Tarjeta | pastilla de tipo (AOG con borde superior naranja), «NN % afinidad», título en tinta, «empresa · base», tarifa «400,00 € / día · 50,00 € / h», chips grises, «N días · N persona», fechas · cobertura, veredicto (✓ verde con icono o «N requisitos obligatorios pendientes») y botones «Ver detalle» y «Preparar candidatura →» | urgencia «Planificado», chip «Candidatura: {estado}» si ya la hay, título como enlace azul, «organización · base · país», tarifa «400 € / día · 50 € / h» cuando se declara, «{día} → {día} · N días · N personas · Bloque completo» (F3, T-164), chips de cualificación navy en monoespaciada, veredicto en caja de color (verde / rojo / ámbar) y los botones «Ver detalle» y «Preparar candidatura» (`OpportunityCard.tsx:28-146`); sin «% afinidad» (T-03, decidido). F3: `PKG P04 4b`; `docs/audit/evidence/parity/P04/P04-opportunities-after-1440.jpg` | ≈ (F3: antes ≠) | P3 | — (afinidad: T-03, decidido) | mantener (tarifa y botones hechos) |
| 5 (nueva v2) | Paginación | sin paginación (48 tarjetas seguidas para Marcos B.) | 20 por página, «N oportunidades · página X de Y» con `role=status`, «Anterior»/«Siguiente», nota de tope y redirección a la última página (`OpportunitiesToolbar.tsx:61-91`, `opportunities/page.tsx:71-75`). F3: `PKG P04 4b` | + | — | — | — |
| 6 (nueva v2) | Estado vacío | «Sin ofertas para este filtro» / «Prueba otra búsqueda o revisa tu perfil y fechas.» | igual (`opportunities.emptyTitle/emptyDescription`). F3: `PKG P04 5` | = | — | — | — |
| 7 (nueva v2) | Detalle | modal «Ver detalle» sobre la lista (`D-TEC-04c-detalle-oferta-1440.png`) | página propia: eyebrow «OPORTUNIDAD», título, «Publicada por {organización}», «Volver a oportunidades», hechos, condiciones y logística, panel «Tu elegibilidad» (chip, bloqueos, lista ✓/✗, requisitos del perfil, afinidad, nota) y panel «Candidatura» con la vista previa del expediente (`opportunities/[id]/page.tsx`); un id inexistente, no publicado o ajeno da un HTTP 404 real (T-147; META-02 #5 cerrado). La misma diferencia de contenedor que MKT-04 #10 (≈). F3: `PKG P04 6/6b/7`, `PKG shell-visual 6`; `docs/audit/evidence/parity/P04/P04-opportunity-after-1440.jpg`, `P04-opportunity-after-390.jpg` | ≈ (F3: antes ≠) | P3 | — | mantener |
| 8 (nueva v2) | Presentar candidatura | modal «Preparar Candidate Pack» con fechas, documentos, experiencia, dos consentimientos y vista previa | casilla única de consentimiento, la lista «Qué verá la organización», la vista previa real del expediente con la experiencia del logbook seleccionada (pack-view, T-111/T-112; MKT-05 #5/#8/#9) y la frase «Las candidaturas no reservan el calendario …» (F3, T-164); sin fechas (periodo entero) ni documentos. F3: `PKG P04 7` | ≠ | P2 | D-06 Q6 ↔ SCOPE-2 (jornadas); D-07 P3 + D-10 (documentos) | esperar al owner; vista previa y experiencia, hechas |
| 9 (nueva v2) | Responsive | 2 columnas en escritorio; a 390, una columna con el dock encima | 2 columnas desde `md` (`opportunities/page.tsx:87`), una a 390/360; sin desborde a 1440 / 1024 / 768 / 390 / 360 (medido); el dock de la v1.8 fijo bajo `lg` con «Ofertas» actual (T-141). F3: `PKG P04 5b`, `responsiveShots P04-opportunities-es`; `docs/audit/evidence/parity/P04/P04-opportunities-after-{1440,1024,768,390,360}.jpg` | ≈ | — | — | — |

Capturas: `evidencias/shots/demo/D-TEC-04-oportunidades-1440.png`, `D-TEC-04e-preparar-candidatura-1440.png` (21/10); v2: `evidencias/v2/50/SHOT-10-1-v18-1440.jpg`, `SHOT-10-1b-v18-1440.jpg`, `SHOT-10-1-v18-390.jpg`, `SHOT-10-1-next-1440.jpg`, `SHOT-10-1-next-768.jpg`, `SHOT-10-1-next-390.jpg`, `SHOT-10-5-next-1440.jpg`, `SHOT-10-5-next-390.jpg`; conectado: `scratchpad/v18-connected/shots/tecnico1-oportunidades-1440.png`.
Capturas F3 (P04, 26/10/2026, `scripts/local/p04-captures.mjs` sobre `next start` del propio build): `docs/audit/evidence/parity/P04/P04-opportunities-after-{1440,1024,768,390,360}.jpg`, `P04-opportunities-after-1440-en.jpg`, `P04-opportunity-after-{1440,390}.jpg`, `P04-home-feed-after-1440.jpg`.

---

## SHOT-11 · Candidaturas (técnico y empresa) — v1.8 `S-TEC-05`/`S-EMP-05` (`D-TEC-05`, `D-EMP-05`) ↔ Next `/app/professional/applications` y `/app/organization/requirements/[id]/applications` (nueva v2)

**Estado global:** PARCIAL. Las dos vistas existen desde `db05af1` (M08) con la máquina de estados ratificada (D-06): propuesta versionada, aceptación explícita, confirmación con nueva comprobación, cancelación con motivo y finalización. Faltan la vista global de la empresa, la conversación (OUT) y las condiciones económicas y de logística (LATER).

| # | Elemento | v1.8 (`D-TEC-05-candidaturas-1440.png`, `D-EMP-05-candidaturas-1440.png`; v2: `evidencias/v2/50/SHOT-11-1-v18-1440.jpg`, `SHOT-11-1b-v18-1440.jpg`, `SHOT-11-6-v18-1440.jpg`) | Next (`evidencias/v2/50/SHOT-11-1-next-1440.jpg`, `-768.jpg`, `-390.jpg`; empresa `SHOT-11-6-next-1440.jpg`, `-390.jpg`, `SHOT-11-6b-next-1440.jpg`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 (nueva v2) | Cabecera del técnico | `MI ACTIVIDAD` / «Tus candidaturas.» / «La empresa revisa condiciones; el técnico acepta; la empresa confirma.» | igual (es:1300-1302; `applications/page.tsx:40-42`) F3 (26/10), en ejecución: `PKG P05 3b` | = | — | — | — |
| 2 (nueva v2) | Filtros de estado | «Todas (N)» y siempre los 9 estados («Recibida» … «Cancelada»), 11px | «Todas (N)» y solo los estados presentes, 14px y 44px con puntero grueso (`:63-95`) F3, en ejecución: `PKG P05 3b` (profesional: «Todas (n)» + los presentes) y `PKG P05 7b` (empresa: «Todas (2)» + los 9 estados) | ≈ | P3 | — | mantener |
| 3 (nueva v2) | Estado vacío | icono de maletín + «Sin candidaturas en este estado» / «Selecciona otra oferta o prepara una candidatura.» (2,82:1, medido) | «Tu próxima candidatura empieza aquí» / «Busca una oportunidad que encaje contigo y preséntate.» + «Ver oportunidades» (`:80-89`), el texto del inicio de v1.8; con un `?status=` sin candidaturas (solo por URL), «Sin candidaturas en este estado» / «Selecciona otra oferta o prepara una candidatura.» = v1.8, sin icono (F3, `applications/page.tsx`). F3, en ejecución: `PKG P05 3c` (profesional), `PKG P05 8` (empresa, pestaña «Retirada») | ≈ | — | — | — |
| 4 (nueva v2) | Tarjeta del técnico | estado, oferta, «empresa · N fechas», fechas, «Recibida dd/mm», `Ver expediente`, `Conversación (N)`, `Retirar`; con propuesta, bloque de condiciones con tarifa, dietas, turno y logística y línea de tiempo | chip de estado, título (enlace si la necesidad sigue abierta), «organización · base · periodo · {n} jornadas» (T-165, F3), nota de la necesidad (pausada, cerrada o cubierta; la cubierta en tono neutro `text-muted` cuando la confirmada es la propia, `applications/page.tsx:146-157`), propuesta con versión, fecha, las condiciones congeladas (tarifa, dietas, turno, contrato, logística, importe base; v2-12) y la nota «CrewFlex intermedia; …», motivo, «Historial» plegable, «Ver expediente» (v2-15) y acciones (`ApplicationDetails.tsx`). Sin «Conversación (N)» (OUT) ni «Recibida dd/mm» suelta (está en el historial). F3, en ejecución: `PKG P05 3b/5/6/12`; `docs/audit/evidence/parity/P05/P05-applications-after-1440.jpg`, `-390.jpg` | ≈ (F3: antes ≠) | — | — · SCOPE OUT (conversación) | mantener; no portar la conversación (OUT) |
| 5 (nueva v2) | Vista de la empresa | `PIPELINE` / «De candidatura a cobertura.»: todas las candidaturas de la organización, con los mismos filtros, «100% afinidad inicial», comisión y acciones; filtrable por oferta desde «Gestionar candidaturas» | «Pipeline» / «De candidatura a cobertura.»: todas las candidaturas de la organización, 20 por página, «Todas ({n})» + los 9 estados, filtrable por necesidad desde «Gestionar candidaturas» («Oferta seleccionada: {título}» + «Ver todas» + «Volver a ofertas») y por candidatura: estado + elegibilidad viva, lista ✓/✗, propuesta, motivo, historial, «Ver expediente» y acciones (`organization/applications/page.tsx`; `OrgApplicationCard.tsx`; v2-05); sin «{score}% afinidad inicial» (T-03) ni comisión (OUT); los miembros sin gestión ven el aviso propio de candidaturas. F3, en ejecución: `PKG P05 7b/8/9/11`; `docs/audit/evidence/parity/P05/P05-org-applications-after-1440.jpg`, `-390.jpg` | ≈ (F3: antes ≠) | — | — · SCOPE OUT (comisión) | mantener |
| 6 (nueva v2) | Acciones | por estado: «Preseleccionar», «Enviar propuesta», «Rechazar», «Confirmar asignación», «Cancelar asignación», «Finalizar»… | botones por transición del dominio; primario naranja para confirmar y aceptar, `danger` para rechazar, cancelar y retirar; «Finalizar» deshabilitado con `title` y texto `sr-only` hasta el último día (`ApplicationActions.tsx:162-195`); pasos con motivo o casilla (A11Y-04 #7) F3, en ejecución: `PKG P05 5/8/9/12` | ≈ | — | — | — |
| 7 (nueva v2) | Responsive | una columna; a 390 con el dock | una columna a 1440, 768 y 390, sin desborde (medido) F3, en ejecución: `PKG P05 4` (1440/1024/768/390/360 sin desborde; dock «Candidaturas» bajo `lg`), `scripts/local/p05-captures.mjs` (la empresa a 1440/390) | = | — | — | — |

Capturas: `evidencias/shots/demo/D-TEC-05-candidaturas-1440.png`, `D-EMP-05-candidaturas-1440.png` (21/10); v2: `evidencias/v2/50/SHOT-11-1-v18-1440.jpg`, `SHOT-11-1-v18-390.jpg`, `SHOT-11-1b-v18-1440.jpg`, `SHOT-11-6-v18-1440.jpg`, `SHOT-11-6-v18-390.jpg`, `SHOT-11-1-next-1440.jpg`, `SHOT-11-1-next-768.jpg`, `SHOT-11-1-next-390.jpg`, `SHOT-11-6-next-1440.jpg`, `SHOT-11-6-next-390.jpg`, `SHOT-11-6b-next-1440.jpg`; conectado: `scratchpad/v18-connected/shots/tecnico1-candidaturas-1440.png`, `empresa-candidaturas-1440.png`.

---

## Backlog derivado (v2: tareas portables con el alcance nuevo)

Alcance: NOW + NEXT + LATER de `V1_SCOPE.md`; las decisiones abiertas se resuelven con el default v1.8, documentado y reversible (V2_BRIEF). Orden: por severidad y, dentro de ella, por impacto. Estado comprobado en el SNAP (`821c24f`) y en ejecución; las puertas (`pnpm check`, `build`, `ui-smoke`) no se han ejecutado en esta revisión. «Área 20/30/40» indica que la tarea la detalla otro fichero del diff; aquí solo se recoge su parte visual.

**Pendientes · P2**

1. **Dock inferior móvil de v1.8** — VIS-06 #11, VIS-07 #22, A11Y-06 #10, META-01 #3, SHOT-01 #8, SHOT-02 #6, SHOT-05 #6, SHOT-09 #2 (y opcionalmente VIS-06 #9-#10).
   - Ficheros: `src/components/layout/AppShell.tsx`, un `MobileDock.tsx` nuevo junto a `NavLinks.tsx` (reutiliza `ICON_PATHS`), `src/app/layout.tsx` (`viewport` con `viewportFit: "cover"`), `messages/{es,en}.json` (`nav.dock.*`), `docs/product/DESIGN_SYSTEM.md:37,87`.
   - Criterio: por debajo de 761px (o `<lg`) aparece un `nav` «Accesos rápidos» fijo abajo con los 5 accesos de v1.8 por rol: técnico Inicio · Ofertas · Calendario · Candidaturas · Herramientas; empresa Inicio · Ofertas (Necesidades) · Candidatos · Candidaturas · Herramientas; admin 2. Cada objetivo mide ≥44×44 y lleva `aria-current`. La etiqueta es ≥11px y ≥4,5:1 (v1.8: 9px y 3,34). Usa `env(safe-area-inset-bottom)` y el contenido reserva su alto. Sigue `scrollWidth` = 390 y un smoke a 390 lo comprueba.
   - Tamaño M. BD/Edge: no. Default v1.8: C-12 (dock).
2. **Hero del inicio técnico: avatar en degradado, medallas y KPIs** — VIS-01 #20, VIS-02 #15, VIS-08 #6, SHOT-01 #2, #4, #6, SHOT-03 #2.
   - Ficheros: `src/features/professional/components/IdentityCard.tsx`, `src/app/app/professional/page.tsx`, una tira de medallas nueva (años, categoría, aeronave, especialidad, «+N»), `src/app/globals.css` (degradado teal `#103a4c→#186c72` como utilidad).
   - Criterio: en «Mi espacio» la tarjeta de identidad es el hero teal de v1.8: avatar de iniciales con degradado, medallas, «Editar perfil», barra «Tu pasaporte está al X%» y los dos KPIs «oportunidades compatibles» y «asignaciones confirmadas», con todo el texto ≥4,5:1 sobre el degradado (medido). Sin foto subida (v1.8 la guarda solo en el navegador).
   - Tamaño L. BD/Edge: no. Default v1.8: hero y medallas (D-07 P1/P2/P4 ratificadas; sin acceso de terceros).
3. **Cabecera de escritorio con breadcrumb y campana; avisos in-app** — VIS-06 #4, #5, #7, VIS-07 #20.
   - Ficheros: (a) `AppShell.tsx` y un `TopBar.tsx` con «CrewFlex / {sección}» y la campana; (b) los avisos: tabla `notifications` con RLS, función Edge `notifications` (listar y marcar leído) y página `/app/notifications` con entrada en el menú.
   - Criterio: (a) en `lg+` una barra blanca encima del contenido con el breadcrumb de la sección del menú, sin «Probar como» ni «Vista móvil»; (b) la campana muestra el punto de no leídos con texto `sr-only` («N avisos sin leer»), abre la lista de avisos y se marcan leídos. Tests RLS de la tabla nueva.
   - Tamaño (a) S-M, (b) L. BD/Edge: (a) no; (b) sí (migración + función; desplegar requiere al owner). Default v1.8: AB-29 revertido (cabecera); avisos en LATER.
4. **Mini calendario con «Asignado», puntos de oportunidad y leyenda; marca que quepa a 390** — VIS-02 #11, #13, SHOT-01 #5, VIS-03 #6.
   - Ficheros: `src/features/availability/components/AvailabilityMonth.tsx`, `src/app/app/professional/page.tsx` (pasar días asignados y días con oportunidades compatibles), `src/features/availability/calendar.ts` (`assignmentDays` también con `finished`), `AvailabilityManager.tsx:405-409`, `src/app/app/professional/availability/page.tsx:34-44`, `DESIGN_SYSTEM.md:49-53`.
   - Criterio: el mini calendario pinta los días asignados (`#dce7fb`/`#375f9d` o equivalente ≥4,5:1) y un punto en los días con oportunidades compatibles; la leyenda suma «Asignado» y «Oportunidades». Una candidatura `finished` mantiene la marca, como v1.8. A 390 la marca del editable no sale de la celda: medido con `getBoundingClientRect` (hoy 50,7px frente a 41,7). El doc nombra la marca de 11px. Tests de `assignmentDays`.
   - Tamaño M. BD/Edge: no.
5. **Marca v1.8: avión, «CrewFlex» y favicon** — VIS-08 #1-#4, I18N-05 #7.
   - Ficheros: `AppShell.tsx:84-95`, `src/app/(auth)/layout.tsx:12-20`, `src/app/page.tsx:12-20`, `src/app/icon.svg`, `messages/{es,en}.json` (`common.appName`, es:3,25,107,212,812,941,1009,1331), `src/app/layout.tsx:12`, `tests/design/icon.test.ts`, `tests/i18n/titles.test.ts`.
   - Criterio: isotipo naranja con el avión navy, «CrewFlex» + «AVIATION» (≥11px) en el menú, la portada y auth; favicon con fondo navy y avión naranja; títulos «… · CrewFlex»; `grep "Crew Flex"` en `messages/` y `src/` sin resultados; el texto copiado del conversor ya dice «CrewFlex».
   - Tamaño S-M. BD/Edge: no. Default v1.8: C-12 (marca), reversible.
6. **Oportunidades: botones de la tarjeta, vista previa y tarifa** — SHOT-10 #4, #8, I18N-01 #6 (área 30 para la tarifa).
   - Ficheros: `src/features/opportunities/components/OpportunityCard.tsx`, `ApplyPanel.tsx`; tarifa: migración y contrato de `work_requirements`, `RequirementForm.tsx`, `src/i18n/format.ts` (moneda).
   - Criterio: (a) cada tarjeta tiene «Ver detalle» y «Preparar candidatura →», este último deshabilitado si hay requisitos pendientes; el panel de candidatura muestra la vista previa «Qué verá {organización}». (b) La tarifa sale como «400,00 € / día · 50,00 € / h» en ES y «€400.00 / day» en EN.
   - Tamaño (a) S, (b) L. BD/Edge: (a) no; (b) sí. Default v1.8: tarjeta; tarifa en LATER.
7. **Candidaturas: vista global de la empresa y condiciones económicas** — SHOT-11 #4, #5 (área 30).
   - Ficheros: `/app/organization/applications` nueva con entrada «Candidaturas» en el menú de empresa, `src/features/applications/api.ts` y una lista en la función `applications`; `ApplicationDetails.tsx` (condiciones).
   - Criterio: la empresa ve en una página todas sus candidaturas con los 9 filtros de estado y el filtro por necesidad, como «De candidatura a cobertura.». Las propuestas muestran tarifa, dietas, turno y logística cuando existan (LATER).
   - Tamaño L. BD/Edge: sí (lista de la organización). Default v1.8: vista global.
8. **Herramientas y aprendizaje de LATER** — SHOT-04 #3, VIS-07 #8, #11 (áreas 20 y 40).
   - Ficheros: `src/features/tools/*` y `src/app/app/tools/*`; logbook en `src/features/logbook/*` con migración.
   - Criterio: fichas «Reto diario», «Traductor» e «Inglés y siglas» en `/app/tools`, con el mismo teal y la nota de privacidad; «Logbook» con su icono `BookOpen` en el menú. Combustible queda fuera hasta la revisión técnica (D-11).
   - Tamaño L. BD/Edge: logbook sí; el resto no. Alcance LATER.
9. **Directorio y «Ofertas en la red» para empresas** — VIS-07 #17, #18, SHOT-06 #1, #3 (área 30).
   - Ficheros: `/app/organization/candidates`, `/app/organization/network`, `src/features/matching/*`.
   - Criterio: entradas «Buscar candidatos» (icono lupa) y «Ofertas en la red» en el menú de empresa, con los filtros de v1.8; la tarifa sale cuando exista (tarea 6b). Los documentos del perfil siguen cerrados (D-07 P3/D-10).
   - Tamaño L. BD/Edge: sí. Default v1.8: C-10/OD-7 y D-12 (empresa).

**Pendientes · P3**

10. **Foco y Escape en los pasos de confirmación en línea** — A11Y-02 #4.
    - Ficheros: `src/features/requirements/components/RequirementStatusActions.tsx:48-64`, `src/features/applications/components/ApplicationActions.tsx:101-161`.
    - Criterio: al cancelar un paso («Mantenerla abierta», «Volver») el foco vuelve al botón que lo abrió, como `ConfirmButton.tsx:30-34`; Escape cierra el paso con el foco dentro. Un test de componente o un smoke con teclado.
    - Tamaño S. BD/Edge: no.
11. **44px que faltan con puntero grueso** — A11Y-05 #11.
    - Ficheros: `src/app/(auth)/layout.tsx:12`, `src/features/requirements/components/RequirementsList.tsx:43`, `src/features/opportunities/components/OpportunityCard.tsx:41`, `src/features/applications/components/ProfessionalActivity.tsx:69-74`, `src/app/app/professional/applications/page.tsx:117-122`.
    - Criterio: con `hasTouch` a 390 y a 1024 todos esos enlaces miden ≥44px de alto (`inline-flex items-center pointer-coarse:min-h-11`; `py-2.5` no basta con una línea). El `ui-smoke` 25 los incluye.
    - Tamaño S. BD/Edge: no.
12. **Pie de v1.8 sin etiquetas de versión** — VIS-06 #14, I18N-03 #5.
    - Ficheros: `AppShell.tsx` (o el `TopBar`/pie nuevo), `messages/{es,en}.json`.
    - Criterio: al final de `main`, «CREWFLEX AVIATION» y «Cualificación · Disponibilidad · Confianza», ≥11px y ≥4,5:1 (v1.8: 9px y 2,40), sin «V1.8»; a 390 sin el lema y sin tapar el dock.
    - Tamaño S. BD/Edge: no. Default v1.8: C-12.
13. **KPIs y accesos del inicio de empresa** — SHOT-05 #3, #5.
    - Ficheros: `src/app/app/organization/page.tsx`, `src/features/requirements/dashboard.ts`.
    - Criterio: suma los KPIs «Red visible» (profesionales visibles en el pool) y «Jornadas cubiertas», el bloque «Cómo cerrar una cobertura» (4 pasos) y los accesos «Constructor», «Red profesional» y «Candidate Packs» (este último, cuando exista).
    - Tamaño M. BD/Edge: «Red visible» puede pedir un recuento en Edge. Default v1.8: KPIs.
14. **Filtros con `aria-current="true"`** — A11Y-01 #7.
    - Ficheros: `src/app/app/professional/opportunities/page.tsx:104`, `src/app/app/professional/applications/page.tsx:70`.
    - Criterio: en cada página solo el enlace del menú lleva `aria-current="page"`; el filtro activo lleva `aria-current="true"`, con el mismo estilo (`aria-[current=true]:`).
    - Tamaño S. BD/Edge: no.
15. **«No encontrado» en los detalles** — META-02 #5.
    - Ficheros: `src/app/app/professional/opportunities/[id]/page.tsx`, `src/app/app/organization/requirements/[id]/page.tsx` (y `/matches`, `/applications`), `src/app/not-found.tsx`, `src/components/ui/StateMessage.tsx`.
    - Criterio: un id inexistente da el título neutro «Crew Flex» (o «No encontrado · …») y, si es posible, HTTP 404; la página «No encontrado» tiene un `h1`.
    - Tamaño S. BD/Edge: no.
16. **Color de la nota «La necesidad está cubierta.»** — SHOT-11 #4.
    - Ficheros: `src/app/app/professional/applications/page.tsx:131`.
    - Criterio: cuando la candidatura propia está `confirmed` o `finished`, la nota no sale en ámbar de aviso (tono neutro u `ok`).
    - Tamaño S. BD/Edge: no.

**HECHO (verificado en el SNAP y en ejecución)**

17. Solapamiento de «Disponibilidad» en la tarjeta de match — `9a99f89` (W1-02).
18. Anillo de foco doble ≥3:1 — `674b8b5` (W3-01); v2: 911 enfocables, sin recortes.
19. Favicon en colores de marca — `b9cd6e1` (W3-02); el glifo pasa a la tarea 5.
20. Mensajes en inglés fuera de la UI — `135085c` (W1-04); v2: 0 en 98 cargas.
21. Contraste del placeholder y de las notas de herramientas — `ac28483` (W3-03).
22. 44px de los controles compactos — `7255055` (W3-04).
23. Teclado en los `radiogroup` — `e37e95c` (W3-05).
24. Movimiento reducido — `6ac67d2` (W3-06); v2: 0 animaciones en 30 cargas.
25. Menú ↔ `<title>` — `fd01c52` (W3-07); v2: 27 títulos y test con oportunidades y candidaturas.
26. `DESIGN_SYSTEM.md` al estado real, incluida la antigua (c) — `c0673ba` (W4-01) y `c9f9826` (X-20): 11px en `:49-53`, «Ver como» en `:80-83`. Queda nombrar la marca «Asignada» (tarea 4).
27. Nota de privacidad de herramientas a 4,82:1 — `cac7461` (X-10).
28. «Cerrar sesión» del pie a 44px — `5d85caa` (X-09).
29. Portada: «Iniciar sesión» visible y ES/EN legible — `ef4d9b7`, `409c744` (X-01); 16,3:1.
30. 44px en casillas, enlaces sueltos, ES/EN y marca del shell — `5d85caa` (X-09); lo que queda pasa a la tarea 11.
31. Porcentajes con la coma del idioma — `f740447` (X-05); «48,78%».
32. Anuncio del cambio de ruta — sin cambio de código: con `next start` funciona en 7 de 7 navegaciones.
33. Mes con mayúscula en el calendario editable — `53c8633` (X-18).
34. Entradas «Oportunidades» y «Mis candidaturas» con icono, títulos y contadores — `db05af1` (M07/M08; VIS-07 #7, META-02 #2, SHOT-01 #9, SHOT-05 #3).
35. Menú lateral de escritorio desplazable — `52929c9` (X-03).

**BLOQUEADO (sigue fuera)**

- Impresión del Candidate Pack (VIS-05 #5): el PDF del pack está en OUT.
- Service worker y offline de herramientas (META-03 #1, #5): AB-37. El offline no figura en `V1_SCOPE.md` y un SW que cachee HTML con sesión sería inseguro.
- Comisiones (VIS-07 #21) y desglose de comisión del constructor (SHOT-07 #4): OUT.
- Conversación de la candidatura (SHOT-11 #4): OUT (chat).
- Documentos y desbloqueo de contacto en la candidatura (A11Y-04 #8, SHOT-10 #8): D-07 P3 y D-10; M09 preparado y apagado.
- Activación en producción de la revisión de cualificaciones (VIS-07 #12): OD-3.
- CSP obligatoria (META-03 #6): fuera del alcance de este diff (seguridad, T18).
- DEMO-ONLY y bugs de v1.8 (`✗`): bandas de demo, «Vista móvil», vista móvil simulada, «Datos y alcance», etiquetas de versión, «Tu tiempo.Tu», «1 apartados», capitalización «Octubre De», desbordes del calendario a 390.
