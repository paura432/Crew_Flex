# 20 · Diff v1.8 ↔ Next — Pantallas del técnico/profesional

**F3 (26/10, tras P01, P02 y P03; `recount.py`):** filas 312 · = 112 · ≈ 115 · ≠ 2 · − 38 · + 36 · ✗ 9 → paridad 227/267 = 85,0 %, 15 filas retenidas por una decisión abierta. Las líneas siguientes son el estado histórico del 22/10.

Filas 312 · = 50 · ≈ 124 · ≠ 14 · − 76 · + 40 · ✗ 8 (verificación v2 del 22/10 tras el bucle, Next `038329f`; xhigh: filas 309 · = 51 · ≈ 110 · ≠ 16 · − 85 · + 39 · ✗ 8; refresco de la mañana: filas 302 · = 58 · ≈ 100 · ≠ 12 · − 85 · + 39 · ✗ 8; 21/10: filas 299 · = 45 · ≈ 96 · ≠ 18 · − 94 · + 38 · ✗ 8)

Alcance: inicio del técnico, pasaporte, cualificaciones y verificación, disponibilidad, wallet documental, logbook,
privacidad y medallas/avatar/identidad. En v1.8 se cubren el modo demo (`TechnicianHome`, `Professional2`,
`AvailabilityPlanner`, `Logbook2`, `Badges`, `ProfileIdentity`, `MedalStrip`) y el conectado (`ConnectedHome`,
`ConnectedCalendar`, `Account.jsx` Profile/Documents/Logbook/«Mi cuenta», `connectedModel.js`, `server/*.mjs`). En Next:
`~/pau/Crew_Flex`, rama `feat/v18-html-parity`, HEAD `5c2d1a2` más el árbol de trabajo sin confirmar, a 22/10/2026, solo
lectura, N-PRO-01…05 más `/app/settings` y `/app/admin/verifications` cuando aplica. Línea base del informe anterior:
`51c835a` (21/10/2026). Las columnas v1.8 no cambian: el zip de v1.8 se volvió a verificar (mismo sha256).

## Verificación v2 (22/10/2026, tras el bucle)

**Método.** Las 309 filas del xhigh y 3 nuevas, una a una, contra el SNAP2 (`wt-diff2`, `038329f`, `next start` en
`localhost:3004` con la BD local) y la v1.8 sin cambios (mismo zip). Las referencias `archivo:línea` y `es:N` se
recalcularon de `d3b876f` (base del xhigh) a `038329f` con un mapa de líneas por fichero y, en el catálogo, por clave
(`work/20/remap.py`: 214 referencias; las tablas históricas no se tocan). Las filas de los 16 ficheros que cambiaron desde
`d3b876f` se releyeron en el código; los demás ficheros citados no cambiaron (`git diff d3b876f 038329f` vacío). Next en
ejecución con alpha, echo, foxtrot, oscar, delta, hotel y admin.mro a 1440, 390 y 360 px, con todo lo que no es GET
abortado en el navegador: 0 escrituras; el fallo de red, el foco tras confirmar, la ventana pasada, la vista previa vacía y
el ciclo sobre un día asignado se provocaron sin guardar nada (`work/20/next-*.mjs`). La v1.8 demo (`:56390`) y la
conectada (`:3125`, con las sesiones guardadas de T1 y T2, sin logins nuevos ni escrituras) también en ejecución
(`work/20/v18*-pages.mjs`). Cada literal «…» de las filas se buscó en los volcados (`work/20/sweep.py`). Tests: 8 ficheros y
52 tests en verde (`calendar`, `rotation`, `professional/api`, `identity`, `applications/view`, `Notice`,
`opportunities/view` y `domain/applications`).

**Cobertura.**
- En código, en los dos lados: 312 de 312 filas.
- Next en ejecución: 116 filas (literal encontrado en la pantalla que le corresponde o comportamiento comprobado; se
  descartaron las coincidencias de literales comunes vistos en otra página).
  - TEC-01: 1-5, 8, 10, 12, 16, 19-20, 25-26, 32, 34-35, 37-39, 42, 44, 46-50, 53, 55-56, 59-62, 65, 67-68.
  - TEC-02: 1-4, 7, 9, 14, 17, 28-30, 33, 39, 44-45 y 50.
  - TEC-03: 2-6, 8-9, 12, 17 (solo el chip), 18, 22 y 24.
  - TEC-04: 2-4, 6-7, 10, 14, 20, 23-26, 28, 33, 35-39, 42-43, 55-56, 58 y 61-63.
  - TEC-05: 1-5, 7-9, 13-16, 18, 21 y 24. TEC-07: 1, 3-4, 6, 9 y 20. TEC-08: 16. TEC-09: 2 y 5-6.
- v1.8 demo en ejecución: 107 filas.
  - TEC-01: 1, 3-4, 8, 13, 16, 19, 22, 25-26, 29-30, 44, 46, 48-49, 51, 55-56, 60-61, 64 y 67.
  - TEC-02: 1-4, 7, 9, 11, 13-19 y 49. TEC-03: 12. TEC-04: 1, 3-5, 7, 9-10, 14, 20, 23, 35-37, 48 y 55.
  - TEC-05: 2-7, 14-15, 22-25, 27, 30-31 y 34. TEC-06: 1-11, 13 y 16. TEC-07: 1, 3-8, 11-15 y 21.
  - TEC-08: 2, 4, 9-10, 13 y 16. TEC-09: 1-3 y 5-6.
- v1.8 conectado en ejecución: 126 filas.
  - TEC-01: 1, 3-4, 9, 12-13, 16, 19, 22, 25-27, 29-33, 37-39, 44, 46-49, 51, 54-56, 60, 64 y 67.
  - TEC-02: 1-3, 9, 12, 14, 18, 20-23, 25-28, 30, 33, 37-38, 41, 43, 46-47 y 49. TEC-03: 4, 9, 12 y 20.
  - TEC-04: 1, 3-5, 7, 9-10, 14, 20, 23-24, 28, 35-37, 39, 42-43, 48-49 y 55.
  - TEC-05: 2-4, 6-7, 9, 14-15, 18, 22, 25, 27, 31 y 35. TEC-06: 1-4, 7-8 y 10-11.
  - TEC-07: 1-3, 7, 9, 11-13, 15-17 y 19-22. TEC-08: 2, 4 y 16. TEC-09: 1-3 y 5-6.
- No verificadas en ejecución, y por qué:
  - Lo que exige guardar (prohibido en el área 20), solo en código: los guardados con éxito y sus mensajes (TEC-02 filas
    11-12; TEC-03 filas 10 (el panel de edición no se abrió) y 14; TEC-04 filas 13, 30, 44, 48 y 50) y el foco de X-08 tras un borrado con éxito (se
    comprobó con la acción abortada: el foco va al aviso).
  - Wallet con documentos: ninguna cuenta local tiene y subir está prohibido (TEC-05 filas 12, 22-23, 27-31 y 37, solo
    código; el `ConfirmButton` de la fila 37 se comprobó con las ventanas).
  - Fallos que no se pueden provocar sin tocar la BD: error de carga de Mi espacio (TEC-01 fila 66, X-16) y fallo de un
    feed (TEC-01 fila 69).
  - «Revisor: {motivo}» (TEC-03 fila 17): la rechazada de oscar no tiene nota en la semilla.
  - PROD (TEC-01 fila 34, TEC-03 filas 15-16, TEC-05 fila 1): de `memory-bank/01-current-state.md` y del código; nada
    remoto.
  - Conectado: no se probaron guardados (409 del perfil y del calendario, C-TEC2-04 y C-TEC-18): la BD es compartida con
    otros revisores; se citan las capturas del 21/10.
  - Las filas sin literal ni comportamiento visible (fórmulas, RPC, migraciones, tipos) solo admiten verificación en código.

**Defectos nuevos de Next (v2).**
- TEC-01 fila 49 (P2): el mini calendario de Mi espacio no marca la asignación confirmada que Disponibilidad sí marca:
  `AvailabilityMonth` no recibe `assignmentDays` (`src/app/app/professional/page.tsx:275-280` frente a
  `src/app/app/professional/availability/page.tsx:34-44`). Runtime con delta: «2026-10-22: Available» en Mi espacio y
  «2026-10-22: Available, confirmed assignment» en Disponibilidad (`evidencias/v2/20/TEC-01-11-next-1440.aria.yml`,
  `TEC-04-10-next-1440.aria.yml`).
- TEC-04 fila 26 (P2): con «Reemplazar…», la vista previa del ciclo pisa un día con asignación confirmada y lo deja como
  «Blocked · working» (`src/features/availability/rotation.ts:105-106` no conoce las asignaciones;
  `evidencias/v2/20/TEC-04-11-next-1440.log.txt`). Es consecuencia del default técnico T-13; v1.8 salta esos días.
- TEC-01 fila 56 (P3, observación): el feed cuenta como compatibles necesidades en las que el técnico ya no puede
  presentarse (echo: rechazada y retirada en «E2E diff v2 · B», T-09). v1.8 hace lo mismo.

**Correcciones.**

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| Todas | Referencias `archivo:línea` y `es:N` | base `d3b876f` | `038329f` (214 referencias; `es:` por clave del catálogo) | `work/20/remap.py`, `work/20/remap-apply.log` |
| TEC-01 #38 | KPI «oportunidades compatibles» | − P1 (M07) | ≈ — (M07 hecho, `db05af1`) | `evidencias/v2/20/TEC-01-11-next-1440.txt`, `TEC-01-12-next-1440.txt`; `ProfessionalActivity.tsx:26,37-41` |
| TEC-01 #39 | KPI «asignaciones confirmadas» | − P2 (D-06) | ≈ — | `TEC-01-11-next-1440.txt` |
| TEC-01 #55, #56, #60 | Feeds «Oportunidades para ti» y «Mis candidaturas» | − P1 | ≈ P3 (3 filas; sin base, categoría, tarifa ni botón por fila) | `TEC-01-12-next-1440.txt`, `TEC-01-13-next-1440.txt`; `TEC-01-1-v18c-1440.txt` |
| TEC-01 #59, #61 | Textos de vacío | − P2 | ≈ P3 (sin la frase de ayuda ni el botón) | `TEC-01-1-next-1440.txt`; `TEC-01-1-v18-1440.txt` |
| TEC-01 #47, #48, #51, #54 | Bloqueo M07 | M07; P1 en 51 y 54 | desbloqueadas; 51 y 54 en P2 | `TEC-01-1-v18c-1440.jpg`, `TEC-01-4-v18c-1440.txt` |
| TEC-01 #49 | «Asignado» en el mini calendario | ≈ P2, D-06 | ≈ P2, portable; defecto de coherencia con Disponibilidad | `TEC-01-11-next-1440.aria.yml` |
| TEC-01 #50 | Leyenda | + | ≈ P3 (faltan «Asignado» y «● Oportunidades») | `TEC-01-1-v18-1440.txt` |
| TEC-01 #54 | Literal v1.8 | «Quitar selección de fecha» en los dos modos | solo en la demo; el conectado solo cambia el h2 | `ConnectedHome.jsx:15`; `TEC-01-4-v18c-1440.txt` |
| TEC-01 #58 | Bloqueo | C-9/D-08 | D-06 Q6 ↔ SCOPE-2 (Q6 ratificada: una candidatura = un periodo) | `08-product-decisions.md` §2026-10-22 |
| TEC-01 #65 | Tarjeta a 390 px | ≈ P3 | ≈ — (X-17) | `TEC-01-10-next-390.jpg`, `TEC-01-10-next-360.jpg` |
| TEC-01 #66 | Error de carga | ≠ P3 | ≈ — (X-16) | `src/features/professional/api.ts:48-53`; `api.test.ts` |
| TEC-01 #9, #22, #24, #26-27, #29-35 | Bloqueo R-D5, C-10, OD-3 (medallas) | decisiones abiertas | default v1.8 (#34: OD-3 solo en PROD) | `V2_BRIEF.md`; `08-product-decisions.md` §SCOPE-2 |
| TEC-01 #68, #69 (nuevas v2) | KPIs de actividad y fallo por feed | — | + | `ProfessionalActivity.tsx:29-48,59-62,91-94` |
| TEC-02 #5, #16-18, #20-23, #25-27, #31-33, #37-38, #40-41, #47 | Bloqueo C-10/D-02/D-03, OD-6/D-04, OD-7, D-07, D-10, SCOPE | bloqueadas | default v1.8 o alcance LATER | `V1_SCOPE.md:56-64`; runtime conectado `TEC-02-1-v18c-1440.txt`, `TEC-02-2-v18c-1440.aria.yml` |
| TEC-02 #50 (nueva v2) | Fallo de red al guardar el pasaporte | — | ≈ (X-02) | `TEC-02-2-next-1440.jpg` |
| TEC-03 #9 | Foco tras «Sí, quitarla» | ≈ P3 | ≈ — (X-08) | `TEC-04-9-next-1440.txt` |
| TEC-03 #2, #20, #21 | Bloqueo C-10/D-02/D-03 | bloqueadas | default v1.8 | — |
| TEC-03 #23 | Evidencia exigida al confirmar | − P2 | ≈ P3 (la confirmación re-comprueba lo verificado) | `20261022130300_applications.sql:679-682,829-861` |
| TEC-04 #26 | Días que se saltan al generar | ≈ | ≠ P2 (pisa días asignados, T-13) | `TEC-04-11-next-1440.log.txt` |
| TEC-04 #33 | Título del mes | = | ≈ P3 (mayúscula, X-18) | `TEC-04-1-next-1440.txt`; `TEC-04-1-v18c-1440.txt` |
| TEC-04 #39 | «Asignado» | ≈ P2, D-06 | ≈ P3, marca hecha | `TEC-04-10-next-1440.txt` |
| TEC-04 #43 | Días asignados | − P2, D-06 | ≠ P2, T-13 (marcados, no protegidos) | `TEC-04-10-next-1440.aria.yml`; `TEC-04-1-v18c-1440.aria.yml` |
| TEC-04 #42 | Ventanas en el pasado | ≈ P3 | ≈ — (X-19, solo formulario) | `TEC-04-9-next-1440.txt` |
| TEC-04 #58 | Foco tras «Sí, eliminarla» | ≈ P3 | ≈ — (X-08) | `TEC-04-9-next-1440.txt` |
| TEC-04 #62 | Vista previa sin días | ≠ P3 | ≈ — (X-15) | `TEC-04-9-next-1440.txt` |
| TEC-04 #63 | Fallo de red al guardar | ≠ P2 | ≈ — (X-02) | `TEC-04-8-next-1440.jpg` |
| TEC-04 #52 | Bloqueo | D-06 | T-13 | — |
| TEC-05 #6, #28 | Bloqueo AB-34 / AB-28 | aplazadas por el owner | desbloqueadas por SCOPE-2 (wallet propio) | — |
| TEC-05 #30, #35 | Bloqueo | retención release 2; SCOPE | default v1.8; SCOPE-2 | — |
| TEC-05 #37 | Foco en el borrado del wallet | ≠ P3 | ≈ — (X-08, `ConfirmButton`) | `DocumentWallet.tsx:406-413` |
| TEC-06 #1-14 | Bloqueo | SCOPE (M14) | desbloqueadas, alcance LATER | `V1_SCOPE.md:63`; `TEC-06-1-v18c-1440.txt` |
| TEC-07 #5, #11-17, #19, #21-22 | Bloqueo | OD-5, D-07, SCOPE, retención | default v1.8, alcance LATER o SCOPE-2 | `TEC-07-2-v18c-1440.txt`; `TEC-07-1-v18c-1440.txt` |
| TEC-08 #1-4, #6-10, #12-13 | Bloqueo | OD-3, D-07/D-10, SCOPE | default v1.8 (foto solo en el navegador) o LATER | `TEC-01-1-v18c-1440.txt` |
| TEC-09, tabla | Cobertura de textos | 288 cadenas, 17 % (otro método) | 262 cadenas, 18 % (xhigh con el mismo método: 15 %) | `textos/string-coverage-v2.md` |
| TEC-09 #1, #2, #5 | Literales | — | cadenas de M07/M08; mes con mayúscula (X-18) | `textos/string-coverage-v2.md` |
| Evidencias | Nombres | — | `evidencias/v2/20/` con el patrón `<SECCION>-<n>-{next,v18,v18c}-<ancho>` | — |
| Backlog | Estado y tareas | 9 HECHO · 2 BLOQUEADO · 6 PENDIENTE | 15 HECHO + 2 de M07/M08 · B-06/B-07 desbloqueadas · 26 tareas N-01…N-26 · 6 bloques | — |
| Recuento | Símbolos y severidades | 309 · = 51 · ≈ 110 · ≠ 16 · − 85 · + 39 · ✗ 8; P0 1 · P1 16 · P2 37 · P3 85 | 312 · = 50 · ≈ 124 · ≠ 14 · − 76 · + 40 · ✗ 8; P0 1 · P1 10 · P2 34 · P3 87 | `work/20/count.py` |

Además, 89 filas cambian de Bloqueo sin cambiar de símbolo ni de severidad, y a 37 filas que conservan símbolo y
severidad se les añadió evidencia o texto v2 (Next, demo o conectado en ejecución). La tabla «Verificación exhaustiva (xhigh)» y la de «Cambios desde el 21/10/2026» se
conservan como historia; donde choquen con esta, manda esta.

## Verificación exhaustiva (xhigh, 22/10/2026)

**Método.** Las 302 filas de la mañana y 7 nuevas, una a una y en los dos lados. v1.8: código vivo de
`CrewFlex-v1.8/src` (`features/*`, `components/v11/{Professional2,Logbook2}.jsx`, `beta/*`, `context/AppState.jsx`,
`data/*`) y `server/*.mjs`; el modo demo, en ejecución (`127.0.0.1:56390`, estado desechable). Next: la copia congelada
de las 11:16 (`snapshot-1116`, idéntica al árbol vivo en todos los ficheros del alcance), y en ejecución con alpha a 1440
y 390 px, con todo POST/PATCH/DELETE abortado en el navegador (`work/20/next-*.mjs`). El foco de las confirmaciones se
reprodujo con una copia de los componentes en React 19 aislado (`work/20/harness/`). La validación compartida se probó
con un script puro (`work/20/schema-check.mjs`). Tests ejecutados: `calendar.test.ts`, `identity.test.ts` y
`rotation.test.ts`, 24 de 24 en verde.

**Cobertura.**
- En código, en los dos lados: 309 de 309 filas. El lado «conectado» de v1.8 solo en código: su servidor no está levantado.
- Next en ejecución: 131 filas.
  - TEC-01: 1-8, 10-17, 19, 21, 34, 36, 37, 40, 41, 43-50, 53, 62-65 y 67.
  - TEC-02: 1-4, 7, 9, 10, 14, 17, 30, 39, 44, 45 y 49.
  - TEC-03: 2-4, 6, 8, 9, 12, 22 y 24-26.
  - TEC-04: 1, 3-10, 12, 14, 16-24, 28, 29, 31, 33-39, 42, 44, 46, 47, 49, 55-58 y 61-63.
  - TEC-05: 1-6, 8, 9, 13-16, 20, 21 y 24.
  - TEC-06: 1. TEC-07: 1-4, 6, 7 y 10. TEC-08: 14-16. TEC-09: 5.
  - La fila 2 de TEC-01 se comprobó con `admin.mro` (en inglés).
- v1.8 demo en ejecución: 121 filas.
  - TEC-01: 1, 3-19, 37-39, 44, 46-51, 53-56, 60-62, 65 y 67.
  - TEC-02: 1-7, 9, 14-19 y 49 (solo el paso 1 del asistente).
  - TEC-04: 3-5, 7-10, 12, 14, 16-18, 20-23, 28, 29, 33, 35-39, 42, 61, 62 y 64.
  - TEC-05: 2-6, 8, 20, 22, 23, 27, 28, 30 y 32.
  - TEC-06: 2-6, 8, 9, 11, 13, 15 y 16. TEC-07: 1-6, 11-15 y 18. TEC-08: 3, 4, 9, 14 y 16.
- No verificadas en ejecución, y por qué:
  - Todo lo que exige guardar (prohibido), comprobado solo en código: TEC-02 filas 11 y 12 (409); TEC-03 filas 10, 14
    y 17 (alpha no tiene rechazadas); TEC-04 filas 13, 30, 44 (el guardado de un clic), 48 y 50 (409); TEC-05 filas 12,
    18, 22, 27, 29 y 31 (alpha no tiene documentos y subir está prohibido).
  - El foco tras «Sí, quitarla» / «Sí, eliminarla» y la confirmación del wallet: confirmar borraría datos. En la app solo
    se abrió y canceló la confirmación; lo demás se reprodujo en el arnés (TEC-03 fila 9, TEC-04 fila 58, TEC-05 fila 37).
  - TEC-01 filas 20 (100 %) y 42 (Próximos pasos): alpha está al 86 % y no tiene cualificaciones pendientes ni rechazadas.
  - TEC-01 fila 66: un error de carga no se puede provocar sin tocar la BD.
  - Estado de PROD (TEC-01 fila 34, TEC-03 filas 15-16, TEC-05 fila 1): de `memory-bank/01-current-state.md` y del
    código; nada remoto.
  - TEC-03 fila 15 (`/app/admin/verifications`): pertenece al área de administración.
  - El modo conectado de v1.8 entero: su servidor no está levantado. No se reabrieron las capturas del 21/10.

**Puntos pedidos.**
- **TEC-01 frente a «Mi espacio»** (1440 y 390): confirmado, elemento a elemento, en las filas 1-19, 44-50, 62, 64 y
  65-67. Coinciden la cabecera y el h1, que a 390 px se pega en v1.8 («Tu tiempo.Tu…») también en la demo. También
  coinciden la tarjeta, la frase y la barra, la nota y la checklist. Cambian el orden y la ubicación de los bloques, la
  tarjeta a 390 px y el calendario de solo lectura.
- **Calendario**:
  - días pasados: 21 de 31 `disabled` en los dos lados, y en Next un clic forzado no hace nada;
  - generador de ciclos: probado con vista previa, deshacer, descartar, «Reemplazar» y el ciclo personalizado, sin
    guardar nada;
  - leyenda y estados: comprobados en las filas 35, 39 y 46, y en TEC-01 filas 49 y 50;
  - defecto nuevo: la vista previa no avisa cuando no genera ningún día (fila 62).
- **Ventanas en el pasado**: confirmado en las cinco capas, más «Editar» (TEC-04 fila 42). En ejecución, la validación
  del cliente las acepta y el formulario llama a la acción; la llamada se abortó y no se guardó nada. Matiz nuevo: el
  editor de intervalos del conectado de v1.8 también las acepta. Por eso sigue en P3 y opcional (B-12).
- **Foco a `<body>`**: confirmado, con el mecanismo exacto. React reutiliza el nodo del botón de confirmar y
  `disabled={pending}` lo desenfoca; pasa con éxito y con error. «Cancelar» sí devuelve el foco (comprobado en la app).
  P3 (B-13). El wallet tiene el mismo problema, peor: también al abrir y al cancelar (TEC-05 fila 37).
- **Tope del 86 %**: en local, las 5 verificadas de alpha vienen de la semilla, que escribe `verified` directamente, no
  de la revisión. Su 86 % local se debe a la visibilidad «Privado». En PROD el 86 % es un tope estructural: sin revisión
  no se puede cumplir «Al menos una cualificación verificada» (TEC-01 fila 34).
- **Wallet**: comparado en ejecución con el flag activo en local. Next no tiene pestañas, filtro, papelera ni vista
  previa; los cuatro están en la demo (capturas TEC-05-2…4). AB-34 y AB-28 siguen bloqueados.

**Correcciones.**

| Fila | Qué se corrigió | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| Cabecera, «Método» | Líneas de `V1_SCOPE.md` | `:46,57,59,60` | `:47,58,60,61` (la copia tiene una fila más, D-13) | `snapshot-1116/docs/product/V1_SCOPE.md:47,58,60,61` |
| TEC-01 #1 | Referencias y entrada de alpha | `views.ts:30-38`, `AppShell.tsx:95-100` | `views.ts:39-48`, `AppShell.tsx:103-108`; alpha entra en `/app/organization` | `evidencias/xhigh/20/TEC-01-1-next-1440.jpg` |
| TEC-01 #4 | Literal v1.8 | sin espacio a 390 px solo en el conectado | también en la demo | `evidencias/xhigh/20/TEC-01-1-v18-390.txt` |
| TEC-01 #10 | Diff | = | ≈ (falta el icono, mismo criterio que la fila 5) | `TechnicianHome.jsx:15`; `IdentityCard.tsx:37` |
| TEC-01 #34 | Explicación local / PROD | tope del 86 % sin matiz | semilla `verified` en local; el 86 % de alpha es por la visibilidad | `supabase/seed.sql:28-47,97`; `TEC-01-1-next-1440.jpg` |
| TEC-01 #37 | Literal Next | — | alpha en local, 86 % | `TEC-01-1-next-1440.jpg` |
| TEC-01 #46 | Literal Next | — | mayúsculas por CSS | `AvailabilityMonth.tsx:57` |
| TEC-01 #47 | Literal v1.8 | pasado deshabilitado en los dos modos | solo en la demo (21 de 31) | `ConnectedHome.jsx:15`; `TEC-01-1-v18-1440.jpg` |
| TEC-01 #49 | Referencia v1.8 | `ConnectedHome.jsx:15` | `ConnectedHome.jsx:7` | código |
| TEC-02 #12 | Diff | = | ≈ (otro texto; Next conserva el formulario) | `server/app.mjs:64`; es:528 |
| TEC-02 #14 | Diff | = | ≈ (errores con otra redacción; 120 frente a 160) | `TEC-04-5-next-interact-1440.txt` |
| TEC-02 #30 | Diff | = | ≈ (errores `v.years.*` con otra redacción) | es:314-318; `business.js:96` |
| TEC-02 #37 | Bloqueo | `V1_SCOPE:60` | `V1_SCOPE:61` | V1_SCOPE |
| TEC-02 #38 | Bloqueo | `V1_SCOPE:57` | `V1_SCOPE:58` | V1_SCOPE |
| TEC-03 #9 | Sev. y mecanismo del foco | — («opcional») | P3; foco a `<body>` con éxito y con error | `TEC-03-3-confirmfocus-harness.txt`; `TEC-04-5-next-interact-1440.txt` |
| TEC-04 #37 | Literal Next | — | mayúsculas por CSS | `AvailabilityManager.tsx:353` |
| TEC-04 #42 | Literal, en los dos lados | «formulario y RPC aceptan» | cinco capas y «Editar»; el conectado también acepta intervalos pasados; runtime | `TEC-04-5-next-interact-1440.txt`; `Account.jsx:62`; `rules.mjs:10` |
| TEC-04 #46 | Diff | = | ≈ (sin «antes de publicarlos») | `TEC-04-2-next-1440.jpg` |
| TEC-04 #57 | Literal | — | acepta fechas pasadas; error en runtime | `TEC-04-5-next-interact-1440.txt` |
| TEC-04 #58 | Sev. | — | P3 (foco tras «Sí, eliminarla») | `TEC-03-3-confirmfocus-harness.txt` |
| TEC-04, estado global | Texto | — | añade las filas 62-63 | — |
| TEC-05 #15 | Diff | = | ≈ («Caducidad (opcional)» frente a «(si aplica)») | es:1143 |
| TEC-05 #24 | Diff | = | ≈ (otra ubicación y otro contenido; coherente con TEC-01 #43) | `TEC-01-1-next-1440.jpg` |
| TEC-06, cabecera | Referencia | `V1_SCOPE.md:59` | `:60` | V1_SCOPE |
| TEC-07 #12 | Bloqueo | `V1_SCOPE:57` | `:58` | V1_SCOPE |
| TEC-07 #13 | Bloqueo | `V1_SCOPE:46/57` | `:47/58` | V1_SCOPE |
| TEC-08 #10 | Bloqueo | `V1_SCOPE:59` | `:60` | V1_SCOPE |
| TEC-08 #14 | Referencia | `AppShell.tsx:69-75` | `AppShell.tsx:78-83` | código |
| TEC-08 #16 | Referencia | `AppShell.tsx:110-125` | `AppShell.tsx:111-126` | `TEC-01-1-next-1440.txt` |
| TEC-09 #2 | Literal | solo «Empresas» casual | 3 cercanas casuales más; reales, 5 de 9 | `work/string-diff.json` (recuento rehecho) |
| TEC-01 #65 (nueva) | Tarjeta de identidad a 390 px | — | ≈ P3 | `TEC-01-1-next-390.jpg`; `TEC-01-1-v18-390.jpg` |
| TEC-01 #66 (nueva) | Error de carga mostrado como «cuenta de organización» | — | ≠ P3 | `src/features/professional/api.ts:44`; `page.tsx:54-56` |
| TEC-01 #67 (nueva) | Orden de los bloques | — | ≈ P3 | `TEC-01-1-next-1440.jpg`; `TEC-01-1-v18-1440.jpg` |
| TEC-04 #62 (nueva) | La vista previa sin días no avisa | — | ≠ P3 | `TEC-04-5-next-interact-1440.txt` |
| TEC-04 #63 (nueva) | Un fallo de red tira la página y el borrador | — | ≠ P2 | `TEC-04-4-next-1440.jpg` |
| TEC-04 #64 (nueva) | Nota de la demo bajo la vista previa | — | ≈ | `TEC-04-3-v18-1440.jpg` |
| TEC-05 #37 (nueva) | Foco en la confirmación de borrado del wallet | — | ≠ P3 | `TEC-05-5-walletfocus-harness.txt` |
| Backlog | Estado y tareas nuevas | 0 PENDIENTE | B-12…B-17 PENDIENTE; nota en B-05 | — |
| Recuento | Símbolos y severidades | 302 · = 58 · ≈ 100 · ≠ 12; P2 36 · P3 78 | 309 · = 51 · ≈ 110 · ≠ 16; P2 37 · P3 85 | `work/20/count.py` |

También se añadió, sin cambiar el veredicto, la evidencia de ejecución a TEC-01 #62, TEC-02 #14, TEC-04 #61 y TEC-05 #6,
#28 y #30. Las demás filas se confirmaron tal como estaban. Las capturas y volcados xhigh están en
`evidencias/xhigh/20/` (`<SECCION>-<n>-{next,v18}-{1440,390}.{jpg,txt,aria.yml}`). La tabla «Cambios desde el 21/10/2026»
se conserva; donde choque con la de arriba, manda la de arriba.

## Cambios desde el 21/10/2026

Next actual = `5c2d1a2` (rama `feat/v18-html-parity`) más el árbol de trabajo del 22/10; línea base `51c835a`. Cada
afirmación se ha comprobado en el código, no en el «VERIFIED» de `docs/integration/crewflex-v13/16-html-v18-diff.md`.

