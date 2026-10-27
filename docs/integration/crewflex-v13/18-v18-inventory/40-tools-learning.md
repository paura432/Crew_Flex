# 40 · Diff v1.8 ↔ Next — Herramientas y aprendizaje

Filas 259 · = 128 · ≈ 34 · ≠ 21 · − 50 · + 13 · ✗ 13 · Sev. P0 0 · P1 26 · P2 20 · P3 56 · — 157 (verificación F3 del
27/10, paquete P08, sobre `b66151d` + los commits del paquete; paridad 162 / 233 = 69,5 %, retenidas 52; v2 del 22/10,
tras el bucle: filas 259 · = 79 · ≈ 23 · ≠ 11 · − 104 · + 13 · ✗ 29 · P1 26 · P2 62 · P3 47 · — 124; xhigh del 22/10: filas 257 · = 79 · ≈ 22 · ≠ 11 · − 104 · + 12 · ✗ 29 · P1 26 · P2 62 · P3 48 ·
— 121; refresco de la mañana del 22/10: filas 256 · = 80 · ≈ 20 · ≠ 11 · − 104 · + 12 · ✗ 29; 21/10: filas 253 · = 83 ·
≈ 19 · ≠ 7 · − 104 · + 9 · ✗ 31)

Alcance: caja de herramientas (`Toolbox.jsx`), motor (`engine.js`), conocimiento (`knowledge.js`), combustible
(`FuelSheet.jsx` + `FuelTools`), traductor, reto diario, progreso y medallas de aprendizaje. El logbook, también
portable desde SCOPE-2, está en `20-technician.md` (TEC-06) y no se duplica aquí. Next en v2: copia congelada `821c24f`
(SNAP, rama `feat/v18-html-parity`) servida con `next start` en `localhost:3003` sobre la base local, solo lectura. La
versión xhigh se hizo sobre `5c2d1a2` + árbol de trabajo (D-13, hoy `d3b876f`). v1.8 sin cambios: el zip tiene el mismo
sha256 (`53ee5b61…5af6`) y una extracción nueva es idéntica a `tmp/references/crewflex-v18` (`diff -rq` vacío).

## Verificación F3 (P08, 27/10/2026)

**Método.** Cada fila de TOOL-01…TOOL-09 y SHOT-04 (`50-visual-meta-a11y.md`) contra el código de la rama `f3/p08-tools`
(base `b66151d`, cabeza de P07) y en ejecución con `next start` sobre la base local, en español (`delta@crewflex.test`),
con el bloque `PKG P08` de `scripts/local/ui-smoke.mjs` (pasos 0…10, 12 comprobaciones, positivos y negativos) más los
pasos ya existentes 28a-28f (inglés, `alpha`) y `PKG shell-visual 7/12`. Tests: `pnpm exec vitest run src/features/tools
src/domain/learning.test.ts tests/design/contrast.test.ts` → 8 ficheros, 79/79. v1.8 sin cambios (mismo zip). La
inventario v2 se hizo sobre el SNAP `821c24f` de la mañana del 22/10; **esa misma tarde** `558654f` portó inglés y siglas,
traductor, reto diario y medallas de aprendizaje (L-1…L-4, T-1, T-2), `88d9a6d` corrigió T-3 y el 23/10 `44045db`
(shell-visual) añadió el dock, la tira de medallas y el `/tools` público (T-141, T-145, T-156). P08 no añade código de
producto: re-verifica, corrige el inventario y añade el smoke.

