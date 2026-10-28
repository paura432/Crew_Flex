# 10 · Diff v1.8 ↔ Next — Shell y navegación, acceso, cuenta y administración

Filas 317 · = 29 · ≈ 102 · ≠ 37 · − 47 · + 58 · ✗ 44 · Sev. P0 2 · P1 12 · P2 29 · P3 66 · sin severidad 208
(F3 P12, 27/10: ADM-01…03 re-verificadas, 20 filas cambian de símbolo `(F3: antes X)`; v2, 22/10 por la tarde: = 29 · ≈ 82 ·
≠ 38 · − 66 · + 58 · ✗ 44 · P0 2 · P1 14 · P2 33 · P3 77 · sin severidad 191; xhigh: filas 314 · = 26 · ≈ 79 · ≠ 38 · − 72 · + 57 · ✗ 42 · P0 2 · P1 18 · P2 34 ·
P3 76; refresco de la mañana: filas 312; 21/10: filas 301)

Auditoría «diff exhaustivo» entre el HTML CrewFlex v1.8 (modo demo + modo conectado con servidor Node/SQLite, los dos en
ejecución) y la app Next.js `~/pau/Crew_Flex`, solo lectura. **Next actual (v2)** = SNAP2, rama `feat/v18-html-parity`,
commit `038329f` (bucle X-01…X-22, R-X, D-13 commiteado en `d3b876f`, M05, M07, M08 y M09 apagado), servido con
`next start` en `http://localhost:3004` sobre la base Supabase local. La versión xhigh comparaba `5c2d1a2` + el árbol de
trabajo de D-13. **Alcance de la columna Bloqueo (v2):** NOW + NEXT + LATER de `V1_SCOPE.md` (SCOPE-2); las decisiones
abiertas se portan con el comportamiento v1.8 como default documentado y reversible («— (default v1.8, id)»); siguen
bloqueados SCOPE OUT, D-07 P3 + D-10, OD-3 en producción y lo inseguro o demo-only (`✗`). Formato: `_FORMAT.md`. El lado
v1.8 no cambia (zip con el mismo sha256).

## Verificación v2 (22/10/2026, tras el bucle)

**Método.**
- Cada fila se contrastó de nuevo en código en los dos lados: v1.8 (`src/` vivo, `server/*.mjs`, bundle) y Next congelado
  en el SNAP2 (`038329f`, worktree `wt-diff2`). Las 173 referencias `archivo:línea` y `es:N` se renumeraron con
  `work/10/remap.py` (mapa de líneas `d3b876f` → `038329f` y de claves del catálogo) y las dudosas se releyeron a mano;
  `work/10/literals.py` comprobó los 817 literales «…» (los que no aparecen tal cual son compuestos, medidos en ejecución,
  datos del seed o mensajes del navegador).
- En ejecución, con scripts de Playwright de solo lectura (`work/10/s1…s5`, `c1`, `c2`, `d1`): Next en
  `http://localhost:3004` con `alpha`, `charlie`, `manager.mro`, `admin.mro`, `echo`, `hotel` y `platform.admin` (un login
  por cuenta y sesión guardada), a 1440, 1366×768, 1024×768 y 390; la v1.8 demo con los tres roles; y la v1.8 **conectada**
  con las sesiones guardadas del técnico 1 y 2, la empresa, el recruiter y el admin (sin ningún login nuevo) y sin sesión
  (un único intento fallido con una dirección nueva `v2.area10.nobody@example.test`). Cabeceras HTTP con `curl`.
- Escrituras: ninguna en Next salvo cerrar la sesión propia (`hotel`, ahora de alcance local); en el registro solo se envió
  una contraseña de 11 caracteres, que el servidor rechaza antes de llamar a Auth. En el conectado no se pulsó «Cerrar
  sesión» (sesiones compartidas) ni se envió ningún formulario.
- Tests del área en el SNAP2: `pnpm exec vitest run src/components/layout src/features/auth src/server/session.test.ts
  src/lib/validation/auth.test.ts tests/i18n/titles.test.ts` → 6 ficheros, 51 tests, pasan.

**Cobertura.**
- En código, los dos lados: las 317 filas.
- Next en ejecución (104 filas): SH-01 #4, #6, #12; SH-02 #1, #2, #18-#26; SH-03 #1-#11, #13, #16-#20, #22, #24, #25,
  #27-#29, #32 y la matriz; SH-04 #3, #4, #6, #11, #13; SH-05 #4, #7, #9, #11; SH-06 #10; SH-07 #3, #5, #10, #14, #15;
  AUTH-01 #1, #2, #4-#7, #9-#11, #16; AUTH-02 #2, #3, #5, #6, #9-#11, #17; AUTH-03 #5; AUTH-04 #1-#4, #9-#11; AUTH-05 #8,
  #9; AUTH-06 #7, #8; ACC-01 #1, #2, #4-#6; ACC-02 #3, #7; ADM-01 #1, #2, #5; ADM-02 #1, #2, #21, #22; ADM-03 #1-#5, #8,
  #10.
- v1.8 demo en ejecución (67 filas): SH-01 #4; SH-02 #1, #6, #7, #9, #18-#21, #23, #26; SH-03 #1-#3, #5-#9, #11, #12,
  #14-#22, #27, #29, #32 y las columnas demo de la matriz; SH-04 #1, #2, #8, #10, #11, #13; SH-05 #1, #2, #4, #5, #7, #11;
  SH-06 #10, #11; SH-07 #2; ACC-03 #1-#5; ADM-01 #1-#3, #5-#15.
- v1.8 conectado en ejecución (100 filas; en xhigh, ninguna): SH-01 #8, #9, #12, #13; SH-03 #1, #2, #5-#11, #13, #18-#20,
  #22, #23, #25-#27, #32 y las columnas del conectado de la matriz; SH-04 #1-#4, #6, #8, #10, #11, #13; SH-05 #1-#3, #11;
  SH-06 #10, #12, #14; SH-07 #3, #10; AUTH-01 #1-#6, #8-#11, #16; AUTH-02 #1, #2, #5-#8, #11, #17; AUTH-03 #3; AUTH-04 #1-#4,
  #9, #11, #13; AUTH-06 #7, #8; ACC-01 #1-#4, #7, #9; ADM-02 #1-#3, #6-#17, #20; ADM-03 #1, #3, #6-#10, #15.