| Fila | Elemento | Antes | Ahora | Origen (commit o «árbol de trabajo») |
|---|---|---|---|---|
| TEC-01 #1 | Entrada | ≈ P3 | ≈ P3; nota: «Ver como» → «Técnico» para admins de plataforma con cuenta profesional | árbol de trabajo (D-13) |
| TEC-01 #3 | Kicker | ≠ P3 («Espacio profesional») | = («Mi espacio») | `1764e8e` (W2-01) |
| TEC-01 #4 | h1 | ≠ P3 (nombre del usuario) | = (h1 literal de v1.8, sin el fallo de espacio) | `1764e8e` (W2-01) |
| TEC-01 #5 | Botón «Herramientas» | − P3 | ≈ (botón en la cabecera, sin icono) | `1764e8e` (W2-01) |
| TEC-01 #6 | Avatar en la tarjeta | − P2 | ≈ P3 (iniciales; foto bloqueada por D-07/D-10) | `1764e8e` (W2-01) |
| TEC-01 #7 | Nombre en la tarjeta | ≈ P3 | = | `1764e8e` (W2-01) |
| TEC-01 #8 | Línea «base · años» | ≈ P3 | = (con plural ICU) | `1764e8e` (W2-01) |
| TEC-01 #63 (nueva) | Nombre accesible de la tarjeta | — | + | `1764e8e` (W2-01) |
| TEC-01 #10 | «Editar perfil» | ≈ P3 | = | `1764e8e` (W2-01) |
| TEC-01 #12 | Frase del porcentaje | ≈ P3 | = | `c6d380b` (W2-02) |
| TEC-01 #13 | Apartados pendientes | ≠ P3 | = (plural ICU) | `c6d380b` (W2-02) |
| TEC-01 #14 | Barra `<progress>` | − P3 | = | `c6d380b` (W2-02) |
| TEC-01 #64 (nueva) | Ubicación del bloque de progreso | — | ≈ P3 (en el panel, no en la tarjeta) | `c6d380b` (W2-02) |
| TEC-01 #15 | Umbral de la barra | ≈ | ≈ (referencias al bloque nuevo) | `c6d380b` (W2-02) |
| TEC-01 #16 | Nota del porcentaje | ≈ P3 (solo al 100 %) | ≈ — (literal de la demo, siempre visible) | `c6d380b` (W2-02) |
| TEC-01 #18 | Texto de introducción | − P3 | ≈ (lo cubre la nota de #16) | `c188801` (W2-09) |
| TEC-01 #19 | Fila de apartado | ≈ P3 («Ir») | = («Completar») | `c188801` (W2-09) |
| TEC-01 #41 | KPI «Cualificaciones» | + P3 (contaba retiradas) | + — (solo activas) | `1764e8e` (W2-01) |
| TEC-01 #44 | Calendario: kicker y título | ≈ P3 («Mi disponibilidad este mes») | ≈ — («Tu disponibilidad») | `c188801` (W2-09) |
| TEC-02 #17 | Base habitual | ≈ P3 (placeholder literal en el TSX) | ≈ P3 (placeholder del catálogo; queda texto libre frente a `select`) | `135085c` (W1-04) |
| TEC-02 #28 | «Abrir documentos» y pista | − P3 | ≈ P3 (enlace por cualificación, solo con el flag del wallet) | `0945b8f` (W2-11) |
| TEC-03 #9 | Quitar | ≠ P2 (sin confirmación) | ≈ — (confirmación en dos pasos) | `73de8ff` (W1-10) |
| TEC-03 #22 | Documento vinculado | ≈ P2 | ≈ P3 («Evidencia: …» en cada fila, con flag) | `0945b8f` (W2-11) |
| TEC-03 #26 | Errores | ≈ P3 («Invalid qualification.») | ≈ — («Cualificación no válida.») | `135085c` (W1-04) |
| TEC-04 #4 | h1 | ≠ P3 | = («Tu tiempo, a tu manera.») | `c188801` (W2-09) |
| TEC-04 #21 | Ciclo libre: ayuda | − P3 | = | `c188801` (W2-09) |
| TEC-04 #23 | Publicar descansos | ≈ P3 (sin pista) | ≈ — (pista adaptada) | `c188801` (W2-09) |
| TEC-04 #41 | Estilo | = (acción: corregir doc 10) | = (doc 10 ya corregido) | `f433b20` (W4-02) |
| TEC-04 #42 | Días pasados | ≠ P2 (editables sin borrador) | ≈ P3 (bloqueados en el calendario; una ventana suelta aún acepta fechas pasadas) | `bfbe531` (W1-03) |
| TEC-04 #44 | Clic sin borrador | ≈ | ≈ (solo de hoy en adelante) | `bfbe531` (W1-03) |
| TEC-04 #50 | Conflicto de versión | − P2 | ≈ — (409 en «Guardar calendario»; solo local, despliegue del owner) | `43a3bbb` (W5-03) |
| TEC-04 #57 | Intervalos: validación | + P3 (`v.window.status` sin AOG) | + — | `c188801` (W2-09) |
| TEC-04 #58 | Intervalos: lista | ≈ P3 (borrado sin confirmación) | ≈ — (confirmación en dos pasos) | `73de8ff` (W1-10) |
| TEC-05 #6 | Pestañas por bloque | − P3, bloqueo «—» | − P3, bloqueo AB-34 (aplazado por el owner) | `cdbd702` (W2-10 BLOCKED) |
| TEC-05 #28 | Vista previa en la app | − P3, bloqueo «—» | − P3, bloqueo AB-28 / D-10 (CSP) | `cdbd702` (W2-12 BLOCKED) |
| TEC-07 #10 | Accesibilidad (visibilidad) | ≈ P3 (sin flechas) | + (radiogroup con flechas y una parada de Tab) | `e37e95c` (W3-05) |
| TEC-08 (estado global) | Medallas, avatar e identidad | AUSENTE EN NEXT | PARCIAL (avatar de iniciales) | `1764e8e` (W2-01) |
| TEC-08 #14 | Iniciales | − P3 | ≈ | `1764e8e` (W2-01) |
| TEC-08 #15 | `aria-label` del avatar | − P3 | ≈ (avatar decorativo, tarjeta con nombre accesible) | `1764e8e` (W2-01) |
| TEC-08 #16 | Identidad en el menú | ≈ P3 | ≈ P3 (añade tipo de cuenta y rol bajo el nombre) | `d12164a` (W2-06) |
| TEC-09 (cobertura) | Tabla de cobertura | 43 de 288 (15 %) | 50 de 288 (17 %) | `1764e8e`, `c6d380b`, `c188801` |
| TEC-09 #1 | Cadenas que coinciden | = | = (7 cadenas más) | `1764e8e`, `c6d380b`, `c188801` |
| TEC-09 #2 | Cadenas cercanas | ≈ | ≈ (+ «Tu pasaporte está al {score}%»; «Empresas» ≈ «Empresa» es casual) | `c6d380b`; árbol de trabajo |
| TEC-09 #3 | Plurales | + | + (2 claves más) | `1764e8e`, `c6d380b` |
| TEC-09 #4 | Errores sin traducir | + P3 | = (ninguno) | `135085c` (W1-04) |
| TEC-09 #6 (nueva) | Iguales en pantalla que el script no detecta | — | = | `1764e8e`, `c6d380b` |

Recuento: 302 filas (299 + 3 nuevas); 22 cambian de símbolo y 3 son nuevas. = 45 → 58 · ≈ 96 → 100 · ≠ 18 → 12 ·
− 94 → 85 · + 38 → 39 · ✗ 8 → 8. El resto de filas solo cambia de referencias `archivo:línea` / `es:N`.

---

**Método.**
- Inventarios leídos: `parts/D2-tech-demo.md` §3-§4, `parts/C-connected-admin.md` §3.5-3.7, §3.12 y §4.1-4.5,
  `parts/B-server-data.md` §4.1, §4.3-4.6 y §5.5-5.7, `v18-runtime-demo.md` §2.T y §2.M, `next-static.md` §0, §3 (N-PRO-*),
  §4 y §5. `v18-runtime-connected.md` §1-§2 «Técnico» se leyó al final (versión de las 14:16).
- Comprobado en el código de Next, por lectura:
  - `src/app/app/professional/**`;
  - `src/features/{professional,qualifications,availability,documents}/**`;
  - `src/domain/{professional,qualification,availability,documents}.ts`;
  - `src/lib/validation/{professional,availability}.ts`, `src/components/layout/AppShell.tsx` y `messages/es.json`;
  - las migraciones `20261009120100`, `20261019130000` y `20261019140000`.
  - Refresco del 22/10: todo fichero de Next citado que cambió desde `51c835a` (39 commits y el árbol de trabajo), más
    `src/features/professional/{identity.ts,components/IdentityCard.tsx}`, `src/features/qualifications/components/EvidenceLine.tsx`,
    `src/components/ui/{ConfirmButton.tsx,radio-group.ts,Notice.tsx,PageHeader.tsx}`,
    `src/components/layout/{AppShell.tsx,views.ts,ViewSwitcher.tsx,account-summary.ts}`, la migración `20261021120000` y
    `supabase/functions/professional-availability/index.ts`. Las referencias `archivo:línea` y `es:N` de las filas sin
    cambios se recalcularon contra el árbol actual.
- Código v1.8 citado por `fichero:línea` (relativo a `v18-pkg/`). Los componentes están minificados: una línea agrupa
  varios elementos.
- Los textos se cruzaron con `textos/string-diff.json`, filtrado por los ficheros del alcance; en el refresco, con el
  `string-diff.json` regenerado el 22/10 sobre el `messages/es.json` actual (ver TEC-09).
- Decisiones aplicadas:
  - `memory-bank/07-decisions-index.md`: OD-3, OD-5, OD-6/D-04, OD-7, C-7, C-8/D-05, C-9/D-08, C-10/D-02/D-03, D-06, D-07,
    D-10, D-12, R-D5, T-04;
  - `docs/product/V1_SCOPE.md:47,58,60,61` (NEXT: AOG opt-in; LATER: outreach, logbook, tarifas; líneas de la copia de las 11:16, una más que en `5c2d1a2` por la fila D-13);
  - `docs/product/BUSINESS_RULES.md` BR-2, BR-4, BR-8, BR-11 y BR-12;
  - filas M02, M03, M04, M10 y M14 de `docs/integration/crewflex-v13/10-master-matrix.md` (TD-*, CX-*) y V18-* de
    `09-v18-delta.md`.
- Estado de PROD que cambia el efecto real (next-static §0):
  - el wallet está tras un flag de BD que falla cerrado, y la tabla y la función no están desplegadas;
  - la revisión de cualificaciones (OD-3) está apagada en tres capas;
  - `qualification-reviews` no está desplegada.

**Convenciones.**
- Capturas v1.8: relativas a la carpeta del informe del 21/10 (`evidencias/shots/…`). El 21/10 esta línea decía «relativas a ``», sin ruta.
- Capturas Next: `docs/audit/evidence/v18-compare/next-after/*` son del **lote 11** (`14bd7c4`), anteriores a los lotes
  13-19. Las `docs/audit/evidence/local-*` llevan su commit al lado.
- Mensajes de Next: `es:N` = `messages/es.json:N` de `038329f` (SNAP2; v2). Las tablas históricas de arriba conservan las líneas del árbol del 22/10 por la mañana.
- Las capturas de Next citadas son anteriores a los cambios del 21-22/10: no muestran la cabecera, la tarjeta de
  identidad ni la barra de progreso nuevas. No se hicieron capturas nuevas en el refresco de la mañana; la verificación
  xhigh sí las añade en `evidencias/xhigh/20/` (Next con alpha y la demo de v1.8, a 1440 y 390 px).
- En la columna Diff, «X (antes Y)» marca una fila cuyo veredicto cambió desde el 21/10.

---

## TEC-01 · Inicio técnico — v1.8 `S-TEC-01, S-TEC-01a, S-MOD-TEC-01, D-TEC-01, S-CON-01a, S-MOD-CON-01, C-TEC-01/11/19/28/32/45/46` ↔ Next `N-PRO-01`

**Estado global:** IGUAL salvo matices (F3: antes PARCIAL). P01 (merge `4d78d6d`, matriz §P01 de `17-parity-matrix-v18.md`,
28 VERIFIED_LOCAL · 5 IMPLEMENTED_UNVERIFIED · 1 NEEDS_DECISION) dejó la composición de la demo: hero teal con avatar
(foto en el navegador o iniciales), medallas, «Editar perfil», «Estado de mi perfil ↗» (modal), progreso dentro de la
tarjeta y las dos cifras, junto al calendario (kicker, mes como h2, días `aria-pressed` que filtran el feed, punto rojo,
«Asignado», leyenda de v1.8, «Actualizar disponibilidad»); debajo, «Oportunidades para ti» (5 filas, marca, «Ver
oferta» / «Revisar fechas», tarifa si existe) y «Mis candidaturas» (CheckCircle, «{n} jornadas», «Ver seguimiento»); los
paneles propios de Next plegados al final (T-161). La completitud usa los 10 apartados del conectado (T-36). Filas
re-verificadas en F3 (2026-10-26) contra el código y en ejecución con delta (`PKG P02 6`, inspección a 1440 y 390).

Queda:
- los turnos recomendados del conectado (fila 58; D-06 Q6: una candidatura = un periodo);
- la marca de la fila y la tarifa de una oportunidad, y «{n} jornadas» con turnos publicados, sin datos de prueba en la
  semilla (filas 56, 57; P01-22/23/26 IMPLEMENTED_UNVERIFIED — los paquetes P04/P05 los traen);