**Cobertura.** 259/259 filas en código. En ejecución en Next: TOOL-01, TOOL-05, TOOL-06, TOOL-07 y TOOL-08 con el
bloque `PKG P08` (salvo lo no provocable: TOOL-01 #9 y #21, TOOL-07 #8 y #11, TOOL-08 #7; y la tarjeta ausente de TOOL-04);
TOOL-02 y TOOL-03 por los tests de paridad (`engine.test.ts`, 26) y los pasos 25/28f ya existentes, sin cambios de código
desde la v2 salvo T-3. No verificadas en ejecución: TOOL-04 (ausente, D-11) y TOOL-09 (textos, por lectura del catálogo). Combustible (TOOL-04, TOOL-01 #26, TOOL-09 #2/#4 y la tabla de cadenas) sigue bloqueado
por D-11; «Sin conexión» (TOOL-01 #9, cadena #1) por NEW-01.

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| TOOL-01 #1 | `/tools` público | `≠` SCOPE | `≈` — (T-145, `44045db`): 5 herramientas sin cuenta, reto tras sesión | `PKG shell-visual 12`, `PKG P08 7/9` |
| TOOL-01 #2 | Dock móvil | `≈` | `=` (T-141) | `PKG shell-visual 7` |
| TOOL-01 #15, #17 | Arte del hero y chips | `≈` (T-1, T-2 pendientes) | `=` (`558654f`) | `PKG P08 1` (17×17) |
| TOOL-01 #23, #24, #28, #30 | Tarjetas y orden | `−`, `−`, `−`, `≈` | `=` (L-1…L-4, `558654f`) | `PKG P08 0b`, 28a |
| TOOL-01 #33 | Nota de privacidad | `≠` | `≈`: favoritos y progreso; sin la frase del combustible (D-11) | `PKG P08 0b` |
| TOOL-02 (nueva v2) | Nombre accesible del `summary` | `≠` (T-3) | `=` (`88d9a6d`) | `ui-smoke` 28f |
| TOOL-05 #1-#16 | Inglés y siglas | 12 `−`, 4 `✗` | 11 `=`, 1 `≈` (#6, recorte), 3 `≠` (#9, #10, #14 corrigen v1.8), #12 `=` (mismo contenido, revisión editorial pendiente) | `PKG P08 2`, 28b/28c, `search.test.ts` |
| TOOL-06 #1-#12 | Traductor | 10 `−`, 2 `✗` | 9 `=`, 1 `≈` (#7), 2 `≠` (#2, #5 corrigen v1.8) | `PKG P08 3`, 28d, `phrases.test.ts` |
| TOOL-07 #1-#19 | Reto diario | 13 `−`, 6 `✗` | 11 `=`, 3 `≈` (#1, #3, #17), 5 `≠` (#2, #6, #8, #18, #19 corrigen v1.8), #14 `=` | `PKG P08 4`, 28e, `questions.test.ts`, `learning.test.ts` |
| TOOL-08 #1-#3, #5, #6, #9 | Medallas | `−`, `✗`, `✗`, `−`, `✗`, `−` | `=`, `≠`, `≠`, `≈` (T-156), `≠`, `=` | `PKG P08 4/5`, `PKG shell-visual 2` |
| TOOL-09 #3, #5, #6, #7, #9 y cadenas #3-#5, #7, #25-#30 | Textos | `−` / `≠` / `✗` | `=` o `≈` según la fila; #28 `≠` | catálogo `es.json`, `data.ts`, `phrases.ts`, `questions.ts` |
| SHOT-04 #3 | Fichas | `−` (3 de 7) | `≈` (6 de 7; combustible D-11) | `PKG P08 0b`; `docs/audit/evidence/parity/P08/P08-tools-after-1440.jpg` |
| Recuento | Cifras | 259 · = 79 · ≈ 23 · ≠ 11 · − 104 · + 13 · ✗ 29 | 259 · = 128 · ≈ 34 · ≠ 21 · − 50 · + 13 · ✗ 13; paridad 102/217 = 47,0 % → 162/233 = 69,5 % | `recount.py 40-tools-learning.md` |
| Backlog | Estados | L-1…L-4, T-1…T-3 pendientes; A-1 bloqueada | L-1…L-4, T-1…T-3 y A-1 HECHAS; F-1 (D-11) y N-1 (NEW-01) siguen bloqueadas | este fichero |

Capturas F3: `docs/audit/evidence/parity/P08/P08-tools-after-1440.jpg`, `P08-tools-after-390.jpg`, `P08-daily-after-390.jpg`
(español, del propio smoke sobre `next start`).

## Verificación v2 (22/10/2026, tras el bucle)

**Método.**
- Código: cada fila contra el SNAP. `git diff 5c2d1a2 821c24f` en herramientas, `professional/page.tsx`, `layout/`,
  `admin/page.tsx`, `globals.css`, catálogos, `DESIGN_SYSTEM.md`, `contrast.test.ts` y `ui-smoke.mjs`. Las referencias
  `es:N` se han remapeado por ruta de clave (el bloque `tools` baja 64 líneas con el mismo contenido); las de código, a
  mano. Las ausencias, con búsquedas en `src`, `messages` y `supabase` del SNAP.
- En ejecución (Chromium, Playwright): los 97 registros de la mañana otra vez en la v1.8 demo, en Next `es` (`alpha`) y
  en Next `en` (`delta`), comparados registro a registro. Además, las comprobaciones de interfaz: favoritos, táctil,
  `summary` y su nombre accesible, punto de corte del hero, tamaños, color de la nota y «Ver como» con `platform.admin`.
  En la v1.8 demo, las vistas de combustible, inglés y siglas, traductor, reto y pasaporte. En la v1.8 conectada
  (`127.0.0.1:3125`, README disponible desde las 16:25): anónimo, `qa.tecnico1` y `qa.admin` con las cookies de sesión
  ya sembradas, sin iniciar sesión ni escribir en el servidor (en las sesiones anónima y de técnico no hubo ninguna
  petición a `/api/` distinta de GET; la de admin solo navega).
- Literales: un script busca cada «…» de las columnas v1.8 y Next en los textos de ejecución y en el código
  (`evidencias/v2/40/literals.py.txt`). Los que no aparecen se han revisado a mano: son valores de ejecución, mayúsculas
  por CSS, `aria-label`, citas de otros documentos o estados no provocados.
- Tests en el SNAP: `pnpm exec vitest run src/features/tools tests/design/contrast.test.ts` → 3 ficheros, 40/40.
- Alcance: SCOPE-2 y DEFAULTS del owner (brief; `docs/integration/crewflex-v13/08-product-decisions.md:69-70`, commit
  `038329f`, posterior al SNAP).

**Cobertura.**
- En código, los dos lados: 259/259 filas.
- En Next en ejecución: 125 filas (TOOL-01 37, TOOL-02 65, TOOL-03 18, la tarjeta ausente de TOOL-04/05/06/07 y
  TOOL-08 #4). El resto son ausencias (comprobadas con búsquedas), código no alcanzable o textos (TOOL-09).
- En la v1.8 demo en ejecución: 186 filas (TOOL-01 31, TOOL-02 65, TOOL-03 18, TOOL-04 31, TOOL-05 13, TOOL-06 9,
  TOOL-07 13, TOOL-08 6).
- En la v1.8 conectada en ejecución: 7 filas (TOOL-01 #1, #2, la fila nueva de administración y #30; TOOL-02 #49, el
  mismo motor de par; TOOL-07 #1 y #18).
- No verificadas en ejecución en v2, y por qué:
  - v1.8 demo, estados que v2 no ha vuelto a provocar; quedan con la ejecución de la xhigh, válida porque el zip es el
    mismo: TOOL-01 #1 (lado demo), #3, #9 (sin red), #22, #35; TOOL-04 #16-#19 (comprobante repetido, dos cargas, lb,
    consumo excesivo), #29, #31, #32, #39; TOOL-05 #6, #12, #13; TOOL-06 #2, #5, #12; TOOL-07 #2, #8, #11, #13, #14 y
    #18 (lado demo); TOOL-08 #7, #8;
  - no se pueden provocar sin tocar el entorno: TOOL-01 #21 (almacenamiento bloqueado), TOOL-07 #8 (medianoche) y #11
    (fallo al guardar), TOOL-08 #6 (un perfil con 1 año);
  - no alcanzables desde la interfaz: TOOL-02 #42, #44 y #46; solo tests: TOOL-02 #48 (ejecutados, 40/40);
  - v1.8 conectada: combustible, inglés y siglas y traductor no se han vuelto a recorrer ahí (es el mismo componente,
    `src/beta/Account.jsx:35` → `Toolbox`); se apoyan en las capturas del 21/10 (`C-TEC-40-*`);
  - Firefox no está disponible: TOOL-02 #28 y la fila nueva del nombre accesible, solo Chromium;
  - TOOL-04 #38: la lectura en Excel no se ha probado; sí los bytes del CSV;
  - TOOL-09: cobertura de textos por datos (`textos/string-diff-v2.json`), no en ejecución.

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| Cabecera | Base de Next y alcance | `5c2d1a2` + árbol de trabajo | SNAP `821c24f`; el logbook se remite a TEC-06 | `SNAPSHOT.txt` |
| Filas con `es:N` | Líneas del catálogo | `tools` en es:938 | `tools` en es:1002 (+64); `nav` +4, `professional.overview.review*` +32, `admin.home` +64; mismo contenido | remapeo por ruta de clave |
| TOOL-01 estado global | Alcance y X-10 | 4 tarjetas «bloqueadas por D-11 o SCOPE» | 3 portables (SCOPE-2), solo combustible D-11; nota en #587083 | este fichero |
| TOOL-01 #1 | Conectado y línea | Solo código y capturas del 21/10; `proxy.ts:46-51` | Visto en ejecución (anónimo con las 7 tarjetas); `proxy.ts:47-52`; SCOPE razonado | `evidencias/v2/40/TOOL01-1-v18c-anonimo-herramientas-1440.jpg` |
| TOOL-01 #2 | Bloqueo, línea y conectado | C-12; `AppShell.tsx:36` | — (default v1.8); `:39`; dock conectado visto | `evidencias/v2/40/v2-v18c.json` |
| TOOL-01 (nueva, administración) | Conectado y D-13 | Solo código; «árbol de trabajo» | `qa.admin`: «Administración» · «Herramientas»; `d3b876f` | `evidencias/v2/40/TOOL01-6-v18c-admin-herramientas-1440.jpg` |
| TOOL-01 #23, #24, #28 | Bloqueo y acción | SCOPE · «No portar en V1» | — (desbloqueado, LATER) · portar (L-3, L-2, L-1) | SCOPE-2 |
| TOOL-01 (nueva v2, tras #33) | Fila nueva | — (la nota era #4a857c, 3,96:1) | `=`: #587083 12 px como v1.8 (X-10 `cac7461`) | `evidencias/v2/40/v2-ui-{v18,next}.json` |
| TOOL-01 #35 | D-13 y menú | Árbol de trabajo; `AppShell.tsx:103-109`, `ViewSwitcher.tsx:16-31,56-71` | `d3b876f`; el menú conserva la última vista; `AppShell.tsx:109-115`, `ViewSwitcher.tsx:15-32,38-77` | `evidencias/v2/40/TOOL01-5-next-admin-herramientas-1440.aria.yml` |
| TOOL-01 #36 | Líneas | `DESIGN_SYSTEM.md:49-51`, `contrast.test.ts:65-71` | `:49-53`, `:108-114` | código |
| TOOL-02 (nueva xhigh, casilla) | Símbolo y severidad | `=` P3, pendiente (316×20) | `+` —: etiqueta 316×44 y NIST 166,7×44 (X-09 `5d85caa`) | `evidencias/v2/40/TOOL02-13-next-casilla-tactil-390.jpg` |
| TOOL-02 #28 | Símbolo y severidad | `≠` P3, sin triángulo | `≈` —: «▸» / «▾» con `::before` (X-07 `cfb2fe5`) | `evidencias/v2/40/TOOL02-28-next-summary-abierto-torque-1440.jpg` |
| TOOL-02 (nueva v2, tras #28) | Fila nueva | — | `≠` P3: el «▸» entra en el nombre accesible | `evidencias/v2/40/TOOL02-28-next-summary-nombre-accesible.txt` |
| TOOL-02 #48 | Tests | 36/36 | 40/40 | vitest en el SNAP |
| TOOL-02 paridad | Re-ejecución | 97 registros (mañana) | 97/97 iguales en los tres lados; una pasada `en` con 4 casos en español, explicada | `evidencias/v2/40/v2-parity-vs-xhigh.txt` |
| TOOL-02 (nueva, eco) | Línea | `engine.ts:313-334` | `engine.ts:312-333` | código |
| TOOL-04 #13 | Detalle | Sin densidad → «Densidad: introduce un valor.» | Además, sin bases sale antes «Indica la base…» | `evidencias/v2/40/v2-v18-views.json` |
| TOOL-05, TOOL-06, TOOL-07 | Bloqueo | SCOPE | — (desbloqueado, LATER); TOOL-06 #4, #8 y TOOL-07 #3, #17 con default v1.8 | SCOPE-2, DEFAULTS |
| TOOL-07 #18 | Conectado | Solo código | Visto: `crewflex-learning-guest` compartido, no pasa a la cuenta | `evidencias/v2/40/TOOL07-18-v18c-tecnico-reto-1440.jpg` |
| TOOL-08 #1-#3, #9 | Bloqueo | SCOPE | — (desbloqueado, LATER) | SCOPE-2 |
| TOOL-08 #5, #6 | Bloqueo | OD-3 | — (default v1.8; OD-3 solo bloquea producción); referencia TEC-08 | brief, SCOPE-2 |
| TOOL-08 #4 | Líneas y ejecución | `professional/page.tsx:57-80`, es:485-491 | `:58-80,173-214`, es:517-523; visto con `alpha` | `evidencias/v2/40/TOOL08-4-next-mi-espacio-1440.jpg` |
| TOOL-09 #1, #7 | Cifras | 65 / 2 / 132; 7 / 0 / 49 | 66 / 2 / 131; 9 / 0 / 47 (falsos positivos de M07/M08) | `textos/string-diff-v2.json` |
| TOOL-09 (bloqueos) | Bloqueo | SCOPE, SCOPE / OD-3, OD-3 | Desbloqueado o default v1.8; combustible sigue D-11 | SCOPE-2 |
| Recuento | Cifras | 257 · ≈ 22 · + 12 · P3 48 · — 121 | 259 · ≈ 23 · + 13 · P3 47 · — 124 | script sobre las tablas |
| Backlog | Lista | 1-5 HECHAS, 6-8 PENDIENTES; nada portable fuera de D-11 | 8 HECHAS (6 y 7 con X-07 y X-09), 7 pendientes (4 desbloqueadas, 1 defecto nuevo, 2 opcionales), 3 bloqueadas (combustible preparado) | este fichero |

## Verificación exhaustiva (xhigh, 22/10/2026)

**Método.** Cada fila se ha comprobado contra el código vivo de la v1.8 (`src/`, y el bundle `dist/` cuando había duda)
y contra la copia congelada de Next de las 11:16 (los ficheros de herramientas, `professional/page.tsx`, `layout/`,
`globals.css` y los catálogos del árbol vivo son idénticos a la copia, así que lo visto en `localhost:3000` es la copia).
En ejecución, con Chromium (Playwright): los mismos 87 casos de conversión, par, rango y duración en la v1.8 demo y en
Next (`alpha` en español; `delta` con idioma guardado `en` y `alpha` con la cookie `en`, idénticos entre sí), más las
comprobaciones de interfaz (favoritos, táctil con `hasTouch`/`isMobile` y `pointer: coarse`, `<summary>`, tamaños de
texto, títulos, roles) y todo el combustible, inglés y siglas, traductor, reto y medallas de la v1.8 demo. Las ausencias
de Next se han confirmado con búsquedas en la copia (`src`, `messages`, `supabase`). Tests: `pnpm vitest run
src/features/tools tests/design/contrast.test.ts` → 36/36. Cifras de textos recontadas desde `string-diff.json`.

**Cobertura.**
- En código, los dos lados: 257/257 filas.
- En Next en ejecución: 117 filas (TOOL-01 34, TOOL-02 64, TOOL-03 18, TOOL-08 #4). Las 140 restantes son ausencias de
  Next (comprobadas con búsquedas), filas de código no alcanzable desde la interfaz o textos (TOOL-09).
- En la v1.8 en ejecución (modo demo): 201 filas (TOOL-01 33, TOOL-02 64, TOOL-03 18, TOOL-04 38, TOOL-05 16,
  TOOL-06 11, TOOL-07 15, TOOL-08 6).
- Paridad numérica: 22/22 magnitudes, 98/98 unidades, 192/192 valores mostrados iguales en `es` (resultado y «Otras
  equivalencias», con 2, 6 y 10 decimales); 16 casos de par y rango, 22 de duración y 16 de errores de entrada
  (`evidencias/xhigh/40/TOOL02-paridad-runtime-comparacion.md`).
- No verificadas en ejecución, y por qué:
  - modo conectado de la v1.8 (no está levantado): TOOL-01 #1 y la fila nueva de administración (lado v1.8), TOOL-07 #18;
    quedan verificadas en código y con las capturas del 21/10;
  - no alcanzables desde la interfaz: TOOL-02 #42 (los selects solo ofrecen unidades de la magnitud), #44 (con
    |x| ≤ 1e15 el resultado es siempre finito), #46 (código muerto que ni llega al bundle);
  - necesitan condiciones que no se pueden provocar sin tocar el entorno: TOOL-01 #21 (almacenamiento bloqueado),
    TOOL-07 #8 (cambio de día a medianoche) y #11 (fallo al guardar), TOOL-08 #6 (un perfil con 1 año de experiencia);
  - solo código: TOOL-01 #22 (lado v1.8), TOOL-02 #48 (tests, ejecutados), TOOL-04 #39, TOOL-06 #12 (no se ha trazado
    la red), TOOL-07 #13 (se ve un reto de 5, no el banco de 158), TOOL-08 #7 y #8;
  - TOOL-04 #38: la afirmación «Excel en español lo lee como texto» no se ha probado en Excel; sí los bytes del CSV;
  - TOOL-02 #28 y la fila nueva tras la 13: solo Chromium; Firefox no está disponible aquí;
  - TOOL-09: cobertura de textos por datos (`string-diff.json`), no en ejecución.

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| TOOL-01 estado global | Redacción | Favoritos «iguales, letra por letra» | Textos y comportamiento iguales; chips con icono de 26 px (v1.8 17) y estrella mayor | `evidencias/xhigh/40/TOOL01-17-*-chips-1440.jpg` |
| TOOL-01 #4 | Línea y dato en ejecución | `torque/page.tsx:5-8` | `torque/page.tsx:6-9`; títulos medidos (v1.8 siempre «CrewFlex V1.8 — Aviation») | `evidencias/xhigh/40/runtime-ui-next.json`, `runtime-ui-v18.json` |
| TOOL-01 #15 | Punto de corte de la v1.8 | «oculto a ≤520 px» | Oculto a ≤600 px (reglas a 520 y 600); acción «a partir de 601 px» | `dist/assets/index-CaNXyzVh.css`; `runtime-ui-v18.json` (521 px → `none`, 768 → `flex`) |
| TOOL-01 #17 | Símbolo y severidad | `=` · — | `≈` · P3 (icono 26 px frente a 17); backlog 8 | `evidencias/xhigh/40/TOOL01-17-v18-chips-1440.jpg`, `TOOL01-17-next-chips-1440.jpg` |
| TOOL-01 #31 | Símbolo y medidas | `=`, sin medida de v1.8 | `≈`: v1.8 32×38 px (32×39 táctil); Next 40×40, 44×44 táctil | `evidencias/xhigh/40/TOOL01-4-v18-tactil-390.jpg`, `TOOL01-4-next-tactil-390.jpg` |
| TOOL-01 #35 | Líneas | `AppShell.tsx:95-100`, `ViewSwitcher.tsx:20,35-41` | `AppShell.tsx:103-109`, `ViewSwitcher.tsx:16-31,56-71` | código; `TOOL01-5-next-admin-herramientas-1440.aria.yml` |
| TOOL-02 #15 | Literal | «3/16» pasa a «4.7625» | Pasa a «4.762499999999999» en los dos; en Next `es` sale además «Se lee como 4,7625» | `evidencias/xhigh/40/TOOL02-15-v18-invertir-1440.jpg`, `TOOL02-15-next-invertir-1440.jpg` |
| TOOL-02 #20 | Idioma por defecto | «por defecto `en`» | Preferencia → cookie → `Accept-Language` → `en` | `src/i18n/resolve.ts:1-5` |
| TOOL-02 #24 | Detalle | Tolerancia vacía y > 100 | Añade «abc» y «1.000,5» (v1.8 «Valor: no uses separadores de miles.») | casos R03 y R12 |
| TOOL-02 #28 | Estado de la comprobación | «Lectura de código, no comprobado en navegador»; «en Chromium y Firefox» | Confirmado en Chromium (`display: flex`, sin marcador), también en `professional/page.tsx:236`; Firefox sin probar | `evidencias/xhigh/40/TOOL02-28-*` |
| TOOL-02 (nueva xhigh, tras #13) | Fila nueva | — | `=` · P3: casilla de rango de 20 px en táctil (v1.8 19) frente a `DESIGN_SYSTEM.md:32-34`; backlog 7 | `evidencias/xhigh/40/TOOL02-13-next-casilla-tactil-390.jpg` |
| TOOL-02 #46 | Detalle | Código muerto | Además, no llega al bundle | `grep` en `dist/assets/index-dtxkpGY0.js` |
| TOOL-02 estado global, ejemplos y #8-#66 | Evidencia | Paridad por tests y lectura de código | Paridad en ejecución, 192/192 valores, `es` y `en` | `evidencias/xhigh/40/TOOL02-paridad-runtime-comparacion.md` |
| TOOL-04 #5 | Literal | Aviso con «los campos vacíos» en Masa ↔ volumen y Planificar | Vacíos en Masa ↔ volumen; en Planificar, con los valores del ejemplo | `evidencias/xhigh/40/TOOL04-5-v18-aviso-ejemplo-masa-volumen-1440.jpg`, `runtime-extra.json` |
| TOOL-05 #12 | Línea | `knowledge.js:20,108` | `knowledge.js:20,95,108` (FO está en la 95) | código |
| TOOL-08 #7 | Ruta | `Marketplace.jsx:3` | `src/components/v11/Marketplace.jsx:3` | código |
| TOOL-09 (entradilla) | Lista de falsos positivos | 8 palabras, como lista cerrada | Lista ampliada («Par de apriete», «Estado», «Base»…), cobertura real 0 sin cambios | `string-diff.json` recontado |
| Recuento | «la opción por defecto de Next» | Inglés como defecto | Inglés con preferencia o cookie `en`, o, sin ellas, si el navegador no pide español; más «192/192 valores en ejecución» | `src/i18n/resolve.ts:1-5` |
| Backlog | Estados y tareas | 1-5 HECHAS, 6 PENDIENTE | 1-5 HECHAS (también en ejecución), 6 PENDIENTE confirmada, 7 y 8 PENDIENTES nuevas | este fichero |

## Cambios desde el 21/10/2026

| Fila | Elemento | Antes | Ahora | Origen (commit o «árbol de trabajo») |
|---|---|---|---|---|
| TOOL-01 (nueva, tras #2) | Acceso desde la vista de administración | — (no comparado) | `+`: panel «Herramientas» / «Abrir herramientas» en `/app/admin` | árbol de trabajo (D-13) |
| TOOL-01 #31 | Estrella de favorito | `=`, 40 px | `=`, 40 px y 44 px con puntero táctil | `7255055` (W3-04) |
| TOOL-01 #35 | «Probar como» oculto en herramientas | `✗` (solo demo) | `≠` P3: el «Ver como» de D-13 sigue en la barra lateral en `/app/tools`, sin vista marcada | árbol de trabajo (D-13) |
| TOOL-01 #36 | Tamaño mínimo de texto | `=` P3 (10-11 px como v1.8, choca con DESIGN_SYSTEM) | `≠` P3, Mantener: 12 px en todo el banco, pie #587083 | `9483667` (W3-09), `ac28483` (W3-03) |
| TOOL-02 (nueva, tras #7) | Eco «Se lee como {n}» | — (no existía) | `+` | `14dfaf0` (W1-06) |
| TOOL-02 #24 | Error de rango y de tolerancia | `✗` P2, mismo fallo que v1.8 | `≠` P3, Mantener: corregido | `7bae7a2` (W1-05) |
| TOOL-02 #28 | `<details>` «Fórmula, fuentes y alcance» | `=` | `≠` P3: el `summary` con `flex` pierde el triángulo de desplegable (regresión visual) | `7255055` (W3-04) |
| TOOL-02 #37 | Decimales (coma o punto) | `=` P2, acción «añadir eco» | `=` sin acción (eco hecho) | `14dfaf0` (W1-06) |
| TOOL-02 #45 | `convertRange` | `=` | `≈` P3: misma regla, mensajes propios de la tolerancia | `7bae7a2` (W1-05) |
| TOOL-02 #48 | Pruebas | `≈`, acción «añadir paridad» | `≈`, paridad añadida y ejecutada (36/36) | `4fdc186` (W3-10) |
| TOOL-03 #7 | Placeholder | `+` P3, literales sin traducir | `+`, desde el catálogo («1.5» en `en`) | `69210ac` (W3-08) |
| TOOL-03 (nueva, tras #7) | Eco en horas decimales | — (no existía) | `+` | `14dfaf0` (W1-06) |
| TOOL-09 #1 | `Toolbox.jsx` / `tools.*` | 117 claves | 122 claves (5 nuevas sin origen v1.8) | `7bae7a2`, `14dfaf0`, `69210ac` |
| TOOL-09 #6 | `DailyLearning.jsx` | Bruto 3 / 0 / 39 | Bruto 4 / 0 / 38 (falso positivo «Completar»); real 0 % | string-diff del 22/10 |

Además: referencias `archivo:línea` puestas al día en todas las filas que citan `messages/es.json` (el bloque `tools`
pasa de es:879 a es:938), los componentes de `src/features/tools`, `engine.ts`, sus tests, `AppShell.tsx`,
`professional/page.tsx`, `DESIGN_SYSTEM.md`, `V1_SCOPE.md` y `09-v18-delta.md`; los estados globales de TOOL-01/02/03,
el párrafo de ejemplos runtime de TOOL-02, el recuento y el backlog. Combustible, inglés y siglas, traductor, reto y
medallas: nada nuevo en Next (búsqueda en `src` y `messages`), siguen `−`/`✗`.

Recuento: 253 → 256 filas (3 nuevas); `=` 83 → 80, `≈` 19 → 20, `≠` 7 → 11, `−` 104 → 104, `+` 9 → 12, `✗` 31 → 29.

**Método.**
- Factores comparados en el código: script de parseo de texto (no ejecuta código de v1.8) sobre `src/tools/engine.js:6-30`
  y `src/features/tools/engine.ts:27-175`.
  - Resultado: **22/22 magnitudes, 98/98 unidades, mismo orden, mismos factores y offsets literales (igualdad bit a bit
    como `double`)**.
  - Solo cambian 4 símbolos internos (`t`, `mi`, `hp`, `CV / PS`). En pantalla, `tools.unit.*` les devuelve el texto de
    v1.8 (es:1119-1124).
- Etiquetas y descripciones de las 22 magnitudes: comparadas una a una contra `messages/es.json:1040-1118`. Son 22/22
  etiquetas y 11/11 descripciones idénticas.
- Textos: diff de cadenas con el esquema de `textos/string-diff.json`, re-ejecutado el 22/10 sobre el catálogo actual
  (2101 cadenas v1.8, 214 exactas + 31 parecidas = 11,7 %; el 21/10, 199 + 28 = 10,8 %; claves de Next 856, antes 802), más una comprobación manual de las cadenas del alcance D-11 (el
  extractor omite, entre otras, la nota de privacidad, «Usa HH:MM…» y los textos de `References`; ver TOOL-09).
- Paridad numérica: desde W3-10 la fijan los tests (`src/features/tools/engine.test.ts:212-235`); ejecutados el 22/10 en
  lectura (`pnpm vitest run src/features/tools tests/design/contrast.test.ts`: 36/36).
- Las afirmaciones de `docs/integration/crewflex-v13/16-html-v18-diff.md` (W-tasks «VERIFIED») se han comprobado una a
  una en el código, no se han copiado.
- Decisiones aplicadas:
  - D-11 (`docs/integration/crewflex-v13/08-product-decisions.md:43`): «In scope now: unit conversion, torque conversion,
    durations… Fuel waits for a specific technical review. Nothing else added».
  - `docs/product/V1_SCOPE.md:60` (LATER: fuel sheet, glossary/ATA, daily challenge, translator).
  - Filas de la matriz maestra: M15/M16, TD-78…TD-87, NEW-01 (`10-master-matrix.md:249-259, 331, 341-346`).
  - Delta V18-39…42 (`09-v18-delta.md:97-100`).

Rutas de capturas v1.8 relativas a la raíz del informe (`evidencias/…`); las de datos `raw/…` cuelgan de `evidencias/`
(corregido el 22/10: la versión anterior dejaba la ruta base vacía). Las de Next `docs/audit/evidence/v18-compare/*` son del **lote 11**,
anteriores a los lotes 13-19 y en inglés.

---

## TOOL-01 · Inicio de la caja de herramientas — v1.8 `S-COM-01, S-CON-14, S-TOOL-01, D-TOOL-00, D-CON-08, C-TEC-09` ↔ Next `N-TOOL-01`

**Estado global:** IGUAL salvo el combustible (F3: antes PARCIAL). F3 (27/10): 6 de las 7 tarjetas, en el orden de v1.8,
con el reto, el traductor e inglés y siglas portados en `558654f`; el arte del hero desde 601 px y los chips de 17 px
(T-1, T-2); la nota de privacidad vuelve a nombrar el progreso de los retos; el dock móvil (T-141) y el `/tools` público
(T-145) llegaron con shell-visual. Siguen: Combustible (D-11) y «Sin conexión» (NEW-01). Verificado en `PKG P08 0b/1/6/7/9`.
Texto de la v2: cabecera, hero, favoritos y las 3 tarjetas del alcance D-11 tienen los mismos textos,
letra por letra, y el mismo comportamiento (comprobado otra vez en ejecución en v2: v1.8 demo, v1.8 conectada y Next).
Faltan 4 de las 7 tarjetas: con el alcance nuevo (SCOPE-2) Reto diario, Traductor e Inglés y siglas son portables y solo
Combustible sigue bloqueado (D-11). Falta también el indicador «Sin conexión» (NEW-01). La nota de privacidad está
adaptada y, desde X-10 (`cac7461`), con el color de v1.8 (#587083). El texto del banco no baja de 12 px (v1.8 usa
10-11 px) y la estrella mide 44 px en táctil (v1.8: 32×38); los chips de favoritos llevan iconos de 26 px (v1.8: 17).
Con D-13 (`d3b876f`) la vista «Administración» enlaza las herramientas.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Acceso y roles | Demo: técnico, empresa y recruiter. Conectado: también admin y **anónimo**; la rama `tools` va antes del control de sesión (`src/beta/Account.jsx:35`). Login conectado: «Las herramientas se pueden utilizar sin abrir una cuenta.» (`src/beta/Account.jsx:36`; `evidencias/shots/demo/D-CON-08-herramientas-1440.png`). **v2, conectado en ejecución:** sin sesión el lateral es «Acceder a mi cuenta» · «Herramientas», el login muestra esa frase y `#tools` abre el banco con las 7 tarjetas y el mismo motor (100 N·m → 73,756215 lbf·ft) (`evidencias/v2/40/TOOL01-1-v18c-anonimo-login-1440.jpg`, `evidencias/v2/40/TOOL01-1-v18c-anonimo-herramientas-1440.jpg`) | Requiere sesión: `/app/*` redirige a `/login` (`src/proxy.ts:47-52`; en ejecución v2, `/app/tools` sin sesión → `/login?next=%2Fapp%2Ftools`, `evidencias/v2/40/v2-ui-next.json`). Todas las cuentas con sesión (`src/app/app/tools/page.tsx:11-12`) **F3 (27/10):** `/tools` público (T-145, `44045db`): la cáscara anónima de la v1.8 conectada («Acceder a mi cuenta» · «Herramientas», `src/app/tools/layout.tsx`), con 5 herramientas (traductor, par, conversiones, inglés y siglas, duración; sin reto, que necesita cuenta para el progreso), misma CSP y sin leer sesión ni datos; el login dice «Las herramientas se pueden utilizar sin abrir una cuenta.» (es:2521-2525). `/app/tools` sigue tras sesión y `/tools/daily` es 404 (`PKG shell-visual 12`, `PKG P08 7`, `PKG P08 9`: cualquier cuenta con sesión usa el banco) | ≈ (F3: antes ≠) | P3 | — | Mantener (T-145): el reto diario queda tras sesión porque su progreso va por usuario |
| 2 | Entrada de navegación | Lateral «Herramientas» (técnico `src/LegacyApp.jsx:24`; empresa y recruiter `:43`), dock móvil «Inicio · Ofertas · Calendario · Candidaturas · Herramientas» (`:69`), hash `#tools` (`evidencias/xhigh/40/TOOL01-1-v18-390.txt`). Conectado en ejecución v2 (`qa.tecnico1`): lateral «Mi espacio … Avisos · Herramientas · Mi cuenta» y dock «Inicio · Ofertas · Calendario · Candidaturas · Herramientas» | Entrada «Herramientas» del grupo Cuenta (`src/components/layout/AppShell.tsx:39`, es:71); sin dock: en ejecución v2 a 390 px solo están las secciones del menú (`evidencias/v2/40/TOOL01-1-next-390.txt`) **F3:** dock móvil bajo `lg` «Inicio · Ofertas · Calendario · Candidaturas · Herramientas» (T-141, `44045db`; `PKG shell-visual 7`) | = (F3: antes ≈) | — | — (v2: default v1.8; antes C-12) | — |
| (nueva) | Acceso desde la vista de administración | Admin conectado: lateral «Administración» + «Herramientas» (`src/beta/ConnectedShell.jsx:8`); sin tarjeta de herramientas en su vista. **v2, conectado en ejecución** (`qa.admin`): lateral «Administración» · «Herramientas»; `#tools` abre el banco (`evidencias/v2/40/TOOL01-6-v18c-admin-herramientas-1440.jpg`) | Además de la entrada del grupo Cuenta, la vista «Administración» del selector «Ver como» (D-13, `d3b876f`) tiene un panel «Herramientas» con «Abrir herramientas» → `/app/tools` (`src/app/app/admin/page.tsx:37-39`, es:966-967). En ejecución v2 con `platform.admin`: aterriza en `/app/admin` y el enlace apunta a `/app/tools` (`evidencias/v2/40/TOOL01-6-next-admin-panel-1440.jpg`) | + | P3 | — | Mantener |
| 3 | URL por herramienta | Una sola URL `#tools`; la herramienta activa no se guarda y al recargar vuelve al inicio (`src/tools/Toolbox.jsx:67`; D-TOOL-00 «La URL sigue siendo `#tools`»; en ejecución la URL no cambia al abrir ninguna de las 7) | Rutas `/app/tools`, `/app/tools/torque`, `/app/tools/convert`, `/app/tools/duration` (`src/app/app/tools/**/page.tsx`); enlazables, y al recargar se queda en la herramienta; en ejecución v2 los drivers abren cada ruta directamente | + | P3 | — | Mantener |
| 4 | Título del documento | Sin título por herramienta: «CrewFlex V1.8 — Aviation» en las 7 (en ejecución) | `generateMetadata` por página: `meta.tools` y `tile.*.title` (`src/app/app/tools/page.tsx:6-9`, `torque/page.tsx:6-9`); en ejecución (también v2) «Herramientas · Crew Flex», «Par de apriete · Crew Flex», «Conversiones · Crew Flex», «Duración · Crew Flex» | + | P3 | — | Mantener |
| 5 | Kicker de cabecera | «TU CAJA DE HERRAMIENTAS» (`Toolbox.jsx:70`) | «TU CAJA DE HERRAMIENTAS» (`src/features/tools/components/ToolsHeader.tsx:10`, es:1004) | = | — | — | — |
| 6 | h1 del inicio | «Para cada jornada.» (`Toolbox.jsx:70`) | «Para cada jornada.» (`src/app/app/tools/page.tsx:17`, es:1005) | = | — | — | — |
| 7 | h1 dentro de cada herramienta | Etiqueta de la tarjeta activa (`Toolbox.jsx:70`) | `tile.{id}.title` (`torque/page.tsx:15`, `convert/page.tsx:15`, `duration/page.tsx:15`) | = | — | — | — |
| 8 | Entradilla | «Cálculos claros. Unidades visibles. Referencias a mano.» (`Toolbox.jsx:70`) | Idéntica (`ToolsHeader.tsx:14`, es:1006) | = | — | — | — |
| 9 | Indicador «Sin conexión» | Si `!navigator.onLine`: chip WifiOff «Sin conexión», actualizado con los eventos `online`/`offline` (`Toolbox.jsx:68,70`). En ejecución, con el contexto sin red aparece y al volver la red desaparece (`evidencias/xhigh/40/TOOL01-3-v18-sin-conexion-1440.jpg`) | No existe: ni `navigator.onLine` ni service worker en `src` (búsqueda en la copia). No portado a propósito: sin service worker el indicador engañaría (`10-master-matrix.md:256,297`) | − | P3 | NEW-01 (v2: sin cambio; AB-37 DEFERRED en `15-autonomous-migration-backlog.md:57`) | No portar hasta que exista el service worker (backlog N-1) |
| 10 | Botón «Todas las herramientas» | Fuera del inicio, botón → `setActive('home')` (`Toolbox.jsx:70`) | `Link` a `/app/tools` cuando `back` (`ToolsHeader.tsx:16-23`, es:1007) | = | — | — | — |
| 11 | Kicker del hero | «CREWFLEX · WORKBENCH» (`Toolbox.jsx:71`) | Idéntico (`src/features/tools/components/ToolsHome.tsx:72`, es:1009) | = | — | — | — |
| 12 | h2 del hero | «Tu oficio, un poco» `<br/>` «más sencillo.» (salto forzado; en ejecución `innerHTML` «Tu oficio, un poco<br>más sencillo.») | «Tu oficio, un poco más sencillo.», sin salto forzado (`ToolsHome.tsx:73-75`, es:1010; en ejecución igual) | ≈ | P3 | — | Mantener |
| 13 | Texto del hero | «Las utilidades que necesitas, estés buscando trabajo o estés donde quieres estar.» | Idéntico (es:1011) | = | — | — | — |
| 14 | CTA del hero | «Abrir conversor de par» › → `setActive('torque')` (`Toolbox.jsx:71`) | Idéntico, `Link` → `/app/tools/torque` (`ToolsHome.tsx:77-82`, es:1012) | = | — | — | — |
| 15 | Arte del hero | `aria-hidden`: «N·m», ArrowLeftRight, «lbf·in», «Precisión en cada unidad.»; oculto a **≤600 px**: hay dos reglas, `@media (max-width:520px)` y `@media (max-width:600px)` (`.tb-hero-art{display:none}` en `dist/assets/index-CaNXyzVh.css`). En ejecución: `none` a 390, 520 y 521 px; `flex` a 768 y 1024 px | Mismo contenido, `aria-hidden`, pero oculto por debajo de `lg` (1024 px) (`ToolsHome.tsx:84-94`, es:1013). En ejecución v2: `none` a 390, 600, 601, 768 y 1023 px; `flex` a 1024 px (v1.8 en ejecución v2: `none` hasta 600 px, `flex` desde 601; `evidencias/v2/40/v2-ui-{v18,next}.json`) **F3:** el arte se muestra a partir de 601 px (`min-[601px]:flex`, `ToolsHome.tsx:104-116`; T-1 en `558654f`) | = (F3: antes ≈) | — | — | — (T-1 hecho) |
| 16 | Bloque «Tus favoritos» | Solo si hay alguno: h2 con estrella «Tus favoritos» (`Toolbox.jsx:72`) | Igual (`ToolsHome.tsx:97-101`, es:1015) | = | — | — | — |
| 17 | Chips de favoritos | Un botón por favorito en el orden de `tiles`, con icono de 17 px y nombre; abre la herramienta. En ejecución: iconos 17×17, botones de 42 px (`evidencias/xhigh/40/TOOL01-17-v18-chips-1440.jpg`) | `Link` en el orden de `TOOL_IDS`, con el mismo icono de 26 px que la tarjeta (`ICONS`, `ToolsHome.tsx:17-21,102-113`) y nombre. En ejecución: iconos 26×26, enlaces de 40 px (44 en táctil) (`evidencias/xhigh/40/TOOL01-17-next-chips-1440.jpg`) **F3:** iconos de 17 px en los chips (`ICONS[id](17)`, `ToolsHome.tsx:125-145`); medido 17×17 en `PKG P08 1` | = (F3: antes ≈) | — | — | — (T-2 hecho) |
| 18 | Clave de almacenamiento | `localStorage['crewflex-tool-favorites']`, array JSON (`Toolbox.jsx:67,69`) | Misma clave (`ToolsHome.tsx:14`); en ejecución los dos escriben ahí | = | — | — | — |
| 19 | Ids guardados | `daily`, `translator`, `torque`, `fuel`, `convert`, `knowledge`, **`time`** (en ejecución, estrella de Par y Duración → `["torque","time"]`) | `daily`, `translator`, `torque`, `convert`, `knowledge`, **`duration`** (`src/features/tools/ids.ts`; en ejecución, estrella de Par → `["torque"]`, `PKG P08 1`). Sin `fuel` (D-11); un `"time"` se descarta al leer | ≠ | P3 | — | Ninguna: orígenes distintos, no hay datos que migrar (`time` → `duration`; `fuel` llegará con D-11) |
| 20 | Lectura tolerante | `JSON.parse(…\|\|'[]')`, filtra ids desconocidos y devuelve `[]` si hay excepción (`Toolbox.jsx:67`). En ejecución: `["time","nope","torque"]` → Par y Duración; JSON roto → sin bloque de favoritos | `parseFavorites`: igual, en el orden del catálogo (`ToolsHome.tsx:40-47`); test en `src/features/tools/messages.test.ts:50-55`. En ejecución: `["time","nope","duration","torque"]` → Par y Duración; JSON roto → sin bloque | = | — | — | — |
| 21 | Escritura | `try/catch` silencioso en cada `toggle` (`Toolbox.jsx:69`) | Igual (`ToolsHome.tsx:54-62`) | = | — | — | — |
| 22 | Sincronización e hidratación | Estado local del componente | `useSyncExternalStore` con los eventos `storage` y `crewflex-tool-favorites-change`: sincroniza pestañas. En SSR no hay favoritos hasta hidratar (`ToolsHome.tsx:31-38,51-52`). En ejecución, marcar «Conversiones» en una segunda pestaña lo añade en la primera sin recargar, y los favoritos sobreviven a la recarga (`evidencias/xhigh/40/runtime-ui-next.json`) | + | P3 | — | Mantener |
| 23 | Tarjeta «Reto diario» | «Reto diario» · «5 o 10 preguntas · rachas» · GraduationCap (`Toolbox.jsx:65`) | «Reto diario» · «5 o 10 preguntas · rachas» · GraduationCap, primera tarjeta (`ToolsHome.tsx:147-184`, es:1623-1626; `558654f`). En ejecución, `PKG P08 0b` y 28a | = (F3: antes −) | — | — | — (L-3 hecho) |
| 24 | Tarjeta «Traductor» | «Traductor» · «Español · inglés · francés» · BookOpen | «Traductor» · «Español · inglés · francés» · BookOpen, segunda tarjeta (es:1627-1630; `558654f`). En ejecución, `PKG P08 0b` | = (F3: antes −) | — | — | — (L-2 hecho) |
| 25 | Tarjeta «Par de apriete» | «Par de apriete» · «N·m · lbf·ft · lbf·in» · Wrench | Idéntica (es:1021-1024, `ToolsHome.tsx:18`) | = | — | — | — |
| 26 | Tarjeta «Combustible» | «Combustible» · «Planifica y concilia» · Fuel | No existe (F3: sin cambio; `main a[href*='fuel']` = 0 en `PKG P08 0b`) | − | P1 | D-11 | Esperar la revisión técnica de D-11 (TD-82/83); tarea preparada (backlog F-1) |
| 27 | Tarjeta «Conversiones» | «Conversiones» · «22 magnitudes técnicas» · ArrowLeftRight | Idéntica (es:1025-1028, `ToolsHome.tsx:19`) | = | — | — | — |
| 28 | Tarjeta «Inglés y siglas» | «Inglés y siglas» · «Diccionario · ATA · práctica» · BookOpen | «Inglés y siglas» · «Diccionario · ATA · práctica» · BookOpen, quinta tarjeta (es:1639-1642; `558654f`). En ejecución, `PKG P08 0b` | = (F3: antes −) | — | — | — (L-1 hecho) |
| 29 | Tarjeta «Duración» | «Duración» · «HH:MM y horas decimales» · Clock | Idéntica (es:1029-1032, `ToolsHome.tsx:20`) | = | — | — | — |
| 30 | Orden de las tarjetas | Reto, Traductor, **Par**, Combustible, Conversiones, Inglés, Duración | Reto, Traductor, Par, Conversiones, Inglés, Duración (`TOOL_IDS`, `src/features/tools/ids.ts`): el orden de v1.8 sin Combustible (D-11). En ejecución, `PKG P08 0b` y 28a | = (F3: antes ≈) | — | — | — (L-4 hecho); la tarjeta de combustible entrará en su sitio con D-11 |
| 31 | Estrella de favorito | `aria-label` «Añadir favorito {título}» / «Quitar favorito {título}», `aria-pressed`, relleno si es favorito (`Toolbox.jsx:73`). En ejecución: al pulsar pasa a «Quitar favorito Par de apriete», `aria-pressed="true"`, `fill="currentColor"`, y persiste al recargar. Área 32×38 px (`.tb-favorite{padding:7px}`), 32×39 en un contexto táctil de 390 px con `pointer: coarse` (`evidencias/xhigh/40/TOOL01-4-v18-tactil-390.jpg`) | Igual etiqueta, estado y persistencia (en ejecución, también con `tap`). Área 40×40 px; 44×44 con puntero táctil (`pointer-coarse:size-11`, W3-04; medido con `hasTouch`/`isMobile`, `matchMedia('(pointer: coarse)')` verdadero) (`ToolsHome.tsx:126-138`, es:1016-1017; `evidencias/xhigh/40/TOOL01-4-next-tactil-390.jpg`, `evidencias/xhigh/40/TOOL01-2-next-favoritos-1440.jpg`). En ejecución v2, igual: 40×40 y 44×44 táctil (v1.8: 32×38,4 en los dos) | ≈ (xhigh: antes =) | — | — | Mantener (área mayor que v1.8) |
| 32 | «Abrir herramienta» | Botón `tb-open` con ChevronRight | `Link` con «Abrir herramienta» y `sr-only` «: {título}» (`ToolsHome.tsx:146-152`, es:1018) | = | — | — | — (Next añade nombre accesible) |
| 33 | Nota de privacidad | «Tu uso de herramientas es privado. Los cálculos de combustible se descartan al salir; se guardan tus favoritos y el progreso de los retos en este navegador.» (`Toolbox.jsx:73`) | «Tu uso de herramientas es privado: los cálculos se hacen en tu navegador y no se envían a ningún servidor. Tus favoritos y el progreso de los retos se guardan en este navegador.» (`ToolsHome.tsx:186-190`, es:1621; `558654f`). Menciona favoritos y progreso de los retos como v1.8; omite la frase del combustible (D-11). En ejecución, `PKG P08 0b` | ≈ (F3: antes ≠) | P3 | — | Mantener; añadir la frase del combustible con D-11 (F-1) |
| (nueva v2) | Color y tamaño de la nota de privacidad | `.toolbox p`: 12 px, #587083 (en ejecución v2: `rgb(88, 112, 131)`, 12px) | Texto en `text-[#587083]`, 12 px; el icono sigue en #4a857c (`ToolsHome.tsx:158-161`, X-10 `cac7461`; test `tests/design/contrast.test.ts:56-64`). En ejecución v2: `rgb(88, 112, 131)`, 12px. Antes de X-10 heredaba el #4a857c de la fila: 3,96:1 sobre el lienzo | = | — | — | — (X-10) |
| 34 | Banda del shell demo | «**Herramientas de trabajo** · Conversores, combustible e inglés en tu espacio CrewFlex.» + «Ver alcance ↗» (D-TOOL-00) | — | ✗ | — | — | No portar (solo demo) |
| 35 | «Probar como» oculto en `tools`/`learning` | `src/LegacyApp.jsx:84`; en ejecución no aparece en `#tools` ni dentro de ninguna de las 7 herramientas | Selector «Ver como» de D-13 (`d3b876f`), solo para administradores de plataforma y en la barra lateral: sigue visible en `/app/tools`, sin marcar ninguna vista porque herramientas es ruta compartida; el menú conserva la última vista elegida (`src/components/layout/AppShell.tsx:109-115`, `src/components/layout/views.ts:19-24`, `src/components/layout/ViewSwitcher.tsx:15-32,38-77`, es:73). En ejecución v2 con `platform.admin`, de «Empresa» a «Herramientas»: «Ver como» Técnico/Empresa/Recruiter/Administración sin `aria-current`, secciones «CrewFlex Operaciones» y «Cuenta», y `aria-current` en «Herramientas»; con `alpha`, no aparece (`evidencias/v2/40/TOOL01-5-next-admin-herramientas-1440.aria.yml`) **F3:** sin cambio | ≠ (antes ✗) | P3 | — | Mantener (D-13): las herramientas no dependen de la vista |
| 36 | Tamaño mínimo de texto | Kicker 10 px, pie 11 px #718492 (`.tb-kicker{font-size:10px}`, `.tb-footnote{font-size:11px}`); en ejecución `getComputedStyle`: 10px y 11px `rgb(113, 132, 146)` | 12 px (`text-xs`) en todo el banco: `ToolsHeader.tsx:10`, `parts.tsx:56,125,148,189` (pie #587083, 5,2:1), `ToolsHome.tsx:72,93`. Cumple «never below 12px», sin excepción en el banco (`docs/product/DESIGN_SYSTEM.md:49-53`, NX-05, X-20); lo vigila `tests/design/contrast.test.ts:37-45,108-114`. En ejecución v2: ningún texto visible de `main` por debajo de 12 px en las 4 rutas, con «Fórmula, fuentes y alcance» abierto (v1.8 en ejecución v2: kickers de 10 px; ayudas, leyenda y pie de 11 px) | ≠ (antes =) | P3 | — | Mantener (W3-03 `ac28483`, W3-09 `9483667`) |

Capturas: v1.8 `evidencias/shots/demo/D-TOOL-00-herramientas-1440.png`, `evidencias/shots/demo/D-TOOL-00-herramientas-390.png`,
`evidencias/shots/demo/D-TOOL-00b-favorito-1440.png`, `evidencias/shots/demo/D-CON-08-herramientas-1440.png`,
`evidencias/shots/connected/C-TEC-09-tools-1440.png`. Next (lote 11, EN) `docs/audit/evidence/v18-compare/next-after/tools-1440.jpg`,
`docs/audit/evidence/v18-compare/next-after/tools-390.jpg`; referencia v1.8 del mismo lote
`docs/audit/evidence/v18-compare/v18/tools-1440.jpg`. Ejecución xhigh (22/10, español): `evidencias/xhigh/40/TOOL01-1-v18-1440.jpg`,
`evidencias/xhigh/40/TOOL01-1-next-1440.jpg`, `evidencias/xhigh/40/TOOL01-1-v18-390.jpg`, `evidencias/xhigh/40/TOOL01-1-next-390.jpg`,
`evidencias/xhigh/40/TOOL01-2-v18-favoritos-1440.jpg`, `evidencias/xhigh/40/TOOL01-2-next-favoritos-1440.jpg`,
`evidencias/xhigh/40/TOOL01-4-v18-tactil-390.jpg`, `evidencias/xhigh/40/TOOL01-4-next-tactil-390.jpg`; datos
`evidencias/xhigh/40/runtime-ui-v18.json`, `evidencias/xhigh/40/runtime-ui-next.json`. Ejecución v2 (22/10, tras el
bucle): `evidencias/v2/40/TOOL01-1-{v18,next}-1440.jpg`, `evidencias/v2/40/TOOL01-1-{v18,next}-390.jpg`,
`evidencias/v2/40/TOOL01-2-{v18,next}-favoritos-1440.jpg`, `evidencias/v2/40/TOOL01-5-next-admin-herramientas-1440.jpg`,
`evidencias/v2/40/TOOL01-6-next-admin-panel-1440.jpg`; conectado `evidencias/v2/40/TOOL01-1-v18c-anonimo-login-1440.jpg`,
`evidencias/v2/40/TOOL01-1-v18c-anonimo-herramientas-1440.jpg`, `evidencias/v2/40/TOOL01-1-v18c-tecnico-herramientas-1440.jpg`,
`evidencias/v2/40/TOOL01-6-v18c-admin-herramientas-1440.jpg`; datos `evidencias/v2/40/v2-ui-{v18,next}.json`,
`evidencias/v2/40/v2-v18c.json`, `evidencias/v2/40/v2-next-extra.json`.

---

## TOOL-02 · Conversor de unidades y par de apriete — v1.8 `S-TOOL-04, S-TOOL-06, S-MOD-TOOL-01, D-TOOL-01, D-TOOL-02, C-TEC-40` ↔ Next `N-TOOL-02, N-TOOL-03`

**Estado global:** IGUAL. F3 (27/10): sin cambios en el motor ni en los controles; el defecto T-3 del nombre accesible
quedó corregido en `88d9a6d` (fila nueva v2, ahora `=`). Mismo motor 1.0.0, mismos 98 factores, misma normalización de
entrada y mismos controles y textos. Next añade el aviso de par que exige D-11 y una coletilla en el texto copiado. Diferencias:
- los mensajes de error no llevan el prefijo «Valor:»;
- el formato numérico sigue el idioma de la interfaz (inglés si no hay preferencia ni cookie y el navegador no pide
  español); desde el 21/10 un eco «Se lee como {n}» bajo el valor muestra cómo se ha leído una fracción o una marca
  decimal ajena al idioma (W1-06);
- ya no arrastra los dos hallazgos de v1.8: el panel de rango espera a que haya valor y los errores de la tolerancia
  nombran el campo (W1-05);
- el resumen «Fórmula, fuentes y alcance» perdió el triángulo con W3-04; X-07 (`cfb2fe5`) lo vuelve a pintar con
  `::before` (fila 28), pero ese carácter entra en el nombre accesible (fila nueva v2 tras la 28).

Paridad numérica en ejecución (xhigh, 22/10): los mismos 87 casos en la v1.8 demo y en Next (`alpha`, español) dan los
mismos números en los 22 conversores: 192 de 192 valores mostrados iguales (resultado y «Otras equivalencias»), con las
98 unidades a la vista y el mismo redondeo y formato `es`. Las únicas diferencias visibles son las ya anotadas: el
prefijo «Valor:» de los errores (filas 34-35, 38-40), el rango y la tolerancia (filas 24 y 45) y la duración con
espacios (TOOL-03 #8). En inglés (`delta`, idioma guardado `en`, y `alpha` con la cookie `en`, resultados idénticos)
cambia solo el formato y aparece el eco. Tabla completa: `evidencias/xhigh/40/TOOL02-paridad-runtime-comparacion.md`.

**v2 (tras el bucle).** Los mismos 97 registros (49 del conversor, 16 de par, 22 de duración y 10 extra: invertir,
cambio de magnitud, copiar, potencia y cambio de modo de Duración) se han vuelto a ejecutar en la v1.8 demo, en Next `es`
(`alpha`) y en Next `en` (`delta`): coinciden registro a registro con los de la mañana en los tres lados, 97/97 cada uno
(`evidencias/v2/40/v2-parity-vs-xhigh.txt`). Una primera pasada en `en` sacó 4 casos seguidos (C02-C05) en español; no
se reproduce y coincide con un cambio del perfil de `delta` hecho por otra sesión durante esa pasada
(`profiles.updated_at` 14:24:38 UTC, base local, solo lectura); la segunda pasada coincide entera. No es un defecto de
Next.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Kicker del panel | «MECÁNICA» (par) / «UNIDADES» (`Toolbox.jsx:22`) | Idénticos (`src/features/tools/components/UnitConverter.tsx:105-109`, es:1035-1036) | = | — | — | — |
| 2 | h2 del panel | «Par de apriete» / «Conversor técnico» | Idénticos (es:1037-1038) | = | — | — | — |
| 3 | Icono | Wrench 25 px en ambos modos | `WrenchIcon size={25}` (`UnitConverter.tsx:108`) | = | — | — | — |
| 4 | Descripción | `m.description` o «Selecciona la magnitud y las unidades de la lectura.» (`Toolbox.jsx:22`) | `magnitude.{id}.description` o `converter.defaultDescription` (`UnitConverter.tsx:59-61,110`, es:1039) | = | — | — | — |
| 5 | Select «Magnitud» | Solo en el conversor; 22 etiquetas en el orden de `MAGNITUDES`; defecto Longitud (`Toolbox.jsx:18,23`) | Igual (`UnitConverter.tsx:45,113-128`) | = | — | — | — |
| 6 | «Valor de entrada» | Texto, `inputMode="decimal"`, placeholder «Escribe un valor» (`Toolbox.jsx:24`) | Igual, más `autoComplete="off"`, `aria-describedby` y `aria-invalid` (`UnitConverter.tsx:131-150`, es:1041-1042) | = | — | — | — |
| 7 | Ayuda del valor | «También 3/16 o 1 3/16» (longitud) / «Sin separadores de miles» | Idénticas (es:1043-1044) | = | — | — | — |
| (nueva) | Eco de la lectura | No existe: «1,200» se lee 1,2 sin aviso | «Se lee como {n}» bajo el valor (`aria-live="polite"`, en `aria-describedby`) cuando la entrada lleva una fracción o la marca decimal que no es la del idioma («1,200» en `en` → «Read as 1.2»; «1.200» en `es` → «Se lee como 1,2»); `formatNumber(locale, n, 10)`; no cambia el resultado (`UnitConverter.tsx:56,135-137,146`, `parts.tsx:94-98`, `engine.ts:312-333`, es:1003; tests `engine.test.ts:179-208`) | + | — | — | Mantener (W1-06, `14dfaf0`) |
| 8 | Etiquetas de unidad en los selects | Símbolo del motor: «t métrica», «mi terrestre», «hp mecánico», «CV / PS métrico» (`engine.js:10,21,22`) | Símbolo corto en el motor (`t`, `mi`, `hp`, `CV / PS`, `src/features/tools/engine.ts:56,155,162-163`) y texto desde `tools.unit.*` (es:1183-1188): en español se ve igual (en ejecución, también en el resultado y en el texto copiado); en inglés «metric t», «statute mi», «mechanical hp», «metric hp (PS)» (en.json:1183-1188; en ejecución con `delta`) | ≈ | — | — | — |
| 9 | Pares iniciales | Par N·m → lbf·ft; conversor mm → in (`Toolbox.jsx:18`) | Igual (`UnitConverter.tsx:47-48`) | = | — | — | — |
| 10 | Cambio de magnitud | Origen = 1.ª clave, destino = 2.ª; desmarca rango; la tolerancia no se borra (`Toolbox.jsx:20`). En ejecución: longitud con tolerancia 7 → par: N·m → lbf·ft, casilla desmarcada y, al volver a marcarla, la tolerancia sigue en «7» | Igual (`UnitConverter.tsx:77-83`); en ejecución, igual | = | — | — | — |
| 11 | «Decimales máximos» | 2, 4, 6, 8, 10; defecto 6 | Igual (`UnitConverter.tsx:34,49,185-198`, es:1048) | = | — | — | — |
| 12 | «Referencia de ambas presiones» | Solo en presión: «manométrica» (defecto) / «absoluta» (`Toolbox.jsx:27`) | Igual; los valores internos son `gauge`/`absolute` (`UnitConverter.tsx:201-213`, es:1049-1051) | = | — | — | — |
| 13 | Casilla de rango | «Convertir también nominal ± tolerancia», solo en par y longitud (`Toolbox.jsx:28`) | Igual (`UnitConverter.tsx:35,215-225`, es:1052) | = | — | — | — |
| (nueva xhigh) | Casilla de rango en pantalla táctil | `.tb-check`: casilla de 17×17 px y etiqueta de 320×19 px en un contexto táctil de 390 px (en ejecución) | Desde X-09 (`5d85caa`) la etiqueta lleva `pointer-coarse:min-h-11` (`UnitConverter.tsx:217`) y el enlace «NIST · unidades y factores» también (`parts.tsx:178`); `ui-smoke` 25 mide ya `label:has(input[type=checkbox])` y los enlaces sueltos (`scripts/local/ui-smoke.mjs:1315-1330`). En ejecución v2 con `pointer: coarse` a 390 px: casilla 17×17, etiqueta 316×44, enlace NIST 166,7×44 (`evidencias/v2/40/TOOL02-13-next-casilla-tactil-390.jpg`; v1.8 en ejecución v2: etiqueta 320×19,2 y NIST 173,8×14, `evidencias/v2/40/TOOL02-13-v18-casilla-tactil-390.jpg`). En la xhigh: 316×20 y 167×16 | + (v2: antes =) | — | — | Mantener (X-09); backlog 7 HECHO |
| 14 | «Tolerancia de la fuente (%)» | Con ayuda «Introduce la tolerancia indicada por tu fuente; no se asigna una por defecto.» | Igual (`UnitConverter.tsx:226-242`, es:1053-1054) | = | — | — | — |
| 15 | «Invertir unidades» | Intercambia unidades y pone `String(resultado)` sin redondear como nuevo valor: en ejecución, «3/16» in → mm, al invertir el campo pasa a «4.762499999999999» (ruido de coma flotante, no «4.7625») y el resultado es «0,1875 in» (`Toolbox.jsx:25`, hallazgo §3 #11; `evidencias/xhigh/40/TOOL02-15-v18-invertir-1440.jpg`) | Igual: mismo «4.762499999999999» y «0,1875 in» (`UnitConverter.tsx:85-90,164-171`). En español, como el texto lleva punto, aparece además el eco «Se lee como 4,7625» (`evidencias/xhigh/40/TOOL02-15-next-invertir-1440.jpg`) | = | P3 | — | Mantener (conserva precisión). Hallazgo #11 anotado |
| 16 | Error principal | Solo si `value!==''`, `p.tb-error role="status"` (`Toolbox.jsx:29`) | Igual (`UnitConverter.tsx:246`, `parts.tsx:103-110`) | = | — | — | — |
| 17 | Presión absoluta negativa | «La presión absoluta no puede ser negativa.» (`Toolbox.jsx:19`); en ejecución con -0,5 bar en «absoluta» (en «manométrica», -7,251887 psi) | Igual, `negativeAbsolutePressure` (`UnitConverter.tsx:63-69`, es:1101); en ejecución, igual | = | — | — | — |
| 18 | Leyenda del resultado | «Equivalencia» / «Presión manométrica» / «Presión absoluta» (en ejecución) | «Equivalencia» / «Presión {reference}» (`UnitConverter.tsx:97-100`, es:1055-1056); en ejecución los mismos textos («Equivalent», «gauge pressure», «absolute pressure» en `en`) | = | — | — | — |
| 19 | Valor del resultado | `format(r,precision)` o «—», más el símbolo de destino (`Toolbox.jsx:21,30`) | Igual, con `aria-live="polite"` (`UnitConverter.tsx:75,266`, `parts.tsx:126`) | = | — | — | — |
| 20 | Idioma del formato numérico | `Intl.NumberFormat('es-ES')` fijo: «73,756215»; no agrupa 4 cifras («5200»), sí 5 («11.920») (`engine.js:104`). La v1.8 solo existe en español | `formatNumber(locale)` con el idioma de la interfaz, `es` o `en`. El idioma sale de la preferencia guardada, luego la cookie, luego `Accept-Language`, y solo si nada encaja `en` (`src/i18n/resolve.ts:1-5`, `src/i18n/config.ts:7`). En `es` igual que v1.8 (en ejecución, 192/192 valores); en `en`, «73.756215», «5,200», «11,920», «230,000 mV» (`engine.ts:336-340`, `UnitConverter.tsx:40,75`; `evidencias/xhigh/40/runtime-next-en-delta.json`) | ≠ | P2 | — | Mantener (i18n C-5). Ver fila 37 |
| 21 | «Copiar con unidades» / «Copiado» | 1800 ms con icono Check; si falla, nada (`Toolbox.jsx:13`). En ejecución: «Copiado» y, 2 s después, otra vez «Copiar con unidades» | Igual (`parts.tsx:137-162`, es:1082-1083); en ejecución, igual («Copied» / «Copy with units» en `en`) | = | — | — | — |
| 22 | Texto copiado | «{valor} {u.origen} = {formateado} {u.destino} · CrewFlex 1.0.0» (`Toolbox.jsx:30`). Portapapeles en ejecución: «100 N·m = 73,756215 lbf·ft · CrewFlex 1.0.0»; «100 hp mecánico = 101,386967 CV / PS métrico · CrewFlex 1.0.0» | Igual, y en par añade « · solo conversión de unidades; el valor de par procede de los datos de mantenimiento aprobados» (`UnitConverter.tsx:268-270`, es:1066). Portapapeles en ejecución: el mismo texto más esa coletilla en par; en el conversor, idéntico a v1.8; en `en`, «100 mechanical hp = 101.386967 metric hp (PS) · CrewFlex 1.0.0» | + | — | — | Mantener (D-11) |
| 23 | Panel «Rango convertido» | «{low} – {high} {símbolo}» y «Nominal ± {t} %. La tolerancia procede de tu entrada.» (`Toolbox.jsx:31`). En ejecución, 100 N·m ± 5 % → «70,068404 – 77,444026 lbf·ft»; «1 3/16» in ± 1 % → «29,860875 – 30,464125 mm» | Igual (`UnitConverter.tsx:274-293`, es:1057-1058); en ejecución los mismos textos y números (también ± 0, ± 100, ± 2,5 y ± «1/2») | = | — | — | — |
| 24 | Error de rango y de tolerancia | Con la casilla marcada y el valor vacío, el panel muestra «Valor: introduce un valor.». Con la tolerancia vacía dice también «Valor:…», no «Tolerancia»; con «abc», «Valor: número o fracción no válido.»; con «1.000,5», «Valor: no uses separadores de miles.» (`Toolbox.jsx:19,31`, `engine.js:56`; hallazgos §3 #10, §4 #2; los cuatro, en ejecución) | Corregido: con el valor vacío el panel no se pinta (el error principal ya lo pide). Tolerancia vacía → «Tolerancia: introduce un porcentaje.»; no numérica o con separador de miles → «Tolerancia: introduce un porcentaje válido, p. ej. 5 o 2,5.»; negativa o > 100 → «La tolerancia porcentual debe estar entre 0 y 100.» (`UnitConverter.tsx:70-74,274`, `engine.ts:273-274,282-295`, es:1098-1100; tests `engine.test.ts:132-145`; en ejecución, casos R01-R05 y R12 de `evidencias/xhigh/40/TOOL02-paridad-runtime-comparacion.md`) | ≠ (antes ✗) | P3 | — | Mantener (W1-05, `7bae7a2`) |
| 25 | «Otras equivalencias» | Una línea por unidad salvo la de destino (incluye la de origen) (`Toolbox.jsx:32`) | Igual, como `dl/dt/dd` (`UnitConverter.tsx:295-314`, es:1059) | = | — | — | — |
| 26 | Pie | Par: «Comprueba lbf·in frente a lbf·ft: la diferencia es un factor 12. La tarea aplicable determina el valor de apriete.». Conversor: «La unidad de origen siempre debe coincidir con tu instrumento o documentación.» (`Toolbox.jsx:33`) | Idénticos (`UnitConverter.tsx:316`, es:1060-1061) | = | — | — | — |
| 27 | Aviso legal de par (AMM/SRM/CMM) | No existe en el conversor. La única mención es «No incluye procedimientos ni extractos de AMM/TCM» en el reto (`DailyLearning.jsx:15`) | `role="note"`: «Conversión matemática, no una especificación de apriete» + «Este resultado solo convierte unidades. El valor de par, su tolerancia, la secuencia y cualquier corrección por adaptador o extensión proceden de los datos de mantenimiento aprobados para la tarea (AMM, SRM, CMM u otra documentación autorizada)…» (`UnitConverter.tsx:256-264`, es:1064-1065; test `messages.test.ts:44-47`) | + | — | — | Mantener (exigido por D-11) |
| 28 | `<details>` «Fórmula, fuentes y alcance» | `References` (`Toolbox.jsx:16`); `summary` con su `display` por defecto (`list-item`), así que muestra el triángulo de desplegable (`.tb-references summary{font-weight:700;cursor:pointer;color:#226969}`; ninguna otra regla de la hoja toca su `display`). En ejecución (Chromium): `display: list-item`, `list-style-type: disclosure-closed`, triángulo ▸ cerrado y ▾ abierto; 19 px de alto también en táctil (`evidencias/xhigh/40/TOOL02-28-v18-summary-cerrado-1440.jpg`, `evidencias/xhigh/40/TOOL02-28-v18-summary-abierto-1440.jpg`) | `References` (`parts.tsx:164-185`, es:1084). Desde W3-04 (`7255055`) el `summary` lleva `flex … pointer-coarse:min-h-11` (`parts.tsx:168`), que le quitó el triángulo nativo (xhigh: `evidencias/xhigh/40/TOOL02-28-next-summary-*`). **X-07 (`cfb2fe5`)** añade una regla base: `summary.flex::before` pinta «▸» cerrado y «▾» con el `<details>` abierto, y quita el marcador propio de WebKit (`src/app/globals.css:59-71`). En ejecución v2 (Chromium): `display: flex`, `::before` «▸» / «▾», 16 px de alto en escritorio y 44 en táctil, en par, en conversiones y en «Los 7 apartados del perfil» de Mi espacio (`src/app/app/professional/page.tsx:238`) (`evidencias/v2/40/TOOL02-28-next-summary-abierto-torque-1440.jpg`; v1.8 en ejecución v2: `list-item`, triángulo nativo, 19 px, `evidencias/v2/40/TOOL02-28-v18-summary-abierto-torque-1440.jpg`). Firefox sin probar | ≈ (v2: antes ≠) | — | — | Mantener (X-07); backlog 6 HECHO. Ver la fila siguiente |
| (nueva v2) | Nombre accesible del resumen | Triángulo nativo (`::marker`), fuera del nombre: en el árbol de accesibilidad de Chromium, `DisclosureTriangle` «Fórmula, fuentes y alcance» (en ejecución v2) | Corregido en `88d9a6d` (T-3): `content: "▸" / ""` y `"▾" / ""` en `src/app/globals.css:97-105`, texto alternativo vacío; el triángulo se sigue viendo y cambia al abrir. En ejecución, el árbol de accesibilidad de Chromium da «Formula, sources and scope» sin «▸»/«▾» en `/app/tools/convert` y en Mi espacio (`ui-smoke` 28f) | = (F3: antes ≠) | — | — | — (T-3 hecho) |
| 29 | Fórmula | «Resultado = valor × factor de origen / factor de destino. Temperaturas absolutas incluyen el desplazamiento de escala. Los rangos se convierten por sus extremos.» | Idéntica (es:1062) | = | — | — | — |
| 30 | Ejemplo de par | «120 lbf·in = 10 lbf·ft ≈ 13,5581794833 N·m. No calcula precarga, selección de par ni corrección de adaptadores.» | Idéntico en es (es:1063); en en, «13.5581794833» | = | — | — | — |
| 31 | Nota del motor | «Motor 1.0.0. Redondeo solo de presentación. Sin separadores de miles en la entrada; coma o punto indican decimales.» | Idéntica (`parts.tsx:173`, es:1085) | = | — | — | — |
| 32 | Enlace NIST | «NIST · unidades y factores» → `…/nist-guide-si-appendix-b9` (`engine.js:4`) | Misma URL (`engine.ts:6-7`, `parts.tsx:174-182`, es:1086) | = | — | — | — |
| 33 | Versión del motor | `ENGINE_VERSION='1.0.0'` (`engine.js:3`) | `"1.0.0"` (`engine.ts:5`) | = | — | — | — |
| 34 | Entrada vacía | «{label}: introduce un valor.» → «Valor: introduce un valor.» (`engine.js:32`). En ejecución: con el campo vacío no hay error (`value!==''`); con un espacio, «Valor: introduce un valor.» | «Introduce un valor.» sin prefijo (`engine.ts:219-221`, es:1088); en ejecución, mismo comportamiento (vacío sin error; espacio → «Introduce un valor.», `aria-invalid="true"`) | ≈ | P3 | — | Mantener; el error aparece bajo su campo |
| 35 | Coma y punto a la vez | «Valor: no uses separadores de miles.» (`engine.js:34`); en ejecución con «1.234,5» | «No uses separadores de miles.» (`engine.ts:223`, es:1089); en ejecución, igual sin prefijo («Do not use thousands separators.» en `en`) | ≈ | P3 | — | — |
| 36 | Fracciones | Mixta `^(-?)(\d+)\s+(\d+)/(\d+)$`, simple `^(-?\d+)/(\d+)$`; denominador 0 → «El denominador no puede ser cero.» (`engine.js:35-38`). En ejecución: «1 3/16» in → 30,1625 mm; «3/16» → 4,7625; «1/0» y «1 1/0» → error; «-1 1/2» °C → 29,3 °F | Mismas expresiones y mensaje (`engine.ts:207-208,227-232`, es:1090); en ejecución los mismos resultados, más el eco «Se lee como 1,1875» / «-1,5» | = | — | — | — |
| 37 | Decimales (coma o punto) | `^[+-]?(?:\d+(?:[.,]\d*)?\|[.,]\d+)(?:e[+-]?\d+)?$`, sin distinguir mayúsculas; admite exponente; «1,200» = 1,2 (`engine.js:39`; hallazgo §4 #1). En ejecución: «1,200» y «1.200» mm → 0,047244 in; «1e3» → 39,370079; «+5», «,5» y «-0» se aceptan; «1 200» → no válido | Misma regla (`engine.ts:209,234-235`; test `engine.test.ts:29-37`); en ejecución, los mismos resultados. Con la interfaz en inglés, «1,200» se sigue leyendo 1,2 y «5,200» kg da 11.464038 lb (5,2 kg), pero el eco lo dice: «Read as 1.2», «Read as 5.2» (fila nueva tras la 7; `evidencias/xhigh/40/TOOL02-20-next-en-coma-1440.jpg`). En español, «1.200» da «Se lee como 1,2» | = | — | — | — (eco añadido, W1-06) |
| 38 | Número no válido | «Valor: número o fracción no válido.» (en ejecución con «abc» y «1 200») | «Número o fracción no válido.» (es:1091); en ejecución, igual sin prefijo | ≈ | P3 | — | — |
| 39 | Rango de cálculo | No finito o \|x\|>1e15 → «Valor: fuera del rango de cálculo.» (`engine.js:40`; en ejecución con «1e16») | `MAX_ABS_VALUE=1e15` → «Fuera del rango de cálculo.» (`engine.ts:9,237-239`, es:1092); en ejecución, igual sin prefijo | ≈ | P3 | — | — |
| 40 | Signo | `positive` / `nonnegative` → «Valor: debe ser mayor que cero.» / «Valor: no puede ser negativo.» (en ejecución, «-5» mm) | «Debe ser mayor que cero.» / «No puede ser negativo.» (es:1093-1094); en ejecución, igual sin prefijo | ≈ | P3 | — | — |
| 41 | Magnitudes con signo | Presión, temperatura, diferencia de temperatura y ángulo; las demás rechazan negativos (`engine.js:13-15,27,48`). En ejecución: -0,5 bar → -7,251887 psi; -40 °C → -40 °F; -90° → -1,570796 rad; -5 mm → error | Las mismas 4 (`engine.ts:82,95,103,172,182,256`); en ejecución, los mismos resultados | = | — | — | — |
| 42 | Unidad de otra magnitud | «Las unidades no pertenecen a la misma magnitud.» | Igual (`engine.ts:255`, es:1095) | = | — | — | — |
| 43 | Temperatura absoluta | `canonical < −1e-10` → «La temperatura no puede ser inferior a 0 K.»; se recorta a 0 (`engine.js:50-51`). En ejecución: -300 °C → error; 0 K → -273,15 °C | Igual (`engine.ts:258-260`, es:1096); en ejecución, igual | = | — | — | — |
| 44 | Resultado no finito | «El resultado está fuera del rango.» | Igual (`engine.ts:261`, es:1097) | = | — | — | — |
| 45 | `convertRange` | n ≥ 0, p ≥ 0, p > 100 → «La tolerancia porcentual debe estar entre 0 y 100.»; extremos `n·(1∓p/100)` (`engine.js:55-59`). Una tolerancia negativa da «Valor: no puede ser negativo.» (en ejecución, «-5») | Misma regla 0 ≤ p ≤ 100 y mismos extremos; la tolerancia tiene sus propios códigos (`toleranceRequired`, `toleranceInvalid`) y la negativa da también «…entre 0 y 100.» (`engine.ts:266-295`, es:1098-1100; en ejecución, «-5») | ≈ (antes =) | P3 | — | Mantener (W1-05) |
| 46 | `pressureReference` (gauge ↔ absoluta con presión ambiente) | Exportada pero **muerta** en la UI (`engine.js:60-67`; hallazgo §4 #3); ni siquiera llega al bundle: sus mensajes («Presión ambiente», «La presión absoluta calculada es negativa…») no están en `dist/assets/index-dtxkpGY0.js` | No existe | ✗ | — | — | No portar (código muerto) |
| 47 | `format` | `maximumFractionDigits`, `minimumFractionDigits: 0`, redondeo *half-expand* | Igual salvo el idioma (fila 20) (`engine.ts:336-340`) | = | — | — | — |
| 48 | Pruebas | `tests/tools.test.mjs`: 7 tests (factores, ida y vuelta de todos los pares, límites, combustible, duraciones) | `src/features/tools/engine.test.ts` (parseo, ida y vuelta de todos los pares, factores de referencia, temperatura, signo, rango y tolerancia, duraciones, formato, eco `ambiguousReading` y paridad numérica con el runtime de v1.8 en `:212-235`) y `messages.test.ts` (catálogo es/en, placeholders de Duración). Ejecutado otra vez en la verificación xhigh (22/10): 3 ficheros, 36/36 en verde (con `tests/design/contrast.test.ts`); en v2, en el SNAP: 3 ficheros, 40/40 (`contrast.test.ts` suma los tests de X-01, X-10 y X-20). Los tests fijan 8 valores; la comparación en ejecución cubre 192 | ≈ | — | — | Mantener (paridad añadida, W3-10 `4fdc186`) |
| 49 | Magnitud `torque` «Par de apriete» | N·m 1 · lbf·ft 1.3558179483314004 · lbf·in 0.1129848290276167 · N·cm 0.01 · daN·m 10 · kgf·m 9.80665 · kgf·cm 0.0980665 · ozf·in 0.00706155181422604375; sin signo; «Convierte el par indicado en la tarea. No determina el apriete de un tornillo.» (`engine.js:7-8`) | Mismos 8 factores literales (`engine.ts:28-39`); etiqueta y descripción iguales (es:1105-1108). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C01-C03 y T01-T04) | = | — | — | — |
| 50 | `length` «Longitud» | mm 0.001 · in 0.0254 · ft 0.3048 · m 1 · cm 0.01 · µm 1e-6 · mil / thou 2.54e-5; «Acepta fracciones como 3/16 o 1 3/16. Mil/thou significa una milésima de pulgada.» (`engine.js:9`) | Igual (`engine.ts:40-50`, es:1109-1112). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C04-C06) | = | — | — | — |
| 51 | `mass` «Masa» | kg 1 · lb 0.45359237 · g 0.001 · t métrica 1000 · oz 0.028349523125; «lb y oz son unidades de masa; lbf pertenece a Fuerza.» (`engine.js:10`) | Mismos factores (`engine.ts:51-59`); el texto «t métrica» viene de `unit.tonne` (es:1184). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C07-C08) | = | — | — | — |
| 52 | `volume` «Volumen» | L 1 · US gal 3.785411784 · Imp gal 4.54609 · mL 0.001 · m³ 1000 · US qt 0.946352946 · Imp qt 1.1365225 · in³ 0.016387064; «US gallon e Imperial gallon no son equivalentes. Selecciona el sistema del comprobante.» (`engine.js:11`) | Igual (`engine.ts:60-71`, es:1117-1120). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C09) | = | — | — | — |
| 53 | `density` «Densidad» | kg/L 1 · kg/m³ 0.001 · g/mL 1 · lb/US gal 0.45359237/3.785411784 · lb/Imp gal 0.45359237/4.54609; «Conserva la misma base de temperatura. Esta conversión no corrige dilatación térmica.» (`engine.js:12`) | Mismas expresiones (`engine.ts:72-80`, es:1121-1124). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C10) | = | — | — | — |
| 54 | `pressure` «Presión» (con signo) | bar 1e5 · psi 6894.757293168361 · Pa 1 · hPa 100 · kPa 1000 · MPa 1e6 · mbar 100 · «inHg · 0 °C» 3386.389; «La conversión conserva la referencia absoluta o manométrica de la lectura.» (`engine.js:13`) | Igual (`engine.ts:81-93`, es:1125-1128). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C11-C13) | = | — | — | — |
| 55 | `temperature` «Temperatura» (con signo) | °C factor 1, offset 273.15 · °F factor 5/9, offset 255.3722222222222 · K 1; «Temperatura absoluta: incluye desplazamiento de escala. Para incrementos usa Diferencia de temperatura.» (`engine.js:14`) | Igual (`engine.ts:94-101`, es:1129-1132). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C14-C17) | = | — | — | — |
| 56 | `temperatureDelta` «Diferencia de temperatura» (con signo) | Δ°C 1 · Δ°F 5/9 · ΔK 1; «Un incremento de 20 °C equivale a 36 °F; no se suma 32.» | Igual (`engine.ts:102-105`, es:1133-1136). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C18) | = | — | — | — |
| 57 | `force` «Fuerza» | N 1 · daN 10 · kN 1000 · lbf 4.4482216152605 · kgf 9.80665; «No convierte masa en fuerza ni estima precarga a partir de un par de apriete.» | Igual (`engine.ts:106-114`, es:1137-1140). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C19) | = | — | — | — |
| 58 | `area` «Superficie» | mm² 1e-6 · cm² 1e-4 · m² 1 · in² 0.00064516 · ft² 0.09290304; sin descripción | Igual (`engine.ts:115-123`, es:1141-1143). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C20) | = | — | — | — |
| 59 | `flowVolume` «Caudal volumétrico» | L/min 1 · L/h 1/60 · US gal/min 3.785411784 · Imp gal/min 4.54609 · m³/h 1000/60; «Para caudal másico también se necesita densidad; aquí solo se convierte volumen/tiempo.» | Igual (`engine.ts:124-132`, es:1144-1147). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C21) | = | — | — | — |
| 60 | `flowMass` «Caudal másico» | kg/h 1 · lb/h 0.45359237 · kg/s 3600 · kg/min 60 | Igual (`engine.ts:133-140`, es:1148-1150). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C22) | = | — | — | — |
| 61 | `speed` «Velocidad» | m/s 1 · km/h 1/3.6 · kt 1852/3600 · mph 1609.344/3600 · ft/s 0.3048 | Igual (`engine.ts:141-149`, es:1151-1153). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C23) | = | — | — | — |
| 62 | `distance` «Distancia» | km 1000 · NM 1852 · m 1 · mi terrestre 1609.344; «NM es milla náutica; N·m es par y nm es nanómetro.» | Mismos factores; «mi terrestre» desde `unit.mile` (`engine.ts:150-157`, es:1154-1157,1185). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C24) | = | — | — | — |
| 63 | `power` «Potencia» | W 1 · kW 1000 · hp mecánico 745.6998715822702 · CV / PS métrico 735.49875 | Mismos factores; textos desde `unit.hp`/`unit.PS` (`engine.ts:158-165`, es:1158-1160,1186-1187). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C25 y hp → PS) | = | — | — | — |
| 64 | `voltage` / `current` / `resistance` / `frequency` | V 1, mV 1e-3, kV 1e3 · A 1, mA 1e-3, µA 1e-6 · Ω 1, kΩ 1e3, MΩ 1e6 · Hz 1, kHz 1e3, MHz 1e6 (`engine.js:23-26`) | Igual (`engine.ts:166-171`, es:1161-1172). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C26-C29) | = | — | — | — |
| 65 | `angle` «Ángulo» (con signo) / `rotation` «Velocidad angular» | ° π/180 · rad 1 / rpm π/30 · rad/s 1 | Igual (`engine.ts:172-173`, es:1173-1178). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C30-C31) | = | — | — | — |
| 66 | `time` «Duración» | min 60 · h 3600 · s 1 | Igual (`engine.ts:174`, es:1179-1181). En ejecución (22/10), todas sus unidades muestran el mismo valor que v1.8 en `es` (casos C32) | = | — | — | — |