**No verificado en ejecución (sí en código), y por qué:**
- Next, porque exige escribir datos, enviar correo o condiciones que no se pueden provocar sin tocar el entorno: registro,
  recuperación y nueva contraseña completos (AUTH-02 #12-#16, AUTH-04 #5-#8, #12-#18; el formulario de AUTH-04 #13 necesita
  un enlace real); cambio de idioma (ACC-02 #4, #5); decisiones de revisión (ADM-03 #11-#14, #20); backend caído, sesión
  caducada a mitad de acción, fronteras de error y `callAction` sin red (SH-01 #10, SH-06 #5, #7, #9, #15, SH-07 #11);
  límites de intentos (AUTH-01 #13, AUTH-05 #6); configuración de producción (AUTH-03 #1, #2, AUTH-05 #2, AUTH-06 #9); el
  aviso «La revisión de cualificaciones está desactivada…» (ADM-02 #21), porque en local el flag está activo. El cierre de
  sesión local (AUTH-05 #8) se midió con dos contextos, pero no contando `auth.sessions`.
- v1.8 conectado: «Cerrar sesión» (AUTH-05 #8, sesiones compartidas con otros revisores), crear una invitación, exportar y
  cerrar la cuenta (ACC-01 #7-#12), registrar revisiones o analizar documentos (ADM-03 #11-#13, #15), enviar verificación o
  nueva contraseña (AUTH-03 #4-#6, AUTH-04 #5, #8, #16, #17), el límite 429 y la caducidad de la sesión (AUTH-01 #13,
  SH-06 #7). Quedan en código, en las capturas del 21/10 y en el README del conectado.
- v1.8 demo: «Datos y alcance», respaldo e importación (SH-02 #10-#16) y el enlace de salto (SH-07 #9) se dan por buenos con
  la verificación xhigh (sin cambios en v1.8).

**Correcciones v2** (76). La columna «Evidencia» abrevia `evidencias/v2/10/` como `v2/10/`.

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| SH-01 #4 | «Iniciar sesión» de la landing | botón con `className` propio | variante `inverse` (X-01, `ef4d9b7`), 123×40 px, ES/EN `onDark` | `v2/10/SH-01-4-next-1440-landing.jpg` |
| SH-01 #6 | Bloqueo | C-5 | — (C-5 está decidida) | `07-decisions-index.md` |
| SH-01 #12 | Evidencia | solo código | aterrizaje medido en 7 cuentas Next y en el conectado | `v2/10/SH-03-next-nav-all.json`, `v2/10/V18C-shell-runtime.json` |
| SH-01 #13 | Bloqueo y acción | SCOPE · «decisión del owner» | — (default v1.8): herramientas sin cuenta | `V1_SCOPE.md` §LATER (SCOPE-2); `v2/10/AUTH-v18c-anon-runtime.json` |
| SH-02 #7 | Acción | «promete combustible e inglés: D-11/SCOPE» | el inglés ya es LATER; el combustible sigue en D-11 | `V1_SCOPE.md` §LATER |
| SH-02 #23 | Vista Técnico y carga directa | 5 entradas; 11 entradas sin vista | 7 entradas (Oportunidades y Mis candidaturas, `db05af1`); 13 sin vista; el desbordamiento está corregido | `v2/10/SH-02-v2-views.json` |
| SH-02 #24 | Rutas y medida | ficha y elegibles | también candidaturas (`[id]/applications/page.tsx:71`); las tres con 200 y sin lateral | `v2/10/SH-02-v2-views.json` |
| SH-02 #26 | Bloqueo y acción | D-12 / SCOPE (LATER) · esperar | — (alcance LATER, D-12 provisional como default) · portar | `08-product-decisions.md` §SCOPE-2 |
| SH-03 (estado global, matriz) | Entradas nuevas y fuentes | Oportunidades y candidaturas «bloqueadas»; conectado con sesión solo en código | «Oportunidades» y «Mis candidaturas» existen (`db05af1`); matriz rehecha en ejecución en los dos lados (conectado con sesión incluido); posiciones y totales nuevos | `v2/10/SH-03-next-nav-all.json`, `v2/10/V18C-shell-runtime.json`, `v2/10/V18-demo-shell-runtime.json` |
| SH-03 #6 | Diff | `−` P1 D-06/D-07/D-12 | `=`: «Oportunidades» tras «Disponibilidad», maletín | `v2/10/SH-03-6-alpha-opportunities-next-1440.jpg` |
| SH-03 #7 | Diff | `−` P1 D-06 | `≈`: «Mis candidaturas» (literal demo), icono propio | `v2/10/ACC-v2-next-settings.json` |
| SH-03 #8 | Bloqueo | D-10 / release 2 | — en local (flag activo, medido); producción, despliegue del owner | `v2/10/SH-03-next-nav-all.json` |
| SH-03 #9, #14 | Bloqueo | SCOPE (LATER) | — (alcance LATER) | `V1_SCOPE.md` §LATER |
| SH-03 #10 | Bloqueo | D-06 / C-11 | — (avisos in-app, LATER; D-06 ratificada) | `08-product-decisions.md` §SCOPE-2 |
| SH-03 #19 | Bloqueo | D-07 | — (default v1.8; contacto/documentos siguen D-07 P3 / D-10) | idem |
| SH-03 #20 | Diff y bloqueo | `−` P1 D-06 | `≠` P2 —: candidaturas por necesidad y contador, sin lista de la organización | código `[id]/page.tsx:62-65`, `api.ts:12-26` |
| SH-03 #21 | Diff | `−` P2 D-06/D-07 | `✗` DEMO-ONLY: el conectado no enseña ofertas ajenas | `Account.jsx:69`; `v2/10/V18C-shell-runtime.json` |
| SH-03 #22 | Bloqueo y evidencia | OD-5, solo código | — (default v1.8); pantalla del conectado medida | `v2/10/V18C-emp-org-v18c-1440.jpg` |
| SH-03 #32 | Pie del admin | «Profesional · Administrador» | «Profesional · Administración de la plataforma» (X-13) | `v2/10/SH-03-next-nav-all.json` |
| SH-04 #2 | Bloqueo | D-06 / C-11 (M12) | — (avisos in-app, LATER) | `08-product-decisions.md` §SCOPE-2; `v2/10/V18C-shell-runtime.json` |
| SH-04 #3 | Rol de plataforma | «Profesional · Administrador» ambiguo; backlog 10 pendiente | «Profesional · Administración de la plataforma» (X-13); Configuración sigue con el rol de organización | `v2/10/SH-03-next-nav-all.json`, `v2/10/ACC-v2-next-settings.json` |
| SH-04 #6 | Objetivo táctil y alcance | 89×20 px con cualquier puntero; cierre global | 89×44 con puntero grueso (X-09), 89×20 con fino; cierre local (X-12) | `v2/10/AUTH-v2-next-runtime.json` (`footCoarse`) |
| SH-04 #9 | Bloqueo | C-12 | — (default v1.8, C-12) | `08-product-decisions.md` §DEFAULTS |
| SH-04 #10 | Bloqueo | C-12 | — (default v1.8) | `08-product-decisions.md` §DEFAULTS |
| SH-04 #11 | Títulos | — | también «Oportunidades» y «Mis candidaturas»; rutas denegadas «Crew Flex» | `titles.test.ts`; `v2/10/SH-02-v2-views.json` |
| SH-04 #13 | Diff | `≠` P2: el pie se sale de la ventana | `=`: el menú se desplaza dentro (X-03); pie en y = 730 a 768 px | `v2/10/SH-03-next-nav-all.json`, `v2/10/SH-04-13-platformadmin-tools-next-1366.jpg` |
| SH-05 #1-#3, #10 | Bloqueo y evidencia | C-12; conectado solo en código | — (default v1.8; «revisit after M07» ya se cumple); dock medido en los dos modos | `v2/10/SH-05-*-dock-*-390.jpg`, `v2/10/V18C-shell-runtime.json` |
| SH-06 #1 | Foco del aviso | — | X-08: el aviso recibe el foco perdido | código `Notice.tsx:33-41` |
| SH-06 #10 | `/app/no-existe` | dentro de `/app` sin lateral (200) | 404 real, título «Crew Flex», sin lateral | `v2/10/SH-02-v2-views.json` |
| SH-06 #11, #12 | Bloqueo y evidencia | D-06 / C-11; conectado solo en código | — (avisos in-app, LATER); avisos del técnico 1 medidos | `v2/10/V18C-t1-notifications-v18c-1440.jpg` |
| SH-06 #13 | Referencias | `CloseRequirement.tsx` (borrado) | `RequirementStatusActions.tsx:48-64`; líneas nuevas de `ConfirmButton`; motivos de M08 | código |
| SH-06 #14 (nueva v2) | Avisos de empresa | — | `✗`: estado en código y entradilla de técnico | `v2/10/V18C-emp-notifications-v18c-1440.jpg` |
| SH-06 #15 (nueva v2) | Fallo de red al guardar | — | `+`: `callAction` conserva el borrador (X-02) | código `Notice.tsx:60-92` |
| SH-07 #3 | Rutas de plataforma | 404 con HTTP 200 y título de la página | 404 real desde el proxy (X-11); necesidades ajenas siguen con 200 | `v2/10/SH-02-v2-views.json` |
| SH-07 #8 | Bloqueo | OD-8 | — (default v1.8, OD-8) | — |
| SH-07 #14 | Estado | defecto entero, backlog 12 pendiente | corregido en rutas de plataforma; queda en necesidades ajenas y sin lateral | `v2/10/SH-07-14-alpha-admin-next-1440.jpg` |
| SH-07 #15 (nueva v2) | Mis candidaturas con cuenta de organización | — | `≠` P3: estado vacío de técnico en vez del aviso «solo para profesionales» (defecto nuevo) | `v2/10/SH-07-v2-new-routes.json`; `applications/page.tsx:43-49` |
| AUTH-01 #1, #10, #12 | Bloqueo | C-12 / OD-8 | — (default v1.8) | `08-product-decisions.md` §DEFAULTS |
| AUTH-01 #1, #2, #5, #6, #11 | Evidencia v1.8 | demo con acceso conectado sin servidor | conectado real sin sesión; un intento fallido con una dirección nueva | `v2/10/AUTH-v18c-anon-runtime.json` |
| AUTH-01 #9 | Enlace | — | `pointer-coarse:min-h-11` (X-09) | código `login/page.tsx:29-36` |
| AUTH-02 #1, #3, #7, #14, #15 | Bloqueo | OD-8 | — (default v1.8, OD-8): alta por invitación detrás de un flag | `08-product-decisions.md` §DEFAULTS; `v2/10/AUTH-register-v18c-1440.jpg` |
| AUTH-02 #4 | Bloqueo | D-12 | — (LATER; D-12 provisional) | `V1_SCOPE.md` §LATER |
| AUTH-02 #6 | Diff | `≠` P2: 10-72 sin validación de cliente | `≈` P3: 12-72 (X-14), `minLength` nativo, el servidor rechaza 11 | `v2/10/AUTH-02-6-next-1440-registro-11-enviado.jpg` |
| AUTH-02 #8 | Bloqueo | «texto legal (CX-02)» | texto legal del owner (el de v1.8 es de beta local) | `v2/10/AUTH-register-v18c-1440.jpg` |
| AUTH-02 #10, #12, #13 | Bloqueo | OD-5 / OD-8 | — (default v1.8) | idem |
| AUTH-03 #1-#5 | Bloqueo y evidencia | OD-8; solo código y capturas 21/10 | — (default v1.8, OD-8); pantalla de verificación medida; desvío de `type=signup` medido | `v2/10/AUTH-verify-v18c-1440.jpg`, `v2/10/AUTH-v2-next-runtime.json` |
| AUTH-04 #1-#4, #9-#11 | Evidencia | código y capturas 21/10 | los dos lados en ejecución v2, sin enviar | `v2/10/AUTH-forgot-v18c-1440.jpg`, `v2/10/AUTH-v2-next-runtime.json` |
| AUTH-04 #13 | Diff | `≠` P3: 10-72 | `≈` P3: 12-72 (X-14), `minLength`/`maxLength` nativos | código `PasswordRecoveryForms.tsx:57-78` |
| AUTH-05 (estado global) | Diferencias | 12 h y cierre global | solo la de 12 h | — |
| AUTH-05 #2 | Bloqueo y acción | «decidir con el owner» | — (default v1.8): `timebox = "12h"` en local | `08-product-decisions.md` §DEFAULTS |
| AUTH-05 #3, #4 | Bloqueo | OD-8 | — (default v1.8, OD-8) | idem |
| AUTH-05 #8 | Diff | `≠` P3: cierre global | `=`: `scope: "local"` (X-12); medido con dos contextos | `v2/10/AUTH-v2-next-runtime.json` |
| AUTH-06 #7, #8 | Evidencia | código | cabeceras medidas con `curl` en los dos lados | — |
| ACC-01 #1-#4 | Evidencia | código y capturas 21/10 (v1.8) | conectado en ejecución (técnico 1, empresa, admin); Configuración medida en 4 cuentas | `v2/10/V18C-t1-privacy-v18c-1440.jpg`, `v2/10/ACC-v2-next-settings.json` |
| ACC-01 #7-#10, #16 | Bloqueo | M-3 | — (default v1.8, M-3); el cierre necesita service role justificado | `08-product-decisions.md` §DEFAULTS |
| ACC-01 #12 | Bloqueo | M-3 | — (no copiar el borrado parcial) | — |
| ACC-01 #14 | Diff | `−` P1 D-07 | `≠` P2: consentimiento del pack en la candidatura (M07); contacto sigue en D-07 P3 | código `ApplyPanel.tsx:89-97` |
| ACC-02 #1, #2 | Bloqueo | C-5 | — (C-5 decidida) | `07-decisions-index.md` |
| ACC-03 #2-#4 | Bloqueo | OD-5 / D-07 / AOG opt-in | — (default v1.8 / NEXT / LATER) | `V1_SCOPE.md`; `v2/10/V18-privacy-v18-1440.jpg` |
| ADM-01 #1-#3, #5, #8-#12, #15 | Evidencia | xhigh | puerta, error y panel de la demo medidos de nuevo | `v2/10/V18-admin-demo-v18-1440.jpg`, `v2/10/ADM-01-5-v18-1440-panel.jpg` |
| ADM-01 #5, #7-#11, #15, #17-#19, #22, #23 | Bloqueo | SCOPE | SCOPE (OUT: panel demo / back office completo); las cifras se portan en su versión conectada (ADM-02) | `V1_SCOPE.md` §OUT |
| ADM-02 (estado global) | Bloqueos | OD-8, SCOPE OUT, sin UI | invitaciones y cifras sin dinero portables (default v1.8); dinero y buzón fuera | — |
| ADM-02 (todas) | Evidencia v1.8 | código y capturas 21/10 | conectado con sesión del admin, en ejecución | `v2/10/V18C-admin-admin-v18c-1440.jpg` |
| ADM-02 #3, #4 | Bloqueo | OD-8 | — (default v1.8, OD-8) | `08-product-decisions.md` §DEFAULTS |
| ADM-02 #6-#11, #13 | Bloqueo | SCOPE | — (default v1.8; cifras operativas sin dinero) | idem; valores medidos en `v2/10/V18C-shell-runtime.json` |
| ADM-02 #14 | Bloqueo | SCOPE / OD-7 | SCOPE (OUT: back office y comisiones) / OD-7 | — |
| ADM-02 #17 | Bloqueo | OD-3 | — (default v1.8): vista de auditoría de solo lectura | `v2/10/V18C-shell-runtime.json` |
| ADM-03 (lado v1.8) | Evidencia | código y capturas 21/10 | conectado con el admin, en ejecución | `v2/10/V18C-admin-admin-v18c-1440.jpg` |
| ADM-03 #1 | Diff y bloqueo | `−` P0 OD-3 | `≠` P0 OD-3 (producción); en local, activa y medida | `v2/10/SH-02-v2-views.json` |
| ADM-03 #6, #7, #9, #10 | Bloqueo | OD-3 / OD-5 / C-10 | — (default v1.8); documentos siguen D-10 | `v2/10/V18C-shell-runtime.json` |
| SH-08 (estado global), #1-#3 | Cifras y fuente | `string-coverage.md` (xhigh): 12/3/62 · 3/0/14 · 7/5/153 | `string-coverage-v2.md` (`821c24f`): 15/3/59 · 3/0/14 · 13/5/147 | `textos/string-coverage-v2.md:20,26,49` |
| SH-08 #2, #5 | Bloqueo | D-06 / DEMO-ONLY · M-3 | avisos y directorio portables · — (default v1.8, M-3) | — |
| Todas las secciones | Referencias `archivo:línea` y `es:N` | las del xhigh (`d3b876f` y catálogo de 856 claves) | 173 referencias renumeradas al SNAP2 (`038329f`, 1026 claves) con `work/10/remap.py` y revisadas a mano las dudosas (`src/proxy.ts:47-52`, `Notice.tsx`) | código |
| Todas las secciones | Origen D-13 | «árbol de trabajo» | `d3b876f` (D-13 ya commiteado), 16 menciones | `git log` |
| Recuento | Cifras y lista de bloqueos | 314 filas; 0 `−` portables | 317 filas; 42 `−` portables ya; defectos del xhigh corregidos y uno nuevo | `work/10/count10.py` |
| Backlog | Lista | 13 tareas sin bloqueo (7 hechas) | 20 pendientes con el alcance nuevo, 14 hechas, 9 grupos bloqueados | código del SNAP2 |

## Verificación exhaustiva (xhigh, 22/10/2026)

Histórico: esta sección y «Cambios desde el 21/10/2026» se conservan como estaban en el xhigh; sus cifras, líneas y
estados son los de `5c2d1a2` + árbol de trabajo. Lo vigente está en «Verificación v2» y en las tablas.

**Método.**
- Cada fila se ha contrastado en los dos lados:
  - v1.8: `src/` vivo, `server/*.mjs` y el bundle `dist/assets/index-dtxkpGY0.js`;
  - Next: la copia congelada de las 11:16. Sus ficheros del área coinciden con el árbol vivo (comprobado con `cmp` al
    empezar y al terminar).
- Un script (`work/10/literals.py`) comprobó los literales «…» de las columnas v1.8 y Next contra el bundle, el servidor,
  `messages/es.json` y `src/`. Antes de corregir eran 660 y 48 no aparecían tal cual; tras las correcciones son 716 y no
  aparecen 67. Todos tienen explicación: compuestos, negritas, mensajes del navegador, datos del seed y títulos medidos en
  ejecución, o las listas de cadenas v1.8 de SH-08. Se releyó cada `archivo:línea`.
- En ejecución, con scripts de Playwright de solo lectura:
  - Next con `alpha`, `manager.mro`, `platform.admin`, `echo`, `admin.mro` y sin sesión, a 1440, 1366×768, 1024×768 y 390;
  - la v1.8 demo, incluido su acceso conectado sin servidor.
- Tests del área: `pnpm vitest run src/components/layout src/features/auth/state.test.ts src/server/session.test.ts`
  (43 pasan). Scripts y JSON en `work/10/` y `evidencias/xhigh/10/`.

**Cobertura.**
- En código, los dos lados: las 314 filas. SH-08 se comprobó contra `textos/string-coverage.md` y `string-diff.json`
  (22/10, 11:11), sin volver a ejecutar el extractor.
- Next en ejecución (98 filas):
  - SH-01 #4-#6, #12;
  - SH-02 #1, #2, #18-#26;
  - SH-03 #1-#5, #8, #11, #13, #16, #18, #24, #25, #27-#29, #32 y la matriz entera;
  - SH-04 #3, #4, #6, #9, #11-#13;
  - SH-05 #4, #6, #8, #9, #11;
  - SH-06 #10;
  - SH-07 #3-#7, #10, #14;
  - AUTH-01 #1, #4-#7, #9-#11, #16, #17;
  - AUTH-02 #2, #3, #5, #6, #9-#11, #17;
  - AUTH-03 #5;
  - AUTH-04 #1-#4, #9-#11;
  - AUTH-05 #7-#9;
  - ACC-01 #1, #2, #4-#6;
  - ACC-02 #3, #6;
  - ADM-01 #1, #2, #5;
  - ADM-02 #1, #2, #21, #22;
  - ADM-03 #2-#5.
- v1.8 en ejecución (101 filas):
  - SH-01 #4, #7, #8, #10, #13;
  - SH-02 #1, #3, #5, #6, #9, #10, #13, #18-#21, #23;
  - SH-03 #1-#3, #5-#12, #14-#22, #26-#29, #32 y las columnas demo y «Sin sesión» de la matriz;
  - SH-04 #1-#3, #8, #10, #13;
  - SH-05 #1-#5, #7, #8, #10;
  - SH-06 #11;
  - SH-07 #2;
  - AUTH-01 #1-#10, #14, #16;
  - AUTH-02 #2, #5-#8, #11, #17;
  - AUTH-04 #1-#4;
  - ACC-03 #1-#5;
  - ADM-01 #1-#15.

**No verificado en ejecución (sí en código):**
- v1.8 conectado con sesión, porque su servidor no está levantado. Queda en código y en las capturas del 21/10:
  - columnas «Conectado …» de la matriz;
  - SH-04 #4-#7; SH-06 #2-#8, #12;
  - AUTH-01 #11-#13, #15, #17; AUTH-02 #1, #3, #4, #9, #10, #12-#16;
  - AUTH-03; AUTH-04 #5-#19; AUTH-05; AUTH-06;
  - ACC-01; ADM-02; ADM-03 (lado v1.8).
- Next, porque exigiría escribir datos o condiciones que no se pueden provocar:
  - envíos de registro, recuperación y nueva contraseña (AUTH-02 #12-#16, AUTH-04 #5-#8, #12-#18);
  - cambio de idioma (ACC-02 #4, #5, #7);
  - decisiones de revisión (ADM-03 #10-#14, #20);
  - backend caído, sesión caducada a mitad de acción y fronteras de error (SH-01 #10, SH-06 #5, #7, #9 y SH-07 #11; esta,
    con su test, que pasa);
  - límites de intentos (AUTH-01 #13, AUTH-05 #6);
  - configuración de producción (AUTH-03 #1-#2, AUTH-05 #2, AUTH-06 #7-#9);
  - el aviso «La revisión de cualificaciones está desactivada…» de la portada, porque en local el flag está activo
    (ADM-02 #21);
  - el efecto de «Cerrar sesión» sobre otra sesión (AUTH-05 #8): no se probó con dos navegadores para no cerrar las
    sesiones de otros revisores.
- v1.8 SH-07 #9 (enlace de salto): la prueba empezó con el foco en el menú y no llegó al enlace. Queda en código y en la
  evidencia del 21/10.

**Incidencia.** A las 11:32, el script de esta área pulsó «Cerrar sesión» con `alpha` (AUTH-05 #9). Como el alcance es
`global` (AUTH-05 #8), pudo revocar los refresh tokens de otras sesiones de `alpha` abiertas en ese momento por otros
revisores. No cambia datos de negocio.

**Correcciones** (64). La columna «Evidencia» abrevia `evidencias/xhigh/10/` como `x/`.

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| SH-02 (estado global) | Descripción de «Ver como» | «no cambia el rol ni el menú» | No cambia el rol; el lateral muestra la sección de la vista activa | `x/SH-02-23-admin-nav.json` |
| SH-02 #1 | Referencias | `views.ts:3-7,30-39`, `ViewSwitcher.tsx:8-51` | `views.ts:3-13,35-48`, `ViewSwitcher.tsx:34-77`; v1.8 `AppState.jsx:88-95` | código; `x/SH-03-v18-runtime.json` |
| SH-02 #2 | Comportamiento | «recargar la conserva» | En Herramientas y Configuración la recarga pierde la vista | `x/SH-02-23-admin-nav.json` |
| SH-02 #17 | Línea v1.8 | `Company2.jsx:221` | `Company2.jsx:220` | código |
| SH-02 #18 | Línea | `ViewSwitcher.tsx:23-29` | `ViewSwitcher.tsx:49-55` | código; ejecución |
| SH-02 #20 | Líneas | `AppShell.tsx:95-100`, `ViewSwitcher.tsx:8-11,30-48` | `AppShell.tsx:103-108`, `ViewSwitcher.tsx:34-37,56-73` | código |
| SH-02 #21 | Línea | `views.ts:33` | `views.ts:42` | código |
| SH-02 #22 | Fila rota por la edición manual | Celda Next cortada («árbol de trabaj»), la #23 incrustada y una cola suelta «la vista no cambia el rol) \|»; el script no la contaba | Fila reconstruida: `≠` · — · — · «Mantener (D-13)»; `views.ts:35-48` | — |
| SH-02 #23 | Comportamiento y referencias (la corrección manual del coordinador se confirma) | «En las rutas compartidas … se mantiene la última vista elegida»; `AppShell.tsx:45-61,109` | Solo si se llega navegando dentro de la app. Con carga directa (enlace o recarga) de `/app/tools` o `/app/settings`, todas las secciones: 11 entradas y el selector. `AppShell.tsx:45-62,109`; las cuatro vistas, a 1440 y 390 | `x/SH-02-23-admin-nav.json`, `x/SH-02-23-admin-*-next-*.jpg` |
| SH-02 #24 | Evidencia | Solo código | En ejecución: «No encontrado» con HTTP 200 (#14 de SH-07) | `x/SH-07-3-next-notfound.json` |
| SH-02 #25 | Línea | `ViewSwitcher.tsx:33-42` | `ViewSwitcher.tsx:59-68`; `aria-current="true"` medido en subpáginas | ejecución |
| SH-02 (capturas) | Capturas | «no hay captura de «Ver como»» | Capturas de la mañana y de xhigh | `x/SH-02-23-*` |
| SH-03 (estado global) | Filtro por vista | No lo mencionaba | Lo menciona (SH-02 #23) | — |
| SH-03 (matriz, fuentes) | Referencias y método | `AppShell.tsx:23-54`, `views.ts:30-39`; sin ejecución | `AppShell.tsx:23-62`, `views.ts:26-48`; cuentas y anchos medidos | `x/SH-03-*-nav.json` |
| SH-03 (matriz) «Next prof. + org» | Posiciones | Herramientas 10, Configuración 11 | 9 y 10 (8 y 9 sin wallet) | `x/SH-03-alpha-nav.json`, `x/SH-03-manager-nav.json` |
| SH-03 (matriz) «Next profesional» | Posiciones | Herramientas «6 (Cuenta)», Configuración 7 | Igual con wallet; 5 y 6 sin él | `x/SH-03-single-role-nav.json` |
| SH-03 (matriz) «Next `platform_admin`» | Columna entera | «—» en Pasaporte, Cualificaciones, Disponibilidad, Documentos, Herramientas, Configuración, Necesidades y Plantilla | Posiciones por vista: Técnico 7 · Empresa 5 · Recruiter 2 · Administración 3 · sin vista 11 | `x/SH-02-23-admin-nav.json` |
| SH-03 (matriz) «Pie del lateral» | Ejemplos | Genérico | Textos medidos por cuenta | `x/SH-03-*-nav.json` |
| SH-03 #11 | Referencia de documento | `DESIGN_SYSTEM.md:43-44` (paleta) | `docs/product/DESIGN_SYSTEM.md:46-47` | código |
| SH-03 #16 | Referencia | `views.ts:8-13,30-39` | `views.ts:8-13,35-48` | código |
| SH-03 #24 | Literal | «solo managers» | «La plantilla es visible para managers y administradores» (es:826) | código; ejecución |
| SH-03 #25 | Referencias y vista | `AppShell.tsx:41-52` | `AppShell.tsx:39-43,58-60`; solo en la vista «Administración» | código; ejecución |
| SH-03 #27 | Referencias | `AppShell.tsx:45-54,103` | `AppShell.tsx:45-62`, `ViewSwitcher.tsx:25-27` | código |
| SH-03 #32 | Referencias y textos | `AppShell.tsx:110-125` | `AppShell.tsx:111-126`; textos del pie medidos | ejecución |
| SH-04 #3 | Ambigüedad y acción | «Mantener; opcional…» | «Profesional · Administrador» del `platform_admin` se puede malinterpretar: es su rol en «CrewFlex Operaciones», no el de plataforma. Acción: ajustar texto (backlog 10) | ejecución; `x/SH-02-23-admin-nav.json` |
| SH-04 #6 | Sev., medida y referencias | Sev. —; `AppShell.tsx:110-125`, `:84-93` | P3: el botón del pie mide 89×20 px, sin `pointer-coarse:min-h-11`; el de la barra, 113×36 (fino) y 113×44 (grueso). `AppShell.tsx:111-126`, `:92-101` | `x/SH-04-6-next-signout-measure.json` |
| SH-04 #9 | Referencias | `AppShell.tsx:69-82` | `AppShell.tsx:77-90` | código |
| SH-04 #13 | Fila nueva | — | `≠` P2: el lateral no se desplaza y el pie con «Cerrar sesión» queda fuera de alcance si la ventana es más baja que el lateral (937 px con el admin sin vista, 734 px con profesional + organización) | `x/SH-04-6-*`, `x/SH-04-13-v18-1366x600-lateral.jpg` |
| SH-04 (capturas) | Capturas | — | Se añaden las de xhigh | — |
| SH-05 #7 | Literal v1.8 | «Control CrewFlex» bajo el pliegue | 265 px medidos; a 390×844 cabe entero (693 px) | ejecución v1.8 |
| SH-05 #9 | Referencias y medida | `AppShell.tsx:84-93` | `AppShell.tsx:92-101`; 113×44 px con puntero grueso | `x/SH-04-6-next-signout-measure.json` |
| SH-05 #11 | Evidencia Next | Sin medida | `scrollWidth = 390` en 9 pantallas, también con «Menú» abierto | ejecución |
| SH-06 #10 | Detalle | — | 404 medido en `/no-existe`; dentro de `/app`, sin lateral | `x/SH-07-3-next-notfound.json` |
| SH-07 #3 | Comportamiento | «dan 404» | Muestran «No encontrado», pero con HTTP 200, sin lateral y con el título de la página pedida | `x/SH-07-3-next-notfound.json` |
| SH-07 #9 | Referencia | `AppShell.tsx:59-64` | `AppShell.tsx:67-72` | código |
| SH-07 #10 | Referencia y ejecución | `AppShell.tsx:69` | `AppShell.tsx:77`; aterrizajes medidos | ejecución |
| SH-07 #14 | Fila nueva | — | `+` P3: estado HTTP, título y lateral de las rutas denegadas | `x/SH-07-3-*` |
| SH-07 (capturas) | Capturas | «no aplica» | Captura de una ruta denegada | `x/SH-07-3-next-1440-alpha-admin.jpg` |
| AUTH-01 #7 | Literales y comportamiento | Mensajes resumidos («…») | Literales completos. Ningún lado muestra nada al escribir; Next añade «Revisa los campos marcados.» al enviar | `x/AUTH-02-6-v18-1440-login-11-chars.jpg`, `x/AUTH-01-7-next-1440-login-envio-vacio.jpg` |
| AUTH-01 #11 | Evidencia | Solo código | En ejecución, y conserva el correo | `x/AUTH-next-runtime.json` |
| AUTH-01 #14 | Literal v1.8 | «Failed to fetch» | Servido por HTTP: «Unexpected token '<', "<!DOCTYPE "... is not valid JSON»; «Failed to fetch» solo abierto como fichero | `x/AUTH-01-14-v18-1440-envio-sin-servidor.jpg` |
| AUTH-02 #6 | Evidencia de los dos lados | Solo código | Medido escribiendo sin enviar. v1.8 bloquea 11 caracteres al enviar y corta en 128; Next no valida en cliente, solo muestra la pista y admite 80 | `x/AUTH-02-6-*` |
| AUTH-02 #8 | Comportamiento v1.8 | «sin ella, «Acepta las condiciones de beta local.»» | El navegador bloquea antes («Please check this box if you want to proceed.»); el mensaje del servidor solo sale si se salta el cliente | `x/SH-03-v18-runtime.json` |
| AUTH-02 #11 | Diff | `=` | `≈`: el texto de espera difiere («Procesando…» / «Creando la cuenta…») | código |
| AUTH-05 (estado global) | Diferencias | Solo la caducidad de 12 h | Añade el cierre de todas las sesiones (#8) | — |
| AUTH-05 #8 | Diff, Sev. y comportamiento | `=` —: «`signOut()` con alcance local (solo esta sesión)» | `≠` P3: `signOut()` sin argumentos usa `scope: 'global'` en `@supabase/auth-js` 2.117.3 (`GoTrueClient.js:3417`) y cierra todas las sesiones; v1.8 cerraba solo la actual (`server/app.mjs:163`) | código (`node_modules`) |
| AUTH-06 #1 | Referencia | `AUTHORIZATION.md` | `docs/architecture/AUTHORIZATION.md:20-23` | código |
| ACC-01 #9 | Referencia | `V1_SCOPE.md:50` | `V1_SCOPE.md:51` | código |
| ADM-01 #1 | Referencia | `views.ts:8-13,30-39` | `views.ts:8-13,35-48` | código |
| ADM-01 (capturas) | Capturas | «Next: no hay captura de `/app/admin`» | Capturas de la mañana y de xhigh; puerta y panel v1.8 del 22/10 | `x/ADM-01-*`, `x/ADM-02-2-*` |
| ADM-02 #1 | Comportamiento y referencias | «El menú conserva sus propias secciones y suma «Plataforma › Verificaciones»»; `AppShell.tsx:41-52` | En la vista «Administración», solo «Plataforma › Verificaciones» y «Cuenta». `AppShell.tsx:39-43,58-61`, `views.ts:26-33` | `x/SH-02-23-admin-nav.json` |
| ADM-02 #6 | Línea v1.8 | `Operations.jsx:4` | `Operations.jsx:5` | código |
| ADM-02 (capturas) | Capturas | «no hay captura de la portada» | Capturas de la mañana y de xhigh | `x/ADM-02-2-next-1440-admin.jpg` |
| ADM-03 #1 | Precisión | — | En local, con las tres capas activas, la cola funciona | ejecución |
| SH-08 (estado global) | Método | «`string-coverage.md` … no se ha regenerado» | Se regeneró el 22/10 a las 11:11; las cifras salen de ese fichero | `textos/string-coverage.md` |
| SH-08 #1 | Cifras | 78: 13 · 3 · 62 | 77: 12 · 3 · 62 | `string-coverage.md:26` |
| SH-08 #2 | Cifras | 18: 3 · 15 | 17: 3 · 0 · 14; exactas «Iniciar sesión», «Administración», «ADMINISTRACIÓN» | `string-coverage.md:49` |
| SH-08 #3 | Cifras y listas | 167: 8 · 5; lista «en el alcance» | 165: 7 · 5 · 153; listas reales de exactas y próximas | `string-coverage.md:20`, `string-diff.json` |
| SH-08 (capturas) | Fuente | «`string-coverage.md` del 21/10» | «regenerado el 22/10» | — |
| Recuento (mayor severidad) | Lista | 3 diferencias; «5-7 entradas frente a las 9-10» | Añade SH-04 #13; precisa 9-10 entradas con profesional + organización | `x/SH-03-*-nav.json` |
| Recuento | Defectos nuevos | «no aparece ningún defecto nuevo de Next» | Cinco: SH-04 #13 (P2); SH-04 #3, SH-04 #6, SH-07 #14 y AUTH-05 #8 (P3) | — |
| Backlog 6 | Referencia «Comprobado» | `AppShell.tsx:112-116` | `AppShell.tsx:112-117` | código |
| Backlog | Estado | 7 HECHAS y 1 PENDIENTE | 7 HECHAS y 6 PENDIENTES (3, 9-13); la 3, comprobada de nuevo en ejecución | — |
| Cabecera, Recuento | Recuentos | 312 · = 28 · ≈ 78 · ≠ 36 · − 72 · + 56 · ✗ 42 | 314 · = 26 · ≈ 79 · ≠ 38 · − 72 · + 57 · ✗ 42; severidades P0 2 · P1 18 · P2 34 · P3 76 | `work/10/count10.py` |

**Respuestas a los puntos pedidos.**
- **Bloque D-13** (SH-02 #1-#26, SH-03, ADM-01/02): confirmado en ejecución. La fila SH-02 #23 corregida a mano es
  correcta en lo esencial (el menú se filtra por vista), pero tenía dos huecos:
  - la recarga de Herramientas o Configuración muestra todas las secciones;
  - la fila #22 quedó rota.
- **Contraseña mínima:** v1.8, 12-128 en el HTML y en el servidor (`Account.jsx:38`, `server/app.mjs:14`); Next, 10-72
  (`auth.ts:20-23`, `config.toml:184`). Escribiendo sin enviar, ninguno de los dos muestra nada:
  - v1.8 bloquea al enviar (mensaje nativo en inglés);
  - Next no valida en cliente (`noValidate`, sin `minLength`) y solo enseña la pista «Al menos 10 caracteres.».
  - Sigue PENDIENTE (backlog 3).
- **Pie «Profesional · Administrador»:** sí se puede malinterpretar (SH-04 #3, backlog 10).
- **«Cerrar sesión» del pie:** 89×20 px con cualquier puntero (SH-04 #6, backlog 11). Además, el lateral no se desplaza:
  con el `platform_admin` sin vista queda fuera de alcance a 1366×768 y 1024×768, y con profesional + organización en
  ventanas de menos de 734 px de alto (SH-04 #13, backlog 9).
- **Matriz SH-03:** rehecha en ejecución. Había dos columnas de Next con posiciones erróneas, y la del `platform_admin`
  estaba vacía.
- **Login y registro v1.8:** textos y estados de cliente medidos en el acceso conectado del modo demo (AUTH-01 #2-#10,
  #14 y AUTH-02 #2, #5-#8).

## Cambios desde el 21/10/2026

Primero las 18 filas que cambian de veredicto, después las 11 nuevas y al final las 24 que solo cambian de contenido o
severidad. «Árbol de trabajo» = cambios sin commit de D-13 (22/10).

| Fila | Elemento | Antes | Ahora | Origen (commit o «árbol de trabajo») |
|---|---|---|---|---|
| SH-02 #1 | Selector «Probar como» | `✗` DEMO-ONLY | `≠` P3: «Ver como» solo para `platform_admin`, sobre su propia cuenta | árbol de trabajo (D-13) |
| SH-02 #2 | Rol no persistido | `✗` DEMO-ONLY | `+`: la vista es la URL; el admin entra en `/app/admin` | árbol de trabajo (D-13) |
| SH-03 #16 | «Control CrewFlex» | `✗` DO-NOT-COPY | `≠`: vista «Administración» de «Ver como» | árbol de trabajo (D-13) |
| SH-04 #3 | Rol visible | `−` P3 (backlog 6) | `≈` P3: tipo de cuenta · rol bajo el nombre, solo `lg+` | `d12164a` (W2-06) |
| SH-04 #4 | Kicker y email del espacio | `−` P3 (backlog 5) | `≈` P3: correo en Configuración | `a770aed` (W2-05) |
| SH-07 #10 | Aterrizaje del administrador | `≠` P3 OD-3 | `=`: `/app` → `/app/admin` | árbol de trabajo (D-13) |
| SH-07 #11 | Sesión válida sin perfil legible | `≠` P2: bucle `/app` ↔ `/login` | `+`: frontera de error con «Cerrar sesión», sin bucle | `d275254` (W1-01) |
| AUTH-01 #13 | Límite de intentos | `−` P2 (backlog 2) | `≈`: «Demasiados intentos. Espera unos minutos e inténtalo de nuevo.» | `f143741` (W2-08) |
| AUTH-04 #12 | Aviso sobre sesiones | `≠` P3: «demás sesiones» | `+`: «…todas tus sesiones, también esta.» | `18b7cae` (W1-08) |
| AUTH-04 #20 | Documentación (CX-07) | `≠` P3: decía `others` | `=`: cita `global` | `18b7cae` (W1-08) |
| AUTH-05 #9 | Cerrar sesión: confirmación | `−` P3 (backlog 7) | `=`: «Sesión cerrada.» | `01486a3` (W2-07) |
| ACC-01 #5 | Email | `−` P3 (backlog 5) | `≈`: «Correo electrónico» de los claims del JWT | `a770aed` (W2-05) |
| ACC-01 #6 | Organización mostrada | `≠` P3: `memberships[0]` | `+`: `primaryMembership`, como el menú | `c7956b2` (W1-09) |
| ADM-01 #1 | Entrada «Control CrewFlex» | `✗` DO-NOT-COPY | `≠`: vista «Administración», solo `platform_admin` | árbol de trabajo (D-13) |
| ADM-01 #5 | Cabecera del panel | `−` P3 SCOPE | `≠` P3 SCOPE: portada «Administración» sin panel | árbol de trabajo (D-13) |
| ADM-02 #1 | Navegación del admin | `≠` P3 OD-3 | `≈`: aterriza en `/app/admin` y tiene «Ver como» | árbol de trabajo (D-13) |
| ADM-02 #2 | Cabecera | `✗` (botón defectuoso) | `≈` P3: eyebrow «Plataforma», `h1` «Administración» | árbol de trabajo (D-13) |
| ADM-03 #20 | Servicio apagado en la acción | `≠` P3: mensaje en inglés | `+`: clave del catálogo; la UI dice «Este elemento ya no existe. Recarga la página.» | `135085c` (W1-04) |
| SH-02 #18 (nueva) | Etiqueta del selector | — | `≈`: «Ver como» | árbol de trabajo (D-13) |
| SH-02 #19 (nueva) | Opciones | — | `≈`: Técnico · Empresa · Recruiter · Administración | árbol de trabajo (D-13) |
| SH-02 #20 (nueva) | Control y ubicación | — | `≈`: enlaces encima del menú, no `<select>` | árbol de trabajo (D-13) |
| SH-02 #21 (nueva) | Quién lo ve y dónde | — | `≠`: solo `platform_admin`, en todas las pantallas | árbol de trabajo (D-13) |
| SH-02 #22 (nueva) | Vistas según la cuenta | — | `≠`: Técnico con cuenta profesional, Empresa con membresía | árbol de trabajo (D-13) |
| SH-02 #23 (nueva) | Efecto en el menú | — | `≈`: el menú se filtra por vista (corte de las 11:05) | árbol de trabajo (D-13) |
| SH-02 #24 (nueva) | Datos que se ven | — | `≠`: la propia cuenta, sin suplantación; 404 en necesidades ajenas | árbol de trabajo (D-13) |
| SH-02 #25 (nueva) | Vista activa | — | `≈`: `aria-current` | árbol de trabajo (D-13) |
| SH-02 #26 (nueva) | Vista «Recruiter» | — | `−` P3 D-12 / SCOPE: marcador «Próximamente» | árbol de trabajo (D-13) |
| ADM-02 #21 (nueva) | Revisión desde la portada | — | `≈` OD-3: botón con el flag, aviso sin él | árbol de trabajo (D-13) |
| ADM-02 #22 (nueva) | Herramientas del admin | — | `≈`: panel «Herramientas» | árbol de trabajo (D-13) |
| SH-01 #12 | Destino tras entrar | `≈` P3: el admin aterriza en su perfil | `≈`: el admin aterriza en `/app/admin` | árbol de trabajo (D-13) |
| SH-03 #25 | «Administración» / «Verificaciones» | `≈` P0 | `≈` P0; además, portada `/app/admin` fuera del menú | árbol de trabajo (D-13) |
| SH-03 #32 | Persona del lateral | `≈` P3: solo el nombre | `≈`: nombre + tipo de cuenta · rol | `d12164a` (W2-06) |
| SH-04 #6 | «Cerrar sesión» | `≈` P3: sin mensaje posterior | `≈`: luego «Sesión cerrada.» | `01486a3` (W2-07) |
| SH-04 #11 | Título de pestaña | `+` | `+`: mismo nombre que el menú | `fd01c52` (W3-07) |
| SH-06 #8 | Carga | `≈` | `≈`: pulso solo con `motion-safe` | `6ac67d2` (W3-06) |
| SH-06 #9 | Error inesperado | `+` | `+`: nueva frontera raíz con «Cerrar sesión» | `d275254` (W1-01) |
| SH-06 #13 | Confirmaciones destructivas | `+` | `+`: también quitar cualificación y eliminar ventana | `73de8ff` (W1-10) |
| SH-07 #3 | Pantalla de otro rol | `+` | `+`: 404 en `/app/admin`, `/app/recruiter` y necesidades ajenas | árbol de trabajo (D-13) |
| AUTH-01 #17 | Banner tras restablecer | `≈` | `≈`: tiene prioridad sobre `signedOut` | `01486a3` (W2-07) |
| AUTH-02 #4 | Recruiter | `≈` P2 | `≈` P2; además, vista de marcador para el admin | árbol de trabajo (D-13) |
| AUTH-04 #6 | Límite en la recuperación | `≠` P3 | `≠` P3: el 429 se reconoce y, a propósito, no se muestra | `f143741` (W2-08) |
| AUTH-05 #6 | Límites | `≈` P2: sin mensaje | `≈` P3: con mensaje propio | `f143741` (W2-08) |
| AUTH-05 #8 | Cerrar sesión: efecto | `=` | `=`: → `/login?signedOut=1` | `01486a3` (W2-07) |
| AUTH-06 #1 | Origen del rol (demo) | `✗` | `✗`: «Ver como» no cambia el rol | árbol de trabajo (D-13) |
| ACC-01 #4 | Datos de la cuenta | `≈` | `≈`: añade «Correo electrónico» | `a770aed` (W2-05) |
| ACC-02 #7 | Teclado del idioma | `+` P3: sin flechas | `+`: flechas y una parada de tabulación | `e37e95c` (W3-05) |
| ADM-01 #2 | Puerta | `✗` | `✗`: `/app/admin` da 404 sin rol | árbol de trabajo (D-13) |
| ADM-03 #1 | Disponibilidad de la revisión | `−` P0 | `−` P0; la portada dice que está desactivada | árbol de trabajo (D-13) |
| ADM-03 #5 | Nota sobre evidencias | `≠` P3: desfasada (NX-04) | `≠` D-10: ya coincide con el código | `18b7cae` (W1-08) |
| SH-08 #1 | `LegacyApp.jsx` | `≈` 10 / 2 / 66 | `≈` 13 / 3 / 62 | árbol de trabajo (D-13) |
| SH-08 #2 | `ConnectedShell.jsx` | `−` 1 / 17 | `−` 3 / 15 | árbol de trabajo (D-13) |
| SH-08 #3 | `Account.jsx` | `≈` 6 / 5 | `≈` 8 / 5 | `01486a3` (W2-07) |
| SH-08 #4 | Errores de acceso sin clave | `≈` P2 | `≈`: existe `RATE_LIMITED` | `f143741` (W2-08) |

Otras 83 filas solo cambian referencias de línea: `es:N` (catálogo renumerado), `AppShell.tsx`, `actions.ts` (con
`mapAuthError` movido a `state.ts`), `session.ts`, `state.ts`, `login/page.tsx`, `LocaleSwitcher.tsx`, `Notice.tsx`,
`ProfileForm.tsx` y las páginas de organización. No se ha quitado ninguna fila.

Recuento del refresco de la mañana: 312 filas (antes 301) · `=` 28 (25) · `≈` 78 (65) · `≠` 36 (36) · `−` 72 (77) · `+` 56
(51) · `✗` 42 (47). Tras la verificación xhigh: 314 filas · `=` 26 · `≈` 79 · `≠` 38 · `−` 72 · `+` 57 · `✗` 42.

**Fuentes.**
- v1.8 estático:
  - `out/v18-static.md` §1-§2;
  - `out/parts/00-arch.md`, `00-nav.md`, `C-connected-admin.md` (§3.1-3.4, 3.12-3.15, 4.4) y `B-server-data.md` (§5);
  - releído en `v18-pkg/src/LegacyApp.jsx`, `src/beta/{ConnectedShell,Account,Operations}.jsx`, `src/features/AdminOverview.jsx`
    y `server/connected.mjs:34-38` para los literales y fórmulas que se citan.
- v1.8 runtime:
  - demo: `out/v18-runtime-demo.md` §1, §2.C, §2.G, §2.D, §2.M;
  - conectado: `out/v18-runtime-connected.md` §0-§2 (leído al final, versión de las 14:16).
- Next:
  - `out/next-static.md` §0-§3, §7-§8, comprobado en el código;
  - `memory-bank/07-decisions-index.md`, `docs/product/{V1_SCOPE,DESIGN_SYSTEM,OPEN_DECISIONS,SECURITY_PRIVACY}.md`;
  - `docs/integration/crewflex-v13/10-master-matrix.md` (M00, M01, M13) y `14-decision-pack.md`;
  - `supabase/config.toml` (configuración Auth **local**; la de producción no se puede leer).
- Next, revisión del 22/10:
  - ficheros de `git diff --name-only 51c835a` + no versionados (`views.ts`, `ViewSwitcher.tsx`, `admin/page.tsx`,
    `recruiter/page.tsx`), releídos en el código;
  - tareas W de `docs/integration/crewflex-v13/16-html-v18-diff.md`, comprobadas una a una en el código (no se da por
    buena la marca «VERIFIED»);
  - D-13 en `docs/integration/crewflex-v13/08-product-decisions.md` y `docs/product/V1_SCOPE.md` (árbol de trabajo).
- Textos: `textos/string-diff.json` regenerado el 22/10 sobre el `messages/es.json` actual, filtrado por los ficheros
  del alcance (ver SH-08).

**Rutas.**
- v1.8: relativas a `v18-pkg/`.
- Next: relativas a `~/pau/Crew_Flex`; `es:N` = `messages/es.json:N` del árbol de trabajo del 22/10 (todas las
  referencias `es:N` se han renumerado: el catálogo creció de 802 a 856 claves).
- Capturas v1.8: `evidencias/shots/demo/…` y `evidencias/shots/connected/…` bajo `` (2026-10-21).
- Capturas Next:
  - `docs/audit/evidence/v18-compare/next-after/*` son del **lote 11** (`14bd7c4`), anteriores a los lotes 13-19 y en inglés;
  - `docs/audit/evidence/local-*` llevan su commit al citarlas;
  - `deployed-*` son del 2026-10-09 (`ff01048`), es decir, de antes de la release 1.

**Cómo leer la columna Bloqueo.** Desde v2:
- «— (v2: default v1.8, id)»: decisión abierta que ya no bloquea; se porta el comportamiento v1.8 como default técnico
  documentado y reversible (`08-product-decisions.md` §DEFAULTS).
- «— (v2: desbloqueado, alcance LATER)»: era SCOPE LATER y ahora es alcance (SCOPE-2).
- Siguen bloqueando: SCOPE (OUT), D-07 P3, D-10, OD-3 en producción, «texto legal (owner)» y DEMO-ONLY / DO-NOT-COPY.
- C-5 y D-13 están decididas: se citan como origen, no bloquean.

Ids (del xhigh):
- OD-3: activación de la revisión de cualificaciones.
- OD-5: KYB de organizaciones.
- OD-7: modelo comercial.
- OD-8: política de confirmación por correo, que incluye «solo por invitación» (`10-master-matrix.md:98`).
- D-06: máquina de candidaturas.
- D-07: consentimientos y desbloqueo de identidad/contacto/documentos.
- D-10: escáner antes de compartir documentos.
- D-12: modelo recruiter.
- D-13: «Ver como» para `platform_admin` sobre su propia cuenta (owner, 22/10/2026). Está decidida: se cita como
  origen, no bloquea.
- C-12: dock e identidad visual (`14-decision-pack.md`).
- M-3: retención al cerrar una cuenta y exportar (`14-decision-pack.md:37`).
- T22: «require current password» en Auth.
- SCOPE: fuera de `V1_SCOPE.md` NOW.
- DEMO-ONLY / DO-NOT-COPY: clases de `10-master-matrix.md`.

Las secciones visuales del shell (colores, breakpoints, iconos, marca, foco, enlace de salto) están detalladas en
`50-visual-meta-a11y.md` (VIS-06, VIS-07, VIS-08, A11Y-01, A11Y-02, A11Y-03, META-02, META-03, I18N-03). Aquí se tratan
desde el punto de vista funcional y solo se remite a ellas.

---

## SH-01 · Modos de ejecución y entrada — v1.8 `S-DEMO-01, S-CON-00, S-CON-00a, D-CON-01, C-GLOBAL-00/01` ↔ Next `N-ROOT-01, N-APP-01, N-APP-02`

**Estado global:** PARCIAL. Next tiene un único modo autenticado y una landing pública. Todo el andamiaje de modos
de v1.8 (demo, conectado, conmutador y persistencia del modo) es demo-only. Lo que cambia para el usuario es esto:
- se entra por la landing y el login, no por una demo poblada;
- las herramientas exigen cuenta.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Modos | Dos aplicaciones en el mismo HTML: `demo` (`AppProvider`+`Shell`, datos en IndexedDB) y `connected` (`ConnectedShell`→`Account`, `fetch('/api/*')`) (`src/LegacyApp.jsx:89-95`) | Un único modo: sesión Supabase y datos reales bajo RLS (`src/app/app/layout.tsx:6`, `src/server/session.ts:41-79`) | ≠ | — | — | Mantener (V18-01 «current-improvement») |
| 2 | Elección del modo inicial | Con `file:` siempre demo. Con `location.search` o `#account`, conectado. Si no, `localStorage['crewflex-workspace-mode']` o demo (`LegacyApp.jsx:90`) | No hay modos. `/` es pública y `/app*` sin sesión redirige con 307 a `/login?next=…` (`src/proxy.ts:47-52`) | ✗ | — | DEMO-ONLY | No portar |
| 3 | Persistencia del modo | `crewflex-workspace-mode` se escribe en cada cambio; `choose()` hace `replaceState('#home')` y sube el scroll (`LegacyApp.jsx:92-93`) | — | ✗ | — | DEMO-ONLY | No portar |
| 4 | Pantalla de entrada | No hay landing: se abre la demo en `#home` con el perfil Técnico · Marcos B. (runtime demo §1.2) | Landing `/` (`src/app/page.tsx:10-50`): eyebrow «Personal de mantenimiento aeronáutico», `h1` «Convierte cualificaciones, disponibilidad y demanda en capacidad técnica movilizable.», lead, «Crear cuenta» → `/register`, «Iniciar sesión» → `/login` (desde X-01, `ef4d9b7`, variante `inverse` de `ButtonLink`: texto blanco y borde blanco al 40 % sobre navy; medido 123×40 px, `src/app/page.tsx:33-38`), lista «Flujo centrado en la capacidad» de 5 pasos (es:84-97); ES/EN con `onDark` (`src/app/page.tsx:22`). En ejecución (v2): `evidencias/v2/10/SH-01-4-next-1440-landing.jpg` | + | — | — | Mantener |
| 5 | Landing con sesión abierta | n/a | `/` no comprueba la sesión: muestra los mismos CTA. «Iniciar sesión» lleva a `/app` a través del proxy (`src/proxy.ts:77-82`) | + | P3 | — | Opcional: «Ir a mi espacio» cuando hay sesión |
| 6 | Idioma en la entrada | Solo español | ES/EN compacto en la landing y en auth (`src/app/page.tsx:22`, `src/app/(auth)/layout.tsx:21`) | + | — | — (v2: antes C-5; C-5 está decidida) | Mantener (ver ACC-02) |
| 7 | Paso de la demo a la cuenta | Franja «Estás explorando datos de demostración.» con «Entrar en mi cuenta conectada», más la entrada de menú «Mi cuenta» → `onConnected()` (`LegacyApp.jsx:43,71,87`) | — | ✗ | — | DEMO-ONLY | No portar |
| 8 | Vuelta a la demo | «Ver demo» (cabecera) y «Volver a la demo» (pie del lateral) sin cerrar la sesión (`ConnectedShell.jsx:13`; `evidencias/shots/connected/C-GLOBAL-01-demo-from-connected-1440.png`) | — | ✗ | — | DEMO-ONLY | No portar |
| 9 | Banda del modo conectado | «**Cuenta conectada al servidor local.** Datos de tu cuenta, sin personajes ficticios. Los correos externos siguen pendientes.» (`ConnectedShell.jsx:13`) | — | ✗ | — | DEMO-ONLY | No portar: describe una beta local |
| 10 | Servidor no disponible | «Abre esta pantalla desde el servidor local de CrewFlex. El HTML independiente contiene solo herramientas y demo.» (`Account.jsx:30`). Después, cada envío muestra el error crudo, p. ej. «Unexpected token '<', "<!DOCTYPE "... is not valid JSON» (`evidencias/shots/demo/D-CON-03-login-sin-servidor-1440.png`) | Backend caído: «Servicio no disponible» / «Crew Flex no ha podido contactar con el backend. Comprueba tu conexión y reintenta.» (es:211-213). En auth: «No se ha podido contactar con el servicio de autenticación. Reintenta.» (es:148) | ≈ | — | — | Mantener (Next no muestra errores crudos) |
| 11 | `Account` dentro del Shell demo (S-CON-00a) | En `file://` con `#account` o `?x`: `<h1>` «Tu espacio CrewFlex», pestañas internas `aria-pressed` y el error de servidor (`LegacyApp.jsx:45,49,90`) | — | ✗ | — | — | No portar (rama accidental) |
| 12 | Destino tras entrar | `#home`; el admin pasa a `#admin` (`ConnectedShell.jsx:11`) | `next` seguro (`src/features/auth/state.ts:31-35`) o `/app`, que lleva al `platform_admin` a `/app/admin` y al resto a `/app/organization` si hay membresía o a `/app/professional` (`src/app/app/page.tsx:6-8`, `d3b876f`). En ejecución (v2): `platform.admin` → `/app/admin`; `alpha`, `manager.mro`, `charlie` y `admin.mro` → `/app/organization`; `echo` y `hotel` → `/app/professional` (`evidencias/v2/10/SH-03-next-nav-all.json`). v1.8 conectado: el admin entra en `#admin` y los demás en `#home` (`evidencias/v2/10/V18C-shell-runtime.json`) | ≈ | — | — | Mantener (el admin ya aterriza en «Administración», SH-07 #10) |
| 13 | Herramientas sin cuenta | En conectado, `page==='tools'` se resuelve antes que la sesión (`Account.jsx:35`). El login lo anuncia: «Las herramientas se pueden utilizar sin abrir una cuenta.» | `/app/tools` exige sesión (`src/proxy.ts:47-52`). En v1.8 conectado, sin sesión el lateral ofrece «Acceder a mi cuenta» · «Herramientas» (en ejecución, `evidencias/v2/10/AUTH-v18c-anon-runtime.json`) | ≠ | P2 | — (v2: default v1.8; antes SCOPE) | Portar como default v1.8: herramientas también sin cuenta (ruta pública fuera de `/app`), sin guardar nada en servidor. Alinear con `40-tools-learning.md` TOOL-01 #1 |
| 14 | Service worker | Registra `/sw.js` fuera de `file:` (`src/main.jsx:6`) | Ninguno | − | P3 | NEW-01 | Ver META-03 |

**Información útil que se pierde con el andamiaje demo.** Dos cosas:
- La demo enseña el producto sin cuenta. En Next solo se ve tras registrarse, salvo con las personas del seed local
  (`supabase/seed.sql`).
- La banda y el banner explicaban qué es simulado (correo externo, cobros). Next no tiene nada equivalente porque no
  simula nada.

Capturas: v1.8 `evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `evidencias/shots/connected/C-GLOBAL-00-demo-entry-1440.png`,
`evidencias/shots/connected/C-GLOBAL-01-demo-from-connected-1440.png`, `evidencias/shots/demo/D-CON-01-conectada-1440.png`,
`evidencias/shots/demo/D-CON-03-login-sin-servidor-1440.png`. Next `docs/audit/evidence/deployed-1440-home.jpg` (landing,
`ff01048`, 2026-10-09).
Capturas v2: Next `evidencias/v2/10/SH-01-4-next-1440-landing.jpg`; v1.8 conectado sin sesión `evidencias/v2/10/AUTH-login-v18c-1440.jpg`.

---

## SH-02 · Utilidades de demostración — v1.8 `S-DEMO-02, S-COM-05, S-MOD-TEC-08, S-SYS-01/02, D-GEN-01, D-GEN-03` ↔ Next `N-APP-03`, `ViewSwitcher` (D-13)

**Estado global:** NO PORTAR, salvo el selector de rol. El resto no tiene sentido con datos reales: personajes, vista
móvil, banners, «Datos y alcance», respaldo, importación y restablecimiento. Lo útil que había detrás (portabilidad de
datos) se trata en ACC-01 como exportación RGPD.

Desde el 22/10 (D-13, `d3b876f`) «Probar como» tiene un equivalente adaptado, «Ver como» (#1, #2 y #18-#26):
- solo lo ve el `platform_admin`;
- enlaza a sus propias vistas: no cambia el rol y siempre muestra los datos de su propia cuenta; el lateral muestra
  solo la sección de la vista activa más «Cuenta» (#23);
- la vista «Recruiter» es un marcador «Próximamente».

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Selector «Probar como» | `<label class="role-control"><span>Probar como</span><select aria-label="Rol de demostración">` con «Técnico» · «Empresa» · «Recruiter». Al cambiar llama a `switchRole`: va a `home` y cierra el menú (`src/context/AppState.jsx:88-95`; en ejecución, de `#profile` a `#home`). Oculto en `account`, `tools`, `learning` y `admin-demo` (`LegacyApp.jsx:84-87`) | El rol sigue saliendo de la BD: `account_type`, membresías y `platform_role` (`src/server/session.ts:41-79`). Equivalente adaptado (D-13): solo el `platform_admin` ve «Ver como», con enlaces a las vistas de su propia cuenta; elegir una no cambia el rol (`src/components/layout/views.ts:3-13,35-48`, `ViewSwitcher.tsx:34-77`, `d3b876f`; en ejecución v2, `evidencias/v2/10/SH-02-v2-views.json`). Detalle en #18-#26 | ≠ (antes ✗) | P3 | — (D-13) | Mantener (D-13). Para QA por rol siguen las cuentas del seed |
| 2 | Rol no persistido | Tras recargar vuelve a `technician` (`src/context/AppState.jsx:11`) | La vista es la URL: recargar la conserva en sus propias páginas. En las compartidas (Herramientas, Configuración) la recarga la pierde y el lateral muestra todas las secciones (#23; medido de nuevo en v2: 4 secciones y 13 entradas). Al entrar, `/app` lleva al `platform_admin` a `/app/admin` (`src/app/app/page.tsx:7`; en ejecución) | + (antes ✗) | — | — | Mantener |
| 3 | Barra de personajes | `section.demo-switcher` «Personajes de demostración» (`src/features/DemoSwitcher.jsx:4-10`). Técnico: «Prueba otro técnico» / «Datos ficticios · cambios guardados en este navegador», select «Personaje técnico» (112 opciones) y contador «+108 técnicos · +15 empresas · +60 ofertas». Empresa y recruiter: «Explora otra organización», select «Organización de demo» | — | ✗ | — | DEMO-ONLY (TD-08/09) | No portar |
| 4 | Toast al cambiar de personaje | «Personaje técnico de demo seleccionado» (`AppState.jsx:420`); sin toast al cambiar de organización | — | ✗ | — | DEMO-ONLY | — |
| 5 | Vista móvil simulada | Botón `aria-label`/`title` «Vista móvil» (Smartphone) ↔ «Vista escritorio» (Monitor). Clase `phone-preview`, columna de 520 px y sin dock (`LegacyApp.jsx:87`; `evidencias/shots/demo/D-GEN-03-vista-movil-preview-1440.png`) | — | ✗ | — | DEMO-ONLY (TD-05) | No portar (VIS-06 #12) |
| 6 | Banner general | «**Recorrido de ejemplo** · Datos simulados guardados en este navegador; separados de Mi cuenta.» + «Ver alcance» (ArrowUpRight) → `demo` (`LegacyApp.jsx:87`) | — | ✗ | — | DEMO-ONLY | No portar |
| 7 | Banner en herramientas | «**Herramientas de trabajo** · Conversores, combustible e inglés en tu espacio CrewFlex.» | — | ✗ | — | DEMO-ONLY | No portar el banner (el inglés y las siglas son ya alcance LATER; el combustible sigue en D-11) |
| 8 | Banner en cuenta | «**Cuenta de beta local** · Datos en el servidor local. Correo externo pendiente.» | — | ✗ | — | DEMO-ONLY | — |
| 9 | Entrada «Datos y alcance» | Botón del pie del lateral con icono Info 18 → `demo`; breadcrumb «Datos y alcance» (`LegacyApp.jsx:81-82`) | — | ✗ | — | DEMO-ONLY | — |
| 10 | Cabecera de «Datos y alcance» | kicker «CREWFLEX V1.6» (sic), `h1` «Datos y alcance.», «Guarda un respaldo completo antes de trasladar la demo a otro navegador.» (`src/components/v11/DataPanel.jsx:4-46`) | — | ✗ | — | DEMO-ONLY | — |
| 11 | Respaldo completo | «Exportar datos y archivos» / «Generando respaldo…» → toast «Respaldo preparado. Descárgalo desde el enlace.» → «Descargar respaldo completo» (`CrewFlex-v1.2-respaldo.json`, `{format:'CrewFlexBackup',version:1,state,files}`) | — | ✗ | — | DEMO-ONLY (TD-88/89) | No portar. La necesidad real (exportar tus datos) está en ACC-01 #6 |
| 12 | Importación | Campo «Seleccionar respaldo JSON» (>50 MB: «El respaldo debe ocupar menos de 50 MB.»). Modal «{nombre}.json. Se sustituirá el estado de esta V1.6. Puedes exportar el estado actual antes.» con «Exportar estado actual» y «Validar e importar». Errores: «El archivo no contiene un estado CrewFlex válido.», «Lista de archivos inválida.», «Archivo inválido.», «Un archivo supera el máximo de 2 MB.», «El respaldo no incluye todos sus archivos.» | — | ✗ | — | DEMO-ONLY | — |
| 13 | «Qué cambia en V1.6» | 8 viñetas de novedades (`DataPanel.jsx`) | — | ✗ | — | — | No portar (changelog de prototipo) |
| 14 | «Límites de la demo» | «La selección de rol permite probar el producto. Todos los datos pertenecen a una sesión local: no existe autenticación real, sincronización, servidor de permisos ni almacenamiento remoto.» + 2 párrafos (simulación de canales, cobros y fiscalidad; protección documental) | — | ✗ | — | — | No portar. Pierde una declaración explícita de lo que **no** hace el producto (cobros, contratación legal, verificación externa). Si se quiere, va en una página de ayuda aparte (sin id de decisión) |
| 15 | Pantalla de carga demo | `<h1>` «CrewFlex V1.2» + «Cargando datos y documentos…» (`AppState.jsx:96,120`) | `loading.tsx`: esqueleto + «Cargando…» sr-only (`src/app/app/loading.tsx`, es:18) | ≈ | — | — | Mantener |
| 16 | Recuperación de estado corrupto | «CrewFlex V1.2», «Los datos originales se conservan. Puedes importar un respaldo o abrir un ejemplo nuevo en esta versión.», «Importar respaldo de recuperación», «Abrir ejemplo nuevo V1.2» (`AppState.jsx:96-120`) | — | ✗ | — | DEMO-ONLY | — |
| 17 | «Restablecer ejemplo V1.6» | En Organización de la demo, rol empresa/recruiter (`Company2.jsx:220`) | — | ✗ | — | DEMO-ONLY (CO-06) | — |
| 18 (nueva) | Etiqueta del selector | «Probar como», visible solo a más de 1200 px (`src/styles/v11.css:5`), y `aria-label="Rol de demostración"` en el `<select>` (`LegacyApp.jsx:84`) | «Ver como»: encabezado visible del bloque (en mayúsculas, a todos los anchos) y nombre accesible de su `<nav aria-labelledby>` (`ViewSwitcher.tsx:49-55`, es:74; en ejecución, «VER COMO» a 1440 y dentro de «Menú» a 390) | ≈ | — | — | Mantener (D-13) |
| 19 (nueva) | Opciones | `<option>` «Técnico» · «Empresa» · «Recruiter». «Control CrewFlex» va aparte, como entrada del menú (`LegacyApp.jsx:43,84`) | Cuatro enlaces: «Técnico» → `/app/professional`, «Empresa» → `/app/organization`, «Recruiter» → `/app/recruiter`, «Administración» → `/app/admin` (`views.ts:8-13`, es:75-79) | ≈ | — | — | Mantener |
| 20 (nueva) | Control y ubicación | `<select>` en la cabecera blanca, a la derecha; cambia de rol en cuanto cambia el valor. En móvil sigue en la cabecera, sin el texto (`LegacyApp.jsx:84`; `src/styles/refinement.css:6`) | Lista de enlaces en rejilla de 2 columnas al principio del lateral, antes de las secciones. En `<lg` queda dentro del desplegable «Menú». Son enlaces y no un `<select>` para no navegar al cambiar (WCAG 3.2.2) (`AppShell.tsx:109-114`, `ViewSwitcher.tsx:34-37,56-73`) | ≈ | — | — | Mantener |
| 21 (nueva) | Quién lo ve y dónde | Cualquier visitante de la demo, sin sesión; oculto en `account`, `tools`, `learning` y `admin-demo` (`LegacyApp.jsx:84`) | Solo `platform_role = 'platform_admin'` (`views.ts:42`). Visible en todas las pantallas de `/app`; en Herramientas y Configuración no marca ninguna vista (`views.ts:19-24`) | ≠ | — | — | Mantener (D-13) |
| 22 (nueva) | Vistas según la cuenta | Siempre los tres roles | «Técnico» solo con cuenta profesional y «Empresa» solo con membresía; «Recruiter» y «Administración» siempre (`views.ts:35-48`). La cuenta del seed `platform.admin@crewflex.test` es profesional y administra su propia organización «CrewFlex Operaciones», así que ve las cuatro (`supabase/seed.sql:65-73`, `d3b876f`; en ejecución: Técnico · Empresa · Recruiter · Administración) | ≠ | — | — | Mantener (D-13) |
| 23 (nueva) | Efecto en el menú | Cambiar de rol sustituye el menú entero (técnico ↔ empresa/recruiter), vuelve a Inicio y cierra el menú (`LegacyApp.jsx:43,84`, `AppState.jsx:88-95`; en ejecución, de «Mi pasaporte» a `#home`) | Con el selector, el lateral muestra solo la sección de la vista actual más «Cuenta»: «Técnico» → «Profesional» (7 entradas con wallet desde M07/M08, `db05af1`: Mi espacio, Mi pasaporte, Cualificaciones, Disponibilidad, Oportunidades, Mis candidaturas, Documentos); «Empresa» → la sección con el nombre de la organización («CrewFlex Operaciones»: Resumen, Necesidades, Plantilla); «Administración» → «Plataforma › Verificaciones» (solo con el flag OD-3); «Recruiter» → solo «Cuenta». Elegir una vista navega a su raíz. Si se llega a Herramientas o Configuración navegando dentro de la app, se mantiene la última vista. Si se cargan directamente (enlace o recarga), no hay vista previa y el lateral muestra **todas** las secciones: 13 entradas más el selector (`views.ts:26-33`, `ViewSwitcher.tsx:15-32`, `AppShell.tsx:48-65,115`). Comprobado de nuevo en ejecución (v2) con `platform.admin` en las cuatro vistas, navegando a Herramientas desde cada una (se mantiene la vista) y con carga directa de `/app/tools` y `/app/settings` (`evidencias/v2/10/SH-02-v2-views.json`, `evidencias/v2/10/SH-02-23-administracion-tools-next-1440.jpg`, `evidencias/v2/10/SH-02-23-recruiter-tools-next-1440.jpg`; xhigh: `evidencias/xhigh/10/SH-02-23-admin-nav.json`) | ≈ | P3 | — | Mantener (D-13: la vista no cambia el rol ni los permisos). Opcional: recordar la última vista para que una recarga no cambie el menú. El desbordamiento que causaba está corregido (SH-04 #13, X-03) |
| 24 (nueva) | Datos que se ven | Personaje y organización ficticios del escenario | La propia cuenta del admin, sin suplantación ni ruta de lectura nueva; RLS y Edge Functions deciden como para cualquiera (`views.ts:3-7`). Como RLS deja leer todas las necesidades al `platform_admin` (`supabase/migrations/20261009120000_foundation_v0.sql:383-384`), la ficha de una necesidad, sus elegibles y, desde M08, sus candidaturas dan 404 si no es de la organización activa (`organization/requirements/[id]/page.tsx:44`, `[id]/matches/page.tsx:68`, `[id]/applications/page.tsx:71`). En ejecución (v2), `platform.admin` ve «No encontrado» en la necesidad `9f50725f…` de Demo MRO Madrid, en sus elegibles y en sus candidaturas, las tres con HTTP 200, sin lateral y con el título de la página pedida (SH-07 #14; `evidencias/v2/10/SH-02-v2-views.json`) | ≠ | — | — | Mantener |
| 25 (nueva) | Vista activa | `value` del `<select>` | `aria-current="page"` en la raíz de la vista y `aria-current="true"` en sus subpáginas, con borde `accent` y fondo `navy-700` (`ViewSwitcher.tsx:59-68`; en ejecución, «Administración» con `aria-current="true"` en `/app/admin/verifications`) | ≈ | — | — | Mantener |
| 26 (nueva) | Vista «Recruiter» | Espacio completo: el menú de empresa con los datos de una agencia de demo y la etiqueta «RECRUITER» (`LegacyApp.jsx:43`) | Marcador: eyebrow «Recruiter», `h1` «Espacio recruiter», «Próximamente» / «El espacio para agencias que representan a clientes llegará en una fase posterior. Su modelo todavía está pendiente de decisión.»; 404 si no es `platform_admin` (`src/app/app/recruiter/page.tsx:17-27`, es:958-962; en ejecución v2, `evidencias/v2/10/ADM-02-recruiter-next-1440.jpg`). Desde X-11 (`552415c`), quien no es `platform_admin` recibe un 404 real (SH-07 #14) | − | P3 | — (v2: desbloqueado, alcance LATER; D-12 con el modelo provisional como default) | Portar el espacio recruiter (agencia + clientes representados, D-12 provisional) y, mientras, mantener el marcador |

Capturas: v1.8 `evidencias/shots/demo/D-GEN-01-datos-alcance-1440.png`, `evidencias/shots/demo/D-GEN-01c-modal-importar-1440.png`,
`evidencias/shots/demo/D-GEN-01b-importar-invalido-1440.png`, `evidencias/shots/demo/D-GEN-03-vista-movil-preview-1440.png`,
`evidencias/shots/demo/D-TEC-01-inicio-1440.png` (banda, banner, personajes y «Probar como»); v2: `evidencias/v2/10/SH-03-{technician,company,recruiter}-v18-1440.jpg`. Next v2: `evidencias/v2/10/SH-02-23-*-next-1440.jpg`, `evidencias/v2/10/ADM-02-*-next-1440.jpg`. Next xhigh: `evidencias/next-2026-10-22/N-ADM-*-1440.jpg` y, de esta verificación, `evidencias/xhigh/10/SH-02-23-admin-*-next-{1440,390}.jpg`
(en algunas de 1440 el contenido aún muestra el esqueleto de carga; el dato es el lateral); `scripts/local/ui-smoke.mjs`
añade las comprobaciones 19b y 20a (`d3b876f`).

---

## SH-03 · Navegación lateral por rol — v1.8 `S-DEMO-01 (sidebar), S-CON-00 (items)` ↔ Next `AppShell` (`N-APP-01`)

**Estado global:** PARCIAL. Coinciden en etiqueta, orden relativo e icono las entradas de lo que existe en los dos lados:
- Mi espacio, Resumen, Mi pasaporte, Disponibilidad, Documentos y Herramientas;
- desde M07/M08 (`db05af1`), también «Oportunidades» y «Mis candidaturas» del técnico, en el orden de v1.8 (v2).

Faltan, y ya ninguno está bloqueado salvo comisiones (v2: alcance NOW + NEXT + LATER y defaults v1.8):
- candidaturas de la organización como entrada propia (Next las lista por necesidad), avisos, directorio libre,
  organización editable, logbook y reto diario;
- comisiones sigue fuera (SCOPE OUT).

Next añade «Cualificaciones», «Plantilla», «Configuración» y «Verificaciones». Las cabeceras de sección («PROFESIONAL»,
«EMPRESA», «ADMINISTRACIÓN») pasan a ser el nombre de la organización, «Profesional», «Plataforma» y «Cuenta». Desde el
22/10 (D-13, `d3b876f`) el `platform_admin` tiene además, encima del menú, el selector «Ver como» (SH-02 #18-#26)
y aterriza en la portada «Administración», que no es entrada de menú. Con el selector, el lateral muestra solo la sección
de la vista activa (SH-02 #23). Los contadores nuevos de los dashboards (M07/M08) se comparan en `20-technician.md` y
`30-company-hiring.md`.

**Matriz por rol** (nº = posición en el menú; «—» = no aparece). Fuentes:
- v1.8: `LegacyApp.jsx:24-25,43` (demo) y `ConnectedShell.jsx:8` (conectado);
- Next: `src/components/layout/AppShell.tsx:23-65`, con `memberships>0` para org y `account_type==="professional"` para
  prof.; selector y filtro por vista en `src/components/layout/views.ts:26-48`;
- en ejecución (v2, 22/10 tarde), a 1440, 1366×768, 1024×768 y 390: Next (SNAP2 `038329f`) con `alpha`, `charlie`
  (profesional + `member`), `manager.mro` (profesional + `manager`), `echo` y `hotel` (solo profesional), `admin.mro`
  (solo organización, en inglés) y `platform.admin` en sus cuatro vistas y sin vista (`evidencias/v2/10/SH-03-next-nav-all.json`,
  `evidencias/v2/10/SH-02-v2-views.json`); v1.8 demo con los tres roles de «Probar como»
  (`evidencias/v2/10/V18-demo-shell-runtime.json`) y v1.8 **conectado con sesión** (técnico 1 y 2, empresa, recruiter y
  admin, sesiones guardadas, sin login nuevo; `evidencias/v2/10/V18C-shell-runtime.json`) y sin sesión
  (`evidencias/v2/10/AUTH-v18c-anon-runtime.json`). El wallet y el flag OD-3 están activos en el Next local.

| Entrada | Demo técnico | Demo empresa / recruiter | Conectado técnico | Conectado empresa / recruiter | Conectado admin | Sin sesión | Next profesional | Next organización | Next prof. + org | Next `platform_admin` (D-13, OD-3): vista Técnico / Empresa / Recruiter / Administración / sin vista (carga directa de Herramientas o Configuración) |
|---|---|---|---|---|---|---|---|---|---|---|
| Selector de rol / vista | «Probar como» (cabecera) | «Probar como» (cabecera) | — | — | — | — | — | — | — | «Ver como», 4 enlaces encima del menú (2-4 según la cuenta) |
| Inicio técnico | 1 «Mi espacio» | — | 1 «Mi espacio» | — | — | — | 1 «Mi espacio» | — | 4 | 1 / — / — / — / 4 |
| Inicio organización | — | 1 «Resumen» | — | 1 «Resumen» | — | — | — | 1 «Resumen» | 1 | — / 1 / — / — / 1 |
| Pasaporte | 2 «Mi pasaporte» | — | 2 «Mi pasaporte» | — | — | — | 2 «Mi pasaporte» | — | 5 | 2 / — / — / — / 5 |
| Cualificaciones | — | — | — | — | — | — | 3 «Cualificaciones» | — | 6 | 3 / — / — / — / 6 |
| Disponibilidad | 3 | — | 3 | — | — | — | 4 | — | 7 | 4 / — / — / — / 7 |
| Oportunidades | 4 | — | 4 | — | — | — | 5 (v2) | — | 8 | 5 / — / — / — / 8 |
| Candidaturas (técnico) | 5 «Mis candidaturas» | — | 5 «Candidaturas» | — | — | — | 6 «Mis candidaturas» (v2) | — | 9 | 6 / — / — / — / 9 |
| Documentos | 6 «Wallet documental» | — | 6 «Documentos» | — | — | — | 7 «Documentos» (solo con wallet) | — | 10 (solo con wallet) | 7 / — / — / — / 10 (con wallet) |
| Logbook | 7 | — | 7 | — | — | — | — | — | — | — |
| Avisos | campana | campana | 8 «Avisos» | 7 «Avisos» | — | — | — | — | — | — |
| Herramientas | 8 | 8 | 9 | 8 | 2 | 2 | 8 (7 sin wallet; Cuenta) | 4 (Cuenta) | 11 (10 sin wallet) | 8 / 4 / 1 / 2 / 12 |
| Privacidad | 9 | — | — | — | — | — | — | — | — | — |
| Mi cuenta (conectado) / Configuración | — | — | 10 «Mi cuenta» | 9 «Mi cuenta» | — | — | 9 (8 sin wallet) | 5 «Configuración» | 12 (11 sin wallet) | 9 / 5 / 2 / 3 / 13 |
| Reto diario | 10 | 9 | — | — | — | — | — | — | — | — |
| Mi cuenta (demo → conectado) | 11 | 10 | — | — | — | — | — | — | — | — |
| Control CrewFlex | 12 | 11 | — | — | — | — | — | — | — | «Ver como › Administración» (`/app/admin`) |
| Nueva necesidad | — | 2 (con «+») | — | — | — | — | — | botón de página | botón de página | botón de página (vista Empresa) |
| Ofertas / necesidades | — | 3 «Ofertas y cobertura» | — | 3 «Ofertas y publicación» | — | — | — | 2 «Necesidades» | 2 | — / 2 / — / — / 2 |
| Buscar candidatos / Directorio | — | 4 «Buscar candidatos» | — | 5 «Directorio» | — | — | — | (por necesidad) | (por necesidad) | (por necesidad, vista Empresa) |
| Candidaturas (org) | — | 5 «Candidaturas» | — | 4 «Candidaturas» | — | — | — | (por necesidad, v2) | (por necesidad, v2) | (por necesidad, vista Empresa) |
| Ofertas en la red | — | 6 | — | — | — | — | — | — | — | — |
| Organización | — | 7 «Organización» | — | 2 «Organización» | — | — | — | — | — | — |
| Comisiones | — | — | — | 6 | — | — | — | — | — | — |
| Plantilla | — | — | — | — | — | — | — | 3 «Plantilla» | 3 | — / 3 / — / — / 3 |
| Administración / Verificaciones | — | — | — | — | 1 «Administración» | — | — | — | — | — / — / — / 1 / 11 «Verificaciones», solo con el flag; portada `/app/admin` por «Ver como» y al entrar |
| Recruiter | — | menú de empresa con datos recruiter | — | igual que empresa | — | — | — | — | — | «Ver como › Recruiter»: «Próximamente» |
| Acceder a mi cuenta | — | — | — | — | — | 1 | `/login` fuera del shell | — | — | — |
| Pie del lateral | «Datos y alcance» + avatar + «Marcos B.» / «Identidad profesional» | «Datos y alcance» + «AeroLine MRO» / «Organización de demo» | «Volver a la demo» + «Cuenta autenticada» / «Servidor local · datos propios» | igual | igual | «Volver a la demo» + «Acceso por invitación» | nombre + «Profesional» + «Cerrar sesión» (lg+; `echo`, `hotel`) | nombre + «Organización · Administrador» (`admin.mro`, medido en inglés: «Organization · Admin») | nombre + «Profesional · {rol}»: `alpha` y `charlie` «Profesional · Miembro», `manager.mro` «Profesional · Manager» | «Platform Admin» + «Profesional · Administración de la plataforma» (X-13, `745c1fc`) + «Cerrar sesión» (lg+; SH-04 #3) |
| **Total de entradas** | 12 + pie | 11 + pie | 10 | 9 | 2 | 2 | 8 (9 con wallet) | 5 | 11 (12) | 9 / 5 / 2 / 3 / 13 (con wallet y el flag), + selector de 4 vistas |

Columna `platform_admin`: posiciones en cada vista de «Ver como» para la cuenta del seed (profesional, admin de «CrewFlex
Operaciones», wallet y flag OD-3 activos en local); «sin vista» = carga directa de `/app/tools` o `/app/settings`, que
muestra todas las secciones (SH-02 #23). Medido en ejecución el 22/10 por la tarde (v2) en las tres anchuras de
escritorio y en el menú de 390. Las columnas del conectado se midieron en ejecución (v2), con las mismas entradas que
dice el código.

**Tabla de elementos**

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | «Mi espacio» (inicio técnico) | `home`, LayoutDashboard 19 px; demo y conectado (`LegacyApp.jsx:24`, `ConnectedShell.jsx:8`) | «Mi espacio» → `/app/professional`, icono dashboard de 4 rectángulos de 18 px (`AppShell.tsx:29`, `NavLinks.tsx:13,19`, es:65) | = | — | — | — |
| 2 | «Resumen» (inicio organización) | `home`, LayoutDashboard | «Resumen» → `/app/organization` (`AppShell.tsx:24`, es:62) | = | — | — | — |
| 3 | «Mi pasaporte» | `profile`, User. Las pestañas internas de `Account` dicen «Mi perfil» (`Account.jsx:43`) | «Mi pasaporte» → `/app/professional/profile`, icono usuario (`AppShell.tsx:30`, es:66) | = | — | — | — |
| 4 | «Cualificaciones» | No es entrada: las habilitaciones van dentro del pasaporte | «Cualificaciones» → `/app/professional/qualifications`, icono medalla (`AppShell.tsx:31`, es:67) | + | — | — | Mantener |
| 5 | «Disponibilidad» | `calendar`, CalendarDays | «Disponibilidad» → `/app/professional/availability`, icono calendario (`AppShell.tsx:32`, es:68) | = | — | — | — |
| 6 | «Oportunidades» | `jobs`, Briefcase; técnico demo y conectado, 4.ª entrada tras «Disponibilidad» (en ejecución v2, `evidencias/v2/10/V18C-shell-runtime.json`) | «Oportunidades» → `/app/professional/opportunities`, maletín, tras «Disponibilidad» (`AppShell.tsx:33-34`, `NavLinks.tsx:26`, es:81; M07, `db05af1`). En ejecución (v2): en el menú de las 6 cuentas profesionales; la página responde 200 con título «Oportunidades · Crew Flex» (`evidencias/v2/10/SH-03-6-alpha-opportunities-next-1440.jpg`). El contenido se compara en `20-technician.md` | = (v2: antes −) | — | — | Mantener |
| 7 | «Mis candidaturas» / «Candidaturas» (técnico) | `applications`, Briefcase. Demo: «Mis candidaturas»; conectado: «Candidaturas» (en ejecución v2) | «Mis candidaturas» (el literal de la demo) → `/app/professional/applications`, icono de portapapeles con marca en vez del maletín (`AppShell.tsx:35`, `NavLinks.tsx:27-28`, es:82; M08, `db05af1`). En ejecución (v2): título «Mis candidaturas · Crew Flex» y, sin candidaturas, «Tu próxima candidatura empieza aquí» (`evidencias/v2/10/ACC-v2-next-settings.json`) | ≈ (v2: antes −) | — | — | Mantener |
| 8 | Documentos | Demo «Wallet documental» (FileText). Conectado «Documentos» con icono **Briefcase de reserva**, porque `icons` define `docs` y no `documents` (`Shared.jsx:4-18`) (en ejecución v2: «Documentos», 6.ª entrada del técnico conectado) | «Documentos» → `/app/professional/documents`, icono documento. Solo si la RPC `is_feature_enabled('document_wallet')` devuelve `true`, y falla cerrado (`AppShell.tsx:18,36`, `src/server/feature-flags.ts:29-37`). En el Next local el flag está activo: «Documentos» sale en las 6 cuentas profesionales (en ejecución v2) | ≈ | P2 | — (v2: antes D-10 / release 2; en local, activo; producción: despliegue del wallet, owner) | Mantener tras el flag |
| 9 | «Logbook» | `logbook`, BookOpen (conectado: 7.ª entrada del técnico, en ejecución v2) | No existe | − | P2 | — (v2: desbloqueado, alcance LATER) | Portar la entrada con el logbook (`40-tools-learning.md`) |
| 10 | «Avisos» | Conectado: `notifications`, Bell, para técnico, empresa y recruiter (en ejecución v2). En la demo no es entrada: la campana lleva a `#notifications` | No existe | − | P1 | — (v2: desbloqueado, alcance LATER: avisos in-app; D-06 ratificada) | Portar la entrada con los avisos (SH-06 #11-#12) |
| 11 | «Herramientas» | `tools`, Wrench; en todos los roles y sin sesión | «Herramientas» → `/app/tools`, en la sección «Cuenta» (`AppShell.tsx:39`, es:72). Exige sesión | = | — | — | Mantener (ubicación justificada en `docs/product/DESIGN_SYSTEM.md:46-47`) |
| 12 | «Privacidad» (técnico demo) | `privacy`, Shield → página «Tú eliges quién te ve.» | Sin entrada: la visibilidad está en Mi pasaporte (ver ACC-03) | ≈ | P3 | — | Mantener |
| 13 | «Mi cuenta» (conectado) | `privacy`, Shield, última entrada de técnico y empresa | «Configuración» → `/app/settings`, icono engranaje (`AppShell.tsx:40`, es:69). Contenido distinto (ACC-01) | ≈ | P3 | — | Mantener la etiqueta; el contenido se trata en ACC-01 |
| 14 | «Reto diario» | `learning`, Briefcase de reserva; demo, todos los roles (`LegacyApp.jsx:43`; en ejecución v2) | No existe | − | P3 | — (v2: desbloqueado, alcance LATER «daily challenge») | Portar la entrada con el reto (`40-tools-learning.md`) |
| 15 | «Mi cuenta» (demo) | `account` → cambia a modo conectado (`LegacyApp.jsx:71`) | — | ✗ | — | DEMO-ONLY | — |
| 16 | «Control CrewFlex» | `admin-demo`, Briefcase de reserva; demo, **todos** los roles (`LegacyApp.jsx:43`) | Vista «Administración» del selector «Ver como» → `/app/admin`, solo para `platform_admin` y fuera del menú (`views.ts:8-13,35-48`, es:79; `d3b876f`). Sin el panel demo (ADM-01) | ≠ (antes ✗) | — | — (D-13); panel demo: DO-NOT-COPY / SCOPE OUT | Mantener; el panel demo sigue sin portarse (ADM-01) |
| 17 | «Nueva necesidad» | Empresa demo: 2.ª entrada (`create`, Plus) con `<span class="nav-plus">+</span>` | Sin entrada de menú: botón «Nueva necesidad» en Resumen y en Necesidades (`src/app/app/organization/page.tsx:71`, `organization/requirements/page.tsx:47`) | ≠ | P3 | — | Mantener |
| 18 | Ofertas de la organización | Demo «Ofertas y cobertura» (`manage`); conectado «Ofertas y publicación» (`jobs`), con «Publicar y gestionar» en las pestañas de `Account` | «Necesidades» → `/app/organization/requirements`, maletín (`AppShell.tsx:25`, es:63) | ≈ | P3 | — | Mantener (vocabulario «necesidad» de Next) |
| 19 | «Buscar candidatos» / «Directorio» | Demo `candidates` «Buscar candidatos» (Search); conectado «Directorio» | No hay directorio libre. Solo «Profesionales elegibles» por necesidad (`/app/organization/requirements/[id]/matches`), sin entrada de menú | − | P1 | — (v2: default v1.8; contacto, identidad y documentos siguen en D-07 P3 / D-10) | Portar la entrada con el directorio (detalle en `30-company-hiring.md`) |
| 20 | «Candidaturas» (organización) | `applications`, Briefcase: lista de todas las candidaturas de la organización (conectado: 4.ª entrada, en ejecución v2) | Sin entrada de menú ni lista de la organización. Desde M08 (`db05af1`): la ficha de cada necesidad enlaza «Candidaturas ({count})» → `/app/organization/requirements/[id]/applications` (es:1319) (`organization/requirements/[id]/page.tsx:62-65,79-82`) y Resumen muestra el contador «Candidaturas» (`src/app/app/organization/page.tsx:49-51,109-110`). La función `applications` solo lista por necesidad o cuenta por organización (`src/features/applications/api.ts:12-26`) | ≠ (v2: antes −) | P2 | — (default v1.8) | Añadir la entrada «Candidaturas» con la lista de la organización (necesita la vista por organización en la Edge Function) |
| 21 | «Ofertas en la red» | Solo empresa **demo**, `jobs`. El conectado no la tiene: la empresa ve solo sus ofertas (`Account.jsx:69`; en ejecución v2) | No existe | ✗ (v2: antes −) | — | DEMO-ONLY (el conectado no lo tiene) | No portar: el default v1.8 real (conectado) no enseña las ofertas de otras organizaciones |
| 22 | «Organización» | Demo `settings` (icono Settings); conectado `org` (Briefcase de reserva). Conectado, en ejecución (v2): «Organización · Revisión registrada», «Razón social», «Identificación fiscal», «Domicilio fiscal», «País» (27 países UE), «Guardar organización» y «La revisión se registra desde administración. La empresa no puede verificarse a sí misma.» (`Account.jsx:64`; `evidencias/v2/10/V18C-emp-org-v18c-1440.jpg`) | Sin pantalla de organización. Solo el nombre (y el rol) en Configuración | − | P1 | — (v2: default v1.8, OD-5) | Portar la pantalla «Organización» con su revisión desde administración (ADM-03 #7); detalle de los campos en `30-company-hiring.md` ORG-07 |
| 23 | «Comisiones» | Conectado empresa: `invoices` (Briefcase de reserva) | No existe | − | P3 | SCOPE (OUT: commissions, invoicing) | — |
| 24 | «Plantilla» | — | «Plantilla» → `/app/organization/workforce`, icono usuarios (`AppShell.tsx:26`, es:64); `member` la ve aunque la página le diga «La plantilla es visible para managers y administradores» (es:896; en ejecución, `alpha` la tiene en el menú) | + | — | — | Mantener |
| 25 | «Administración» / «Verificaciones» | Admin conectado: única entrada `admin` (Briefcase de reserva) | «Verificaciones» → `/app/admin/verifications` en la sección «Plataforma», solo con `QUALIFICATION_REVIEW_ENABLED=true` **y** `platform_admin` (`AppShell.tsx:42-46,61-63`, es:70-71); con «Ver como», solo en la vista «Administración» (SH-02 #23). La portada «Administración» (`/app/admin`) existe para todo `platform_admin`, pero no es entrada de menú: se llega por «Ver como» o al entrar (`src/app/app/page.tsx:7`, `d3b876f`) | ≈ | P0 | OD-3 (activación en producción; en local, activa) | Ver ADM-02 #1 y ADM-03 |
| 26 | «Acceder a mi cuenta» | Sin sesión: `home` → formulario de acceso dentro del shell conectado | Sin shell: `/login` y `/register` en el layout de auth | ≈ | — | — | Mantener |
| 27 | Cabeceras de sección | `.sidebar-label`: «PROFESIONAL» / «EMPRESA» / «RECRUITER»; en conectado además «ADMINISTRACIÓN» y «BETA LOCAL» | Por sección y solo `lg+`: nombre de la organización principal (o «Organización»), «Profesional», «Plataforma», «Cuenta» (`AppShell.tsx:48-65`, `ViewSwitcher.tsx:25-27`, es:59-61,70) | ≠ | P3 | — | Mantener |
| 28 | Orden | El del array, sin agrupar | Organización → Profesional → Plataforma → Cuenta; dentro de cada sección, el orden de v1.8 | ≈ | — | — | — |
| 29 | Entrada activa | `class="active"` + `aria-current="page"`; icono `#ffad54` | `aria-current="page"` por igualdad o prefijo (salvo `/app/organization` y `/app/professional`, que solo cuentan exactos); fondo `navy-700` e icono `accent` (`NavLinks.tsx:49-65`) | ≈ | — | — | Detalle visual en VIS-07 |
| 30 | Iconos sin definir | `manage`, `learning`, `account`, `admin-demo`, `org`, `documents`, `invoices`, `admin` caen en Briefcase (`Shared.jsx:4-18`) | Icono propio por `href`, con Briefcase de reserva (`NavLinks.tsx:14-37,72`) | + | — | — | Mantener |
| 31 | Cuenta de organización sin membresía | n/a | Solo la sección «Cuenta» (2 entradas) | + | P3 | — | Caso degenerado; sin acción |
| 32 | Persona del lateral | Demo: avatar + nombre + «Identidad profesional» / «Organización de demo». Conectado: icono UserRound + «Cuenta autenticada» (o «Acceso por invitación» sin sesión) + «Servidor local · datos propios» | `display_name` + «{tipo de cuenta} · {rol en la organización principal}» (p. ej. «Profesional · Manager») + «Cerrar sesión», solo `lg+` (`AppShell.tsx:117-132`, `src/components/layout/account-summary.ts:15-26`; `d12164a`). Desde X-13 (`745c1fc`), el `platform_admin` lee su rol de plataforma en lugar del de su organización (`account-summary.ts:15-26`). En ejecución (v2): «Technician Alpha» / «Profesional · Miembro», «Technician Charlie» / «Profesional · Miembro», «Ops Manager Demo MRO» / «Profesional · Manager», «Technician Echo» / «Profesional», «Admin Demo MRO» / «Organization · Admin», «Platform Admin» / «Profesional · Administración de la plataforma» (`evidencias/v2/10/SH-03-next-nav-all.json`) | ≈ | — | — | Mantener (SH-04 #3 y #6) |

Capturas: v1.8 `evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `evidencias/shots/demo/D-EMP-01-resumen-1440.png`,
`evidencias/shots/demo/D-REC-01-resumen-1440.png`, `evidencias/shots/connected/C-TEC-01-home-empty-1440.png`,
`evidencias/shots/connected/C-EMP-01-home-empty-1440.png`, `evidencias/shots/connected/C-ADMIN-01-admin-empty-1440.png`,
`evidencias/shots/connected/C-ANON-01-login-1440.png`. Next:
- `docs/audit/evidence/local-15-overview-es-1440.jpg` y `local-18-organization-es-1440.jpg`, sin los iconos del lote 13;
- `local-22-verifications-1440.jpg` (`7f7235a`);
- `v18-compare/next-after/tech-home-1440.jpg` (lote 11).
Capturas v2: v1.8 demo `evidencias/v2/10/SH-03-{technician,company,recruiter}-v18-1440.jpg`; v1.8 conectado `evidencias/v2/10/V18C-{t1,t2,emp,rec,admin}-home-v18c-1440.jpg`; Next `evidencias/v2/10/SH-03-{alpha,charlie,managermro,adminmro,echo,hotel,platformadmin}-next-1440.jpg` y `evidencias/v2/10/SH-03-6-alpha-opportunities-next-1440.jpg`; datos en `evidencias/v2/10/SH-03-next-nav-all.json`, `V18C-shell-runtime.json` y `V18-demo-shell-runtime.json`.

---

## SH-04 · Cabecera, identidad, marca y pie — v1.8 `S-DEMO-01 (header/footer), S-CON-00 (header/footer)` ↔ Next `AppShell`

**Estado global:** PARCIAL. Next no tiene barra superior de escritorio: ni breadcrumb, ni campana, ni pie. Lo que v1.8
enseñaba en la cabecera (rol, email, cerrar sesión) queda repartido:
- el tipo de cuenta y el rol, bajo el nombre del pie del lateral (`d12164a`); el `platform_admin`, su rol de plataforma
  (X-13, `745c1fc`);
- el correo, en Configuración (`a770aed`);
- «Cerrar sesión», en el lateral, seguido de «Sesión cerrada.» (`01486a3`), solo en este dispositivo (X-12).

Desde X-03 (`52929c9`) el lateral se desplaza por dentro como el de v1.8 (#13). El hueco que sigue notando el usuario es
el indicador de avisos (#2), ahora portable (alcance LATER).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Breadcrumb | «CrewFlex / {etiqueta}». Fuera del menú: demo `demo` → «Datos y alcance», `notifications` → «Actividad», resto vacío; conectado «Mi cuenta» (en ejecución v2: un técnico en `#admin` o el admin en `#jobs` leen «CrewFlex / Mi cuenta»). Oculto a ≤760 px (`LegacyApp.jsx:82-84`, `ConnectedShell.jsx:13`) | No hay; la jerarquía la lleva el eyebrow de `PageHeader` | − | P3 | NOT_A_GAP (AB-29) | No portar (AB-29 NOT_A_GAP; VIS-06 #5) |
| 2 | Campana | Solo demo: `aria-label="Ver notificaciones"` (Bell 20) → `notifications`, con punto naranja si hay alguna sin leer y sin número (`LegacyApp.jsx:87`; en ejecución v2). En conectado no hay campana ni contador en «Avisos» (en ejecución v2, con 11 avisos sin leer del técnico 1) | No hay | − | P2 | — (v2: desbloqueado, alcance LATER: avisos in-app) | Portar con el módulo de avisos (indicador de no leídos, como la demo) |
| 3 | Rol visible | Conectado: `<span class="connected-role">` «Técnico» / «Empresa» / «Recruiter» / «Administración»; sin sesión, «Iniciar sesión». Además, `.sidebar-label` en mayúsculas (en ejecución v2, las cinco cuentas y sin sesión) | En `lg+`, bajo el nombre del pie del lateral: «Profesional» u «Organización», más « · {Miembro\|Manager\|Administrador}» si hay membresía principal (`AppShell.tsx:118-123`, `account-summary.ts:15-26`, es:457-467; `d12164a`). Desde X-13 (`745c1fc`), el `platform_admin` lee «Profesional · Administración de la plataforma» (`domain.platformRole.platform_admin`, es:463) en lugar de su rol en «CrewFlex Operaciones»; test en `account-summary.test.ts`. No aparece en la barra `<lg`. En Configuración, el mismo admin sigue leyendo «Rol: Administrador» junto a «Organización: CrewFlex Operaciones», que es su rol de organización (`settings/page.tsx:27-31`; en ejecución v2, `evidencias/v2/10/ACC-v2-next-settings.json`) | ≈ | P3 | — | Mantener (backlog 10 HECHO). Opcional: mostrarlo también en `<lg` |
| 4 | Kicker y email del espacio | Conectado: «{Técnico\|Empresa\|Recruiter\|Administración} · CUENTA INDIVIDUAL» + `<p>{session.email}</p>` (`Account.jsx:45`) | Sin kicker por espacio. El correo, tomado de los claims verificados del JWT, solo aparece en Configuración › «Cuenta» › «Correo electrónico» (`src/server/session.ts:46,67`, `settings/page.tsx:25`, es:953; `a770aed`) | ≈ (antes −) | P3 | — | Mantener |
| 5 | «Actualizar datos» | Recarga `/api/session` y `/api/state` con el aviso «Datos actualizados.». No recarga `/api/admin` (hallazgo C-12) | No hace falta: las páginas se renderizan en servidor en cada navegación y las acciones hacen `revalidatePath`/`router.refresh()` | ≈ | — | — | Mantener |
| 6 | «Cerrar sesión» | Conectado: botón en la cabecera del contenido; aviso «Sesión cerrada.» en el login (`Account.jsx:45`; en ejecución v2, cabecera «… · CUENTA INDIVIDUAL · {email} · Actualizar datos · Cerrar sesión») | `lg+`: pie del lateral bajo `display_name` y el tipo de cuenta (`AppShell.tsx:117-132`). Desde X-09 (`5d85caa`) lleva `pointer-coarse:min-h-11`: medido (v2) 89×44 px con puntero grueso y 89×20 con puntero fino (cumple el mínimo de 24 px de WCAG 2.5.8 por la excepción de espaciado). `<lg`: en la barra superior junto a «Menú» (`AppShell.tsx:98-107`, `NavDrawer.tsx:31-32`): 113×44 px con puntero grueso (medido a 390). Después, el login dice «Sesión cerrada.» (`src/features/auth/actions.ts:160-166`, `login/page.tsx:15,20-27`, es:117; en ejecución v2). Desde X-12 cierra solo la sesión de este dispositivo (AUTH-05 #8). El lateral ya se desplaza y el pie no se sale de la ventana (#13) (`evidencias/v2/10/SH-03-next-nav-all.json`, `evidencias/v2/10/AUTH-v2-next-runtime.json`) | ≈ | P3 | — | Mantener (backlog 11 HECHO en lo táctil; con puntero fino sigue en 20 px de alto) |
| 7 | «Ver demo» | Botón de cabecera en conectado | — | ✗ | — | DEMO-ONLY | — |
| 8 | Etiqueta de espacio | `.workspace-tag` con `live-dot`: «V1.8 · Espacio unificado» (demo) / «V1.8 · Cuenta conectada» | — | ✗ | — | — | No portar (versión de prototipo) |
| 9 | Marca | `.brand-symbol` con avión (Plane 23) + «CrewFlex» + «AVIATION»; botón «Cerrar menú» (X) en móvil | Enlace a `/app`: cuadrado `accent` con «CF» + «Crew Flex» + «AVIATION» 11 px (`AppShell.tsx:80-96`, es:3-4); desde X-09 (`5d85caa`) con `pointer-coarse:min-h-11` | ≠ | P3 | — (v2: default v1.8, C-12) | Ver VIS-08 (nombre «CrewFlex» frente a «Crew Flex», isotipo) |
| 10 | Pie | Demo: «CREWFLEX AVIATION» · «Cualificación · Disponibilidad · Confianza» · «V1.8 · Unificada». Conectado: «CREWFLEX AVIATION» · «V1.8 · Beta local conectada» (en ejecución v2, los dos modos) | Sin pie en `/app`, en la landing ni en auth | − | P3 | — (v2: default v1.8, C-12) | Portar el pie con el lema (sin la etiqueta de versión ni «Beta local») |
| 11 | Título de pestaña | Fijo, «CrewFlex V1.8 — Aviation» (en ejecución v2, demo y conectado) | «%s · Crew Flex» por página (`src/app/layout.tsx:12`), con el mismo nombre que la entrada de menú (`fd01c52`, W3-07; `tests/i18n/titles.test.ts`, pasa), también «Administración», «Recruiter», «Oportunidades» y «Mis candidaturas» (es:50-54). Las rutas de plataforma denegadas ya dicen solo «Crew Flex» (SH-07 #14) | + | — | — | Ver META-02 |
| 12 | Selector de idioma en el shell | n/a | No hay en `/app`; solo en Configuración (ACC-02) | + | — | — | Mantener |
| 13 (nueva xhigh) | Lateral más alto que la ventana | `.sidebar` sticky de `100vh` con el menú desplazable (`.sidebar nav{min-height:0;overflow-y:auto}`, `src/styles/v15.css:2`): el pie queda siempre a la vista. Medido de nuevo (v2) a 1366×600: demo, menú 287/583 px y pie en 580; conectado técnico 294/485 px y empresa 294/436 px, pie en 580 (`evidencias/v2/10/V18-demo-shell-runtime.json`, `evidencias/v2/10/V18C-shell-runtime.json`) | Desde X-03 (`52929c9`) el bloque de secciones es `lg:min-h-0 lg:flex-1 lg:overflow-y-auto` dentro del `aside` `lg:sticky lg:h-screen lg:flex-col` (`NavDrawer.tsx:47`, `AppShell.tsx:76`), como v1.8. Medido (v2): con profesional + organización a 1366×768 y 1024×768 el menú mide 583 px y se desplaza dentro (637 px de contenido) y «Cerrar sesión» queda en y = 730; con `platform.admin` y carga directa de `/app/tools` a 1366×768, 583/840 px y el pie igual en 730; a 1440×900 todo cabe (715 px) (`evidencias/v2/10/SH-03-next-nav-all.json`, `evidencias/v2/10/SH-04-13-platformadmin-tools-next-1366.jpg`) | = (v2: antes ≠) | — | — | Mantener (backlog 9 HECHO, `52929c9`) |

Capturas: v1.8 `evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `evidencias/shots/connected/C-TEC-01-home-empty-1440.png`,
`evidencias/shots/connected/C-EMP-20-home-active-1440.png`, `evidencias/xhigh/10/SH-04-13-v18-1366x600-lateral.jpg`. Next
`docs/audit/evidence/local-15-overview-es-1440.jpg`, `evidencias/xhigh/10/SH-04-6-next-1366x768-admin-tools-final-scroll.jpg` y
`evidencias/xhigh/10/SH-04-6-next-1440-admin-tools-final-scroll.jpg`.
Capturas v2: Next `evidencias/v2/10/SH-04-13-platformadmin-tools-next-1366.jpg` (menú desplazable a 1366×768); medidas en `evidencias/v2/10/SH-03-next-nav-all.json`.

---

## SH-05 · Móvil: dock, menú y corte responsive — v1.8 `D-GEN-04, §2.M, C-*-mobile-menu-390` ↔ Next `NavDrawer` (`< lg`)

**Estado global:** PARCIAL. El menú móvil existe con otra forma: un desplegable «Menú» en lugar del cajón superpuesto.
No hay dock inferior, que está pendiente de C-12. El corte pasa de ≤760 px a <1024 px. El detalle visual está en
VIS-06/A11Y-02.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Dock técnico | `nav.mobile-dock` «Accesos rápidos» con «Inicio» (`home`), «Ofertas» (`jobs`), «Calendario» (`calendar`), «Candidaturas» (`applications`), «Herramientas» (`tools`), iconos de 20 px y `aria-current` (`LegacyApp.jsx:69,87`; `ConnectedShell.jsx:12`). En ejecución (v2) a 390: visible (`display: grid`) en la demo y en el conectado con los técnicos 1 y 2; oculto a 1440 (`evidencias/v2/10/SH-05-t1-dock-v18c-390.jpg`, `evidencias/v2/10/SH-05-technician-dock-v18-390.jpg`) | No hay dock | − | P2 | — (v2: default v1.8, C-12; la condición «revisit after M07» ya se cumple) | Portar el dock de 5 accesos en `<lg`; los destinos ya existen todos en Next («Oportunidades» y «Mis candidaturas» desde `db05af1`) |
| 2 | Dock empresa / recruiter | Demo: «Inicio», «Ofertas» → `manage`, «Candidatos», «Candidaturas», «Herramientas». Conectado: «Ofertas» → `jobs` (en ejecución v2, empresa y recruiter: «Inicio · Ofertas · Candidatos · Candidaturas · Herramientas») | No hay | − | P2 | — (v2: default v1.8, C-12) | Portar con el dock; «Candidatos» y «Candidaturas» esperan sus pantallas de organización (SH-03 #19, #20) |
| 3 | Dock admin y sin sesión | Replica `items`: 2 botones (Administración/Acceder a mi cuenta + Herramientas), con `gridTemplateColumns: repeat(n,…)` (en ejecución v2, admin: «Administración · Herramientas») | No hay | − | P3 | — (v2: default v1.8, C-12) | Portar con el dock |
| 4 | Abrir el menú | Hamburguesa `aria-label="Abrir menú"` (Menu, 44×44) a la izquierda de la cabecera blanca | Botón de texto «Menú» (es:29) en la barra navy, con `aria-expanded` y `aria-controls` (`NavDrawer.tsx:33-42`) | ≈ | — | — | Mantener |
| 5 | Cerrar el menú | X «Cerrar menú» junto al logo y fondo `nav-backdrop` «Cerrar menú» | El mismo botón «Menú». Escape solo si el foco está en el botón (`NavDrawer.tsx:38`). Sin fondo | ≈ | P3 | — | Ver A11Y-02 #5 |
| 6 | Cerrar al navegar | Al elegir una entrada (`navigate` cierra) | En cualquier cambio de ruta (`NavDrawer.tsx:22-25`) | = | — | — | — |
| 7 | Presentación | Cajón fijo de 265 px superpuesto, con scroll interno y fondo `nav-backdrop` (medido de nuevo en v2: 265 px desde x = 0, con fondo) | Desplegable en el flujo que empuja el contenido; las secciones envuelven (`NavLinks.tsx:47`; en ejecución v2, `evidencias/v2/10/SH-05-*-menu-next-390.jpg`) | ≠ | P3 | — | Mantener |
| 8 | Corte | ≤760 px (a 768 px sigue el lateral fijo) | `< lg` (1024 px) | ≠ | P3 | — | Ver VIS-06 |
| 9 | «Cerrar sesión» en móvil | En la cabecera del contenido (conectado) | Siempre visible en la barra superior (`AppShell.tsx:98-107`): 113×44 px con puntero grueso (medido) | + | — | — | Mantener |
| 10 | Pie en móvil | Oculta «Cualificación · Disponibilidad · Confianza» | Sin pie | − | P3 | — (v2: default v1.8, C-12) | Con SH-04 #10 |
| 11 | Sin scroll horizontal a 390 px | Medido: `scrollWidth = 390` en todas las capturas (runtime demo §2.M); en v2, también en el conectado con las cinco cuentas | Tablas con `overflow-x-auto` (p. ej. `verifications/page.tsx:56`). Medido: `scrollWidth = 390` en la landing, el acceso, `/app/admin`, `/app/recruiter`, `/app/settings`, `/app/admin/verifications` y `/app/tools` (xhigh) y, en v2, con «Menú» abierto en el inicio de las 7 cuentas | = | — | — | — |

Capturas: v1.8 `evidencias/shots/demo/D-GEN-04-menu-movil-390.png`, `evidencias/shots/demo/D-TEC-01-inicio-390.png`,
`evidencias/shots/connected/C-TEC-44-mobile-menu-390-390.png`, `evidencias/shots/connected/C-EMP-30-mobile-menu-390-390.png`,
`evidencias/shots/connected/C-ADMIN-06-mobile-menu-390-390.png`. Next `docs/audit/evidence/local-23-overview-nav-390.jpg`
(`67fd62f`, lote 14) y `v18-compare/next-after/tech-home-390.jpg` (lote 11).
Capturas v2: v1.8 `evidencias/v2/10/SH-05-{t1,t2,emp,rec,admin}-{dock,menu}-v18c-390.jpg`, `evidencias/v2/10/SH-05-technician-{dock,menu}-v18-390.jpg`; Next `evidencias/v2/10/SH-05-{alpha,charlie,managermro,adminmro,echo,hotel,platformadmin}-menu-next-390.jpg`.

---

## SH-06 · Respuesta global: avisos, guardado, errores, carga y actividad — v1.8 `S-DEMO-01 (toast/saving/storage-error), S-COM-04, S-CON-11, Account.run` ↔ Next `Notice`, `ApiErrorState`, `StateMessage`, `N-APP-03/04`, `not-found`

**Estado global:** PARCIAL. El modelo de respuesta de Next (avisos en línea por formulario, con código y referencia)
equivale al del modo conectado y mejora el de la demo, que tenía toasts globales y daba por fallo de guardado cualquier
error. Falta la capa de actividad: campana, «Notificaciones.» y «Avisos».

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Toast (demo) | `div.v11-toast role="status"` abajo en el centro, se borra a los 5000 ms (`AppState.jsx:19-25`) | Sin toasts: `Notice` en línea, `role=status` si va bien y `role=alert` si falla (`src/components/ui/Notice.tsx:25-58`). Desde X-08 (`4357034`), si el foco se había perdido (fila borrada o botón deshabilitado) el aviso lo recibe sin desplazar la página (`Notice.tsx:33-41`, test en `Notice.test.ts`) | ≠ | P3 | — | Mantener (A11Y-03) |
| 2 | Resultado en conectado | Párrafo `.tb-notice` (`role=status`) / `.tb-error` (`role=alert`) bajo la cabecera, borrado al cambiar de página (`Account.jsx:26,34`) | `Notice` por formulario o tarjeta | ≈ | — | — | — |
| 3 | Mensaje de éxito | Casi siempre el genérico «Cambios guardados.»: `act` lee `r.message` y el servidor devuelve `{result}` (`Account.jsx:31-32`; hallazgo C-2) | Mensajes específicos por acción (p. ej. «Idioma actualizado.», es:950; «…: Verificada. La cualificación ya cuenta para el matching.», es:993) | + | — | — | Mantener |
| 4 | «Guardando…» | Demo: `div.saving-indicator role="status"` global mientras `saving`. Conectado: `fieldset disabled` + «Procesando…» | Texto de espera por botón («Guardando…», «Iniciando sesión…», «Creando la cuenta…», «Enviando…») + `aria-busy` (es:9,112,125,166) | ≈ | — | — | — |
| 5 | Error de guardado (demo) | `div.storage-error role="alert"`: «La última operación no pudo guardarse y no se ha aplicado. Conserva un respaldo desde Datos y alcance e inténtalo de nuevo.». Salta con **cualquier** excepción, también de validación (hallazgo B-1) | Errores de validación por campo (`v.*`). Errores de servicio por código: `actionErrorCopy` con «No se ha podido contactar con el servicio. No se ha guardado nada; reintenta.» (`Notice.tsx:100-130`, es:222) | + | — | — | Mantener |
| 6 | Referencia del error | No hay | «Referencia: {id}» (`x-request-id`) en `ApiErrorState` y `Notice` (es:19) | + | — | — | Mantener |
| 7 | Sesión caducada durante una acción | `run` ante 401: limpia la sesión y vuelve al login con «Inicia sesión.» (srv) (`Account.jsx:31`; `evidencias/shots/connected/C-TEC2-05-session-expired-1440.png`) | Acción: «Tu sesión ha caducado. Vuelve a iniciar sesión.» (es:221). Página: `ApiErrorState` «Tu sesión ha caducado» / «Vuelve a iniciar sesión para continuar.» + «Iniciar sesión de nuevo» → `/login` (es:183-186,219). Navegación: el proxy redirige a `/login?next=…` | ≈ | — | — | Mantener. El botón de `ApiErrorState` no conserva `next` (P3, opcional) |
| 8 | Carga | Conectado: `<p role="status">` «Conectando con tu espacio…» (`Account.jsx:33`) | Esqueleto + «Cargando…» sr-only; el pulso solo con `motion-safe` (`loading.tsx`, `StateMessage.tsx:30-37`; `6ac67d2`) | ≈ | — | — | — |
| 9 | Error inesperado | No hay frontera de error | `src/app/app/error.tsx`: «No se ha podido mostrar esta página» + «Referencia: {digest}» o «Inténtalo de nuevo en un momento.» + «Reintentar» (es:26-27). Fuera del shell, la nueva `src/app/error.tsx` añade «Si el problema continúa, cierra sesión y vuelve a entrar.» y «Cerrar sesión» (es:28; `d275254`) | + | — | — | Mantener |
| 10 | Página inexistente | Hash desconocido → Inicio, sin aviso (en ejecución v2: `#notifications` y `#demo` también caen en Inicio en la demo; en el conectado, un hash de otro rol muestra su primera pestaña con «CrewFlex / Mi cuenta») | `not-found.tsx`: «No encontrado» / «Esta página no existe o no tienes acceso a ella.» + «Volver a Crew Flex» (es:23-25). En ejecución (v2): `/no-existe` y `/app/no-existe` responden 404 con título «Crew Flex» y sin el lateral (`evidencias/v2/10/SH-02-v2-views.json`, `evidencias/v2/10/SH-07-14-alpha-app-noexiste-next-1440.jpg`) | + | — | — | Mantener |
| 11 | Actividad (demo) | `#notifications` («CrewFlex / Actividad»): kicker «ACTIVIDAD», `h1` «Notificaciones.», «Actividad dentro de esta demo. Los mensajes externos siguen simulados.», «Marcar todas como leídas»; filas con «Nueva»/«Leída» y sin estado vacío (`Dashboard.jsx:61-67`). Solo se llega con la campana: el hash directo vuelve a Inicio (en ejecución v2) | No existe | − | P2 | — (v2: desbloqueado, alcance LATER: avisos in-app) | Portar con los avisos (#12): «Marcar todas como leídas» y estado leído/no leído |
| 12 | Avisos (conectado) | «Avisos internos», «Configura Urgente/AOG, movilización y silencio desde tu perfil. No se envían correos ni notificaciones push en esta beta.»; filas «{title} · Nuevo» + descripción + «Ver oportunidades», que marca el aviso como leído y lleva a `applications` o `jobs`; vacío «No tienes avisos.» (`Account.jsx:54`). En ejecución (v2), técnico 1: avisos de difusión «Urgente: …» / «AOG: …» con «MAD · B1.1 · consulta las condiciones y decide si deseas presentar candidatura.» y «Actualización de candidatura · Nuevo» con «{oferta} · {estado}» (`evidencias/v2/10/V18C-t1-notifications-v18c-1440.jpg`) | No existe | − | P1 | — (v2: desbloqueado, alcance LATER: avisos in-app; D-06 ratificada) | Portar: avisos internos de difusión Urgente/AOG y de cambio de candidatura, con leído/no leído; sin correo ni push (OUT). Detalle en `30-company-hiring.md` HIRE-07 y ORG-06 |
| 13 | Diálogos nativos | Ninguno (`alert`/`confirm` no se usan; ninguna acción destructiva confirma) | Confirmación en línea en las acciones destructivas: cerrar necesidad (ahora en `RequirementStatusActions.tsx:48-64`, «Sí, cerrarla», con el foco en «Cancelar»; M05, `9868253`), borrar documento, quitar una cualificación («Sí, quitarla») y eliminar una ventana («Sí, eliminarla») con `ConfirmButton` (`DocumentWallet.tsx:406`, `QualificationsManager.tsx:346`, `AvailabilityManager.tsx:513`). Las transiciones de candidatura de M08 piden confirmación y, para rechazar o cancelar, un motivo (`ApplicationActions.tsx:108-154`; detalle en `30-company-hiring.md`) | + | — | — | Mantener |
| 14 (nueva v2) | Avisos de empresa / recruiter (conectado) | La empresa recibe «Actualización de candidatura» con el estado en código (`accepted`, `withdrawn`) y la misma entradilla del técnico, «Configura Urgente/AOG, movilización y silencio desde tu perfil», aunque la empresa no tiene perfil (`Account.jsx:54`; en ejecución v2, `evidencias/v2/10/V18C-emp-notifications-v18c-1440.jpg`) | No existe | ✗ | — | — | Al portar #12: estados traducidos y entradilla por tipo de cuenta; no copiar el código en crudo |
| 15 (nueva v2) | Fallo de red o página antigua al guardar | Demo: `storage-error` genérico (#5). Conectado: el error crudo de `fetch` (SH-01 #10) | Desde X-02 (`1c2616c`) `callAction` no lanza: sin conexión, «Se ha perdido la conexión. Tus cambios siguen aquí; comprueba la conexión y reintenta.»; tras un despliegue, «Esta página es de una versión anterior de la aplicación. Recárgala y vuelve a intentarlo; tus cambios no se han guardado.»; el borrador y la página se conservan (`Notice.tsx:60-92`, es:223-224) | + | — | — | Mantener |

Capturas: v1.8 `evidencias/shots/demo/D-TEC-09-notificaciones-1440.png`, `evidencias/shots/demo/D-EMP-08-notificaciones-1440.png`,
`evidencias/shots/connected/C-TEC2-05-session-expired-1440.png`. Next: sin captura específica.
Capturas v2: v1.8 conectado `evidencias/v2/10/V18C-t1-notifications-v18c-1440.jpg`, `evidencias/v2/10/V18C-emp-notifications-v18c-1440.jpg`; Next `evidencias/v2/10/SH-07-14-alpha-app-noexiste-next-1440.jpg`.

---

## SH-07 · Enrutado, guardas y enlaces profundos — v1.8 `§1.5 Routing` ↔ Next `src/proxy.ts`, `src/app/app/**`, `src/server/session.ts`

**Estado global:** PARCIAL, con mejora clara. Next usa rutas enlazables, guardas en servidor por capas y 404 reales.
v1.8 resolvía todo en el cliente por hash, y su enlace de salto llevaba a Inicio. El defecto propio de Next del 21/10, el
bucle de redirección `/app` ↔ `/login` con sesión y perfil ilegible (#11), está corregido desde `d275254`. Desde el 22/10
(`d3b876f`) el administrador aterriza en «Administración», como en v1.8 (#10). Desde X-11 (`552415c`) las páginas de
plataforma responden un 404 real a quien no es `platform_admin`; las necesidades de otra organización siguen con 200 (#14).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Modelo de rutas | Hash (`#home`, `#profile`…), `history.replaceState` (`AppState.jsx:84-87`, `ConnectedShell.jsx:9`) | Rutas reales `/app/…` (`src/app/app/**`) | + | — | — | Mantener |
| 2 | Recarga y enlaces profundos | Demo: `notifications` y `demo` no están en `VALID` y al recargar llevan a `home` (`LegacyApp.jsx:44-47`). La oferta seleccionada (`route.jobId`) no está en la URL | Cada página se puede enlazar y recargar; estado en la query (`?month=`, `?q=`, `?page=`) | + | — | — | Mantener |
| 3 | Pantalla de otro rol | Demo: sin filtro por rol; un técnico en `#create` ve la pantalla de empresa con el breadcrumb vacío. Conectado: cae en la primera pestaña del rol, con breadcrumb «Mi cuenta» (`Account.jsx:43-44`; en ejecución v2, el técnico 1 en `#admin` ve su Inicio y el admin en `#jobs` o `#privacy` ve Administración, los dos con «CrewFlex / Mi cuenta») | Sin membresía, `/app/organization/*` redirige a `/app/professional` (`session.ts:105-115`). Pantallas profesionales con cuenta de organización: mensaje de estado. Desde X-11 (`552415c`), sin rol de plataforma (o sin el flag, en Verificaciones) el proxy responde un **404 real** en `/app/admin*` y `/app/recruiter*` antes de que empiece el streaming (`src/proxy.ts:53-76`); las páginas siguen comprobándolo (`admin/page.tsx:21`, `recruiter/page.tsx:19`, `verifications/page.tsx:29`). Una necesidad de otra organización da «No encontrado» en su ficha, sus elegibles y sus candidaturas (SH-02 #24). En ejecución (v2): `alpha` recibe 404 con título «Crew Flex» en las tres rutas de plataforma; `platform.admin` sigue recibiendo 200, sin lateral y con el título de la página pedida en las tres de la necesidad ajena (#14) | + | — | — | Mantener |
| 4 | Ruta desconocida | Lleva a `home` | 404 global (`src/app/not-found.tsx`) | + | — | — | — |
| 5 | Protección sin sesión | Conectado: el formulario de acceso sustituye al contenido (`Account.jsx:36`); `tools` queda libre | Proxy: `/app*` → `/login?next=<ruta+query>` (`src/proxy.ts:47-52`). Layout: `requireSessionActor()` (`src/app/app/layout.tsx:6`) | + | — | — | Mantener |
| 6 | Volver tras el login | No: siempre a `#home` | `next` saneado: solo `/app…`, sin `//` ni `\` (`state.ts:31-35`) | + | — | — | — |
| 7 | `/login` y `/register` con sesión | Con sesión, un enlace `?invite=` no muestra el registro y sigue en Administración (hallazgo C-11) | Redirige a `/app` (`src/proxy.ts:77-82`) | ≈ | — | — | — |
| 8 | Enlaces de correo | Query en la raíz: `/?invite=`, `/?verify=`, `/?reset=`; fuerzan el modo conectado (`LegacyApp.jsx:90`, `Account.jsx:27-28`) | `/auth/confirm?code=…` o `?token_hash=…&type=recovery` (solo recuperación), con `next` limitado a `/reset-password` o `/app…` (`src/app/auth/confirm/route.ts:11-27`, `state.ts:38-40`) | ≈ | P2 | — (v2: default v1.8, OD-8) | Ver AUTH-03 |
| 9 | Enlace de salto | «Ir al contenido» `href="#main"`: dispara `hashchange` y **lleva a Inicio** en los dos modos (hallazgo de §2.4) | «Saltar al contenido» → `#main` (es:5), sin efecto de navegación (`AppShell.tsx:70-75`) | + | — | — | Mantener (A11Y-01 #2) |
| 10 | Aterrizaje del administrador | `admin` + `home` → `navigate('admin')` (`ConnectedShell.jsx:11`; en ejecución v2, `#home` → `#admin`) | `/app` envía al `platform_admin` a `/app/admin` antes de mirar sus membresías (`src/app/app/page.tsx:6-7`, `d3b876f`); la marca «CF Crew Flex» enlaza a `/app` (`AppShell.tsx:80`). En ejecución (v2), `platform.admin` aterriza en `/app/admin` y las cuentas con membresía en `/app/organization` (SH-01 #12) | = (antes ≠) | — | — (D-13) | Mantener |
| 11 | Sesión válida sin perfil legible | n/a | Con JWT válido y perfil ilegible (falta la fila o falla la consulta), `requireSessionActor()` lanza `SessionProfileUnavailableError` en vez de redirigir (`session.ts:25-34,81-87`). El layout de `/app` cae en `src/app/error.tsx`: «No se ha podido mostrar esta página», la referencia o «Inténtalo de nuevo en un momento.», «Si el problema continúa, cierra sesión y vuelve a entrar.», «Reintentar» y «Cerrar sesión» (es:26-28). Sin bucle; test en `src/server/session.test.ts:77-84` (`d275254`) | + (antes ≠) | — | — | Mantener |
| 12 | Scroll arriba al navegar | `scrollTo({top:0})` en cada cambio (`LegacyApp.jsx:42,70-77`) | Por defecto en Next | = | — | — | — |
| 13 | Remontaje de la pantalla | `<main key={rol-pestaña-perfil-org-oferta}>`: se pierde el estado local al cambiar de rol o personaje (`LegacyApp.jsx:87`) | Estado de cliente por página | ≈ | — | — | — |
| 14 (nueva xhigh) | Ruta denegada: estado, título y lateral | Hash no permitido → Inicio o primera pestaña, sin aviso (#3) | **Rutas de plataforma, corregido** (X-11, `552415c`): el proxy reescribe a una ruta inexistente y Next pinta el `not-found.tsx` raíz con **HTTP 404**, título «Crew Flex» y `noindex` (`src/proxy.ts:53-76`); medido (v2) con `alpha` en `/app/admin`, `/app/recruiter` y `/app/admin/verifications` (`evidencias/v2/10/SH-02-v2-views.json`, `evidencias/v2/10/SH-07-14-alpha-admin-next-1440.jpg`). **Sigue igual** en las necesidades de otra organización: `notFound()` bajo `src/app/app/loading.tsx` responde 200, sin lateral y con el título de la página pedida («Necesidad · Crew Flex», «Profesionales elegibles · Crew Flex», «Candidaturas · Crew Flex»), medido con `platform.admin`. «No encontrado» nunca lleva el lateral, tampoco en `/app/no-existe` (404) | + | P3 | — | Ajustar lo que queda: título neutro (o 404 real) en las necesidades ajenas y lateral en «No encontrado» dentro de `/app` (backlog 12, en parte HECHO) |
| 15 (nueva v2) | Rutas de M07/M08 con una cuenta de organización | Conectado: la empresa no tiene «Oportunidades» de técnico; un hash de técnico cae en su primera pestaña (#3) | `/app/professional/opportunities` dice «Las oportunidades son para profesionales» / «Esta cuenta no tiene pasaporte profesional.» (`opportunities/page.tsx:43`, es:1266), pero `/app/professional/applications` enseña a la misma cuenta el estado vacío del técnico, «Tu próxima candidatura empieza aquí» / «Busca una oportunidad que encaje contigo y preséntate.», que la invita a presentarse sin poder hacerlo (`applications/page.tsx:43-49`, es:1309-1310). Medido (v2) con `admin.mro` (en inglés: «Your next application starts here»); sin sesión, el enlace profundo con query vuelve tras el login (`/login?next=%2Fapp%2Fprofessional%2Fopportunities%3Fq%3DA320`) (`evidencias/v2/10/SH-07-v2-new-routes.json`) | ≠ | P3 | — | Corregir: el mismo aviso «solo para profesionales» que Oportunidades (defecto nuevo de Next, v2) |

Capturas: Next v2 `evidencias/v2/10/SH-07-14-alpha-admin-next-1440.jpg` (404 real), `evidencias/v2/10/SH-07-14-alpha-app-noexiste-next-1440.jpg`; xhigh `evidencias/xhigh/10/SH-07-3-next-1440-alpha-admin.jpg` (200, antes de X-11). v1.8 conectado: `evidencias/v2/10/V18C-shell-runtime.json` (hash de otro rol).

---

## AUTH-01 · Inicio de sesión — v1.8 `S-AUTH-01, C-ANON-01/02/12, D-CON-02/03/07` ↔ Next `N-AUTH-01, N-AUTH-02`

**Estado global:** PARCIAL. El flujo es equivalente, con otra redacción y otro diseño: una tarjeta centrada en lugar de
dos columnas dentro del shell. Next añade `next`, errores por campo y control de red. Pierde la invitación como vía de
alta (AUTH-02), ahora portable como default v1.8 (OD-8). El mensaje de límite de intentos, que faltaba el 21/10, existe
desde `f143741` (#13). En v2 el lado v1.8 se midió en el conectado real, sin sesión (`evidencias/v2/10/AUTH-v18c-anon-runtime.json`).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Contenedor | Dentro del shell conectado (lateral «Acceder a mi cuenta» · «Herramientas», banda, pie). Dos columnas: presentación y panel `tb-panel` (`Account.jsx:36`; en ejecución v2, `evidencias/v2/10/AUTH-login-v18c-1440.jpg`) | Layout de auth: fondo `canvas`, columna `max-w-md`, enlace «CF Crew Flex» → `/`, ES/EN y tarjeta blanca (`src/app/(auth)/layout.tsx:9-25`) | ≠ | P3 | — (v2: default v1.8, C-12) | Mantener la tarjeta; la columna de presentación se trata en #2 |
| 2 | Columna de presentación | kicker «BETA POR INVITACIÓN»; `h1` «Tu siguiente etapa␤empieza aquí.»; «Tu perfil y tu disponibilidad, bajo tu control. Las herramientas se pueden utilizar sin abrir una cuenta.» | No hay. El mensaje de privacidad pasa al registro: «Tu perfil es privado por defecto. Tú decides qué se ve y cuándo.» (es:121) | ≈ | P3 | — | Mantener |
| 3 | Aviso de beta | «Pruebas locales: los enlaces de invitación, verificación y recuperación se generan en un buzón del administrador. Todavía no se envían correos externos.» | — (Next envía correo real con Supabase) | ✗ | — | — | No portar |
| 4 | Título | `h2` «Entrar en CrewFlex» | `h1` «Iniciar sesión» + «Accede a tu espacio de Crew Flex.» (`login/page.tsx:18-19`, es:107-108) | ≈ | P3 | — | — |
| 5 | Campo email | «Email», `type=email`, `required`, `autoComplete=email` (`Account.jsx:37`; en ejecución v2) | «Correo electrónico», `type=email`, `autoComplete=email` (`LoginForm.tsx:23-35`, es:113) | ≈ | — | — | — |
| 6 | Campo contraseña | «Contraseña», `required`, `minLength=12`, `maxLength=128`, `current-password`. El HTML exige 12 caracteres también para entrar (`Account.jsx:38`; medido en v2: `minLength` 12 y `maxLength` 128 en el login conectado) | «Contraseña», `current-password`; zod 1-72 (`LoginForm.tsx:36-47`, `src/lib/validation/auth.ts:6-9`); sin `minLength` en el login (medido en v2), a diferencia del registro y del restablecimiento (AUTH-02 #6) | ≈ | — | — | Mantener (no se valida longitud al entrar) |
| 7 | Validación | Nativa del navegador y solo al enviar, en inglés: «Please fill out this field.», «Please lengthen this text to 12 characters or more (you are currently using 11 characters).». Al escribir no hay señal visible: el campo queda `:invalid`, pero sin estilo (medido el 22/10, `evidencias/xhigh/10/AUTH-02-6-v18-1440-login-11-chars.jpg`) | `noValidate` + zod en servidor con mensajes del catálogo: «Introduce un correo electrónico válido», «Introduce tu contraseña», «Usa como máximo 72 caracteres» (es:235-240), más el aviso «Revisa los campos marcados.» (es:143). Medido: al escribir no aparece nada; con el envío vacío salen el aviso y los dos errores de campo (`evidencias/xhigh/10/AUTH-01-7-next-1440-login-envio-vacio.jpg`; repetido en v2, `evidencias/v2/10/AUTH-v2-next-runtime.json`) | + | — | — | Mantener |
| 8 | Botón | «Iniciar sesión» / «Procesando…», `fieldset disabled` (`Account.jsx:40`) | «Iniciar sesión» / «Iniciando sesión…», `disabled` + `aria-busy` (`LoginForm.tsx:48-50`, es:111-112) | ≈ | — | — | — |
| 9 | Enlace de recuperación | Botón «He olvidado mi contraseña» → modo `forgot` | «¿Has olvidado tu contraseña?» → `/forgot-password` (`login/page.tsx:29-36`, es:115); desde X-09 (`5d85caa`) es `inline-flex` con `pointer-coarse:min-h-11` (medido v2: 200×20 px con puntero fino) | ≈ | — | — | — |
| 10 | Enlace de alta | «Tengo una invitación» → modo `register` | «¿Sin cuenta? Crea una» → `/register` (`login/page.tsx:37-42`, es:109-110) | ≠ | P2 | — (v2: default v1.8, OD-8) | Con AUTH-02 #1 |
| 11 | Credenciales incorrectas | (srv 401) «Credenciales no válidas.», conserva el correo (en ejecución v2 con una dirección nueva que no existe, `evidencias/v2/10/AUTH-01-11-v18c-1440-credenciales.jpg`) | «El correo o la contraseña no son correctos.» (`src/features/auth/state.ts:98-99`, es:144; en ejecución v2, y conserva el correo: `evidencias/v2/10/AUTH-01-11-next-1440-credenciales.jpg`) | ≈ | — | — | — |
| 12 | Cuenta sin verificar | (srv 403) «Verifica primero tu email.» (`evidencias/shots/connected/C-ANON-12-login-unverified-1440.png`) | «Confirma tu correo antes de iniciar sesión.» (`state.ts:100-101`, es:145) | ≈ | — | — (v2: antes OD-8) | — |
| 13 | Límite de intentos | (srv 429) «Demasiados intentos. Espera 15 minutos.»: 10 por email y 100 por IP cada 15 min (`server/app.mjs:48-49`) | Límite de Supabase Auth. `mapAuthError` (ahora en `state.ts:83-116`) traduce `status 429`, `over_request_rate_limit` y `over_email_send_rate_limit` a `RATE_LIMITED`: «Demasiados intentos. Espera unos minutos e inténtalo de nuevo.» en login, registro y nueva contraseña (`state.ts:87-95`, `FormAlert.tsx:8`, es:152; `f143741`). La recuperación mantiene su respuesta única (AUTH-04 #6) | ≈ (antes −) | — | — | Mantener |
| 14 | Error genérico o de red | «No se pudo completar la operación.» (500); sin API, el error crudo: servido por HTTP, «Unexpected token '<', "<!DOCTYPE "... is not valid JSON» (medido; persiste al pasar a «Crear tu cuenta» o «Recuperar acceso», `evidencias/xhigh/10/AUTH-01-14-v18-1440-envio-sin-servidor.jpg`); abierto como fichero, «Failed to fetch» (`Account.jsx:12,31`) | «No se ha podido contactar con el servicio de autenticación. Reintenta.» / «La autenticación ha fallado. Inténtalo de nuevo.» (es:148-149) | + | — | — | — |
| 15 | Éxito | «Sesión iniciada.» (se borra al navegar) → `#home` (admin `#admin`) | `redirect(safeNextPath(next))` sin mensaje (`actions.ts:45`) | ≈ | — | — | — |
| 16 | Conservar el email tras un error | Se mantiene el estado del formulario. El error persiste al cambiar a «Crear tu cuenta» (runtime C-ANON-01) | Se devuelve el email (`values.email`) y nunca la contraseña (`actions.ts:35,42`); páginas separadas | + | — | — | — |
| 17 | Banner tras restablecer | Mensaje «Contraseña actualizada. Inicia sesión de nuevo.» sobre el login | `?reset=1`: «Contraseña cambiada. Se han cerrado todas las sesiones: entra con tu nueva contraseña.» (`login/page.tsx:15,20-27`, es:116). Si llegan `reset=1` y `signedOut=1`, gana este (`state.ts:70-74`) | ≈ | — | — | — |
| 18 | Auditoría del login | Evento `login` en `audit` (`server/app.mjs:162`) | `auth.audit_log_entries` de Supabase (CX-04 NOT_A_GAP) | = | — | — | — |

Capturas: v1.8 `evidencias/shots/connected/C-ANON-01-login-1440.png`, `evidencias/shots/connected/C-ANON-01-login-390.png`,
`evidencias/shots/connected/C-ANON-02-login-error-1440.png`, `evidencias/shots/connected/C-ANON-12-login-unverified-1440.png`,
`evidencias/shots/demo/D-CON-02-login-vacio-1440.png`; v2 `evidencias/v2/10/AUTH-login-v18c-1440.jpg`, `evidencias/v2/10/AUTH-01-11-v18c-1440-credenciales.jpg`. Next v2 `evidencias/v2/10/AUTH-01-11-next-1440-credenciales.jpg`; antes `docs/audit/evidence/local-21-login-es.jpg` (`108a244`, lote 13) y
`deployed-1440-login.jpg` (`ff01048`).

---

## AUTH-02 · Registro — v1.8 `S-AUTH-02, C-ANON-03/09/10/11, D-CON-04` ↔ Next `N-AUTH-03`

**Estado global:** PARCIAL. El modelo cambia:
- v1.8: alta solo por invitación (rol fijado por la invitación), con código y aceptación de condiciones.
- Next: autorregistro con elección de tipo de cuenta («Organización»/«Profesional») y alta de la organización en el
  mismo paso.

Desde v2 la invitación es portable como default v1.8 (OD-8, reversible); el consentimiento sigue esperando el texto
legal del owner. La contraseña mínima ya es 12, como v1.8 (X-14, `94590ba`). El lado v1.8 se midió en v2 en el conectado
real, sin enviar nada (`evidencias/v2/10/AUTH-v18c-anon-runtime.json`).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Modelo de alta | Solo por invitación: `?invite=<código>` o «Tengo una invitación». Sin código válido no hay alta (`server/app.mjs:160`). En ejecución (v2): `/?invite=…` abre «Crear tu cuenta» con «Email», «Contraseña», «Código de invitación» y la casilla de condiciones (`evidencias/v2/10/AUTH-register-v18c-1440.jpg`) | Alta abierta con `signUp` (`actions.ts:48-101`); `enable_signup=true` en local (`supabase/config.toml:178`) | ≠ | P1 | — (v2: default v1.8, OD-8) | Portar como default reversible (flag): alta solo con invitación válida, rol fijado por ella; el alta abierta queda como opción del flag |
| 2 | Título | `h2` «Crear tu cuenta» | `h1` «Crear cuenta» + «Tu perfil es privado por defecto. Tú decides qué se ve y cuándo.» (`register/page.tsx:15-16`, es:120-121) | ≈ | P3 | — | — |
| 3 | Rol | Lo fija la invitación: `technician`, `company`, `recruiter` (`admin` solo por CLI); el `role` del cliente se ignora | Fieldset «Me registro como» con dos tarjetas: **Organización** «MRO, aerolínea, operador» (por defecto) / **Profesional** «Técnico / ingeniero» (`RegisterForm.tsx:17,57-84`, es:128-132; en ejecución v2). `platform_role` nunca sale de los metadatos | ≠ | P2 | — (v2: default v1.8, OD-8; recruiter D-12) | Con #1: el tipo de cuenta sale de la invitación |
| 4 | Recruiter | Rol propio | Tipo de organización «Agencia de personal» (es:158; RC-01 PARTIAL). Desde D-13 el `platform_admin` ve además una vista «Recruiter» de marcador (SH-02 #26) | ≈ | P2 | — (v2: alcance LATER; D-12 provisional como default) | Con el espacio recruiter (SH-02 #26) |
| 5 | Email | «Email», obligatorio (en ejecución v2) | «Correo electrónico», email ≤254 (`RegisterForm.tsx:87`, `auth.ts:4`) | ≈ | — | — | — |
| 6 | Contraseña | 12-128 (HTML `minLength`/`maxLength` y servidor «La contraseña necesita entre 12 y 128 caracteres.», `server/app.mjs:14`; medido en v2 en el registro, el login y el restablecimiento del conectado). Con 11 caracteres escritos no se ve nada; al enviar, el navegador bloquea con «Please lengthen this text to 12 characters or more (you are currently using 11 characters).» y no sale ninguna petición; de 130 tecleados quedan 128 (`evidencias/xhigh/10/AUTH-02-6-v18-1440-registro-11-chars.jpg`) | Desde X-14 (`94590ba`, Q-01): 12-72. `PASSWORD_MIN = 12` y `PASSWORD_MAX = 72` compartidos por registro y restablecimiento (`auth.ts:20-27`); pista «Al menos 12 caracteres.» (es:136); «Usa al menos 12 caracteres» / «Usa como máximo 72 caracteres» (es:239-240); `minimum_password_length = 12` en el Auth local (`supabase/config.toml:184`, efectivo en el próximo `supabase start`; producción sigue en 10 hasta que el owner lo cambie). El campo lleva `minLength=12` y `maxLength=72` para los gestores de contraseñas (`RegisterForm.tsx:38-41`), pero el formulario es `noValidate`: medido (v2), con 11 caracteres el campo queda `tooShort` sin aviso y, al enviar, el servidor responde «Revisa los campos marcados.» y «Usa al menos 12 caracteres» sin llamar a Auth (`evidencias/v2/10/AUTH-02-6-next-1440-registro-11-enviado.jpg`) | ≈ (v2: antes ≠) | P3 | — | Mantener (backlog 3 HECHO). El máximo de 72 lo impone bcrypt en Supabase: no se puede igualar a 128 |
| 7 | Código de invitación | «Código de invitación», obligatorio, relleno desde `?invite=` (`Account.jsx:39`; en ejecución v2, campo `required`) | — | − | P1 | — (v2: default v1.8, OD-8) | Portar con #1 |
| 8 | Aceptación de condiciones | Casilla `required` «Acepto participar en pruebas locales con datos ficticios. Mi cuenta se guarda en este equipo.» (en ejecución v2). Sin marcarla, el navegador bloquea el envío («Please check this box if you want to proceed.», medido); el servidor responde «Acepta las condiciones de beta local.» solo si se salta el cliente (`server/app.mjs:160`; no se guarda: CX-47) | No hay casilla de condiciones | − | P1 | texto legal (owner): el de v1.8 describe una beta local y no se puede copiar | Portar la casilla obligatoria (con versión aceptada guardada) cuando el owner dé el texto de condiciones |
| 9 | Nombre | No se pide: se completa en el pasaporte o la organización | «Tu nombre» 1-120 (`RegisterForm.tsx:86`, `auth.ts:30`) | + | — | — | Mantener |
| 10 | Datos de la organización | Se completan después en «Organización»: «Razón social», «Identificación fiscal», país, «Domicilio fiscal» (en ejecución v2, SH-03 #22) | En el alta: «Nombre de la organización» (2-160), «Tipo de organización» (MRO · Aerolínea · Operador · Agencia de personal · Otra), «País (código ISO)» con «p. ej. ES» (`RegisterForm.tsx:94-119`, es:137-140,154-159) | ≠ | P2 | — (v2: default v1.8, OD-5) | Mantener el alta; los datos fiscales van en la pantalla «Organización» (SH-03 #22) |
| 11 | Botón | «Crear cuenta» / «Procesando…» | «Crear cuenta» / «Creando la cuenta…» (es:124-125) | ≈ (xhigh: antes =) | — | — | — |
| 12 | Éxito | «Cuenta creada. Verifica el email mediante el buzón local del administrador.»; vuelve al login y limpia la query (`#account`) | Con confirmación activa: «Revisa tu bandeja de entrada» + «Hemos enviado un enlace de confirmación a {email}. Confírmalo y después inicia sesión.» (`RegisterForm.tsx:21-28`, es:126-127). Sin confirmación: `redirect('/app')` (`actions.ts:98-100`) | ≈ | — | — (v2: antes OD-8) | Con AUTH-03 #1 la rama «Revisa tu bandeja de entrada» pasa a ser la normal |
| 13 | Email ya registrado | «La cuenta ya existe.» (400). Es enumeración (DO-NOT-COPY, `10-master-matrix.md:108`) | «Ya existe una cuenta con este correo.» si Supabase devuelve `user_already_exists`/`email_exists` (`state.ts:102-104`, es:146). Con la confirmación activa Supabase no revela el duplicado | ≈ | P3 | — (v2: antes OD-8) | Al activar la confirmación (AUTH-03 #1), comprobar que no se enumera |
| 14 | Invitación de otro email | «La invitación pertenece a otro email.» (no la consume) | — | − | — | — (v2: default v1.8, OD-8) | Portar con #1 |
| 15 | Enlace inválido | «Enlace no válido.» / «Enlace caducado, utilizado o no válido.» | — | − | — | — (v2: default v1.8, OD-8) | Portar con #1 |
| 16 | Contraseña débil | Sin regla aparte | «Elige una contraseña más segura.» (`weak_password`, es:147) | + | — | — | — |
| 17 | Pie | «Ya tengo cuenta» | «¿Ya estás registrado? Inicia sesión» (`register/page.tsx:18-24`, es:122-123) | ≈ | — | — | — |
| 18 | Auditoría del alta | Evento `register` | `auth.audit_log_entries` (Supabase) | = | — | — | — |

Capturas: v1.8 `evidencias/shots/connected/C-ANON-03-register-1440.png`, `evidencias/shots/connected/C-ANON-09-register-prefilled-1440.png`,
`evidencias/shots/connected/C-ANON-10-register-invalid-code-1440.png`, `evidencias/shots/connected/C-ANON-11-register-ok-1440.png`,
`evidencias/shots/demo/D-CON-04-invitacion-1440.png`; v2 `evidencias/v2/10/AUTH-register-v18c-1440.jpg`. Next v2 `evidencias/v2/10/AUTH-02-6-next-1440-registro-11-escrito.jpg` y `-11-enviado.jpg`; antes `docs/audit/evidence/deployed-1440-register.jpg` (`ff01048`, anterior a
la release 1).

---

## AUTH-03 · Verificación del correo — v1.8 `S-AUTH-05, C-ANON-06/13` ↔ Next `N-AUTH-06` (parcial), Supabase Auth

**Estado global:** PARCIAL.
- v1.8 tiene una pantalla de verificación propia (enlace de 24 h, de un solo uso, que lleva al login).
- Next delega en el enlace por defecto de Supabase: `signUp` no pasa `emailRedirectTo`, así que no aterriza en
  `/auth/confirm` ni muestra un «Email verificado».
- Con la configuración local la confirmación ni siquiera está activa (`enable_confirmations = false`).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Activación | Siempre: el login exige `verified` (`server/app.mjs:162`) | Según el proyecto: en local `enable_confirmations = false` (`supabase/config.toml:228`); producción desconocida | ≠ | P2 | — (v2: default v1.8, OD-8) | Activar la confirmación en local como v1.8; en producción decide el owner (ajuste de Auth) |
| 2 | Enlace | `/?verify=<token>`, 24 h, un solo uso, depositado en el buzón local | Enlace por defecto de Supabase hacia el `site_url` (sin `emailRedirectTo`, `actions.ts:90-94`). `otp_expiry = 3600` (1 h) en local (`config.toml:236`) | ≠ | P2 | — (v2: default v1.8, OD-8; CX-03) | `emailRedirectTo` hacia `/auth/confirm?next=/app`; su URL en la lista de redirecciones de Auth la añade el owner en producción |
| 3 | Pantalla | `h2` «Verificar email», «Confirma el enlace recibido en el buzón local para habilitar esta cuenta.», botón «Verificar email», enlace «Ya tengo cuenta» (`Account.jsx:40`; en ejecución v2 con `/?verify=…`, sin enviar: `evidencias/v2/10/AUTH-verify-v18c-1440.jpg`) | No hay pantalla; `/auth/confirm` solo acepta `token_hash` de tipo `recovery` (`confirm/route.ts:17`) | − | P2 | — (v2: default v1.8, OD-8) | Portar: `/auth/confirm` acepta los enlaces de alta y aterriza en el login con un aviso propio (#4) |
| 4 | Éxito | «Email verificado. Ya puedes iniciar sesión.» → login | Sin mensaje propio | − | P3 | — (v2: default v1.8, OD-8) | Portar con #3 |
| 5 | Enlace reutilizado o falso | «Enlace caducado, utilizado o no válido.» | Si llega a `/auth/confirm` sin código válido → `/forgot-password?expired=1` con «Ese enlace ha caducado o ya se ha usado. Solicita uno nuevo.» (`confirm/route.ts:26`, es:169). Medido (v2): `/auth/confirm?token_hash=x&type=signup` acaba en `/forgot-password?expired=1`. Es engañoso para un enlace de alta | ≠ | P3 | — (v2: default v1.8, OD-8) | Con #3: destino propio para los enlaces de alta |
| 6 | Reenviar verificación | No existe: con el token caducado no hay salida; una nueva invitación da «La cuenta ya existe.» (hallazgo B-9) | No existe | = | P2 | — (v2: antes OD-8) | Añadir «Reenviar confirmación» al activar la confirmación (mejora sobre v1.8) |
| 7 | Bloqueo de login sin verificar | «Verifica primero tu email.» | «Confirma tu correo antes de iniciar sesión.» | ≈ | — | — | — |

Capturas: v1.8 `evidencias/shots/connected/C-ANON-06-verify-1440.png`, `evidencias/shots/connected/C-ANON-13-verified-1440.png`, `evidencias/v2/10/AUTH-verify-v18c-1440.jpg`. Next: no hay (el desvío de #5 está en `evidencias/v2/10/AUTH-v2-next-runtime.json`).

---

## AUTH-04 · Recuperación de contraseña — v1.8 `S-AUTH-03, S-AUTH-04, C-ANON-04/05/07/14/15, D-CON-05/06` ↔ Next `N-AUTH-04, N-AUTH-05, N-AUTH-06`

**Estado global:** IGUAL en reglas y PARCIAL en textos. Coinciden la respuesta idéntica exista o no la cuenta, la
caducidad de 1 h, el enlace de un solo uso y el cierre de **todas** las sesiones tras el cambio.
- Next añade confirmación de la contraseña y aviso de enlace caducado antes de rellenar nada.
- Desde `18b7cae` (W1-08) el texto de Next (NX-02) y la matriz de paridad (CX-07) dicen lo mismo que el código: se cierran
  todas las sesiones, también la actual.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | «He olvidado mi contraseña» (modo `forgot`; en ejecución v2) | `/forgot-password` desde «¿Has olvidado tu contraseña?» (en ejecución v2) | ≈ | — | — | — |
| 2 | Título | `h2` «Recuperar acceso» (en ejecución v2, `evidencias/v2/10/AUTH-forgot-v18c-1440.jpg`) | `h1` «Restablece tu contraseña» + «Indica el correo de tu cuenta. Si existe, te enviaremos un enlace para elegir una contraseña nueva.» (es:162-163; en ejecución v2) | ≈ | P3 | — | — |
| 3 | Campo | «Email» (obligatorio; en ejecución v2) | «Correo electrónico» (`PasswordRecoveryForms.tsx:31-43`) | ≈ | — | — | — |
| 4 | Botón | «Continuar» / «Procesando…» (en ejecución v2) | «Enviar enlace» / «Enviando…» (es:165-166) | ≈ | — | — | — |
| 5 | Respuesta | Siempre «Si la cuenta existe, se ha generado un enlace de recuperación en el buzón local.» y vuelve al login | Siempre «Revisa tu correo» + «Si existe una cuenta con {email}, recibirás un enlace para elegir una contraseña nueva. Caduca en una hora.» (`PasswordRecoveryForms.tsx:20-27`, es:167-168) | ≈ | — | — | Mantener (Next indica la caducidad) |
| 6 | Límite | 3 por email cada 15 min → «Demasiados intentos. Espera 15 minutos.» | Límites de Supabase (`email_sent`, `max_frequency`). Solo se informa `NETWORK_ERROR`; cualquier otro error, incluido el límite, muestra el mismo éxito (`actions.ts:126-129`). Es intencionado: aunque `mapAuthError` ya reconoce el 429 como `RATE_LIMITED`, esta acción no lo muestra (`state.ts:87-88`) | ≠ | P3 | — | Mantener (informar del límite revelaría si la cuenta existe); documentarlo |
| 7 | Entrega | Buzón local legible por el admin, con tokens en claro | Correo real de Supabase (SMTP del proyecto) | + | — | — | Mantener (AD-11 DO-NOT-COPY) |
| 8 | Enlace | `/?reset=<token>`, 1 h, un solo uso; invalida los otros reset del email (`server/app.mjs:164-165`) | `/auth/confirm?code` o `token_hash&type=recovery` → `/reset-password` (`confirm/route.ts:11-27`); `otp_expiry` 3600 s y ventana de la app de 3600 s (`state.ts:43`); enlaces de un solo uso (CX-53) | = | — | — | — |
| 9 | Enlace caducado o usado | Se muestra el formulario; al enviarlo: «Enlace caducado, utilizado o no válido.» (`evidencias/shots/connected/C-ANON-07-reset-1440.png`; en v2, con `/?reset=…` falso se ve «Nueva contraseña», sin enviar: `evidencias/v2/10/AUTH-reset-v18c-1440.jpg`) | Redirige a `/forgot-password?expired=1`: «Ese enlace ha caducado o ya se ha usado. Solicita uno nuevo.» (`forgot-password/page.tsx:17-24`, es:169; en ejecución v2) | + | — | — | Mantener |
| 10 | Sin sesión de recuperación | n/a (el token va en la URL) | «Esta página necesita un enlace de restablecimiento válido.» + «Solicitar un enlace nuevo» (`reset-password/page.tsx:29-35`, es:178-179; en ejecución v2, sin campos) | + | — | — | — |
| 11 | Título del formulario | `h2` «Nueva contraseña» (en ejecución v2) | `h1` «Elige una contraseña nueva» (es:171; en ejecución v2) | ≈ | — | — | — |
| 12 | Aviso sobre sesiones | No hay | «Al guardarla se cerrarán todas tus sesiones, también esta.» (es:172), coherente con `signOut({ scope: "global" })` (`actions.ts:156`; `18b7cae`, NX-02) | + (antes ≠) | — | — | Mantener |
| 13 | Campos | Uno: «Contraseña» (12-128; medido en v2: `minLength` 12, `maxLength` 128) | «Contraseña nueva» con la pista «Al menos 12 caracteres.» (12-72 desde X-14, `94590ba`) y «Repite la contraseña nueva»; error «Las contraseñas no coinciden.»; los dos campos llevan `maxLength=72` y el primero `minLength=12` (`PasswordRecoveryForms.tsx:57-78`, es:173-175,241). No se pudo abrir con un enlace real (haría falta un correo de recuperación) | ≈ (v2: antes ≠) | P3 | — | Mantener (backlog 3 HECHO); se mantiene la repetición |
| 14 | Botón | «Continuar» | «Guardar contraseña» / «Guardando…» (es:176-177) | ≈ | — | — | — |
| 15 | Misma contraseña | Se admite | «Elige una contraseña distinta de la actual.» (`same_password`, es:150) | + | — | — | — |
| 16 | Efecto | Nuevo hash, borra todas las sesiones e invalida los reset pendientes | `updateUser` + `signOut({scope:"global"})` → `/login?reset=1` (`actions.ts:152-157`) | = | — | — | — |
| 17 | Éxito | «Contraseña actualizada. Inicia sesión de nuevo.»; la sesión en otro navegador queda revocada (runtime C-ANON-07) | «Contraseña cambiada. Se han cerrado todas las sesiones: entra con tu nueva contraseña.» (es:116) | ≈ | — | — | — |
| 18 | Ventana de recuperación caducada al enviar | n/a | «La sesión de restablecimiento ha caducado. Solicita un enlace nuevo.» (es:151) | + | — | — | — |
| 19 | Cuenta eliminada entretanto | «Cuenta no disponible.» | n/a (Supabase) | ≈ | — | — | — |
| 20 | Documentación | — | `10-master-matrix.md:102` (CX-07) cita ya `signOut({ scope: "global" })` y que también termina la sesión actual; C15 (`:361`) lo da por corregido (`18b7cae`) | = (antes ≠) | — | — | — |
| 21 | Cambio de contraseña con sesión normal | No existe (solo reset) | No existe; el proveedor debería exigir la actual (T22) | = | P3 | T22 | Activar T22 en Auth de producción (owner) |

Capturas: v1.8 `evidencias/shots/connected/C-ANON-04-forgot-1440.png`, `evidencias/shots/connected/C-ANON-05-forgot-sent-1440.png`,
`evidencias/shots/connected/C-ANON-07-reset-1440.png`, `evidencias/shots/connected/C-ANON-14-reset-form-1440.png`,
`evidencias/shots/connected/C-ANON-15-reset-ok-1440.png`, `evidencias/shots/demo/D-CON-05-recuperar-1440.png`,
`evidencias/shots/demo/D-CON-06-recuperar-enviado-1440.png`. Next: no hay capturas de recuperación.
Capturas v2: v1.8 conectado `evidencias/v2/10/AUTH-forgot-v18c-1440.jpg`, `evidencias/v2/10/AUTH-reset-v18c-1440.jpg`; Next, textos en `evidencias/v2/10/AUTH-v2-next-runtime.json`.

---

## AUTH-05 · Sesión, cierre de sesión, caducidades y límites — v1.8 `B §5.3, §5.6, C-TEC2-05` ↔ Next Supabase SSR + `src/proxy.ts`

**Estado global:** PARCIAL. El mecanismo es distinto pero equivalente en lo básico. Queda una diferencia con efecto para
el usuario: la sesión de v1.8 caduca a las 12 h y la de Next, en la configuración local, no tiene límite (#2, portable
como default v1.8). «Cerrar sesión» ya cierra solo la sesión actual, como v1.8 (X-12, `0cc90be`, #8). Los límites de
intentos ya se comunican (`f143741`) y el cierre de sesión ya se confirma (`01486a3`).

Las caducidades de invitación (7 d) y verificación (24 h) no tienen equivalente o son más cortas.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Mecanismo | Cookie `cf_session`, `HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`, sin `Secure`; en la BD, hash sha256 + `csrf` + caducidad (`server/app.mjs:44,162`) | Cookies `@supabase/ssr`: JWT de 1 h (`jwt_expiry = 3600`) + refresh token con rotación (`supabase/config.toml:167,173`), refrescadas en cada petición por el proxy (`src/lib/supabase/proxy.ts:10-38`) | ≠ | — | — | Mantener |
| 2 | Duración máxima | 12 h fijas desde el login | Sin `timebox` ni `inactivity_timeout` (comentados en `config.toml:276-278`): la sesión dura mientras se refresque; producción desconocida | ≠ | P2 | — (v2: default v1.8) | `timebox = "12h"` en el Auth local, como v1.8; en producción, ajuste de Auth del owner |
| 3 | Caducidad de la invitación | 7 días | n/a (no hay invitaciones) | − | — | — (v2: default v1.8, OD-8) | Con AUTH-02 #1: invitaciones de 7 días |
| 4 | Caducidad de la verificación | 24 h | `otp_expiry` 1 h en local | ≠ | P3 | — (v2: default v1.8, OD-8) | Con AUTH-03 #1 (el `otp_expiry` es común a la recuperación: o 1 h para los dos o un enlace de alta propio) |
| 5 | Caducidad de la recuperación | 1 h | 1 h (`otp_expiry` + `RECOVERY_WINDOW_SECONDS`) | = | — | — | — |
| 6 | Límites | En memoria y con ventana de 15 min: `auth:<IP>` 100, `login:<email>` 10, `reset:<email>` 3 y `message:<userId>` 60 → «Demasiados intentos. Espera 15 minutos.» (429) | Supabase Auth, local: `sign_in_sign_ups` 30 cada 5 min por IP y `email_sent` 2/h (`config.toml:201,209`). Mensaje propio «Demasiados intentos. Espera unos minutos e inténtalo de nuevo.» (es:152), salvo en la recuperación (AUTH-04 #6) | ≈ | P3 | — | Mantener (umbrales de Supabase) |
| 7 | Sesión caducada | 401 «Inicia sesión.» → login (SH-06 #7) | Proxy → `/login?next=`; `ApiErrorState` «Tu sesión ha caducado» | ≈ | — | — | — |
| 8 | Cerrar sesión: efecto | `POST /api/auth/logout`: borra **solo la sesión actual** (`DELETE FROM sessions WHERE hash=?`) y responde `Max-Age=0`; la variable `csrf` no se limpia (`server/app.mjs:163`). No se ejecutó en v2: las sesiones del conectado son compartidas | Desde X-12 (`0cc90be`): `signOut({ scope: "local" })` → `/login?signedOut=1` (`actions.ts:160-166`): cierra solo la sesión de este dispositivo; el restablecimiento de contraseña sigue en `global` a propósito (`actions.ts:154-156`). Medido (v2) con dos contextos de `hotel`: tras cerrar sesión en A, A vuelve a `/login?next=%2Fapp` y B sigue en `/app/settings` (`evidencias/v2/10/AUTH-v2-next-runtime.json`). Sin test automático (el commit lo verificó contando `auth.sessions`) | = (v2: antes ≠) | — | — | Mantener (backlog 13 HECHO) |
| 9 | Cerrar sesión: confirmación | «Sesión cerrada.» en la pantalla de acceso | «Sesión cerrada.» en `/login`, con `role=status` (`login/page.tsx:15,20-27`, `state.ts:70-74`, es:117; `01486a3`) | = (antes −) | — | — | — |
| 10 | Cambio de modo y sesión | Cambiar a la demo no cierra la sesión | n/a | ✗ | — | DEMO-ONLY | — |
| 11 | Todas las sesiones tras restablecer | Sí | Sí (AUTH-04 #16) | = | — | — | — |
| 12 | Purga de sesiones caducadas | No se purgan (hallazgo B-22) | La gestiona Supabase | + | — | — | — |

Capturas: v1.8 `evidencias/shots/connected/C-TEC2-05-session-expired-1440.png`. Next: no aplica.
Capturas v2: Next `evidencias/v2/10/AUTH-05-9-next-1440-sesion-cerrada.jpg` (cierre local, con la otra sesión aún abierta).

---

## AUTH-06 · Seguridad visible: roles, CSRF, CSP, cabeceras y cookies — v1.8 `§1.4, B §5.3` ↔ Next `src/proxy.ts`, `next.config.ts`, `src/server/session.ts`

**Estado global:** PARCIAL. Los roles salen del servidor en los dos lados. Next es más fino (rol por organización,
`platform_role` aparte) y no tiene selector inseguro. Cabeceras equivalentes. Dos diferencias de seguridad que no se ven
pero afectan al riesgo:
- la CSP de Next es más estricta (nonce) pero va en **report-only**, mientras que v1.8 la aplicaba;
- las cookies de sesión de Next se pueden leer desde JS.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Origen del rol (demo) | Selector «Probar como» sin autenticación | Ningún selector cambia el rol. «Ver como» (D-13) solo enlaza a las vistas de la propia cuenta del `platform_admin` y no concede nada (`views.ts:3-7`; `docs/architecture/AUTHORIZATION.md:20-23`, `d3b876f`) | ✗ | — | DEMO-ONLY | No portar el selector sin autenticación |
| 2 | Origen del rol (conectado) | Solo `GET /api/session` → `user.role`; `company` y `recruiter` se tratan juntos (`Account.jsx:29,42`) | JWT verificado (`getClaims`) + `profiles` (`account_type`, `platform_role`) + `organization_members.role` (admin/manager/member) bajo RLS (`session.ts:41-79`). La UI decide por conveniencia; autorizan Edge Functions y RLS (`src/proxy.ts:36`) | = | — | — | Mantener (más granular) |
| 3 | Crear administradores | Solo por CLI `node server/app.mjs invite <email> admin`; la API responde «Solo el operador local puede crear administradores.» | `platform_role = 'platform_admin'` solo por SQL; nunca desde metadatos del alta (`supabase/migrations/20261009120000_foundation_v0.sql:497`, `actions.ts:76-77`) | = | — | — | — |
| 4 | Credencial demo | `admin/admin` fija en el cliente (`AdminOverview.jsx:19`) | — | ✗ | — | DO-NOT-COPY (AD-01) | — |
| 5 | CSRF | Token por sesión en `X-CSRF-Token`, `Origin` = origen, `Content-Type: application/json` obligatorio. Mensajes: «Origen no permitido.», «Se requiere JSON.», «Sesión de formulario caducada. Recarga la página.» | Server Actions con comprobación `Origin`/`Host` de Next (`actions.ts:120`). Edge Functions con `Bearer` + CORS de lista blanca (CX-08 PRESENT) | = | — | — | — |
| 6 | `Host` | Debe coincidir con el origen: «Host no permitido.» | Lo gestiona la plataforma | ≈ | — | — | — |
| 7 | CSP | Aplicada: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; …; frame-ancestors 'none'` (`server/app.mjs:151`; cabecera `Content-Security-Policy` medida en v2 con `curl` en el conectado) | `Content-Security-Policy-Report-Only` con nonce y `strict-dynamic`, sin `unsafe-inline` en estilos (`src/proxy.ts:11-26`; cabecera medida en v2 en `/login`). El 404 de X-11 conserva la cabecera (`src/proxy.ts:73`) | ≠ | P2 | — | Aplicarla tras una ventana limpia (CX-09). Requiere observación en producción, por eso queda fuera del backlog |
| 8 | Cabeceras | `nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Referrer-Policy: no-referrer` (medido en v2) | Las mismas tres primeras; `Referrer-Policy: strict-origin-when-cross-origin`; `poweredByHeader:false` (`next.config.ts:6-11,18`; medido en v2) | ≈ | P3 | — | Mantener (`strict-origin-when-cross-origin` no filtra rutas a otros orígenes) |
| 9 | Cookie de sesión | `HttpOnly`, `SameSite=Strict` | Cookies de `@supabase/ssr` legibles desde JS (valor por defecto de la plataforma; CX-11 PARTIAL) | ≠ | P2 | — | Mantener y documentar. Mitigan la CSP (#7) y T22 |
| 10 | `Cache-Control` de la API | `no-store` en `/api/*` | `no-store` en las Edge Functions | = | — | — | — |
| 11 | Redirección abierta | n/a | `safeNextPath` / `safeConfirmNext` (`state.ts:31-40`); `/auth/confirm` rechaza los `token_hash` que no son de recuperación para evitar login CSRF (`confirm/route.ts:16-17`) | + | — | — | — |

Capturas: no aplica.

---

## ACC-01 · Mi cuenta ↔ Configuración — v1.8 `S-CON-12, S-CON-12a, C-TEC-10/42/43, C-EMP-08` ↔ Next `N-ACC-01`

**Estado global:** PARCIAL. Coinciden la entrada y el propósito («tu cuenta»), pero no el contenido:
- v1.8: privacidad, exportación de datos y cierre de cuenta;
- Next: idioma y datos de la cuenta.

Faltan los dos derechos de datos (exportar y cerrar). Los bloquea M-3 (qué se conserva y cuánto tiempo).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | «Mi cuenta» (Shield), última entrada de técnico y empresa; el admin no la tiene (en ejecución v2: con `#privacy` ve Administración) | «Configuración» (engranaje), todas las cuentas (`AppShell.tsx:40`; en ejecución v2) | ≈ | P3 | — | — |
| 2 | Encabezado | `h2` «Tu cuenta y tus datos» (en ejecución v2, técnico 1 y empresa: `evidencias/v2/10/V18C-t1-privacy-v18c-1440.jpg`) | `h1` «Configuración» + «Tu cuenta y cómo ves Crew Flex. Los datos de negocio están en tu pasaporte o en las páginas de la organización.» (`settings/page.tsx:37`, es:946-947; en ejecución v2) | ≈ | P3 | — | — |
| 3 | Declaración de privacidad | «Las herramientas no comparten tus cálculos con las empresas. El perfil se crea privado. El servidor de esta beta está en este equipo; no uses documentación personal real durante las pruebas.» (en ejecución v2) | No está en Configuración. Hay piezas equivalentes en el registro (es:121) y en la nota de privacidad de herramientas | ≈ | P3 | — | Opcional; la parte de «beta en este equipo» no se porta |
| 4 | Datos de la cuenta | La cabecera muestra «{Rol} · CUENTA INDIVIDUAL» y el email (en ejecución v2, las cinco cuentas) | Panel «Cuenta»: «Nombre», «Correo electrónico», «Tipo de cuenta» (Profesional/Organización), «Organización», «Rol» (Miembro/Manager/Administrador) (`settings/page.tsx:22-33,43-54`, es:951-956,457-467). En ejecución (v2): `alpha` «Demo MRO Madrid · Miembro»; `admin.mro` (en) «Organization · Admin»; `echo` sin organización; `platform.admin` «CrewFlex Operaciones · Administrador», sin su rol de plataforma (que sí sale en el pie, SH-04 #3) (`evidencias/v2/10/ACC-v2-next-settings.json`, `evidencias/v2/10/ACC-01-4-alpha-settings-next-1440.jpg`) | ≈ | — | — | Opcional: añadir «Rol de plataforma» para el `platform_admin` |
| 5 | Email | Visible (`session.email`) | «Correo electrónico»: el de los claims verificados del JWT, o «Sin indicar» si falta (`settings/page.tsx:25`, `session.ts:46,67`, es:953,20; `a770aed`) | ≈ (antes −) | — | — | Mantener |
| 6 | Organización mostrada | n/a | Usa `primaryMembership(actor)`: la misma organización y el mismo rol que la cabecera de sección del menú (`settings/page.tsx:21-22`, `session.ts:99-103`; `c7956b2`, NX-03) | + (antes ≠) | — | — | Mantener |
| 7 | Exportar mis datos | «Exportar mis datos y archivos» → `CrewFlex-mis-datos.json` con `{exportedAt, user, records:[{kind,data}], files:[{id,name,mime,data(base64)}]}`, aviso «Exportación preparada.» (`Account.jsx:56`; `server/app.mjs:176`; el botón se ve en ejecución v2, no se pulsó) | No existe | − | P1 | — (v2: default v1.8, M-3) | Portar «Exportar mis datos y archivos» (registros propios + documentos del wallet), como default reversible de M-3 |
| 8 | Alcance de la exportación | Solo entidades propias y sus archivos; sin mensajes ajenos ni auditoría (B §5.10) | — | − | P2 | — (v2: default v1.8, M-3) | Con #7: el mismo alcance que v1.8, más los documentos del wallet |
| 9 | Cerrar cuenta | `<details>` «Cerrar cuenta»: «Elimina credenciales, perfil y archivos. Los registros de compromisos y auditoría se conservan sin el perfil para resolver el historial operativo.»; campo «Escribe CERRAR» (`pattern="CERRAR"`); botón «Cerrar mi cuenta» (el `<details>` se ve en ejecución v2, no se abrió) | No existe: solo cascadas de FK si el owner borra el usuario (CX-44) | − | P1 | — (v2: default v1.8, M-3) | Portar el cierre con la retención de v1.8 (compromisos y auditoría sin el perfil), sin su borrado parcial (#12). Borrar el usuario de Auth exige service role: justificación en `EDGE_FUNCTIONS.md`, comprobación explícita y evento de auditoría. El wallet también lo exige: «file-cleanup on account deletion» (`V1_SCOPE.md:51`) |
| 10 | Errores del cierre | «Escribe CERRAR para confirmar.»; «Resuelve primero los compromisos aceptados o confirmados.» | — | − | P2 | — (v2: default v1.8, M-3; D-06 ratificada) | Portar con #9: rechazar el cierre con candidaturas `accepted` o `confirmed` |
| 11 | Tras cerrar | Vuelve al login con el genérico «Cambios guardados.» (`evidencias/shots/connected/C-TEC-43-account-closed-1440.png`) | — | ✗ | — | — | Al portar, mensaje propio («Cuenta cerrada.») |
| 12 | Borrado en servidor | Parcial: pasa a `withdrawn` **todas** las candidaturas y deja mensajes, notificaciones, comisiones y facturas con el id borrado (hallazgo B-8) | — | ✗ | — | — (v2: antes M-3) | No copiar el borrado parcial; al portar #9, transiciones explícitas y auditadas |
| 13 | Consentimiento del alta | Casilla de condiciones de beta (AUTH-02 #8) | — | − | P1 | texto legal (owner) | Con AUTH-02 #8 |
| 14 | Consentimientos de expediente | Pack y contacto por candidatura (`consentPack` obligatorio, `consentContact` opcional; `server/app.mjs:108-110`) | Desde M07 (`db05af1`): casilla obligatoria «Autorizo compartir con {organization} estos datos para esta necesidad.» al presentar la candidatura (`ApplyPanel.tsx:32,63,89-97`, `src/lib/validation/applications.ts:35`, es:1291). No hay consentimiento de contacto: el contacto y la identidad siguen cerrados (M09 preparado y apagado) | ≠ (v2: antes −) | P2 | D-07 P3 / D-10 (contacto e identidad) | Mantener; el consentimiento de contacto llega con D-07 P3 (detalle en `20-technician.md`) |
| 15 | Cambiar contraseña o email con sesión | No existe | No existe (Supabase `double_confirm_changes = true` en local, sin UI) | = | P3 | T22 | — |
| 16 | Empresa: cierre cierra sus ofertas | Sí (`account.close`) | — | − | P2 | — (v2: default v1.8, M-3) | Con #9: el cierre de una cuenta de organización cierra sus necesidades abiertas (auditado) |

Capturas: v1.8 `evidencias/shots/connected/C-TEC-10-privacy-1440.png`, `evidencias/shots/connected/C-TEC-42-privacy-close-open-1440.png`,
`evidencias/shots/connected/C-TEC-43-account-closed-1440.png`, `evidencias/shots/connected/C-EMP-08-privacy-1440.png`. Next
`docs/audit/evidence/local-14-settings-en-1440.jpg`, `-768.jpg` y `-390.jpg` (en inglés; `108a244`).
Capturas v2: v1.8 conectado `evidencias/v2/10/V18C-t1-privacy-v18c-1440.jpg`, `evidencias/v2/10/V18C-emp-privacy-v18c-1440.jpg`; Next `evidencias/v2/10/ACC-01-4-alpha-settings-next-1440.jpg`, `evidencias/v2/10/ACC-01-4-platformadmin-settings-next-1440.jpg`.

---

## ACC-02 · Idioma — v1.8 (solo español) ↔ Next `N-ACC-01` (panel «Idioma / Language»), `LocaleSwitcher`

**Estado global:** SOLO EN NEXT. v1.8 está solo en español. Next es bilingüe, con la preferencia persistida.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Idiomas | Español (`<html lang="es">`) | `es`, `en` (`src/i18n/config.ts:3`) | + | — | — (v2: antes C-5; decidida) | Mantener |
| 2 | Idioma por defecto | Español | Perfil → cookie → `Accept-Language` → **`en`** (`src/i18n/resolve.ts:35-43`, `config.ts:7`). En ejecución (v2): `admin.mro` sale en inglés por su preferencia guardada aunque la cookie diga `es` | ≠ | P3 | — (v2: antes C-5; decidida) | Mantener (decidido) |
| 3 | Selector en la cuenta | — | Panel «Idioma / Language» con «La interfaz, las fechas y los mensajes siguen esta elección en todos los dispositivos donde inicies sesión. Los códigos de licencia, los tipos de aeronave y tus propios datos nunca se traducen.» y tarjetas `radio` «Español / ES» · «English / EN» (`LocaleSwitcher.tsx:81-112`, es:948-949; en ejecución v2) | + | — | — | — |
| 4 | Persistencia | — | Cookie `crewflex-locale` (1 año, `SameSite=Lax`) + `profiles.preferred_locale` vía `user-preferences` si hay sesión (`preferences/actions.ts:25-47`) | + | — | — | — |
| 5 | Confirmación | — | «Idioma actualizado.» en el idioma nuevo (`LocaleSwitcher.tsx:31-33`, es:950) | + | — | — | — |
| 6 | Selector compacto | — | ES/EN en la landing y en auth (`LocaleSwitcher.tsx:54-78`) | + | — | — | — |
| 7 | Teclado | — | `radiogroup` con flechas, Inicio/Fin y una sola parada de tabulación; mientras guarda usa `aria-disabled` en vez de `disabled` para no perder el foco (`src/components/ui/radio-group.ts:7-44`, `LocaleSwitcher.tsx:50-52,65-66`; `e37e95c`, NX-09). En ejecución (v2): la opción marcada tiene `tabIndex` 0 y la otra −1 | + | — | — | Mantener |

Capturas: Next `docs/audit/evidence/local-14-settings-en-1440.jpg` (`108a244`).

---

## ACC-03 · Privacidad (demo) y preferencias de contacto — v1.8 `S-TEC-08, D-TEC-08` ↔ Next `N-PRO-02` (visibilidad)

**Estado global:** PARCIAL. Solo se recoge la correspondencia de la página demo «Privacidad». El detalle (visibilidad y
preferencias AOG) pertenece al diff de pasaporte y disponibilidad.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Página | kicker «CONTROL DE DATOS», `h1` «Tú eliges quién te ve.», «Los expedientes anónimos no permiten descargar archivos identificativos.» (`Professional2.jsx:229-266`; en ejecución v2, `evidencias/v2/10/V18-privacy-v18-1440.jpg`) | Sin página: la visibilidad es un campo de Mi pasaporte (`ProfileForm.tsx:150-178`) | ≈ | P3 | — | Mantener |
| 2 | Visibilidad | 4 opciones: «Privado» («Fuera de la búsqueda; puedes presentar candidaturas.»), «Anónimo», «Empresas verificadas» («Perfil anónimo para organizaciones verificadas.»), «Abierto»; guardado instantáneo con el toast «Perfil profesional guardado» (en ejecución v2) | 3: privado, anónimo, abierto (C-7) | ≠ | P2 | — (v2: default v1.8, OD-5) | Portar «Empresas verificadas» cuando exista la revisión de organizaciones (ADM-03 #7) |
| 3 | «Bloquear a mi empresa actual» | Casilla con el nombre de la empresa actual (en ejecución v2). En el conectado, el bloqueo existe por organización: el técnico 2 bloquea a «QA Talent Recruiting», que no lo ve en su directorio | — | − | P2 | — (v2: default v1.8) | Portar con el pasaporte y el directorio (`20-technician.md`, `30-company-hiring.md`) |
| 4 | Alertas urgentes, contacto AOG, AOG en silencio, horas de silencio | 3 casillas + «Inicio del silencio» / «Fin del silencio» (22:00-07:00) (en ejecución v2) | — | − | P2 | — (v2: desbloqueado, alcance NEXT «AOG opt-in» y LATER «outreach») | Portar con los avisos (SH-06 #12) |
| 5 | Nota | «La activación de demo respeta estas preferencias. No se envían mensajes externos. …» | — | ✗ | — | DEMO-ONLY | — |

Capturas: v1.8 `evidencias/shots/demo/D-TEC-08-privacidad-1440.png`. Next `docs/audit/evidence/local-10-passport-1440.jpg`.
Capturas v2: v1.8 demo `evidencias/v2/10/V18-privacy-v18-1440.jpg`.

---

## ADM-01 · Control CrewFlex (demo) — v1.8 `S-COM-03, S-ADM-00…05, D-ADM-01…07` ↔ Next `/app/admin` (D-13, solo entrada y cabecera)

**Estado global:** NO PORTAR. Es un panel de presentación con credencial fija `admin/admin` (DO-NOT-COPY) sobre datos
ficticios. Los indicadores de negocio (suscripciones, comisiones, planes, empresas) son back office completo y quedan
**SCOPE OUT** con OD-7. Lo aprovechable son las **definiciones** de los KPI (fórmulas abajo), útiles el día que se
construya un panel de plataforma. Desde el 22/10 (D-13, `d3b876f`) la entrada tiene equivalente para el
`platform_admin`: la vista «Administración» (#1, #5). Su contenido se compara en ADM-02.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | «Control CrewFlex» en el menú de **todos** los roles demo; sin «Probar como» ni personajes (`LegacyApp.jsx:43`). En ejecución (v2): última entrada de los tres roles demo | Vista «Administración» de «Ver como», solo para `platform_admin` (`views.ts:8-13,35-48`, es:79). Al entrar, `/app` lleva al admin a `/app/admin` (`src/app/app/page.tsx:7`). F3 (P12): comprobado en ejecución, `PKG P12 1b` (aterriza en `/app/admin`) | ≠ (antes ✗) | — | — (D-13) | Mantener; el resto de este panel sigue sin portarse |
| 2 | Puerta | LockKeyhole; kicker «ADMINISTRACIÓN · DEMO»; `h1` «Control CrewFlex»; «Empresas, suscripciones, ofertas, cobertura y comisiones en un único panel.» (`AdminOverview.jsx:19`; en ejecución v2, `evidencias/v2/10/V18-admin-demo-v18-1440.jpg`) | Sin puerta ni credencial aparte: `/app/admin` comprueba `platform_role` en servidor y da 404 a los demás (`src/app/app/admin/page.tsx:20-21`); la revisión, además, el flag (`feature-flags.ts:17-19`). Desde X-11 el proxy responde 404 real a quien no es `platform_admin` (`src/proxy.ts:53-76`) | ✗ | — | DO-NOT-COPY | — |
| 3 | Credencial | «Usuario de demo» / «Clave de demo» (`autoComplete=off`); `user==='admin' && password==='admin'`; error «Usuario o clave de demostración incorrectos.»; nota «Acceso de presentación admin / admin. Solo datos de ejemplo; el administrador del servidor mantiene su autenticación propia.» (en ejecución v2: con «x»/«y» sale el error; con admin/admin se abre el panel) | — | ✗ | — | DO-NOT-COPY | — |
| 4 | Persistencia del acceso | Solo el estado React `open`: se bloquea al salir de la pestaña, cambiar de rol o recargar | — | ✗ | — | — | — |
| 5 | Cabecera | kicker «CREWFLEX · CENTRO DE CONTROL»; `h1` «Una vista de toda la operación.»; «Empresas, demanda técnica y negocio · fecha de referencia {date}»; «Salir» (LogOut) (en ejecución v2: «fecha de referencia 2026-10-22») | Portada `/app/admin`: eyebrow «Plataforma», `h1` «Administración», «Herramientas de la plataforma disponibles para administradores.»; debajo, el panel operativo del conectado (ADM-02 #6: «Control operativo · datos del servidor», «Tu plataforma, en cifras.»); sin fecha ni «Salir» (la sesión se cierra desde el menú) (`admin/page.tsx:36-44`, es:1521-1532; F3: `PKG P12 1b`) | ≠ (antes −) | P3 | SCOPE (OUT: back office completo) | Mantener (D-13: solo lo que existe) |
| 6 | Fuente del panel | Select «Fuente del panel»: «Escenario · 15 empresas» / «Demo completa · datos del navegador» y su caja «Datos de demostración» | — | ✗ | — | DEMO-ONLY | — |
| 7 | Pestañas | `nav` «Secciones del panel»: «Resumen» · «Empresas» · «Ofertas» · «Demanda técnica» · «Conexiones futuras» | — | − | P3 | SCOPE (OUT: back office completo) | — |
| 8 | KPI «Técnicos registrados» | tamaño de `Set(technicians.id)`, «Identidades únicas del escenario» (`adminModel.js:30-37`) (en ejecución v2: 112) | «Técnicos registrados» en `/app/admin`: cuentas profesionales (`get_platform_summary`, `20261023500300:7`, T-53; `admin/page.tsx:53`) (F3: `PKG P12 1b`, `PKG admin-org 3`) | ≈ (F3: antes −) | — | — | Cubierto por la versión conectada (ADM-02 #7); la versión demo (datos ficticios) no se porta |
| 9 | KPI «Ofertas activas» | `status ∈ {Publicada, En cobertura, Confirmada} && end ≥ hoy`, «Publicadas, en cobertura o confirmadas; no vencidas» (en ejecución v2: 48) | «Necesidades activas»: `open`/`covered` no vencidas; las pausadas no cuentan (`20261023500300:9`; `admin/page.tsx:55-59`) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Cubierto por la versión conectada (ADM-02 #9); la versión demo (datos ficticios) no se porta |
| 10 | KPI «Técnicos trabajando hoy» | Técnicos únicos con asignación «Confirmada» en una oferta activa iniciada (`start ≤ hoy`) y `!days \|\| days.includes(hoy)`, «Únicos con asignación confirmada en una jornada de hoy» (en ejecución v2: 0) | «Técnicos trabajando ahora»: profesionales distintos con candidatura `confirmed` cuyo periodo contiene `now()` (`20261023500300:11`; `admin/page.tsx:60`) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Cubierto por la versión conectada (ADM-02 #10); la versión demo (datos ficticios) no se porta |
| 11 | KPI «AOG con vacantes» | Ofertas activas con `openSlots>0` y `urgency==='AOG'`, «Ofertas urgentes AOG aún por cubrir» (en ejecución v2: 16) | «AOG con vacantes»: necesidades activas `aog` con plazas sin confirmar, incluidas las ya iniciadas (`20261023500300:12`; `admin/page.tsx:61-65`, tono de aviso si > 0) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Cubierto por la versión conectada (ADM-02 #11); la versión demo (datos ficticios) no se porta |
| 12 | «Suscripciones mensuales previstas» | `Σ cents(plan.monthly)` de las empresas con contrato «Activa» / 100 (escenario: 4·50 + 4·200 + 4·400 = 2 600 €), «Solo contratos activos · sin impuestos · no cobrado» (en ejecución v2: 2600,00 €) | — | − | P3 | SCOPE OUT / OD-7 | — |
| 13 | «Comisión de asignaciones» | `Σ cents(fee)` de las asignaciones Confirmada/Finalizada de ofertas no canceladas, «Confirmadas + finalizadas · pendiente de revisión/facturación» | — | − | P3 | SCOPE OUT / OD-7 | — |
| 14 | «De trabajos finalizados» | La misma suma limitada a «Finalizada», «Incluida en la comisión anterior; no se vuelve a sumar» | — | − | P3 | SCOPE OUT / OD-7 | — |
| 15 | «Qué perfiles hacen falta» | Barras por categoría con «{n} plazas por cubrir», `<progress>` `aria-label="Demanda {cat}"`, «Ver demanda» y la nota «Vacantes simultáneas pendientes por oferta, no número de contrataciones futuras ni prueba de que no existan candidatos disponibles.» (en ejecución v2: «B1.1 · 10 plazas por cubrir», «B2 · 8 plazas por cubrir»…) | «Demanda por licencia»: lista «{código} · {n} plazas» (plural correcto) de las plazas pendientes por licencia obligatoria, con la nota «Plazas pendientes de cubrir en necesidades activas, por licencia obligatoria; una misma necesidad puede aportar a varias.» y vacío «Sin demanda pendiente.» (`admin/page.tsx:67-85`, es:1540-1543); sin barras `<progress>` ni «Ver demanda» (F3: `PKG P12 1b`) | ≈ (F3: antes −) | P3 | — | Cubierto por la versión conectada (ADM-02 #13); las barras son cosméticas |
| 16 | «Planes de ejemplo» | Esencial 50,00 €/mes · 2 anuncios; Equipo 200,00 € · 2; Red 400,00 € · 30. Nota: «Catálogo ilustrativo solicitado… No hay cobro, renovación automática ni bloqueo real de publicación.» (`adminModel.js:3`) | — | ✗ | — | OD-7 | No portar (planes ficticios) |
| 17 | «Empresas para explorar» | 6 tarjetas «{name}» «{type} · {plan\|\|'Sin plan'}» + «Ver las {n} empresas» | — | − | P3 | SCOPE (OUT: back office completo) | — |
| 18 | Empresas: filtros | «Buscar empresa» (placeholder «Empresa, ciudad o país»), «Plan de suscripción», «Estado del contrato» (Activa, Prueba, Pausada, Cancelada, Sin plan) | — | − | P3 | SCOPE (OUT: back office completo) | — |
| 19 | «Exportar vista» | `CrewFlex-empresas-demo.csv`: fila `FUENTE`, cabecera `Empresa;Tipo;Contrato;Plan;EUR/mes;Anuncios activos;Cupo;Comisión EUR`; BOM, `;`, CRLF y escape `' ` ante `= + @ -` (`progress.js:36`) | — | − | P3 | SCOPE (OUT: back office completo) | Si se porta, reutilizar el escape anti-fórmula |
| 20 | Tarjeta de empresa y cupo | «Plan {nombre}», «{€}/mes», «Anuncios activos / cupo», «Cupo superado: revisar contrato.» (solo visual), «Comisión asignada», «Abrir empresa» | — | − | P3 | SCOPE (OUT: back office completo) / OD-7 | — |
| 21 | Ficha de empresa | kicker «FICHA DE EMPRESA · DEMO», «Contrato», «Plan», «Mensualidad de catálogo», «Próxima fecha de revisión», «{contact} · Sin emisión de contratos ni envío de correo.» y «Descargar resumen de empresa» (`CrewFlex-resumen-empresa-demo.txt`, «RESUMEN DE DEMOSTRACIÓN. SIN VALIDEZ FISCAL.») | — | ✗ | — | DEMO-ONLY | — |
| 22 | Ofertas | «Buscar oferta o empresa», «Estado de oferta» y «Exportar ofertas» (`CrewFlex-ofertas-demo.csv`); tarjetas con «Plazas solicitadas», «Asignaciones», «Porcentaje fijado», «Comisión asignada» | — | − | P3 | SCOPE (OUT: back office completo) / OD-7 (dinero) | — |
| 23 | Demanda técnica | «Demanda de técnicos por cubrir», «{missing} plazas simultáneas pendientes en {n} ofertas. {pendingAog} son AOG.», tarjetas «{n} por cubrir» + «Ver empresa y oferta» | La misma lista «Demanda por licencia» de `/app/admin` (ADM-02 #13); sin «{missing} plazas simultáneas pendientes en {n} ofertas» ni «Ver empresa y oferta» (eso es la lista de ofertas del back office, #22) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | P3 | — | Cubierto por la versión conectada (ADM-02 #13); el enlace a cada oferta queda con #22 (SCOPE) |
| 24 | Conexiones futuras | «Preparado para conectar datos reales» con 5 filas «Pendiente» (Cuentas y empresas, Ofertas y jornadas, Suscripciones, Comisiones, Facturación y cobros) + nota | — | ✗ | — | — | No portar (hoja de ruta del prototipo; Next ya usa datos reales) |
| 25 | Incoherencia de fuente | La fuente `current` muestra «Planificado» donde `sample` muestra «Estándar» (`adminModel.js:19,27`) | — | ✗ | — | — | No copiar |

Capturas: v1.8 `evidencias/shots/demo/D-ADM-01-login-1440.png`, `evidencias/shots/demo/D-ADM-01b-login-error-1440.png`,
`evidencias/shots/demo/D-ADM-01-login-390.png`, `evidencias/shots/demo/D-ADM-02-panel-1440.png`,
`evidencias/shots/demo/D-ADM-07-escenario-resumen-1440.png`, `evidencias/shots/demo/D-ADM-03-empresas-1440.png`,
`evidencias/shots/demo/D-ADM-03b-empresa-detalle-1440.png`, `evidencias/shots/demo/D-ADM-04-ofertas-1440.png`,
`evidencias/shots/demo/D-ADM-05-demanda-1440.png`, `evidencias/shots/demo/D-ADM-06-conexiones-1440.png`; del 22/10,
`evidencias/xhigh/10/ADM-01-3-v18-1440-error.jpg` y `evidencias/xhigh/10/ADM-01-5-v18-1440-panel.jpg`. Next:
`evidencias/next-2026-10-22/N-ADM-home-1440.jpg` y `evidencias/xhigh/10/ADM-02-2-next-1440-admin.jpg`.
Capturas v2: v1.8 demo `evidencias/v2/10/V18-admin-demo-v18-1440.jpg` (puerta), `evidencias/v2/10/ADM-01-5-v18-1440-panel.jpg` (panel); Next `evidencias/v2/10/ADM-02-administracion-next-1440.jpg`.
F3 (P12, 27/10): `/app/admin` y la cola en español, `PKG P12 1b/2`; capturas en `docs/audit/evidence/parity/P12/`.

---

## ADM-02 · Administración conectada: invitaciones, panel operativo, buzón y auditoría — v1.8 `S-CON-13, S-CON-13a, S-CON-13c, S-CON-13d, C-ADMIN-01…07` ↔ Next `N-ADM-01` (historial de decisiones) + `/app/admin` (D-13, sin id de inventario)

**Estado global:** PARCIAL (F3 P12, 27/10: antes AUSENTE EN NEXT en contenido). Desde el 22/10 (D-13, `d3b876f`) hay portada
«Administración» (`/app/admin`) y el admin aterriza en ella; los paquetes del 23/10 (`account` T-40, `admin-org` T-50…T-53) le
dieron las invitaciones (#3, #4), el panel operativo sin dinero (#6-#11, #13) y la auditoría (#17); P12 lo re-verifica en el
navegador (`PKG P12`). Siguen fuera el buzón (DO-NOT-COPY), las comisiones y la lista de ofertas con porcentaje (SCOPE OUT /
OD-7). Lectura v2 que se mantiene:
- invitaciones: portables como default v1.8 (OD-8);
- panel operativo: las cifras sin dinero (técnicos, organizaciones, ofertas activas, trabajando ahora, AOG con
  vacantes, demanda por categoría) se tratan como portables (default v1.8; el owner puede leerlas como back office);
  comisiones, libro de comisiones y la lista de ofertas con su porcentaje siguen fuera (SCOPE OUT / OD-7);
- buzón: DO-NOT-COPY;
- auditoría: `audit_events` existe sin UI; vista de solo lectura portable (default v1.8).

El lado v1.8 se midió en v2 en el conectado con la sesión guardada del admin (`evidencias/v2/10/V18C-shell-runtime.json`,
`evidencias/v2/10/V18C-admin-admin-v18c-1440.jpg`). La parte de revisión se compara en ADM-03.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Navegación | El admin solo ve «Administración» + «Herramientas», y `home` → `admin` (en ejecución v2: lateral «ADMINISTRACIÓN» con «Administración» y «Herramientas»; `#home` → `#admin`) | Al entrar, `/app` lleva al `platform_admin` a `/app/admin` (`src/app/app/page.tsx:7`). El lateral de la vista «Administración» muestra «Plataforma › Administración, Verificaciones (con el flag), Organizaciones, Representaciones, Auditoría» y «Cuenta › Herramientas, Configuración» (`AppShell.tsx:74-103`): más entradas que las dos de v1.8 porque la revisión, la auditoría y las representaciones son páginas propias y no bloques de una sola página. «Ver como» lleva a sus otras vistas (SH-02 #18-#26). F3 (P12): `PKG P12 1b` comprueba los cuatro enlaces | ≈ (antes ≠) | — | OD-3 (Verificaciones, solo en producción) | Mantener (D-13) |
| 2 | Cabecera | «Administración · CUENTA INDIVIDUAL» + email + «Actualizar datos» (no recarga `/api/admin`) + «Cerrar sesión» (en ejecución v2: «Administración · CUENTA INDIVIDUAL · qa.admin@example.test · Actualizar datos · Cerrar sesión») | `/app/admin`: eyebrow «Plataforma», `h1` «Administración», «Herramientas de la plataforma disponibles para administradores.»; sin correo ni «Actualizar datos» (`admin/page.tsx:36`, es:1521-1523); el correo y «Cerrar sesión» están en el menú (SH-04) (F3: `PKG P12 1b`) | ≈ (antes ✗) | P3 | — | Mantener; no portar «Actualizar datos» |
| 3 | «Invitar a la beta» | Panel con «Email del invitado» (email, obligatorio), «Tipo de cuenta» (Técnico · Empresa · Recruiter, sin Administración) y «Crear invitación» (`Account.jsx:74`) (en ejecución v2, sin enviar) | Panel «Invitar» en `/app/admin` con «Correo del invitado» (email, obligatorio), «Tipo de cuenta» (Técnico · Empresa · Recruiter, nunca Administración: `INVITABLE_ACCOUNT_TYPES`) y «Crear invitación» (`InviteForm.tsx:17-96`, es:2372-2378; función `invitations`, RPC `create_account_invitation`, `20261023400000`), solo mientras el flag de owner `invitation_signup` está activo; sin él: «El alta está abierta en este entorno: las invitaciones están desactivadas.» (T-40). En local el flag está apagado (`PKG account a`) | ≈ (F3: antes −) | — | — | Mantener (T-40); portado el 23/10 (`account` package), re-verificado en P12 |
| 4 | Efecto de la invitación | Token de 7 días, enlace en el buzón y auditoría `invitation.created`. La UI solo dice «Cambios guardados.»: el URL no se muestra y el email no se vacía | Caducidad de 7 días y un solo uso por ese correo (`20261023400000:14,167`), auditoría `invitation.created` (`:203`), aviso propio «Invitación enviada a {email}.» (es:2378) y el formulario se vacía; el código nunca se muestra (solo su SHA-256 se guarda) y llega por el correo de Auth (`InviteForm.tsx:27-37`; PGlite `tests/db/account.test.ts`) | ≈ (F3: antes −) | — | — | Mantener (T-40) |
| 5 | Carga de datos | `GET /api/admin` con errores ignorados (`.catch(()=>{})`); sin datos solo se ve la invitación | Verificaciones: `ApiErrorState` si falla (`verifications/page.tsx:42-43`) | + | — | — | — |
| 6 | Cabecera del panel operativo | kicker «CONTROL OPERATIVO · DATOS DEL SERVIDOR»; `h2` «Tu plataforma, en cifras.»; «Información de cuentas autenticadas. Las empresas de la demo no forman parte de estos indicadores.» (`Operations.jsx:5`) (en ejecución v2) | Kicker «Control operativo · datos del servidor» (mayúsculas por CSS), `h2` «Tu plataforma, en cifras.», «Información de cuentas autenticadas. Sin importes: las comisiones y los planes no forman parte de esta versión.» (`admin/page.tsx:36-44`, es:1530-1532) (F3: `PKG P12 1b`, `PKG admin-org 3`) | ≈ (F3: antes −) | — | — | Mantener (T-53: cifras sin dinero) |
| 7 | KPI «Técnicos registrados» | `users.filter(role==='technician').length`: cuentas, no perfiles; baja al cerrar una cuenta (`server/connected.mjs:37`) En ejecución (v2): 24 | «Técnicos registrados»: cuentas con `account_type = professional` (como v1.8, cuentas y no perfiles), por RPC DEFINER `get_platform_summary` que comprueba el rol en su cuerpo (`20261023500300:7`, T-53; `features/admin/api.ts:19-29`) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Mantener |
| 8 | KPI «Empresas / recruiters» | Usuarios `company` + `recruiter` (en ejecución v2: 2) | «Organizaciones»: organizaciones, no usuarios (`20261023500300:8`) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Mantener |
| 9 | KPI «Ofertas activas» | `status==='published' && end > ahora` (las pausadas no cuentan) (en ejecución v2: 7) | «Necesidades activas» con la pista «Abiertas o cubiertas, no vencidas»: `open`/`covered` y `ends_at > now()`; las pausadas no cuentan (`20261023500300:9`; es:1536-1537) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Mantener |
| 10 | KPI «Técnicos trabajando ahora» | Técnicos distintos con candidatura `confirmed` y alguna jornada con `start ≤ ahora < end` (en ejecución v2: 1; README: 0 tras J1, otro revisor tendrá una jornada en curso) | «Técnicos trabajando ahora»: profesionales distintos con candidatura `confirmed` y periodo que contiene `now()` (`20261023500300:11`) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Mantener |
| 11 | KPI «Ofertas AOG con vacantes» | Ofertas activas con plazas-jornada pendientes y `urgency(día local de inicio, hoy).mode==='AOG'`. Si el inicio ya pasó, `urgency` lanza y la oferta no cuenta (hallazgo C §4-3) (en ejecución v2: 2, J5 y J7) | «AOG con vacantes»: necesidades activas `aog` con `headcount − confirmadas > 0`, incluidas las ya iniciadas (el hallazgo C §4-3 no se copia) (`20261023500300:12`) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Mantener |
| 12 | KPI «Comisión reconocida» | `Σ commissionCents` con `status !== 'void'` (incluye borradores) en € (en ejecución v2: 69,88 €) | — | − | P3 | SCOPE OUT (commissions) / OD-7 | — |
| 13 | «Demanda por categoría» | «Plazas-jornada futuras pendientes de cobertura; una misma oferta puede aportar varias.»; por jornada futura, `max(0, headcount − confirmadas/finalizadas en esa jornada)` agregado por categoría; «{n} plazas-jornada» (sin plural); vacío «Sin demanda pendiente.» (en ejecución v2: «B1.1 · 10 plazas-jornada», «B2 · 2 plazas-jornada») | «Demanda por licencia»: «Plazas pendientes de cubrir en necesidades activas, por licencia obligatoria; una misma necesidad puede aportar a varias.»; `headcount − confirmadas` por necesidad activa, agregado por licencia obligatoria (`20261023500300:14,48`); «{n} plaza(s)» con plural; vacío «Sin demanda pendiente.» (`admin/page.tsx:67-85`, es:1540-1543) (F3: `PKG P12 1b`) | ≈ (F3: antes −) | — | — | Mantener (plural correcto, por licencia y no por categoría) |
| 14 | «Empresas, ofertas y comisiones» | Select «Filtrar organización» («Todas las organizaciones»); «Los planes y cobros todavía no están activados en las cuentas conectadas. No se atribuyen suscripciones ficticias.»; filas «{title} · {org}», «{status en código} · {rate·100}% de comisión», «{n} candidaturas · {m} confirmadas»; vacío «Sin ofertas registradas.» (en ejecución v2: 9 ofertas de las dos organizaciones, p. ej. «published · 10% de comisión · 1 candidaturas · 1 confirmadas») | — | − | P3 | SCOPE (OUT: back office completo y comisiones) / OD-7 | — |
| 15 | «Libro de comisiones» | «{description} · {org}», «{€} · {%} · {Reconocida\|Borrador preparado\|Anulada}»; vacío «Sin comisiones reconocidas.»; pista «Reconocida al confirmar; borrador al finalizar; anulada si se cancela. No representa factura fiscal emitida ni pago cobrado.» (en ejecución v2: 4 asientos, uno «Anulada») | — | − | P3 | SCOPE OUT (V1_SCOPE OUT: commissions, invoicing) | — |
| 16 | «Buzón local de pruebas» | «Estos enlaces no se han enviado por email. Úsalos con identidades ficticias para comprobar el registro.»; últimos 100 «{email} · {invite\|verify\|reset}» + «Abrir enlace de {kind}» con el token en claro (en ejecución v2: enlaces `invite` y `verify` de los 22 técnicos semilla) | — | ✗ | — | DO-NOT-COPY (AD-11) | No portar |
| 17 | «Auditoría» | «Se muestran los últimos 200 eventos; el servidor conserva el historial completo.»; filas «{fecha local} · {acción}» sin actor ni objetivo (`Account.jsx:74`) En ejecución (v2): filas «22/10/2026, 16:35:50 · application.read», «… · notification.read», «… · invitation.created» | `/app/admin/audit`: «Auditoría», «Registro de solo lectura, del más reciente al más antiguo: qué acción, quién (identificador) y sobre qué. Sin texto libre ni datos personales.»; tabla «Cuándo · Acción · Actor · Objeto · Detalles» (ids acortados, metadatos `clave: valor`), 50 por página con «Más recientes»/«Más antiguos», bajo RLS `audit_events_select` (`audit/page.tsx:36-128`, `features/admin/map.ts`, es:1606-1630). Más que v1.8: actor y objeto (F3: `PKG P12 5b`, `PKG admin-org 5`) | ≈ (F3: antes −) | — | — | Mantener |
| 18 | Fechas | `toLocaleString()` sin locale: depende del navegador | `formatDateTime(locale)` en UTC (`verifications/page.tsx:82`) | + | — | — | — |
| 19 | Códigos sin traducir | Estado de oferta (`published`), tipo de documento (`license`), análisis (`quarantine`), tipo de enlace (`invite`) (hallazgo C-10) | Etiquetas traducidas (`tDomain`) | + | — | — | — |
| 20 | 390 px | KPIs en rejilla estrecha, sin scroll horizontal (`evidencias/shots/connected/C-ADMIN-05-dashboard-390.png`) (en ejecución v2: `scrollWidth = 390` con el admin) | Tabla con `overflow-x-auto` y `min-w-[32rem]` | = | — | — | — |
| 21 (nueva) | Revisión desde la portada | La «Revisión administrativa» va en la misma página de administración, siempre activa (`Account.jsx:74`; ADM-03) | Panel «Revisión de cualificaciones»: con el flag, botón «Abrir la cola de revisión» → `/app/admin/verifications`; sin él, «La revisión de cualificaciones está desactivada en este entorno.» (`admin/page.tsx:109-117`, es:1544-1548). En ejecución (v2 y F3 P12), con el flag activo en local: «Abrir la cola de revisión» | ≈ | — | OD-3 (activación en producción; en local, activa) | Mantener; se activa con OD-3 (ADM-03 #1) |
| 22 (nueva) | Herramientas del admin | «Herramientas» es la 2.ª y última entrada del menú del admin (`ConnectedShell.jsx:8`) | Panel «Herramientas» con «Abrir herramientas» → `/app/tools` (`admin/page.tsx:37-39`, es:972-973), además de «Herramientas» en la sección «Cuenta» del menú (`AppShell.tsx:38-41`) | ≈ | — | — | Mantener |

Capturas: v1.8 `evidencias/shots/connected/C-ADMIN-01-admin-empty-1440.png`, `evidencias/shots/connected/C-ADMIN-02-invite-ok-1440.png`,
`evidencias/shots/connected/C-ADMIN-05-dashboard-data-1440.png`, `evidencias/shots/connected/C-ADMIN-05-dashboard-data-filtered-1440.png`,
`evidencias/shots/connected/C-ADMIN-07-dashboard-working-now-1440.png`, `evidencias/shots/connected/C-ADMIN-05-dashboard-390.png`. Next
`docs/audit/evidence/local-22-verifications-1440.jpg` (`7f7235a`); portada `/app/admin`: `evidencias/next-2026-10-22/N-ADM-home-1440.jpg`
y `evidencias/xhigh/10/ADM-02-2-next-1440-admin.jpg`.
Capturas v2: v1.8 conectado `evidencias/v2/10/V18C-admin-admin-v18c-1440.jpg` (parte superior; el texto completo, con buzón y auditoría, en `evidencias/v2/10/V18C-shell-runtime.json`); Next `evidencias/v2/10/ADM-02-administracion-next-1440.jpg`, `evidencias/v2/10/ADM-02-recruiter-next-1440.jpg`.
F3 (P12, 27/10): las cifras, «Invitar» y «Auditoría» re-verificados en el navegador (`PKG P12 1b/5b`, `PKG admin-org 3/5`).

---

## ADM-03 · Revisión administrativa ↔ Revisión de cualificaciones — v1.8 `S-CON-13b, C-ADMIN-03/04` ↔ Next `N-ADM-01`

**Estado global:** PARCIAL y bloqueado. Next tiene un flujo de revisión más sólido que v1.8, pero **apagado**:
- v1.8 «registra» una revisión aprobatoria de organizaciones, perfiles y documentos, con una evidencia compartida y sin
  rechazo.
- Next decide «Verificar»/«Rechazar» por cualificación, con nota, concurrencia optimista, prohibición de auto-revisión y
  auditoría con referencia.
- En producción, las tres capas están en OFF y la función no está desplegada (OD-3). Sin verificador, ninguna
  cualificación obligatoria pasa a `verified` y el matching no encuentra elegibles: es la diferencia más grave de este
  bloque. En local las tres capas están activas y la cola funciona (v2, en ejecución).
- Con el alcance nuevo, la revisión de organizaciones y perfiles (OD-5, C-10) es portable como default v1.8; la de
  documentos sigue en D-10.
- F3 P12 (27/10): la revisión de organizaciones existe (`admin-org`, T-50/T-52; #6, #7); la cola enseña las restricciones
  declaradas del titular (#9) y pide evidencia también al verificar, guardada solo para la plataforma
  (`qualification_reviews`, `20261027300000`, T-170; #10). Producción sigue en OD-3 (#1).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Disponibilidad | Siempre activa para el rol `admin` (en ejecución v2, con el admin del conectado) | Apagada en 3 capas: env `QUALIFICATION_REVIEW_ENABLED` (`feature-flags.ts:12-14`), secreto de la Edge Function y fila `app_private.feature_flags`. `qualification-reviews` no está desplegada y la página da 404 (`verifications/page.tsx:27`). En local, con las tres capas activas, la cola funciona («Pendientes de revisión (n)»; F3 P12: `PKG P12 2-4` en español, pasos 21-21f en inglés). La portada `/app/admin` (D-13) lo dice: «La revisión de cualificaciones está desactivada en este entorno.» (es:1548) | ≠ (v2: antes −) | P0 | OD-3 (activación en producción; en local, activa) | Esperar OD-3 para producción: lista de verificadores y procedimiento de evidencia. En local ya funciona |
| 2 | Acceso sin rol con el flag activo | Hash no permitido → primera pestaña | 404 (`verifications/page.tsx:29`) | ≈ | — | — | — |
| 3 | Título | `h2` «Revisión administrativa» | Eyebrow «Plataforma» + `h1` «Revisión de cualificaciones» (es:976-977) | ≈ | — | — | — |
| 4 | Descripción | — | «Las cualificaciones autodeclaradas esperan aquí hasta que un administrador de la plataforma las comprueba. Solo las cualificaciones obligatorias verificadas hacen elegible a un profesional.» (es:978) | + | — | — | — |
| 5 | Nota sobre evidencias | Pista: «El análisis necesita ClamAV y firmas actualizadas en el servidor. Un análisis limpio no acredita cualificación.» | «Los documentos acreditativos no se consultan desde esta cola: el wallet documental de cada profesional es privado y no se comparte con revisores. Comprueba cada declaración con la autoridad emisora o con los documentos originales del profesional antes de verificar. Tu decisión y la referencia de la petición quedan auditadas.» (es:979; `18b7cae`, NX-04). Ya coincide con el código | ≠ | — | D-10 | Mantener |
| 6 | Qué se revisa | Organizaciones, perfiles y documentos (en ejecución v2: 2 organizaciones, perfiles «Pendiente» y 4 documentos) | Organizaciones (`/app/admin/organizations`, «Registrar revisión» con evidencia, T-50/T-52, `20261023500100`) y declaraciones de cualificación una a una (`/app/admin/verifications`, con las restricciones declaradas del titular, #9); no hay revisión de «perfil» como bloque (#8: granularidad por cualificación). Documentos: el admin no los ve ni descarga (#15) | ≈ (F3: antes −) | P2 | D-10 (solo documentos) | Mantener; los documentos esperan D-10 |
| 7 | Revisión de organización | «{name} · {estado}» / «{vat} · {country}» + «Registrar revisión» (en ejecución v2: «QA Talent Recruiting · Revisión registrada / PT500000000 · PT», «QA Aero Mantenimiento S.L. · Revisión registrada / ESB00000000 · ES») | Tarjeta «{name}» / «{tipo} · {país}», chip «Pendiente» / «Revisión registrada», «Identificación fiscal», «Domicilio fiscal», textarea de evidencia (1–2000, obligatoria, solo para la plataforma) y «Registrar revisión»; la propia organización y las incompletas no se pueden revisar; cambiar datos devuelve a pendiente (`OrganizationReviewList.tsx`, `reset_organization_review_on_change`, es:1584-1605) (F3: `PKG admin-org 4-6b`) | ≈ (F3: antes −) | — | — | Mantener (T-50/T-52) |
| 8 | Revisión de perfil | «{name} · {estado}» / «{category} · {aircraft}», restricciones en rojo, «Registrar revisión» (en ejecución v2: «Seed QA 16 · Pendiente / B1.1 · E190, A320») | Tarjeta por cualificación: código, «{nombre} · {categoría}», chip «Verificación pendiente», «Profesional» «{nombre} · {base}», «Declarada el», «Emisión» («No indicada»), «Caducidad» («Sin caducidad») (`ReviewQueue.tsx:79-109`, es:983-988) | ≠ | P2 | — | Mantener la granularidad por cualificación |
| 9 | Restricciones | «Resuelve las restricciones con el titular antes de revisar el perfil.»: rechazo del servidor al revisar un *perfil* con restricciones (`server/app.mjs:189`). En ejecución (v2): el perfil del técnico 2 enseña en rojo «Sin certificación CRS en motores; tareas de motor solo bajo supervisión de un B1 (QA).» | Bloque rojo «Restricciones declaradas» con el texto de `general_restrictions` del pasaporte y la frase v1.8 «Resuelve las restricciones con el titular antes de revisar el perfil.» como aviso en la tarjeta de la cola, sin bloquear (Next revisa cualificaciones, no perfiles; bloquear sería una regla nueva del owner) (`ReviewQueue.tsx`, es:1568-1569; `qualification-reviews/index.ts` lee `general_restrictions`; `ReviewQueueItem.professional.restrictions`). Las restricciones por habilitación de tipo (T-83/T-124) no se muestran: no son dato de la cualificación revisada (F3 P12: `PKG P12 2`, Deno «queue and history rows map…») | ≈ (F3: antes −) | — | — | Mantener |
| 10 | Campo de evidencia | Uno, compartido por todas las filas: «Evidencia / observaciones de la revisión», obligatorio en **toda** revisión (≤2000; «Evidencia de revisión: dato no válido.») (en ejecución v2) | Uno por tarjeta: «Evidencia o motivo» (2 filas, ≤500), **obligatorio en ambas decisiones**; pista «Obligatorio. Al verificar queda como evidencia para la plataforma; al rechazar, el profesional leerá el motivo. No incluyas datos personales.»; error «Indica la evidencia o el motivo de la revisión.» (cliente, Zod y RPC: 22023 «the review needs evidence»). La evidencia de cada decisión se guarda en `qualification_reviews` (solo `platform_admin`, sin grant de escritura; `20261027300000`, T-170); al titular solo le llega el motivo de un rechazo (`review_note`) (`ReviewQueue.tsx`, `validation/review.ts`, es:422,1566-1567) (F3: `PKG P12 3/4`, PGlite «P12 / T-170…», E2E «verifyWithoutEvidence») | ≈ (F3: antes ≠) | — | — | Mantener (T-170) |
| 11 | Decisiones | Solo «Registrar revisión» (`approve:true` → `reviewed`); no se puede rechazar | «Verificar» (primario) / «Rechazar» (`ReviewQueue.tsx:127-140`, es:991-992) | + | — | — | Mantener |
| 12 | Mensaje de resultado | «Cambios guardados.» | «{code} · {nombre}: Verificada. La cualificación ya cuenta para el matching.» / «…: Rechazada. El profesional puede ver el motivo.» (es:993-994); se queda visible al vaciarse la cola | + | — | — | — |
| 13 | Concurrencia | Solo para documentos: «El archivo ha cambiado.» | `expectedUpdatedAt` → «Esta declaración ya se decidió o ha cambiado. Recarga la cola.» (es:995) | + | — | — | — |
| 14 | Auto-revisión | No se comprueba | La RPC `review_qualification` la prohíbe | + | — | — | — |
| 15 | Documentos y análisis | «Analizar con ClamAV» (503 sin `CREWFLEX_CLAMSCAN`: «Configura CREWFLEX_CLAMSCAN con la ruta absoluta de ClamAV y firmas actualizadas.»), y con el archivo limpio «Descargar para revisar» y «Registrar revisión documental». Tipo y estado de análisis en código En ejecución (v2): «Licencia_B1.1_A320_QA.pdf · license · 2028-06-30 · clean · Revisión registrada» con «Descargar para revisar»; los otros tres en `quarantine` | Wallet con `scan_status` siempre `not_scanned`; el admin no revisa ni descarga | − | P1 | D-10 | Esperar la decisión del escáner |
| 16 | Vuelta a pendiente | Cambiar datos de cualificación u organización devuelve a `pending` (`server/app.mjs:74-75,83`) | Trigger que vuelve a pendiente (CX-54 PRESENT, más estricto) | = | — | — | — |
| 17 | Cola vacía | Sin texto | «Nada que revisar» / «Todas las declaraciones activas están decididas.» (es:981-982) | + | — | — | — |
| 18 | Tamaño de la lista | Todas las organizaciones y perfiles, sin paginar | ≤100 pendientes (las más antiguas primero) y ≤20 decisiones (`supabase/functions/qualification-reviews/index.ts:2,119,125`) | ≈ | P3 | — | — |
| 19 | Historial | «Auditoría» general (ADM-02 #17) | «Últimas decisiones»: «Cuándo» · «Decisión» (chip) · «Motivo indicado» (Sí/No) · «Referencia de la petición»; vacío «Todavía no hay decisiones.» (`verifications/page.tsx:52-103`, es:996-1005) | + | — | — | — |
| 20 | Servicio apagado en la acción | n/a | Devuelve `NOT_FOUND` con la clave `api.NOT_FOUND.description` en lugar del inglés (`src/features/reviews/actions.ts:21`; `135085c`, NX-08). La cola lo muestra con `actionErrorCopy`, que para `NOT_FOUND` dice «Este elemento ya no existe. Recarga la página.» (`ReviewQueue.tsx:63-66`, `Notice.tsx:112-113`, es:225); ya lo hacía el 21/10, así que el inglés nunca llegó a verse | + (antes ≠) | — | — | Mantener |

Capturas: v1.8 `evidencias/shots/connected/C-ADMIN-03-after-reviews-1440.png`, `evidencias/shots/connected/C-ADMIN-04-reviews-scan-1440.png`.
Next `docs/audit/evidence/local-22-verifications-1440.jpg`, `local-22-verifications-768.jpg` y
`local-22-verifications-390.jpg` (`7f7235a`).
Capturas v2: v1.8 conectado, texto de la «Revisión administrativa» en `evidencias/v2/10/V18C-shell-runtime.json`; Next, cola local activa en `evidencias/v2/10/SH-02-v2-views.json` (`verificaciones`).
F3 (P12, 27/10): `docs/audit/evidence/parity/P12/P12-verifications-restrictions-after-1440.jpg` y `-390.jpg` (es, cola con «Restricciones declaradas» y «Evidencia o motivo», del smoke sobre `next start`).

---

## SH-08 · Textos de shell, acceso, cuenta y administración — cobertura por fichero — v1.8 `LegacyApp.jsx, ConnectedShell.jsx, Account.jsx, AdminOverview.jsx, Operations.jsx, adminModel.js, DemoSwitcher.jsx, DataPanel.jsx` ↔ Next `messages/es.json` (`common`, `nav`, `auth`, `settings`, `admin`)

**Estado global:** PARCIAL. Las cadenas exactas que comparten v1.8 y Next se concentran en el menú y en las etiquetas de
dominio. Los ficheros de demo y admin (AdminOverview, Operations, adminModel, DemoSwitcher, DataPanel) no comparten
**ninguna** cadena propia (v2: Operations tiene ahora cifras portables, ADM-02, pero Next aún no las tiene). En
`Account.jsx` el extractor encuentra 13 exactas y 5 próximas (v2), porque Next reformula los textos de acceso.

Cambios del 22/10:
- Entran como exactas las opciones del selector («Técnico», «Empresa», «Recruiter», «Administración»/«ADMINISTRACIÓN»,
  D-13) y «Sesión cerrada.».
- Sale «Pasaporte»: el título de pestaña pasó a «Mi pasaporte» (W3-07, `fd01c52`).
- Método: `textos/string-coverage.md` se regeneró el 22/10 (11:11) a partir del mismo `string-diff.json`, y cada cadena
  cuenta en el primer fichero de su lista `files`. Por eso «Técnico», «Empresa» y «Recruiter» cuentan en `LegacyApp.jsx`
  y no en `Account.jsx`, `AdminOverview.jsx` ni `adminModel.js`. Las cifras de #1-#3 son las de ese fichero (xhigh).

Cambios v2 (tarde del 22/10): las cifras de #1-#3 salen ahora de `textos/string-coverage-v2.md` y `string-diff-v2.json`,
generados sobre el catálogo de `821c24f` (1020 claves; el SNAP2 `038329f` tiene 1026: las 6 nuevas son de la edición de
necesidades y no tocan estos ficheros). Entran como exactas «Oportunidades», «Mis candidaturas» y «Candidaturas» en
`LegacyApp.jsx`, y «Ver oportunidades», «Reanudar», «Presentar candidatura», «Enviar propuesta», «Aceptar propuesta» y
«Motivo:» en `Account.jsx` (estas seis, de M05/M07/M08, se comparan en `20-technician.md` y `30-company-hiring.md`).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | `LegacyApp.jsx` | 77 cadenas: 15 exactas, 3 próximas y 59 solo en v1.8 (`textos/string-coverage-v2.md:26`; xhigh: 12, 3 y 62; 21/10: 10, 2 y 66) | Exactas: «Herramientas», «Mi pasaporte», «Resumen», «Mi espacio», «Disponibilidad», «Organización», «Nueva necesidad», «Wallet documental», «Inicio» (`nav.*`, `meta.*`, `documents.title`), «Técnico», «Empresa», «Recruiter» (`nav.views.*`, es:76-78) y, nuevas en v2, «Oportunidades», «Mis candidaturas» (`nav.opportunities`, `nav.applications`, es:81-82) y «Candidaturas» (`meta.requirementApplications`, es:55). Próximas: «Herramienta», «Ver notificaciones» (falso positivo, #8) e «Identidad profesional» ↔ «Tu identidad profesional» (`professional.identity.label`) | ≈ | — | — | — |
| 2 | `ConnectedShell.jsx` | 17 cadenas: 3 exactas, 0 próximas y 14 solo en v1.8 (`textos/string-coverage-v2.md:49`; sin cambios desde xhigh; 21/10: 1 y 17) | Exactas: «Iniciar sesión», «Administración» y «ADMINISTRACIÓN» ↔ «Administración» (`nav.views.admin`, `meta.admin`, es:79,50). Solo en v1.8: «Acceder a mi cuenta», «Avisos», «Directorio», «Comisiones», «Ofertas y publicación», «Volver a la demo», «Cuenta autenticada», «Acceso por invitación», «Servidor local · datos propios», «Ver demo», «V1.8 · Cuenta conectada», «V1.8 · Beta local conectada», «BETA LOCAL». «Candidaturas» y «Oportunidades» existen ya en Next, pero cuentan en `LegacyApp.jsx` | − | P3 | — (v2: «Avisos» y «Directorio» portables; comisiones SCOPE OUT; el resto DEMO-ONLY) | Con SH-03 #10 y #19; el resto, ninguna |
| 3 | `Account.jsx` (alcance de este fichero) | 165 cadenas: 13 exactas, 5 próximas y 147 solo en v1.8 (`textos/string-coverage-v2.md:20`; xhigh: 7 y 5; 21/10: 6 y 5). Exactas de este fichero: «Crear cuenta», «Cerrar sesión», «Tipo de cuenta», «Organización ·», «Cerrada», «Abrir documentos» (de cualificaciones), «Sesión cerrada.» y, nuevas en v2 y de otras áreas, «Ver oportunidades», «Reanudar», «Presentar candidatura», «Enviar propuesta», «Aceptar propuesta», «Motivo:». Próximas: «Crear tu cuenta», «He olvidado mi contraseña», «Cerrar cuenta» (falso positivo, #8), «Inicio UTC» y «Fin UTC». «Iniciar sesión», «Contraseña», «Nombre», «Verificar» y «Rechazar» también existen en Next, pero cuentan en otro fichero | `auth.*` (`auth.signIn.signedOut`, es:117), `common.signOut`, `settings.*`, `admin.reviews.*`; las seis nuevas en `applications.*`, `opportunities.*` y `organization.detail.status.*` | ≈ | — | — | — |
| 4 | Errores de acceso sin clave en Next | «Credenciales no válidas.», «Verifica primero tu email.», «Demasiados intentos. Espera 15 minutos.», «La cuenta ya existe.», «Enlace caducado, utilizado o no válido.», «Acepta las condiciones de beta local.», «La invitación pertenece a otro email.», «Cuenta no disponible.», «La contraseña necesita entre 12 y 128 caracteres.» | Redacciones propias (`auth.errors.*`, `v.password.*`, es:142-152,237-241). El límite de intentos ya tiene clave: `auth.errors.RATE_LIMITED` «Demasiados intentos. Espera unos minutos e inténtalo de nuevo.» (es:152; `f143741`) | ≈ | — | — | — |
| 5 | Mi cuenta sin clave en Next | «Tu cuenta y tus datos», «Exportar mis datos y archivos», «Exportación preparada.», «Cerrar cuenta», «Escribe CERRAR», «Cerrar mi cuenta», «Escribe CERRAR para confirmar.», «Resuelve primero los compromisos aceptados o confirmados.» | — | − | P1 | — (v2: default v1.8, M-3) | Con ACC-01 #7-#10 |
| 6 | `AdminOverview.jsx` / `adminModel.js` / `Operations.jsx` | 98 + 18 + 24 cadenas, 0 compartidas | — | ✗ | — | DO-NOT-COPY / SCOPE | — |
| 7 | `DemoSwitcher.jsx` / `DataPanel.jsx` | 6 + 27 cadenas, 0 compartidas | — | ✗ | — | DEMO-ONLY | — |
| 8 | Falso positivo del extractor | «Cerrar cuenta» aparece como «próxima» de `auth.register.*` («Crear cuenta»); «Ver notificaciones» como próxima de `nav.verifications` | No tienen relación | ✗ | — | — | Ignorar |
| 9 | «Ir al contenido» | Cuenta como solo en v1.8 | «Saltar al contenido» (es:5) | ≈ | — | — | — |

Capturas: no aplica. Fuente de datos: `textos/string-diff.json` regenerado el 22/10 (2101 cadenas v1.8; exactas 214 y
próximas 31, frente a 199 y 28 del 21/10; 856 claves Next, antes 802) y `textos/string-coverage.md`, regenerado el 22/10.
Fuente v2: `textos/string-coverage-v2.md` y `textos/string-diff-v2.json` (catálogo de `821c24f`, 1020 claves; SNAP2 1026).

---

## Recuento

Elementos comparados: **317** filas en las 20 tablas de elementos (xhigh: 314; refresco de la mañana: 312; 21/10: 301). La
verificación v2 añade 3 filas (SH-06 #14 y #15, SH-07 #15) y no quita ninguna. Se cuentan con un script
(`work/10/count10.py`) sobre la columna Diff, tomando el primer símbolo de la celda, y la severidad de la columna Sev. (191
filas sin severidad). No entra la matriz por rol de SH-03, que resume las filas 1-32 de esa misma sección. SH-08 repite,
como textos, elementos de otras secciones; sin SH-08 quedan 308 elementos.

Recuento v2: 317 filas · `=` 29 (xhigh 26) · `≈` 82 (79) · `≠` 38 (38) · `−` 66 (72) · `+` 58 (57) · `✗` 44 (42).
Severidades: P0 2 (2) · P1 14 (18) · P2 33 (34) · P3 77 (76).

| Diff / Sev. | SH-01 | SH-02 | SH-03 | SH-04 | SH-05 | SH-06 | SH-07 | AUTH-01 | AUTH-02 | AUTH-03 | AUTH-04 | AUTH-05 | AUTH-06 | ACC-01 | ACC-02 | ACC-03 | ADM-01 | ADM-02 | ADM-03 | SH-08 | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `=` | 0 | 0 | 6 | 1 | 2 | 0 | 2 | 1 | 1 | 1 | 4 | 4 | 4 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | **29** |
| `≈` | 2 | 6 | 10 | 4 | 2 | 4 | 3 | 11 | 8 | 1 | 10 | 2 | 2 | 5 | 0 | 1 | 0 | 4 | 3 | 4 | **82** |
| `≠` | 2 | 4 | 4 | 1 | 2 | 1 | 1 | 2 | 3 | 3 | 1 | 3 | 2 | 1 | 1 | 1 | 2 | 0 | 4 | 0 | **38** |
| `−` | 1 | 1 | 6 | 3 | 4 | 2 | 0 | 0 | 4 | 2 | 0 | 1 | 0 | 6 | 0 | 2 | 15 | 13 | 4 | 2 | **66** |
| `+` | 3 | 1 | 4 | 2 | 1 | 7 | 9 | 3 | 2 | 0 | 6 | 1 | 1 | 1 | 6 | 0 | 0 | 3 | 8 | 0 | **58** |
| `✗` | 6 | 14 | 2 | 2 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 2 | 2 | 0 | 1 | 8 | 1 | 0 | 3 | **44** |
| filas | 14 | 26 | 32 | 13 | 11 | 15 | 15 | 18 | 18 | 7 | 21 | 12 | 11 | 16 | 7 | 5 | 25 | 22 | 20 | 9 | **317** |
| P0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | **2** |
| P1 | 0 | 0 | 3 | 0 | 0 | 1 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 1 | 2 | 1 | **14** |
| P2 | 1 | 0 | 3 | 1 | 2 | 1 | 1 | 1 | 3 | 4 | 0 | 1 | 2 | 4 | 0 | 3 | 0 | 2 | 4 | 0 | **33** |
| P3 | 2 | 3 | 8 | 6 | 5 | 1 | 2 | 3 | 3 | 2 | 4 | 2 | 1 | 4 | 1 | 1 | 16 | 11 | 1 | 1 | **77** |

Cambios de símbolo en v2 (10): SH-03 #6 `−`→`=`, SH-03 #7 `−`→`≈`, SH-03 #20 `−`→`≠`, SH-03 #21 `−`→`✗`, SH-04 #13
`≠`→`=`, AUTH-02 #6 `≠`→`≈`, AUTH-04 #13 `≠`→`≈`, AUTH-05 #8 `≠`→`=`, ACC-01 #14 `−`→`≠`, ADM-03 #1 `−`→`≠`. Cambian de
bloqueo 93 filas (alcance nuevo y defaults v1.8).

Por bloqueo, de los 66 `−`:
- **42 portables ya** (v2; 0 en xhigh):
  - 8 por el alcance LATER: avisos, campana y actividad (SH-03 #10, SH-04 #2, SH-06 #11, #12), logbook y reto diario
    (SH-03 #9, #14), espacio recruiter (SH-02 #26) y alertas AOG (ACC-03 #4);
  - 8 con default v1.8 de OD-8: invitación, código, errores, verificación y caducidades (AUTH-02 #7, #14, #15, AUTH-03 #3,
    #4, AUTH-05 #3, ADM-02 #3, #4);
  - 6 con default v1.8 de M-3: exportar y cerrar la cuenta (ACC-01 #7-#10, #16, SH-08 #5);
  - 5 con default v1.8 de C-12: dock y pie (SH-04 #10, SH-05 #1-#3, #10);
  - 7 con otros defaults v1.8 (OD-5, C-10, D-07 sin P3): directorio, organización, bloqueo de empresa, revisión de
    organizaciones y perfiles, restricciones (SH-03 #19, #22, ACC-03 #3, ADM-03 #6, #7, #9, SH-08 #2);
  - 8 del panel de administración conectado sin dinero y su auditoría (ADM-02 #6-#11, #13, #17).
- **19 SCOPE OUT**: el panel demo y su back office (ADM-01, 15 filas), comisiones en el menú (SH-03 #23) y comisiones del
  panel conectado (ADM-02 #12, #14, #15).
- **2 texto legal** (AUTH-02 #8, ACC-01 #13) y **1 D-10** (ADM-03 #15).
- **2 de otras áreas o sin hueco**: service worker (SH-01 #14, NEW-01) y breadcrumb (SH-04 #1, NOT_A_GAP).

**Defectos de Next.**
- Del xhigh (5): SH-04 #13 corregido (`52929c9`); SH-04 #3 corregido (`745c1fc`); AUTH-05 #8 corregido (`0cc90be`); SH-04 #6
  corregido en parte (`5d85caa`: 44 px con puntero grueso, 20 px con fino); SH-07 #14 corregido en parte (`552415c`: 404
  real en las rutas de plataforma; las necesidades de otra organización siguen con 200, sin lateral y con su título).
- Nuevo en v2 (1): SH-07 #15 (P3), `src/app/app/professional/applications/page.tsx:43-49`: una cuenta de organización ve en
  «Mis candidaturas» el estado vacío del técnico («Tu próxima candidatura empieza aquí»), mientras «Oportunidades» le dice
  que son para profesionales (`evidencias/v2/10/SH-07-v2-new-routes.json`).

**Diferencias de mayor severidad.**
1. **ADM-03 #1 (P0, OD-3 en producción).** En local la revisión funciona; en producción sigue apagada en las 3 capas y la
   función no está desplegada. Sin verificador, ninguna obligatoria llega a `verified` y el matching no encuentra elegibles.
2. **Avisos (SH-03 #10, SH-06 #12, P1).** v1.8 conectado avisa de la difusión Urgente/AOG y de cada cambio de candidatura;
   Next no tiene avisos, ahora que M07/M08 generan esos cambios. Portable (LATER).
3. **Alta por invitación, exportación y cierre de cuenta (AUTH-02 #1, #7, ACC-01 #7, #9, P1).** Portables como defaults
   v1.8 de OD-8 y M-3.
4. **Organización, directorio y revisión de organizaciones (SH-03 #19, #22, ADM-03 #6, P1).** Portables como defaults v1.8
   (OD-5, D-07 sin P3); coordinadas con `30-company-hiring.md`.

---

## Backlog derivado

Lista de tareas portables **con el alcance nuevo** (v2, 22/10/2026 por la tarde): NOW + NEXT + LATER de `V1_SCOPE.md`, con
el comportamiento v1.8 como default técnico documentado y reversible donde hay una decisión abierta (`08-product-decisions.md`
§DEFAULTS). Todo en local: lo que necesita migración de BD o Edge Function exige autorización del owner para desplegar. Las
tareas que pertenecen a otra área se citan con su fichero y no se repiten aquí con detalle. Orden: severidad y, dentro de
cada una, impacto. Estado comprobado en el código del SNAP2 (`038329f`), no en las marcas «VERIFIED/HECHO» de los docs.

Recuento: **20 PENDIENTES** (P1 6 · P2 8 · P3 6; tamaño L 7 · M 8 · S 5), **14 HECHAS** (dos en parte) y 9 grupos
**BLOQUEADOS**.

### Pendientes

**P1**

1. **Avisos internos y su indicador** (SH-03 #10, SH-04 #2, SH-06 #11, #12, #14, ACC-03 #4). Default: alcance LATER
   (avisos in-app, SCOPE-2).
   - Ficheros: migración nueva (tabla de avisos por destinatario, RLS de solo lectura propia), emisión en
     `supabase/functions/applications` y en la difusión Urgente/AOG (`30-company-hiring.md` ORG-06), Edge Function de
     lectura y «marcar como leído», página de avisos bajo `/app`, entrada «Avisos» en `src/components/layout/AppShell.tsx`
     con icono en `NavLinks.tsx`, `messages/{es,en}.json`.
   - Aceptación: el técnico ve los avisos de difusión («Urgente: …», «AOG: …») y los cambios de sus candidaturas, con
     «Nuevo» hasta abrirlos y «Marcar todas como leídas»; la organización ve los cambios de candidaturas de sus
     necesidades con el estado traducido (nunca `accepted` en crudo) y una entradilla propia; el lateral marca los no
     leídos; no sale ningún correo ni push (OUT). Tests de RLS (nadie lee avisos ajenos).
   - Tamaño: L. BD: sí. Edge: sí. Detalle funcional en `30-company-hiring.md` HIRE-07.
2. **Alta por invitación** (AUTH-02 #1, #3, #7, #14, #15, AUTH-01 #10, AUTH-05 #3, ADM-02 #3, #4). Default v1.8 (OD-8),
   detrás de un flag para poder volver al alta abierta.
   - Ficheros: migración (invitaciones con hash del código, correo, tipo de cuenta, caducidad de 7 días, uso único; RLS
     de alta y lectura solo para `platform_admin`) y comprobación en el trigger de alta; panel «Invitar» en
     `src/app/app/admin/page.tsx`; campo «Código de invitación» y `?invite=` en `RegisterForm.tsx` y `actions.ts`;
     `messages/{es,en}.json`. Si el enlace se envía con la API de administración de Auth, la función necesita service
     role: justificación en `docs/architecture/EDGE_FUNCTIONS.md`, comprobación explícita y evento de auditoría.
   - Aceptación: con el flag, sin código válido el alta falla con un mensaje propio; un código de otro correo no se
     consume y da su error; el tipo de cuenta sale de la invitación; el admin crea una invitación (correo + tipo, sin
     «Administración») y ve un aviso propio, nunca el token; auditoría `invitation.created`; sin el flag, el alta
     abierta sigue igual. Tests de RLS y del trigger.
   - Tamaño: L. BD: sí. Edge: sí (o RPC).
3. **Confirmación del correo con destino propio** (AUTH-03 #1-#5, AUTH-02 #12, #13, AUTH-05 #4). Default v1.8 (OD-8).
   - Ficheros: `supabase/config.toml` (`enable_confirmations = true`, local), `src/features/auth/actions.ts`
     (`emailRedirectTo` → `/auth/confirm?next=/app`), `src/app/auth/confirm/route.ts` (aceptar los enlaces de alta) y
     `src/app/(auth)/login/page.tsx` (aviso «Correo confirmado…»), `messages/{es,en}.json`. Producción (URL de redirección,
     confirmación) la cambia el owner.
   - Aceptación: un alta nueva en local recibe el enlace en el buzón local de Supabase; al abrirlo aterriza en el login
     con el aviso; un enlace de alta caducado ya no acaba en `/forgot-password?expired=1`; el duplicado no se enumera.
   - Tamaño: M. BD: no. Edge: no.
4. **Exportar mis datos y cerrar la cuenta** (ACC-01 #7-#12, #16, SH-08 #5). Default v1.8 (M-3), sin su borrado parcial.
   - Ficheros: Edge Function nueva de cuenta (exportación y cierre), migración de retención (los compromisos y la auditoría
     se conservan sin el perfil), panel «Tus datos» en `src/app/app/settings/page.tsx`, `messages/{es,en}.json`. El
     borrado del usuario de Auth necesita service role: justificación en `EDGE_FUNCTIONS.md`, comprobación y auditoría.
   - Aceptación: «Exportar mis datos y archivos» descarga un JSON con los registros propios y los documentos del wallet;
     «Cerrar cuenta» exige escribir «CERRAR» y se niega con candidaturas `accepted` o `confirmed` («Resuelve primero…»);
     una organización que cierra cierra sus necesidades abiertas; tras el cierre no se puede entrar, el perfil desaparece
     del matching y queda `account.closed` en la auditoría; ninguna candidatura cambia de estado en silencio.
   - Tamaño: L. BD: sí. Edge: sí.
5. **Pantalla «Organización» y revisión de organizaciones** (SH-03 #22, AUTH-02 #10, ADM-03 #6, #7, ACC-03 #2). Default
   v1.8 (OD-5).
   - Ficheros: migración (razón social, identificación fiscal, domicilio fiscal, país y estado de revisión; vuelta a
     pendiente al cambiar datos), Edge Function de la organización, página bajo `/app/organization` con entrada de menú,
     revisión en `/app/admin/verifications`, `messages/{es,en}.json`. Campos en `30-company-hiring.md` ORG-07.
   - Aceptación: admin/manager editan los cuatro datos y ven «Pendiente» o «Revisión registrada»; cambiar un dato vuelve a
     pendiente; el `platform_admin` registra la revisión con evidencia y queda auditada; la organización no puede
     revisarse a sí misma. Tests de RLS.
   - Tamaño: L. BD: sí. Edge: sí.
6. **Entrada «Directorio» / «Buscar candidatos»** (SH-03 #19, SH-05 #2). Default v1.8; contacto, identidad y documentos
   siguen en D-07 P3 / D-10. La tarea completa es de `30-company-hiring.md` MKT-01; aquí solo la entrada de menú (y del
   dock, #8) cuando exista la pantalla. Tamaño: L (con la pantalla). BD: sí. Edge: sí.

**P2**

7. **«Candidaturas» de la organización** (SH-03 #20, SH-05 #2). Default v1.8.
   - Ficheros: `supabase/functions/applications/index.ts` (lista por organización para admin/manager),
     `src/features/applications/api.ts`, página `src/app/app/organization/applications/page.tsx`, entrada en
     `AppShell.tsx` tras «Necesidades».
   - Aceptación: admin/manager ven todas las candidaturas de su organización, filtrables por estado, con enlace a cada
     necesidad; `member` ve el aviso de rol; la entrada solo aparece con membresía. Test de la función.
   - Tamaño: M. BD: no. Edge: sí.
8. **Dock móvil** (SH-05 #1-#3). Default v1.8 (C-12; la condición «revisit after M07» ya se cumple).
   - Ficheros: componente nuevo en `src/components/layout/`, `AppShell.tsx`, `messages/{es,en}.json`.
   - Aceptación: por debajo de `lg`, `nav` «Accesos rápidos» fija abajo: técnico «Inicio · Ofertas · Calendario ·
     Candidaturas · Herramientas»; organización con las entradas que existan; admin «Administración · Herramientas»;
     `aria-current`; a 390 px sin scroll horizontal y sin tapar contenido; a 1024 px no se ve.
   - Tamaño: M. BD: no. Edge: no.
9. **Vista de auditoría del admin** (ADM-02 #17). Default v1.8.
   - Ficheros: migración (lectura de `audit_events` solo para `platform_admin`, por política o RPC), página
     `src/app/app/admin/audit/page.tsx` y enlace en la portada, `messages/{es,en}.json`.
   - Aceptación: los últimos 200 eventos con fecha en el idioma del usuario, acción, actor y objeto; 404 real para quien
     no es `platform_admin` (como X-11); test de RLS.
   - Tamaño: M. BD: sí. Edge: no.
10. **Herramientas sin cuenta** (SH-01 #13). Default v1.8. Es `40-tools-learning.md` TOOL-01 #1; tamaño M, sin BD.
11. **Sesión de 12 h** (AUTH-05 #2). Default v1.8.
    - Ficheros: `supabase/config.toml` (`timebox = "12h"`, local), `docs/product/SECURITY_PRIVACY.md`.
    - Aceptación: en local, una sesión iniciada hace más de 12 h vuelve a `/login?next=…`; producción la ajusta el owner.
    - Tamaño: S. BD: no. Edge: no.
12. **Revisión de perfiles con restricciones y evidencia al verificar** (ADM-03 #8-#10). Default v1.8 (C-10; la dirección
    aceptada de OD-3 pide «evidence + audit»).
    - Ficheros: `supabase/functions/qualification-reviews/index.ts` (nota obligatoria también al verificar),
      `src/features/reviews/components/ReviewQueue.tsx`, `src/features/reviews/actions.ts`; restricciones declaradas en el
      pasaporte (`20-technician.md`).
    - Aceptación: «Verificar» sin nota da un error de campo; un perfil con restricciones abiertas no se puede dar por
      revisado y lo explica; tests de la función.
    - Tamaño: M. BD: sí (restricciones). Edge: sí.
13. **«Empresas verificadas» y bloquear a una empresa** (ACC-03 #2, #3). Default v1.8 (OD-5); depende de la tarea 5.
    Detalle en `20-technician.md`. Tamaño: M. BD: sí. Edge: sí.
14. **Logbook y reto diario en el menú** (SH-03 #9, #14). Alcance LATER. La entrada llega con cada módulo
    (`40-tools-learning.md`, `20-technician.md`). Tamaño: L (con los módulos). BD: sí (logbook).

**P3**

15. **Cifras de la plataforma en `/app/admin`** (ADM-02 #6-#11, #13). Default v1.8, con una interpretación de alcance que
    el owner debe confirmar: cifras operativas sin dinero, no el back office completo (OUT).
    - Ficheros: RPC o Edge Function de resumen para `platform_admin`, `src/app/app/admin/page.tsx`,
      `messages/{es,en}.json`.
    - Aceptación: técnicos registrados (cuentas profesionales), organizaciones, necesidades activas (abiertas, no vencidas,
      sin las pausadas), técnicos trabajando ahora (candidaturas `confirmed` con el periodo en curso), AOG con vacantes
      (también las que ya han empezado, a diferencia de v1.8) y demanda por categoría con plural correcto; ninguna cifra de
      dinero; 404 real para los demás.
    - Tamaño: M. BD: sí. Edge: sí o RPC.
16. **Pie con el lema** (SH-04 #10, SH-05 #10). Default v1.8 (C-12).
    - Ficheros: `AppShell.tsx`, `messages/{es,en}.json`.
    - Aceptación: «CREWFLEX AVIATION · Cualificación · Disponibilidad · Confianza» al pie de `/app` en `lg+`; oculto el lema
      en móvil, como v1.8; sin etiqueta de versión.
    - Tamaño: S. BD: no. Edge: no.
17. **Espacio recruiter** (SH-02 #26, AUTH-02 #4). Alcance LATER; D-12 con el modelo provisional (agencia + clientes
    representados) como default. Es `30-company-hiring.md` ORG-08. Tamaño: L. BD: sí. Edge: sí.
18. **Rutas denegadas: lo que queda** (SH-07 #14). En parte HECHO por X-11.
    - Ficheros: `generateMetadata` de `src/app/app/organization/requirements/[id]/page.tsx`, `[id]/matches/page.tsx` y
      `[id]/applications/page.tsx` (comprobar la organización activa) y, opcional, `src/app/app/not-found.tsx` con el
      lateral.
    - Aceptación: `platform.admin` en una necesidad de otra organización lee «Crew Flex» (o un 404 real) y no «Necesidad ·
      Crew Flex»; «No encontrado» dentro de `/app` conserva el lateral (o se documenta que no).
    - Tamaño: S. BD: no. Edge: no.
19. **«Mis candidaturas» con una cuenta de organización** (SH-07 #15, defecto nuevo de Next en v2).
    - Ficheros: `src/app/app/professional/applications/page.tsx:43-49`, `messages/{es,en}.json`.
    - Aceptación: `admin.mro` ve un aviso «solo para profesionales» como en Oportunidades, no «Tu próxima candidatura
      empieza aquí».
    - Tamaño: S. BD: no. Edge: no.
20. **Rol de plataforma en Configuración** (ACC-01 #4, opcional).
    - Ficheros: `src/app/app/settings/page.tsx`, `messages/{es,en}.json` (`domain.platformRole.*`).
    - Aceptación: `platform.admin` lee también «Administración de la plataforma» en «Cuenta»; las demás cuentas no cambian.
    - Tamaño: S. BD: no. Edge: no.

### Hechas (comprobado en el código del SNAP2 `038329f`)

1. Bucle `/app` ↔ `/login` con perfil ilegible (SH-07 #11): `d275254` (W1-01).
2. Mensaje propio para el límite de intentos (AUTH-01 #13, AUTH-05 #6): `f143741` (W2-08).
3. Contraseña mínima de 12 (AUTH-02 #6, AUTH-04 #13): `94590ba` (X-14, Q-01). En producción, Auth sigue en 10 hasta que el
   owner lo cambie; la app ya rechaza menos de 12.
4. Textos y documentación que contradecían el código (AUTH-04 #12, #20, ADM-03 #5): `18b7cae` (W1-08).
5. Correo de la cuenta en Configuración (SH-04 #4, ACC-01 #5): `a770aed` (W2-05).
6. Tipo de cuenta y rol en el lateral (SH-04 #3): `d12164a` (W2-06).
7. «Sesión cerrada.» tras cerrar sesión (AUTH-05 #9): `01486a3` (W2-07).
8. Configuración con la membresía principal (ACC-01 #6): `c7956b2` (W1-09).
9. Lateral desplazable en `lg+` (SH-04 #13): `52929c9` (X-03). Medido en v2 a 1366×768 y 1024×768.
10. Rol de plataforma en el pie del lateral (SH-04 #3): `745c1fc` (X-13), con test.
11. Objetivo táctil del «Cerrar sesión» del pie (SH-04 #6): `5d85caa` (X-09), **en parte**: 44 px con puntero grueso; con
    puntero fino sigue en 20 px de alto (cumple WCAG 2.5.8 por espaciado).
12. Rutas denegadas con 404 real y título neutro (SH-07 #14): `552415c` (X-11), **en parte**: las de plataforma; quedan las
    necesidades ajenas (tarea 18).
13. «Cerrar sesión» solo en este dispositivo (AUTH-05 #8): `0cc90be` (X-12). Medido en v2 con dos contextos; no tiene test
    automático.
14. Entradas «Oportunidades» y «Mis candidaturas» del técnico, en el orden de v1.8 (SH-03 #6, #7): `db05af1` (M07/M08).

### Bloqueadas (siguen fuera)

- **OD-3 en producción** (ADM-03 #1, P0; SH-03 #25, ADM-02 #1, #21): activar la revisión fuera de local (lista de
  verificadores y procedimiento de evidencia). En local ya funciona.
- **D-10** (ADM-03 #15, #5): documentos y análisis en la revisión y cualquier acceso de terceros a documentos.
- **D-07 P3** (ACC-01 #14, parte de SH-03 #19): consentimiento de contacto, identidad y contacto del pack.
- **Texto legal del owner** (AUTH-02 #8, ACC-01 #13): casilla de condiciones del alta (el texto de v1.8 es de beta local).
- **SCOPE OUT** (SH-03 #23, ADM-02 #12, #14, #15, ADM-01 #12-#14, #16, #20, #22): comisiones, libro de comisiones, planes y
  suscripciones; el panel demo «Control CrewFlex» y su back office (ADM-01 #5, #7-#11, #15, #17-#19, #23).
- **DO-NOT-COPY / DEMO-ONLY** (todas las `✗`): buzón con tokens, credencial `admin/admin`, selector de rol sin
  autenticación, personajes, respaldo, banners de beta; «Ofertas en la red» de la demo (SH-03 #21).
- **Ajustes de producción del owner**: CSP aplicada tras una ventana limpia (AUTH-06 #7), T22 (AUTH-04 #21, ACC-01 #15),
  Auth de producción (contraseña 12, confirmación, URL de redirección, tope de sesión).
- **Otras áreas**: service worker (SH-01 #14, META-03 en `50-visual-meta-a11y.md`); marca «CrewFlex» e isotipo (SH-04 #9,
  VIS-08); breadcrumb (SH-04 #1, NOT_A_GAP).
- Los `✗` son instrucciones para cuando se porte cada pieza («no copiar»), no tareas.