- «Documento aportado» en PROD depende del wallet (fila 33, D-10).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | Demo: «Mi espacio» `#home` y dock «Inicio» (`src/LegacyApp.jsx:24,69`). Conectado: «Mi espacio» `#home` y dock «Inicio» | «Mi espacio» → `/app/professional` (`src/components/layout/AppShell.tsx:29`, es:65). Sin dock. Un admin de plataforma con cuenta profesional entra también por «Ver como» → «Técnico», sobre su propia cuenta, como el «Probar como» de la demo (`src/components/layout/views.ts:8-13,39-48`; `AppShell.tsx:109-114`; es:74-76; árbol de trabajo, D-13); su entrada por defecto es `/app/admin` (`src/app/app/page.tsx:7`). Un profesional con membresía (alpha) entra en `/app/organization` (`page.tsx:8`) y ve la sección de su organización encima de «Profesional» (comprobado: `evidencias/xhigh/20/TEC-01-1-next-1440.jpg`). v2: el menú del técnico añade «Oportunidades» y «Mis candidaturas» tras «Disponibilidad», en el orden de v1.8 (`AppShell.tsx:33-35`; runtime `evidencias/v2/20/TEC-01-1-next-1440.txt`). | ≈ | P3 | — (v2: el dock va en SH-05, área 10; C-12 es la marca, no el dock) | Mantener. El dock va en el diff del shell |
| 2 | Cuenta sin perfil técnico | Conectado: tarjeta con «Tu perfil profesional» / «Base por completar» (`src/beta/connectedModel.js:3`) | «Sin perfil profesional» / «Esta cuenta es una cuenta de organización.» (`src/app/app/professional/page.tsx:55-57`, es:488-489). Runtime v2 con `admin.mro` (en): «No professional profile» / «This account is an organization account.» (`evidencias/v2/20/TEC-01-4-next-1440.txt`). | + | — | — | Mantener |
| 3 | Kicker | Demo «MI ESPACIO» (`src/features/TechnicianHome.jsx:15`). Conectado «TU CUENTA CONECTADA» (`src/beta/ConnectedHome.jsx:15`) | «Mi espacio», en mayúsculas por CSS como en la demo (`page.tsx:113`, es:491; `src/components/ui/PageHeader.tsx:17-18`) | = (antes ≠) | — | — | Mantener (W2-01) |
| 4 | h1 | «Tu perfil. Tu tiempo.» + salto + «Tu próxima oportunidad.» en ambos modos. A 390 px se pinta sin espacio en los dos modos: «…Tu tiempo.Tu próxima…» (conectado: `v18-runtime-connected.md` C-TEC-01; demo: `evidencias/xhigh/20/TEC-01-1-v18-390.txt`) | «Tu perfil. Tu tiempo.» + `<br>` + «Tu próxima oportunidad.» (`page.tsx:114`, es:492). El espacio antes del `<br>` evita el «tiempo.Tu» de v1.8; el nombre pasa a la tarjeta (fila 7) | = (antes ≠) | — | — | Mantener (W2-01) |
| 5 | Botón «Herramientas» | Icono Wrench → `#tools` (`TechnicianHome.jsx:15`; `ConnectedHome.jsx:15`) | «Herramientas» → `/app/tools`, botón secundario en las acciones de la cabecera, sin icono (`page.tsx:115`, es:72) | ≈ (antes −) | — | — | Mantener (W2-01). Next no pone iconos en los botones |
| 6 | Avatar en la tarjeta | Grande. Foto de `localStorage`, iniciales de las dos primeras palabras o icono UserRound (`src/features/ProfileIdentity.jsx:6-12`). Runtime: demo «MB», conectado sin perfil «TP» | `ProfileAvatar` de 104 px (80 px bajo `sm`) en el hero teal: foto guardada en este navegador (T-144) o iniciales sobre el degradado `bg-avatar`; `aria-hidden` porque el nombre va al lado (`src/features/professional/components/ProfileAvatar.tsx`, `ProfessionalHero.tsx`) | = (F3: antes ≈) | — | — | Hecho (P01-04, `17-parity-matrix-v18.md`). Smoke `PKG shell-visual` (N-23); captura `docs/audit/evidence/parity/P01/P01-home-after-1440-es.jpg` |
| 7 | Nombre en la tarjeta | `profile.name \|\| 'Tu perfil profesional'` (`ProfileIdentity.jsx:18`; `connectedModel.js:3`) | `display_name` en la tarjeta (`src/features/professional/components/IdentityCard.tsx:30`). Es obligatorio en la cuenta, así que no hace falta el «Tu perfil profesional» de reserva | = (antes ≈) | — | — | — |
| 8 | Línea «base · años» | «{location \|\| 'Base por completar'}» + « · {years} años de experiencia declarada» si hay años (`ProfileIdentity.jsx:18`). Runtime: «Madrid (MAD) · 8 años de experiencia declarada» | «{base \|\| 'Base por completar'}» + « · {n} años de experiencia declarada» si hay años > 0, con plural ICU («1 año…», donde v1.8 diría «1 años») (`src/features/professional/components/IdentityCard.tsx:31-36`; es:484-485). El panel «Perfil» con `ProfileFacts` sigue al pie (`src/features/professional/components/ProfessionalSections.tsx:10-19`, es:535-541) | = (antes ≈) | — | — | Mantener (W2-01) |
| 63 (nueva) | Nombre accesible de la tarjeta | `<div className="cf-identity">` sin nombre accesible (`src/features/ProfileIdentity.jsx:18`) | `<section aria-label="Tu identidad profesional">` (`src/features/professional/components/IdentityCard.tsx:18-21`, es:483) | + | — | — | Mantener |
| 9 | Medallas en la tarjeta | `MedalStrip` principal: 4 medallas + «+N» (`src/features/MedalStrip.jsx:5-9`). Runtime: «8 AÑOS · B1.1 · A320 · SM · +3». Runtime v2: T1 «8 AÑOS · B1.1 · A320 · +2»; T2 «3 AÑOS · B1.1 · A320 · SM · +1» (`evidencias/v2/20/TEC-01-1-v18c-1440.txt`, `TEC-01-2-v18c-1440.txt`). | `MedalStrip` en el hero: 4 principales + «+{n}», detalle en región `status` (N-15, T-143). Runtime F3 (delta): «12 AÑOS · B1.1 · A320 · +1» | = (F3: antes −) | — | — | Hecho (P01-06, `17-parity-matrix-v18.md`). Smoke `PKG shell-visual 2`, `PKG passport 4`; ver TEC-08 |
| 10 | «Editar perfil» | Botón con icono UserRound → `profile` | «Editar perfil» → `/app/professional/profile` en el hero, con el icono del menú inline delante del texto (`ProfessionalHero.tsx`); «Editar pasaporte» sigue en el panel «Perfil» | = (F3: antes ≈) | — | — | Hecho (P01-07, `17-parity-matrix-v18.md`) |
| 11 | «Estado de mi perfil» | Enlace ↗ que abre un modal (S-MOD-TEC-01 / S-MOD-CON-01) | «Estado de mi perfil ↗» (botón `inverseLink`, sin borde) abre un `<dialog>` nativo con la lista de apartados y «Completar» (N-18, T-148; `ProfileStatusDialog.tsx`); Escape o «Cerrar» lo cierran y el foco vuelve al botón | = (F3: antes ≈) | — | — | Hecho (P01-08/09, `17-parity-matrix-v18.md`). Smoke `PKG shell-visual 3`; `p01-acceptance main` |
| 12 | Frase del porcentaje | Demo «Tu pasaporte está al {score}%». Conectado «Tu perfil está al {score}%» | «Tu pasaporte está al {percent}%» dentro del hero, encima de la barra, solo por debajo del 100 % (`ProfessionalHero.tsx`; es `professional.overview.progressLead`); el KPI «Perfil completado» sigue debajo con `formatPercent` | = | — | — | Hecho (P01-10, `17-parity-matrix-v18.md`). Smoke `PKG shell-visual`, 2e |
| 13 | Apartados pendientes | Demo «{n} apartados por completar», sin plural («1 apartados», H-12). Conectado «{n} por completar» | «{n} apartado(s) por completar» con plural ICU, en el hero (`ProfessionalHero.tsx`; es `professional.overview.toComplete`). Runtime F3 (delta): «1 apartado por completar» | = | — | — | Hecho (P01-10; corrige «1 apartados», H-12) |
| 14 | Barra `<progress>` | `max=100`, `value=score`, `aria-label="Perfil completado al {score} por ciento"` | `<progress max={100} value={percent} aria-label="Perfil completado al {percent} por ciento">` en el hero, barra menta sobre pista translúcida como v1.8 (`ProfessionalHero.tsx`) | = | — | — | Hecho (P01-10, `17-parity-matrix-v18.md`) |
| 64 (nueva) | Ubicación del bloque de progreso | Demo: dentro de la tarjeta del pasaporte, bajo «Editar perfil» / «Estado de mi perfil» (`TechnicianHome.jsx:15`). Conectado: igual, con «Tu perfil está al {score}%» | Dentro de la tarjeta (hero), bajo «Editar perfil» / «Estado de mi perfil ↗», como en ambos modos de v1.8 (`ProfessionalHero.tsx`) | = (F3: antes ≈) | — | — | Hecho (P01-10, `17-parity-matrix-v18.md`) |
| 15 | Umbral de la barra | Visible si `score<95` (`TechnicianHome.jsx:15`; `ConnectedHome.jsx:15`). Con 10 apartados avanza de 10 en 10, así que solo se oculta al 100 % (H-25; C §4.6-1) | El bloque de progreso solo se ve por debajo del 100 % (`ProfessionalHero.tsx`): con los 10 apartados de BR-11 (T-36), el umbral 95 de v1.8 equivale al 100 | = (F3: antes ≈) | — | — | Hecho (P01-10, `17-parity-matrix-v18.md`) |
| 16 | Nota del porcentaje | Demo «Completar los datos te ayuda a encontrar oportunidades. El porcentaje no equivale a una revisión documental.». Conectado «Información cumplimentada. La revisión documental es un proceso independiente.» | «Completar los datos te ayuda a encontrar oportunidades. El porcentaje no equivale a una revisión documental.» dentro del bloque de progreso del hero, así que desaparece con él al 100 % como en la demo (`ProfessionalHero.tsx`; es `professional.overview.progressNote`). Al 100 % el KPI añade «Todos los elementos del perfil están completos…» | = (F3: antes ≈) | — | — | Hecho (P01-10, `17-parity-matrix-v18.md`) |
| 17 | Título del estado | Modal «Estado del perfil · {score}%» | Modal «Estado del perfil · {percent}%» (es `profileHero.statusTitle`; `ProfileStatusDialog.tsx`) | = (F3: antes ≈) | — | — | Hecho (P01-09, `17-parity-matrix-v18.md`). Smoke `PKG shell-visual 3` |
| 18 | Texto de introducción | Demo «Información cumplimentada; la revisión de documentos y cualificaciones es independiente.» | «Información cumplimentada; la revisión de documentos y cualificaciones es independiente.» como introducción del modal (es `profileHero.statusIntro`) | = (F3: antes ≈) | — | — | Hecho (P01-09, `17-parity-matrix-v18.md`) |
| 19 | Fila de apartado | «✓/○ {label}» + «Completar», que cierra el modal y navega (`homeModel.js:4-5`; `connectedModel.js:4`) | «✓/○» `aria-hidden` + etiqueta + texto oculto «hecho/pendiente» + `ButtonLink` «Completar» solo en los pendientes, que cierra el modal y navega (`ProfileStatusDialog.tsx`) | = | — | — | Hecho (P01-09, `17-parity-matrix-v18.md`); `p01-acceptance main` |
| 20 | Todo completo | «Los apartados de información están completados.» | «Los apartados de información están completados.» en el modal cuando no falta nada (es `profileHero.allDone`); sin bloque de progreso en el hero al 100 % | = (F3: antes ≈) | — | — | Hecho (P01-09/10, `17-parity-matrix-v18.md`) |
| 21 | Resumen plegable | — | Ya no existe: el panel plegable de Next se sustituyó por el modal de v1.8 (N-18, T-148) | = (F3: antes +) | — | — | Ninguno de los dos lo tiene |
| 22 | Fórmula: número y peso | Demo `profileCompletion`: 10 apartados del mismo peso (`src/business.js:85-88`). Conectado `readiness`: 10 apartados (`connectedModel.js:4`). `round(hechos/10·100)`. Runtime v2 (conectado): «Estado del perfil · 100%» con Nombre, Base habitual, Categoría, Aeronaves, Experiencia, Tarifa mínima, Países de trabajo, Disponibilidad futura, Cursos y Documento aportado (`evidencias/v2/20/TEC-01-3-v18c-1440.txt`); T2 «· 90%» con «○ Cursos» + «Completar» (`TEC-01-5-v18c-1440.txt`). | Los 10 apartados del conectado, del mismo peso, `round(hechos/10·100)` (`src/domain/professional.ts profileCompleteness`; BR-11, T-36): nombre, base, categoría principal, aeronaves, experiencia, tarifa mínima, países, disponibilidad futura, cursos, documento (este solo con el wallet; sin él, 9). Runtime F3: delta 90 % (falta «Documento aportado»), como Marcos B. en la demo | = (F3: antes ≠) | — | — | Hecho (N-16, T-36; P01-33, `17-parity-matrix-v18.md`). Unit `professional.test.ts`; smoke `PKG shell-visual 3` (9 o 10 filas) |
| 23 | Apartado: nombre | Demo `name.trim()`. Conectado `!!p.name` | `displayName.trim()` (`professional.ts:56`) | = | — | — | — |
| 24 | Apartado: contacto | Demo «Datos de contacto»: `email \|\| phone` (`homeModel.js:4`) | No cuenta, como en el conectado (`readiness` no lo tiene): el correo es de la cuenta y el teléfono es privado y opcional | ≈ (F3: antes −) | — | — | Igual al conectado (T-36) |
| 25 | Apartado: base | Demo `location` (un select que siempre tiene valor). Conectado «Base habitual»: `!!p.base` | «Base»: `baseLocation.trim()` (`professional.ts:57`) | = | — | — | — |
| 26 | Apartado: categoría | Demo «Categorías»: `categories.length`. Conectado «Categoría»: `!!p.category` | «Categoría principal»: `primary_category !== null` (`professional.ts`; es `professional.item.primary_category`) | = (F3: antes ≈) | — | — | Hecho (T-36) |
| 27 | Apartado: aeronaves | Demo «Aeronaves o especialidad»: `aircraft.length` o una categoría de Sheet Metal / NDT / Helper. Conectado «Aeronaves»: `!!p.aircraft` | «Aeronaves»: `aircraft.length > 0` (`professional.ts`) | = (F3: antes ≈) | — | — | Hecho (T-36) |
| 28 | Apartado: experiencia | `years>0` en ambos modos | `yearsExperience > 0` (`professional.ts:58`) | = | — | — | — |
| 29 | Apartado: cursos | Demo «Cursos declarados»: `courses.length`. Conectado «Cursos»: `!!p.courses?.length` | «Cursos»: alguna TRAINING `active` (`professional.ts`) | = (F3: antes −) | — | — | Hecho (T-36) |
| 30 | Apartado: tarifa | Demo «Tarifa»: `minRate>0`. Conectado «Tarifa mínima»: `hourlyRate>0` | «Tarifa mínima»: `min_rate > 0` de la fila privada (`professional.ts`; `technician_private_details`) | = (F3: antes −) | — | — | Hecho (T-33, T-36) |
| 31 | Apartado: países | Conectado «Países de trabajo»: `countries?.length`. La demo no lo tiene | «Países de trabajo»: `work_permits.length > 0` (`professional.ts`) | = (F3: antes −) | — | — | Hecho (T-34, T-36) |
| 32 | Apartado: disponibilidad | Demo «Disponibilidad publicada»: algún día `>= today()` en available/aog. Conectado «Disponibilidad futura»: algún intervalo con `end > now` | «Disponibilidad futura»: ventanas `available` o `aog_only` (BR-4.8) con `ends_at > now` (`futureAvailabilityCount`, `src/domain/professional.ts`; `completeness.ts`) | = (F3: antes ≠) | — | — | Hecho (N-16, T-36). Unit `professional.test.ts` |
| 33 | Apartado: documento | «Documento aportado». Demo: `!demo && !deleted` → `docs`. Conectado: `documents.length` → `documents` | «Documento aportado»: documentos propios no archivados, solo mientras el wallet está activo; sin wallet el apartado no cuenta (9 apartados) (`completeness.ts`; `countOwnDocuments`) | ≈ (F3: antes −) | — | — (v2: default v1.8; el wallet propio es NOW, tras flag) | Hecho (T-36, T-37); en PROD cuenta cuando el wallet se active (D-10 solo para terceros) |
| 34 | Apartado: cualificación verificada | No existe: v1.8 no exige revisión para el porcentaje | Ya no cuenta (N-16, T-36): v1.8 tampoco lo tiene. La verificación se enseña aparte, en el KPI «Verificadas {v} de {a}» y en «Próximos pasos» | = (F3: antes +) | — | — | Hecho (N-16). El tope del 86 % en PROD desapareció con el apartado; OD-3 sigue en TEC-03, fila 16 |
| 35 | Apartado: visibilidad | No existe | Ya no cuenta (N-16, T-36): v1.8 tampoco lo tiene. La visibilidad sigue como KPI propio | = (F3: antes +) | — | — | Hecho (N-16) |
| 36 | Destino de cada apartado | Demo: 8 → `profile`, 1 → `calendar`, 1 → `docs`. Conectado: 8 → `profile`, 1 → `calendar`, 1 → `documents` | 7 → `/profile` (nombre, base, categoría, aeronaves, experiencia, tarifa, países), 1 → `/availability`, 1 → `/qualifications` (cursos), 1 → `/documents` (`COMPLETENESS_HREF`, `completeness.ts`) | ≈ | — | — | Mantener (los cursos tienen página propia) |
| 37 | Valores de ejemplo | Demo Marcos B.: 90 %, falta «Documento aportado» (D-TEC-01c). Conectado T1: 100 %; T2: 80 % (C-TEC-45, C-TEC2-02). Runtime v2: conectado T1 100 % y T2 90 % («Tu perfil está al 90%», «1 por completar»; `evidencias/v2/20/TEC-01-2-v18c-1440.txt`); demo 90 % (`evidencias/v2/20/TEC-01-1-v18-1440.txt`). | Sin semilla en PROD. Runtime F3 (local): delta 90 % (falta «Documento aportado», como Marcos B. en la demo); alpha, echo, foxtrot y oscar según sus declaraciones de la semilla | ≈ | — | — | Smoke `PKG P02 1` («90% completado · 0 evidencias») |
| 38 | KPI «oportunidades compatibles» | Demo `model.compatible.length` (runtime «9»). Conectado `opportunities.length`. Conectado: ofertas publicadas no bloqueadas con alguna jornada futura libre en la que `eligible()` no da errores (`connectedModel.js:11-16`). Runtime v2: demo «9», T1 «4», T2 «2» (`evidencias/v2/20/TEC-01-1-v18c-1440.txt`) | «Oportunidades compatibles» = `total` de `listOpportunities({ eligible: "1" })`: necesidades publicadas y vigentes en las que la elegibilidad propia (cualificaciones obligatorias verificadas, disponibilidad del periodo) se cumple; «—» si falla la carga (`src/features/applications/components/ProfessionalActivity.tsx:26,37-41`; `supabase/functions/opportunities/index.ts:45-60`; es:574). Runtime v2: «0» para alpha, foxtrot y oscar (alpha ve «1 requisito obligatorio pendiente» en la B737); «1» para delta, echo y hotel cuando el área 30 publicó «E2E diff v2 · B» (`evidencias/v2/20/TEC-01-11-next-1440.txt`, `TEC-01-12-next-1440.txt`, `TEC-01-13-next-1440.txt`; `TEC-01-1-next-1440.txt`, `TEC-01-5-next-1440.txt`) | ≈ (v2: antes −) | — | — (v2: M07 hecho, D-12) | Mantener (`db05af1`). Cuenta el periodo entero, no jornadas sueltas (D-06 Q6) |
| 39 | KPI «asignaciones confirmadas» | Candidaturas `Confirmada` / `confirmed`. Runtime v2: demo «0», T1 «3», T2 «0». | «Asignaciones confirmadas» = candidaturas propias en `confirmed`; «—» si falla la carga (`ProfessionalActivity.tsx:32,48`; es:577). Runtime v2: «0» para alpha; «1» para delta, con su candidatura `confirmed` del área 30 (en inglés, «CONFIRMED ASSIGNMENTS 1», `evidencias/v2/20/TEC-01-11-next-1440.txt`) | ≈ (v2: antes −) | — | — (v2: D-06 ratificada) | Mantener (`db05af1`) |
| 40 | KPIs propios de Next | — | Perfil completado · Cualificaciones · Verificadas «{v} de {a}» · Ventanas · Visibilidad · Candidaturas en curso · Propuestas por aceptar, plegados DEBAJO de los bloques de v1.8 (T-161; `page.tsx`) | + | — | — | Mantener (P01-32, `17-parity-matrix-v18.md`) |
| 41 | KPI «Cualificaciones» | — | `active.length`: solo las cualificaciones que se poseen; las retiradas ya no cuentan (`page.tsx:132`) | + | — | — | Mantener (W2-01) |
| 42 | Panel «Próximos pasos» | — | Cualificaciones rechazadas o en espera de revisor, con «Abrir cualificaciones» (`page.tsx:154-172`, es:507-510). Runtime v2: echo «1 cualificación espera a un revisor. Hasta que se verifique no cuenta para los requisitos obligatorios.»; oscar «1 cualificación ha sido rechazada por un revisor. Lee el motivo y corrígela.» + «Abrir cualificaciones» (`evidencias/v2/20/TEC-01-7-next-1440.txt`, `TEC-01-9-next-1440.txt`). | + | — | — | Mantener |
| 43 | «Documentos y cursos próximos a revisar» | En v1.8 está en el pasaporte visual (`src/features/Badges.jsx:10`), no en el inicio | Panel en Mi espacio y, desde P02, también `<details>` plegado dentro del «Pasaporte visual», con las mismas filas (`upcomingReviews`, `UpcomingReviews.tsx`; T-163) | ≈ | — | — | Mantener (Next lo enseña en los dos sitios). Smoke `PKG P02 1/6`; ver TEC-05, fila 24 |
| 44 | Calendario: kicker y título | Demo: kicker «TU DISPONIBILIDAD» + h2 del mes, «octubre de 2026», que el CSS capitaliza como «Octubre De 2026». Conectado: h2 del mes sin kicker («Octubre De 2026») | Kicker «Tu disponibilidad» (mayúsculas por CSS) + h2 del mes «Octubre de 2026» (`formatMonth`, X-18 corrige el «De» de v1.8) (`AvailabilityMonth.tsx`) | = (F3: antes ≈) | — | — | Hecho (P01-13, `17-parity-matrix-v18.md`); `p01-acceptance main` |
| 45 | Calendario: navegación | Botones con `aria-label` «Mes anterior/siguiente del calendario de inicio» (demo) o «Mes anterior/siguiente» (conectado). Estado local: se pierde al recargar | Enlaces `?month=` «←» / «→» con `aria-label` «Mes anterior» / «Mes siguiente»; el estado va en la URL y sobrevive a la recarga (`AvailabilityMonth.tsx`) | ≈ (F3: antes +) | — | — | Mantener (P01-14, diferencia aprobada: glifo y URL) |
| 46 | Cabecera de semana | «L M X J V S D» | «L M X J V S D» (es `availability.weekdayShort.*`, solo para el mini calendario; en: «M T W T F S S») | = (F3: antes ≈) | — | — | Hecho (P01-15, `17-parity-matrix-v18.md`) |
| 47 | Celda de día | `<button>` con `aria-pressed`; número + punto rojo `<i>`. Deshabilitado si es pasado solo en la demo (`TechnicianHome.jsx:15`; runtime: 21 de 31 en octubre); el conectado no lo deshabilita (`ConnectedHome.jsx:15`). Runtime v2 (conectado): «2026-10-27: Disponible. 1 oportunidades», ningún día `disabled` (`evidencias/v2/20/TEC-01-1-v18c-1440.aria.yml`). | `<button aria-pressed>` por día con número y punto rojo `<i>`; los pasados `disabled` (demo); hoy `aria-current="date"` (`AvailabilityMonth.tsx`). Runtime F3: 1-25 de octubre deshabilitados, 26-31 pulsables | = (F3: antes ≠) | — | — | Hecho (N-03; P01-16, `17-parity-matrix-v18.md`). `p01-acceptance main`, smoke pc5 |
| 48 | `aria-label` del día | Demo «{d}: {estado}. {n} oportunidades», más « posibles, revisa publicación de descanso» si alguna no está publicada. Conectado «{d}: {estado}. {n} oportunidades» | «{d}: {estado}. {n} oportunidades» y «… posibles, revisa publicación de descanso» con plural ICU (es `availability.mini.offers*`). Runtime F3: «2026-10-26: Disponible. 0 oportunidades» | = (F3: antes ≈) | — | — | Hecho (N-03; P01-16, `17-parity-matrix-v18.md`) |
| 49 | Estados de día | Demo: Trabajo, Descanso, Disponible, Solo AOG, Asignado (`TechnicianHome.jsx:14`). Conectado: Trabajo, Descanso privado, Disponible, Solo AOG, Asignado, Intervalo parcial (`ConnectedHome.jsx:7`). Runtime v2 (conectado T1): 22 y 30 de octubre «Asignado» (`evidencias/v2/20/TEC-01-1-v18c-1440.jpg`). | Disponible, Solo AOG, Bloqueado, Parcial, Descanso + «Asignado» en los días de una candidatura `confirmed` (`assignmentDays`; `ProfessionalActivity.tsx`). «Bloqueado» nombra la ventana `unavailable` (BR-4) donde la demo dice «Trabajo» | ≈ | P3 | — | Mantener (P01-16, `17-parity-matrix-v18.md`): «Asignado» hecho (N-03); «Trabajo» → «Bloqueado» (TEC-04, fila 25) |
| 50 | Leyenda | Demo «Trabajo · Descanso · Disponible · Asignado · ● Oportunidades», sin AOG (H-13). Conectado: sin leyenda | «Bloqueado · Descanso · Disponible · Solo AOG · Parcial · Asignado · ● Oportunidades», en el orden de v1.8 con los dos estados propios (`AvailabilityMonth.tsx` `LEGEND`). Runtime F3: los 7 ítems | ≈ | P3 | — | Mantener (P01-18, `17-parity-matrix-v18.md`): corrige H-13 |
| 51 | Punto rojo y su nota | Demo: «El punto rojo señala oportunidades en días compatibles o descansos que podrías publicar. No cambia tu disponibilidad.». Conectado: «Calendario en UTC. El punto rojo indica ofertas compatibles con tus intervalos publicados. Las horas concretas de cada jornada se muestran en la oferta.». Runtime v2 (conectado T1): punto en el 27 y el 29 de octubre (`evidencias/v2/20/TEC-01-1-v18c-1440.jpg`). | Punto rojo en los días con oportunidades compatibles (o posibles en descanso) y la nota «Calendario en UTC. El punto rojo señala oportunidades en días compatibles o descansos que podrías publicar. No cambia tu disponibilidad.» (prefijo del conectado, BR-10; es `availability.mini.note`). Runtime F3: la nota, literal | = (F3: antes −) | — | — | Hecho (N-03; P01-19). Smoke `PKG P02 6` (la nota, antes IMPLEMENTED_UNVERIFIED en `17-parity-matrix-v18.md`) |
| 52 | Zona horaria del calendario | Demo: Europe/Madrid (`business.js:2-4`). Conectado: UTC | UTC (`calendar.ts`; BR-10) | = | — | — | Igual al conectado |
| 53 | «Actualizar disponibilidad» | Botón con icono CalendarDays → `calendar` | «Actualizar disponibilidad» con el icono del menú inline, al pie de la tarjeta del calendario → `/app/professional/availability?month=` (`HomeOpportunities.tsx`; es `professional.overview.openAvailability`) | = (F3: antes ≈) | — | — | Hecho (P01-20, `17-parity-matrix-v18.md`) |
| 54 | Elegir día filtra la lista (S-TEC-01a) | Clic alterna `selected`. El h2 pasa a «Oportunidades · {día}» y, solo en la demo, aparece «Quitar selección de fecha» (`D-TEC-01d`; `TechnicianHome.jsx:15`). Conectado: solo cambia el h2 (`ConnectedHome.jsx:15`; runtime v2 «Oportunidades · 2026-10-27», `evidencias/v2/20/TEC-01-4-v18c-1440.txt`) | Pulsar un día (`aria-pressed`) filtra «Oportunidades para ti»: h2 «Oportunidades · {día}» y «Quitar selección de fecha», que devuelve el foco al día (`HomeOpportunities.tsx`, `homeFeed`) | = (F3: antes −) | — | — | Hecho (N-03; P01-17, `17-parity-matrix-v18.md`). `p01-acceptance main`, smoke pc6/pc8 |
| 55 | Sección «Oportunidades» | Demo: kicker «ENCUENTRA TU SIGUIENTE PASO», h2 «Oportunidades para ti», «Ver todas» → `jobs`, máximo 5. Conectado: igual, sin kicker | Sección a todo el ancho: kicker «Encuentra tu siguiente paso», h2 «Oportunidades para ti», «Ver todas ↗» → `/app/professional/opportunities`, 5 filas (`HOME_FEED`), lista en caja (`HomeSection.tsx`, `HomeOpportunities.tsx`). Runtime F3 (delta): sección y vacío | = (F3: antes ≈) | — | — | Hecho (N-22; P01-21, `17-parity-matrix-v18.md`) |
| 56 | Fila de oportunidad | Demo: título; «{empresa} · {ubicación}»; «{inicio} → {fin} · Requisitos y disponibilidad compatibles» o «… · Posible en descanso: revisa y publica tus fechas»; «{tarifa} / h»; «Ver oferta» o «Revisar fechas». Conectado: título; «{org} · {base} · {categoría}»; «{inicio UTC} · {tarifa} / h»; «Ver oferta». Runtime v2 (conectado T1): «AOG A321 · cambio de frenos (cliente)» / «QA Talent Recruiting · OPO · B1.1» / «29 oct 2026, 6:00 UTC · 52,00 € / h» / «Ver oferta» (`evidencias/v2/20/TEC-01-1-v18c-1440.txt`) | Marca con el icono del calendario (`ok-bg` / `danger-bg` si «posible en descanso», oculta < `sm`), título, «{org} · {ubicación} · {códigos obligatorios}» (línea del conectado), «{inicio} → {fin} · Requisitos y disponibilidad compatibles» o «… · Posible en descanso: revisa y publica tus fechas», «{tarifa} / h» solo cuando la necesidad la publica (T-62), «Ver oferta» / «Revisar fechas» (`HomeOpportunities.tsx`) | ≈ | P3 | — (tarifa: v2 default v1.8, C-9/D-08 y OD-7 sin dinero real) | Hecho (N-22; P01-22/23 IMPLEMENTED_UNVERIFIED: la marca y la fila con tarifa no se han visto pintadas, faltan datos de prueba — P04) |
| 57 | Oportunidades «posibles en descanso» | Solo demo: `opportunityDays` (`homeModel.js:6-15`) | `listOpportunities({ rest: "1" })` → filas «Posible en descanso: revisa y publica tus fechas» con «Revisar fechas» → calendario del mes (BR-14.1; `home.ts homeOpportunities`) | ≈ (F3: antes −) | P3 | — | Hecho (N-17; P01-22). Unit `home.test.ts`; la fila no se ha visto pintada: faltan datos de prueba (P04) |
| 58 | Turnos recomendados | Conectado: `recommendedShifts` (`connectedModel.js:11-16`) | — | − | P2 | D-06 Q6 ↔ SCOPE-2 (Q6 ratificada: una candidatura = un periodo; v2: antes C-9/D-08) | No portar mientras rija D-06 Q6: la cobertura parcial (LATER) exige que el owner revise Q6 |
| 59 | Oportunidades: vacío | Demo: «Sin oportunidades para este día» o «Todavía no hay oportunidades compatibles», con «Revisa tu perfil o publica las fechas que quieras ofrecer. Los descansos privados no se envían a empresas.» y «Abrir mi calendario». Conectado: «Aún no hay oportunidades compatibles» + «Completa las cualificaciones y las fechas que quieras publicar.» | «Todavía no hay oportunidades compatibles» o «Sin oportunidades para este día» + «Revisa tu perfil o publica las fechas que quieras ofrecer. Los descansos privados no se envían a empresas.» + «Abrir mi calendario», centrados (`HomeOpportunities.tsx`). Si falla la carga: «No se ha podido cargar ahora…» `role=alert`. Runtime F3 (delta): el vacío completo | = (F3: antes ≈) | — | — | Hecho (N-22; P01-24, `17-parity-matrix-v18.md`). `p01-acceptance empty` |
| 60 | Sección «Mis candidaturas» | Demo: kicker «TU ACTIVIDAD», «Ver todas»; fila con título, «{empresa} · {n} jornadas», pastilla de estado, «Ver seguimiento». Conectado: título, organización, estado + « · {n} sin leer», «Seguimiento». Runtime v2 (conectado T1): 5 filas, p. ej. «Urgente B1.1 A320 · C-check parcial» / «QA Aero Mantenimiento S.L.» / «Confirmada · 1 sin leer» / «Seguimiento» (`evidencias/v2/20/TEC-01-1-v18c-1440.txt`) | Sección «Mis candidaturas» con kicker «Tu actividad», «Ver todas ↗» → `/app/professional/applications`; filas con CheckCircle, título, «{org} · {n} jornadas» (turnos publicados o días UTC del periodo, D-06 Q6), chip de estado y «Ver seguimiento» → `#a-{id}`; 5 filas (`ProfessionalActivity.tsx`, `requirementDays`). Sin «· {n} sin leer» (chat, SCOPE OUT). Runtime F3 (delta): 5 filas «Demo MRO Madrid · 2 jornadas» | ≈ | P3 | — («sin leer» es chat, SCOPE OUT) | Hecho (P01-25/26, `17-parity-matrix-v18.md`); «{n} jornadas» verificado en ejecución en F3 (antes IMPLEMENTED_UNVERIFIED) |
| 61 | Candidaturas: vacío | Demo: «Tu próxima candidatura empieza aquí» + «Explora las oportunidades y elige las condiciones y fechas que te encajen.» + «Buscar oportunidades». Conectado: «Todavía no has presentado candidaturas.» | «Tu próxima candidatura empieza aquí» + «Explora las oportunidades y elige las condiciones y fechas que te encajen.» + «Buscar oportunidades» → `/app/professional/opportunities`, centrado (`ProfessionalActivity.tsx`) | = (F3: antes ≈) | — | — | Hecho (N-22; P01-27, `17-parity-matrix-v18.md`). `p01-acceptance empty` |
| 62 | Diseño a 390 px | Una columna, KPIs en 2 columnas y calendario bajo la tarjeta (§2.M; runtime: `evidencias/xhigh/20/TEC-01-1-v18-390.jpg`) | Una columna bajo `xl` (rejilla `xl:grid-cols-[1.15fr_1fr]` como v1.8 por encima de 1050 px), KPIs en 2 columnas, identidad en columna bajo `sm`; sin scroll horizontal a 1440/1024/768/390/360 (`p01-acceptance main`) | ≈ | — | — | Mantener (P01-12/29, `17-parity-matrix-v18.md`); capturas `docs/audit/evidence/parity/P01/P01-home-after-{1024,768,390,360}-es.jpg` |
| 65 (nueva xhigh) | Tarjeta de identidad a 390 px | Avatar arriba y nombre, base y medallas a todo el ancho (`evidencias/xhigh/20/TEC-01-1-v18-390.jpg`) | Avatar encima del nombre bajo `sm` (`max-sm:flex-col`, `ProfessionalHero.tsx`), base y medallas a todo el ancho; sin scroll horizontal a 390/360 (`p01-acceptance main`) | = (F3: antes ≈) | — | — | Hecho (P01-29, `17-parity-matrix-v18.md`); captura `docs/audit/evidence/parity/P01/P01-home-after-390-es.jpg` |
| 66 (nueva xhigh) | Error al cargar Mi espacio | Conectado: si falla la carga se muestra un error (`src/beta/Account.jsx:30-31`) | X-16: `getOwnProfessionalOverview` lanza un error si falla cualquiera de sus tres lecturas y solo devuelve `null` cuando la cuenta no tiene perfil técnico (`src/features/professional/api.ts:48-53`); el límite de error de `/app` muestra «No se ha podido mostrar esta página», la referencia y «Reintentar» (`src/app/app/error.tsx:15-22`; es:26). Test `src/features/professional/api.test.ts` en verde (v2). Solo código: el fallo no se puede provocar sin tocar la BD | ≈ (v2: antes ≠) | — | — | Mantener (X-16, `61cc473`; B-16 HECHO) |
| 67 (nueva xhigh) | Orden de los bloques a 1440 px | Demo: cabecera → [tarjeta del pasaporte (identidad, medallas, acciones, progreso y 2 KPIs) \| calendario] → «Oportunidades para ti» → «Mis candidaturas» (`TechnicianHome.jsx:15`; `evidencias/xhigh/20/TEC-01-1-v18-1440.jpg`) | Cabecera → [hero (identidad, medallas, acciones, progreso, 2 cifras) \| calendario] → «Oportunidades para ti» → «Mis candidaturas» → KPIs propios → «Próximos pasos» (si hay) → «Documentos y cursos próximos a revisar» → «Logros de aprendizaje» → «Perfil» (`page.tsx`; T-161) | = (F3: antes ≈) | — | — | Hecho (T-161; P01-28, `17-parity-matrix-v18.md`); `p01-acceptance main` (orden por posición) |
| 68 (nueva v2) | KPIs «Candidaturas en curso» y «Propuestas por aceptar» | No existen: v1.8 solo tiene los dos contadores de las filas 38 y 39 | «Candidaturas en curso» (no terminales) y «Propuestas por aceptar» (`proposed`, tono `warn` si hay alguna) (`ProfessionalActivity.tsx:29-31,42-47`; es:575-576). Runtime v2: alpha «0» y «0»; delta y hotel «1» y «0» | + | — | — | Mantener |
| 69 (nueva v2) | Fallo de un feed | Conectado: el estado llega entero en `/api/state`; si falla, falla la pantalla (`src/beta/Account.jsx:30-31`). Demo: estado local, no falla | Cada feed falla por separado: su KPI muestra «—» y su panel «No se ha podido cargar ahora. Recarga para reintentar.» con `role=alert`, sin romper Mi espacio (`ProfessionalActivity.tsx:39-48,59-62,91-94`; es:584). Solo código | + | — | — | Mantener |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-01-inicio-1440.png`, `D-TEC-01-inicio-390.png`, `D-TEC-01b-insignias-1440.png`,
  `D-TEC-01c-estado-perfil-1440.png`, `D-TEC-01d-dia-click-1440.png`, `D-TEC-01e-dia-descanso-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-01-home-empty-1440.png`, `C-TEC-01-home-390.png`,
  `C-TEC-11-profile-status-modal-1440.png`, `C-TEC-19-home-with-jobs-1440.png`, `C-TEC-28-home-active-1440.png`,
  `C-TEC-32-home-day-selected-1440.png`, `C-TEC-45-profile-status-100-1440.png`, `C-TEC-46-home-working-1440.png`,
  `C-TEC2-02-home-1440.png`.
- Next: `docs/audit/evidence/v18-compare/next-after/tech-home-{1440,1024,768,390,360}.jpg` (lote 11) y
  `docs/audit/evidence/local-15-overview-es-{1440,768,390}.jpg` (`67fd62f`, lote 14). Referencia v1.8:
  `docs/audit/evidence/v18-compare/v18/tech-home-*.jpg`.
- xhigh (22/10): `evidencias/xhigh/20/TEC-01-1-{next,v18}-{1440,390}.{jpg,txt,aria.yml}`, `TEC-01-2-v18-1440` (modal
  «Estado del perfil · 90%»), `TEC-01-3-v18-1440` (día seleccionado), `TEC-01-4-next-noprofile-1440` (cuenta de organización).
- v2 (22/10, tras el bucle): Next `evidencias/v2/20/TEC-01-1-next-{1440,390}.*` (alpha), `TEC-01-4-next-1440.*` (admin.mro, sin perfil), `TEC-01-5/6-next-{1440,390}.*` (oportunidades y candidaturas), `TEC-01-7/8/9-next-1440.*` (echo, foxtrot, oscar), `TEC-01-10-next-{390,360}.jpg` (tarjeta), `TEC-01-11/12/13-next-1440.*` (delta, echo y hotel con candidaturas del área 30); demo `TEC-01-1-v18-1440.*`; conectado `TEC-01-1-v18c-{1440,390}.*` (T1), `TEC-01-2-v18c-1440.*` (T2), `TEC-01-3/5-v18c-1440.*` (modal de estado, T1 y T2), `TEC-01-4-v18c-1440.*` (día seleccionado).
- F3 / P01 (26/10, `4d78d6d`): `docs/audit/evidence/parity/P01/P01-home-after-{1440,1024,768,390,360}-es.jpg`, `P01-home-after-{1440,390}-en.jpg`, `P01-home-empty-{1440,390}-es.jpg`, `P01-home-error-1440-es.jpg` (`scripts/local/p01-acceptance.mjs`).

---

## TEC-02 · Pasaporte (datos del perfil) — v1.8 `S-TEC-02, S-TEC-02a…e, S-MOD-TEC-02, D-TEC-02, S-CON-03, C-TEC-02/12/13/25, C-TEC2-01/04` ↔ Next `N-PRO-02, N-PRO-03`

**Estado global:** PARCIAL (F3: antes PARCIAL con 21 huecos; quedan 2, filas 43 y 50 aparte).
- **v1.8:** recoge identidad, cualificaciones, experiencia, cursos, tarifa, movilidad y permisos. En la demo es un
  asistente de 5 pasos con borrador automático; en el conectado, un formulario único con control de versión.
- **Next (F3, 2026-10-26, re-verificado en código y en ejecución con delta):** el paquete passport (`20261023100*`, T-30…T-35)
  dejó el pasaporte entero en un formulario de 5 paneles con los nombres de los pasos de la demo, guardado atómico con
  versión (`save_professional_passport`) y los catálogos de v1.8 (12 categorías, 12 aeronaves, 7 motores, 9 capacidades,
  27 permisos, inglés A1–C2, habilitaciones aeronave × licencia con vigencia y restricciones, restricciones generales,
  teléfono, empresa actual, tarifa y unidad, herramientas, bloqueos). P02 añade «Empezar perfil vacío» (T-162), el literal
  «Guardar pasaporte», y en el pasaporte visual la lista de 60 días y los logros (T-163). Los cursos siguen en
  Cualificaciones (TEC-03); la movilización, en Configuración (outreach).
- **Qué queda:** el paso «Resumen» (fila 43, no se porta) y el borrador automático (fila 8, solo demo e inseguro).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | Demo: «Mi pasaporte» `#profile`, también «Editar perfil» y «Completar». Conectado: «Mi pasaporte» `#profile` | Dos páginas: «Mi pasaporte» → `/app/professional/profile` (los 5 pasos de la demo como paneles, filas 7 y 13) y «Cualificaciones» → `/app/professional/qualifications` (el catálogo verificable) (`src/components/layout/AppShell.tsx`; es `nav.*`). Runtime F3 (delta): las dos entradas del menú | ≈ | P3 | — | Mantener. Smoke `PKG P02 1` |
| 2 | Kicker | Demo «MI PASAPORTE» (`src/components/v11/Professional2.jsx:76`). Conectado: ninguno | «Mi pasaporte» en las dos páginas (es:544, 595) | = | — | — | Igual a la demo |
| 3 | Título | Demo «Tu perfil, conectado.». Conectado: h2 «Pasaporte profesional conectado» (`src/beta/Account.jsx:62`) | «Tu perfil, conectado.» (es:545) | = | — | — | Igual a la demo |
| 4 | Descripción | Demo: «El borrador se guarda mientras avanzas. Guardar pasaporte publica los cambios en el matching.». Conectado: «Declaraciones del titular · {Pendiente\|Revisión registrada}. Los cambios de cualificación requieren nueva revisión; calendario y tarifa se gestionan sin dar por verificadas las habilitaciones.» | «Lo que actualizas aquí se refleja en el matching y en tu expediente. Las cualificaciones y la disponibilidad tienen sus propias páginas.» (es:546) | ≈ | — | — | — |
| 5 | Insignia de estado | Demo: «{%} completado · {n} evidencias». Usa el perfil publicado y los documentos no demo (`Professional2.jsx:75-76`) | Chip «{percent}% completado · {n} evidencias» en las acciones de la cabecera: el porcentaje BR-11 (los 10 apartados del conectado, T-36) y los documentos propios del wallet; sin wallet, «{percent}% completado» (`src/app/app/professional/profile/page.tsx:86-99`; es `passport.badge`). Runtime F3 (delta): «90% completado · 0 evidencias» | = (F3: antes −) | — | — | Hecho (N-25). Smoke `PKG P02 1/5`; captura `docs/audit/evidence/parity/P02/P02-passport-after-1440.jpg` |
| 6 | «Empezar perfil vacío» y modal | Modal «Empezar desde cero»: «Se preparará un borrador vacío. El perfil publicado se conserva hasta que guardes el nuevo pasaporte.» + «Preparar borrador» (`Professional2.jsx:112-132`) | Botón «Empezar perfil vacío» en la cabecera → `<dialog>` «Empezar desde cero» con el texto literal de v1.8, «Preparar borrador» y «Cancelar» (Escape cierra y devuelve el foco). El formulario se remonta sobre un borrador vacío de la MISMA versión: nada se escribe hasta «Guardar pasaporte», y un aviso `role=status` lo dice (`src/features/professional/components/PassportDraft.tsx`; `ProfileForm.tsx:97-118`; `passport-form.ts emptyPassport`). Runtime F3: campos y listas vacíos, visibilidad «Privado»; guardar así da «El nombre profesional es obligatorio» y la API conserva nombre y versión | = (F3: antes −) | — | — | Hecho (T-162). Unit `passport-form.test.ts` (emptyPassport); smoke `PKG P02 2/3`; captura `docs/audit/evidence/parity/P02/P02-passport-draft-after-1440.jpg` |
| 7 | Asistente de 5 pasos | Demo: «1 Identidad», «2 Cualificaciones», «3 Experiencia y cursos», «4 Disponibilidad y tarifa», «5 Resumen»; se puede saltar entre pasos (`Professional2.jsx:44,77`). Conectado: formulario único | Formulario único en 5 paneles con los nombres de los pasos de la demo: «01 · Identidad», «02 · Cualificaciones», «03 · Experiencia y cursos», «04 · Tarifa y permisos de trabajo», «05 · Visibilidad en la red» (`ProfileForm.tsx`; es `professional.passport.*`), más la página de cualificaciones. Sin pastillas ni «Anterior»/«Siguiente» | ≈ | P3 | — | Mantener (patrón del conectado, TD-25). Sin paso «Resumen» (fila 43) |
| 8 | Borrador automático | Demo: `useDraft`, guarda tras 350 ms con el indicador «Guardando…» (`Professional2.jsx:10-27`) | No existe: un formulario, un guardado (I-3); un fallo de red conserva lo escrito (fila 50) | ✗ (F3: antes −) | — | — | No portar: solo demo (el conectado no tiene borrador) y un borrador en el navegador guardaría teléfono y tarifa en un dispositivo compartido (T-162) |
| 9 | Pie del formulario | Demo: «Anterior» · «Guardar pasaporte» · «Siguiente» (`Professional2.jsx:111`). Conectado: «Guardar perfil en mi cuenta» | «Guardar pasaporte» / «Guardando…» (`ProfileForm.tsx`; es `professional.passport.save`). Sin «Anterior»/«Siguiente»: no hay pasos | = (F3: antes ≈) | — | — | Hecho (literal de la demo, T-163). Smoke `PKG P02 3/5` |
| 10 | Errores de validación | Demo: bloque `role=alert` con un párrafo por error y toast «Revisa los campos señalados. El borrador se conserva.» (`Professional2.jsx:45-78`). Conectado: mensaje del servidor bajo la cabecera | Errores por campo con `aria-invalid`/`aria-describedby` y `Notice` general (`ProfileForm.tsx:55-73,77-84`) | ≈ | — | — | — |
| 11 | Mensaje de guardado | Demo: toast «Perfil profesional guardado». Conectado: «Cambios guardados.» | «Pasaporte actualizado. El matching usa los nuevos datos.» (es:560) | + | — | — | — |
| 12 | Conflicto de versión | Demo: no hay. Conectado: 409 «El perfil ha cambiado. Actualiza antes de guardar.» (`server/app.mjs:64`); «Actualizar datos» descarta lo no guardado (C-TEC2-04) | `expectedUpdatedAt` (`ProfileForm.tsx:52`) → «Tu pasaporte se modificó en otra ventana o dispositivo. No se ha guardado nada: recarga la página…». El formulario conserva lo escrito (es:561; `ProfileForm.tsx:67-72`). Solo código: provocarlo exige guardar | ≈ (xhigh: antes =) | — | — | Mantener (V18-10) |
| 13 | Vista previa de identidad | Demo: `ProfileIdentity` editable, con foto, en el «Pasaporte visual». Conectado: vista previa en vivo, no editable (`Account.jsx:62`) | «Pasaporte visual» encima del formulario: avatar (foto de este navegador o iniciales), nombre, «Añadir foto» / «Cambiar foto» / «Quitar foto», todas las medallas, «Documentos y cursos próximos a revisar» plegado y el pie de v1.8 (`src/features/professional/components/PassportVisual.tsx`). No se edita en línea: el formulario está debajo | = (F3: antes −) | — | — | Hecho (N-15, N-23, T-163). Smoke `PKG P02 1`; ver TEC-08 |
| 14 | Nombre | Demo: «Nombre profesional», texto, error «Escribe tu nombre profesional.». Conectado: «Nombre completo», obligatorio, ≤ 160 | «Nombre profesional», `maxLength 120`; «El nombre profesional es obligatorio» / «…como máximo 120 caracteres» (`ProfileForm.tsx:95-97`; `src/lib/validation/professional.ts:28-32`; es:312-315). Runtime: con el nombre vacío, «Guardar cambios» muestra «El nombre profesional es obligatorio» sin enviar nada (`evidencias/xhigh/20/TEC-04-5-next-interact-1440.txt`) | ≈ (xhigh: antes =) | — | — | — |
| 15 | Correo electrónico | Demo: «Correo electrónico» en el pasaporte, con errores «Indica correo o teléfono.» y «Revisa el correo.» (`business.js:89-101`). Conectado: es el email de la cuenta | Es el email de la cuenta (Supabase Auth); no está en el pasaporte | ≈ | — | — | Igual al conectado |
| 16 | Teléfono | Demo: «Teléfono», `tel` | «Teléfono», `type=tel`, ≤ 32, privado: solo lo lee el titular (`technician_private_details`, RLS owner-only) y la pista lo dice (`ProfileForm.tsx`; `supabase/migrations/20261023100100_passport_declarations.sql`; T-35) | = (F3: antes −) | — | — | Hecho (N-08). Smoke `PKG passport 2`; `tests/db/passport.test.ts` (owner-only) |
| 17 | Base habitual | Demo: `select` con AIRPORTS, sin opción vacía: «Madrid (MAD)», «Barcelona (BCN)», «Lisboa (LIS)», «París (CDG)», «Frankfurt (FRA)», «Londres (LHR)», cada una ligada a su país (`business.js:11-19`). Conectado: texto ≤ 160 | Texto ≤ 80 con pista «Aeropuerto o ciudad, p. ej. Madrid (MAD)» y placeholder «Madrid (MAD)», más el `select` «País de la base» con los 27 países UE y «Sin indicar» (`ProfileForm.tsx`; `EU_COUNTRIES`). Runtime F3 (delta): «Barcelona (BCN)» · «España» | ≈ | P3 | — (T-34: la base sigue libre; antes OD-6) | Mantener (T-34: texto libre + país). Smoke `PKG passport 1` |
| 18 | Empresa actual (para bloqueo) | Demo: `select` «Ninguna», «Empresa actual del técnico», «AeroLine MRO». Conectado: casillas «Organizaciones bloqueadas», una por organización | `select` «Empresa actual»: «Ninguna» + las organizaciones de `list_blockable_organizations` (las que han publicado, las propias y las ya elegidas; no todo el directorio, revisión MEDIUM-1), privado, con la pista «…márcala también en «Organizaciones bloqueadas»» (`ProfileForm.tsx`; `20261023100200_passport_save.sql`). Runtime F3: «Ninguna» + 3 organizaciones | ≈ (F3: antes −) | — | — | Hecho (N-08, T-35). `tests/db/passport.test.ts` (list_blockable_organizations) |
| 19 | Aviso de la cuenta demo | «Cuenta local de demostración. El perfil puede estar incompleto y seguir siendo privado.» | — | ✗ | — | — | No portar (solo demo) |
| 20 | Categorías profesionales | Demo: chips de CATEGORIES (12): B1.1, B1.2, B1.3, B1.4, B2, B3, Cat A, Cat C, Mecánico, Sheet Metal, NDT, Helper (`business.js:7`). Conectado: las mismas 12 como casillas «Categorías y especialidades» (máximo 12). Runtime v2 (conectado T1): las 12 en «Categoría principal» y «Categorías y especialidades» (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). | Las 12 de v1.8 como casillas «Categorías y especialidades» (`PROFESSIONAL_CATEGORIES`, `src/domain/passport.ts`; CHECK en `20261023100100`); el catálogo verificable suma B1.2, B1.4, B3, MECHANIC, SHEET-METAL y HELPER (`20261023100000_passport_catalog.sql`). Runtime F3: 12 casillas; la principal marcada y deshabilitada | = (F3: antes ≠) | — | — | Hecho (N-01, T-30). Smoke `PKG passport 1`; `tests/db/passport.test.ts` (catalog) |
| 21 | Categoría principal | Conectado: `select` «Elige categoría» + las 12; la casilla de la principal queda deshabilitada. Elegir la opción vacía cuela `""` (C §3.15-7) | `select` «Categoría principal» con «Elige categoría» como opción deshabilitada (nunca cuela `""`); elegirla la marca entre las categorías y deshabilita su casilla (`ProfileForm.tsx`; `passport-form.ts withPrimary`; esquema `v.passport.primary.*`; CHECK `primary_category = any (categories)`) | = (F3: antes −) | — | — | Hecho (N-01, T-30). Smoke `PKG passport 1`; unit `passport-form.test.ts` |
| 22 | Aeronaves con experiencia | Demo: chips de AIRCRAFT (12): A320 Family, B737 NG, B737 MAX, ATR 72, Embraer E-Jets, A330, A350, B787, EC135/145, Cessna 172, Piper PA-28, Robinson R44 (`business.js:8`). Conectado: «Aeronaves (separadas por coma)», obligatorio, placeholder «A320, B737 NG» | Las 12 aeronaves de la demo como casillas «Aeronaves con experiencia» (`AIRCRAFT`; CHECK). Runtime F3: 12 casillas | = (F3: antes −) | — | — | Hecho (N-01, T-30). Smoke `PKG passport 1/2` |
| 23 | Habilitaciones de tipo | Demo: un panel por aeronave y una casilla «Habilitación {cat}» por cada categoría elegida, salvo Sheet Metal, NDT, Mecánico y Helper (`Professional2.jsx:81-94`). Conectado: bloque repetible con «Aeronave de habilitación N» (texto obligatorio), «Categoría de habilitación N» (12 opciones), «Vigencia…», «Documento…», «Restricciones…», «Añadir/Quitar habilitación» (máximo 40). Runtime v2 (conectado T1): 2 habilitaciones, «Documento de habilitación 1» con «Pendiente de vincular» / «Licencia_B1.1_A320_QA.pdf» (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). | Bloque repetible «Habilitaciones de tipo»: «Aeronave de habilitación N» (solo las aeronaves marcadas), «Categoría de habilitación N» (solo las licencias marcadas: B1.1…B3, Cat A, Cat C; nunca un oficio), «Vigencia… (si aplica)», «Restricciones…», «Quitar habilitación N», «Añadir habilitación» (máximo 40); una habilitación sobre una aeronave o categoría no marcada se rechaza antes de enviar y en la RPC (`ProfileForm.tsx`; `technician_type_ratings`, `20261023100100`; T-31). Sin selector de documento (fila 27) | ≈ (F3: antes ≠) | P3 (F3: antes P1) | — | Hecho (N-02). Smoke `PKG passport 2/3`; `tests/db/passport.test.ts` (save) |
| 24 | Vigencia de la habilitación | Opcional, «Vigencia {a} {c} (si aplica)»; error «Revisa la vigencia de habilitaciones.» | TR-* con caducidad opcional (`requires_expiry=false`). Las licencias la exigen (más estricto, V18-09) | = | — | — | Ver TEC-03 |
| 25 | Restricciones por habilitación | Demo: «Restricciones {a} {c}», placeholder «Sin restricciones declaradas». Conectado: «Restricciones de habilitación N». Runtime v2 (conectado T2): «Excluye motores CFM56»; la medalla dice «A320 · B1.1: Con restricciones» (`evidencias/v2/20/TEC-02-2-v18c-1440.aria.yml`). | «Restricciones de habilitación N», placeholder «Sin restricciones declaradas», ≤ 500; la medalla dice «{aeronave} · {categoría}: Con restricciones» con el texto en el detalle (solo al titular), y el matching no acepta una habilitación con restricciones para «Exigir habilitación de tipo» (BR-3.10, `src/domain/matching.ts`) | = (F3: antes −) | — | — | Hecho (N-02, T-31). Smoke `PKG passport 2/4`; `src/domain/matching.test.ts` |
| 26 | Restricciones generales | Conectado: «Restricciones generales de habilitación o alcance», textarea. Con texto, la confirmación de la candidatura se bloquea. Runtime v2 (conectado T2): «Sin certificación CRS en motores; tareas de motor solo bajo supervisión de un B1 (QA).» en rojo; la revisión administrativa se niega (`evidencias/v2/20/TEC-02-2-v18c-1440.aria.yml`; README del conectado). | «Restricciones generales de habilitación o alcance», textarea ≤ 2000 con la pista de minimización; con texto, la confirmación se rechaza (`CFA15`, trigger de `20261023900200_application_profile_guard.sql`; BR-13, T-87) y la tarjeta de candidato solo dice «Restricciones declaradas» | = (F3: antes −) | — | — | Hecho (N-02, T-31). `tests/db/matching-v18.test.ts`; smoke `PKG passport 6` |
| 27 | Evidencia por habilitación o curso | Demo: «Evidencia {a} {c}», `select` con «Pendiente de aportar» + documentos. Conectado: «Documento de habilitación N» con «Pendiente de vincular» + licencias | El vínculo se hace desde el documento, en el wallet (TEC-05, fila 16) | ≈ | P2 | — (v2: default v1.8; antes D-10: el vínculo con documentos propios no es acceso de terceros) | Opcional: elegir el documento desde la cualificación (N-02); ver TEC-03, fila 22 |
| 28 | «Abrir documentos» y pista | Conectado: botón «Abrir documentos», que sale sin guardar, y «Guarda el formulario antes de abrir otra sección. La insignia describe lo declarado; no concede autorización de firma. La confirmación exige el documento correspondiente revisado cuando la oferta requiere licencia.» | Con el flag del wallet, cada fila de Cualificaciones lleva el enlace «Abrir documentos» → `/app/professional/documents` (`src/features/qualifications/components/EvidenceLine.tsx:12-14`, es:591). Sin la pista de v1.8; sin flag (PROD) no aparece | ≈ (antes −) | P3 | D-10 (wallet en PROD) | Mantener (W2-11). La pista no hace falta: no hay formulario sin guardar que perder |
| 29 | Texto de habilitaciones | Demo: «La fecha es opcional cuando no aplique. No se inventa una vigencia. Las restricciones se comparten con el expediente.» | Pistas por tipo: «Déjalo vacío si la cualificación no caduca» o «{code} requiere fecha de caducidad» (es:619-620) | ≈ | — | — | — |
| 30 | Años de experiencia | Demo: number 0–60, error «Indica entre 0 y 60 años.». Conectado: «Años de experiencia declarados», 0–60, por defecto 0 | «Años de experiencia», number 0–60 entero; vacío → null; errores `v.years.*`, con otra redacción («Los años de experiencia deben ser como máximo 60»…) (`ProfileForm.tsx:116-126`; es:323-327) | ≈ (xhigh: antes =) | — | — | — |
| 31 | Idiomas / inglés técnico | Demo: «Inglés técnico», `select` A1, A2, B1, B2, C1, C2. Conectado: no hay | «Inglés técnico», `select` A1…C2 más «Sin indicar» (v1.8 no tiene vacío); afinidad del soft score (BR-5.6). Runtime F3 (delta): «C1» | ≈ (F3: antes −) | — | — | Hecho (N-05, T-32). Smoke `PKG passport 2` |
| 32 | Motores | Demo: chips de ENGINES (7): CFM56-5B/7B, LEAP-1A, LEAP-1B, PW1100G, PW127, Trent 700/1000, GE90 (`business.js:10`). Conectado: no hay | Los 7 motores de v1.8 como casillas «Motores» (`ENGINES`; CHECK). Runtime F3: 7 casillas | = (F3: antes −) | — | — | Hecho (N-05, T-32). Smoke `PKG passport 1` |
| 33 | Capacidades | Demo: chips de SKILLS (9): Line Maintenance, Base Maintenance, AOG Support, Troubleshooting, Engine Change, Sheet Metal, NDT, Boroscopia, Cabin Systems (`Professional2.jsx:9`). Conectado: «Capacidades (separadas por coma)» | Las 9 capacidades como casillas «Capacidades» (`SKILLS`, traducidas en `passport.skills.*`; «Boroscopia» = `borescope`). Runtime F3: 9 casillas | = (F3: antes ≠) | — | — | Hecho (N-05, T-32). Smoke `PKG passport 1` |
| 34 | Cursos | Demo: casillas de COURSES (Human Factors, EWIS, FTS, SMS); cada una pide «Vigencia {c}» y «Evidencia {c}» (`business.js:9`). Conectado: repetible «Nombre del curso N» (libre) + «Vigencia curso N» obligatoria + «Evidencia curso N», máximo 40 | TRAINING: HF, EWIS, FTS y SMS con caducidad obligatoria (`20261009120100…:18-21`) | = | — | — | Mantener (TD-36) |
| 35 | Error de curso sin fecha | «Indica la vigencia de cada curso.» | «Esta cualificación requiere fecha de caducidad» (es:340) | ≈ | — | — | — |
| 36 | Aviso de cursos | Demo: «Aportar evidencia no equivale a verificación. La vigencia declarada debe cubrir el período completo de la oferta.». Conectado: «Usa los nombres que pide la oferta, por ejemplo Human Factors, EWIS o FTS. Al confirmar se exige evidencia revisada de cada curso obligatorio.» | Descripción de Cualificaciones: «…Un curso debe seguir vigente hasta el último día de una necesidad para superar su filtro obligatorio.» (es:596) | ≈ | — | — | — |
| 37 | Tarifa mínima | Demo: «Tarifa mínima», number ≥ 0,01, más «Unidad de tarifa» «EUR / día» o «EUR / hora»; al guardar, `dailyRate = minRate × 8` si es por hora; error «La tarifa debe ser positiva.». Conectado: «Tarifa mínima EUR/h», 1–2000, paso 0,01. Runtime v2 (conectado T1): «Tarifa mínima EUR/h» (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). | «Tarifa mínima» (number ≥ 0,01, paso 0,01) + «Unidad de tarifa» «EUR / hora» / «EUR / día», solo para el titular salvo en la copia del expediente de una candidatura (T-33, BR-25); no se deriva `dailyRate = minRate × 8`. Runtime F3 (delta): «45» · «EUR / hora» | ≈ (F3: antes −) | — | — (v2: desbloqueado, alcance LATER `V1_SCOPE.md:64`; default v1.8 de OD-7 sin dinero real) | Hecho (N-06, T-33). Smoke `PKG passport 2` |
| 38 | Movilización | Demo: «Movilización mínima (horas)», 0–168, por defecto 8; error «Indica entre 0 y 168 horas de movilización.», que no sale junto al campo (H-16). Conectado: «Horas mínimas que necesitas para movilizarte», 0–720 | «Horas mínimas que necesitas para movilizarte» (0–720, como el conectado) en Configuración › «Avisos de oportunidades» (`src/features/outreach/components/NoticePreferencesForm.tsx`; PKG outreach, N-10), no en el pasaporte | ≈ (F3: antes −) | — | — (v2: desbloqueado, alcance LATER `V1_SCOPE.md:61`) | Hecho en el paquete outreach (N-10, T-120…T-129); ver ACC-03 (área 10) |
| 39 | Desplazamientos | Demo: interruptor «Acepto desplazamientos». Conectado: no hay | «Movilidad», `select`: «Local (solo base habitual)», «Nacional», «Internacional» (`ProfileForm.tsx:136-144`; es:440-444) | + | — | — | Mantener (TD-39, más rico) |
| 40 | Herramientas propias | Demo: interruptor «Tengo herramientas propias» | Casilla «Tengo herramientas propias» (`own_tools`; `ProfileForm.tsx`) | = (F3: antes −) | — | — | Hecho (N-05, T-32) |
| 41 | Permisos de trabajo | Demo: chips «Permiso de trabajo declarado» (5): España, Portugal, Francia, Alemania, Reino Unido (`Professional2.jsx:8`). Conectado: «Permisos de trabajo declarados», 27 casillas de la UE (`server/rules.mjs:1`): Austria, Bélgica, Bulgaria, Croacia, Chipre, Chequia, Dinamarca, Estonia, Finlandia, Francia, Alemania, Grecia, Hungría, Irlanda, Italia, Letonia, Lituania, Luxemburgo, Malta, Países Bajos, Polonia, Portugal, Rumanía, Eslovaquia, Eslovenia, España, Suecia. Runtime v2 (conectado T1): las 27 casillas (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). `eligible()` exige el permiso del país de la oferta: «Falta declarar permiso de trabajo para el país.» (`server/rules.mjs:27`). | Las 27 casillas de la UE «Permisos de trabajo declarados» (`EU_COUNTRIES`, nombres con `Intl.DisplayNames` en el servidor), y el matching exige el permiso del país de la necesidad (BR-3.7 `work_permit`, `src/domain/matching.ts`; `20261023900100`). Runtime F3: 27 casillas | = (F3: antes −) | — | — | Hecho (N-07, T-34). Smoke `PKG passport 1/2`; `src/domain/matching.test.ts` |
| 42 | Texto del paso 4 | Demo: «El calendario publica fechas elegidas. Un día libre no se ofrece automáticamente.». El paso no tiene campos de disponibilidad (H-17) | Descripción de Disponibilidad: «Un día libre solo entra en el mercado cuando lo marcas como disponible.…» (es:631) | ≈ | — | — | — |
| 43 | Resumen (paso 5) | h2 con el nombre o «Perfil pendiente»; «{categorías} · {base}» o «Categorías pendientes»; métricas «Datos completados», «Tarifa mínima» («por hora»/«por día») y «Evidencia real» con «Verificación pendiente»; aviso «El porcentaje mide datos cumplimentados. No certifica cualificación, evidencia ni verificación.» (`Professional2.jsx:110`) | No existe como paso. Lo que resumía está repartido: nombre y medallas en el pasaporte visual (fila 13), «{%} completado · {n} evidencias» en la cabecera (fila 5) y la lista de apartados en «Estado de mi perfil» (TEC-01, fila 11); solo la métrica «Tarifa mínima» no se resume en ningún sitio | − | P3 | — | No portar (sin asistente, T-163): solo repetiría lo que la página ya enseña |
| 44 | Situación actual | No existe | «Situación actual»: «En plantilla», «Contractor», «Entre contratos» (`ProfileForm.tsx:127-135`; es:445-449) | + | — | — | Mantener |
| 45 | Visibilidad en el formulario | En v1.8 está en Privacidad (demo) o es una casilla del pasaporte (conectado) | Panel «03 · Visibilidad en la red» (`ProfileForm.tsx:148-184`) | ≈ | — | — | Ver TEC-07 |
| 46 | Intervalos con horas en el pasaporte | Conectado: `<details>` «Intervalos de disponibilidad con horas concretas (UTC)» (`Account.jsx:62`) | En la página de Disponibilidad (TEC-04, filas 55-59) | ≈ | — | — | — |
| 47 | Avisos, silencio y bloqueos en el pasaporte | Conectado: «Avisos de oportunidades», silencio, zona y bloqueos (`Account.jsx:62,81`) | Bloqueos en el panel «05 · Visibilidad en la red» («Organizaciones bloqueadas», fila 18 de TEC-07); avisos, silencio y zona en Configuración › «Avisos de oportunidades» (PKG outreach, N-10) | ≈ (F3: antes −) | — | — | Hecho (N-08 en el pasaporte, N-10 en Configuración); ver TEC-07 |
| 48 | Campos que reinician la revisión | Conectado: cambiar nombre, categoría, aeronaves, países, restricciones, cursos, capacidades, años, categorías o habilitaciones → `review` vuelve a `pending` (V18-07) | Solo las fechas de una cualificación (BR-2.8). El perfil no tiene revisión | ≈ | — | — | Ver TEC-03, fila 14 |
| 49 | Diseño a 390 px | Demo: pasos en 3 filas, campos a una columna, «Siguiente» debajo (§2.M). Conectado: una columna | Paneles a una columna (`md:grid-cols-2/4`), casillas en 2 columnas; sin scroll horizontal a 390 px (F3, `docs/audit/evidence/parity/P02/P02-passport-after-390.jpg`) | ≈ | — | — | Mantener |
| 50 (nueva v2) | Fallo de red al guardar el pasaporte | Conectado: `run()` captura el error y lo pinta bajo la cabecera; el formulario se conserva (`src/beta/Account.jsx:31`). Demo: guarda en local | X-02: `callAction` convierte el fallo en un resultado y el `Notice` dice «Se ha perdido la conexión. Tus cambios siguen aquí; comprueba la conexión y reintenta.» (`ProfileForm.tsx:62`; `src/components/ui/Notice.tsx:60-92`; es:223). Runtime v2: base editada y «Guardar cambios» sin conexión → aviso, sin límite de error, el campo conserva el texto; 1 POST abortado (`evidencias/v2/20/TEC-02-2-next-1440.jpg`, `TEC-04-9-next-1440.txt`) | ≈ | — | — | Mantener (X-02, `1c2616c`) |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-02-pasaporte-1440.png`, `D-TEC-02-pasaporte-390.png`,
  `D-TEC-02b-pasaporte-cualificaciones-1440.png`, `D-TEC-02c-pasaporte-experiencia-1440.png`,
  `D-TEC-02d-pasaporte-disponibilidad-1440.png`, `D-TEC-02e-pasaporte-resumen-1440.png`,
  `D-TEC-02f-pasaporte-validacion-1440.png`, `D-TEC-02g-pasaporte-validacion2-1440.png`,
  `D-TEC-02h-pasaporte-guardado-1440.png`, `D-TEC-02j-modal-perfil-vacio-1440.png`,
  `D-TEC-02k-pasaporte-borrador-vacio-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-02-profile-empty-1440.png`, `C-TEC-12-profile-rating-course-open-1440.png`,
  `C-TEC-13-profile-filled-1440.png`, `C-TEC-13-profile-saved-1440.png`, `C-TEC-13-profile-390.png`,
  `C-TEC-25-profile-linked-1440.png`, `C-TEC2-01-profile-filled-1440.png`, `C-TEC2-04-profile-conflict-1440.png`.
- Next: `docs/audit/evidence/v18-compare/next-after/tech-passport-{1440,390}.jpg` (lote 11; la de 1440 es idéntica a
  `next-before`) y `docs/audit/evidence/local-10-passport-{1440,768,390}.jpg` (`108a244`, lote 13).
- xhigh (22/10): `evidencias/xhigh/20/TEC-02-1-{next,v18}-{1440,390}.*`.
- v2: Next `evidencias/v2/20/TEC-02-1-next-{1440,390}.*`, `TEC-02-2-next-1440.*` (sin conexión); demo `TEC-02-1-v18-1440.*`; conectado `TEC-02-1-v18c-{1440,390}.*` (T1) y `TEC-02-2-v18c-1440.*` (T2, restricciones).
- F3 / P02 (26/10): `docs/audit/evidence/parity/P02/P02-passport-after-{1440,390}.jpg`, `P02-passport-after-1440-en.jpg`, `P02-passport-draft-after-1440.jpg` (tras «Preparar borrador»), `P02-passport-dialog-after-1440.jpg` («Empezar desde cero»).

---

## TEC-03 · Cualificaciones y verificación — v1.8 `S-TEC-02b, S-TEC-02c, S-TEC-02f, S-CON-03, S-CON-13b, C-TEC-12/25` ↔ Next `N-PRO-03, N-ADM-01, N-PRO-01 (Próximos pasos)`

**Estado global:** PARCIAL.
- **v1.8:** no exige verificación para encontrar trabajo; el conectado revisa el perfil entero y solo pide la revisión al
  confirmar.
- **Next:** declara cada cualificación por separado, con un estado de verificación que exigen los requisitos obligatorios
  (C-3). Es más fino y más seguro.
- **Consecuencia en PROD:** con OD-3 sin decidir y la revisión apagada, ninguna cualificación puede verificarse y ningún
  técnico externo es elegible.
- **v2:** restricciones, habilitación ligada a la categoría y catálogo ampliado pasan a default v1.8 (antes C-10/D-02/D-03).
  OD-3 sigue bloqueando la activación en PROD (y con M07/M08 eso impide también presentar candidatura). El foco tras
  «Sí, quitarla» ya va al aviso del resultado (X-08).
- **F3 (P02, 2026-10-26):** restricciones, habilitación aeronave × licencia y catálogo ampliado están hechos (paquete
  passport, filas 2, 20 y 21); los estados de la demo viven en las medallas (fila 12). En LOCAL la revisión funciona con el
  flag (`gate.sh` lo activa; smoke 20-21). Quedan OD-3 (PROD, filas 15-16) y D-10 (documentos, filas 22-23 y 27).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cómo se declara | Demo: dentro del pasaporte, en borrador (`Professional2.jsx:81-108`). Conectado: dentro de `profile.save` (`server/app.mjs:62-76`) | Las declaraciones (categorías, aeronaves, habilitaciones, restricciones) van dentro del pasaporte, como en v1.8 (`ProfileForm.tsx`); el catálogo verificable (licencias, type ratings, cursos, habilitaciones, capacidades) tiene página propia, una declaración por tipo (`src/features/qualifications/components/QualificationsManager.tsx`) | ≈ (F3: antes ≠) | P3 | — | Mantener. Smoke `PKG passport 1`, pasos 5j/6 |
| 2 | Catálogo | Demo: constantes (`business.js:7-10`). Conectado: categoría en `select` de 12; aeronaves, cursos y capacidades en texto libre | 23 tipos en BD (los 17 más B1.2, B1.4, B3, MECHANIC, SHEET-METAL y HELPER, `20261023100000`) agrupados con `optgroup`, y en el pasaporte los 12 CATEGORIES, 12 AIRCRAFT y 9 SKILLS de la demo como casillas (TEC-02, filas 20-23 y 31-33) | ≈ (F3: antes ≠) | P3 (F3: antes P1) | — | Hecho (N-01, N-02, N-05). `tests/db/passport.test.ts` (catalog) |
| 3 | Nombres del catálogo | En español o códigos de la industria | En inglés en la BD («Type rating — Airbus A320 family», «Electrical Wiring Interconnection System»…), sin traducir (NX-12; es:949) | ≈ | P3 | — | Mantener (convención aeronáutica documentada) |
| 4 | Declarar | Conectado: «Añadir habilitación» y «Añadir curso», sin tipo cerrado | «Declarar», `select` «Selecciona del catálogo…» con los tipos aún no declarados; si no quedan: «Has declarado todos los tipos del catálogo.» (`QualificationsManager.tsx:224-271`; es:600-617) | ≈ | — | — | — |
| 5 | Fecha de emisión | No existe | «Emisión» (date) y la regla «La caducidad no puede ser anterior a la emisión» (es:607, 339) | + | — | — | Mantener |
| 6 | Caducidad | Demo: opcional en habilitaciones, obligatoria en cursos. Conectado: igual (`Account.jsx:62,76`) | Según `requires_expiry`: obligatoria en LICENSE, TRAINING y APPROVAL; opcional en TYPE_RATING y SKILL. Pistas «{code} requiere fecha de caducidad» / «Déjalo vacío si la cualificación no caduca» (es:619-620; BR-2.7) | ≈ | — | — | Mantener (V18-09: más estricto en licencias) |
| 7 | Validez por periodo | Demo: el matching exige vigencia hasta `endDate`; la medalla marca «Revisar vigencia» si ya pasó. Conectado: `!expires \|\| expires >= end` | `validityForPeriod`: caducada, caduca durante o válida, siempre contra el periodo (`src/domain/qualification.ts:44-55`; BR-2.3/2.4) | = | — | — | — |
| 8 | Tenencia | No existe: desmarcar equivale a borrar | «Vigencia»: «Activa» / «Retirada (no la posees)»; chips «Vigente» / «Retirada» (`QualificationsManager.tsx:201-205,328-330`; es:609-611, 422-425) | + | — | — | Mantener |
| 9 | Quitar | Demo: desmarcar en el borrador (reversible hasta guardar). Conectado: «Quitar habilitación» / «Quitar curso» dentro del formulario sin guardar | «Quitar» pide confirmación: el primer clic muestra «Sí, quitarla» / «Cancelar», con el foco en «Cancelar», y solo «Sí, quitarla» borra → «{code} eliminada.» (`QualificationsManager.tsx:346-357`; `src/components/ui/ConfirmButton.tsx:11-75`; es:593, 616). Runtime: «Quitar» → foco en «Cancelar»; «Cancelar» → foco de vuelta en «Quitar» (`evidencias/xhigh/20/TEC-04-5-next-interact-1440.txt`). Tras «Sí, quitarla» el foco ya no se pierde: el `Notice` del resultado lo toma si estaba en `<body>` (X-08, `src/components/ui/Notice.tsx:32-41`). Runtime v2 con la acción abortada: «Quitar» → foco en «Cancelar»; «Sí, quitarla» → foco en el aviso `P[role=alert]` «Se ha perdido la conexión…»; nada se borró (`evidencias/v2/20/TEC-04-9-next-1440.txt`). El camino con éxito, solo en código (`4357034`) | ≈ (antes ≠) | — (v2: antes P3) | — | Mantener (W1-10; foco: X-08, B-13 HECHO) |
| 10 | Editar | Dentro del formulario | Panel «Editar {code}» con Emisión, Caducidad y Vigencia; «Guardar» / «Cancelar» (`QualificationsManager.tsx:173-222`) | ≈ | — | — | — |
| 11 | Tipo inmutable | No aplica | Para cambiar el tipo, quitar y declarar de nuevo (BR-2.8) | + | — | — | — |
| 12 | Estados que ve el técnico | Demo, documentos: «Autodeclarado» (semilla) y «Pendiente» (subidos). Demo, medallas: «Declarado», «Tipo declarado», «Con restricciones», «Revisar vigencia» (`src/features/progress.js:3-11`). Conectado, perfil: «Pendiente» / «Revisión registrada» (`Account.jsx:15`) | Por cualificación: «Verificada» (ok), «Verificación pendiente» (warn), «Rechazada» (danger) y «Caducada» (es `domain.verification.*`); y en las medallas del pasaporte los estados literales de la demo — «Declarado», «Tipo declarado», «Con restricciones», «Revisar vigencia», «Experiencia declarada» — más «Verificada» cuando un revisor verificó ese código (BR-29.4) (`src/domain/badges.ts`; es `badges.status.*`). Runtime F3 (delta): «B1.1: Verificada», «B2: Declarado», «A320 Family · B1.1: Tipo declarado», «12 años: Experiencia declarada» | ≈ (F3: antes ≠) | — | — | Mantener (TD-45, más fuerte). `src/domain/badges.test.ts`; smoke `PKG shell-visual 2`, `PKG P02 1` |
| 13 | Qué se revisa | Conectado: un único `review` para todo el perfil (`server/app.mjs:73-75`) | Cada cualificación (BR-2.6) | + | — | — | — |
| 14 | Qué devuelve a «pendiente» | Conectado: cambiar nombre, categoría, aeronaves, países, restricciones, cursos, capacidades, años, categorías o habilitaciones (V18-07; `app.mjs:74-75`) | Cambiar las fechas (trigger, REV:73-90); retirar o reactivar no. Avisos «Cambiar las fechas la devuelve a verificación pendiente.» y «{code} actualizada: vuelve a verificación pendiente porque han cambiado sus fechas.» (es:604, 615) | ≈ | — | — | — |
| 15 | Quién revisa | Conectado: un administrador, en «Revisión administrativa», con «Evidencia / observaciones de la revisión» (`Account.jsx:74`, S-CON-13b). Demo: nadie | Un `platform_admin` en `/app/admin/verifications` (N-ADM-01), tras el flag `qualification_review` (BD) + `QUALIFICATION_REVIEW_ENABLED` (servidor). LOCAL F3: con el flag activo la función `qualification-reviews` sirve y la revisión funciona (smoke 20-21f: platform.admin rechaza con motivo y verifica la B1.1 de golf, luego se restaura). PROD: flag apagado y función no desplegada (`memory-bank/01-current-state.md` §OD-3) | ≈ | P1 | OD-3 (activación en PROD) | Local verificado (smoke 20/21); la activación en PROD sigue en OD-3 |
| 16 | Efecto en el matching | Demo: no exige verificación. Conectado: la elegibilidad no mira `review`; la **confirmación** exige `review==='reviewed'` y documentos revisados (V18-26) | Los requisitos obligatorios solo aceptan `verified` (C-3; `src/domain/matching.ts`), y con M07/M08 presentar y confirmar exigen ser elegible. LOCAL F3: con la revisión activa, delta (verificada en la semilla) es elegible y la cadena revisar → elegible → candidatura se prueba (smoke 21, `PKG passport 6`, hiring). En PROD nadie puede verificar: ningún técnico externo cumple una necesidad ni puede presentarse | ≠ | P0 | OD-3 (activación en PROD) | Desbloquear OD-3 (procedimiento y lista de revisores) y desplegar `qualification-reviews`. No portar la permisividad de v1.8 |
| 17 | Motivo de rechazo | Conectado: el técnico no ve la nota, solo `labels[p.review]` | «Revisor: {motivo}» en la fila (`QualificationsManager.tsx:322-326`; es:625). Runtime v2: oscar tiene una rechazada sin nota en la semilla, así que solo se ve el chip «Rechazada»; la línea «Revisor:», solo en código (`evidencias/v2/20/TEC-03-5-next-1440.txt`). | + | — | — | Mantener |
| 18 | Aviso de pendientes en el inicio | — | Panel «Próximos pasos» en Mi espacio (`page.tsx:154-172`) | + | — | — | Mantener |
| 19 | Chip de caducidad | Demo: medalla con clase `expired` y `documentStatus` en los documentos | «Caduca pronto» (≤ 45 días) o «Caducado», solo en las activas (`QualificationsManager.tsx:309-319`; BR-12) | = | — | — | — |
| 20 | Restricciones | Demo y conectado: por habilitación y generales. La medalla dice «Con restricciones». `eligible` exige no tener restricciones si la oferta pide licencia (V18-08) | Por habilitación («Restricciones de habilitación N») y generales (textarea); la medalla dice «Con restricciones» con el texto en su detalle; `matching.ts` (BR-3.10) rechaza la habilitación con restricciones y las generales bloquean la confirmación (`CFA15`, T-87) (TEC-02, filas 25-26) | = (F3: antes −) | — | — | Hecho (N-02, T-31). Smoke `PKG passport 2/4/6`; `src/domain/matching.test.ts` |
| 21 | Habilitación ligada a la licencia | La habilitación es aeronave × categoría (`Professional2.jsx:81-94`; `Account.jsx:62`) | Habilitación = aeronave × categoría de licencia declarada (`technician_type_ratings`, UNIQUE (perfil, aeronave, categoría); solo B1.1…B3, Cat A y Cat C, nunca un oficio), sobre una aeronave y una categoría marcadas (TEC-02, fila 23). Los TR-* del catálogo verificable siguen aparte para el matching (BR-2/BR-3) | = (F3: antes ≠) | — | — | Hecho (N-02, T-31). `tests/db/passport.test.ts` (save) |
| 22 | Documento vinculado | Demo: «Evidencia {a} {c}» y «Evidencia {curso}». Conectado: «Documento de habilitación N» y «Evidencia curso N», con la propiedad comprobada en el servidor (V18-29) | El vínculo se sigue eligiendo desde el documento, en el wallet: «Vincular a una cualificación (opcional)» (`src/features/documents/components/DocumentWallet.tsx:251-269`; es:1214-1216). Con el flag del wallet, cada fila de cualificación muestra ahora «Evidencia: {títulos}» o «Sin documento vinculado» + «Abrir documentos» (`src/features/qualifications/components/EvidenceLine.tsx:7-17`; `src/app/app/professional/qualifications/page.tsx:32-39`; `src/features/documents/api.ts:65-75`; es:589-591). Sin flag no se consulta nada | ≈ | P3 | D-10 (wallet en PROD) | Mantener (W2-11). Elegir el documento desde la cualificación, si se quiere, con D-10 |
| 23 | Evidencia exigida al confirmar | Conectado: licencia vinculada y revisada si la oferta pide licencia; evidencia revisada de cada curso obligatorio | La confirmación (M08) vuelve a comprobar, bajo bloqueo, las cualificaciones obligatorias verificadas y la disponibilidad (CFA03/CFA04), más solapes y plazas; no pide documentos (`supabase/migrations/20261022130300_applications.sql:679-682,829-861`) | ≈ (v2: antes −) | P3 (v2: antes P2) | D-10 (documentos revisados; v2: antes D-06/D-07) | Mantener: «verificada» ya exige la revisión de la cualificación; la evidencia documental, con D-10 |
| 24 | Cabecera de la página | — | Kicker «Mi pasaporte», h1 «Cualificaciones», descripción e introducción con `<b>pendientes</b>` mediante `t.rich` (es:594-602; `QualificationsManager.tsx:226`) | + | — | — | — |
| 25 | Lista y vacío | — | Un panel por categoría, «{Categoría} ({n})». Vacío: «Aún no hay cualificaciones. Declara arriba tu licencia y tus type ratings; entran en el matching cuando se verifican.» (es:618, 624) | + | — | — | — |
| 26 | Errores | Conectado: «Selecciona de una a doce categorías.», «Máximo cuarenta habilitaciones.», «Habilitación no válida.» y «{Etiqueta}: dato no válido.» (`server/connected.mjs:4-11`) | «Selecciona una cualificación del catálogo», «Introduce una fecha (AAAA-MM-DD)», «La caducidad no puede ser anterior a la emisión», «Esta cualificación requiere fecha de caducidad». Un id inválido da «Cualificación no válida.» (`v.form.qualification`; `src/features/qualifications/actions.ts:36,44`; es:347) y un mensaje crudo del servidor ya no llega a la pantalla (`src/components/ui/Notice.tsx:100-130`) | ≈ | — | — | Mantener (W1-04) |
| 27 | Revisión de documentos | Conectado: el administrador analiza (cuarentena → limpio o bloqueado) y revisa | `scan_status` siempre es `not_scanned` y no hay revisión de documentos | − | P2 | D-10 | Ver TEC-05 |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-02b-pasaporte-cualificaciones-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-12-profile-rating-course-open-1440.png`, `C-TEC-25-profile-linked-1440.png`.
- Next: `docs/audit/evidence/local-12-qualifications-{1440,768,390}.jpg` y
  `local-16-qualifications-es-{1440,768,390}.jpg` (`108a244`, lote 13); `local-13-qualification-declared.jpg`;
  `local-22-verifications-{1440,768,390}.jpg` (`7f7235a`).