Ejemplos runtime de v1.8 que reproduce el motor de Next (mismos factores y algoritmo; en `es` el formato también
coincide):
- 100 N·m → 73,756215 lbf·ft, 885,074579 lbf·in, 14.161,193266 ozf·in;
- 1 bar → 14,503774 psi;
- 1 °C → 33,8 °F;
- 1 3/16 in → 30,1625 mm.

(`v18-runtime-demo.md` D-TOOL-01/02). Desde el 21/10 (W3-10, `4fdc186`) los tests de Next fijan estos valores con
`formatNumber("es", …, 6)` (todos salvo 885,074579 lbf·in), más 1 L/min → 60 L/h, la agrupación «5200» / «11.920» y
`clockToHours(" 1:30") = 1.5` (`src/features/tools/engine.test.ts:212-235`). Ejecutados el 22/10:
`pnpm vitest run src/features/tools tests/design/contrast.test.ts` → 3 ficheros, 36/36 en verde.

En ejecución (xhigh, 22/10) se han reproducido los seis valores de arriba en las dos apps, con el mismo texto (también
885,074579 lbf·in), y además, entre otros: 12345,678 kg → 27.217,561001 lb; 8500 L → 2245,462445 US gal; 230 V →
230.000 mV; 3000 rpm → 314,159265 rad/s; 1 km → 0,539957 NM; 100 N·m con 2 y 10 decimales → 73,76 y 73,7562149277;
120 lbf·in → 13,5581794833 N·m con 10 decimales (el ejemplo del pie). En `en`, los mismos números con punto decimal y
coma de millares.