- xhigh (22/10): `evidencias/xhigh/20/TEC-03-1-next-{1440,390}.*`, `TEC-03-2-next-1440.*` (error de «Declarar» sin tipo),
  `TEC-03-3-confirmfocus-harness.txt` (foco tras confirmar).
- v2: Next `evidencias/v2/20/TEC-03-1-next-{1440,390}.*` (alpha), `TEC-03-4-next-1440.*` (echo, pendiente), `TEC-03-5-next-1440.*` (oscar, rechazada); interacciones en `TEC-04-9-next-1440.txt`.
- F3 / P02 (26/10): `docs/audit/evidence/parity/P02/P02-qualifications-after-1440.jpg` (delta, 5 verificadas con «Abrir documentos»).

---

## TEC-04 · Disponibilidad — v1.8 `S-TEC-03, S-TEC-03a, S-MOD-TEC-03, D-TEC-03, S-CON-02, S-CON-02a, S-CON-02b, S-CON-03a, C-TEC-03/14/15/16/17/18/34` ↔ Next `N-PRO-04, N-PRO-01 (mini calendario)`

**Estado global:** PARCIAL por una sola fila (F3, 2026-10-26, P03): coinciden con v1.8 los 14 patrones, el ciclo libre de hasta
31 días, la base 7–3/7–4, la generación del mes visible, la publicación de descansos, «reemplazar», el pintado por días, los
días parciales, «Solo AOG», el kicker «Tu calendario» y la protección de los días de una asignación confirmada (BR-4.9, T-15:
deshabilitados, saltados por el generador y 409 en el servidor).

Next añade:
- deshacer paso a paso;
- KPIs;
- intervalos con horas y estado;
- el mes en la URL;
- el suelo de fecha del inicio también en el servidor (N-26, T-104).

Le falta o difiere (F3, P03; antes v2, `038329f`):
- «Solo AOG» no exige un consentimiento aparte: marcar el día ya es el consentimiento (fila 53; decisión del owner C-8/D-05,
  TD-65). Es la única fila `≠` que queda;
- el modal de revisión y el «deshacer tras guardar» de la demo (filas 29 y 31: patrón del conectado, `≈`);
- el control de versión está implementado y probado en local (fila 50); se despliega con el resto de la rama (F5);
- resueltos en el bucle (v2): la vista previa avisa cuando no genera ningún día (X-15) y un fallo de red conserva la página y el
  borrador (X-02) (filas 62-63); resueltos en F3 por el paquete calendar (`20261023300000`, T-15 sustituye a T-13): filas 26, 43
  y 52.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | Demo: `#calendar` «Disponibilidad», dock «Calendario». Conectado: `#calendar` | `/app/professional/availability` con `?month=` (`AppShell.tsx`); menú «Disponibilidad» y, bajo `lg`, el dock de v1.8 con «Calendario» marcado como actual (T-141, `src/components/layout/MobileDock.tsx`). Runtime F3: `PKG P03 7` | ≈ | — | — (v2: el dock va en SH-05, área 10) | — |