Capturas: v1.8 `evidencias/shots/demo/D-TOOL-01-par-apriete-1440.png`, `evidencias/shots/demo/D-TOOL-01b-par-tolerancia-1440.png`,
`evidencias/shots/demo/D-TOOL-02-conversiones-1440.png`, `evidencias/shots/demo/D-TOOL-02b-conversiones-temp-1440.png`,
`evidencias/shots/connected/C-TEC-40-tool-par-1440.png`, `evidencias/shots/connected/C-TEC-40-tool-conversiones-1440.png`; datos
`raw/demo/D-TOOL-02-conversiones-magnitudes.json`. Next: no hay captura de `/app/tools/torque` ni de
`/app/tools/convert` en `docs/audit/evidence/` (solo la portada del lote 11). Ejecución xhigh (22/10):
`evidencias/xhigh/40/TOOL02-1-v18-par-1440.jpg`, `evidencias/xhigh/40/TOOL02-1-next-par-1440.jpg`,
`evidencias/xhigh/40/TOOL02-2-v18-conversiones-1440.jpg`, `evidencias/xhigh/40/TOOL02-2-next-conversiones-1440.jpg`,
`evidencias/xhigh/40/TOOL02-28-*` (resumen sin triángulo), `evidencias/xhigh/40/TOOL02-20-next-en-coma-1440.jpg`; datos
`evidencias/xhigh/40/TOOL02-paridad-runtime-comparacion.md` y `evidencias/xhigh/40/runtime-{v18-es,next-es,next-en-delta,next-en-alphacookie}.json`
(casos en `evidencias/xhigh/40/runtime-cases.mjs.txt`). Ejecución v2: `evidencias/v2/40/TOOL02-13-{v18,next}-casilla-tactil-390.jpg`,
`evidencias/v2/40/TOOL02-28-{v18,next}-summary-abierto-torque-1440.jpg`, `evidencias/v2/40/TOOL02-28-next-summary-abierto-convert-1440.jpg`,
`evidencias/v2/40/TOOL02-28-next-summary-nombre-accesible.txt`; datos `evidencias/v2/40/v2-{v18-es,next-es,next-en-delta,next-en-delta-run1}.json`
y `evidencias/v2/40/v2-parity-vs-xhigh.txt` (driver `evidencias/v2/40/parity.mjs.txt`).

---

## TOOL-03 · Duración HH:MM ↔ decimal — v1.8 `S-TOOL-08, D-TOOL-04, C-TEC-40` ↔ Next `N-TOOL-04`