| 2 | Sin perfil | Conectado: «Primero, tu perfil» + «Guarda el pasaporte profesional para disponer de tu calendario conectado.» + «Completar perfil» (`src/beta/ConnectedCalendar.jsx:11`) | El perfil técnico se crea al registrarse (`handle_new_user`). Una cuenta de organización ve «Sin perfil profesional» (`src/app/app/professional/availability/page.tsx:26-33`). Runtime v2 con `admin.mro` (en): «No professional profile» (`evidencias/v2/20/TEC-04-7-next-1440.txt`). Runtime F3: la URL directa da la misma pantalla y la función responde FORBIDDEN al PUT y una lista vacía al GET (`PKG P03 6`) | ≈ | — | — | — |
| 3 | Kicker | Demo «TU CALENDARIO». Conectado «DISPONIBILIDAD CONECTADA» | «Tu calendario» (es `availability.eyebrow`; en «Your calendar»), en mayúsculas por CSS como todos los kickers (`PageHeader`) | = (F3: antes ≈) | — (F3: antes P3) | — | Hecho (P03-01, `17-parity-matrix-v18.md`). Smoke `PKG P03 1b`; captura `docs/audit/evidence/parity/P03/P03-availability-after-1440.jpg` |
| 4 | h1 | «Tu tiempo, a tu manera.» en ambos modos | «Tu tiempo, a tu manera.» (es:630) | = (antes ≠) | — | — | Mantener (W2-09) |
| 5 | Descripción | Demo: «Define trabajo y descanso; publica únicamente las fechas en las que quieres recibir oportunidades.». Conectado: «Solo «Disponible» y «Solo AOG» publican intervalos; trabajo y descanso son privados.» | «Un día libre solo entra en el mercado cuando lo marcas como disponible. Las horas son UTC; las ventanas bloqueadas prevalecen sobre las disponibles.» (es:631) | ≈ | — | — | — |
| 6 | KPIs del mes | — | «Disponibles», «Bloqueados» y «Solo AOG» del mes visible; «Ventanas», total guardado (`src/features/availability/components/AvailabilityManager.tsx:307-330`; es:633-642) | + | — | — | Mantener |
| 7 | Panel del ciclo | Demo «Elige tu ciclo». Conectado «Planifica el ciclo» | «Planifica tu ciclo» (es:684) | ≈ | — | — | — |
| 8 | Patrones (lista exacta) | 14, en este orden: `7x3`, `7x4`, `5x2`, `7x3/7x4`, `6x4`, `5x5`, `4x4`, `10x10`, `15x15`, `Personalizado`, `2D2N4OFF`, `Noche`, `Partido`, `Flexible` (`src/features/planning.js:1`) | 14, mismo orden: `7x3`, `7x4`, `5x2`, `7x3/7x4`, `6x4`, `5x5`, `4x4`, `10x10`, `15x15`, `custom`, `2D2N4OFF`, `night`, `split`, `flexible` (`src/domain/availability.ts:11-26`; CHECK ROT:15-16) | = | — | — | — |
| 9 | Etiquetas de los patrones 1-10 | «7–3», «7–4», «5–2», «7–3 / 7–4 alterno», «6–4», «5–5», «4–4», «10–10», «15–15», «Otro · ciclo personalizado» (`planning.js:2`) | Idénticas (es:698-707) | = | — | — | — |
| 10 | Etiquetas de los patrones 11-14 | «2D2N4OFF», «Noche», «Partido», «Flexible», sin explicar que son 4T+4D, 5T+2D, 5T+2D y todo descanso (C §4.6-5) | «2 días, 2 noches, 4 libres», «Noches (5 de trabajo, 2 libres)», «Turno partido (5 de trabajo, 2 libres)», «Flexible (solo descanso)» (es:708-711) | + | — | — | Mantener |
| 11 | Semántica del ciclo | `cycleStates`: Personalizado 1–31; Flexible `['off']`; Noche y Partido 5W+2O; 2D2N4OFF 4W+4O; `AxB[/CxD]` en bloques alternos, cada uno de 1 a 31 y en total ≤ 31 (`planning.js:3-11`) | Misma tabla (`src/features/availability/rotation.ts:35-55`). No valida cada bloque por separado (la lista es cerrada) | = | — | — | — |
| 12 | Patrón por defecto | Demo: el guardado o `4x4` (`src/features/AvailabilityPlanner.jsx:10`). Conectado: el guardado o `7x3` (`ConnectedCalendar.jsx:8`) | El guardado o `7x3` (`src/features/availability/components/CyclePlanner.tsx:36`) | = | — | — | Igual al conectado |
| 13 | Se guarda el patrón | Demo: `shiftPattern`, `shiftAnchor` y `customCycle` al aplicar. Conectado: `rotation` dentro de `availability.save` | `availability_rotations`, al guardar el borrador (`AvailabilityManager.tsx:206-210,219-229`) | = | — | — | — |
| 14 | Día 1 | Demo: «Día 1 del ciclo» (fecha de Madrid). Conectado: «Día 1 del ciclo (UTC)». Por defecto, hoy | «Día 1 del ciclo (UTC)» con la pista «El primer día de trabajo de tu rotación.» (`CyclePlanner.tsx:73-83`; es:686-687) | = | — | — | — |
| 15 | Error de día 1 | Demo «Indica una fecha válida de inicio del ciclo.»; `cycleDay` «Selecciona fechas válidas.» | «Elige un día 1 válido.» (es:724) | ≈ | — | — | — |
| 16 | Explicación del ciclo | Demo: «El primer número son días de trabajo; el segundo, de descanso. 7–3 / 7–4 alterna 7 de trabajo, 3 de descanso, 7 de trabajo y 4 de descanso. El ciclo se repite desde la fecha elegida.». Conectado: «7–3 / 7–4 alterna 7 de trabajo, 3 libres, 7 de trabajo y 4 libres. Se generan días completos UTC: revisa las horas si tu jornada usa otra zona. Los intervalos parciales existentes fuera de las fechas editadas se conservan.» | El texto del conectado + «Los días de trabajo se guardan como bloqueados; los descansos son privados salvo que los publiques. Los intervalos parciales de los días que no reemplazas se conservan.» (es:696) | ≈ | — | — | — |
| 17 | Ciclo libre: título | Demo: h3 «Diseña hasta 31 días» | Sin título. El grupo lleva `aria-label` «Días del ciclo personalizado (pulsa para alternar trabajo / descanso)» (es:690) | ≈ | P3 | — | — |
| 18 | Ciclo libre: longitud | «Días del ciclo», number 1–31, por defecto 14 | Igual (`CyclePlanner.tsx:88-105`) | = | — | — | — |
| 19 | Ciclo libre: validación | Demo: fuera de rango no cambia nada y al previsualizar sale «Elige una longitud de 1 a 31 días.». Conectado: «Elige entre 1 y 31 días.» al generar | Error en el campo, «Elige entre 1 y 31 días.», y botón deshabilitado (`CyclePlanner.tsx:91,176`) | + | — | — | — |
| 20 | Ciclo libre: casillas | Demo: «{n}» + «Trabajo»/«Descanso»; `aria-label` «Día N del ciclo: {Trabajo}»; `aria-pressed`; por defecto 7 de trabajo y 7 de descanso. Conectado: `aria-label` «Día N: {Trabajo}»; por defecto 14 de descanso | «{n}» + «Trab.»/«Desc.»; `aria-label` «Día N: trabajo\|descanso»; `aria-pressed`; por defecto 14 de descanso (`CyclePlanner.tsx:118-140`; es:691, 713-719) | ≈ | P3 | — | — |
| 21 | Ciclo libre: ayuda | Demo: «Pulsa cada casilla para alternar trabajo y descanso. Puedes dibujar cualquier distribución y repetirla, aunque no sea un bloque regular.» | «Pulsa cada casilla para alternar trabajo y descanso. Puedes dibujar cualquier distribución y repetirla, aunque no sea un bloque regular.», sobre las casillas del ciclo personalizado (`CyclePlanner.tsx:117`, es:689) | = (antes −) | — | — | Mantener (W2-09) |
| 22 | «Usar 7–3 / 7–4 como base» | Solo en la demo; crea 21 días (`AvailabilityPlanner.jsx:15`) | Igual (`CyclePlanner.tsx:107-116`; TD-59) | = | — | — | — |
| 23 | Publicar descansos | Demo: «Publicar los descansos generados como días disponibles» + «Si no lo activas, se guardan como descanso privado. No se envían candidaturas automáticamente.». Conectado: «Publicar descansos generados como disponibles» | «Publicar descansos generados como disponibles» (es:692) + pista enlazada con `aria-describedby`: «Si no lo activas, se quedan como descanso privado. No se envía nada a las organizaciones.» (`CyclePlanner.tsx:152-159`, es:693) | ≈ | — | — | Mantener (W2-09). La pista se adapta: Next no tiene candidaturas |
| 24 | Reemplazar | Demo, en el modal: «Reemplazar también las excepciones manuales de estas fechas» (`manualDates`). Conectado: «Reemplazar también los días que ya he guardado o editado en este mes» | «Reemplazar también los días que ya he guardado en este mes» (es:694). Sin marcar, se saltan los días que tienen ventanas (`rotation.ts:106`) | ≈ | — | — | — |
| 25 | Qué se guarda | Demo: trabajo → `working`, descanso → `off` o `available`. Conectado: igual en `schedule`, que es privado; solo `available` y `aog` crean intervalos | Trabajo → ventana `unavailable` («Bloqueado»); descanso → nada, o `available` si se publica (`rotation.ts:108`; BR-4.7) | ≈ | P3 | — | Mantener (para el matching es equivalente) |
| 26 | Días que se saltan | Demo: pasados, `assigned` y excepciones manuales si no se reemplazan (`AvailabilityPlanner.jsx:13-14`). Conectado: pasados, `assigned` y días pendientes o en `schedule` si no se reemplazan; los intervalos parciales sin `schedule` se sobrescriben (C §4.3) | Pasados, los días de una asignación confirmada (también con «Reemplazar…») y los días con cualquier ventana si no se reemplaza (`rotation.ts:103-118`, `planCycle` con `assigned`; la página pasa los días de las candidaturas `confirmed`, `page.tsx:34-44`). Runtime F3 (delta, enero de 2027 con asignación el 18-19): «Reemplazar…» + vista previa → 29 días en borrador y los 2 asignados sin tocar (`PKG P03 3`; `PKG calendar pc4`). Test `BR-4.9 / N-04: the days of a confirmed assignment are never generated, even with replace` en verde | = (F3: antes ≠) | — (F3: antes P2) | — (F3: antes T-13) | Hecho (N-04, T-15, `20261023300000`; P03-13). T-13 sustituido por T-15 al aplicar la regla DEFAULTS del owner (22/10; T-15 sigue siendo un default revisable) |
| 27 | AOG en el ciclo | Nunca genera `aog` | Nunca genera `aog_only` | = | — | — | — |
| 28 | Botón de vista previa | Demo «Previsualizar patrón en {mes}». Conectado «Previsualizar ciclo en el mes» | «Previsualizar ciclo en el mes», primario (`CyclePlanner.tsx:174-180`; es:695) | = | — | — | Igual al conectado |
| 29 | Modal de revisión | Demo «Revisar antes de guardar»: «{n} fechas futuras del mes. {m} tienen una excepción manual.» (sin plural, H-12) + lista por día con «Conservar excepción» + casilla de reemplazo + «Aplicar y guardar patrón» (`AvailabilityPlanner.jsx:15`) | Sin modal: la vista previa entra en el borrador del calendario; cada día lleva `aria-label` «{fecha}: {estado} · {trabajo\|descanso}, sin guardar» y contorno discontinuo (`AvailabilityManager.tsx:197-217,387-398`) | ≈ | P3 | — | Mantener (patrón del conectado; V18-18 cubierto salvo el modal) |
| 30 | Guardado del ciclo | Demo: aplicar y guardar a la vez (toast «Perfil profesional guardado»). Conectado: guardado aparte | Guardado aparte con «Guardar calendario» | = | — | — | Igual al conectado |
| 31 | Deshacer | Demo: «Deshacer generación» después de guardar, que restaura la disponibilidad anterior (`AvailabilityPlanner.jsx:15`). Conectado: no hay | «Deshacer último cambio», paso a paso dentro del borrador (`AvailabilityManager.tsx:190-195,423-425`; es:735). No se puede deshacer después de guardar | ≈ | P3 | — | Mantener (TD-62) |
| 32 | Errores del ciclo | «El ciclo personalizado debe tener de 1 a 31 días de trabajo o descanso.», «Selecciona un patrón válido.», «El ciclo debe caber en 31 días.» | Cliente: «Elige entre 1 y 31 días.», «El ciclo debe caber en 31 días.», «Elige un día 1 válido.». Servidor: «Elige un patrón válido», «El ciclo necesita de 1 a 31 días, cada uno de trabajo o descanso» (es:722-724, 362-365) | ≈ | — | — | — |
| 33 | Título y navegación del mes | h2 con el mes. Demo: flechas «Mes anterior/siguiente» que reinician la vista previa. Conectado: flechas deshabilitadas si hay cambios | Panel con el mes (`formatMonth`) y ←/→ «Mes anterior/siguiente», deshabilitadas si hay borrador (`AvailabilityManager.tsx:340-359`). v2: el mes sale con mayúscula, «Octubre de 2026» (X-18, `formatMonth`, `src/i18n/format.ts:38-42`); v1.8 lo escribe en minúscula en los dos modos («octubre de 2026», runtime v2 `evidencias/v2/20/TEC-04-1-v18-1440.txt`, `TEC-04-1-v18c-1440.txt`) | ≈ (v2: antes =) | P3 | — | Mantener (X-18) |
| 34 | Mes en la URL | No | `?month=` con `replaceState` (`AvailabilityManager.tsx:89-93`) | + | — | — | Mantener |
| 35 | Pinceles | Demo: «Disponible», «Descanso», «Solo AOG», «Trabajo». Conectado: «Disponible», «Descanso», «Trabajo», «Solo AOG» | «Disponible», «Bloqueado», «Solo AOG», «Descanso (limpiar)» (`AvailabilityManager.tsx:50-55`; es:643-648) | ≈ | P3 | — | Mantener («Trabajo» pasa a «Bloqueado», fila 25) |
| 36 | Pista del pincel | Demo: «Elige un estado y pulsa un día. «Descanso» y «Disponible» son estados distintos.» | «Elige un estado y pulsa los días para aplicarlo. Los días son UTC.» + la pista de AOG (es:650, 741) | ≈ | — | — | — |
| 37 | Cabecera de semana | «L M X J V S D» | «Lun Mar Mié Jue Vie Sáb Dom» (es:658-665), en mayúsculas por CSS (`AvailabilityManager.tsx:377`) | ≈ | P3 | — | — |
| 38 | Celda | `<b>` con el número y `<small>` con el estado; `aria-label` «{d}: {estado}[, sin guardar]» | Número y estado (el estado solo desde `sm`); `aria-label` «{d}: {estado}[ · trabajo/descanso][, sin guardar]» (`AvailabilityManager.tsx:392-410`) | = | — | — | — |
| 39 | Estados de día | Demo: Trabajo, Descanso, Disponible, Solo AOG, Asignado. Conectado: los mismos y Parcial. Runtime v2 (conectado T1): «2026-10-22: Asignado» y «2026-10-30: Asignado», ambos `disabled` (`evidencias/v2/20/TEC-04-1-v18c-1440.aria.yml`). | Disponible, Bloqueado, Parcial, Descanso, Solo AOG (es:651-657). F3: el día de una asignación confirmada conserva su estado y añade «● Asignada» debajo (solo el punto bajo `sm`), va `disabled` y su `aria-label` dice «{fecha}: {estado}, asignación confirmada. Una asignación confirmada está protegida.» (`AvailabilityManager.tsx:393-416`; `calendar.ts:174-175`). Runtime F3 (es): «2027-01-18: Disponible, asignación confirmada. Una asignación confirmada está protegida.», `disabled` (`PKG P03 2`); en «Mi espacio» el mismo día es «Asignado» (`PKG calendar pc5`) | ≈ | — (F3: antes P3) | — | Mantener: v1.8 sustituye el estado por «Asignado»; Next lo conserva y marca «Asignada» (más información, misma protección). La protección, en la fila 43 |
| 40 | Precedencia de estados | Conectado `calendarState`: asignado > `schedule` > intervalo que cubre el día (aog si alguno es `aogOnly`) > parcial > off (`connectedModel.js:5-9`) | Bloqueado completo > bloqueo parcial = Parcial > AOG completo > AOG parcial = Parcial > disponible completo > parcial > Descanso (`calendar.ts:66-90`; BR-4.8) | ≈ | — | — | — |
| 41 | Estilo | AOG en naranja y parcial rayado (v18.css) | AOG en `warn` y parcial rayado con `bg-partial` (`calendar.ts:32-39`) | = | — | — | — (10:161 corregido en W4-02) |
| 42 | Días pasados | Deshabilitados en demo y conectado; el servidor del conectado también los rechaza (`server/connected.mjs:20`). Runtime demo: 21 de 31 días `disabled` (`evidencias/xhigh/20/TEC-04-1-v18-1440.jpg`). Pero el editor de intervalos con horas del pasaporte conectado sí acepta fechas pasadas: solo exige fin > inicio (`src/beta/Account.jsx:62`; `server/app.mjs:65-66`, `period()` sin suelo de fecha, `server/rules.mjs:10`) | Siempre deshabilitados y sin acción al pulsarlos, haya o no borrador: `isDayEditable(date, today)` (`src/features/availability/calendar.ts:118`; `AvailabilityManager.tsx:231,402`). El `PUT` por lotes los rechaza en SQL (`20261021120000`). X-19: el formulario rechaza un inicio pasado, nuevo o movido («El inicio no puede estar en el pasado», `refusesPastStart`, `calendar.ts:125-126`). F3: desde N-26 también el servidor — trigger `availability_windows_refuse_past_start` (`20261024200100`; 22023 `past_start` → 400 `startsAt: v.start.future`) para POST, PATCH y escrituras directas; «Editar» de la ventana en curso conserva su inicio pasado (BR-4.6, T-104). Runtime F3: el 1 del mes actual `disabled` y hoy editable (`PKG P03 2b`); E2E «availability PUT … refused for past days and organizations» en verde | ≈ | — | — | Hecho (W1-03 + X-19 `befd21d`; N-26/T-104). Next es más estricto que el editor de intervalos del conectado, que acepta pasados: diferencia deliberada, documentada en BR-4.6 |
| 43 | Días asignados | Deshabilitados. Demo: «Una asignación confirmada está protegida.». Conectado: «No puedes modificar una fecha con asignación confirmada.» | F3: `disabled` con la frase de la demo en el `aria-label` («Una asignación confirmada está protegida.»; `canEditDay`, `AvailabilityManager.tsx:402-404`). El servidor responde 409 `ASSIGNMENT_PROTECTED` (SQLSTATE `CFV01`) al guardado del calendario que liste un día asignado, mostrado con el literal del conectado «No puedes modificar una fecha con asignación confirmada.», y a cualquier escritura (POST/PATCH/DELETE, también PostgREST directo) que deje una asignación confirmada por debajo del 100 %: «Conserva la disponibilidad de tus asignaciones confirmadas.» (`20261023300000`; `error-copy.ts`; es `availability.protected.*`). Runtime F3 (es): 18 y 19 `disabled` con la frase (`PKG P03 2`); «Eliminar» → «Sí, eliminarla» de la ventana que cubre la asignación → aviso «Conserva la disponibilidad…» y ventana intacta (`PKG P03 5`); PUT y DELETE por API → 409 (`PKG calendar pc2`). `tests/db/calendar.test.ts` «N-04 · the days of a confirmed assignment are protected» (13 casos) y `canEditDay` en verde | = (F3: antes ≠) | — (F3: antes P2) | — (F3: antes T-13) | Hecho (N-04, T-15/T-16, BR-4.9; P03-13). T-13 sustituido por T-15 al aplicar la regla DEFAULTS del owner (22/10; T-15 sigue siendo un default revisable) |
| 44 | Clic sin borrador | Demo: guarda al momento (`paintAvailability`), sin toast. Conectado: siempre va a pendientes | Guarda al momento si el día, de hoy en adelante y sin asignación confirmada (filas 42-43), está vacío o tiene una ventana de un día: «{fecha} marcado como {estado}» / «{fecha} limpiado». Si no, va al borrador con aviso de recorte (`AvailabilityManager.tsx:229-260`; es:669-670, 734) | ≈ | — | — | — |
| 45 | Excepciones manuales | Demo: `manualDates`, que se conservan al generar salvo que se reemplacen | No hay marca de excepción; se conservan los días que tienen ventanas | ≈ | — | — | — |
| 46 | Cambios sin guardar | Conectado: «{n} días modificados sin guardar. Revisa el calendario antes de publicarlos; guarda o descarta para cambiar de mes.», sin plural | «{n} día(s) modificado(s) sin guardar. Revisa el calendario y guarda o descarta para cambiar de mes.», con plural ICU (es:729); sin «antes de publicarlos». Runtime: «10 días modificados sin guardar…» (`evidencias/xhigh/20/TEC-04-2-next-1440.jpg`). Runtime F3 (es): «29 días modificados sin guardar. Revisa el calendario y guarda o descarta para cambiar de mes.», con las flechas del mes deshabilitadas (`PKG P03 3`) | ≈ (xhigh: antes =) | — | — | — |
| 47 | Aviso de recorte | — | «{n} día(s) está(n) dentro de un intervalo más largo o de horas parciales…» (es:734) | + | — | — | Mantener |
| 48 | Guardar | Conectado: «Guardar calendario en mi cuenta» → «Cambios guardados.» | «Guardar calendario» → «{n} días guardados», «Patrón guardado; ningún día necesitaba cambios.» o «Nada que guardar…» (es:730-736) | ≈ | — | — | — |
| 49 | Descartar | Conectado: «Descartar cambios» | «Descartar cambios» (es:731) | = | — | — | — |
| 50 | Conflicto de versión | Conectado: `version` → 409 «El calendario ha cambiado. Actualiza antes de guardar.» (`server/app.mjs:77-81`; C-TEC-18) | El GET de `professional-availability` devuelve `version`, una huella md5 de las ventanas y el patrón (`availability_version()`). La página la pasa al calendario y «Guardar calendario» la envía como `expectedVersion`. Si no coincide: 409 `CONFLICT` y «Tu calendario cambió en otra ventana o dispositivo. No se ha guardado nada: recarga para ver la versión más reciente.»; el borrador se conserva (`supabase/migrations/20261021120000_availability_version.sql`; `supabase/functions/professional-availability/index.ts:75-81,181-192`; `page.tsx:54`; `AvailabilityManager.tsx:152-172`; es:738). Las escrituras de un día o una ventana (POST/PATCH/DELETE) no se comprueban, pero cambian la versión. Runtime F3 (es): con 29 días en borrador, una ventana añadida por API desde «otro dispositivo» y «Guardar calendario» → el aviso, el borrador sigue (29) y nada se escribe (`PKG P03 4`). Solo en local, como las 59 migraciones y las 23 funciones de la rama (F5) | ≈ (antes −) | — | — (F3: antes «Despliegue (owner)»; el despliegue es de toda la rama, no de esta fila) | Hecho (W5-03; P03-07). Se despliega con el resto en F5 con autorización del owner |
| 51 | Límites | Conectado: hasta 31 fechas del mes por guardado, 400 intervalos y 730 fechas en `schedule` («Días de calendario no válidos.», «Demasiados intervalos: simplifica tu calendario.»). Demo: un día por clic | Hasta 62 días por `PUT` («Como máximo 62 días a la vez»), ventanas de hasta 366 días y ciclos de hasta 31 (`src/lib/validation/availability.ts:13,44`; es:358) | ≈ | — | — | — |
| 52 | Pista de protección | Conectado: «Las fechas con asignación confirmada están protegidas también en el servidor. AOG requiere además activar tus avisos/consentimiento AOG en el perfil. No se envían candidaturas al guardar.» | F3: leyenda «● Asignada · Las fechas con asignación confirmada están protegidas también en el servidor.» sobre el calendario (`AvailabilityManager.tsx:374-380`; es `availability.assignedHint`) + la pista de AOG (es:741). Las otras dos frases no aplican: no hay consentimiento AOG aparte (fila 53, C-8/D-05) y Next no envía candidaturas al guardar. Runtime F3: `PKG P03 1b` | ≈ | — (F3: antes P3) | — (F3: antes T-13) | Hecho (N-04; P03-15) |
| 53 | «Solo AOG» y consentimiento | Demo `availableOn`: el día AOG cuenta si la oferta es AOG **y** hay `aogOptIn` (`business.js:108-110`). Conectado: `aogOnly` solo con `aogOptIn` y oferta AOG por plazo (V18-20) | `aog_only` cuenta solo si la urgencia declarada es `aog`, sin consentimiento aparte (BR-4.8; `effectiveStatus`, `ranked_external_pool`; rls suite P). F3: Next tiene un `aogOptIn`, pero solo para los avisos de oportunidades (N-10, `notice_preferences.aog_opt_in`, `20261024400100`; lo consulta `20261024400200:234`), no la elegibilidad | ≠ | — | — | Mantener (TD-65; decisión del owner C-8/D-05 del 19/10: marcar `aog_only` ya es el consentimiento). Re-verificada en F3 sin cambio: única `≠` de la sección |
| 54 | AOG por plazo | Oferta a ≤ 10 días → AOG (`business.js:34-38`; `server/rules.mjs:7`) | Urgencia declarada (D-05) | ✗ | — | — | No portar |
| 55 | Intervalos con horas: dónde | Conectado: `<details>` del pasaporte «Intervalos de disponibilidad con horas concretas (UTC)» + «Para planificar por días y ciclos usa Disponibilidad. …» (`Account.jsx:62`). Demo: no hay («esta demo no reserva horas dentro de un día») | Panel «Añadir una ventana de tiempo» / «Editar ventana» en la misma página (`AvailabilityManager.tsx:434-485`; es:674-675) | + | — | — | Mantener |
| 56 | Intervalos: campos | «Inicio UTC» / «Fin UTC», `datetime-local`; solo disponibilidad | «Inicio (UTC)» / «Fin (UTC)», `datetime-local` con paso de 900 s; «Estado»: «Disponible», «No disponible», «Disponible solo para AOG» (es:676-680, 740) | + | — | — | — |
| 57 | Intervalos: validación | «Añadir intervalo» no hace nada, sin aviso, si el fin no es posterior al inicio; acepta fechas pasadas (fila 42) | «El fin debe ser posterior al inicio», «Una ventana puede abarcar como máximo 366 días»… (es:257-268). `v.window.status` dice ya «Elige disponible, no disponible o solo AOG» (es:266). Runtime: fin anterior al inicio → «El fin debe ser posterior al inicio» junto al campo, sin enviar. F3: el suelo de fecha del inicio está en el formulario (X-19) y en el servidor (N-26, fila 42) | + | — | — | Mantener (W2-09) |
| 58 | Intervalos: lista | «{dt} → {dt}[ · Solo AOG]» + «Quitar intervalo», que se aplica al guardar el perfil | «Ventanas guardadas ({n})»: chip + «DD MMM YYYY, HH:MM UTC → …» + «Editar» / «Eliminar». «Eliminar» pide confirmación: «Sí, eliminarla» / «Cancelar» (`AvailabilityManager.tsx:494-533`; `ConfirmButton.tsx`; es:681-682, 628). Runtime: «Eliminar» → foco en «Cancelar»; «Cancelar» → foco en «Eliminar». v2: tras «Sí, eliminarla» el aviso del resultado toma el foco (X-08). Runtime v2 con la acción abortada: foco en `P[role=alert]` «Se ha perdido la conexión…», nada borrado (`evidencias/v2/20/TEC-04-9-next-1440.txt`). Runtime F3 (es): «Eliminar» → «Sí, eliminarla» de la ventana que cubre una asignación → `role=alert` «Conserva la disponibilidad de tus asignaciones confirmadas.», ventana listada y guardada (`PKG P03 5`); edición y recarga: ui-smoke 4 | ≈ | — (v2: antes P3) | — | Mantener (W1-10; foco: X-08, B-13 HECHO) |
| 59 | Efecto secundario | Editar intervalos en el pasaporte vacía `schedule` y borra las marcas privadas (C §3.15-8) | — | ✗ | — | — | No portar |
| 60 | Tarifa por día | No existe en v1.8 (D2 §3, S-TEC-03) | No existe | = | — | — | — |
| 61 | Diseño a 390 px | Celdas de 42×70 con etiquetas que se solapan (§2.M; C-TEC-14 a 390; demo: `evidencias/xhigh/20/TEC-04-1-v18-390.jpg`) | La etiqueta de estado se oculta por debajo de `sm`; solo queda el número y el punto de «Asignada» (`AvailabilityManager.tsx:410-416`; `evidencias/xhigh/20/TEC-04-1-next-390.jpg`). F3: sin scroll horizontal a 1440 / 1024 / 768 / 390 / 360 (`PKG P03 7`; `docs/audit/evidence/parity/P03/P03-availability-after-390.jpg`, `-360.jpg`) | + | — | — | Mantener |
| 62 (nueva xhigh) | Vista previa sin días que generar | Demo: el modal responde siempre: «{n} fechas futuras del mes. {m} tienen una excepción manual.» (`AvailabilityPlanner.jsx:15`; runtime: «10 fechas futuras del mes. 0 tienen una excepción manual.», `evidencias/xhigh/20/TEC-04-2-v18-1440.jpg`). Conectado: sin aviso, pero solo salta días con `schedule` o pendientes, no los que tienen intervalos (`ConnectedCalendar.jsx:10`) | X-15: si la vista previa no genera ningún día, avisa: «No hay días que generar: todos los días desde hoy ya tienen ventanas guardadas. Marca «Reemplazar también…» o elige otro mes.»; en un mes pasado, «Este mes ya ha pasado: elige el mes actual o uno futuro.» (`AvailabilityManager.tsx:200-204`; `rotation.ts:114-119`; es:725-726). Runtime v2 con alpha: octubre (cubierto por una ventana) y septiembre dan cada uno su aviso, 0 días en borrador (`evidencias/v2/20/TEC-04-9-next-1440.txt`). Test `emptyPreviewReason` en verde | ≈ (v2: antes ≠) | — | — | Mantener (X-15, `a941e87`; B-15 HECHO) |
| 63 (nueva xhigh) | Fallo de red al guardar | Conectado: `run()` captura el error y lo muestra bajo la cabecera sin perder el formulario (`src/beta/Account.jsx:31`) | X-02: `run()` envuelve la acción en `callAction` (`AvailabilityManager.tsx:134`; `src/components/ui/Notice.tsx`): sin conexión, «Se ha perdido la conexión. Tus cambios siguen aquí; comprueba la conexión y reintenta.» (es:223), sin límite de error. Runtime v2 sin conexión: «Añadir» conserva el formulario; «Guardar calendario» con 30 días en borrador los conserva (30 → 30) (`evidencias/v2/20/TEC-04-8-next-1440.jpg`, `TEC-04-9-next-1440.txt`). F3: ui-smoke 2h (ventana sin red: aviso, sin página de error, formulario intacto). Lo mismo en `ProfileForm.tsx`, `QualificationsManager.tsx` y `DocumentWallet.tsx` | ≈ (v2: antes ≠) | — | — | Mantener (X-02, `1c2616c`; B-14 HECHO) |
| 64 (nueva xhigh) | Nota bajo la vista previa | Demo: «Se respetan las asignaciones, las fechas pasadas y tus excepciones manuales. Los patrones nocturnos marcan días completos; esta demo no reserva horas dentro de un día.» (`AvailabilityPlanner.jsx:15`; `evidencias/xhigh/20/TEC-04-3-v18-1440.jpg`) | F3: la pista del ciclo termina con «Se respetan las asignaciones confirmadas, las fechas pasadas y los intervalos parciales de los días que no reemplazas.» (es `availability.cycle.hint`), la parte de la frase de la demo que aplica (sin excepciones manuales ni «esta demo no reserva horas»); «Se generan días completos UTC…» cubre los patrones nocturnos. Runtime F3: `PKG P03 1b` | ≈ | — | — | Hecho (P03-03) |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-03-disponibilidad-1440.png`, `D-TEC-03-disponibilidad-390.png`,
  `D-TEC-03b-ciclo-personalizado-1440.png`, `D-TEC-03c-previsualizar-1440.png`, `D-TEC-03d-patron-aplicado-1440.png`,
  `D-TEC-03e-disponibilidad-asignado-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-03-calendar-empty-1440.png`, `C-TEC-14-calendar-initial-1440.png`,
  `C-TEC-14-calendar-390.png`, `C-TEC-15-calendar-preview-7374-1440.png`, `C-TEC-16-calendar-custom-1440.png`,
  `C-TEC-17-calendar-saved-1440.png`, `C-TEC-18-calendar-conflict-1440.png`, `C-TEC-34-calendar-assigned-1440.png`.
- Next: `docs/audit/evidence/v18-compare/next-after/tech-availability-{1440,1024,768,390,360}.jpg` (lote 11),
  `docs/audit/evidence/local-17-availability-es.jpg` (`108a244`, lote 13) y
  `docs/audit/evidence/after-1440-availability.jpg` (`ff01048`, 2026-10-09, anterior al generador).
- xhigh (22/10): `evidencias/xhigh/20/TEC-04-1-{next,v18}-{1440,390}.*`, `TEC-04-2-{next,v18}-1440.*` (vista previa),
  `TEC-04-3-{next,v18}-1440.*` (ciclo personalizado), `TEC-04-4-next-1440.*` (fallo de red), `TEC-04-5-next-interact-1440.txt`
  (registro de las interacciones; 0 escrituras llegaron al servidor).
- v2: Next `evidencias/v2/20/TEC-04-1-next-{1440,390}.*`, `TEC-04-6-next-1440.*` (foxtrot), `TEC-04-7-next-1440.*` (sin perfil), `TEC-04-8-next-1440.*` (sin conexión), `TEC-04-9-next-1440.txt` (registro de interacciones, 5 POST abortados), `TEC-04-10-next-1440.*` (delta, «Assigned»), `TEC-04-11-next-1440.*` (ciclo sobre el día asignado); demo `TEC-04-1-v18-1440.*`; conectado `TEC-04-1-v18c-{1440,390}.*`.
- F3 (26/10, P03): `docs/audit/evidence/parity/P03/P03-availability-after-{1440,1024,768,390,360}.jpg` (es, enero de 2027 con asignación el 18-19), `P03-availability-after-1440-en.jpg`, `P03-availability-preview-after-1440.jpg` (vista previa con «Reemplazar…»: 29 días en borrador, los asignados sin tocar); `scripts/local/p03-captures.mjs` sobre `next start` del build del gate.

---

## TEC-05 · Documentos / wallet — v1.8 `S-TEC-06, S-TEC-06a, S-MOD-TEC-04, S-MOD-TEC-05, S-MOD-TEC-06, D-TEC-06, S-CON-09, C-TEC-06/24` ↔ Next `N-PRO-05, N-PRO-01 (revisión a 60 días)`

**Estado global:** PARCIAL (F3 2026-10-27: paridad del wallet propio completa; lo que falta es sensible o de despliegue).
El wallet de Next coincide con el conectado (5 MB, PDF/PNG/JPEG por bytes mágicos, tipos license/course/other) y, desde
el paquete wallet-extras (`edb7850`, `c93a227`, `a9fda5a`; T-100…T-103), también con la demo en las pestañas (filtro por
tipo), la papelera (con retención de 30 días) y la vista previa en la app; la exportación lleva los archivos (N-13). La
edición en línea, el vínculo con una cualificación y la confirmación al borrar son mejoras propias. P06 no añade código:
re-verifica cada fila con el bloque `PKG P06` (es, positivos y negativos) y `PKG wallet-extras`.

Le faltan, retenidas por una decisión (no se habilitan por defecto):
- el análisis, la revisión y el despliegue del wallet (D-10, OD-3; filas 1, 25 y 26);
- compartir documentos o sus copias con terceros (D-07 P3 + D-10; filas 33 y 34).

En PROD no es visible: el flag de BD falla cerrado y ni la tabla ni la función están desplegadas.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Disponibilidad de la pantalla | Siempre presente, en demo y conectado | Tras el flag de BD `document_wallet` (`src/server/feature-flags.ts:29-37`). Sin flag: 404 (`src/app/app/professional/documents/page.tsx:22`) y sin entrada «Documentos» (`AppShell.tsx:36`). En PROD no hay tabla ni función (next-static §0.1-0.2). F3: en local el flag lo activa la puerta (`gate.sh`) y el smoke `PKG P06 0b` entra por «Documentos» | − | P1 | D-10 (despliegue release 2, M-3) | Desplegar con autorización del owner |
| 2 | Entrada | Demo: «Wallet documental» `#docs`. Conectado: «Documentos» `#documents` | «Documentos» → `/app/professional/documents`, `aria-current` (es:73). F3: `PKG P06 0b` | = | — | — | Igual al conectado |
| 3 | Kicker | Demo: «WALLET DOCUMENTAL». Conectado: ninguno | «MI EXPEDIENTE» (es:1197). F3: `PKG P06 0b`; `docs/audit/evidence/parity/P06/P06-wallet-after-1440.jpg` | ≈ | P3 | — | Mantener: el título ya es «Wallet documental» (fila 4) |
| 4 | Título | Demo: «Tu expediente, una vez.» (`Professional2.jsx:210`). Conectado: h2 «Wallet documental» (`Account.jsx:72`). Runtime v2: demo «Tu expediente, una vez.»; conectado «Wallet documental» (`evidencias/v2/20/TEC-05-1-v18-1440.txt`, `TEC-05-1-v18c-1440.txt`). | «Wallet documental» (es:1198). F3: `PKG P06 0b` | = | — | — | Igual al conectado |
| 5 | Descripción | Demo: «Los archivos se guardan por referencia. Las copias históricas conservan su versión.». Conectado: «PDF, PNG o JPEG, hasta 5 MB. Los archivos quedan en cuarentena; subirlos no acredita una licencia. Administración puede analizarlos con ClamAV configurado y después revisar su contenido. Solo los archivos limpios permiten descarga.» | «Tus licencias, cursos y otros documentos, guardados de forma privada. Solo tú puedes verlos.» y, en la subida, «PDF, PNG o JPEG, hasta 5 MB. Subir un documento no acredita una licencia ni una habilitación: la verificación es un proceso aparte.» (es:1199, 1202). F3: `PKG P06 0b` | ≈ | — | — | — |
| 6 | Pestañas por bloque | Demo: «Todos», «Licencias», «CV y experiencia», «Cursos», «Permisos y seguridad» (`Professional2.jsx:183`); runtime: las 5 pestañas y «Licencias» deja un solo panel (`evidencias/xhigh/20/TEC-05-2-v18-1440.jpg`). Conectado: no hay | Chips «Todos», «Licencias», «Cursos», «Otros» con `aria-pressed` en el grupo «Filtrar por tipo», en cliente, también en la papelera; el contador «Tus documentos (n)» sigue al filtro y el vacío por tipo dice «No hay documentos de este tipo.» (`DocumentWallet.tsx:351-363`; `src/features/documents/map.ts:16,41`; es:1254-1259; T-102, paquete wallet-extras `edb7850`). «CV y experiencia» y «Permisos y seguridad» van en «Otros» | ≈ (F3: antes −) | P3 | — | Mantener (N-20 hecho). `PKG P06 3`, `PKG wallet-extras 1`, `map.test.ts` |
| 7 | Tipos | Demo: 4 bloques (Licencias, CV y experiencia, Cursos, Permisos y seguridad). Conectado: license, course, other («Licencia», «Curso», «Otro») | license, course, other: «Licencia», «Curso», «Otro» (`src/domain/documents.ts:7`; es:1206-1210). F3: `PKG P06 1` (chips «Licencia» y «Curso») | = | P3 | — | Igual al conectado. CV y permisos van como «Otro» |
| 8 | Formulario de subida | Demo: modal «Añadir documento». Conectado: formulario en la página | Panel «Subir un documento» en la página (`DocumentWallet.tsx:259-341`). F3: `PKG P06 0b` | = | — | — | Igual al conectado |
| 9 | Campo de archivo | Demo: «Archivo · máximo 2 MB». Conectado: «Archivo de prueba» | «Archivo» con la pista «El tipo se comprueba por el contenido del archivo, no por su nombre.» (es:1203-1204). F3: `PKG P06 0b` | ≈ | — | — | — |
| 10 | Formatos | Demo: `.pdf,.png,.jpg,.jpeg,.webp`, por MIME. Conectado: `.pdf,.png,.jpg,.jpeg` y bytes mágicos | `.pdf,.png,.jpg,.jpeg` + MIME en `accept` y bytes mágicos en la función (`DocumentWallet.tsx:53`; `documents.ts:37-42`). F3: E2E «local E2E: document wallet (D-10)» (`.pdf` renombrado → `v.document.file.type`) | = | P3 | — | Igual al conectado. No portar WebP |
| 11 | Tamaño máximo | Demo: 2 MB. Conectado: de 1 byte a 5 MB | 5 MiB en cliente y en bucket (`documents.ts:14`; `DocumentWallet.tsx:113`) | = | — | — | Igual al conectado |
| 12 | Errores del archivo | Demo: «Selecciona PDF, PNG, JPEG o WebP de hasta 2 MB.». Conectado: «El archivo debe ocupar entre 1 byte y 5 MB.», «Solo PDF, PNG y JPEG con cabecera válida.» | «Elige un archivo para subir», «Solo se aceptan archivos PDF, PNG o JPEG», «El archivo supera los 5 MB», «No se pudo leer la subida. Inténtalo de nuevo.» (es:374-379) | ≈ | — | — | — |
| 13 | Título | Demo: «Título», opcional; vacío → nombre del archivo. Conectado: no hay título, se usa el nombre | «Título», ≤ 180, con la pista «Si lo dejas vacío se usa el nombre del archivo.»; se limpia (`DocumentWallet.tsx:293-302`; `documents.ts:65-70`). F3: `PKG P06 0b` | = | — | — | Igual a la demo |
| 14 | Tipo o bloque | Demo: «Bloque», por defecto Licencias. Conectado: «Tipo», por defecto Licencia | «Tipo», por defecto «Licencia» (`DocumentWallet.tsx:282-292`). F3: `PKG P06 0b` | = | — | — | — |
| 15 | Caducidad | Demo: «Caducidad (si aplica)», opcional; error «Caducidad inválida.». Conectado: «Caducidad», **obligatoria** | «Caducidad (opcional)» (es:1213). F3: `PKG P06 0b`; con fecha a 30 días la fila sale «Caduca pronto» (`PKG P06 1`) | ≈ (xhigh: antes =) | — | — | Igual a la demo en el comportamiento; cambia la etiqueta |
| 16 | Vincular a una cualificación | Desde el pasaporte, en los dos modos | «Vincular a una cualificación (opcional)»: «— Sin vincular —» + las propias «{code} · {name}», con la pista «Solo tus propias cualificaciones declaradas.» (es:1214-1216). F3: `PKG P06 0b` (las 5 de delta y ninguna más) | ≈ | — | — | Ver TEC-03, fila 22 |
| 17 | Aviso de la subida | Demo: «Pendiente de verificación. Vincula la evidencia al curso o habilitación en Mi pasaporte. Renovar un archivo crea una nueva versión sin cambiar expedientes anteriores.». La acción de renovar no existe (H-15) | El texto de la fila 5 | ≈ | — | — | No portar la promesa de «Renovar» |
| 18 | Botón y confirmación | Demo: «Guardar documento» / «Guardando…» → toast «Documento guardado». Conectado: «Guardar documento» → «Documento guardado en cuarentena.» | «Subir documento» / «Guardando…» → «Documento guardado en tu wallet privado.» (es:1217-1218). F3: `PKG P06 1` | ≈ | — | — | — |
| 19 | Transporte | Demo: IndexedDB local. Conectado: base64 dentro de JSON a `/api/documents` | Multipart del navegador a la Edge Function, con JWT e `Idempotency-Key` (`src/features/documents/upload.ts:22-63`) | + | — | — | — |
| 20 | Lista | Demo: un panel por bloque. Conectado: lista simple, sin título | «Tus documentos ({n})» + «Papelera ({n})» + la nota «Ninguna empresa puede ver estos documentos. …» (es:1221-1222, 1251). F3: `PKG P06 0b` | ≈ | — | — | — |
| 21 | Lista vacía | Demo, por bloque: «Sin documentos» + «Aporta evidencia cuando esté disponible.». Conectado: sin texto | «Todavía no has subido documentos.» (es:1223); por tipo, «No hay documentos de este tipo.»; en la papelera, «Sin documentos. Los documentos archivados pueden restaurarse.» (es:1257-1258). F3: `PKG P06 3` (por tipo), `PKG wallet-extras 5` (papelera) | ≈ | — | — | — |
| 22 | Datos de cada fila | Demo: «{caducidad \|\| 'Sin caducidad declarada'} · {verificación}» + «Ejemplo sin archivo». Conectado: «{caducidad} · {Cuarentena\|Análisis limpio\|Bloqueado por amenaza} · {Pendiente\|Revisión registrada}». Runtime v2 (conectado T1): «2028-06-30 · Análisis limpio · Revisión registrada» + «Descargar archivo»; los dos cursos «Cuarentena · Pendiente» (`evidencias/v2/20/TEC-05-1-v18c-1440.txt`). | Chips de tipo, análisis («Sin analizar · no compartible» / «Analizado» / «Bloqueado») y caducidad; línea «PDF\|Imagen PNG\|Imagen JPEG · {tamaño} · caduca el {f} · vinculado a {q}»; en la papelera, además «archivado el {f} · se elimina definitivamente a partir del {f}» (`DocumentWallet.tsx:453-493`; es:1224-1235, 1260-1261). F3: `PKG P06 1` («Licencia · Sin analizar · no compartible · Caduca pronto», «PDF · 20 B · caduca el 26 nov 2026»), `PKG P06 6` | ≈ | — | — | — |
| 23 | Estado de caducidad | Demo `documentStatus`: «Sin caducidad», «Fecha inválida», «Caducado», «Caduca pronto» (≤ 45 días), «Vigente» (`business.js:79-84`). Conectado: no hay | «Vigente», «Caduca pronto» (≤ 45 días), «Caducado»; sin fecha no hay chip (`documents.ts:82-92`; es:1238-1242; BR-12). F3: `PKG P06 1` (a 30 días «Caduca pronto»; el PNG sin fecha, sin chip), `documents.test.ts` | = | — | — | — |
| 24 | Revisión a 60 días | Demo: `<details>` «Documentos y cursos próximos a revisar» en el pasaporte visual, con «Fecha superada» / «Próximos 60 días» y el pie «Según las fechas declaradas. No se envían avisos externos; los documentos sin fecha no se consideran verificados.»; sin texto de vacío (`Badges.jsx:10`) | Desde P02 (T-163), el mismo `<details>` plegado en el «Pasaporte visual» con los mismos literales («Fecha superada» / «Próximos 60 días», el pie) y, además, el panel de Mi espacio con las mismas filas (`PassportVisual.tsx:67-75`; `UpcomingReviews.tsx`; `reviews.ts`; es:518-524). Mejoras propias: botón «Abrir» por fila, texto de vacío «Nada de lo declarado caduca en los próximos 60 días.» y el aviso si el wallet no carga. F3: `PKG P06 2` (un documento a 30 días sale en los dos sitios con «Próximos 60 días» y «Abrir» → el wallet), `PKG P02 1/6` | = (F3: antes ≈) | — | — | Mantener (TD-44, T-163). Coherente con TEC-01 fila 43 |
| 25 | Verificación del documento | Demo: «Autodeclarado» / «Pendiente». Conectado: `review` «Pendiente» / «Revisión registrada» | No hay revisión de documentos | − | P2 | D-10 / OD-3 | — |
| 26 | Análisis antivirus | Conectado: un administrador lanza ClamAV; cuarentena → limpio o bloqueado (`server/scanner.mjs:7-13`) | `scan_status` es siempre `not_scanned` (`documents.ts:18-22`) | − | P2 | D-10 (CX-14) | — |
| 27 | Descargar o abrir | Demo: «Descargar archivo» (blob) + «Vista previa», o «Archivo no disponible». Conectado: «Descargar archivo» solo si está limpio | «Abrir» abre el visor (fila 28) y, dentro, «Abrir en una pestaña nueva» con la URL firmada de 60 s (`DocumentWallet.tsx:159-172,516-524`; `DocumentViewer.tsx:129-133`). F3: `PKG P06 5` | ≈ | — | — | — |
| 28 | Vista previa en la app | Demo: modal con el título; PDF en `<object>` de 450 px y «Usa Descargar para abrir este PDF.»; imagen en `<img>`; «Descargar documento» (runtime con un PNG subido en la demo: `evidencias/xhigh/20/TEC-05-3-v18-1440.jpg`) | `<dialog>` con el título; los bytes de la URL firmada se enseñan como blob tipado por los bytes mágicos: PDF en `<iframe>` de 450 px («Vista previa de {título}») con «Si el PDF no se muestra, ábrelo en una pestaña nueva.», imagen en `<img>`; «Cargando el documento…»; un enlace caducado da «El enlace ha caducado…» + «Reintentar», nunca un marco vacío; «Cerrar» y Escape devuelven el foco a «Abrir» (`src/features/documents/components/DocumentViewer.tsx`; `map.ts:57-76`; es:1262-1271; CSP solo `frame-src blob:`; T-103, `edb7850`, revisión `a9fda5a`) | ≈ (F3: antes −) | P3 | — | Mantener (N-21 hecho). `PKG P06 5`, `PKG wallet-extras 2/3`, `map.test.ts` |
| 29 | Editar | Demo: modal «Editar metadatos» (Título, Caducidad) + «La modificación no cambia expedientes ya enviados.»; con título vacío no guarda y no avisa (H-15). Conectado: no se puede editar | En línea: «Título», «Tipo», «Caducidad (opcional)» y «Vincular a una cualificación (opcional)»; «Guardar» / «Cancelar» → «Documento actualizado.» (`DocumentWallet.tsx:385-451`; es:1219). F3: `PKG P06 4` | + | — | — | Mantener |
| 30 | Archivar y papelera | Demo: icono Trash2 «Archivar {título}» → papelera; botones «Papelera» / «Ver wallet»; «Restaurar»; vacío «Los documentos archivados pueden restaurarse.» (runtime: archivar → «Papelera» → fila con «Restaurar», `evidencias/xhigh/20/TEC-05-4-v18-1440.jpg`) | «Archivar {título}» → «Documento archivado. Puedes restaurarlo desde la papelera.»; «Papelera ({n})» / «Ver wallet» (`?view=trash`); en la papelera no hay subida, la nota «Puedes restaurar un documento archivado durante 30 días; después se elimina definitivamente, también su archivo. …», «Restaurar {título}» → «Documento restaurado.», vacío «Sin documentos. Los documentos archivados pueden restaurarse.»; `archived_at` lo sella la BD y `documents-maintenance` purga `trash_expired` tras `archive_retention` (migración `20261024200000`; `DocumentWallet.tsx:343-349,483-513`; es:1243-1261; T-100/T-101, `edb7850`) | ≈ (F3: antes −) | P3 | — | Mantener (N-19 hecho; retención de 30 días en vez de «para siempre»). `PKG P06 6`, `PKG wallet-extras 4/5`, `tests/db/wallet-extras.test.ts` |
| 31 | Eliminar | Conectado: «Eliminar», sin confirmación; error «Retira primero las candidaturas que comparten este documento.» | En la interfaz, solo desde la papelera (la API `DELETE` borra cualquier fila propia): «Eliminar definitivamente» con el `ConfirmButton` común («Confirmar eliminación» / «Cancelar», foco en «Cancelar» al abrir, de vuelta al cancelar; tras confirmar, «Documento eliminado.» toma el foco, X-08) (`DocumentWallet.tsx:505-512`; `src/components/ui/ConfirmButton.tsx`; es:1237, 1220, 1249). F3: `PKG P06 6` (botones de la papelera), `PKG wallet-extras 5` | + | — | — | Mantener |
| 32 | Documentos de ejemplo | Demo: 6 documentos con `demo:true`: Licencia EASA Part-66, CV profesional, Human Factors, EWIS, Fuel Tank Safety, PCP Madrid (`src/data/v11.js:5`) | Ninguno | ✗ | — | — | No portar (solo demo) |
| 33 | Compartir con empresas | Demo: se eligen en el Candidate Pack y los archivos se ven tras consentimiento y aceptación. Conectado: casillas en «Preparar candidatura»; la empresa descarga si está limpio | Imposible por diseño: `canShareWithThirdParties` es `scanStatus === "clean"`: siempre false en la práctica, nada puede escribir `clean` (`documents.ts:18-22,77-79`; un futuro escáner lo activaría); nota es:1222). F3: `PKG P06 8/9` prueban que otro usuario y una cuenta de organización reciben 404 / 403 | − | P1 | D-07 P3 + D-10 (CX-39) | — |
| 34 | Copias en expedientes enviados | «Las copias históricas conservan su versión.» | — | − | P3 | D-07 P3 + D-10 (copias para terceros; M09 preparado y apagado) | — |
| 35 | Exportar archivos | Conectado: los archivos van en base64 en «Exportar mis datos y archivos» | «Exportar mis datos y archivos» (`/app/settings/export`) lleva `documents[]` con los metadatos y `contentBase64` de cada archivo hasta el tope de `filesToEmbed`, y `filesOmitted` (`supabase/functions/account/index.ts:183-214`; `src/domain/account.ts:12-24`; N-13, `c93a227`). F3: `PKG P06 7b` (el PDF subido vuelve byte a byte, `filesOmitted` 0), `PKG account b`, `account.test.ts` (dominio) | = (F3: antes −) | P3 | — | Mantener (N-13 hecho) |
| 36 | Mantenimiento | — | `documents-maintenance` limpia huérfanos y tombstones y, desde N-19, la papelera caducada (`trash_expired`); no tiene cron (`tests/db/wallet-extras.test.ts` «maintenance: …», E2E «documents-maintenance») | + | — | — | — |
| 37 (nueva xhigh) | Foco en la confirmación de borrado | Sin confirmación: la demo archiva y el conectado borra con un clic, sin pérdida de foco | X-08 sustituye la confirmación propia por el `ConfirmButton` común (`DocumentWallet.tsx:505-512`): foco en «Cancelar» al abrir, de vuelta en «Eliminar definitivamente» al cancelar y, tras confirmar, en el aviso. F3: en runtime, `PKG wallet-extras 5` confirma el borrado desde la papelera; `PKG P06 5/6` comprueban la vuelta del foco a «Abrir» al cerrar el visor | ≈ (v2: antes ≠) | — | — | Mantener (X-08, `4357034`; B-13 HECHO) |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-06-wallet-1440.png`, `D-TEC-06b-subir-documento-1440.png`,
  `D-TEC-06c-wallet-doc-subido-1440.png`, `D-TEC-06d-vista-previa-1440.png`, `D-TEC-06e-editar-documento-1440.png`,
  `D-TEC-06f-archivar-1440.png`, `D-TEC-06g-papelera-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-06-documents-empty-1440.png`, `C-TEC-24-documents-1440.png`.
- Next: `docs/audit/evidence/v18-compare/next-after/tech-documents-{1440,390}.jpg` (lote 11; la de 1440 es idéntica a
  `next-before`).
- xhigh (22/10): `evidencias/xhigh/20/TEC-05-1-{next,v18}-{1440,390}.*`, `TEC-05-2-v18-1440.*` (pestaña «Licencias»),
  `TEC-05-3-v18-1440.*` (vista previa de un PNG), `TEC-05-4-v18-1440.*` (papelera), `TEC-05-5-walletfocus-harness.txt`.
- v2: Next `evidencias/v2/20/TEC-05-1-next-{1440,390}.*`; demo `TEC-05-1-v18-1440.*`; conectado `TEC-05-1-v18c-1440.*`.
- F3/P06 (27/10): `docs/audit/evidence/parity/P06/P06-wallet-after-{1440,390}.jpg` (es, con una licencia y un curso de prueba) y
  `P06-wallet-row-after-1440-en.jpg` (en, la fila «Licence · Not scanned · not shareable · Expires soon»).

---

## TEC-06 · Logbook — v1.8 `S-TEC-07, S-TEC-07a, S-MOD-TEC-07, D-TEC-07, S-CON-10, C-TEC-07/39` ↔ Next `/app/professional/logbook` (M14, N-12)

**Estado global:** IGUAL salvo matices (F3 2026-10-27: antes AUSENTE EN NEXT). La V1 lo dejaba en LATER
(`docs/product/V1_SCOPE.md:78` (LATER)); con SCOPE-2 se portó en local el 22/10 (M14, N-12: migración `20261023200000`, función
`professional-logbook`, `src/features/logbook/*`, BR-17, defaults T-19…T-22; `V1_SCOPE.md:85`), con la composición de la
**demo** (cabecera, categoría, entorno, selección para el expediente, historial, archivo) sobre los campos y las reglas del
**conectado** (aeronave libre ≤ 100, ATA ≤ 10, horas 0–24 por 0,1, «no futura» en Madrid, autodeclarado). Lo que la demo
dejaba a medias (vacíos, el formulario al editar, el conectado sin editar ni borrar) se completó: edición en línea, borrado
desde el archivo (T-22). La selección «Seleccionable para expediente» la lee la copia del Candidate Pack al presentar una
candidatura (T-112, BR-25): es un acto del propio técnico, no compartir con terceros. **P07 no añade código**: re-verifica
cada fila con el bloque `PKG P07` (es, 0…10, 16 pasos, positivos y negativos), `PKG logbook` (en), `tests/db/logbook.test.ts`,
`src/lib/validation/logbook.test.ts`, `src/domain/logbook.test.ts`, `tests/i18n/logbook.test.ts` y la función
(`index_test.ts`); corrige las referencias cruzadas que decían BR-16 / T-15…T-18. En PROD no está desplegado (M-3).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | Demo: «Logbook» `#logbook`, icono BookOpen (`src/LegacyApp.jsx:24`). Conectado: «Logbook» `#logbook` | «Logbook» → `/app/professional/logbook`, icono BookOpen, tras «Documentos» y antes de «Herramientas» (`AppShell.tsx:60`, `NavLinks.tsx:42`); `aria-current` en la página | = (F3: antes −) | — | — | Hecho (P07-01). `PKG P07 0b`, `PKG logbook` (orden del menú) |
| 2 | Cabecera | Demo: «MI EXPERIENCIA» / «Logbook personal.» / «Registro auxiliar privado. No sustituye registros oficiales de la empresa.» (`src/components/v11/Logbook2.jsx:40`). Conectado: h2 «Logbook personal» / «Registro autodeclarado; no constituye certificación de experiencia ni puesta en servicio.» (`Account.jsx:73`) | «MI EXPERIENCIA» / h1 «Logbook personal» / la frase de la demo (`PageHeader`, `page.tsx:39`); la frase del conectado abre el panel «Nueva entrada» ampliada con «Solo tú puedes verlo; las entradas marcadas «Seleccionable para expediente» se copian en el expediente de las candidaturas que presentes.» (`messages/es.json` `logbook.disclaimer`, `LogbookManager.tsx:310`) | ≈ (F3: antes −) | — | — | Hecho (P07-02): las dos cabeceras, sin el punto final de la demo. `PKG P07 0b`, `tests/i18n/logbook.test.ts` |
| 3 | Fecha | Demo: «Fecha de la tarea», `date`, `max=today`, obligatoria, por defecto hoy. Conectado: «Fecha», obligatoria; una fecha futura da «El logbook registra actividad realizada, no futura.» | «Fecha de la tarea», `type=date`, `max` = hoy en Europe/Madrid, obligatoria, por defecto hoy (`LogbookManager.tsx:55-67`, `logbookToday`, T-19); una fecha posterior → «El logbook registra actividad realizada, no futura.» en el esquema, la función y un trigger de BD (`src/domain/logbook.ts:77`, migración `enforce_logbook_entry_date`) | = (F3: antes −) | — | — | Hecho (P07-03). `PKG P07 0b/1`, `src/domain/logbook.test.ts` («today» Madrid), `tests/db/logbook.test.ts` («refuses a date after today in Madrid…») |
| 4 | Aeronave | Demo: «Aeronave», `select` con AIRCRAFT (las 12 de TEC-02, fila 22), por defecto A320 Family. Conectado: «Aeronave», texto obligatorio ≤ 100 | «Aeronave», texto obligatorio ≤ 100 con `datalist` de los 12 modelos de v1.8 y la ayuda «Elige un modelo de la lista o escribe el tuyo (por ejemplo, con la matrícula).»; sin valor por defecto (`LogbookManager.tsx:69-93`, `LOGBOOK_AIRCRAFT_SUGGESTIONS`, T-20) | ≈ (F3: antes −) | — | — | Hecho (P07-04): texto libre del conectado con las sugerencias de la demo (T-20). `PKG P07 0b` (12 sugerencias, `maxlength=100`) |
| 5 | Categoría de tarea | Demo: «Defect Rectification», «Inspection», «Component Replacement», «Troubleshooting», «Sheet Metal / Structures», «Cabin / Interiors»; por defecto la primera | «Categoría de tarea», las 6 en ese orden, por defecto «Defect Rectification» (`LOGBOOK_CATEGORIES`, enum `logbook_category` en BD) | = (F3: antes −) | — | — | Hecho (P07-05). `PKG P07 0b`, `src/domain/logbook.test.ts` («keeps the v1.8 option lists…»), `tests/db/logbook.test.ts` (enums) |
| 6 | Entorno | Demo: «Line Maintenance», «Base Maintenance», «Engine Bay Check», «AOG Intervention», «Workshop»; por defecto la primera | «Entorno», los 5 en ese orden, por defecto «Line Maintenance» (`LOGBOOK_ENVIRONMENTS`, enum `logbook_environment`) | = (F3: antes −) | — | — | Hecho (P07-06). `PKG P07 0b`, mismos tests que la fila 5 |
| 7 | ATA y horas | Conectado: «ATA», texto opcional ≤ 10; «Horas», number con paso 0,1, obligatorio, de 0 a 24 («Horas: valor no válido.») | «ATA (opcional)» ≤ 10; «Horas» `number`, `step=0.1`, `min=0`, `max=24`, obligatorio, ayuda «De 0 a 24, en pasos de 0,1.»; error «Horas: valor no válido. De 0 a 24, en pasos de 0,1.» (`LogbookManager.tsx:123-152`, `isValidLogbookHours`, CHECK `hours between 0 and 24` y `numeric(3,1)`) | ≈ (F3: antes −) | — | — | Hecho (P07-07): el literal del conectado con el rango añadido. `PKG P07 0b/1` (25 h), `src/lib/validation/logbook.test.ts` (límites), `tests/db/logbook.test.ts` (CHECKs) |
| 8 | Descripción | Demo: «Descripción técnica privada», textarea ≤ 3000, obligatoria. Conectado: «Actividad realizada», textarea ≤ 3000 | «Descripción técnica», textarea ≤ 3000, obligatoria (`LogbookManager.tsx:153-168`); «privada» se retira porque la copia del expediente puede llevarla (T-112) | ≈ (F3: antes −) | — | — | Hecho (P07-08). `PKG P07 0b` (`maxlength=3000`), `src/lib/validation/logbook.test.ts` |
| 9 | Seleccionable para el expediente | Demo: «Disponible para seleccionar en Candidate Pack» al crear y «Seleccionable para expediente» en el historial (`cvRelevant`) | «Disponible para seleccionar en Candidate Pack» al crear (con la ayuda sobre matrículas y nombres y «Los expedientes ya enviados conservan su copia.») y «Seleccionable para expediente» en cada fila del historial; `cv_relevant` lo lee la copia del Candidate Pack al presentar la candidatura (BR-25, T-112, migración `20261024300000`); nunca llega a la auditoría | = (F3: antes −) | — | — | Hecho (P07-09). `PKG P07 0b/4` (persiste tras recargar), `PKG pack-view`, `tests/db/logbook.test.ts` («never the selection flag») |
| 10 | Guardar y mensajes | Demo: «Guardar entrada» → «Entrada guardada» / «Logbook actualizado»; error «Indica una tarea realizada, fecha válida y descripción.». Conectado: «Guardar entrada» → «Cambios guardados.» (el formulario no se vacía) | «Guardar entrada» / «Guardando…» → «Entrada guardada» (`role=status`) y el formulario vuelve a los valores por defecto; editar, seleccionar, archivar y restaurar → «Logbook actualizado»; fecha, aeronave o descripción inválidas → «Indica una tarea realizada, fecha válida y descripción.» (`role=alert`), el resto «Revisa los campos marcados.» (`logbookInvalidCopyKey`); creación idempotente (`Idempotency-Key`, RPC `create_logbook_entry`) | = (F3: antes −) | — | — | Hecho (P07-10). `PKG P07 1/2`, `src/features/logbook/form.test.ts`, `tests/db/logbook.test.ts` (replay / CF409) |
| 11 | Historial | Demo: panel «Historial» con h3 «{aeronave} · {categoría}», fecha, descripción y entorno. Conectado: «{fecha} · {aeronave} · ATA {ata} · {horas} h» + descripción. Runtime v2 (conectado T1): «2026-10-20 · A320 EC-QAA · ATA 32 · 3.5 h» + «Sustitución de rueda principal izquierda…» y 2 entradas más (`evidencias/v2/20/TEC-06-1-v18c-1440.txt`). Las horas salen con punto decimal: al portarlas, formato del idioma. | Panel «Historial» (`Ver archivo` a la derecha): h3 «{aeronave} · {categoría}», chip con la fecha (`formatDate`, «27 oct 2026»), «ATA {ata} · {horas} h · {entorno}» con el decimal del idioma («3,5 h» / «3.5 h»), descripción, chip «Autodeclarada»; más recientes primero (fecha, luego creación), las 200 más recientes (la API admite hasta 500) con «Se muestran las {n} entradas más recientes de {total}.»; vacío «Todavía no hay entradas. Las que guardes aparecerán aquí.» (`LogbookManager.tsx:326-450`) | = (F3: antes −) | — | — | Hecho (P07-11): la fila de la demo con el ATA y las horas del conectado. `PKG P07 0b/2` (vacío, «3,5 h»), `PKG logbook` («3.5 h»), `tests/i18n/logbook.test.ts` («hours use the locale's decimal mark») |
| 12 | Editar | Demo: modal «Editar experiencia» + «Los expedientes ya enviados conservan su copia.». Conectado: no se puede editar | «Editar» abre «Editar experiencia» en línea, en la propia fila, con todos los campos y «Guardar cambios» / «Cancelar» → «Logbook actualizado»; la frase sobre los expedientes va en la ayuda de la selección (fila 9) (`LogbookManager.tsx:346-372`, T-22) | ≈ (F3: antes −) | — | — | Hecho (P07-12): en línea en vez de modal (T-22; evita el H-18 de v1.8, fila 16). `PKG P07 5`, `PKG logbook` («inline edit saves») |
| 13 | Archivar | Demo: «Archivar», «Ver archivo» / «Ver activas», «Entradas archivadas», «Restaurar». Conectado: no se puede borrar | «Archivar» → «Logbook actualizado» y la fila sale del historial; «Ver archivo» (`?view=archived`) / «Ver activas»; panel «Entradas archivadas» con «Restaurar» y, solo ahí, «Eliminar» → «Eliminar definitivamente» / «Cancelar» → «Entrada eliminada» (`ConfirmButton`); vacío «No hay entradas archivadas.»; `archived` nace falso (sin grant de insert) (`page.tsx:34`, `LogbookManager.tsx:394-412`) | = (F3: antes −) | — | — | Hecho (P07-13); el borrado definitivo es un añadido (T-22). `PKG P07 7/8`, `tests/db/logbook.test.ts` («…archive, restore, delete», «cannot … insert it archived») |
| 14 | Estado | Conectado: `status:'self-declared'` (`server/app.mjs:140`) | Chip «Autodeclarada» en cada fila; sin columna de estado porque ningún camino puede cambiarlo (migración `20261023200000`, cabecera); nadie salvo el dueño lee una entrada (ni su organización, ni un manager, ni la plataforma) | ≈ (F3: antes −) | — | — | Hecho (P07-14). `PKG P07 2/6/9`, `tests/db/logbook.test.ts` («nobody else reads, edits or deletes it…») |
| 15 | Entradas de ejemplo | Demo: 3 de Marcos B. y 2 por cada técnico ficticio (`src/data/mockData.js:68-96`; `src/data/demoWorld.js:15`) | Ninguna (la semilla local no crea entradas; el smoke borra las suyas) | ✗ | — | — | No portar |
| 16 | Fallos de v1.8 | Demo: la semilla «A320 Family (LEAP-1A)» no está en AIRCRAFT; sin texto de vacío; el panel «Nueva entrada» queda vacío al editar (H-18). Conectado: el formulario no se vacía tras guardar | No se reproducen: aeronave libre (fila 4), vacíos en las dos vistas (filas 11 y 13), edición en línea sin vaciar el panel (fila 12), el formulario se vacía al guardar (fila 10) | ✗ | — | — | No portar (corregidos al portar) |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-07-logbook-1440.png`, `D-TEC-07b-logbook-editar-1440.png`, `D-TEC-07c-logbook-archivo-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-07-logbook-empty-1440.png`, `C-TEC-39-logbook-1440.png`.
- xhigh (22/10): `evidencias/xhigh/20/TEC-06-1-v18-{1440,390}.*`.
- v2: demo `evidencias/v2/20/TEC-06-1-v18-1440.*`; conectado `TEC-06-1-v18c-1440.*` (3 entradas de T1).
- Next (F3, P07): `docs/audit/evidence/parity/P07/P07-logbook-after-{1440,390}.jpg` (es, del bloque `PKG P07 3` sobre `next start`).

---

## TEC-07 · Privacidad, avisos y cuenta — v1.8 `S-TEC-08, D-TEC-08, S-CON-03 (visible, bloqueos, avisos), S-CON-11, S-CON-12, S-CON-12a, C-TEC-08/10/29/42/43` ↔ Next `N-PRO-02 (visibilidad), N-ACC-01`

**Estado global:** PARCIAL. Lo que hay en Next es la visibilidad, con 3 de las 4 opciones de la demo, dentro del
pasaporte.

Faltan (v2: todo portable; entre paréntesis, lo que lo bloqueaba antes):
- «Empresas verificadas» (OD-5 → default v1.8);
- los bloqueos de empresa (D-07 → default v1.8);
- los consentimientos de avisos urgentes y AOG, el silencio y la zona horaria (outreach en LATER → desbloqueado);
- la pantalla de avisos (avisos in-app en LATER → desbloqueado; comprobada en el conectado con 22 avisos);
- «Exportar mis datos» y «Cerrar cuenta» (CX-43/44 → SCOPE-2; cerrar cuenta incluye la limpieza M-3).
Sigue bloqueado el expediente anónimo con documentos (D-07 P3 + D-10).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Dónde está | Demo: pantalla «Privacidad» `#privacy`, «CONTROL DE DATOS» / «Tú eliges quién te ve.» / «Los expedientes anónimos no permiten descargar archivos identificativos.» (`Professional2.jsx:229-266`). Conectado: la visibilidad y los bloqueos están en el pasaporte, y «Mi cuenta» (`#privacy`) sirve para exportar o cerrar la cuenta. Runtime v2: demo «Tú eliges quién te ve.» (`evidencias/v2/20/TEC-07-1-v18-1440.txt`). | Panel «03 · Visibilidad en la red» dentro del pasaporte (`ProfileForm.tsx:148-184`) y `/app/settings`, con idioma y datos de la cuenta | ≈ | P3 | — | — |
| 2 | Opciones | Demo: 4 opciones. Conectado: una casilla, «Aparecer de forma anónima en el directorio de empresas», desmarcada por defecto | 3 opciones de radio: Privado · Anónimo · Abierto (`src/domain/professional.ts:12`; es:426-439) | ≈ | — | C-7 | — |
| 3 | Privado | «Privado»: «Fuera de la búsqueda; puedes presentar candidaturas.» | «Privado»: «Nunca apareces en el matching de las organizaciones.» (es:428) | ≈ | P3 | — | — |
| 4 | Anónimo | «Anónimo»: «Datos técnicos sin nombre ni contacto.» | «Anónimo»: «Tus cualificaciones relevantes pueden emparejarse; tu identidad queda oculta.» (es:432) | ≈ | — | — | — |
| 5 | Empresas verificadas | «Empresas verificadas»: «Perfil anónimo para organizaciones verificadas.» | No existe | − | P2 | — (v2: default v1.8; antes OD-5, TD-53) | Portar la 4.ª opción; default: organización con revisión registrada = verificada (N-09) |
| 6 | Abierto | «Abierto»: «Nombre visible. Contacto y archivos requieren autorización.» | «Abierto»: «Tu nombre se muestra en los resultados. El contacto sigue requiriendo tu consentimiento.» (es:436) | ≈ | — | — | — |
| 7 | Texto de introducción | Conectado («Mi cuenta»): «El perfil se crea privado.» | «El matching respeta tu elección. Los perfiles privados nunca aparecen ante las organizaciones; el contacto siempre requiere tu consentimiento.» (es:558) | + | — | — | — |
| 8 | Valor por defecto | Demo: la semilla es «Anónimo». Conectado: no visible, es decir, privado | `private` (BR-8) | = | — | — | Igual al conectado |
| 9 | Cuándo se guarda | Demo: cada clic guarda y muestra el toast «Perfil profesional guardado» (H-19). Conectado: con «Guardar perfil en mi cuenta» | Con «Guardar cambios» del pasaporte (`ProfileForm.tsx:187-191`) | = | — | — | Igual al conectado |
| 10 | Accesibilidad | Demo: botones con `aria-pressed` | `role=radiogroup` con botones `role=radio` y `aria-checked`, y tabulación itinerante: una sola parada de Tab en la opción marcada y flechas/Inicio/Fin que mueven foco y selección (`ProfileForm.tsx:150-178`; `src/components/ui/radio-group.ts:7-44`) | + (antes ≈) | — | — | Mantener (W3-05) |
| 11 | Bloquear a la empresa actual | Demo: interruptor «Bloquear a mi empresa actual» con el nombre o «Ninguna empresa seleccionada». Conectado: h3 «Organizaciones bloqueadas», una casilla por organización. Runtime v2 (conectado T1): «Organizaciones bloqueadas» con «QA Talent Recruiting» y «QA Aero Mantenimiento S.L.»; T2 bloquea al recruiter, que no ve su perfil (README del conectado). | No existe | − | P2 | — (v2: default v1.8; antes D-07, TD-54) | Portar el bloqueo por organización, que excluye del matching y del directorio (N-08) |
| 12 | Avisos urgentes | Demo: «Alertas de oportunidades urgentes» (`whatsappOptIn`, que también cubre «Planificado», H-26). Conectado: «Quiero avisos internos de trabajos urgentes». Runtime v2 (conectado T1): «Quiero avisos internos de trabajos urgentes», «Quiero avisos internos AOG», «Horas mínimas que necesitas para movilizarte», «Zona horaria IANA para avisos», «Silencio desde/hasta (opcional)» (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). | No existe | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-10). Sin e-mail/SMS/push (OUT) |
| 13 | Contacto AOG | Demo: «Participar en contacto AOG». Conectado: «Quiero avisos internos AOG» | No existe. Marcar `aog_only` ya indica disponibilidad AOG (TEC-04, fila 53) | − | P3 | — (v2: desbloqueado; AOG opt-in en NEXT y outreach en LATER, `V1_SCOPE.md:47,61`) | Portar (N-10) |
| 14 | AOG en horas de silencio | Demo: «Permitir AOG también durante horas de silencio» | No existe | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-10). Sin e-mail/SMS/push (OUT) |
| 15 | Horas de silencio | Demo: «Inicio del silencio» / «Fin del silencio», `time`, por defecto 22:00–07:00. Conectado: «Silencio desde (opcional)» / «Silencio hasta (opcional)»; error «Horas de silencio no válidas.» | No existe | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-10). Sin e-mail/SMS/push (OUT) |
| 16 | Zona horaria de avisos | Conectado: «Zona horaria IANA para avisos», por defecto Europe/Madrid; error «Zona horaria no válida.» | No existe (todo es UTC, BR-10) | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-10). Sin e-mail/SMS/push (OUT) |
| 17 | Movilización para avisos | Conectado: «Horas mínimas que necesitas para movilizarte» (0–720) + «Sin movilización declarada no se distribuyen avisos. El silencio también se respeta para AOG; no se envían correos o SMS.» | No existe | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-10). Sin e-mail/SMS/push (OUT) |
| 18 | Aviso de la demo | «La activación de demo respeta estas preferencias. No se envían mensajes externos. Los archivos y contacto se desbloquean solo tras consentimiento y aceptación; la previsualización de candidatura muestra lo que verá la organización.» | — | ✗ | — | — | No portar (solo demo) |
| 19 | Pantalla de avisos | Conectado: «Avisos internos» + «Configura Urgente/AOG, movilización y silencio desde tu perfil. No se envían correos ni notificaciones push en esta beta.»; vacío «No tienes avisos.»; botón «Ver oportunidades». Demo: campana. Runtime v2 (conectado T1): 22 avisos, p. ej. «Urgente: Urgente B1.1 A320 · C-check parcial · Nuevo», «AOG: AOG B2 A320 · aviónica (vacantes)» y «Actualización de candidatura · Nuevo» con el estado en inglés crudo («shortlisted», «proposed»), cada uno con «Ver oportunidades» (`evidencias/v2/20/TEC-07-2-v18c-1440.txt`). | No existe | − | P2 | — (v2: desbloqueado, avisos in-app en LATER; D-06 ratificada; antes SCOPE M12 / D-06) | Portar con estados traducidos (N-11; coordinar con HIRE-07, área 30) |
| 20 | Texto de la cuenta | Conectado: «Tu cuenta y tus datos» + «Las herramientas no comparten tus cálculos con las empresas. El perfil se crea privado. El servidor de esta beta está en este equipo; no uses documentación personal real durante las pruebas.» (`Account.jsx:56`). Runtime v2 (conectado): mismo texto (`evidencias/v2/20/TEC-07-1-v18c-1440.txt`). | «Configuración» + «Tu cuenta y cómo ves Crew Flex. Los datos de negocio están en tu pasaporte o en las páginas de la organización.» (es:946-947) | ≈ | — | — | — |
| 21 | Exportar datos | Conectado: «Exportar mis datos y archivos» → `CrewFlex-mis-datos.json` + «Exportación preparada.». Runtime v2 (conectado): botón visible en «Mi cuenta». | No existe | − | P2 | — (v2: SCOPE-2 «copiarlo todo»; no está en OUT; antes SCOPE, CX-43) | Portar (N-13) |
| 22 | Cerrar cuenta | Conectado: `<details>` «Cerrar cuenta» + «Elimina credenciales, perfil y archivos. …»; campo «Escribe CERRAR»; «Cerrar mi cuenta»; errores «Escribe CERRAR para confirmar.» y «Resuelve primero los compromisos aceptados o confirmados.» | No existe (solo las cascadas de claves ajenas) | − | P2 | — (v2: default v1.8, con la limpieza de archivos M-3; antes retención P3/M-3, CX-44) | Portar (N-14) |
| 23 | Idioma | Solo español | ES/EN guardado en el perfil (N-ACC-01) | + | — | — | Mantener |
| 24 | Expediente anónimo | Demo `projectedPack`: los documentos se ven como «Documento protegido» hasta el desbloqueo | No hay Candidate Pack | − | P2 | D-07 P3 + D-10 (documentos del Pack); el resto del Pack, M09, preparado y apagado | — |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-08-privacidad-1440.png`, `D-TEC-09-notificaciones-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-10-privacy-1440.png`, `C-TEC-42-privacy-close-open-1440.png`,
  `C-TEC-43-account-closed-1440.png`, `C-TEC-08-notifications-empty-1440.png`, `C-TEC-29-notifications-1440.png`,
  `C-TEC-13-profile-filled-1440.png` (bloque de avisos y bloqueos).
- Next: `docs/audit/evidence/local-10-passport-1440.jpg` (`108a244`, panel de visibilidad) y
  `docs/audit/evidence/local-14-settings-en-{1440,768,390}.jpg`.
- xhigh (22/10): `evidencias/xhigh/20/TEC-07-1-v18-{1440,390}.*`; Next en `TEC-02-1-next-{1440,390}.*`.
- v2: Next `evidencias/v2/20/TEC-07-1-next-{1440,390}.*` (Configuración) y `TEC-02-1-next-*` (visibilidad); demo `TEC-07-1-v18-1440.*`; conectado `TEC-07-1-v18c-1440.*` («Mi cuenta») y `TEC-07-2-v18c-1440.*` (22 avisos).

---

## TEC-08 · Medallas, insignias, avatar e identidad — v1.8 `S-TEC-02f, S-MOD-TEC-09, S-MOD-CON-02, D-TEC-01 (medallas), D-TEC-02 (foto), C-TEC-33` ↔ Next `N-PRO-01 (avatar de iniciales); sustituto parcial: chips de N-PRO-03`

**Estado global:** IGUAL salvo matices (F3: antes PARCIAL). Los paquetes shell-visual (N-15, N-23; T-143, T-144) y P02
(T-163) dejaron las medallas de `badges()`, la tira con «+{n}», el detalle, el pasaporte visual con la foto en el
navegador y los logros de aprendizaje; re-verificado en código y en ejecución (delta) el 2026-10-26. Difieren por diseño:
las organizaciones no ven medallas (fila 8, T-143) y el seudónimo para empresas es distinto (T-04).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cómo se calculan | `badges()` (`progress.js:3-11`): por categoría (`specialty` si es NDT o Sheet Metal; si no, `category`); por capacidad NDT o Sheet Metal que no sea categoría; por habilitación «{aircraft} · {category}» (`aircraft`); por experiencia «{years} años». Sin duplicados por `id` | `badges()` (`src/domain/badges.ts`, BR-29): por categoría (`specialty` si NDT o Sheet Metal; si no, `category`; la principal primero), por capacidad NDT / Sheet Metal sin su categoría, por habilitación «{aeronave} · {categoría}», por experiencia; sin duplicados por `id`; además «Verificada» cuando un revisor verificó ese código (BR-29.4) | = (F3: antes −) | — | — | Hecho (N-15, T-143). `src/domain/badges.test.ts` |
| 2 | Estados y detalle | «Declarado» con «Categoría declarada en el perfil; pendiente de validación de su alcance.» o «Especialidad declarada. No acredita métodos, niveles ni autorización.». «Revisar vigencia» con «La fecha declarada requiere revisión.». «Con restricciones» con el texto de las restricciones. «Tipo declarado» con «Habilitación de tipo declarada. La autorización de firma corresponde a la organización; no se deduce de una medalla.». «Experiencia declarada» con «Experiencia indicada por el profesional; no es una certificación.» | Los mismos estados y detalles, literales (es `badges.status.*`, `badges.detail.*`): «Declarado» con «Categoría declarada en el perfil; pendiente de validación de su alcance.» o «Especialidad declarada. No acredita métodos, niveles ni autorización.»; «Revisar vigencia» con «La fecha declarada requiere revisión.»; «Con restricciones» con el texto de las restricciones; «Tipo declarado» con «Habilitación de tipo declarada. La autorización de firma corresponde a la organización; no se deduce de una medalla.»; «Experiencia declarada» con «Experiencia indicada por el profesional; no es una certificación.» (`ProfessionalMedals.tsx`) | = (F3: antes −) | — | — | Hecho (N-15, T-143). Smoke `PKG shell-visual 2` (detalle), `PKG passport 4` (restricción) |
| 3 | Tira principal | Hasta 4 medallas (experiencia, categoría, aeronave, especialidad) + «+{n}», con `aria-label` «Ver {n} insignias adicionales»; «−» para plegar (`MedalStrip.jsx:5-8`) | `MedalStrip` (`src/features/professional/components/MedalStrip.tsx`): hasta 4 medallas (experiencia, categoría, aeronave, especialidad) + «+{n}» con `aria-label` «Ver {n} insignias adicionales»; «−» para plegar; en el pasaporte visual, todas (`all`). Runtime F3 (delta, inicio): «12 AÑOS · B1.1 · A320 · +1» | = (F3: antes −) | — | — | Hecho (N-15, BR-29.5). Smoke `PKG shell-visual 2`, `PKG passport 4` |
| 4 | Contenido de la medalla | Experiencia: «{years}» + «AÑOS». Categoría: escudo con la etiqueta. Aeronave: avión + modelo sin « Family». Especialidad: Wrench + «SM» para Sheet Metal | Experiencia: «{years}» + «AÑOS» («AÑO» si 1). Categoría: escudo con la etiqueta. Aeronave: avión + modelo sin « Family» (`aircraftShort`). Especialidad: llave + «SM» para Sheet Metal (`MedalStrip.tsx`, `ProfessionalMedals.tsx`) | = (F3: antes −) | — | — | Hecho (N-15). Unit `badges.test.ts` (aircraftShort); captura `docs/audit/evidence/parity/P02/P02-passport-after-1440.jpg` |
| 5 | Estado caducado | Clase `expired` si el estado es «Revisar vigencia» | Borde discontinuo (`border-dashed border-warn`) cuando el estado es «Revisar vigencia» (`MedalStrip.tsx` `expired`); además el chip «Caducado» / «Caduca pronto» en la fila de la cualificación (`QualificationsManager.tsx`) | = (F3: antes ≈) | — | — | Hecho (N-15). Solo código: la semilla no tiene habilitaciones vencidas |
| 6 | Accesibilidad | `aria-label="{label}: {status}"`, `title="{label} · {status}"` | `aria-label="{label}: {status}"`, `title="{label} · {status}"` en cada medalla; la tira es `role=group` «Insignias del perfil» (`MedalStrip.tsx`) | = (F3: antes −) | — | — | Hecho (N-15). Smoke `PKG shell-visual 2` (aria-labels) |
| 7 | Detalle | `role="status"` con «×» (`aria-label` «Cerrar detalle de insignia»), «{label} · {status}», el detalle y «Resumen del perfil; no concede autorización de firma ni acredita formación por participar en retos.» (`MedalStrip.jsx:9`) | `role="status"` con «×» (`aria-label` «Cerrar detalle de insignia»), «{label} · {status}», el detalle y «Resumen del perfil; no concede autorización de firma ni acredita formación por participar en retos.» (`MedalStrip.tsx`; es `badges.footnote`) | = (F3: antes −) | — | — | Hecho (N-15). Smoke `PKG shell-visual 2` |
| 8 | Dónde aparecen | Inicio (ambos modos), pasaporte (todas en la demo; vista previa en el conectado), directorio de empresas y Candidate Pack | Inicio (hero de «Mi espacio») y pasaporte («Pasaporte visual», todas). No en el directorio ni en el Candidate Pack: las medallas solo las ve el titular (T-143, T-156); las organizaciones ven las declaraciones en la tarjeta de candidato (`get_requirement_candidate_passports`) | ≈ (F3: antes −) | P3 | — | Mantener (T-143): las organizaciones no ven medallas |
| 9 | Pasaporte visual | `<section aria-label="Insignias profesionales">`, kicker «PASAPORTE VISUAL»; vacío «Añade categorías, habilitaciones y experiencia para completar tu pasaporte visual.»; pie «Las insignias resumen datos declarados. No conceden autorización de firma ni sustituyen la revisión de licencia, tipo o competencia.» (`Badges.jsx:8-11`) | `<section aria-label="Insignias profesionales">`, kicker «Pasaporte visual» (mayúsculas por CSS); vacío «Añade categorías, habilitaciones y experiencia para completar tu pasaporte visual.»; pie «Las insignias resumen datos declarados. No conceden autorización de firma ni sustituyen la revisión de licencia, tipo o competencia.»; además el avatar con «Añadir foto» y el `<details>` «Documentos y cursos próximos a revisar» (`PassportVisual.tsx`; es `badges.passport.*`) | = (F3: antes −) | — | — | Hecho (N-15, T-163). Smoke `PKG P02 1/5` |
| 10 | Logros de aprendizaje | «Logros de aprendizaje» + «Privados en este navegador · separados de las cualificaciones.»; «Primer reto» (1 día), «Una semana aprendiendo» (7 días seguidos), «Constancia de 30 días» (30 días seguidos); «Racha actual: {n} días · Mejor racha: {n} · Retos completados: {n}» (`Badges.jsx:9-10`) | Panel «Logros de aprendizaje» bajo el pasaporte visual (y en Mi espacio): «Privados en este navegador · separados de las cualificaciones.»; «Primer reto» (1 día), «Una semana aprendiendo» (7 días seguidos), «Constancia de 30 días» con «Por conseguir · {n} días seguidos» / «Desbloqueado»; «Racha actual: {n} días · Mejor racha: {n} · Retos completados: {n}» (`src/features/tools/components/LearningAchievements.tsx`, `LearningMedals.tsx`; BR-16) | = (F3: antes −) | — | — | Hecho (TOOL-08 en el área 40; en el pasaporte, T-163). Smoke `PKG P02 1/5` |
| 11 | Sustituto en Next | — | Chips de verificación y caducidad por cualificación y el KPI «Verificadas {v} de {a}» (`QualificationsManager.tsx:328-333`; `page.tsx:133-144`) | + | — | — | Mantener |
| 12 | Foto del avatar | Solo demo: `localStorage['crewflex-avatar-v1-'+id]`, data URL jpeg/png/webp (`ProfileIdentity.jsx:5-12`). El conectado nunca ofrece la foto (C §3.15-16) | `localStorage["crewflex-avatar-v1-" + id]` con el id de la sesión verificada; solo data URL jpeg/png/webp (`src/features/professional/avatar.ts`, `ProfileAvatar.tsx`); nunca se sube ni se enseña a nadie más (T-144) | = (F3: antes −) | — | — | Hecho (N-23, T-144). Unit `avatar.test.ts`; smoke `PKG shell-visual` (N-23) |
| 13 | Subir la foto | «Añadir foto» / «Cambiar foto» / «Guardando…» y «Quitar foto»; `accept="image/jpeg,image/png,image/webp"`; nota «Foto guardada solo en este navegador · JPG, PNG o WebP · hasta 2 MB». Errores: «Elige una foto JPG, PNG o WebP de hasta 2 MB.», «No se ha podido guardar la foto. Comprueba el archivo y el espacio del navegador.», «No se ha podido quitar la foto.». Recorte cuadrado de 320×320 en JPEG 0,85, hasta 8000 px (`ProfileIdentity.jsx:16-17`) | «Añadir foto» / «Cambiar foto» / «Guardando…» y «Quitar foto»; `accept="image/jpeg,image/png,image/webp"`; nota «Foto guardada solo en este navegador · JPG, PNG o WebP · hasta 2 MB»; errores literales de v1.8; recorte cuadrado 320×320 JPEG 0,85, rechazo por encima de 8000 px (`ProfileAvatar.tsx` `AvatarPhotoControls`; `avatar.ts`; es `profileHero.photo.*`) | = (F3: antes −) | — | — | Hecho (N-23, T-144). Smoke `PKG shell-visual` (foto válida, inválida y quitar); `PKG P02 1` |
| 14 | Iniciales | Mayúsculas de las dos primeras palabras; sin nombre, icono UserRound; con `anonymous`, «CF» | Iniciales de las dos primeras palabras en mayúsculas (`src/features/professional/identity.ts:5-13`), en la tarjeta de Mi espacio (`src/features/professional/components/IdentityCard.tsx:22-27`). Sin icono de reserva (el nombre es obligatorio) ni «CF» anónimo (no hay vista anónima propia). El «CF» del menú sigue siendo el logotipo (`AppShell.tsx:84-89`) | ≈ (antes −) | — | — | Mantener (W2-01) |
| 15 | `aria-label` del avatar | «Avatar de {name \|\| 'profesional'}» o «Identidad protegida» | El avatar es `aria-hidden` porque el nombre se lee al lado; la tarjeta es `<section aria-label="Tu identidad profesional">` (`IdentityCard.tsx:18-27`, es:483) | ≈ (antes −) | — | — | Mantener |
| 16 | Identidad en el menú | Demo: avatar pequeño + nombre + «Identidad profesional» (`src/LegacyApp.jsx:81`). Conectado: «Cuenta autenticada» / «Servidor local · datos propios» | Pie del menú (≥ lg): `display_name` + tipo de cuenta, «Profesional», más el rol si también es miembro de una organización + «Cerrar sesión» (`AppShell.tsx:117-132`; `src/components/layout/account-summary.ts:15-26`; es:466). Runtime: «Technician Alpha» / «Profesional · Miembro» (`evidencias/xhigh/20/TEC-01-1-next-1440.txt`) | ≈ | P3 | — | Opcional: iniciales en el pie |
| 17 | Nombre anónimo ante empresas | `anonymous` → «Técnico · identidad protegida». `publicCandidate` → «Técnico {code}» (`business.js:222-227`) | `candidate_ref` «CF-» + 10 hex por necesidad; el nombre solo se ve si es interno u `open` (EXH:142-176) | ≈ | — | T-04 | Ver el diff de matching |
| 18 | Código estable | Demo: `CF-001…CF-208` por perfil. Conectado: `T-{owner[0:8]}` en el directorio (`server/connected.mjs:33`) | Seudónimo distinto en cada necesidad: T-04 rechaza las referencias estables | ✗ | — | T-04 | No portar |
| 19 | El técnico ve su código | No, en ninguna de sus pantallas (solo en el `DemoSwitcher`) | No | = | — | — | — |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-01b-insignias-1440.png`, `D-TEC-02-pasaporte-1440.png` (pasaporte visual),
  `D-TEC-02i-pasaporte-foto-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-33-home-medal-detail-1440.png`.
- Next: no hay pantalla de medallas; el avatar de iniciales y el pie del menú, en `evidencias/xhigh/20/TEC-01-1-next-{1440,390}.*`
  (xhigh). Medallas de la demo: `TEC-01-1-v18-1440.jpg`, `TEC-02-1-v18-1440.jpg`.
- v2: Next `evidencias/v2/20/TEC-01-1-next-1440.*`, `TEC-01-10-next-{390,360}.jpg`; demo `TEC-01-1-v18-1440.*`; conectado `TEC-01-1-v18c-1440.*` y `TEC-01-2-v18c-1440.*` (medallas de T1 y T2).
- F3 / P02 (26/10): `docs/audit/evidence/parity/P02/P02-passport-after-1440.jpg` (pasaporte visual con las 4 medallas de delta, foto y lista de 60 días) y `docs/audit/evidence/parity/P01/P01-home-after-1440-es.jpg` (hero con medallas).

---

## TEC-09 · Textos — cobertura de los ficheros del alcance — v1.8 `TechnicianHome, ProfileIdentity, MedalStrip, Badges, AvailabilityPlanner, planning, homeModel, progress, Professional2, Logbook2, ConnectedHome, ConnectedCalendar, connectedModel` ↔ Next `messages/es.json` (`professional`, `qualifications`, `availability`, `documents`, `domain`)

**Estado global:** PARCIAL. **v2:** la tabla pasa a la cuenta oficial regenerada para v2
(`textos/string-coverage-v2.md`, `821c24f`; de `821c24f` a `038329f` el catálogo solo cambia en 12 líneas de necesidades,
fuera de este alcance), con su método: 2 101 cadenas de UI del bundle, cada una en el primer fichero que la contiene. Por
eso el total del alcance baja de 288 a 262 cadenas y algunos ficheros cambian de tamaño (Professional2 92 → 82, Logbook2
28 → 18, planning 8 → 5). Entre paréntesis, el valor xhigh con el mismo método (`textos/string-coverage.md`). Total del
alcance: 262 cadenas, 36 exactas (31) y 12 cercanas (8): 18 % (15 %). Sube por M07/M08 en el inicio (TechnicianHome 17 %
→ 35 %, ConnectedHome 4 % → 18 %) y por «Asignada» en el calendario conectado (59 % → 64 %); siguen a 0 % ProfileIdentity,
MedalStrip, progress y homeModel.

| Fichero v1.8 | Prosa | Exactas | Cercanas | Solo v1.8 | % |
|---|---|---|---|---|---|
| `src/components/v11/Professional2.jsx` | 82 | 10 | 0 | 72 | 12 % |
| `src/beta/ConnectedHome.jsx` | 28 | 3 (1) | 2 (0) | 23 (27) | 18 % (4 %) |
| `src/features/progress.js` | 28 | 0 | 0 | 28 | 0 % |
| `src/features/TechnicianHome.jsx` | 23 | 6 (3) | 2 (1) | 15 (19) | 35 % (17 %) |
| `src/beta/ConnectedCalendar.jsx` | 22 | 10 | 4 (3) | 8 (9) | 64 % (59 %) |
| `src/features/AvailabilityPlanner.jsx` | 18 | 2 | 1 | 15 | 17 % |
| `src/components/v11/Logbook2.jsx` | 18 | 0 | 1 | 17 | 6 % |
| `src/features/Badges.jsx` | 13 | 2 | 1 | 10 | 23 % |
| `src/features/ProfileIdentity.jsx` | 10 | 0 | 0 | 10 | 0 % |
| `src/beta/connectedModel.js` | 7 | 1 | 1 | 5 | 29 % |
| `src/features/planning.js` | 5 | 2 | 0 | 3 | 40 % |
| `src/features/MedalStrip.jsx` | 4 | 0 | 0 | 4 | 0 % |
| `src/features/homeModel.js` | 4 | 0 | 0 | 4 | 0 % |
| **Total del alcance** | **262** | **36 (31)** | **12 (8)** | **214 (223)** | **18 % (15 %)** |

Diferencias de texto que no salen en TEC-01…08 o que conviene destacar:

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cadenas que coinciden | «Tu perfil, conectado.», «Patrón de trabajo y descanso», «Días del ciclo», «Día 1 del ciclo (UTC)», «Usar 7–3 / 7–4 como base», «Publicar descansos generados como disponibles», «Previsualizar ciclo en el mes», «Descartar cambios», «Elige entre 1 y 31 días.», «El ciclo debe caber en 31 días.», «Otro · ciclo personalizado», «Documentos y cursos próximos a revisar», «Fecha superada», «Mes anterior», «Mes siguiente», «Parcial», «Solo AOG», «Disponible», «Descanso». Desde el 22/10, también: «Base por completar», «Editar perfil», «Completar», «Completar los datos te ayuda a encontrar oportunidades. El porcentaje no equivale a una revisión documental.», «TU DISPONIBILIDAD», «Tu tiempo, a tu manera.» y «Pulsa cada casilla para alternar trabajo y descanso. Puedes dibujar cualquier distribución y repetirla, aunque no sea un bloque regular.» v2 (M07/M08 y la marca de asignación): «Oportunidades para ti», «Mis candidaturas», «Ver todas», «Ver seguimiento», «Tu próxima candidatura empieza aquí», «Asignaciones confirmadas» y, sin el punto final de Next, «Todavía no hay oportunidades compatibles». | Las mismas cadenas en es:545, 685-695, 707, 722-723, 731, 518, 520, 667-668, 654-656. Las nuevas, en es:484, 486, 511, 496, 515, 630 y 689 Las de v2, en es:578, 579, 580, 581, 583, 577 y 582 (`textos/string-coverage-v2.md`). | = | — | — | — |
| 2 | Cadenas cercanas | «Planifica el ciclo», «Reemplazar también los días que ya he guardado o editado en este mes», «Publicar los descansos generados como días disponibles», «Próximos 60 días», «Tu pasaporte está al {score}%» v2: «Aún no hay oportunidades compatibles» (conectado) y «Asignado». | «Planifica tu ciclo», «Reemplazar también los días que ya he guardado en este mes», «Publicar descansos generados como disponibles», «Próximos {days} días», «Tu pasaporte está al {percent}%», que en pantalla es igual: solo cambia el nombre del marcador (es:684, 694, 692, 521, 493). La nueva cercana «Empresas» ≈ «Empresa» (`nav.views.organization`, es:77, árbol de trabajo) es una coincidencia casual del script, no una paridad. También son casuales otras 3 de las 9 cercanas del alcance: «Tu perfil profesional» ≈ «Sin perfil profesional» (es:488), «Día 1 del ciclo» (demo) ≈ «Días del ciclo» (es:688) y «MI EXPERIENCIA» ≈ «Experiencia» (es:538); las cercanas reales son 5 (recuento rehecho sobre `string-diff.json`, primer fichero no muerto) v2: «Todavía no hay oportunidades compatibles.» (es:582) y «Asignada» (es:744), cercanas reales. Son casuales «Buscar oportunidades» ≈ «Buscar oportunidad» (`opportunities.searchLabel`, la etiqueta del buscador, no el botón de la demo) y «Revisar candidaturas» ≈ «Retirar candidatura» (`applications.action.withdrawn`; además es del inicio de empresa). | ≈ | — | — | — |
| 3 | Plurales | v1.8 no los trata: «1 apartados por completar», «1 jornadas», «Racha actual: 1 días», «1 tienen una excepción manual.», «1 oportunidades», «1 días modificados» (H-12; C §3.15-3) | Plural ICU en todas las cadenas con número (es:485, 495, 506, 508-509, 541, 729, 732, 734) | + | — | — | Mantener. Al portar textos de v1.8, añadir plural |
| 4 | Errores sin traducir | — | Ninguno. Las acciones devuelven claves: `common.checkFields` (`src/features/availability/actions.ts:54`; `src/features/documents/actions.ts:41`), `v.form.window` (`availability/actions.ts:75,83`) y `v.form.qualification` (`qualifications/actions.ts:36,44`) (es:21, 346-347). `actionErrorCopy` no muestra nunca un mensaje crudo del servidor (`src/components/ui/Notice.tsx:100-130`). Un `grep` de los literales en inglés en `src/` no devuelve nada | = (antes +) | — | — | Mantener (W1-04) |
| 5 | Mayúsculas del mes | v1.8: «octubre de 2026», capitalizado por CSS como «Octubre De 2026» en el inicio (runtime v2, demo y conectado); en el calendario, «octubre de 2026» en minúscula en los dos modos (runtime v2) | X-18: `formatMonth` pone la mayúscula inicial en todas partes, «Octubre de 2026», en el inicio y en el calendario (`src/i18n/format.ts:38-42`; `AvailabilityMonth.tsx:37`; runtime v2 `evidencias/v2/20/TEC-01-1-next-1440.txt`, `TEC-04-1-next-1440.txt`) | ≈ | P3 | — | Mantener (X-18) |
| 6 (nueva) | Iguales en pantalla que el script no detecta | «Tu perfil. Tu tiempo.» + «Tu próxima oportunidad.» (dos literales separados por `<br/>`) y «{n} apartados por completar» (`TechnicianHome.jsx:15`) | Una sola clave con `<br>` (es:492) y un plural ICU (es:495). El script las cuenta como «solo v1.8» aunque el texto mostrado coincide (salvo «1 apartado», que corrige el plural) | = | — | — | — |

Capturas: no aplica.

---

## Recuento

Elementos por tipo de diff, contados sobre las filas de las tablas de TEC-01 a TEC-09; la tabla de cobertura de TEC-09
no se cuenta:

| Sección | = | ≈ | ≠ | − | + | ✗ | Total |
|---|---|---|---|---|---|---|---|
| TEC-01 Inicio | 12 | 33 | 3 | 10 | 11 | 0 | 69 |
| TEC-02 Pasaporte | 4 | 21 | 3 | 18 | 3 | 1 | 50 |
| TEC-03 Cualificaciones | 2 | 10 | 5 | 2 | 8 | 0 | 27 |
| TEC-04 Disponibilidad | 17 | 33 | 3 | 0 | 9 | 2 | 64 |
| TEC-05 Documentos | 9 | 14 | 0 | 9 | 4 | 1 | 37 |
| TEC-06 Logbook | 0 | 0 | 0 | 14 | 0 | 2 | 16 |
| TEC-07 Privacidad y cuenta | 2 | 6 | 0 | 12 | 3 | 1 | 24 |
| TEC-08 Medallas e identidad | 1 | 5 | 0 | 11 | 1 | 1 | 19 |
| TEC-09 Textos | 3 | 2 | 0 | 0 | 1 | 0 | 6 |
| **Total** | **50** | **124** | **14** | **76** | **40** | **8** | **312** |

Recuento hecho con script (`work/20/count.py`: solo filas de tablas de elementos con columna «Diff», respetando los
`\|` escapados). xhigh: 309 filas, = 51 · ≈ 110 · ≠ 16 · − 85 · + 39 · ✗ 8. Refresco de la mañana: 302 filas, = 58 ·
≈ 100 · ≠ 12 · − 85 · + 39 · ✗ 8. El 21/10 eran 299 filas: = 45 · ≈ 96 · ≠ 18 · − 94 · + 38 · ✗ 8.

Por severidad (filas con impacto; las demás llevan «—»): P0 1 · P1 10 · P2 34 · P3 87. Filas sin severidad: 180. Por
sección: TEC-01 P2 10 · P3 20; TEC-02 P1 4 · P2 8 · P3 14; TEC-03 P0 1 · P1 4 · P2 1 · P3 4; TEC-04 P2 2 · P3 11; TEC-05
P1 2 · P2 2 · P3 8; TEC-06 P2 1 · P3 13; TEC-07 P2 6 · P3 8; TEC-08 P2 4 · P3 8; TEC-09 P3 1. (xhigh: P0 1 · P1 16 · P2 37 ·
P3 85, sin severidad 170; mañana del 22/10: P0 1 · P1 16 · P2 36 · P3 78; 21/10: P0 1 · P1 16 · P2 41 · P3 98.)

Lo que cambia el podio en v2:
1. **P0 · OD-3** (TEC-03, fila 16), igual que antes: con la revisión apagada en PROD ninguna cualificación puede quedar
   `verified`; con M07/M08, eso impide además presentar candidatura (T-08). En PROD la completitud se queda en el 86 % como
   máximo (TEC-01, fila 34). Sigue bloqueado: es activación en producción.
2. **P1 · catálogo y restricciones** (TEC-02, filas 20, 22, 23 y 25; TEC-03, filas 2, 20 y 21): faltan B1.2, B1.4, B3,
   Mecánico, Sheet Metal y Helper, la experiencia por aeronave, las habilitaciones aeronave × categoría y las
   restricciones. **Ya no están bloqueadas**: pasan a default v1.8 (N-01, N-02).
3. **P1 · wallet** (TEC-05, filas 1 y 33): no está en PROD (despliegue del owner) y compartir documentos sigue bloqueado
   por D-07 P3 + D-10. TEC-03 fila 15 (P1, revisores) es la otra cara de OD-3.

Sale del podio Mi espacio: los contadores y los feeds de oportunidades y candidaturas ya existen (M07/M08); lo que queda
(punto rojo, filtro por día, «Asignado» en el mini calendario) es P2 y portable. Los defectos nuevos de mayor severidad son
P2: el mini calendario no marca la asignación (TEC-01, fila 49) y el ciclo pisa los días asignados (TEC-04, fila 26).

---

## Backlog derivado

Tareas portables con el alcance nuevo (NOW + NEXT + LATER, SCOPE-2), en local, ordenadas por severidad. Todas en
`~/pau/Crew_Flex`. Las que tocan `supabase/` necesitan autorización del owner para desplegar, aunque se pueden hacer y
probar en local; las que usan un default v1.8 deben dejarlo documentado como reversible (`08-product-decisions.md`, tabla
de defaults técnicos) y actualizar `docs/product/BUSINESS_RULES.md` si tocan el matching (sin IA en la elegibilidad).

Estado a 22/10/2026 (v2, `038329f`): 26 PENDIENTE (P1 2 · P2 14 · P3 10; S 7 · M 13 · L 6), 17 HECHO, 6 bloques que siguen
fuera. Las B-01…B-17 del xhigh se resuelven abajo; B-06 y B-07 pasan a N-20 y N-21.

### PENDIENTE · P1

1. **N-01 · Catálogo de v1.8: 12 categorías, categoría principal y aeronaves declaradas.** Filas: TEC-02 20-22; TEC-03 2;
   TEC-01 26-27. Default v1.8 de C-10/D-03.
   - Ficheros: nueva migración (tipos B1.2, B1.4, B3, Mecánico, Sheet Metal y Helper; categoría principal; aeronaves
     declaradas, las 12 de la demo); `src/domain/professional.ts`, `src/lib/validation/professional.ts`,
     `src/features/professional/components/ProfileForm.tsx`, `src/features/qualifications/components/QualificationsManager.tsx`,
     `messages/{es,en}.json`, `docs/product/BUSINESS_RULES.md`.
   - Aceptación: el `select` ofrece las 12 categorías; la principal no admite `""`; se declaran aeronaves de la lista;
     tests de dominio y de validación; RLS de dueño con test.
   - Tamaño: L. BD/Edge: sí (migración; `professional-profile` / `professional-qualifications`).
2. **N-02 · Habilitaciones aeronave × categoría con restricciones, y restricciones generales.** Filas: TEC-02 23, 25-27;
   TEC-03 20-21. Default v1.8 de C-10/D-02 (`server/rules.mjs:27`).
   - Ficheros: migración (restricciones por habilitación y texto general); `src/domain/matching.ts` y su SQL de candidatos;
     `supabase/functions/_shared/applications.ts` (confirmación); `QualificationsManager.tsx`; `messages`; BUSINESS_RULES.
   - Aceptación: una habilitación lleva aeronave, categoría, vigencia, documento y restricciones; con restricciones no
     cumple una necesidad que pide licencia y el bloqueador se explica; con restricciones generales la confirmación se
     rechaza; paridad SQL↔TS con tests.
   - Tamaño: L. BD/Edge: sí.

### PENDIENTE · P2

3. **N-03 · Calendario de Mi espacio interactivo: punto rojo, filtro por día, «Asignado» y leyenda.** Filas: TEC-01 47-51
   y 54. Corrige el defecto v2 de la fila 49. Default v1.8 (demo y conectado).
   - Ficheros: `src/features/availability/components/AvailabilityMonth.tsx` (variante cliente), `src/app/app/professional/page.tsx`,
     `src/features/applications/components/ProfessionalActivity.tsx`, `src/features/availability/calendar.ts`
     (`assignmentDays`), `messages/{es,en}.json`.
   - Aceptación: los días con oportunidades compatibles llevan punto y «{d}: {estado}. {n, plural} oportunidades»; pulsar un
     día filtra el feed y cambia el h2 a «Oportunidades · {día}» con «Quitar selección de fecha»; los días con asignación
     confirmada dicen «Asignado» (delta: 22/10); los pasados, deshabilitados; leyenda con «Asignado» y «● Oportunidades»;
     test puro del mapa día → oportunidades.
   - Tamaño: M. BD/Edge: no.
4. **N-04 · Proteger los días asignados (default v1.8 en lugar de T-13).** Filas: TEC-04 26, 43 y 52. Necesita que el owner
   revierta T-13 (es un default técnico revisable).
   - Ficheros: `AvailabilityManager.tsx` (`disabled` y mensaje), `src/features/availability/rotation.ts` (`planCycle` salta
     los asignados), migración (las escrituras de disponibilidad no pueden quitar la de un día con asignación confirmada),
     `supabase/functions/professional-availability/index.ts`, `messages`, BUSINESS_RULES BR-4, `08-product-decisions.md`.
   - Aceptación: el día asignado sale `disabled` con «Una asignación confirmada está protegida.»; la vista previa con
     «Reemplazar…» no lo toca (hoy sí, `evidencias/v2/20/TEC-04-11-next-1440.log.txt`); una escritura directa responde
     409/22023; tests Vitest, Deno y SQL.
   - Tamaño: M. BD/Edge: sí.
5. **N-05 · Inglés técnico, motores, capacidades y herramientas propias.** Filas: TEC-02 31-33 y 40. Default v1.8 de C-10.
   - Ficheros: migración, `ProfileForm.tsx`, `src/lib/validation/professional.ts`, `messages`; el matching solo si una
     necesidad los pide (con BUSINESS_RULES).
   - Aceptación: A1-C2, los 7 motores, las 9 capacidades y el interruptor, guardados con RLS de dueño; tests.
   - Tamaño: M. BD/Edge: sí (migración).
6. **N-06 · Tarifa mínima y unidad.** Filas: TEC-02 37; TEC-01 30. Alcance LATER; default v1.8 de OD-7 sin dinero real.
   - Ficheros: migración (`min_rate`, `rate_unit`), `ProfileForm.tsx`, validación, `messages`.
   - Aceptación: ≥ 0,01; «EUR / hora» o «EUR / día»; privada (no la ve ninguna organización sin una decisión aparte);
     test de validación.
   - Tamaño: S. BD/Edge: sí (migración).
7. **N-07 · Permisos de trabajo (27 de la UE) y base ligada al país.** Filas: TEC-02 17 y 41; TEC-01 31. Default v1.8 de
   OD-6/D-04.
   - Ficheros: migración (`work_permits` con CHECK, país de la base), `ProfileForm.tsx`, `src/domain/matching.ts` + SQL de
     candidatos, país en la necesidad (coordinar con el área 30), BUSINESS_RULES.
   - Aceptación: 27 casillas; bloqueador «Falta declarar permiso de trabajo para el país.»; paridad SQL↔TS; tests.
   - Tamaño: L. BD/Edge: sí.
8. **N-08 · Teléfono, empresa actual y organizaciones bloqueadas.** Filas: TEC-02 16 y 18; TEC-07 11. Default v1.8 (D-07
   P1 ratificado para el contacto).
   - Ficheros: migración (`phone`, tabla de bloqueos) con RLS; SQL de matching, oportunidades y directorio; `ProfileForm.tsx`.
   - Aceptación: una casilla por organización; la bloqueada no ve al técnico (test RLS); el teléfono solo se comparte con
     el consentimiento de D-07 P1.
   - Tamaño: M. BD/Edge: sí.
9. **N-09 · Visibilidad «Empresas verificadas».** Filas: TEC-07 5. Default v1.8 de OD-5 (organización con revisión
   registrada).
   - Ficheros: migración (valor nuevo del enum), matching, `ProfileForm.tsx`, `messages`, BR-8.
   - Aceptación: cuarta opción del radiogroup; una organización sin revisión no lo ve (test RLS).
   - Tamaño: M. BD/Edge: sí.
10. **N-11 · Avisos internos del técnico.** Filas: TEC-07 19. Alcance LATER; coordinar con HIRE-07 (área 30).
    - Ficheros: migración (`notifications` + RLS), Edge Function, página de avisos, `AppShell.tsx`, `messages`.
    - Aceptación: lista con «Nuevo», marcar como leído, «Ver oportunidades»; estados traducidos (nunca «shortlisted»);
      solo in-app (e-mail, SMS y push siguen OUT).
    - Tamaño: L. BD/Edge: sí.
11. **N-12 · Logbook personal.** Filas: TEC-06 1-14. Alcance LATER.
    - Ficheros: migración (`logbook_entries`, RLS de dueño), página `/app/professional/logbook`, `src/features/logbook/*`,
      `AppShell.tsx`, `messages`.
    - Aceptación: campos del conectado (fecha ≤ hoy, aeronave, ATA ≤ 10, horas de 0 a 24 con paso 0,1, actividad ≤ 3000) y
      de la demo (categoría, entorno, «Seleccionable para expediente»); «El logbook registra actividad realizada, no
      futura.»; editar, archivar y restaurar; horas con el formato del idioma; tests.
    - Tamaño: L. BD/Edge: sí.
12. **N-13 · Exportar mis datos y archivos.** Filas: TEC-07 21; TEC-05 35. SCOPE-2 (no está en OUT). **HECHO** para los
    archivos del wallet (`c93a227`; TEC-05 35 `=`, `PKG P06 7b`); TEC-07 21 lo re-verifica P13.
    - Ficheros: Edge Function nueva con el JWT del usuario; `/app/settings`; `messages`.
    - Aceptación: JSON con perfil, cualificaciones, disponibilidad, documentos y candidaturas propios; test de que no
      incluye datos ajenos.
    - Tamaño: M. BD/Edge: sí (Edge).
13. **N-14 · Cerrar cuenta.** Filas: TEC-07 22. Default v1.8, con la limpieza de archivos M-3.
    - Ficheros: Edge Function (borrar el usuario exige la API de administración: justificación de service role en
      `EDGE_FUNCTIONS.md`, autorización explícita y evento de auditoría), `/app/settings`, `messages`.
    - Aceptación: «Escribe CERRAR»; se rechaza con compromisos aceptados o confirmados; borra los archivos del bucket;
      audita.
    - Tamaño: L. BD/Edge: sí.
14. **N-15 · Medallas y pasaporte visual.** Filas: TEC-08 1-9; TEC-01 9. Default v1.8 (resumen de lo declarado).
    - Ficheros: `src/domain/badges.ts` (puro), `IdentityCard.tsx`, componente de la tira, `messages`.
    - Aceptación: hasta 4 medallas + «+N» con `aria-label`; detalle con «no concede autorización de firma…»; los estados de
      v1.8 más «Verificada» de Next; test del dominio.
    - Tamaño: M. BD/Edge: no.
15. **N-16 · Completitud según v1.8.** Filas: TEC-01 22, 24 y 29-35. Default v1.8 de R-D5.
    - Ficheros: `src/domain/professional.ts`, `src/app/app/professional/page.tsx`, `messages`, BUSINESS_RULES BR-11.
    - Aceptación: primero, solo cuentan ventanas futuras (`ends_at > now`), con test; después, los 10 apartados del
      conectado cuando existan N-01, N-06 y N-07; «cualificación verificada» fuera o como «pendiente de revisor».
    - Tamaño: S. BD/Edge: no.
16. **N-17 · «Posibles en descanso» en el feed.** Filas: TEC-01 57. Default v1.8 (demo).
    - Ficheros: `supabase/functions/opportunities/index.ts` (cumple todo salvo la disponibilidad), `ProfessionalActivity.tsx`,
      `messages`.
    - Aceptación: fila con «Posible en descanso: revisa y publica tus fechas» y «Revisar fechas» → calendario de ese mes;
      test Deno.
    - Tamaño: M. BD/Edge: sí (Edge).

### PENDIENTE · P3

17. **N-10 · Preferencias de avisos: urgente, AOG, silencio, zona horaria y movilización.** Filas: TEC-07 12-17; TEC-02 38
    y 47. Alcance LATER.
    - Ficheros: migración, `ProfileForm.tsx` o `/app/settings`, validación (horas, IANA), `messages`.
    - Aceptación: campos y errores de v1.8 («Horas de silencio no válidas.», «Zona horaria no válida.»); sin canales
      externos.
    - Tamaño: M. BD/Edge: sí.
18. **N-18 · Modal «Estado de mi perfil» (opcional).** Filas: TEC-01 11. AB-27, ya no bloqueado.
    - Aceptación: enlace que abre un `<dialog>` con la lista y «Completar», Escape lo cierra con el foco de vuelta.
    - Tamaño: S. BD/Edge: no.
19. **N-19 · Papelera del wallet.** Filas: TEC-05 30. Default v1.8. **HECHO** (`edb7850`, migración `20261024200000`, T-100/T-101;
    re-verificado en P06: `PKG P06 6`).
    - Ficheros: migración (`archived_at`), `DocumentWallet.tsx`, `documents-maintenance` (purga al vaciar).
    - Aceptación: «Archivar», «Papelera», «Restaurar» y el vacío «Los documentos archivados pueden restaurarse.».
    - Tamaño: M. BD/Edge: sí.
20. **N-20 · Pestañas o filtro por tipo en el wallet** (antes B-06). Filas: TEC-05 6. SCOPE-2 desbloquea AB-34. **HECHO**
    (`edb7850`, T-102; re-verificado en P06: `PKG P06 3`).
    - Aceptación: chips con `aria-pressed` («Todos», «Licencias», «Cursos», «Otros»); el contador refleja el filtro.
    - Tamaño: S. BD/Edge: no.
21. **N-21 · Visor de PDF e imagen en la app** (antes B-07). Filas: TEC-05 28. SCOPE-2 desbloquea AB-28. **HECHO** (`edb7850`,
    `a9fda5a`, T-103; re-verificado en P06: `PKG P06 5`).
    - Ficheros: `DocumentWallet.tsx` (`<dialog>` con `<object>` o `<img>` sobre la URL firmada), `src/proxy.ts` (CSP).
    - Aceptación: Escape cierra con el foco de vuelta; una URL caducada da error y no un diálogo vacío; la CSP no informa
      violaciones.
    - Tamaño: M. BD/Edge: no.
22. **N-22 · Feeds de Mi espacio completos.** Filas: TEC-01 55, 56 y 59-61.
    - Ficheros: `ProfessionalActivity.tsx`, `messages`.
    - Aceptación: base y licencia en la línea de cada oportunidad; botón por fila («Ver oferta», «Ver seguimiento»); 5 filas;
      vacíos con su frase y «Abrir mi calendario» / «Buscar oportunidades».
    - Tamaño: S. BD/Edge: no.
23. **N-23 · Foto del avatar, solo en el navegador.** Filas: TEC-08 12-13; TEC-01 6. Default v1.8 (demo).
    - Aceptación: JPG, PNG o WebP de hasta 2 MB, recorte de 320×320, guardada en `localStorage` por usuario, errores de
      v1.8; nunca sale del navegador.
    - Tamaño: S. BD/Edge: no.
24. **N-24 · Asistente de 5 pasos del pasaporte (opcional).** Filas: TEC-02 7, 8 y 43. AB-33, ya no bloqueado.
    - Aceptación: pasos «Identidad», «Cualificaciones», «Experiencia y cursos», «Disponibilidad y tarifa», «Resumen» sobre
      el mismo guardado único; sin borrador automático si no se decide aparte.
    - Tamaño: M. BD/Edge: no.
25. **N-25 · Insignia «{%} completado · {n} evidencias» en el pasaporte.** Filas: TEC-02 5.
    - Tamaño: S. BD/Edge: no.
26. **N-26 · Rechazar ventanas con inicio pasado también en servidor** (resto de B-12). Filas: TEC-04 42 y 57. Opcional:
    el conectado también las acepta.
    - Ficheros: `src/lib/validation/availability.ts`, migración (`create_availability_window` y PATCH), la Edge Function y
      su test Deno.
    - Aceptación: POST y PATCH directos con inicio pasado → 400/22023; tests.
    - Tamaño: M. BD/Edge: sí.

### HECHO

- B-01 días pasados no editables (`bfbe531`); B-02 versión del calendario (`43a3bbb`, solo local); B-03 cabecera y tarjeta
  (`1764e8e`); B-04 barra de progreso (`c6d380b`); B-05 confirmaciones (`73de8ff`); B-08 documento vinculado
  (`0945b8f`); B-09 textos (`c188801`); B-10 errores traducidos (`135085c`); B-11 documentación (`f433b20`).
- B-12, la parte del formulario: inicio pasado rechazado (X-19, `befd21d`); el servidor queda en N-26.
- B-13 foco tras confirmar y wallet con `ConfirmButton` (X-08, `4357034`); B-14 fallo de red sin perder la página (X-02,
  `1c2616c`); B-15 aviso de vista previa vacía (X-15, `a941e87`); B-16 error de carga distinto de «sin perfil» (X-16,
  `61cc473`); B-17 tarjeta apilada en móvil (X-17, `50658e8`). Todas comprobadas en ejecución salvo B-16 (solo código y
  test).
- Contadores y feeds de Mi espacio (TEC-01 38-39, 55-56, 59-61, 68-69) y la marca «Asignada» en Disponibilidad (TEC-04
  39): M07/M08, `db05af1`.

### Sigue fuera (BLOQUEADO)

- OD-3, activación en PROD: verificación y revisores (TEC-03 15-16) y el tope del 86 % en PROD (TEC-01 34).
- D-07 P3 + D-10: compartir documentos con organizaciones y el Pack con documentos (TEC-05 33-34; TEC-07 24); análisis
  antivirus y revisión de documentos (TEC-05 25-26; TEC-03 27); la evidencia documental al confirmar (TEC-03 23).
- D-06 Q6: turnos recomendados o una candidatura por jornadas sueltas (TEC-01 58), hasta que el owner revise Q6 para la
  cobertura parcial.
- SCOPE OUT: «· {n} sin leer» de la conversación (chat) (TEC-01 60) y los avisos por e-mail, SMS o push.
- T-04: el código estable del técnico (TEC-08 18, ✗).
- Despliegues remotos (owner): el wallet en PROD (TEC-05 1) y la versión del calendario (TEC-04 50).