**Estado global:** IGUAL. Mismas reglas, textos y resultado (22 casos en ejecución el 22/10: mismos valores y mismos
errores salvo el prefijo «Valor:» y la entrada con espacios). Next mejora cuatro detalles: recorta espacios, vacía el
campo al cambiar de modo, añade un pie con la fórmula y, en horas decimales, el eco «Se lee como {n}». Los
placeholders ya salen del catálogo («1,5» en `es`, «1.5» en `en`). v2: los 22 casos y los 2 extra de Duración, otra vez
iguales a los de la mañana en los tres lados (`evidencias/v2/40/v2-parity-vs-xhigh.txt`).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | h2 | «Duración de jornada» (`Toolbox.jsx:64`) | Idéntico (`src/features/tools/components/DurationTool.tsx:40-42`, es:1069) | = | — | — | — |
| 2 | Descripción | «Convierte duración entre HH:MM y horas decimales. 1:30 equivale a 1,5 h.» | Idéntica (es:1070) | = | — | — | — |
| 3 | Select «Conversión de duración» | `clock` «HH:MM → horas decimales» (defecto) / `decimal` «Horas decimales → HH:MM» | Igual (`DurationTool.tsx:45-58`, es:1071-1073) | = | — | — | — |
| 4 | Cambio de modo | Conserva el texto escrito (`Toolbox.jsx:64`). En ejecución: «1:30» y cambio a decimal → el campo sigue con «1:30» y sale «Valor: número o fracción no válido.» | Vacía el campo (`DurationTool.tsx:50-53`); en ejecución, campo vacío, sin error y con el placeholder «1,5» | ≠ | P3 | — | Mantener (evita leer «1:30» como decimal) |
| 5 | Etiqueta del campo | «Duración HH:MM» / «Horas decimales» | Igual (es:1074-1075); en ejecución, igual | = | — | — | — |
| 6 | `inputMode` | `text` en los dos modos (en ejecución) | `text` / `decimal` (`DurationTool.tsx:73`; en ejecución) | + | P3 | — | Mantener |
| 7 | Placeholder | Ninguno (en ejecución, `placeholder` nulo) | Desde el catálogo: «1:30» / «1,5» en `es`, «1:30» / «1.5» en `en` (`DurationTool.tsx:74`, es:1076-1077; test `messages.test.ts:38-42`; en ejecución, en los dos idiomas) | + | — | — | Mantener (W3-08, `69210ac`) |
| (nueva) | Eco de la lectura (horas decimales) | No existe | En modo decimal, «Se lee como {n}» bajo el campo si la entrada lleva una fracción o la marca decimal ajena al idioma («1,5» en `en` → «Read as 1.5»); en HH:MM no hay eco (`DurationTool.tsx:34,62-66,76`, `parts.tsx:94-98`, es:1003). En ejecución: «7.75» en `es` → «Se lee como 7,75»; «1 1/2» → «Se lee como 1,5»; «1234,5» en `en` → «Read as 1,234.5» | + | — | — | Mantener (W1-06, `14dfaf0`) |
| 8 | Patrón HH:MM | `^(\d{1,5}):([0-5]\d)$` **sin recortar espacios**: « 1:30» da error (`engine.js:102`; en ejecución, «Usa HH:MM…») | Mismo patrón **con recorte**: « 1:30» → 1,5 (`engine.ts:298-304`; en ejecución, «1,5 h»). El resto de casos de ejecución coincide: «1:60», «1:5», «1,5», «-1:30» y «123456:00» → error; «12345:00» → 12.345 h; «0:01» → 0,016667 h | ≠ | P3 | — | Mantener (mejora) |
| 9 | Error de formato | «Usa HH:MM; los minutos van de 00 a 59.» en `p.tb-error` (`Toolbox.jsx:64`; el build lo pinta igual, comprobado en ejecución). D-TOOL-04 anota «— sin mensaje», en contra del código y del build | Igual (`DurationTool.tsx:80`, es:1102); en ejecución, igual | = | — | — | — |
| 10 | Decimal → HH:MM | `n ≥ 0`; `round(n·60)` → «H:MM»; si es negativo, «Valor: no puede ser negativo.» (`engine.js:103`). En ejecución: «1,5» → 1:30; «7.75» → 7:45; «0,0083» → 0:00; «2,999» → 3:00; «1234,5» → 1234:30; «-1», «1.5,0», « », «abc», «1:30» → errores con «Valor:» | Igual; si es negativo, «No puede ser negativo.» (`engine.ts:307-310`); en ejecución, los mismos resultados y errores sin prefijo | ≈ | P3 | — | — |
| 11 | Resultado HH:MM → decimal | «{format(x,6)} h» en un único `strong` (en ejecución, «1,5 h») | Valor con 6 decimales y la unidad «h» aparte (`DurationTool.tsx:27-32,81-85`, es:1079; en ejecución, «1,5» + «h») | ≈ | — | — | — |
| 12 | Leyenda del resultado | «Resultado» (valor por defecto de `Result`) | «Resultado» (es:1078) | = | — | — | — |
| 13 | Vacío o error | «—» | «—» (`DurationTool.tsx:83`) | = | — | — | — |
| 14 | Pie con la fórmula | No existe | «Horas decimales = horas + minutos / 60. HH:MM se redondea al minuto más próximo.» (`DurationTool.tsx:88`, es:1080) | + | — | — | Mantener |
| 15 | `aria-invalid` en el campo | No | Sí (`DurationTool.tsx:75`) | + | — | — | Mantener |
| 16 | Disposición | Un panel sin columna lateral | Un panel `max-w-2xl` con el resultado dentro (`DurationTool.tsx:36-39`) | = | — | — | — |
| 17 | Formato del número | `es-ES` | Idioma de la interfaz (ver TOOL-02 #20) | ≈ | P3 | — | — |

Capturas: v1.8 `evidencias/shots/demo/D-TOOL-04-duracion-1440.png`, `evidencias/shots/connected/C-TEC-40-tool-duracion-1440.png`. Next: sin
captura de `/app/tools/duration` en `docs/audit/evidence/`. Ejecución xhigh (22/10): `evidencias/xhigh/40/TOOL03-1-v18-duracion-1440.jpg`,
`evidencias/xhigh/40/TOOL03-1-next-duracion-1440.jpg`; 22 casos D01-D22 en `evidencias/xhigh/40/TOOL02-paridad-runtime-comparacion.md`.

---

## TOOL-04 · Combustible (FuelTools + FuelSheet) — v1.8 `S-TOOL-05, S-TOOL-05a…d, S-MOD-TOOL-01, D-TOOL-03` ↔ Next `—`

**Estado global:** AUSENTE EN NEXT (F3, 27/10: sin cambio; búsqueda de «fuel», «combustible», `FuelSheet` en `src`,
`messages` y `supabase`: solo «Fuel Tank Safety» y el test de favoritos). Lo bloquea D-11 («Fuel waits for a specific
technical review»; TD-82/83, V18-42).
SCOPE-2 (owner, 22/10) lo deja así: es lo único del banco que sigue bloqueado, y la tarea queda preparada (backlog F-1).
v2: la hoja con el ejemplo, masa ↔ volumen (con aviso 0,6–1,1 y bases), plan, conciliación, textos copiados y CSV
(`EF BB BF`, `' -40`) se han vuelto a ver en la v1.8 demo, iguales; en el SNAP sigue sin nada de combustible.

Al portarlo, no deben reproducirse los fallos marcados ✗:
- el CSV corrompe los números negativos;
- el balance en lb se muestra en kg;
- se copian ids en crudo;
- los errores de la hoja no se pueden mostrar.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Tarjeta y vista | «Combustible» → `FuelTools`; los valores no se guardan al salir (`Toolbox.jsx:37-55`). En ejecución: la tarjeta abre la vista con 4 pestañas (`evidencias/xhigh/40/TOOL04-1-v18-hoja-1440.jpg`) | — (búsqueda en la copia: ninguna ruta, componente, clave de `messages` ni migración de combustible; «fuel» solo aparece en «Fuel Tank Safety» del catálogo de cualificaciones y en un test de favoritos que descarta el id `fuel`, `src/features/tools/messages.test.ts:52`) | − | P1 | D-11 | Portar tras la revisión técnica |
| 2 | Pestañas | `sheet` «Hoja de escala · kg / L» (defecto), `quick` «Masa ↔ volumen», `plan` «Planificar suministro», `balance` «Conciliar suministro»; con `aria-pressed`; al cambiar, `submitted=false` (`Toolbox.jsx:44`). En ejecución: «Hoja de escala · kg / L» con `aria-pressed="true"` por defecto | — | − | P1 | D-11 | — |
| 3 | «Nueva operación» | Fuera de la hoja; vacía valores, cargas, bases y horas; **no** cambia modo, dirección ni unidades (`Toolbox.jsx:39,44`). En ejecución: no aparece en la hoja y sí en las otras 3 pestañas | — | − | P2 | D-11 | — |
| 4 | Aviso de ejemplo | «Ejemplo de formación cargado. No son datos de una aeronave.» + «Vaciar datos» (`Toolbox.jsx:45`). En ejecución, tras «Cargar ejemplo de formación ›» en conciliar: «Ejemplo de formación cargado. No son datos de una aeronave. Vaciar datos» | — | − | P2 | D-11 | — |
| 5 | Aviso de ejemplo persistente | Tras cargar el ejemplo en «Conciliar», el aviso sigue al cambiar de pestaña porque solo «Nueva operación» o «Vaciar datos» reinician `example` (`Toolbox.jsx:39,44-45`; hallazgo §3 #17). En ejecución (sesión limpia): en «Masa ↔ volumen» sigue con los campos vacíos; en «Planificar» sigue con los valores del ejemplo ya puestos (inicial 5200, objetivo 12000) y la densidad vacía (`evidencias/xhigh/40/TOOL04-5-v18-aviso-ejemplo-masa-volumen-1440.jpg`) | — | ✗ | — | D-11 | Al portar, reiniciar `example` al cambiar de modo |
| 6 | Masa ↔ volumen: campos | «Unidad de masa» kg/lb · «Unidad de volumen» L/US gal/Imp gal · «Calcular»: «Masa a partir de volumen» (defecto) / «Volumen a partir de masa» · «Cantidad ({u})» · «Densidad del suministro» (placeholder «Sin valor predeterminado») · «Unidad de densidad» (5) · «Base del volumen» / «Base de la densidad»: «Selecciona la base» / «En condiciones de suministro» / «Referido a 15 °C» (`Toolbox.jsx:35,48-50`). En ejecución: los 8 campos con esas etiquetas y el placeholder «Sin valor predeterminado» | — | − | P1 | D-11 | — |
| 7 | Ayuda de densidad | «Para datos observados, comprueba que densidad y volumen correspondan a las mismas condiciones de temperatura.». En ejecución, igual | — | − | P2 | D-11 | — |
| 8 | Reglas de densidad (`fuelDensity`) | Bases obligatorias: si faltan, «Indica la base de temperatura del volumen y de la densidad.». Si son distintas: «Volumen y densidad tienen distinta base de temperatura. Se necesitan datos compatibles; no se aplica corrección térmica automática.». Densidad > 0 en kg/L; **sin densidad por defecto** (`engine.js:68-72`). En ejecución: sin bases → «Indica la base de temperatura del volumen y de la densidad.»; bases distintas → «Volumen y densidad tienen distinta base…» | — | − | P1 | D-11 | Portar tal cual (regla de seguridad) |
| 9 | Aviso 0,6–1,1 kg/L | «Densidad fuera del intervalo orientativo de revisión. Comprueba unidad, dato y base de temperatura; no es un criterio de aceptación de combustible.» Solo en masa ↔ volumen (`engine.js:78`). En ejecución: con 1,2 kg/L aparece el aviso | — | − | P2 | D-11 | Revisar en D-11 (la hoja no lo muestra) |
| 10 | Resultado de masa ↔ volumen | «Cantidad calculada» `format(…,3)`; líneas «Masa» kg, «Equivalente» lb, «Volumen» L, «Densidad» `{rho,6}` kg/L (`Toolbox.jsx:53`). En ejecución: 1000 L a 0,8 kg/L → «800 kg»; Masa 800 kg, Equivalente 1763,698 lb, Volumen 1000 L, Densidad 0,8 kg/L (`evidencias/xhigh/40/TOOL04-3-v18-masa-volumen-1440.jpg`) | — | − | P1 | D-11 | — |
| 11 | Texto copiado (masa ↔ volumen) | «{kg} kg = {L} L; densidad {rho sin formato} kg/L; base **observed**. Cálculo auxiliar CrewFlex 1.0.0.»: id en crudo, densidad sin formato (`Toolbox.jsx:53`; hallazgo §3 #8). Portapapeles en ejecución: «800 kg = 1000 L; densidad 0.8 kg/L; base observed. Cálculo auxiliar CrewFlex 1.0.0.» | — | ✗ | — | D-11 | Al portar, usar la etiqueta de la base y el número formateado |
| 12 | Planificar: campos | «Cantidad inicial ({m})», «Objetivo final ({m})», «Consumo previsto ({m})» + «Escribe 0 si has confirmado que no hubo consumo.», «Cantidad retirada ({m})» + «Escribe 0 si has confirmado que no hubo retirada.», densidad y bases (`Toolbox.jsx:49-50`). En ejecución: «Cantidad inicial (kg)», «Objetivo final (kg)», «Consumo previsto (kg)», «Cantidad retirada (kg)» más densidad, unidades y bases | — | − | P1 | D-11 | — |
| 13 | Fórmula del plan (`fuelPlan`) | `necesario = objetivo − inicial + consumo + retirada` (kg), cada término ≥ 0. **Exige densidad y bases** aunque solo se quiera la masa (`engine.js:80-85`; hallazgo §4 #4). En ejecución: con masas completas y sin densidad → «Densidad: introduce un valor.» (v2: sin densidad ni bases sale antes «Indica la base de temperatura del volumen y de la densidad.») | — | − | P2 | D-11 | En la revisión D-11, decidir si la masa se calcula sin densidad |
| 14 | Resultado del plan | «Masa adicional calculada» o «Exceso calculado respecto al objetivo» + «Resultado negativo de suministro. No es una instrucción de retirada; revisa objetivo y datos.»; «Volumen equivalente» `{vol,3}`; «A la densidad introducida: {rho,6} kg/L.»; sin copiar (`Toolbox.jsx:53`). En ejecución: 5200 / 12000 / 80 / 0 a 0,8 → «Masa adicional calculada» 6880 kg, «Volumen equivalente» 8600 L; con inicial 13000 → «Exceso calculado respecto al objetivo» 920 kg y el aviso; sin botón de copiar | — | − | P1 | D-11 | — |
| 15 | Conciliar: campos | Inicial, objetivo, «Consumo registrado», retirada, «Indicación final del avión ({m})», «Hora de referencia inicial (opcional)» / «Hora de lectura final (opcional)» (`datetime-local`) + «Usa el mismo intervalo para lecturas, consumo y suministro. Las horas son una anotación local, no ajustan automáticamente el balance.» (`Toolbox.jsx:49`). En ejecución: 2 campos `datetime-local` y la ayuda | — | − | P1 | D-11 | — |
| 16 | Cargas | `fieldset` «Carga {n}»: «Tipo de carga» (Volumen / Masa del comprobante), unidad, cantidad, «Referencia carga {n} (opcional)»; si es volumen, densidad, unidad y 2 bases. «Eliminar carga» con más de una; «Añadir otro suministro» hasta 30. Referencia repetida: «Comprobante repetido: {ref}» (`Toolbox.jsx:36,50`; `engine.js:88-93`). En ejecución: «Comprobante repetido: EJEMPLO»; con 2 cargas, 2 botones «Eliminar carga» | — | − | P1 | D-11 | — |
| 17 | Error de una carga de volumen | Usa la etiqueta «Valor» sin número de carga; las de masa dicen «Carga n» (`engine.js:92`; hallazgo §4 #2). En ejecución: carga 2 de masa vacía → «Carga 2: introduce un valor.»; de volumen → «Valor: introduce un valor.» | — | ✗ | — | D-11 | Al portar, nombrar la carga en todos los errores |
| 18 | Fórmulas del balance (`fuelBalance`) | `esperado = inicial + Σsuministrado − consumo − retirada`; si < 0, «Consumo y retirada superan el combustible disponible según los datos.»; `Δ = indicado − esperado`; `Δobj = indicado − objetivo`; `% = Δ/esperado·100` (nulo si esperado = 0) (`engine.js:86-101`). En ejecución, con el ejemplo: esperado 11.920 kg, Δ -40 kg, Δobj -120 kg, -0,336 % | — | − | P1 | D-11 | — |
| 19 | Unidad de masa «lb» en conciliar | Se puede elegir lb, pero todo el resultado sale en kg (`Toolbox.jsx:53`; hallazgo §3 #9). En ejecución: con «lb», «Inicial 2358,68 kg», «Esperado 9122,393 kg», «Objetivo 5443,108 kg»: todo en kg | — | ✗ | — | D-11 | Al portar, mostrar en la unidad elegida o quitar lb |
| 20 | Resultado del balance | «Diferencia de balance · indicado − esperado» `{+}{Δ,3}` kg; líneas Inicial, Suministrado, Consumo, Retirado, Esperado, Indicado y Objetivo; «Diferencia frente al objetivo»; «{%,3} % de la cantidad esperada (balance).» / «Porcentaje no definido con esperado cero.». En ejecución, igual (`evidencias/xhigh/40/TOOL04-4-v18-conciliar-ejemplo-1440.jpg`) | — | − | P1 | D-11 | — |
| 21 | Texto copiado (balance) | «Esperado {e} kg; indicado {i} kg; diferencia de balance {Δ} kg; diferencia frente al objetivo {Δo} kg. CrewFlex 1.0.0, cálculo auxiliar; comparar con procedimiento aplicable.», con *floats* sin formato (`Toolbox.jsx:53`). Portapapeles en ejecución: «Esperado 11920 kg; indicado 11880 kg; diferencia de balance -40 kg; diferencia frente al objetivo -120 kg. CrewFlex 1.0.0, cálculo auxiliar; comparar con procedimiento aplicable.» | — | ✗ | — | D-11 | Al portar, formatear los números |
| 22 | Panel lateral sin resultado | «Pendiente de datos» «—»; «Dos comparaciones distintas»: «El balance contrasta lo suministrado con la indicación. El objetivo contrasta esa indicación con la cantidad requerida.»; «Cargar ejemplo de formación ›». En ejecución, igual | — | − | P2 | D-11 | — |
| 23 | Ejemplo de formación (balance) | kg: inicial 5200, objetivo 12000, consumo 80, retirada 0, indicado 11880; carga de 8500 L a 0,800 kg/L, base `observed`, ref. «EJEMPLO». Resultado: esperado 11 920 kg, Δ −40 kg, Δobj −120 kg, −0,336 % (`Toolbox.jsx:43`). En ejecución, el mismo resultado | — | − | P2 | D-11 | Usarlo como caso de aceptación |
| 24 | Referencias del combustible | «Masa = volumen × densidad. Suministro previsto = objetivo − inicial + consumo + retirada. Balance = inicial + suministrado − consumo − retirada. Diferencia = indicado − esperado.» + «Sin corrección térmica automática, tolerancia universal, reparto por tanques ni cálculo de reservas. No determina despacho ni diagnostica fugas. No se guardan estos valores al salir de la herramienta.» + enlace «Airbus Safety First · fundamento de la conciliación» + nota del motor y NIST (`Toolbox.jsx:52`). En ejecución, igual (textos y enlace) | — | − | P2 | D-11 | — |
| 25 | Pie | «Cantidad calculada e indicación son datos distintos. Compara la diferencia con el procedimiento vigente del operador; esta herramienta no emite «apto para vuelo».». En ejecución, igual | — | − | P2 | D-11 | — |
| 26 | Hoja: cabecera y barra | Plane + «Hoja de combustible · escala» / «Llegada → requerido → suministro → comprobación final»; «Cargar ejemplo de formación»; «Vaciar hoja»; aviso «Datos ficticios de formación. Vacía la hoja para una nueva operación.» (`FuelSheet.jsx:20`). En ejecución, igual | — | − | P1 | D-11 | — |
| 27 | Hoja: densidad de referencia | «Unidades siempre a la vista» + «Introduce cada cantidad en kg o L. La otra unidad se calcula sin redondeos intermedios.»; «Densidad de referencia»; «Unidad de densidad»: «kg/L · densidad» / «L/kg · volumen específico» (convierte a 1/x); «Base de las equivalencias» (3 opciones); casilla «He comprobado la base y la densidad para estas equivalencias.»; par «{d,6} kg/L · {1/d,6} L/kg»; ayuda (`FuelSheet.jsx:12,20`). En ejecución: 0,8 → «0,8 kg/L · 1,25 L/kg»; al pasar a L/kg el campo muestra «1.25» y al volver, «0.8» | — | − | P1 | D-11 | — |
| 28 | `Quantity` (kg/L) | Campo + «Unidad de entrada · {label}» (kg/L); eco «{kg,2} kg ≈ {L,2} L» o «— kg ≈ — L» (`FuelSheet.jsx:9`). En ejecución, sin datos: «— kg ≈ — L» | — | − | P1 | D-11 | — |
| 29 | Cambio kg ↔ L con datos inválidos | El valor escrito se borra (`FuelSheet.jsx:9`; hallazgo §3 #12). En ejecución: 100 kg sin densidad ni base y cambio a L → campo vacío | — | ✗ | — | D-11 | Al portar, conservar el valor |
| 30 | Hoja: pasos 1-3 | «1 · Llegada y requerido» (4 cantidades + «Introduce 0 en consumo o retirada únicamente si has confirmado que no los hubo.»). «2 · Combustible repostado»: «Suministro {n}» con «Densidad del suministro {n} (kg/L)», «Repostado {n}» (L), «Eliminar suministro {n}», «Otro suministro» hasta 30. «3 · Lectura final del avión»: «Combustible indicado al terminar» (`FuelSheet.jsx:21-23`). En ejecución, igual | — | − | P1 | D-11 | — |
| 31 | «Comparar cantidades» | Envía; sin confirmar: «Confirma las condiciones de la densidad de referencia.» (`FuelSheet.jsx:16,23`). En ejecución: «Confirma las condiciones de la densidad de referencia.» | — | − | P1 | D-11 | — |
| 32 | Errores de la hoja | El plan nunca muestra su error: solo «Completa los datos de llegada y requerido, y confirma la densidad.». Los campos vacíos dicen «Valor: introduce un valor.» sin nombrar el campo. El aviso 0,6–1,1 no aparece (`FuelSheet.jsx:15`; hallazgo §3 #12). En ejecución: con densidad, base y confirmación pero cantidades vacías → «Valor: introduce un valor.»; el panel del plan solo dice «Completa los datos de llegada y requerido, y confirma la densidad.» | — | ✗ | — | D-11 | Al portar, mostrar el error concreto y el aviso |
| 33 | Panel «Plan de suministro total» | «Necesidad calculada» / «Exceso sobre el objetivo» + «No constituye una instrucción de retirada.» (ejemplo: 6880 kg ≈ 8600 L). En ejecución, con el ejemplo: «Necesidad calculada 6880 kg ≈ 8600 L» (`evidencias/xhigh/40/TOOL04-2-v18-hoja-ejemplo-1440.jpg`) | — | − | P1 | D-11 | — |
| 34 | Panel «Resumen · kg y L» | Llegada, Requerido, Consumo, Retirada, Indicado final, «Total suministrado», «Esperado por balance»; «Diferencias»: «Indicado − esperado», «Indicado − requerido»; pie «Litros equivalentes a la densidad de referencia. Balance en kg = llegada + repostado − consumo − retirada. Compara con el procedimiento aplicable; no determina aptitud para vuelo.» (`FuelSheet.jsx:23`). En ejecución, con el ejemplo: «Llegada 5200 kg ≈ 6500 L» … «Indicado − esperado -40 kg ≈ -50 L», «Indicado − requerido -120 kg ≈ -150 L» | — | − | P1 | D-11 | — |
| 35 | Exportación CSV | «Exportar balance CSV» → `CrewFlex-combustible.csv`, `text/csv;charset=utf-8`, BOM, `;`, CRLF, todo entre comillas. Filas: «Cálculo auxiliar; litros equivalentes a densidad de referencia» / «Densidad kg/L» d / «Base» / «Concepto»,«kg»,«L equivalentes» / Llegada, Requerido, Repostado, Consumo, Retirado, Esperado, Indicado, Diferencia_balance, Diferencia_objetivo / «Suministros originales»,«Cantidad»,«Unidad»,«Densidad kg/L» / una por suministro (`FuelSheet.jsx:23`; `progress.js:36-37`). En ejecución: descarga `CrewFlex-combustible.csv` con BOM `EF BB BF`, CRLF, `;` y todo entre comillas (`evidencias/xhigh/40/TOOL04-35-v18-CrewFlex-combustible.csv`) | — | − | P2 | D-11 | Portar con D-11 (V18-42 keep-original) |
| 36 | Antiinyección del CSV | Antepone «' » (apóstrofo y espacio) a todo valor que empiece por `= + @ -`: «Diferencia_balance» −40 sale `' -40` y deja de ser número (`progress.js:36`; `raw/demo/fuel-balance.csv`: `"' -40";"' -50"`, `"' -120";"' -150"`). En ejecución, mismo CSV: `"Diferencia_balance";"' -40";"' -50"` | — | ✗ | — | D-11 | Al portar, no tocar números negativos válidos; solo neutralizar texto |
| 37 | Columna «Base» del CSV | Id en crudo `observed` / `reference15`. En ejecución: `"Base";"observed"` | — | ✗ | — | D-11 | Exportar la etiqueta |
| 38 | Números del CSV | `Number` de JS con punto decimal («0.8», sin redondear) y separador `;` (Excel en español lo lee como texto). En ejecución: `"Densidad kg/L";"0.8"` | — | ✗ | P3 | D-11 | Formato estable y documentado |
| 39 | Otras exportaciones (JSON/TXT) | Ninguna en herramientas (solo CSV de combustible y portapapeles) | Ninguna | = | — | — | — |

Capturas: v1.8 `evidencias/shots/demo/D-TOOL-03-combustible-1440.png`, `evidencias/shots/demo/D-TOOL-03b-combustible-ejemplo-1440.png`,
`evidencias/shots/demo/D-TOOL-03c-combustible-masa-volumen-1440.png`, `evidencias/shots/demo/D-TOOL-03d-combustible-masa-volumen-ok-1440.png`,
`evidencias/shots/demo/D-TOOL-03e-combustible-planificar-1440.png`, `evidencias/shots/demo/D-TOOL-03f-combustible-conciliar-1440.png`,
`evidencias/shots/demo/D-TOOL-03g-combustible-plan-resultado-1440.png`, `evidencias/shots/connected/C-TEC-40-tool-combustible-1440.png`;
CSV en `raw/demo/fuel-balance.csv`. Next: —. Ejecución v2 de la v1.8: `evidencias/v2/40/TOOL04-{1-v18-hoja,2-v18-hoja-ejemplo,3-v18-masa-volumen,4-v18-conciliar-ejemplo}-1440.jpg`,
`evidencias/v2/40/TOOL04-35-v18-CrewFlex-combustible.csv`; textos y portapapeles en `evidencias/v2/40/v2-v18-views.json`. Ejecución xhigh de la v1.8 (22/10): `evidencias/xhigh/40/TOOL04-1-v18-hoja-1440.jpg`,
`evidencias/xhigh/40/TOOL04-2-v18-hoja-ejemplo-1440.jpg`, `evidencias/xhigh/40/TOOL04-3-v18-masa-volumen-1440.jpg`,
`evidencias/xhigh/40/TOOL04-4-v18-conciliar-ejemplo-1440.jpg`, `evidencias/xhigh/40/TOOL04-5-v18-aviso-ejemplo-masa-volumen-1440.jpg`,
`evidencias/xhigh/40/TOOL04-35-v18-CrewFlex-combustible.csv`; datos `evidencias/xhigh/40/runtime-ui-v18-other.json`.

---

## TOOL-05 · Inglés y siglas (diccionario, ATA, práctica) — v1.8 `S-TOOL-07, S-TOOL-07a/b/c, S-MOD-TOOL-02, D-TOOL-05` ↔ Next `—`

**Estado global:** IGUAL salvo matices (F3: antes AUSENTE EN NEXT). Portado en `558654f` (L-1): `/app/tools/knowledge` y
`/tools/knowledge` (T-145), banco de 102 términos, 46 capítulos y 4 fuentes como dato editorial (`knowledge/data.ts`,
2026-10-13.1), búsqueda sin acentos y con recorte, índice ATA sin acentos y con estado vacío, «Copiar ficha», panel vacío
sin la promesa de «términos confundibles», práctica de 21 tarjetas. Las 4 `✗` de v1.8 quedan corregidas (#9, #10, #14) o
copiadas tal cual con su aviso (#12). Verificado en `PKG P08 2` y 28b/28c. Texto de la v2: portable desde SCOPE-2
(owner, 22/10; `08-product-decisions.md:69`, commit `038329f`, posterior al SNAP): «glossary/ATA» está en LATER
(V1_SCOPE:60) y LATER ya no bloquea (TD-84). v2: verificado
otra vez en la v1.8 demo; en el SNAP no hay nada (búsqueda de «glossary», «glosario», «knowledge» y «ATA» en `src`,
`messages` y `supabase`).

Next solo tiene un glosario documental para traducir la interfaz (`docs/product/AVIATION_GLOSSARY_ES_EN.md`, 61
líneas), no visible para el usuario.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Tarjeta y vista | «Inglés y siglas» → `Knowledge` (`Toolbox.jsx:56-63`). En ejecución, la tarjeta abre la vista (`evidencias/xhigh/40/TOOL05-1-v18-diccionario-1440.jpg`) | «Inglés y siglas» → `/app/tools/knowledge` (`src/app/app/tools/knowledge/page.tsx`, `src/features/tools/components/KnowledgeTool.tsx`; `558654f`) y en público `/tools/knowledge` (T-145). Un solo h1 (`ToolScreen`). En ejecución, `PKG P08 2` y 28b | = (F3: antes −) | — | — | — (L-1 hecho) |
| 2 | Pestañas | «Diccionario ES / EN» (defecto), «Índice ATA», «Práctica breve»; al cambiar se pierde la selección y se conserva la búsqueda (`Toolbox.jsx:59`). En ejecución: «Diccionario ES / EN» con `aria-pressed="true"`; al pasar a ATA la búsqueda «ensure» se conserva | «Diccionario ES / EN» (defecto) · «Índice ATA» · «Práctica breve» con `aria-pressed` (`PressedGroup`, `parts.tsx:146-176`; es:1697-1702); al cambiar se pierde la selección y se conserva la búsqueda (`KnowledgeTool.tsx:44-57`). En ejecución, `PKG P08 2`: «zzzz» sigue en el buscador al pasar a ATA | = (F3: antes −) | — | — | — |
| 3 | Contador | «102 entradas · 46 capítulos de referencia» (`Toolbox.jsx:59`). En ejecución, igual | «{entries} entradas · {chapters} capítulos de referencia» → «102 entradas · 46 capítulos de referencia» (es:1703; `KnowledgeTool.tsx:54-56`). En ejecución, `PKG P08 2` | = (F3: antes −) | — | — | — |
| 4 | Buscador | `aria-label` «Buscar término, sigla o ATA»; placeholder «Término, sigla o significado: torque, holgura, AMM…» o, en ATA, «Número o sistema: 28, combustible…» (`Toolbox.jsx:60`). En ejecución, los dos placeholders | `aria-label` «Buscar término, sigla o ATA»; placeholders «Término, sigla o significado: torque, holgura, AMM…» / «Número o sistema: 28, combustible…» (es:1704-1706; `KnowledgeTool.tsx:97-107`). En ejecución, los dos (`PKG P08 2`) | = (F3: antes −) | — | — | — |
| 5 | «Área del diccionario» | «Todos» + 13 grupos en orden de aparición: Mecánica, Verbos, Dirección, Electricidad, Fluidos, Estado, Estructuras, Materiales, Inspección, Combustible, Medición, Documentación, Siglas. En ejecución: «Todos» y los 13 grupos en ese orden | «Área del diccionario»: «Todos» + los 13 grupos en orden de aparición (`KNOWLEDGE_GROUPS`, `data.ts:791`; es:1707-1708). En ejecución, `PKG P08 2`: Todos · Mecánica · Verbos · Dirección · Electricidad · Fluidos · Estado · Estructuras · Materiales · Inspección · Combustible · Medición · Documentación · Siglas | = (F3: antes −) | — | — | — |
| 6 | `searchKnowledge` | Normaliza (NFD, sin diacríticos, minúsculas, **sin trim**). Busca en `término + traducción + definición`, no en los ejemplos. Sin ranking ni límite; consulta vacía → todo el grupo (`knowledge.js:116`). En ejecución: «torque» → 1 entrada; «torque » con espacio final también, porque el texto buscado une término, traducción y definición con espacios | `searchKnowledge`: NFD, sin diacríticos, minúsculas **y recorte** (`search.ts:5-24`); busca en término + traducción + definición, no en los ejemplos; sin ranking ni límite; vacía → todo el grupo. Tests `search.test.ts` (9). En ejecución, « TORQUE » → Torque (`PKG P08 2`, 28b con « amm ») | ≈ (F3: antes −) | P3 | — | Mantener (recorte añadido) |
| 7 | Lista de resultados | Botón «término / traducción ›»; clase `active`; vacío: «No hay entradas para esta búsqueda. Prueba el término inglés o una sigla.». En ejecución: «zzzz» → ese mensaje | Botón «término / traducción ›» con `aria-pressed` (`Dictionary`, `KnowledgeTool.tsx:196-247`); vacío `role="status"`: «No hay entradas para esta búsqueda. Prueba el término inglés o una sigla.» (es:1710). En ejecución, «zzzz» → ese mensaje (`PKG P08 2`) | = (F3: antes −) | — | — | — |
| 8 | Ficha seleccionada | Kicker con el grupo; h2 término; h3 traducción; definición; cita con ejemplo EN/ES; «Referencia editorial inicial · 2026-10-13.1». En ejecución, AMM: «Siglas», «AMM», «Aircraft Maintenance Manual», definición y «Referencia editorial inicial · 2026-10-13.1» | Kicker con el grupo; h2 término; h3 traducción; definición; cita EN/ES si hay ejemplo; «Referencia editorial inicial · 2026-10-13.1» (`EntryDetail`, `KnowledgeTool.tsx:249-306`; es:1712). En ejecución, Torque: «Mecánica», «Torque», «Par de apriete», la versión (`PKG P08 2`); AMM en 28b | = (F3: antes −) | — | — | — |
| 9 | Copiar ficha | Copia «{term} — {translation}. {definition} · CrewFlex, referencia editorial 2026-10-13.1», pero el botón dice «Copiar con unidades» (`Toolbox.jsx:61`; hallazgo §3 #7). En ejecución: el botón dice «Copiar con unidades» y el portapapeles recibe «AMM — Aircraft Maintenance Manual. Manual de mantenimiento de aeronave. Revisar tarea, revisión y aplicabilidad. · CrewFlex, referencia editorial 2026-10-13.1» | Botón «Copiar ficha» (es:1713); copia «{term} — {translation}. {definition} · CrewFlex, referencia editorial 2026-10-13.1» (es:1714), el mismo texto que v1.8. En ejecución, `PKG P08 2`: «Copiar ficha» y ningún «Copiar con unidades» | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige el rótulo de v1.8) |
| 10 | Panel sin selección | «El significado depende del contexto.» + «Selecciona una entrada para ver definición, ejemplos y **términos confundibles**…» (no existe ese campo) + «El índice ATA es navegación de referencia, no contiene tareas ni sustituye el índice del manual aplicable.» (hallazgo §3 #5). En ejecución, igual | «El significado depende del contexto.» + «Selecciona una entrada para ver su definición y sus ejemplos. Las siglas pueden tener más de una acepción.» + el aviso del índice ATA (es:1715-1717): sin la promesa de «términos confundibles» | ≠ (F3: antes ✗) | P3 | — | Mantener (quita la promesa sin campo) |
| 11 | Banco de términos | 102 entradas `{id:'term-n', term, translation, group, definition, example, exampleEs, status:'Referencia editorial inicial', version:'2026-10-13.1'}`. Por grupo: Siglas 38, Mecánica 11, Verbos 10, Fluidos 7, Electricidad 6, Inspección 6, Documentación 6, Combustible 5, Medición 4, Estructuras 3, Dirección 2, Estado 2, Materiales 2. Con ejemplo: 21 (`knowledge.js:10-113`). En ejecución: 102 entradas en «Todos»; reparto por grupo recontado en el código | 102 entradas como dato editorial versionado (`src/features/tools/knowledge/data.ts`, `KNOWLEDGE_VERSION` 2026-10-13.1, no catálogo i18n; mismos ids `term-n`, términos, traducciones, grupos, definiciones y 21 ejemplos). Reparto: Inglés 64 + Siglas 38 fijado en `questions.test.ts`; 102 en pantalla (`PKG P08 2`, 28b) | = (F3: antes −) | — | — | — (dato editorial, como pedía la fila) |
| 12 | Calidad del contenido | El ejemplo de «Ensure» no usa el término; FO = «First Officer / Fuel Oil según contexto»; la ficha CB aclara que no autoriza el reset (`knowledge.js:20,95,108`; hallazgo §4 #5). En ejecución, la ficha de Ensure muestra «Make sure the record is complete.» | El mismo contenido, copiado tal cual (`data.ts:118-121` Ensure, `:662-665` FO, `:745-748` CB), con el aviso «pendiente de revisión formal» en «Fuentes y revisión editorial» (es:1723) | ≈ (F3: antes ✗; defecto editorial de v1.8 copiado tal cual) | P3 | — | Revisión editorial del banco (versión nueva de `KNOWLEDGE_VERSION`); no bloquea |
| 13 | Índice ATA | 46 capítulos: 00, 05-12, 20-36, 38, 49, 51-57, 70-80. Faltan 01-04, 18, 37, 39-48, 50, 60-67 y 81 en adelante (`knowledge.js:115`). En ejecución: 46 chips con esos códigos | Los mismos 46 capítulos (`ATA`, `data.ts:797`). En ejecución: «28» → «28 Combustible», «hidraulica» → «29 Energía hidráulica» (`PKG P08 2`) | = (F3: antes −) | — | — | — |
| 14 | Filtro ATA | `includes` en minúsculas **sin quitar acentos** («hidraulica» no encuentra «hidráulica»), sin estado vacío (hallazgo §3 #6). En ejecución: «hidraulica» → 0 chips y ningún mensaje; «hidráulica» → «29 Energía hidráulica» | `filterAta` normaliza sin acentos (`search.ts:27-29`) y hay estado vacío `role="status"`: «Ningún capítulo coincide con esta búsqueda. Prueba el número o el nombre del sistema.» (es:1711). En ejecución, «hidraulica» → 29 y «zzzz» → el vacío (`PKG P08 2`, 28c) | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 15 | Práctica breve | 21 tarjetas cíclicas; GraduationCap; «INGLÉS TÉCNICO · {k}/21»; término + ejemplo EN; «Mostrar significado» → traducción, ejemplo ES y definición; «Siguiente término»; pie «Ejemplos originales de lenguaje; no son instrucciones para una tarea concreta.». En ejecución: «INGLÉS TÉCNICO · 1/21», Torque y «Read the specified torque.»; «Mostrar significado» → Par de apriete, ejemplo en español y definición; «Siguiente término» → 2/21 (`evidencias/xhigh/40/TOOL05-2-v18-practica-1440.jpg`) | 21 tarjetas cíclicas (`PRACTICE_CARDS`, `data.ts:794`); «INGLÉS TÉCNICO · {k}/21», término + ejemplo EN, «Mostrar significado» → traducción, ejemplo ES y definición, «Siguiente término», pie «Ejemplos originales de lenguaje; no son instrucciones para una tarea concreta.» (`KnowledgeTool.tsx:59-95`, es:1718-1721). En ejecución, 1/21 → 2/21 (`PKG P08 2`) | = (F3: antes −) | — | — | — |
| 16 | «Fuentes y revisión editorial» | «Definiciones breves originales. Catálogo inicial 2026-10-13.1; pendiente de revisión formal por operador antes de integrarlo en documentación controlada. No reproduce manuales ni el diccionario completo de STE. No incluye procedimientos de reset.» + 4 enlaces: FAA · Aviation Maintenance Technician Handbooks; ASD-STE100 · Inglés técnico simplificado; ATA · Estándares de documentación; EASA · Part-145 (`knowledge.js:3-8`, `Toolbox.jsx:62`). En ejecución, el texto y los 4 enlaces con esas URL | `<details>` «Fuentes y revisión editorial» con el texto literal y los 4 enlaces (`KNOWLEDGE_SOURCES`, `data.ts:8-18`; es:1722-1723; `target="_blank" rel="noreferrer"`). En ejecución, los 4 con esas URL (`PKG P08 2`) | = (F3: antes −) | — | — | — |

Capturas: v1.8 `evidencias/shots/demo/D-TOOL-05-ingles-1440.png`, `evidencias/shots/demo/D-TOOL-05b-ingles-detalle-1440.png`,
`evidencias/shots/demo/D-TOOL-05c-ingles-ata-1440.png`, `evidencias/shots/demo/D-TOOL-05d-ingles-practica-1440.png`,
`evidencias/shots/connected/C-TEC-40-tool-ingles-1440.png`. Next: —.

---

## TOOL-06 · Traductor — v1.8 `S-TOOL-03, S-MOD-TOOL-03, D-TOOL-06` ↔ Next `—`

**Estado global:** IGUAL salvo matices (F3: antes AUSENTE EN NEXT). Portado en `558654f` (L-2): `/app/tools/translator` y
`/tools/translator` (T-145), una sola h1, EN → ES por defecto, repertorio de 32 filas como dato, intercambio que
conserva el texto, caja de coincidencia sin estilo en línea y el enlace a Google Translate solo tras el consentimiento,
que cualquier cambio retira (default v1.8 documentado como T-166). Verificado en `PKG P08 3` y 28d. Texto de la v2:
portable desde SCOPE-2 (V1_SCOPE:60, TD-85; la decisión abierta V18-41 queda resuelta por SCOPE-2 y DEFAULTS): se porta
el comportamiento v1.8, incluido el enlace a Google Translate tras el consentimiento, como default documentado. v2: verificado otra vez en la v1.8 demo; en el SNAP no hay nada.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Tarjeta y vista | «Traductor» → `Translator` (`Toolbox.jsx:73`). En ejecución, la tarjeta abre la vista (`evidencias/xhigh/40/TOOL06-1-v18-traductor-1440.jpg`) | «Traductor» → `/app/tools/translator` (`src/app/app/tools/translator/page.tsx`, `TranslatorTool.tsx`; `558654f`) y en público `/tools/translator` (T-145). En ejecución, `PKG P08 3` y 28d | = (F3: antes −) | — | — | — (L-2 hecho) |
| 2 | Doble cabecera | La cabecera del Toolbox (h1 «Traductor») más la propia (h1 «Traductor de apoyo»): dos h1 (`src/features/Translator.jsx:9`; hallazgo §3 #1). En ejecución: dos h1, «Traductor» y «Traductor de apoyo» | Una sola h1 («Traductor», `ToolScreen`); «Traductor de apoyo» es un h2 (`SectionHead`). En ejecución, `main h1` = 1 (`PKG P08 3`) | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 3 | Cabecera propia | Kicker «IDIOMAS · ES / EN / FR», «Traductor de apoyo», «Repertorio técnico local y acceso a traducción libre con conexión.», icono Languages. En ejecución, igual | «IDIOMAS · ES / EN / FR», «Traductor de apoyo», «Repertorio técnico local y acceso a traducción libre con conexión.», icono Languages (`TranslatorTool.tsx:68-70`, es:1726-1728). En ejecución, igual (`PKG P08 3`) | = (F3: antes −) | — | — | — |
| 4 | Idiomas | «Origen»/«Destino»: `es` «Español», `en` «Inglés», `fr` «Francés»; por defecto EN → ES (`Translator.jsx:6,8`). En ejecución: «en» → «es»; opciones Español, Inglés, Francés | «Origen»/«Destino» con Español, Inglés, Francés; por defecto EN → ES (`TranslatorTool.tsx:32-33`, es:1729-1734; default v1.8, T-166). En ejecución, `en` → `es` (`PKG P08 3`) | = (F3: antes −) | — | — | — (default v1.8 documentado) |
| 5 | «Intercambiar idiomas» | Intercambia origen y destino. El texto pasa a la traducción si hay coincidencia exacta; si no, **se vacía** (`Translator.jsx:9`; hallazgo §3 #14). En ejecución: «torque» → al intercambiar, origen `es` y texto «Par de apriete»; un texto sin coincidencia se vacía | Intercambia origen y destino; el texto pasa a su equivalente si hay coincidencia exacta y, si no, **se conserva** (`swappedText`, `phrases.ts:68-72`). En ejecución, «fuel» → «Combustible» y «xyz» sigue «xyz» (`PKG P08 3`) | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 6 | Campo de texto | «Texto o término», `textarea` de 5 filas, `maxLength=2000`, placeholder «Torque, fuel, maintenance…»; contador «{n}/2000 caracteres · no se guarda el texto.». En ejecución: 5 filas, `maxLength` 2000, el placeholder y «6/2000 caracteres · no se guarda el texto.» | «Texto o término», `textarea` de 5 filas, `maxLength` 2000, placeholder «Torque, fuel, maintenance…», contador «{n}/2000 caracteres · no se guarda el texto.» (`TranslatorTool.tsx:80-96`, es:1737-1739). En ejecución, `rows=5`, `maxlength=2000`, «0/2000 caracteres · no se guarda el texto.» (`PKG P08 3`) | = (F3: antes −) | — | — | — |
| 7 | Coincidencia exacta | Normaliza (NFD, sin diacríticos, minúsculas, trim) en el idioma de origen → caja «Equivalencia del repertorio local» con h2 (`style={{color:'white'}}` en línea). Sin coincidencia: «Sin coincidencia exacta local. Puedes consultar las sugerencias o abrir la traducción libre externa.». En ejecución: «torque» → «Equivalencia del repertorio local · Par de apriete» con `style="color: white;"`; sin coincidencia, el texto indicado | `exactPhrase` normaliza (NFD, sin diacríticos, minúsculas, recorte) en el idioma de origen (`phrases.ts:56-57`) → caja «Equivalencia del repertorio local» con clases (`bg-tool-result text-white`, sin estilo en línea; `TranslatorTool.tsx:98-109`). Sin coincidencia: «Sin coincidencia exacta local. Puedes consultar las sugerencias o abrir la traducción libre externa.» (es:1740-1741). En ejecución, «fuel» → «Combustible»; «xyz» → el aviso (`PKG P08 3`) | ≈ (F3: antes −) | P3 | — | Mantener (sin estilo en línea, como pedía la fila) |
| 8 | Traducción externa (Google) | `<details>` «Traducir texto libre con Google Translate»: «Necesita Internet. Al abrir el enlace se enviará el texto escrito a Google. No introduzcas datos personales, documentos internos ni contenido de manuales sin autorización.». Casilla «Quiero enviar este texto a Google para traducirlo.», que se desmarca al cambiar origen, destino, texto, intercambio o sugerencia. «Abrir traducción externa ↗» solo si hay consentimiento, texto y `from≠to`: `https://translate.google.com/?sl=…&tl=…&text=…&op=translate`, `_blank`, `noreferrer`. Si no: «Introduce texto, elige idiomas distintos y confirma el envío.». En ejecución: sin consentimiento, «Introduce texto, elige idiomas distintos y confirma el envío.»; con él, `https://translate.google.com/?sl=en&tl=es&text=Fuel&op=translate`, `_blank`, `noreferrer`; al editar el texto la casilla se desmarca | `<details>` «Traducir texto libre con Google Translate» con el aviso literal; casilla «Quiero enviar este texto a Google para traducirlo.», que se desmarca con cualquier cambio (`update`, `TranslatorTool.tsx:38-44`); «Abrir traducción externa ↗» solo con consentimiento, texto y `from≠to` (`canOpenExternal`, `phrases.ts:79-84`): `https://translate.google.com/?sl=…&tl=…&text=…&op=translate`, `_blank`, `noreferrer` (`phrases.ts:75-76`); si no, «Introduce texto, elige idiomas distintos y confirma el envío.» (es:1742-1747). En ejecución: sin casilla no hay enlace; con ella `sl=en&tl=es&text=xyz`; al editar se desmarca y el enlace desaparece; ninguna petición a Google (`PKG P08 3`, 28d) | = (F3: antes −) | — | — | — (default v1.8 documentado, T-166; el enlace nunca se sigue) |
| 9 | Repertorio sin conexión | «Repertorio sin conexión» + «32 términos y frases originales de apoyo. No es un traductor automático completo.». 32 filas ES/EN/FR: 29 términos + 3 frases (`Translator.jsx:4`). En ejecución: 32 sugerencias y ese texto | «Repertorio sin conexión» + «32 términos y frases originales de apoyo. No es un traductor automático completo.» (es:1748-1749); 32 filas ES/EN/FR como dato (`PHRASES`, `phrases.ts:5-47`; test `phrases.test.ts`). En ejecución, 32 sugerencias (`PKG P08 3`) | = (F3: antes −) | — | — | — (dato, como pedía la fila) |
| 10 | Sugerencias | Sin texto, todas. Con texto, filtradas por subcadena **solo en el idioma de origen**. Al pulsar una, su término de origen pasa al campo. Vacío: «No hay sugerencias locales para este texto.». En ejecución: «fu» → Fuel y Fuselage; al pulsar Fuel pasa al campo; sin coincidencias, el mensaje de vacío | Sin texto, todas; con texto, filtradas por subcadena solo en el idioma de origen (`suggestPhrases`, `phrases.ts:60-63`); al pulsar una, su término de origen pasa al campo; vacío «No hay sugerencias locales para este texto.» (es:1750). En ejecución, «fu» → Fuel y Fuselage; «xyz» → el vacío (`PKG P08 3`) | = (F3: antes −) | — | — | — |
| 11 | Pie | «El significado depende del contexto. Traducciones de apoyo pendientes de revisión editorial; no sustituyen instrucciones de mantenimiento controladas.». En ejecución, igual | Idéntico (`Footnote`, es:1751). En ejecución, `PKG P08 3` | = (F3: antes −) | — | — | — |
| 12 | Privacidad y red | Nada se guarda; sin `fetch`; solo el enlace externo tras dar consentimiento | Nada se guarda, ningún `fetch`; solo el enlace externo tras el consentimiento. En ejecución, `hosts` sin Google (`PKG P08 3`); la CSP no cambia (`PKG shell-visual 12`) | = (F3: antes −) | — | — | — |

Capturas: v1.8 `evidencias/shots/demo/D-TOOL-06-traductor-1440.png`, `evidencias/shots/connected/C-TEC-40-tool-traductor-1440.png`.
Next: —.

---

## TOOL-07 · Reto diario y aprendizaje — v1.8 `S-TOOL-02, S-COM-02, S-MOD-TOOL-04, D-TOOL-07, D-GEN-02` ↔ Next `—`

**Estado global:** IGUAL salvo matices (F3: antes AUSENTE EN NEXT). Portado en `558654f` (L-3): `/app/tools/daily` tras
sesión, selección diaria pura con paridad fijada para 3 fechas (`src/domain/learning.ts`, BR-16), día de Madrid, rachas,
medallas con un solo juego de nombres, progreso en `localStorage` por id de usuario con solo ids y respuestas, una sola
h1, título que sigue al número y aviso del reto sin terminar. Las 6 `✗` de v1.8 quedan corregidas o, en #14, copiadas
(mismo banco). Verificado en `PKG P08 4/5/8` y 28e. Texto de la v2: portable desde SCOPE-2 («daily challenge» en LATER,
V1_SCOPE:60; TD-86/87, M16; V18-40). v2: verificado otra vez en la v1.8 demo y, para las entradas y el progreso por identidad, en la v1.8 conectada.

Las dos decisiones que quedaban se resuelven con el default v1.8 (regla DEFAULTS, `08-product-decisions.md:70`),
documentado y reversible:
- día de referencia: v1.8 usa Madrid y Next fija UTC (BR-10, `src/i18n/request.ts:27-29`) → default: el día de
  `Europe/Madrid`, como v1.8 (BR-10 rige las horas operativas, no el reto);
- progreso: v1.8 lo guarda en `localStorage` por identidad → default: `localStorage` con el id del usuario autenticado
  (sin el `guest` compartido de la fila 18).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entradas | Tarjeta «Reto diario» y entrada lateral «Reto diario» `#learning` (todos los roles de la demo, `src/LegacyApp.jsx:43`). En conectado, solo la tarjeta. En ejecución: `#learning` abre la vista (h1 «Tu reto aeronáutico»). Conectado en ejecución v2 (`qa.tecnico1`): el lateral no tiene «Reto diario»; sí la tarjeta | Tarjeta «Reto diario» → `/app/tools/daily` (`src/app/app/tools/daily/page.tsx`, `DailyChallenge.tsx`; `558654f`); sin entrada lateral, como la v1.8 conectada; sin ruta pública (T-145: `/tools/daily` → 404, `PKG P08 7`). En ejecución, `PKG P08 0b/4` y 28e | ≈ (F3: antes −) | P3 | — | Mantener (L-3 hecho; la entrada lateral era solo demo) |
| 2 | Doble cabecera dentro del Toolbox | h1 «Reto diario» y h1 «Tu reto aeronáutico» (`Toolbox.jsx:73`, `DailyLearning.jsx:15`; hallazgo §3 #1). En ejecución, dentro de herramientas: h1 «Reto diario» y h1 «Tu reto aeronáutico» | Una sola h1 («Reto diario», `ToolsHeader`); «Tu reto aeronáutico» es un h2 (`SectionHead`). En ejecución, `main h1` = 1 (`PKG P08 4`) | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 3 | Cabecera propia | «APRENDE UN POCO CADA DÍA» · «Tu reto aeronáutico» · «Fundamentos, inglés, siglas y sistemas ATA · {YYYY-MM-DD} · día de referencia: Madrid». Fecha `today()` en `Europe/Madrid`, que se recalcula cada 30 s y al recibir `focus` (`DailyLearning.jsx:9,15`). En ejecución: «Fundamentos, inglés, siglas y sistemas ATA · 2026-10-22 · día de referencia: Madrid» | «APRENDE UN POCO CADA DÍA» · «Tu reto aeronáutico» · «Fundamentos, inglés, siglas y sistemas ATA · {date} · día de referencia: Madrid» (es:1754-1756). Día de `Europe/Madrid` (`madridDay`, `src/domain/learning.ts:97-101`; BR-16; default v1.8, T-166), releído cada 30 s y al recibir `focus` (`useLearningProgress.ts:26-34`). La fecha sale con `formatDate` («27 oct 2026»), no en ISO. En ejecución, `PKG P08 4` | ≈ (F3: antes −) | P3 | — | Mantener (fecha en el formato del idioma) |
| 4 | Métricas | «Racha actual» y «Mejor racha» («{n} día» / «{n} días»), «Días completados» (`DailyLearning.jsx:15`). En ejecución: «0 días» al empezar y «1 día» tras completar | «Racha actual», «Mejor racha» con plural ICU «{n} día / días» y «Días completados» (`Metric`, `DailyChallenge.tsx:95-99`; es:1757-1760). En ejecución: «0 días» al empezar y «1 día» tras completar (`PKG P08 4`) | = (F3: antes −) | — | — | — (plural ICU, como pedía la fila) |
| 5 | Pantalla inicial | h2 «Cinco minutos para ti»; «Elige 5 o 10 preguntas. Recibirás una explicación después de cada respuesta. El reto cambia cada día.»; «5 preguntas» (defecto) / «10 preguntas» con `aria-pressed`; «Comenzar reto de hoy». En ejecución, igual | h2 «Cinco minutos para ti»; el texto literal; «5 preguntas» (defecto) / «10 preguntas» con `aria-pressed` (`PressedGroup`); «Comenzar reto de hoy» (`DailyChallenge.tsx:102-128`, es:1761-1768). En ejecución, `PKG P08 4` | = (F3: antes −) | — | — | — |
| 6 | «Cinco minutos» con 10 preguntas | El h2 no cambia al elegir 10 (hallazgo §3 #15). En ejecución: con «10 preguntas» pulsado sigue «Cinco minutos para ti» | El h2 sigue al número: «Cinco minutos para ti» / «Diez minutos para ti» (`introTitle.{5,10}`, es:1761-1764). En ejecución, `PKG P08 4` | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 7 | Pregunta en curso | «{grupo} · Pregunta {i} de {N}»; `<progress aria-label="Progreso del reto">`; h2 enunciado; 4 opciones con `aria-pressed`; «Confirmar respuesta», deshabilitado sin selección. En ejecución: «Fundamentos · Pregunta 1 de 5», `aria-label="Progreso del reto"`, 4 opciones y «Confirmar respuesta» deshabilitado sin selección (`evidencias/xhigh/40/TOOL07-1-v18-reto-pregunta-1440.jpg`) | «{grupo} · Pregunta {i} de {N}»; `<progress aria-label="Progreso del reto">`; h2 enunciado; 4 opciones con `aria-pressed` en un `role="group"` «Respuestas»; «Confirmar respuesta» deshabilitado sin selección (`DailyChallenge.tsx:168-213`, es:1770-1773). En ejecución: «Fundamentos · Pregunta 1 de 5», 4 opciones, botón deshabilitado (`PKG P08 4`) | = (F3: antes −) | — | — | — |
| 8 | Cambio de día al confirmar | Si cambió la fecha, descarta la respuesta sin avisar (`DailyLearning.jsx:13`; hallazgo §3 #15) | Si cambió el día al confirmar, la respuesta se descarta y la pantalla vuelve al inicio de hoy con el aviso «El reto del {date} quedó sin terminar, así que no cuenta para tu racha…» (`DailyChallenge.tsx:69-80`, es:1769). No provocable sin cambiar la fecha | ≠ (F3: antes ✗) | P3 | — | Mantener (avisa, como pedía la fila) |
| 9 | Respuesta anterior | `role="status"`: «Respuesta anterior correcta» o «Repaso de la respuesta anterior» + enunciado + «{respuesta}. {explicación}». En ejecución: «Repaso de la respuesta anterior» o «Respuesta anterior correcta» con la explicación | `role="status"`: «Respuesta anterior correcta» / «Repaso de la respuesta anterior» + enunciado + «{respuesta}. {explicación}» (`DailyChallenge.tsx:220-234`, es:1774-1776). En ejecución, tras la primera respuesta (`PKG P08 4`, 28e) | = (F3: antes −) | — | — | — |
| 10 | Reto completado | Award; «Reto completado»; «{score} de {N} respuestas correctas»; «Has sumado un día de aprendizaje. Vuelve mañana para continuar tu racha.»; `<details>` «Revisar respuestas y explicaciones» («Tu respuesta: …», «Respuesta: …», explicación). No se puede repetir. En ejecución: «Reto completado», «1 de 5 respuestas correctas» y la revisión; al volver a abrir, sigue completado (`evidencias/xhigh/40/TOOL07-2-v18-reto-completado-1440.jpg`) | Award; «Reto completado»; «{score} de {N} respuestas correctas»; «Has sumado un día de aprendizaje. Vuelve mañana para continuar tu racha.»; `<details>` «Revisar respuestas y explicaciones» con «Tu respuesta: …» / «Respuesta: …» y la explicación (`DailyChallenge.tsx:130-166`, es:1777-1782). No se repite: al recargar sigue completado (`PKG P08 4`) | = (F3: antes −) | — | — | — |
| 11 | Error al guardar | `role="alert"`: «No se pudo guardar el progreso. Libera espacio o permite almacenamiento y vuelve a intentarlo.» | `role="alert"`: «No se pudo guardar el progreso. Libera espacio o permite almacenamiento y vuelve a intentarlo.» cuando `localStorage.setItem` falla (`useLearningProgress.ts:50-58`, `DailyChallenge.tsx:215-219`, es:1783). No provocable sin bloquear el almacenamiento | = (F3: antes −) | — | — | — |
| 12 | Pie editorial | «Contenido editorial de formación, no examen habilitante. Los logros no acreditan cualificación ni influyen en la selección profesional. No incluye procedimientos ni extractos de AMM/TCM. Catálogo inicial pendiente de revisión formal.». En ejecución, igual | Idéntico (`Footnote`, es:1795). En ejecución, `PKG P08 4` | = (F3: antes −) | — | — | — |
| 13 | Banco de preguntas | **158** = Fundamentos 10 (`fact-0…9`, literales) + Inglés 64 + Siglas 38 («¿Qué significa «{term}» en este contexto?» → traducción, explicación = definición) + ATA 46 («¿Qué sistema identifica ATA {code}?») (`progress.js:13-25`) | 158 = Fundamentos 10 (`fact-0…9`, literales) + Inglés 64 + Siglas 38 («¿Qué significa «{term}» en este contexto?» → traducción, explicación = definición) + ATA 46 («¿Qué sistema identifica ATA {code}?») (`src/features/tools/learning/questions.ts`); test «has 158 questions…» (`questions.test.ts`) | = (F3: antes −) | — | — | — |
| 14 | Calidad del banco | Casi duplicados el mismo día (`fact-1` «¿Qué significa AMM?» y la sigla «AMM»); «en este contexto» sin contexto (hallazgo §4 #5). En ejecución, el reto del 22/10 de 5 preguntas trae a la vez «¿Qué significa «UTC» en este contexto?» (Siglas) y «¿Qué significa UTC?» (Fundamentos) | El mismo banco, con los mismos casi duplicados (`fact-1` y la sigla AMM) y el mismo «en este contexto» (`questions.ts:13-85`) | ≈ (F3: antes ✗; defecto editorial de v1.8 copiado tal cual) | P3 | — | Revisión editorial del banco; no bloquea |
| 15 | Selección diaria | Hash FNV-1a de 32 bits de `fecha+id`. Intercala Fundamentos, ATA, Inglés y Siglas (5: F0 A0 I0 S0 F1; 10: …F2 A2). Las 5 primeras de 10 coinciden con el reto de 5. 3 distractores del mismo grupo; opciones ordenadas por hash (`progress.js:26-32`). En ejecución, orden de grupos del 22/10: Fundamentos, ATA, Inglés, Siglas, Fundamentos | FNV-1a de 32 bits (`fnv1a`), grupos intercalados Fundamentos, ATA, Inglés, Siglas, 3 distractores del mismo grupo y opciones por hash (`src/domain/learning.ts:29-78`, puro). Paridad con `progress.js` fijada para 3 fechas (ids, orden y opciones de las 10; las 5 son las primeras) en `questions.test.ts` con `v18-daily.fixture.json`; el 22/10 da Fundamentos, ATA, Inglés, Siglas, Fundamentos | = (F3: antes −) | — | — | — (algoritmo puro con tests, como pedía la fila) |
| 16 | Rachas (`streak`) | Actual: un día sin completar hoy no rompe la racha hasta mañana. Mejor: secuencia consecutiva más larga. Total: días completados ≤ hoy (`progress.js:33-35`). En ejecución, un reto completado da racha actual 1, mejor 1 y 1 día completado | `streak`: actual (hoy sin completar no rompe hasta mañana), mejor (secuencia más larga) y total (días ≤ hoy) (`learning.ts:110-128`; `src/domain/learning.test.ts`). En ejecución, un reto → 1 / 1 / 1 (`PKG P08 4`) | = (F3: antes −) | — | — | — |
| 17 | Almacenamiento | `crewflex-learning-{profileId \|\| app.profile.id \|\| 'guest'}` → `{fecha:{count:5\|10, questions:[…], answers:[…], complete}}`; válido si `count∈{5,10}` y `answers` es array (`DailyLearning.jsx:7,10-13`; `progress.js:38`). En ejecución: clave `crewflex-learning-tech-me` con `{count, questions, answers, complete}` | `crewflex-learning-{id del usuario autenticado}` → `{fecha:{ids:[…], answers:[…]}}`; válido si la fecha es un día real, `ids` tiene 5 o 10 y `answers` no supera a `ids` (`parseLearningHistory`, `learning.ts:144-165`; `useLearningProgress.ts`). Sin `count`, `questions` ni `complete` (se derivan). En ejecución: una clave `crewflex-learning-<uuid>` con `{ids: 5, answers: 5}` del día (`PKG P08 4`, 28e) | ≈ (F3: antes −) | P3 | — | Mantener (default v1.8: `localStorage` por usuario, T-166; formato mínimo por ✗ #19) |
| 18 | Progreso por identidad | En conectado, los anónimos comparten `guest`. Al iniciar sesión no se migra. Demo y conectado van por separado (hallazgo §3 #16). **v2, conectado en ejecución:** sin sesión el reto escribe `crewflex-learning-guest`; con `qa.tecnico1` en el mismo navegador ese progreso no pasa a su cuenta y el reto aparece sin empezar (`evidencias/v2/40/TOOL07-18-v18c-tecnico-reto-1440.jpg`, `evidencias/v2/40/v2-v18c.json`) | El id sale de la sesión verificada (`requireSessionActor`, `daily/page.tsx:15`), nunca de la petición; sin clave `guest` ni ruta pública del reto. En ejecución: echo en el mismo navegador ve el reto sin empezar y la clave de delta queda intacta (`PKG P08 8`) | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 19 | Purga del historial | Nunca se purga; guarda una copia completa de las preguntas de cada día (hallazgo §4 #6). En ejecución: el registro del día guarda las 5 preguntas completas (`id, group, prompt, answer, explanation, options`) | Solo ids y respuestas; las preguntas se reconstruyen desde el banco (`questionsById`); un id desaparecido invalida el día. En ejecución, el registro no contiene `prompt` ni `explanation` (`PKG P08 4`) | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |

Capturas: v1.8 `evidencias/shots/demo/D-TOOL-07-reto-diario-1440.png`, `evidencias/shots/demo/D-TOOL-07b-reto-pregunta-1440.png`,
`evidencias/shots/demo/D-TOOL-07c-reto-feedback-1440.png`, `evidencias/shots/demo/D-TOOL-07d-reto-final-1440.png`,
`evidencias/shots/demo/D-GEN-02-reto-diario-1440.png`, `evidencias/shots/connected/C-TEC-40-tool-reto-1440.png`. Next: —.

---

## TOOL-08 · Medallas e insignias ligadas a herramientas y aprendizaje — v1.8 `S-TOOL-09, S-TOOL-10, S-MOD-TOOL-05, S-MOD-TOOL-06, D-TOOL-07` ↔ Next `N-PRO-01 (parcial)`

**Estado global:** IGUAL salvo matices (F3: antes AUSENTE EN NEXT). Las medallas de aprendizaje llegaron con el reto
(`558654f`, `LearningMedals`, `LearningAchievements` en Mi espacio y en el pasaporte visual, T-163) y la tira de perfil
`MedalStrip` con shell-visual (`44045db`, T-156; plural ICU). Verificado en `PKG P08 4/5` y `PKG shell-visual 2`. Texto de
la v2: las medallas de aprendizaje son portables con el reto (SCOPE-2; TD-87). Las de perfil
(MedalStrip, TD-15a/b, V18-12) se portan como v1.8, con datos declarados, como default v1.8: OD-3 solo bloquea su
activación en producción; su fila de referencia es TEC-08 de `20-technician.md`. Solo el bloque «Documentos y cursos
próximos a revisar» de `Badges` tiene equivalente en Next, en el inicio del profesional.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | «Tu colección de constancia» (reto) | 3 medallas por mejor racha: 1 «Primer reto», 7 «7 días seguidos», 30 «30 días seguidos»; «Desbloqueado» / «Por conseguir»; «Completar el reto suma un día, aunque haya errores. Repetir o recargar no suma días extra. El progreso se guarda solo para este perfil en este navegador.» (`DailyLearning.jsx:15`). En ejecución, tras un reto: «Primer reto · Desbloqueado», las otras dos «Por conseguir» | «Tu colección de constancia»: 3 medallas por mejor racha (1, 7, 30: `LEARNING_MEDALS`, `learning.ts:22-27`), «Desbloqueado» / «Por conseguir · {n} día(s) seguidos»; nota «Completar el reto suma un día, aunque haya errores. Repetir o recargar no suma días extra. El progreso se guarda solo para tu cuenta en este navegador.» (`LearningMedals.tsx`, `DailyChallenge.tsx:237-243`, es:1784-1794). En ejecución, tras un reto: «Primer reto · Desbloqueado», las otras dos «Por conseguir» (`PKG P08 4`) | ≈ (F3: antes −) | — | — | — (L-3 hecho) |
| 2 | «Logros de aprendizaje» (pasaporte) | h3 + «Privados en este navegador · separados de las cualificaciones.»; las mismas 3 medallas con **otros nombres**: «Primer reto», «Una semana aprendiendo», «Constancia de 30 días». Bloqueadas: «1 día» / «7 días seguidos» / «30 días seguidos» (`src/features/Badges.jsx:10`; hallazgo §3 #2). En ejecución, en Mi pasaporte: «Primer reto · Desbloqueado», «Una semana aprendiendo · 7 días seguidos», «Constancia de 30 días · 30 días seguidos» (`evidencias/xhigh/40/TOOL08-1-v18-pasaporte-logros-1440.jpg`) (v2: igual, `evidencias/v2/40/TOOL08-1-v18-pasaporte-logros-1440.jpg`) | h3 «Logros de aprendizaje» + «Privados en este navegador · separados de las cualificaciones.» en Mi espacio (`LearningAchievements.tsx`, `professional/page.tsx:176`) y en el pasaporte visual (T-163); **un solo juego de nombres** en el reto y en Mi espacio: «Primer reto», «Una semana aprendiendo», «Constancia de 30 días» (es:1786-1790). En ejecución, `PKG P08 4/5` | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 3 | Línea de estadísticas del pasaporte | «Racha actual: {n} días · Mejor racha: {b} · Retos completados: {t}»: sale «1 días» (`Badges.jsx:10`; hallazgo §3 #3). En ejecución: «Racha actual: 1 días · Mejor racha: 1 · Retos completados: 1» | «Racha actual: {n} día(s) · Mejor racha: {b} día(s) · Retos completados: {t}» con plural ICU (es:1798). En ejecución: «Racha actual: 1 día · Mejor racha: 1 día · Retos completados: 1» (`PKG P08 5`) | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 4 | «Documentos y cursos próximos a revisar» | `<details>` (solo pasaporte): documentos no borrados + cursos con caducidad ≤ hoy + 60 días; «{título} · {fecha} · Fecha superada \| Próximos 60 días»; ayuda «Según las fechas declaradas. No se envían avisos externos; los documentos sin fecha no se consideran verificados.»; sin estado vacío (`Badges.jsx:10`). En ejecución (Marcos B.): el `<details>` sin entradas muestra solo la ayuda; su `summary` conserva el triángulo (`display: list-item`) | Bloque en Mi espacio: cualificaciones activas + documentos propios (si la cartera está activa) a ≤ 60 días (`REVIEW_WINDOW_DAYS`, `src/domain/documents.ts:95,101-102`), con títulos y ayuda idénticos. Añade estado vacío «Nada de lo declarado caduca en los próximos {days} días.», «Abrir» y error de carga (`src/app/app/professional/page.tsx:58-80,173-214`, es:517-523). En ejecución v2 con `alpha`: «Nada de lo declarado caduca en los próximos 60 días.» y la ayuda (`evidencias/v2/40/TOOL08-4-next-mi-espacio-1440.jpg`) | ≈ | — | — | Mantener (TD-44) |
| 5 | MedalStrip (insignias de perfil) | Experiencia «{años} AÑOS», categoría (escudo), aeronave (Plane + modelo), especialidad (Wrench, «SM»); «+N»/«−»; detalle `role="status"` con «Resumen del perfil; no concede autorización de firma ni acredita formación por participar en retos.» (`src/features/MedalStrip.jsx:5-10`; `progress.js:3-11`). En ejecución: «8 AÑOS», B1.1, Cat A, SM, A320, B737 NG, ATR 72; el detalle de B1.1 lleva ese aviso | No hay tira de medallas; solo chips de verificación **F3:** la tira existe desde shell-visual (`44045db`, T-156): `src/features/professional/components/MedalStrip.tsx` en el hero, 4 principales + «+N» desplegable con detalle y la nota de que no concede autorización de firma; datos declarados (años, categorías, aeronave), sin medallas de aprendizaje. Fila de referencia TEC-01 #9 / TEC-08 (`PKG shell-visual 2`) | ≈ (F3: antes −) | P3 | — | Ver TEC-08 (P02); aquí no se duplica |
| 6 | Insignia de experiencia | Etiqueta «{years} años»: sale «1 años» (`progress.js:9`; hallazgo §3 #3) | Plural ICU: «{count, plural, one {# año…} other {# años…}}» (`ProfessionalMedals.tsx:31-36`, es:2587-2588) | ≠ (F3: antes ✗) | P3 | — | Mantener (corrige v1.8) |
| 7 | Código muerto en `Badges` | `setSelected` nunca se llama, `compact` nunca se pasa, `symbols` no se usa (`Badges.jsx:7,9`); `src/components/v11/Marketplace.jsx:3` lo importa sin usarlo | — | ✗ | — | — | No portar |
| 8 | Medallas por usar herramientas | No existen (ni conversor ni combustible dan logros) | No existen | = | — | — | — |
| 9 | Aviso «una medalla no autoriza» | Pregunta `fact-9` «¿Una medalla por aprender autoriza a firmar mantenimiento?» → «No, es un logro de aprendizaje»; pie del pasaporte «Las insignias resumen datos declarados. No conceden autorización de firma ni sustituyen la revisión de licencia, tipo o competencia.» (`progress.js:23`, `Badges.jsx:10`). En ejecución, el pie del pasaporte, igual | `fact-9` «¿Una medalla por aprender autoriza a firmar mantenimiento?» → «No, es un logro de aprendizaje» (`questions.ts:56-60`; test «keeps the learning-medal notice»); pie «Las insignias resumen datos declarados. No conceden autorización de firma ni sustituyen la revisión de licencia, tipo o competencia.» en «Logros de aprendizaje» (es:1799). En ejecución, `PKG P08 5` | = (F3: antes −) | — | — | — (obligatorio, hecho) |

Capturas: v1.8 `evidencias/shots/demo/D-TOOL-07d-reto-final-1440.png` (colección de constancia). El pasaporte con «Logros de
aprendizaje» está en las capturas S-TEC-02 de la sección de pasaporte. Next: —.

---

## TOOL-09 · Textos — cobertura por fichero y cadenas sin equivalente — v1.8 `Toolbox.jsx, engine.js, knowledge.js, FuelSheet.jsx, Translator.jsx, DailyLearning.jsx, progress.js, Badges.jsx, MedalStrip.jsx` ↔ Next `messages/es.json` (`tools`, `professional.overview`)

**Estado global:** PARCIAL (combustible). F3 (27/10): los textos de `knowledge.js`, `Translator.jsx`,
`DailyLearning.jsx`, `progress.js`, `Badges.jsx` y `MedalStrip.jsx` tienen ya equivalente (dato editorial o catálogo
`tools.*` / `professional.medals.*`); sin equivalente quedan los de combustible (`FuelSheet.jsx`, mensajes de `engine.js`,
18 cadenas de `Toolbox.jsx`; D-11) y «Sin conexión» (NEW-01). Las cifras del extractor no se han re-ejecutado en F3: las
filas se han comprobado una a una contra `messages/es.json` y los ficheros de datos. Texto de la v2: dentro del alcance
D-11 (conversor, par, duración, inicio), todos los textos tienen equivalente literal salvo la nota de privacidad
(adaptada) y «Sin conexión». Fuera del alcance, la cobertura es nula.

Cifras de `string-diff.json` re-ejecutado el 22/10 sobre el `messages/es.json` actual (mismo esquema que
`textos/string-diff.json`): cuenta una cadena en cada fichero cuyo texto la contiene. Para los 9 ficheros de esta sección
salen las mismas cifras que el 21/10 salvo `DailyLearning.jsx` (+1 exacta de una palabra, «Completar», falso positivo).
v2: con `textos/string-diff-v2.json` (catálogo de `821c24f`, 1020 claves) salen las mismas cifras salvo tres falsos
positivos nuevos de M07/M08: «Todas» en `Toolbox.jsx` (`opportunities.filter.all`) y «Confirmada» / «Finalizada» en
`progress.js` (`domain.applicationStatus.*`); recuento con `evidencias/v2/40/literals.py.txt` aparte.
- **Bruto**: incluye palabras sueltas.
- **Prosa**: solo cadenas con espacio.
- Las coincidencias exactas en `knowledge.js`, `FuelSheet.jsx`, `Translator.jsx`, `DailyLearning.jsx`, `progress.js` y
  `MedalStrip.jsx` son falsos positivos: palabras sueltas como «de», «DE», «Fin», «Tipo», «Masa», «Densidad», «Resumen»,
  «Completar», «Estado», «Base», «Eliminar» o «Experiencia», y el término de diccionario «Par de apriete», que coincide
  con el título de la tarjeta (lista completa recontada en la verificación xhigh): la cobertura real de esos ficheros
  es 0.
- El extractor **omite** algunas cadenas del alcance que se han comprobado a mano:
  - con equivalente exacto: la fórmula, el ejemplo de 120 lbf·in, «Motor 1.0.0…» y «Usa HH:MM…»;
  - sin equivalente: la nota de privacidad, «Ejemplos originales de lenguaje…», «Cantidad calculada e indicación…» y
    «Masa = volumen × densidad…».

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | `src/tools/Toolbox.jsx` | Bruto: 199 cadenas (66 exactas, 2 parecidas, 131 sin equivalente; xhigh 65 / 2 / 132; la nueva es «Todas», falso positivo) → 34 %. Prosa: 125 (42 / 1 / 82) → 34 %. Revisión manual del alcance D-11 (`:13-34, 64-73`): **56 literales exactos + 6 por plantilla ICU** (favoriteAdd/Remove, resultPressure, engineNote, rangeNote, texto copiado) **+ 1 parecido** (hero con `<br/>`). Distintos: 1 (nota de privacidad). Sin equivalente: «Sin conexión» y los 8 textos de las 4 tarjetas fuera de alcance | `tools.*` (es:1002-1189, 122 claves en v2, como en la xhigh; 117 el 21/10). Las 5 nuevas no tienen origen en v1.8: `readAs`, `duration.placeholderClock`, `duration.placeholderDecimal`, `error.toleranceRequired`, `error.toleranceInvalid` (es:1003, 1012-1013, 1035-1036) **F3:** las 4 tarjetas, el reto, el traductor y el diccionario tienen ya equivalente (`tools.tile.*`, `tools.knowledge.*`, `tools.translator.*`, `tools.daily.*`, es:1621-1800); sin equivalente queda «Sin conexión» (NEW-01) y la frase del combustible de la nota (D-11) | ≈ | — | D-11 (combustible) y NEW-01 (sin conexión); el resto — | Ver tabla de 30 cadenas |
| 2 | `src/tools/engine.js` | Bruto: 81 (45 / 0 / 36) → 56 %. Prosa: 41 (24 / 0 / 17) → 59 %. Las 22 etiquetas, las 11 descripciones, las 4 etiquetas de unidad y los mensajes de conversión, rango y duración tienen equivalente. Sin equivalente: los mensajes de combustible (`fuelDensity`, `fuelBalance`, aviso 0,6–1,1) y los prefijos «{label}:» | `tools.magnitude.*`, `tools.unit.*`, `tools.error.*` | ≈ | P3 | D-11 | — |
| 3 | `src/tools/knowledge.js` | Bruto: 338 (8 / 0 / 330). Prosa: 184 (1 / 0 / 183). **Real: 0 %** (102 términos, 46 capítulos ATA y 4 fuentes, sin equivalente) | Portado como dato editorial (`src/features/tools/knowledge/data.ts`: 102 términos, 46 capítulos, 4 fuentes, versión 2026-10-13.1); solo la interfaz va por catálogo (`tools.knowledge.*`) | = (F3: antes −) | — | — | — (L-1 hecho) |
| 4 | `src/tools/FuelSheet.jsx` | Bruto: 85 (10 / 1 / 74). Prosa: 48 (0 / 0 / 48). **Real: 0 %** | — | − | P1 | D-11 | — |
| 5 | `src/features/Translator.jsx` | Bruto: 124 (8 / 1 / 115). Prosa: 43 (1 / 0 / 42). **Real: 0 %** (el repertorio de 32 filas es dato) | Repertorio de 32 filas como dato (`phrases.ts`); interfaz en `tools.translator.*` (es:1725-1752), literal salvo «Abrir traducción externa» + «(se abre en otra pestaña)» en `sr-only` | = (F3: antes −) | — | — | — (L-2 hecho) |
| 6 | `src/features/DailyLearning.jsx` | Bruto: 42 (4 / 0 / 38; el 21/10, 3 / 0 / 39: la nueva es «Completar» → `professional.overview.doIt`, falso positivo). Prosa: 27 (0 / 0 / 27). **Real: 0 %** | `tools.daily.*` (es:1753-1800): literal, con los añadidos «Diez minutos para ti», el aviso del reto sin terminar y «para tu cuenta» en la nota de las medallas | ≈ (F3: antes −) | P3 | — | — (L-3 hecho) |
| 7 | `src/features/progress.js` | Bruto: 56 (9 / 0 / 47; xhigh 7 / 0 / 49: «Confirmada» y «Finalizada», falsos positivos de M08). Prosa: 32 (0 / 0 / 32). **Real: 0 %** (10 preguntas de Fundamentos, plantillas de pregunta y detalles de insignias) | Las 10 preguntas y las plantillas, literales, en `questions.ts`; nombres de medalla en `tools.daily.medal.*` (un solo juego); textos de insignias en `professional.medals.*` (es:2585-2591, T-156) | ≈ (F3: antes −) | P3 | — | — |
| 8 | `src/features/Badges.jsx` | Bruto: 32 (6 / 1 / 25). Prosa: 18 (2 / 1 / 15). Con equivalente: «Documentos y cursos próximos a revisar», «Fecha superada», «Próximos 60 días» (≈ «Próximos {days} días») y la ayuda | `professional.overview.review*` (es:517-523) | ≈ | — | — (v2: desbloqueado / default v1.8) | — |
| 9 | `src/features/MedalStrip.jsx` | Bruto: 14 (2 / 0 / 12). Prosa: 4 (0 / 0 / 4). **Real: 0 %** | `professional.medals.*` (es:2585-2591; `MedalStrip.tsx`, T-156): «{n} años», categoría, aeronave, «Ver {n} insignias adicionales» y la nota de no autorización | ≈ (F3: antes −) | P3 | — | — (ver TEC-08) |

**30 cadenas de `Toolbox.jsx` sin equivalente en Next más relevantes** (ordenadas por impacto; «otros» = la cadena
aparece también en otros ficheros):

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Indicador sin conexión | «Sin conexión» (`:70`) | — | − | P3 | NEW-01 | No portar sin service worker |
| 2 | Hero (falso negativo) | «Tu oficio, un poco» + «más sencillo.» (`:71`) | «Tu oficio, un poco más sencillo.» (es:1010) | ≈ | — | — | — |
| 3 | Nota de privacidad | «Tu uso de herramientas es privado. Los cálculos de combustible se descartan al salir; se guardan tus favoritos y el progreso de los retos en este navegador.» (`:73`; no detectada por el extractor) | «Tu uso de herramientas es privado: los cálculos se hacen en tu navegador y no se envían a ningún servidor. Tus favoritos y el progreso de los retos se guardan en este navegador.» (es:1621): favoritos y progreso como v1.8; sin la frase del combustible | ≈ (F3: antes ≠) | P3 | — | Ver TOOL-01 #33 |
| 4 | Tarjeta | «Reto diario» · «5 o 10 preguntas · rachas» (`:65`) | «Reto diario» · «5 o 10 preguntas · rachas» (es:1623-1626) | = (F3: antes −) | — | — | — |
| 5 | Tarjeta | «Traductor» · «Español · inglés · francés» (`:65`) | «Traductor» · «Español · inglés · francés» (es:1627-1630) | = (F3: antes −) | — | — | — |
| 6 | Tarjeta | «Combustible» · «Planifica y concilia» (`:65`) | — | − | P1 | D-11 | — |
| 7 | Tarjeta | «Inglés y siglas» · «Diccionario · ATA · práctica» (`:65`) | «Inglés y siglas» · «Diccionario · ATA · práctica» (es:1639-1642) | = (F3: antes −) | — | — | — |
| 8 | Pestañas de combustible | «Hoja de escala · kg / L», «Masa ↔ volumen», «Planificar suministro», «Conciliar suministro» (`:44`) | — | − | P1 | D-11 | — |
| 9 | Botón | «Nueva operación» (`:44`) | — | − | P2 | D-11 | — |
| 10 | Aviso | «Ejemplo de formación cargado. No son datos de una aeronave.» (`:45`) | — | − | P2 | D-11 | — |
| 11 | Descripción (masa ↔ volumen) | «Usa la densidad correspondiente al volumen medido.» (`:46`) | — | − | P2 | D-11 | — |
| 12 | Descripción (plan) | «Introduce el objetivo indicado por la operación competente y los cambios previstos hasta ese instante.» (`:46`) | — | − | P2 | D-11 | — |
| 13 | Descripción (balance) | «Compara la cantidad esperada por balance con la indicación del avión y con el objetivo.» (`:46`) | — | − | P2 | D-11 | — |
| 14 | Ayuda de densidad | «Para datos observados, comprueba que densidad y volumen correspondan a las mismas condiciones de temperatura.» (`:50`) | — | − | P2 | D-11 | — |
| 15 | Ayuda de horas | «Usa el mismo intervalo para lecturas, consumo y suministro. Las horas son una anotación local, no ajustan automáticamente el balance.» (`:49`) | — | − | P3 | D-11 | — |
| 16 | Ayudas de cero confirmado | «Escribe 0 si has confirmado que no hubo consumo.» / «…que no hubo retirada.» (`:49`) | — | − | P2 | D-11 | — |
| 17 | Bases | «Selecciona la base», «En condiciones de suministro», «Referido a 15 °C» (`:35`) | — | − | P1 | D-11 | — |
| 18 | Alcance del combustible | «Sin corrección térmica automática, tolerancia universal, reparto por tanques ni cálculo de reservas. No determina despacho ni diagnostica fugas. No se guardan estos valores al salir de la herramienta.» (`:52`) | — | − | P1 | D-11 | Texto de seguridad: portarlo literal |
| 19 | Enlace | «Airbus Safety First · fundamento de la conciliación» (`:52`) | — | − | P3 | D-11 | — |
| 20 | Panel lateral | «Dos comparaciones distintas» + «El balance contrasta lo suministrado con la indicación. El objetivo contrasta esa indicación con la cantidad requerida.» (`:53`) | — | − | P2 | D-11 | — |
| 21 | Leyenda | «Diferencia de balance · indicado − esperado» (`:53`) | — | − | P1 | D-11 | — |
| 22 | Leyendas del plan | «Masa adicional calculada» / «Exceso calculado respecto al objetivo» (`:53`) | — | − | P1 | D-11 | — |
| 23 | Mensaje | «Porcentaje no definido con esperado cero.» (`:53`) | — | − | P3 | D-11 | — |
| 24 | Botones de carga | «Añadir otro suministro», «Eliminar carga», «Calcular diferencias» (`:50-51`) | — | − | P2 | D-11 | — |
| 25 | Pestañas de conocimiento | «Diccionario ES / EN», «Índice ATA», «Práctica breve» (`:59`) | Idénticas (es:1699-1701) | = (F3: antes −) | — | — | — |
| 26 | Buscador | «Buscar término, sigla o ATA» + «Término, sigla o significado: torque, holgura, AMM…» + «Número o sistema: 28, combustible…» (`:60`) | Idénticos (es:1704-1706) | = (F3: antes −) | — | — | — |
| 27 | Vacío del diccionario | «No hay entradas para esta búsqueda. Prueba el término inglés o una sigla.» (`:61`) | Idéntico (es:1710) | = (F3: antes −) | — | — | — |
| 28 | Panel sin selección | «Selecciona una entrada para ver definición, ejemplos y términos confundibles. Las siglas pueden tener más de una acepción.» (`:61`) | «Selecciona una entrada para ver su definición y sus ejemplos. Las siglas pueden tener más de una acepción.» (es:1716): sin la promesa | ≠ (F3: antes ✗) | P3 | — | Mantener (promesa corregida) |
| 29 | Aviso ATA | «El índice ATA es navegación de referencia, no contiene tareas ni sustituye el índice del manual aplicable.» (`:61`) | Idéntico (es:1717) | = (F3: antes −) | — | — | — |
| 30 | Fuentes | «Fuentes y revisión editorial» + «Definiciones breves originales. Catálogo inicial…» (`:62`) | Idénticos (es:1722-1723) | = (F3: antes −) | — | — | — |

Capturas: las de TOOL-01…TOOL-08. Fuente de datos: `textos/string-diff.json` y `textos/string-coverage.md`.

---

## Recuento

Elementos comparados: **259** filas en las tablas de TOOL-01…TOOL-09 (257 en la xhigh; 2 filas nuevas en v2: TOOL-01,
color de la nota de privacidad, y TOOL-02, nombre accesible del resumen). **F3 (27/10, P08):** `recount.py
40-tools-learning.md` → 259 · = 128 · ≈ 34 · ≠ 21 · − 50 · + 13 · ✗ 13; paridad (= + ≈) / (= + ≈ + ≠ + −) = 162 / 233 =
69,5 % (v2: 102 / 217 = 47,0 %); retenidas por decisión 52 / 233 = 22,3 % (D-11 50 contando TOOL-09 #1-#2, NEW-01 2). Las
tablas siguientes son las de F3; las de la v2 están en la primera tabla de «Verificación F3». TOOL-09 repite, como textos, elementos de
TOOL-01/04/05; sin TOOL-09 quedan 220 elementos funcionales. Recuento hecho con un script sobre la columna Diff de las
tablas de elementos (el símbolo que cuenta es el primero de la celda); el mismo script sobre la versión xhigh da 257 ·
= 79 · ≈ 22 · ≠ 11 · − 104 · + 12 · ✗ 29.

| Diff | TOOL-01 | TOOL-02 | TOOL-03 | TOOL-04 | TOOL-05 | TOOL-06 | TOOL-07 | TOOL-08 | TOOL-09 | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| `=` | 24 | 53 | 8 | 1 | 12 | 9 | 11 | 3 | 10 | **131** |
| `≈` | 4 | 9 | 3 | 0 | 1 | 1 | 3 | 2 | 8 | **31** |
| `≠` | 3 | 2 | 2 | 0 | 3 | 2 | 5 | 3 | 1 | **21** |
| `−` | 2 | 0 | 0 | 28 | 0 | 0 | 0 | 0 | 20 | **50** |
| `+` | 4 | 4 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | **13** |
| `✗` | 1 | 1 | 0 | 10 | 0 | 0 | 0 | 1 | 0 | **13** |
| filas | 38 | 69 | 18 | 39 | 16 | 12 | 19 | 9 | 39 | **259** |

Severidades (columna Sev., mismo script):

| Sev. | TOOL-01 | TOOL-02 | TOOL-03 | TOOL-04 | TOOL-05 | TOOL-06 | TOOL-07 | TOOL-08 | TOOL-09 | Total | v2 | xhigh |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | 0 |
| P1 | 1 | 0 | 0 | 18 | 0 | 0 | 0 | 0 | 7 | **26** | 26 | 26 |
| P2 | 0 | 1 | 0 | 10 | 0 | 0 | 0 | 0 | 9 | **20** | 62 | 62 |
| P3 | 11 | 8 | 5 | 1 | 5 | 3 | 9 | 4 | 10 | **56** | 47 | 48 |
| — | 26 | 60 | 13 | 10 | 11 | 9 | 10 | 5 | 13 | **157** | 124 | 121 |

Cambios de símbolo en F3: 79 filas, listadas en «Verificación F3» (`(F3: antes X)` en cada una). Los 16 `✗` que eran
instrucciones para el port pasan a `≠` (corregido en Next: TOOL-05 #9, #10, #14; TOOL-06 #2, #5; TOOL-07 #2, #6, #8, #18,
#19; TOOL-08 #2, #3, #6; TOOL-09 cadena #28) o a `=` (mismo contenido editorial: TOOL-05 #12, TOOL-07 #14). Quedan 13 `✗`:
10 de combustible (instrucciones para F-1), la banda demo, `pressureReference` y el código muerto de `Badges`.

Por bloqueo, de los 50 `−` de F3: D-11 (combustible) 48, contando la tarjeta de TOOL-01 y los textos de TOOL-09; NEW-01
(indicador sin conexión) 2. Ninguno es portable sin decisión.

Cambios de símbolo en v2: TOOL-02 casilla táctil `=` → `+` (X-09) y TOOL-02 #28 `≠` → `≈` (X-07); filas nuevas `=`
(TOOL-01, nota) y `≠` (TOOL-02, nombre accesible).

Por bloqueo, de los 104 `−` de la v2:
- D-11 (combustible): 48, contando las tarjetas y textos de TOOL-01 y TOOL-09.
- Portables ya con el alcance nuevo: 54. De ellos, 47 desbloqueados por SCOPE-2 (inglés y siglas, traductor, reto,
  medallas de aprendizaje) y 7 con un default v1.8: MedalStrip y sus textos (TOOL-08 #5, TOOL-09 #9), par de idiomas
  y enlace externo del traductor (TOOL-06 #4, #8), día de Madrid y almacenamiento del reto (TOOL-07 #3, #17) y textos de
  `progress.js` (TOOL-09 #7).
- NEW-01 (indicador sin conexión): 2.

En la xhigh ningún `−` era portable; en v2 lo son 54 (backlog L-1…L-4) y siguen bloqueados 50 (D-11 48, NEW-01 2).

**Diferencia numérica más relevante.** No hay ninguna en los factores: 98/98 unidades, mismos factores, offsets y orden,
y el mismo algoritmo de conversión, rango y duración; en ejecución, 192/192 valores mostrados iguales en `es` (xhigh) y
los 97 registros otra vez iguales en v2. Las únicas diferencias que cambian un número visible o aceptado son estas:
- **Formato según el idioma** (TOOL-02 #20). Con la interfaz en inglés (preferencia o cookie `en`, o, sin ellas, un
  navegador que no pida español), 5200 se muestra «5,200» y 73,756215 «73.756215». Como el parseo acepta la coma sola
  como decimal (#37), reescribir a mano «5,200» da **5,2**: un factor 1000 en un dato de par o masa. Desde el 21/10
  (W1-06) el riesgo queda a la vista: bajo el campo aparece «Read as 5.2» (TOOL-02, fila nueva tras la 7; comprobado en
  ejecución con `delta` en la xhigh y en v2). La regla de entrada no ha cambiado.
- **Duración con espacios.** « 1:30» → 1,5 h en Next; error en v1.8 (TOOL-03 #8).

---

## Backlog derivado

Tareas portables con el alcance nuevo (SCOPE-2: NOW + NEXT + LATER en local; OUT fuera), ordenadas por severidad.
Estado al 22/10/2026 tras el bucle, comprobado en el código del SNAP `821c24f` y en ejecución. Ninguna necesita
migración de BD ni Edge Function: el banco es de cliente (si el owner quisiera el progreso del reto en servidor, L-3
pasaría a necesitar BD). HECHO = resuelto con commit; BLOQUEADO = sigue fuera.

### Hechas en F3 (P08, 27/10/2026; eran «Pendientes (portables ya)»)

L-1…L-4 — **HECHAS** (`558654f`, 22/10, tras el SNAP de la v2); T-3 — **HECHA** (`88d9a6d`); T-1 y T-2 — **HECHAS**
(`558654f`); A-1 — **HECHA** en lo que SCOPE permite (`44045db`, T-145: `/tools` público sin el reto). Verificación: `PKG
P08` 0…10 y 28a-28f. Los criterios de aceptación de abajo se conservan como registro de lo comprobado.

1. **L-3 · Reto diario, rachas y logros de aprendizaje** (P2) — HECHO (`558654f`).
   - Filas: TOOL-07 #1-#19, TOOL-08 #1-#3 y #9, TOOL-01 #23, TOOL-09 #6-#7 y #4 de la tabla de cadenas.
   - Ficheros de Next:
     - `src/domain/learning.ts` (nuevo, puro: selección diaria FNV-1a, distractores, orden de opciones, rachas) y su test;
     - `src/features/tools/learning/questions.ts` (banco de 158: 10 de Fundamentos y plantillas sobre los datos de L-1);
     - `src/features/tools/components/DailyChallenge.tsx` y `src/app/app/tools/daily/page.tsx`;
     - `src/features/tools/components/ToolsHome.tsx` (`TOOL_IDS` y tarjeta «Reto diario» · «5 o 10 preguntas · rachas»);
     - `src/app/app/professional/page.tsx` (bloque «Logros de aprendizaje»);
     - `messages/es.json` y `messages/en.json`.
   - Aceptación:
     - para 3 fechas fijas, las 5 y las 10 preguntas y el orden de opciones coinciden con `progress.js` de v1.8 (test de
       paridad);
     - 5 preguntas por defecto y 10 opcional, con un título que no diga «Cinco minutos» con 10 (✗ #6); una sola h1 (✗ #2);
     - explicación tras cada respuesta; «Reto completado» no se repite el mismo día; si cambia el día con un reto
       abierto, se avisa (✗ #8);
     - rachas actual, mejor y total como `streak` (#16), con plurales ICU («1 día», ✗ TOOL-08 #3);
     - progreso en `localStorage` con el id del usuario autenticado, guardando solo ids y respuestas (✗ #18, #19);
     - un único juego de nombres de medallas en el reto y en Mi espacio (✗ TOOL-08 #2);
     - avisos «Contenido editorial de formación, no examen habilitante…» y «una medalla no autoriza» literales (#12,
       TOOL-08 #9).
   - Tamaño: L. BD/Edge: no.
   - Defaults v1.8: día de `Europe/Madrid` (TOOL-07 #3) y `localStorage` por usuario (TOOL-07 #17).
2. **L-1 · Inglés y siglas: diccionario ES/EN, índice ATA y práctica** (P2) — HECHO (`558654f`).
   - Filas: TOOL-05 #1-#16, TOOL-01 #28, TOOL-09 #3, y #7 y #25-#30 de la tabla de cadenas.
   - Ficheros de Next:
     - `src/features/tools/knowledge/data.ts` (nuevo: 102 entradas, 46 capítulos ATA y 4 fuentes, como dato editorial
       versionado 2026-10-13.1, no como catálogo i18n);
     - `src/features/tools/knowledge/search.ts` y su test;
     - `src/features/tools/components/KnowledgeTool.tsx` y `src/app/app/tools/knowledge/page.tsx`;
     - `src/features/tools/components/ToolsHome.tsx`; `messages/{es,en}.json` (solo la interfaz).
   - Aceptación:
     - «102 entradas · 46 capítulos de referencia»; «Todos» y las 13 áreas en el orden de v1.8;
     - búsqueda sin acentos y con recorte de espacios (#6); «zzzz» → «No hay entradas para esta búsqueda…»;
     - filtro ATA sin acentos y con estado vacío: «hidraulica» → «29 Energía hidráulica» (✗ #14);
     - ficha con grupo, término, traducción, definición, ejemplo EN/ES y versión; botón «Copiar ficha» (✗ #9);
     - panel vacío sin la promesa de «términos confundibles» (✗ #10);
     - práctica de 21 tarjetas y los 4 enlaces de fuentes.
   - Tamaño: L. BD/Edge: no.
   - Default v1.8: el contenido editorial tal cual, con su aviso «pendiente de revisión formal»; la revisión editorial de
     #12 no bloquea el port.
3. **L-2 · Traductor de apoyo** (P2) — HECHO (`558654f`).
   - Filas: TOOL-06 #1-#12, TOOL-01 #24, TOOL-09 #5 y #5 de la tabla de cadenas.
   - Ficheros de Next: `src/features/tools/translator/phrases.ts` (32 filas ES/EN/FR),
     `src/features/tools/components/TranslatorTool.tsx`, `src/app/app/tools/translator/page.tsx`, `ToolsHome.tsx`,
     `messages/{es,en}.json`.
   - Aceptación:
     - una sola h1 (✗ #2); origen EN y destino ES por defecto; «Intercambiar idiomas» conserva el texto (✗ #5);
     - `textarea` de 5 filas, `maxLength` 2000 y «{n}/2000 caracteres · no se guarda el texto.»;
     - coincidencia exacta normalizada, sin estilos en línea (#7); sugerencias filtradas en el idioma de origen;
     - «Abrir traducción externa ↗» solo con texto, idiomas distintos y la casilla de consentimiento, que se desmarca con
       cualquier cambio; URL `https://translate.google.com/?sl=…&tl=…&text=…&op=translate`, `target="_blank"`,
       `rel="noreferrer"`;
     - ninguna petición de red ni almacenamiento (la CSP no cambia).
   - Tamaño: M. BD/Edge: no.
   - Defaults v1.8: par EN → ES (#4) y enlace externo con consentimiento (#8).
4. **L-4 · Orden de tarjetas y nota de privacidad al ampliar el banco** (P3) — HECHO (`558654f`).
   - Filas: TOOL-01 #30 y #33.
   - Ficheros: `src/features/tools/components/ToolsHome.tsx` (`TOOL_IDS`), `messages/{es,en}.json` (`tools.privacyNote`),
     `src/features/tools/messages.test.ts`.
   - Aceptación: con L-1…L-3 las tarjetas siguen el orden de v1.8 (Reto, Traductor, Par, [Combustible], Conversiones,
     Inglés, Duración); la nota menciona el progreso de los retos guardado en este navegador; `parseFavorites` acepta los
     ids nuevos (test).
   - Tamaño: S. BD/Edge: no.
5. **T-3 · (nueva v2, defecto de X-07) El triángulo del `summary`, fuera del nombre accesible** (P3) — HECHO (`88d9a6d`).
   - Filas: TOOL-02, fila nueva v2 tras la 28.
   - Ficheros: `src/app/globals.css:61-67`; `scripts/local/ui-smoke.mjs` (comprobar el nombre).
   - Aceptación: en Chromium, el árbol de accesibilidad da «Fórmula, fuentes y alcance» y «Los 7 apartados del perfil»,
     sin «▸» ni «▾»; el triángulo se sigue viendo y cambia al abrir; ≥ 44 px en táctil.
   - Tamaño: S. BD/Edge: no.
6. **T-1 · (opcional) Arte del hero a partir de 601 px** (P3) — HECHO (`558654f`).
   - Filas: TOOL-01 #15. Fichero: `src/features/tools/components/ToolsHome.tsx:84-86`.
   - Aceptación: a 601 y 768 px el arte se ve (`display: flex`); a 600 px, no.
   - Tamaño: S. BD/Edge: no.
7. **T-2 · (opcional) Iconos de 17 px en los chips de «Tus favoritos»** (P3; era la 8) — HECHO (`558654f`).
   - Filas: TOOL-01 #17. Fichero: `src/features/tools/components/ToolsHome.tsx:17-21,109`.
   - Aceptación: con favoritos, el icono de cada chip mide 17×17 y el de las tarjetas sigue en 26×26.
   - Tamaño: S. BD/Edge: no.

### Hechas (con commit; comprobado en el SNAP y en ejecución v2)

8. Error de rango y tolerancia que nombra el campo y no salta con el valor vacío — **HECHO** (`7bae7a2`, W1-05;
   TOOL-02 #24, #45).
9. Placeholders de Duración al catálogo — **HECHO** (`69210ac`, W3-08; TOOL-03 #7).
10. Eco «Se lee como {n}» en el conversor y en Duración — **HECHO** (`14dfaf0`, W1-06; filas nuevas de TOOL-02 y TOOL-03).
11. Tests de paridad numérica con el runtime de v1.8 — **HECHO** (`4fdc186`, W3-10; 40/40 en v2).
12. Tamaño mínimo de 12 px en el banco — **HECHO** (`9483667`, W3-09; `ac28483`, W3-03; ningún texto < 12 px en v2).
13. Indicador del desplegable «Fórmula, fuentes y alcance» (era la 6) — **HECHO** (`cfb2fe5`, X-07): «▸» / «▾» en
    ejecución v2; deja el defecto T-3.
14. Casilla de rango y enlace NIST a 44 px en táctil (era la 7) — **HECHO** (`5d85caa`, X-09; `aee8ba9`, `ui-smoke` 25
    mide las etiquetas de casilla): 316×44 y 166,7×44 en v2.
15. Nota de privacidad con el color de v1.8 — **HECHO** (`cac7461`, X-10; TOOL-01, fila nueva v2).

### Bloqueadas

16. **F-1 · Combustible: hoja de escala, masa ↔ volumen, planificar, conciliar y CSV** (P1) — **BLOQUEADO** (D-11:
    revisión técnica del texto, que puede inducir a error operativo). Queda preparada:
    - Filas: TOOL-04 #1-#39, TOOL-01 #26, TOOL-09 #2 (mensajes de combustible) y #4, y #6 y #8-#24 de la tabla de cadenas.
    - Ficheros de Next: `src/features/tools/fuel/engine.ts` (nuevo: `fuelDensity`, `fuelConversion`, `fuelPlan`,
      `fuelBalance` y CSV) y su test; `src/features/tools/components/FuelTool.tsx` (4 pestañas) y `FuelSheet.tsx`;
      `src/app/app/tools/fuel/page.tsx`; `ToolsHome.tsx`; `messages/{es,en}.json`.
    - Aceptación:
      - el ejemplo de formación da esperado 11.920 kg, Δ −40 kg, Δ objetivo −120 kg y −0,336 % (#23);
      - plan 5200 / 12000 / 80 / 0 a 0,8 kg/L → 6880 kg y 8600 L; con 13000, exceso de 920 kg y su aviso (#14);
      - 1000 L a 0,8 kg/L → 800 kg; sin densidad por defecto y con bases obligatorias y sus mensajes (#8);
      - el aviso 0,6–1,1 kg/L y el error concreto también en la hoja (✗ #32);
      - el aviso de ejemplo se reinicia al cambiar de pestaña (✗ #5);
      - textos copiados con la etiqueta de la base y números formateados (✗ #11, #21);
      - en lb el balance sale en lb (✗ #19); los errores nombran la carga (✗ #17); kg ↔ L no borra el valor (✗ #29);
      - CSV con BOM, `;`, CRLF y comillas; negativos sin prefijo y solo el texto neutralizado (✗ #36); etiqueta de la
        base (✗ #37); formato numérico documentado (✗ #38);
      - textos de alcance y pie literales (#24, #25).
    - Tamaño: L. BD/Edge: no. Lo desbloquea la revisión técnica de D-11 (owner).
17. **A-1 · Herramientas sin cuenta** (P2) — **HECHO** (F3: `44045db`, T-145): ruta pública `/tools` fuera de `/app` con
    las 5 herramientas de navegador (sin el reto, cuyo progreso va por usuario); `/app/**` sigue protegido. Fila TOOL-01 #1.
18. **N-1 · Indicador «Sin conexión»** (P3) — **BLOQUEADO** (NEW-01 / AB-37: necesita el service worker y su decisión de
    alcance). Filas TOOL-01 #9 y #1 de la tabla de cadenas. Tamaño S tras NEW-01.

Referencias a otras áreas (no se duplican aquí): logbook → `20-technician.md` TEC-06; MedalStrip (TOOL-08 #5, #6) →
TEC-08; dock móvil (TOOL-01 #2) → sección de shell (área 10).

Los ✗ son instrucciones para cuando se porte cada pieza y están dentro de los criterios de aceptación de L-1…L-3 y F-1.
