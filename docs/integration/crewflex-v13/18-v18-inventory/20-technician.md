# 20 · Diff v1.8 ↔ Next — Pantallas del técnico/profesional

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
| TEC-01 #58 | Bloqueo | C-9/D-08 | D-06 Q6 (una candidatura = un periodo) | `08-product-decisions.md` §2026-10-22 |
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

**Estado global:** PARCIAL. Next tiene ya la cabecera de v1.8 («Mi espacio», el h1 literal y «Herramientas»), la tarjeta
de identidad con avatar de iniciales, nombre, base y años, y la barra de progreso con su recuento y su nota (W2-01, W2-02,
W2-09). Mantiene el esqueleto informativo: completitud con lista enlazada, mini calendario de solo lectura y caducidades a
60 días. **v2 (`038329f`):** tiene ya los contadores «Oportunidades compatibles» y «Asignaciones confirmadas» (más
«Candidaturas en curso» y «Propuestas por aceptar») y los feeds «Oportunidades para ti» y «Mis candidaturas», de 3 filas
cada uno (M07/M08, `db05af1`); el error de carga ya no se confunde con una cuenta de organización (X-16) y la tarjeta se
apila en móvil (X-17).

Le falta (todo portable ya, salvo lo marcado):
- las medallas y la foto de la tarjeta (default v1.8; la foto, solo en el navegador);
- en el mini calendario: el punto rojo, el filtro por día y «Asignado»;
- en las filas de los feeds: base, categoría, tarifa y botón por fila; y los textos de vacío completos;
- los turnos recomendados del conectado (D-06 Q6: una candidatura = un periodo).

La completitud se calcula sobre 7 apartados (BR-11) en lugar de 10:
- 4 apartados de v1.8 no cuentan;
- 2 apartados son nuevos;
- en PROD, «cualificación verificada» es inalcanzable (OD-3).
- v2: R-D5 sigue abierta, así que la fórmula de v1.8 pasa a default portable a medida que existan sus campos (fila 22).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | Demo: «Mi espacio» `#home` y dock «Inicio» (`src/LegacyApp.jsx:24,69`). Conectado: «Mi espacio» `#home` y dock «Inicio» | «Mi espacio» → `/app/professional` (`src/components/layout/AppShell.tsx:29`, es:65). Sin dock. Un admin de plataforma con cuenta profesional entra también por «Ver como» → «Técnico», sobre su propia cuenta, como el «Probar como» de la demo (`src/components/layout/views.ts:8-13,39-48`; `AppShell.tsx:109-114`; es:74-76; árbol de trabajo, D-13); su entrada por defecto es `/app/admin` (`src/app/app/page.tsx:7`). Un profesional con membresía (alpha) entra en `/app/organization` (`page.tsx:8`) y ve la sección de su organización encima de «Profesional» (comprobado: `evidencias/xhigh/20/TEC-01-1-next-1440.jpg`). v2: el menú del técnico añade «Oportunidades» y «Mis candidaturas» tras «Disponibilidad», en el orden de v1.8 (`AppShell.tsx:33-35`; runtime `evidencias/v2/20/TEC-01-1-next-1440.txt`). | ≈ | P3 | — (v2: el dock va en SH-05, área 10; C-12 es la marca, no el dock) | Mantener. El dock va en el diff del shell |
| 2 | Cuenta sin perfil técnico | Conectado: tarjeta con «Tu perfil profesional» / «Base por completar» (`src/beta/connectedModel.js:3`) | «Sin perfil profesional» / «Esta cuenta es una cuenta de organización.» (`src/app/app/professional/page.tsx:55-57`, es:488-489). Runtime v2 con `admin.mro` (en): «No professional profile» / «This account is an organization account.» (`evidencias/v2/20/TEC-01-4-next-1440.txt`). | + | — | — | Mantener |
| 3 | Kicker | Demo «MI ESPACIO» (`src/features/TechnicianHome.jsx:15`). Conectado «TU CUENTA CONECTADA» (`src/beta/ConnectedHome.jsx:15`) | «Mi espacio», en mayúsculas por CSS como en la demo (`page.tsx:113`, es:491; `src/components/ui/PageHeader.tsx:17-18`) | = (antes ≠) | — | — | Mantener (W2-01) |
| 4 | h1 | «Tu perfil. Tu tiempo.» + salto + «Tu próxima oportunidad.» en ambos modos. A 390 px se pinta sin espacio en los dos modos: «…Tu tiempo.Tu próxima…» (conectado: `v18-runtime-connected.md` C-TEC-01; demo: `evidencias/xhigh/20/TEC-01-1-v18-390.txt`) | «Tu perfil. Tu tiempo.» + `<br>` + «Tu próxima oportunidad.» (`page.tsx:114`, es:492). El espacio antes del `<br>` evita el «tiempo.Tu» de v1.8; el nombre pasa a la tarjeta (fila 7) | = (antes ≠) | — | — | Mantener (W2-01) |
| 5 | Botón «Herramientas» | Icono Wrench → `#tools` (`TechnicianHome.jsx:15`; `ConnectedHome.jsx:15`) | «Herramientas» → `/app/tools`, botón secundario en las acciones de la cabecera, sin icono (`page.tsx:115`, es:72) | ≈ (antes −) | — | — | Mantener (W2-01). Next no pone iconos en los botones |
| 6 | Avatar en la tarjeta | Grande. Foto de `localStorage`, iniciales de las dos primeras palabras o icono UserRound (`src/features/ProfileIdentity.jsx:6-12`). Runtime: demo «MB», conectado sin perfil «TP» | Círculo navy de 56 px con las iniciales, `aria-hidden`; sin foto ni icono de reserva, porque el nombre es obligatorio (`src/features/professional/components/IdentityCard.tsx:22-27`; `src/features/professional/identity.ts:5-13`) | ≈ (antes −) | P3 | — (foto: v2 default v1.8, solo en el navegador; antes D-07/D-10) | Mantener las iniciales (W2-01). La foto, en TEC-08 |
| 7 | Nombre en la tarjeta | `profile.name \|\| 'Tu perfil profesional'` (`ProfileIdentity.jsx:18`; `connectedModel.js:3`) | `display_name` en la tarjeta (`src/features/professional/components/IdentityCard.tsx:30`). Es obligatorio en la cuenta, así que no hace falta el «Tu perfil profesional» de reserva | = (antes ≈) | — | — | — |
| 8 | Línea «base · años» | «{location \|\| 'Base por completar'}» + « · {years} años de experiencia declarada» si hay años (`ProfileIdentity.jsx:18`). Runtime: «Madrid (MAD) · 8 años de experiencia declarada» | «{base \|\| 'Base por completar'}» + « · {n} años de experiencia declarada» si hay años > 0, con plural ICU («1 año…», donde v1.8 diría «1 años») (`src/features/professional/components/IdentityCard.tsx:31-36`; es:484-485). El panel «Perfil» con `ProfileFacts` sigue al pie (`src/features/professional/components/ProfessionalSections.tsx:10-19`, es:535-541) | = (antes ≈) | — | — | Mantener (W2-01) |
| 63 (nueva) | Nombre accesible de la tarjeta | `<div className="cf-identity">` sin nombre accesible (`src/features/ProfileIdentity.jsx:18`) | `<section aria-label="Tu identidad profesional">` (`src/features/professional/components/IdentityCard.tsx:18-21`, es:483) | + | — | — | Mantener |
| 9 | Medallas en la tarjeta | `MedalStrip` principal: 4 medallas + «+N» (`src/features/MedalStrip.jsx:5-9`). Runtime: «8 AÑOS · B1.1 · A320 · SM · +3». Runtime v2: T1 «8 AÑOS · B1.1 · A320 · +2»; T2 «3 AÑOS · B1.1 · A320 · SM · +1» (`evidencias/v2/20/TEC-01-1-v18c-1440.txt`, `TEC-01-2-v18c-1440.txt`). | No existen | − | P2 | — (v2: default v1.8; antes OD-3, TD-15/16) | Ver TEC-08 (N-15) |
| 10 | «Editar perfil» | Botón con icono UserRound → `profile` | «Editar perfil» → `/app/professional/profile` en la tarjeta, sin icono (`src/features/professional/components/IdentityCard.tsx:38`, es:486). «Editar pasaporte» sigue en el panel «Perfil» (`page.tsx:283-287`, es:504) | ≈ (xhigh: antes =) | — | — | Mantener (W2-01). Mismo criterio que la fila 5: el texto coincide, falta el icono |
| 11 | «Estado de mi perfil» | Enlace ↗ que abre un modal (S-MOD-TEC-01 / S-MOD-CON-01) | Panel en línea con `<details>` (`page.tsx:218-266`) | ≈ | — | — | Mantener (TD-18 VERIFIED_LOCAL). El modal (AB-27) es opcional: SCOPE-2 ya no lo bloquea (N-18) |
| 12 | Frase del porcentaje | Demo «Tu pasaporte está al {score}%». Conectado «Tu perfil está al {score}%» | «Tu pasaporte está al {percent}%» encima de la barra, solo por debajo del 100 % (`page.tsx:220-224`, es:493). Siguen el KPI «Perfil completado» «{percent}%» (`page.tsx:125-130`, es:497) y el título del panel (es:512). v2: el KPI usa `formatPercent` (X-05, `src/i18n/format.ts:45-46`): «86%» en ES. | = (antes ≈) | — | — | Mantener (W2-02). Igual a la demo |
| 13 | Apartados pendientes | Demo «{n} apartados por completar», sin plural («1 apartados», H-12). Conectado «{n} por completar» | «{n} apartado(s) por completar», con plural ICU (`page.tsx:231-233`, es:495). El KPI sigue mostrando solo el primero: «Siguiente: …» (es:526-533) | = (antes ≠) | — | — | Mantener (W2-02; corrige «1 apartados», H-12) |
| 14 | Barra `<progress>` | `max=100`, `value=score`, `aria-label="Perfil completado al {score} por ciento"` | `<progress max={100} value={percent} aria-label="Perfil completado al {percent} por ciento">` (`page.tsx:225-230`, es:494) | = (antes −) | — | — | Mantener (W2-02) |
| 64 (nueva) | Ubicación del bloque de progreso | Demo: dentro de la tarjeta del pasaporte, bajo «Editar perfil» / «Estado de mi perfil» (`TechnicianHome.jsx:15`). Conectado: igual, con «Tu perfil está al {score}%» | En el panel «Perfil completado · {percent}%», junto al calendario y separado de la tarjeta de identidad (`page.tsx:218-236`) | ≈ | P3 | — | Opcional: mover el bloque a la tarjeta |
| 15 | Umbral de la barra | Visible si `score<95` (`TechnicianHome.jsx:15`; `ConnectedHome.jsx:15`). Con 10 apartados avanza de 10 en 10, así que solo se oculta al 100 % (H-25; C §4.6-1) | El bloque de progreso y `<details open>` solo se ven por debajo del 100 % (`page.tsx:220,237`; justificado en `:217`). Tono ok solo al 100 % (`:128`). Con 7 apartados: 0, 14, 29, 43, 57, 71, 86, 100 | ≈ | — | — | Mantener < 100 (justificado en `page.tsx:219`) |
| 16 | Nota del porcentaje | Demo «Completar los datos te ayuda a encontrar oportunidades. El porcentaje no equivale a una revisión documental.». Conectado «Información cumplimentada. La revisión documental es un proceso independiente.» | Siempre visible, también al 100 %: «Completar los datos te ayuda a encontrar oportunidades. El porcentaje no equivale a una revisión documental.» (`page.tsx:236`, es:496). Al 100 % el KPI añade «Todos los elementos del perfil están completos. No es un estado de verificación.» (es:498) | ≈ | — | — | Mantener (W2-02). Literal igual a la demo; la demo la oculta desde el 95 % |
| 17 | Título del estado | Modal «Estado del perfil · {score}%» | Panel «Perfil completado · {percent}%» (es:512) | ≈ | P3 | — | Mantener |
| 18 | Texto de introducción | Demo «Información cumplimentada; la revisión de documentos y cualificaciones es independiente.» | No hay frase propia: la nota de la fila 16, siempre visible, dice lo mismo (W2-09 la omite a propósito) | ≈ (antes −) | — | — | Mantener |
| 19 | Fila de apartado | «✓/○ {label}» + «Completar», que cierra el modal y navega (`homeModel.js:4-5`; `connectedModel.js:4`) | «✓/○» `aria-hidden` + etiqueta + texto oculto «hecho/pendiente» + `ButtonLink` «Completar», solo en los pendientes, como en v1.8 (`page.tsx:242-263`, es:511-514) | = (antes ≈) | — | — | Mantener (W2-09) |
| 20 | Todo completo | «Los apartados de información están completados.» | `<details>` cerrado y el KPI con «Todos los elementos…» (es:498). Runtime v2 con echo (100 %): KPI «100%» + «Todos los elementos…», panel «Perfil completado · 100%» con la nota y «Los 7 apartados del perfil» plegado, sin barra (`evidencias/v2/20/TEC-01-7-next-1440.txt`). Conectado T1 al 100 %: sin bloque de progreso; el modal lista los 10 apartados con ✓ (`evidencias/v2/20/TEC-01-3-v18c-1440.txt`). | ≈ | — | — | — |
| 21 | Resumen plegable | — | `<summary>` «Los {count} apartados del perfil» (es:517) | + | — | — | Mantener |
| 22 | Fórmula: número y peso | Demo `profileCompletion`: 10 apartados del mismo peso (`src/business.js:85-88`). Conectado `readiness`: 10 apartados (`connectedModel.js:4`). `round(hechos/10·100)`. Runtime v2 (conectado): «Estado del perfil · 100%» con Nombre, Base habitual, Categoría, Aeronaves, Experiencia, Tarifa mínima, Países de trabajo, Disponibilidad futura, Cursos y Documento aportado (`evidencias/v2/20/TEC-01-3-v18c-1440.txt`); T2 «· 90%» con «○ Cursos» + «Completar» (`TEC-01-5-v18c-1440.txt`). | 7 apartados del mismo peso, `round(hechos/7·100)` (`src/domain/professional.ts:55-89`) | ≠ | P2 | — (v2: default v1.8; antes R-D5) | Portar como default documentado la fórmula del conectado (10 apartados) a medida que existan sus campos (filas 29-33); hasta entonces, mantener los 7 (N-16) |
| 23 | Apartado: nombre | Demo `name.trim()`. Conectado `!!p.name` | `displayName.trim()` (`professional.ts:56`) | = | — | — | — |
| 24 | Apartado: contacto | Demo «Datos de contacto»: `email \|\| phone` (`homeModel.js:4`) | No cuenta: el email es de la cuenta y no hay teléfono | − | P3 | — (v2: default v1.8; antes R-D5) | Ninguna (en Next siempre se cumpliría) |
| 25 | Apartado: base | Demo `location` (un select que siempre tiene valor). Conectado «Base habitual»: `!!p.base` | «Base»: `baseLocation.trim()` (`professional.ts:57`) | = | — | — | — |
| 26 | Apartado: categoría | Demo «Categorías»: `categories.length`. Conectado «Categoría»: `!!p.category` | «Licencia o habilitación de tipo declarada»: alguna LICENSE o TYPE_RATING `active` (`professional.ts:59-65`, es:567) | ≈ | — | — (v2: default v1.8; antes C-10) | Mantener |
| 27 | Apartado: aeronaves | Demo «Aeronaves o especialidad»: `aircraft.length` o una categoría de Sheet Metal / NDT / Helper. Conectado «Aeronaves»: `!!p.aircraft` | Va dentro del apartado anterior: un TR-* cuenta | ≈ | P3 | — (v2: default v1.8; antes C-10) | — |
| 28 | Apartado: experiencia | `years>0` en ambos modos | `yearsExperience > 0` (`professional.ts:58`) | = | — | — | — |
| 29 | Apartado: cursos | Demo «Cursos declarados»: `courses.length`. Conectado «Cursos»: `!!p.courses?.length` | No cuenta (TRAINING no es apartado) | − | P3 | — (v2: default v1.8; antes R-D5) | — |
| 30 | Apartado: tarifa | Demo «Tarifa»: `minRate>0`. Conectado «Tarifa mínima»: `hourlyRate>0` | No existe (no hay tarifa, TD-37) | − | P3 | — (v2: default v1.8; antes R-D5 / OD-7) | — |
| 31 | Apartado: países | Conectado «Países de trabajo»: `countries?.length`. La demo no lo tiene | No existe (TD-41) | − | P3 | — (v2: default v1.8; antes R-D5 / OD-6) | — |
| 32 | Apartado: disponibilidad | Demo «Disponibilidad publicada»: algún día `>= today()` en available/aog. Conectado «Disponibilidad futura»: algún intervalo con `end > now` | «Días disponibles publicados»: ventanas con `status ≠ unavailable` de **cualquier fecha**, pasadas incluidas (`page.tsx:98`; `src/features/professional/api.ts:41-46` no filtra por fecha; BR-11 «never looks at today») | ≠ | P2 | — (v2: default v1.8; antes R-D5) | Contar solo ventanas futuras (`ends_at > now`), como el conectado (N-16) |
| 33 | Apartado: documento | «Documento aportado». Demo: `!demo && !deleted` → `docs`. Conectado: `documents.length` → `documents` | No cuenta (el wallet está tras un flag) | − | P3 | — (v2: default v1.8; antes R-D5 / D-10: el wallet propio es NOW) | — |
| 34 | Apartado: cualificación verificada | No existe: v1.8 no exige revisión para el porcentaje | «Al menos una cualificación verificada» (`professional.ts:66-70`, es:568). En PROD, con OD-3 apagado, nadie verifica: el perfil se queda en un 86 % (6 de 7) como máximo con la pista «Siguiente: un revisor verifica una cualificación» (es:531), que el técnico no puede cumplir. Local ≠ PROD: en local alpha muestra «5 de 5» verificadas porque la semilla inserta `verification_status = 'verified'` directamente como superusuario (`supabase/seed.sql:28-47,97`), no por la revisión; el flag local de revisión solo abre `/app/admin/verifications` a un platform admin. Su 86 % local viene de otro apartado: la visibilidad sigue en «Privado» y la pista es «Siguiente: elige visibilidad anónima o abierta» (`evidencias/xhigh/20/TEC-01-1-next-1440.jpg`). En PROD no hay semilla, la revisión está cerrada en tres capas y `qualification-reviews` no está desplegada (`memory-bank/01-current-state.md` §OD-3) | + | P2 | OD-3 (activación en PROD) (v2: default v1.8 = no contarlo; antes OD-3 / R-D5) | Default v1.8: no contarlo, o mostrarlo como «pendiente de revisor» sin restar (N-16). En PROD sigue el tope del 86 % mientras OD-3 no se active |
| 35 | Apartado: visibilidad | No existe | «Visible para organizaciones (anónimo o abierto)» (`professional.ts:72`, es:570) | + | — | — (v2: default v1.8 = no cuenta; antes R-D5) | Mantener mientras el owner no lo revise; el default v1.8 no lo cuenta (N-16) |
| 36 | Destino de cada apartado | Demo: 8 → `profile`, 1 → `calendar`, 1 → `docs`. Conectado: 8 → `profile`, 1 → `calendar`, 1 → `documents` | 4 → `/profile`, 2 → `/qualifications`, 1 → `/availability` (`page.tsx:27-35`) | ≈ | — | — | — |
| 37 | Valores de ejemplo | Demo Marcos B.: 90 %, falta «Documento aportado» (D-TEC-01c). Conectado T1: 100 %; T2: 80 % (C-TEC-45, C-TEC2-02). Runtime v2: conectado T1 100 % y T2 90 % («Tu perfil está al 90%», «1 por completar»; `evidencias/v2/20/TEC-01-2-v18c-1440.txt`); demo 90 % (`evidencias/v2/20/TEC-01-1-v18-1440.txt`). | Sin semilla en PROD. La semilla local no tiene ventanas `aog_only` (next-static §5.7). Alpha en local: 86 %, le falta «Visible para organizaciones» (runtime, `evidencias/xhigh/20/TEC-01-1-next-1440.jpg`; demo 90 %: `TEC-01-2-v18-1440.jpg`). Runtime v2: alpha 86 %; echo, foxtrot y oscar 100 % (`evidencias/v2/20/TEC-01-{1,7,8,9}-next-1440.txt`). | ≈ | — | — | — |
| 38 | KPI «oportunidades compatibles» | Demo `model.compatible.length` (runtime «9»). Conectado `opportunities.length`. Conectado: ofertas publicadas no bloqueadas con alguna jornada futura libre en la que `eligible()` no da errores (`connectedModel.js:11-16`). Runtime v2: demo «9», T1 «4», T2 «2» (`evidencias/v2/20/TEC-01-1-v18c-1440.txt`) | «Oportunidades compatibles» = `total` de `listOpportunities({ eligible: "1" })`: necesidades publicadas y vigentes en las que la elegibilidad propia (cualificaciones obligatorias verificadas, disponibilidad del periodo) se cumple; «—» si falla la carga (`src/features/applications/components/ProfessionalActivity.tsx:26,37-41`; `supabase/functions/opportunities/index.ts:45-60`; es:574). Runtime v2: «0» para alpha, foxtrot y oscar (alpha ve «1 requisito obligatorio pendiente» en la B737); «1» para delta, echo y hotel cuando el área 30 publicó «E2E diff v2 · B» (`evidencias/v2/20/TEC-01-11-next-1440.txt`, `TEC-01-12-next-1440.txt`, `TEC-01-13-next-1440.txt`; `TEC-01-1-next-1440.txt`, `TEC-01-5-next-1440.txt`) | ≈ (v2: antes −) | — | — (v2: M07 hecho, D-12) | Mantener (`db05af1`). Cuenta el periodo entero, no jornadas sueltas (D-06 Q6) |
| 39 | KPI «asignaciones confirmadas» | Candidaturas `Confirmada` / `confirmed`. Runtime v2: demo «0», T1 «3», T2 «0». | «Asignaciones confirmadas» = candidaturas propias en `confirmed`; «—» si falla la carga (`ProfessionalActivity.tsx:32,48`; es:577). Runtime v2: «0» para alpha; «1» para delta, con su candidatura `confirmed` del área 30 (en inglés, «CONFIRMED ASSIGNMENTS 1», `evidencias/v2/20/TEC-01-11-next-1440.txt`) | ≈ (v2: antes −) | — | — (v2: D-06 ratificada) | Mantener (`db05af1`) |
| 40 | KPIs propios de Next | — | Perfil completado · Cualificaciones · Verificadas «{v} de {a}» + «{n} pendiente(s) de revisión» · Ventanas de disponibilidad · Visibilidad (`page.tsx:123-152`, es:497-506). v2: debajo, una segunda fila de 4 KPIs de actividad (filas 38, 39 y 68). | + | — | — | Mantener |
| 41 | KPI «Cualificaciones» | — | `active.length`: solo las cualificaciones que se poseen; las retiradas ya no cuentan (`page.tsx:132`) | + | — | — | Mantener (W2-01) |
| 42 | Panel «Próximos pasos» | — | Cualificaciones rechazadas o en espera de revisor, con «Abrir cualificaciones» (`page.tsx:154-172`, es:507-510). Runtime v2: echo «1 cualificación espera a un revisor. Hasta que se verifique no cuenta para los requisitos obligatorios.»; oscar «1 cualificación ha sido rechazada por un revisor. Lee el motivo y corrígela.» + «Abrir cualificaciones» (`evidencias/v2/20/TEC-01-7-next-1440.txt`, `TEC-01-9-next-1440.txt`). | + | — | — | Mantener |
| 43 | «Documentos y cursos próximos a revisar» | En v1.8 está en el pasaporte visual (`src/features/Badges.jsx:10`), no en el inicio | Panel en Mi espacio (`page.tsx:173-215`) | ≈ | — | — | Ver TEC-05, fila 24 |
| 44 | Calendario: kicker y título | Demo: kicker «TU DISPONIBILIDAD» + h2 del mes, «octubre de 2026», que el CSS capitaliza como «Octubre De 2026». Conectado: h2 del mes sin kicker («Octubre De 2026») | Panel «Tu disponibilidad» (es:515) + `<p>` con el mes, que `formatMonth` ya devuelve con mayúscula (X-18, `src/i18n/format.ts:38-42`): «Octubre de 2026» (`src/features/availability/components/AvailabilityMonth.tsx:37-39`). Ya no dice «este mes» al navegar a otro mes | ≈ | — | — | Mantener (W2-09) |
| 45 | Calendario: navegación | Botones con `aria-label` «Mes anterior/siguiente del calendario de inicio» (demo) o «Mes anterior/siguiente» (conectado). Estado local: se pierde al recargar | Enlaces `?month=`, «Mes anterior/siguiente» (`AvailabilityMonth.tsx:41-54`; `page.tsx:279`; es:667-668) | + | — | — | Mantener |
| 46 | Cabecera de semana | «L M X J V S D» | «Lun Mar Mié Jue Vie Sáb Dom» (es:658-665), en mayúsculas por CSS: «LUN MAR MIÉ…» (`AvailabilityMonth.tsx:57`; runtime `evidencias/xhigh/20/TEC-01-1-next-1440.txt`) | ≈ | P3 | — | — |
| 47 | Celda de día | `<button>` con `aria-pressed`; número + punto rojo `<i>`. Deshabilitado si es pasado solo en la demo (`TechnicianHome.jsx:15`; runtime: 21 de 31 en octubre); el conectado no lo deshabilita (`ConnectedHome.jsx:15`). Runtime v2 (conectado): «2026-10-27: Disponible. 1 oportunidades», ningún día `disabled` (`evidencias/v2/20/TEC-01-1-v18c-1440.aria.yml`). | `<li>` no interactivo; hoy con `aria-current="date"` y anillo accent; pasados al 60 % (`AvailabilityMonth.tsx:68-77`) | ≠ | P2 | — (v2: desbloqueado; M07 hecho) | Portar: botón con `aria-pressed` que filtra «Oportunidades para ti» por día (fila 54); días pasados deshabilitados como en la demo (N-03) |
| 48 | `aria-label` del día | Demo «{d}: {estado}. {n} oportunidades», más « posibles, revisa publicación de descanso» si alguna no está publicada. Conectado «{d}: {estado}. {n} oportunidades» | «{d}: {estado}» (`AvailabilityMonth.tsx:71`) | ≈ | P3 | — (v2: desbloqueado; M07 hecho) | Añadir «{n} oportunidades» con plural ICU al portar la fila 47 (N-03) |
| 49 | Estados de día | Demo: Trabajo, Descanso, Disponible, Solo AOG, Asignado (`TechnicianHome.jsx:14`). Conectado: Trabajo, Descanso privado, Disponible, Solo AOG, Asignado, Intervalo parcial (`ConnectedHome.jsx:7`). Runtime v2 (conectado T1): 22 y 30 de octubre «Asignado» (`evidencias/v2/20/TEC-01-1-v18c-1440.jpg`). | Disponible, Bloqueado, Parcial, Descanso, Solo AOG (es:651-657; `src/features/availability/calendar.ts:14`). v2: el mini calendario sigue sin «Asignado»: `AvailabilityMonth` no recibe las asignaciones; solo el calendario editable las marca (TEC-04, fila 39). Runtime v2 con delta (asignación confirmada el 22/10): el mini calendario dice «2026-10-22: Available», sin la asignación, mientras Disponibilidad la marca (`evidencias/v2/20/TEC-01-11-next-1440.aria.yml`, `TEC-04-10-next-1440.aria.yml`). | ≈ | P2 | — (v2: D-06 ratificada) | Pasar `assignmentDays` a `AvailabilityMonth`, como hace Disponibilidad (`src/app/app/professional/availability/page.tsx:34-44`) (N-03). «Trabajo» → «Bloqueado» (TEC-04, fila 25) |
| 50 | Leyenda | Demo «Trabajo · Descanso · Disponible · Asignado · ● Oportunidades», sin AOG (H-13). Conectado: sin leyenda | «Disponible · Solo AOG · Bloqueado · Parcial · Descanso» (`AvailabilityMonth.tsx:14,79-86`) | ≈ (v2: antes +) | P3 | — | Añadir «Asignado» y «● Oportunidades» a la leyenda al portar las filas 49 y 51 (N-03). La leyenda de Next ya corrige H-13 (AOG) |
| 51 | Punto rojo y su nota | Demo: «El punto rojo señala oportunidades en días compatibles o descansos que podrías publicar. No cambia tu disponibilidad.». Conectado: «Calendario en UTC. El punto rojo indica ofertas compatibles con tus intervalos publicados. Las horas concretas de cada jornada se muestran en la oferta.». Runtime v2 (conectado T1): punto en el 27 y el 29 de octubre (`evidencias/v2/20/TEC-01-1-v18c-1440.jpg`). | No existe | − | P2 (v2: antes P1) | — (v2: desbloqueado; M07 hecho) | Portar con las fechas de las oportunidades compatibles del feed (fila 38) (N-03) |
| 52 | Zona horaria del calendario | Demo: Europe/Madrid (`business.js:2-4`). Conectado: UTC | UTC (`calendar.ts`; BR-10) | = | — | — | Igual al conectado |
| 53 | «Actualizar disponibilidad» | Botón con icono CalendarDays → `calendar` | «Editar disponibilidad» → `/app/professional/availability?month=` (`page.tsx:269-273`, es:516) | ≈ | P3 | — | — |
| 54 | Elegir día filtra la lista (S-TEC-01a) | Clic alterna `selected`. El h2 pasa a «Oportunidades · {día}» y, solo en la demo, aparece «Quitar selección de fecha» (`D-TEC-01d`; `TechnicianHome.jsx:15`). Conectado: solo cambia el h2 (`ConnectedHome.jsx:15`; runtime v2 «Oportunidades · 2026-10-27», `evidencias/v2/20/TEC-01-4-v18c-1440.txt`) | No existe | − | P2 (v2: antes P1) | — (v2: desbloqueado; M07 hecho) | Portar (N-03) |
| 55 | Sección «Oportunidades» | Demo: kicker «ENCUENTRA TU SIGUIENTE PASO», h2 «Oportunidades para ti», «Ver todas» → `jobs`, máximo 5. Conectado: igual, sin kicker | Panel «Oportunidades para ti» (es:578) + «Ver todas» (es:580, botón `ghost`) → `/app/professional/opportunities`, con las 3 primeras compatibles (`FEED = 3`); sin kicker; al lado de «Mis candidaturas» en dos columnas desde `lg` (`ProfessionalActivity.tsx:14,26,50-82`). Runtime v2: vacío para alpha, foxtrot y oscar; con una fila para delta, echo y hotel (`evidencias/v2/20/TEC-01-1-next-1440.jpg`) | ≈ (v2: antes −) | P3 | — (v2: M07 hecho) | Mantener (`db05af1`). Opcional: 5 filas y kicker «ENCUENTRA TU SIGUIENTE PASO» (N-22) |
| 56 | Fila de oportunidad | Demo: título; «{empresa} · {ubicación}»; «{inicio} → {fin} · Requisitos y disponibilidad compatibles» o «… · Posible en descanso: revisa y publica tus fechas»; «{tarifa} / h»; «Ver oferta» o «Revisar fechas». Conectado: título; «{org} · {base} · {categoría}»; «{inicio UTC} · {tarifa} / h»; «Ver oferta». Runtime v2 (conectado T1): «AOG A321 · cambio de frenos (cliente)» / «QA Talent Recruiting · OPO · B1.1» / «29 oct 2026, 6:00 UTC · 52,00 € / h» / «Ver oferta» (`evidencias/v2/20/TEC-01-1-v18c-1440.txt`) | Título como enlace → `/app/professional/opportunities/{id}` + «{organización} · {inicio} → {fin}» (`ProfessionalActivity.tsx:66-80`; `formatPeriod`). Sin base ni categoría, sin «Requisitos y disponibilidad compatibles» (el feed ya filtra las compatibles), sin tarifa ni botón «Ver oferta». Runtime v2: «E2E diff v2 · B · B1.1 A320 cancelaciones» / «Demo MRO Madrid · 28 OCT → 29 OCT» (`evidencias/v2/20/TEC-01-12-next-1440.txt`). Como en v1.8 (T1 ve J7, a la que ya se presentó), el feed incluye necesidades con candidatura propia: echo la ve aunque tiene ahí una rechazada y una retirada y ya no puede volver a presentarse (T-09) | ≈ (v2: antes −) | P3 | — (tarifa: v2 default v1.8, C-9/D-08 y OD-7 sin dinero real; antes M07; OD-7) | Añadir base y categoría o licencia a la línea; la tarifa cuando la necesidad tenga condiciones (área 30) (N-22) |
| 57 | Oportunidades «posibles en descanso» | Solo demo: `opportunityDays` (`homeModel.js:6-15`) | — | − | P2 | — (v2: default v1.8; antes M07, TD-91) | Portar como default v1.8: oportunidades que encajan salvo por la disponibilidad, con «Revisar fechas» (N-17) |
| 58 | Turnos recomendados | Conectado: `recommendedShifts` (`connectedModel.js:11-16`) | — | − | P2 | D-06 Q6 (una candidatura = un periodo; v2: antes C-9/D-08) | No portar mientras rija D-06 Q6: la cobertura parcial (LATER) exige que el owner revise Q6 |
| 59 | Oportunidades: vacío | Demo: «Sin oportunidades para este día» o «Todavía no hay oportunidades compatibles», con «Revisa tu perfil o publica las fechas que quieras ofrecer. Los descansos privados no se envían a empresas.» y «Abrir mi calendario». Conectado: «Aún no hay oportunidades compatibles» + «Completa las cualificaciones y las fechas que quieras publicar.» | «Todavía no hay oportunidades compatibles.» (es:582), sin la frase de ayuda ni «Abrir mi calendario». Si falla la carga: «No se ha podido cargar ahora. Recarga para reintentar.» (es:584) (`ProfessionalActivity.tsx:59-64`). Runtime v2 con los 4 técnicos (`evidencias/v2/20/TEC-01-1-next-1440.txt`) | ≈ (v2: antes −) | P3 | — (v2: M07 hecho) | Añadir la frase de ayuda y «Abrir mi calendario» de la demo (N-22) |
| 60 | Sección «Mis candidaturas» | Demo: kicker «TU ACTIVIDAD», «Ver todas»; fila con título, «{empresa} · {n} jornadas», pastilla de estado, «Ver seguimiento». Conectado: título, organización, estado + « · {n} sin leer», «Seguimiento». Runtime v2 (conectado T1): 5 filas, p. ej. «Urgente B1.1 A320 · C-check parcial» / «QA Aero Mantenimiento S.L.» / «Confirmada · 1 sin leer» / «Seguimiento» (`evidencias/v2/20/TEC-01-1-v18c-1440.txt`) | Panel «Mis candidaturas» (es:579) + «Ver seguimiento» (es:581) → `/app/professional/applications`; 3 filas con título, organización y chip de estado con tono (`ProfessionalActivity.tsx:83-112`; `src/features/applications/view.ts:5-15`; es:469-479). Sin «{n} jornadas», sin «· {n} sin leer», sin botón por fila ni kicker «TU ACTIVIDAD». Runtime v2: echo «Rechazada», «Retirada», «Rechazada»; hotel «Aceptada»; delta «Confirmed» (en) (`evidencias/v2/20/TEC-01-12-next-1440.txt`, `TEC-01-13-next-1440.txt`, `TEC-01-11-next-1440.txt`) | ≈ (v2: antes −) | P3 | — («sin leer» es de la conversación: chat, SCOPE OUT; v2: antes D-06) | Mantener (`db05af1`). Opcional: botón por fila y 5 filas (N-22) |
| 61 | Candidaturas: vacío | Demo: «Tu próxima candidatura empieza aquí» + «Explora las oportunidades y elige las condiciones y fechas que te encajen.» + «Buscar oportunidades». Conectado: «Todavía no has presentado candidaturas.» | «Tu próxima candidatura empieza aquí.» (es:583), sin «Explora las oportunidades…» ni «Buscar oportunidades» (`ProfessionalActivity.tsx:95-96`). Runtime v2 (`evidencias/v2/20/TEC-01-1-next-1440.txt`) | ≈ (v2: antes −) | P3 | — (v2: D-06 ratificada) | Añadir la frase y «Buscar oportunidades» → `/app/professional/opportunities` (N-22) |
| 62 | Diseño a 390 px | Una columna, KPIs en 2 columnas y calendario bajo la tarjeta (§2.M; runtime: `evidencias/xhigh/20/TEC-01-1-v18-390.jpg`) | KPIs `grid-cols-2 lg:grid-cols-5`; paneles apilados y `lg:grid-cols-2` (`page.tsx:123,216`). Sin scroll horizontal a 390 px (`TEC-01-1-next-390.jpg`). v2: la actividad pone sus KPIs en 2 columnas y apila los feeds (`ProfessionalActivity.tsx:36,50`); sin scroll horizontal a 390 px (`evidencias/v2/20/TEC-01-1-next-390.jpg`). | ≈ | — | — | — |
| 65 (nueva xhigh) | Tarjeta de identidad a 390 px | Avatar arriba y nombre, base y medallas a todo el ancho (`evidencias/xhigh/20/TEC-01-1-v18-390.jpg`) | X-17: el bloque de texto lleva `basis-48` (`IdentityCard.tsx:28-29`), así que a 390 px «Editar perfil» pasa bajo el texto, «Technician Alpha» ocupa 1 línea y «Madrid (MAD) · 9 años de experiencia declarada» 2; igual a 360 px, sin scroll horizontal (`evidencias/v2/20/TEC-01-10-next-390.jpg`, `TEC-01-10-next-360.jpg`; medidas en `work/20/next-card390.mjs`). El avatar sigue a la izquierda, no encima | ≈ | — (v2: antes P3) | — | Mantener (X-17, `50658e8`; B-17 HECHO) |
| 66 (nueva xhigh) | Error al cargar Mi espacio | Conectado: si falla la carga se muestra un error (`src/beta/Account.jsx:30-31`) | X-16: `getOwnProfessionalOverview` lanza un error si falla cualquiera de sus tres lecturas y solo devuelve `null` cuando la cuenta no tiene perfil técnico (`src/features/professional/api.ts:48-53`); el límite de error de `/app` muestra «No se ha podido mostrar esta página», la referencia y «Reintentar» (`src/app/app/error.tsx:15-22`; es:26). Test `src/features/professional/api.test.ts` en verde (v2). Solo código: el fallo no se puede provocar sin tocar la BD | ≈ (v2: antes ≠) | — | — | Mantener (X-16, `61cc473`; B-16 HECHO) |
| 67 (nueva xhigh) | Orden de los bloques a 1440 px | Demo: cabecera → [tarjeta del pasaporte (identidad, medallas, acciones, progreso y 2 KPIs) \| calendario] → «Oportunidades para ti» → «Mis candidaturas» (`TechnicianHome.jsx:15`; `evidencias/xhigh/20/TEC-01-1-v18-1440.jpg`) | Cabecera → tarjeta de identidad → 5 KPIs → actividad (4 KPIs + [«Oportunidades para ti» \| «Mis candidaturas»]) → «Próximos pasos» (si hay) → «Documentos y cursos próximos a revisar» → [completitud \| calendario] → «Perfil» (`page.tsx:112-290`; `evidencias/v2/20/TEC-01-1-next-1440.jpg`). A 1440×900 los feeds quedan arriba (y≈560) pero el calendario baja a y≈875, bajo el pliegue; en v1.8 está junto a la tarjeta | ≈ | P3 | — | Mantener. Opcional: subir completitud y calendario junto a la tarjeta, como en v1.8 |
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

---

## TEC-02 · Pasaporte (datos del perfil) — v1.8 `S-TEC-02, S-TEC-02a…e, S-MOD-TEC-02, D-TEC-02, S-CON-03, C-TEC-02/12/13/25, C-TEC2-01/04` ↔ Next `N-PRO-02, N-PRO-03`

**Estado global:** PARCIAL.
- **v1.8:** recoge identidad, cualificaciones, experiencia, cursos, tarifa, movilidad y permisos. En la demo es un
  asistente de 5 pasos con borrador automático; en el conectado, un formulario único con control de versión.
- **Next:** reparte el pasaporte en un formulario de identidad, experiencia y visibilidad (`ProfileForm`) y una página de
  cualificaciones de catálogo. Faltan teléfono, empresa actual, catálogo de categorías y aeronaves de v1.8, restricciones,
  motores, inglés, capacidades libres, tarifa, movilización, herramientas propias y países. Casi todo está bloqueado por
  C-10/D-02/D-03, OD-6/D-04 u OD-7.
- **v2:** con SCOPE-2 todo eso pasa a portable, con el comportamiento v1.8 como default documentado (C-10/D-02/D-03,
  OD-6/D-04, OD-7 sin dinero real) o porque ya es alcance LATER (tarifa, movilización, avisos). Solo cambia la columna
  Bloqueo. El pasaporte de Next no ha cambiado desde el xhigh, salvo que un fallo de red ya no tira el formulario (X-02,
  fila 50). Comprobado contra el conectado en ejecución (T1 completo, T2 con restricciones).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | Demo: «Mi pasaporte» `#profile`, también «Editar perfil» y «Completar». Conectado: «Mi pasaporte» `#profile` | Dos páginas: «Mi pasaporte» → `/app/professional/profile` y «Cualificaciones» → `/app/professional/qualifications` (`AppShell.tsx:30-31`, es:66-67) | ≈ | P3 | — | Mantener |
| 2 | Kicker | Demo «MI PASAPORTE» (`src/components/v11/Professional2.jsx:76`). Conectado: ninguno | «Mi pasaporte» en las dos páginas (es:544, 595) | = | — | — | Igual a la demo |
| 3 | Título | Demo «Tu perfil, conectado.». Conectado: h2 «Pasaporte profesional conectado» (`src/beta/Account.jsx:62`) | «Tu perfil, conectado.» (es:545) | = | — | — | Igual a la demo |
| 4 | Descripción | Demo: «El borrador se guarda mientras avanzas. Guardar pasaporte publica los cambios en el matching.». Conectado: «Declaraciones del titular · {Pendiente\|Revisión registrada}. Los cambios de cualificación requieren nueva revisión; calendario y tarifa se gestionan sin dar por verificadas las habilitaciones.» | «Lo que actualizas aquí se refleja en el matching y en tu expediente. Las cualificaciones y la disponibilidad tienen sus propias páginas.» (es:546) | ≈ | — | — | — |
| 5 | Insignia de estado | Demo: «{%} completado · {n} evidencias». Usa el perfil publicado y los documentos no demo (`Professional2.jsx:75-76`) | No existe | − | P3 | — (v2: default v1.8; evidencias = documentos propios del wallet; antes D-10) | Opcional: «{%} completado · {n} evidencias» (N-25) |
| 6 | «Empezar perfil vacío» y modal | Modal «Empezar desde cero»: «Se preparará un borrador vacío. El perfil publicado se conserva hasta que guardes el nuevo pasaporte.» + «Preparar borrador» (`Professional2.jsx:112-132`) | No existe | − | P3 | — | No portar: sin borrador no tiene sentido (TD-27, propuesta UX) |
| 7 | Asistente de 5 pasos | Demo: «1 Identidad», «2 Cualificaciones», «3 Experiencia y cursos», «4 Disponibilidad y tarifa», «5 Resumen»; se puede saltar entre pasos (`Professional2.jsx:44,77`). Conectado: formulario único | Formulario único en 3 paneles: «01 · Identidad», «02 · Experiencia y movilidad», «03 · Visibilidad en la red» (`src/features/professional/components/ProfileForm.tsx:93-184`, es:548-557), más la página de cualificaciones | ≈ | P3 | — | Mantener (patrón del conectado). El asistente de la demo (AB-33) es opcional: SCOPE-2 ya no lo bloquea (N-24) |
| 8 | Borrador automático | Demo: `useDraft`, guarda tras 350 ms con el indicador «Guardando…» (`Professional2.jsx:10-27`) | No existe: se guarda todo de una vez | − | P3 | — | No portar (decisión de diseño: un formulario, un guardado) |
| 9 | Pie del formulario | Demo: «Anterior» · «Guardar pasaporte» · «Siguiente» (`Professional2.jsx:111`). Conectado: «Guardar perfil en mi cuenta» | «Guardar cambios» / «Guardando…» (`ProfileForm.tsx:187-191`) | ≈ | — | — | — |
| 10 | Errores de validación | Demo: bloque `role=alert` con un párrafo por error y toast «Revisa los campos señalados. El borrador se conserva.» (`Professional2.jsx:45-78`). Conectado: mensaje del servidor bajo la cabecera | Errores por campo con `aria-invalid`/`aria-describedby` y `Notice` general (`ProfileForm.tsx:55-73,77-84`) | ≈ | — | — | — |
| 11 | Mensaje de guardado | Demo: toast «Perfil profesional guardado». Conectado: «Cambios guardados.» | «Pasaporte actualizado. El matching usa los nuevos datos.» (es:560) | + | — | — | — |
| 12 | Conflicto de versión | Demo: no hay. Conectado: 409 «El perfil ha cambiado. Actualiza antes de guardar.» (`server/app.mjs:64`); «Actualizar datos» descarta lo no guardado (C-TEC2-04) | `expectedUpdatedAt` (`ProfileForm.tsx:52`) → «Tu pasaporte se modificó en otra ventana o dispositivo. No se ha guardado nada: recarga la página…». El formulario conserva lo escrito (es:561; `ProfileForm.tsx:67-72`). Solo código: provocarlo exige guardar | ≈ (xhigh: antes =) | — | — | Mantener (V18-10) |
| 13 | Vista previa de identidad | Demo: `ProfileIdentity` editable, con foto, en el «Pasaporte visual». Conectado: vista previa en vivo, no editable (`Account.jsx:62`) | No existe | − | P3 | — | Ver TEC-08 |
| 14 | Nombre | Demo: «Nombre profesional», texto, error «Escribe tu nombre profesional.». Conectado: «Nombre completo», obligatorio, ≤ 160 | «Nombre profesional», `maxLength 120`; «El nombre profesional es obligatorio» / «…como máximo 120 caracteres» (`ProfileForm.tsx:95-97`; `src/lib/validation/professional.ts:28-32`; es:312-315). Runtime: con el nombre vacío, «Guardar cambios» muestra «El nombre profesional es obligatorio» sin enviar nada (`evidencias/xhigh/20/TEC-04-5-next-interact-1440.txt`) | ≈ (xhigh: antes =) | — | — | — |
| 15 | Correo electrónico | Demo: «Correo electrónico» en el pasaporte, con errores «Indica correo o teléfono.» y «Revisa el correo.» (`business.js:89-101`). Conectado: es el email de la cuenta | Es el email de la cuenta (Supabase Auth); no está en el pasaporte | ≈ | — | — | Igual al conectado |
| 16 | Teléfono | Demo: «Teléfono», `tel` | No existe | − | P3 | — (v2: default v1.8; se enseña solo según D-07 P1/P4; antes D-07) | Portar el campo «Teléfono» (privado; contacto solo con consentimiento) (N-08) |
| 17 | Base habitual | Demo: `select` con AIRPORTS, sin opción vacía: «Madrid (MAD)», «Barcelona (BCN)», «Lisboa (LIS)», «París (CDG)», «Frankfurt (FRA)», «Londres (LHR)», cada una ligada a su país (`business.js:11-19`). Conectado: texto ≤ 160 | Texto ≤ 80 con pista «Aeropuerto o ciudad, p. ej. Madrid (MAD)» y placeholder «Madrid (MAD)», ahora del catálogo (`ProfileForm.tsx:98-110`; es:550-552) | ≈ | P3 | — (v2: default v1.8; antes OD-6) | Default v1.8: `select` de aeropuertos ligado al país, con los permisos de la fila 41 (N-07); o conservar el texto libre si el owner lo prefiere |
| 18 | Empresa actual (para bloqueo) | Demo: `select` «Ninguna», «Empresa actual del técnico», «AeroLine MRO». Conectado: casillas «Organizaciones bloqueadas», una por organización | No existe | − | P2 | — (v2: default v1.8; antes D-07, TD-54) | Portar con los bloqueos de TEC-07, fila 11 (N-08) |
| 19 | Aviso de la cuenta demo | «Cuenta local de demostración. El perfil puede estar incompleto y seguir siendo privado.» | — | ✗ | — | — | No portar (solo demo) |
| 20 | Categorías profesionales | Demo: chips de CATEGORIES (12): B1.1, B1.2, B1.3, B1.4, B2, B3, Cat A, Cat C, Mecánico, Sheet Metal, NDT, Helper (`business.js:7`). Conectado: las mismas 12 como casillas «Categorías y especialidades» (máximo 12). Runtime v2 (conectado T1): las 12 en «Categoría principal» y «Categorías y especialidades» (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). | Catálogo LICENSE: B1.1, B1.3, B2, CAT-A, CAT-C, más APPROVAL NDT-UT2 (`supabase/migrations/20261009120100_qualification_catalog.sql:7-11,22`). **Faltan** B1.2, B1.4, B3, Mecánico, Sheet Metal y Helper | ≠ | P1 | — (v2: default v1.8; antes C-10/D-03, TD-29, V18-37) | Ampliar el catálogo con B1.2, B1.4, B3, Mecánico, Sheet Metal y Helper (migración) (N-01) |
| 21 | Categoría principal | Conectado: `select` «Elige categoría» + las 12; la casilla de la principal queda deshabilitada. Elegir la opción vacía cuela `""` (C §3.15-7) | No existe el concepto | − | P3 | — (v2: default v1.8; antes C-10) | Portar la categoría principal sin el fallo de `""` (N-01) |
| 22 | Aeronaves con experiencia | Demo: chips de AIRCRAFT (12): A320 Family, B737 NG, B737 MAX, ATR 72, Embraer E-Jets, A330, A350, B787, EC135/145, Cessna 172, Piper PA-28, Robinson R44 (`business.js:8`). Conectado: «Aeronaves (separadas por coma)», obligatorio, placeholder «A320, B737 NG» | No hay experiencia por aeronave. Solo existen las habilitaciones TR-* (fila 23; NX-12) | − | P1 | — (v2: default v1.8; antes C-10) | Portar la experiencia declarada por aeronave (12 de la demo) (N-01) |
| 23 | Habilitaciones de tipo | Demo: un panel por aeronave y una casilla «Habilitación {cat}» por cada categoría elegida, salvo Sheet Metal, NDT, Mecánico y Helper (`Professional2.jsx:81-94`). Conectado: bloque repetible con «Aeronave de habilitación N» (texto obligatorio), «Categoría de habilitación N» (12 opciones), «Vigencia…», «Documento…», «Restricciones…», «Añadir/Quitar habilitación» (máximo 40). Runtime v2 (conectado T1): 2 habilitaciones, «Documento de habilitación 1» con «Pendiente de vincular» / «Licencia_B1.1_A320_QA.pdf» (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). | TYPE_RATING: TR-A320, TR-A330, TR-A350, TR-B737, TR-B787, TR-ATR72, sin relación con la categoría de licencia (`20261009120100…:12-17`). Sin tipo: B737 MAX (aparte), Embraer E-Jets, EC135/145, Cessna 172, Piper PA-28, Robinson R44 | ≠ | P1 | — (v2: default v1.8; antes C-10/D-02, TD-30/31, V18-08) | Habilitación = aeronave × categoría, con vigencia, documento y restricciones (N-02) |
| 24 | Vigencia de la habilitación | Opcional, «Vigencia {a} {c} (si aplica)»; error «Revisa la vigencia de habilitaciones.» | TR-* con caducidad opcional (`requires_expiry=false`). Las licencias la exigen (más estricto, V18-09) | = | — | — | Ver TEC-03 |
| 25 | Restricciones por habilitación | Demo: «Restricciones {a} {c}», placeholder «Sin restricciones declaradas». Conectado: «Restricciones de habilitación N». Runtime v2 (conectado T2): «Excluye motores CFM56»; la medalla dice «A320 · B1.1: Con restricciones» (`evidencias/v2/20/TEC-02-2-v18c-1440.aria.yml`). | No existen | − | P1 | — (v2: default v1.8; antes C-10/D-02) | Portar; con restricciones no cumple una necesidad que pide licencia (v1.8 `eligible`, `server/rules.mjs:27`) (N-02) |
| 26 | Restricciones generales | Conectado: «Restricciones generales de habilitación o alcance», textarea. Con texto, la confirmación de la candidatura se bloquea. Runtime v2 (conectado T2): «Sin certificación CRS en motores; tareas de motor solo bajo supervisión de un B1 (QA).» en rojo; la revisión administrativa se niega (`evidencias/v2/20/TEC-02-2-v18c-1440.aria.yml`; README del conectado). | No existe | − | P2 | — (v2: default v1.8; antes C-10/D-02) | Portar; bloquea la confirmación como en v1.8 (N-02) |
| 27 | Evidencia por habilitación o curso | Demo: «Evidencia {a} {c}», `select` con «Pendiente de aportar» + documentos. Conectado: «Documento de habilitación N» con «Pendiente de vincular» + licencias | El vínculo se hace desde el documento, en el wallet (TEC-05, fila 16) | ≈ | P2 | — (v2: default v1.8; antes D-10: el vínculo con documentos propios no es acceso de terceros) | Opcional: elegir el documento desde la cualificación (N-02); ver TEC-03, fila 22 |
| 28 | «Abrir documentos» y pista | Conectado: botón «Abrir documentos», que sale sin guardar, y «Guarda el formulario antes de abrir otra sección. La insignia describe lo declarado; no concede autorización de firma. La confirmación exige el documento correspondiente revisado cuando la oferta requiere licencia.» | Con el flag del wallet, cada fila de Cualificaciones lleva el enlace «Abrir documentos» → `/app/professional/documents` (`src/features/qualifications/components/EvidenceLine.tsx:12-14`, es:591). Sin la pista de v1.8; sin flag (PROD) no aparece | ≈ (antes −) | P3 | D-10 (wallet en PROD) | Mantener (W2-11). La pista no hace falta: no hay formulario sin guardar que perder |
| 29 | Texto de habilitaciones | Demo: «La fecha es opcional cuando no aplique. No se inventa una vigencia. Las restricciones se comparten con el expediente.» | Pistas por tipo: «Déjalo vacío si la cualificación no caduca» o «{code} requiere fecha de caducidad» (es:619-620) | ≈ | — | — | — |
| 30 | Años de experiencia | Demo: number 0–60, error «Indica entre 0 y 60 años.». Conectado: «Años de experiencia declarados», 0–60, por defecto 0 | «Años de experiencia», number 0–60 entero; vacío → null; errores `v.years.*`, con otra redacción («Los años de experiencia deben ser como máximo 60»…) (`ProfileForm.tsx:116-126`; es:323-327) | ≈ (xhigh: antes =) | — | — | — |
| 31 | Idiomas / inglés técnico | Demo: «Inglés técnico», `select` A1, A2, B1, B2, C1, C2. Conectado: no hay | No existe (el idioma de la interfaz ES/EN es otra cosa) | − | P2 | — (v2: default v1.8; antes C-10, TD-33) | Portar «Inglés técnico» A1-C2 (N-05) |
| 32 | Motores | Demo: chips de ENGINES (7): CFM56-5B/7B, LEAP-1A, LEAP-1B, PW1100G, PW127, Trent 700/1000, GE90 (`business.js:10`). Conectado: no hay | No existe | − | P2 | — (v2: default v1.8; antes C-10/D-03, TD-34) | Portar los 7 motores (N-05) |
| 33 | Capacidades | Demo: chips de SKILLS (9): Line Maintenance, Base Maintenance, AOG Support, Troubleshooting, Engine Change, Sheet Metal, NDT, Boroscopia, Cabin Systems (`Professional2.jsx:9`). Conectado: «Capacidades (separadas por coma)» | Solo el SKILL BORESCOPE («Borescope inspection»), que equivale a Boroscopia (`20261009120100…:23`) | ≠ | P2 | — (v2: default v1.8; antes C-10, TD-35) | Portar las 9 capacidades (N-05) |
| 34 | Cursos | Demo: casillas de COURSES (Human Factors, EWIS, FTS, SMS); cada una pide «Vigencia {c}» y «Evidencia {c}» (`business.js:9`). Conectado: repetible «Nombre del curso N» (libre) + «Vigencia curso N» obligatoria + «Evidencia curso N», máximo 40 | TRAINING: HF, EWIS, FTS y SMS con caducidad obligatoria (`20261009120100…:18-21`) | = | — | — | Mantener (TD-36) |
| 35 | Error de curso sin fecha | «Indica la vigencia de cada curso.» | «Esta cualificación requiere fecha de caducidad» (es:340) | ≈ | — | — | — |
| 36 | Aviso de cursos | Demo: «Aportar evidencia no equivale a verificación. La vigencia declarada debe cubrir el período completo de la oferta.». Conectado: «Usa los nombres que pide la oferta, por ejemplo Human Factors, EWIS o FTS. Al confirmar se exige evidencia revisada de cada curso obligatorio.» | Descripción de Cualificaciones: «…Un curso debe seguir vigente hasta el último día de una necesidad para superar su filtro obligatorio.» (es:596) | ≈ | — | — | — |
| 37 | Tarifa mínima | Demo: «Tarifa mínima», number ≥ 0,01, más «Unidad de tarifa» «EUR / día» o «EUR / hora»; al guardar, `dailyRate = minRate × 8` si es por hora; error «La tarifa debe ser positiva.». Conectado: «Tarifa mínima EUR/h», 1–2000, paso 0,01. Runtime v2 (conectado T1): «Tarifa mínima EUR/h» (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). | No existe | − | P2 | — (v2: desbloqueado, alcance LATER `V1_SCOPE.md:64`; default v1.8 de OD-7 sin dinero real; antes SCOPE, TD-37) | Portar «Tarifa mínima» y su unidad, privada para el matching (N-06) |
| 38 | Movilización | Demo: «Movilización mínima (horas)», 0–168, por defecto 8; error «Indica entre 0 y 168 horas de movilización.», que no sale junto al campo (H-16). Conectado: «Horas mínimas que necesitas para movilizarte», 0–720 | No existe | − | P3 | — (v2: desbloqueado, alcance LATER `V1_SCOPE.md:61`; antes SCOPE, TD-38) | Portar con las preferencias de avisos (N-10) |
| 39 | Desplazamientos | Demo: interruptor «Acepto desplazamientos». Conectado: no hay | «Movilidad», `select`: «Local (solo base habitual)», «Nacional», «Internacional» (`ProfileForm.tsx:136-144`; es:440-444) | + | — | — | Mantener (TD-39, más rico) |
| 40 | Herramientas propias | Demo: interruptor «Tengo herramientas propias» | No existe | − | P3 | — (v2: default v1.8; antes C-10, TD-40) | Portar (N-05) |
| 41 | Permisos de trabajo | Demo: chips «Permiso de trabajo declarado» (5): España, Portugal, Francia, Alemania, Reino Unido (`Professional2.jsx:8`). Conectado: «Permisos de trabajo declarados», 27 casillas de la UE (`server/rules.mjs:1`): Austria, Bélgica, Bulgaria, Croacia, Chipre, Chequia, Dinamarca, Estonia, Finlandia, Francia, Alemania, Grecia, Hungría, Irlanda, Italia, Letonia, Lituania, Luxemburgo, Malta, Países Bajos, Polonia, Portugal, Rumanía, Eslovaquia, Eslovenia, España, Suecia. Runtime v2 (conectado T1): las 27 casillas (`evidencias/v2/20/TEC-02-1-v18c-1440.txt`). `eligible()` exige el permiso del país de la oferta: «Falta declarar permiso de trabajo para el país.» (`server/rules.mjs:27`). | No existe, y el matching no comprueba el país | − | P2 | — (v2: default v1.8; antes OD-6/D-04, TD-41) | Portar los 27 permisos UE y la regla de país en el matching (N-07) |
| 42 | Texto del paso 4 | Demo: «El calendario publica fechas elegidas. Un día libre no se ofrece automáticamente.». El paso no tiene campos de disponibilidad (H-17) | Descripción de Disponibilidad: «Un día libre solo entra en el mercado cuando lo marcas como disponible.…» (es:631) | ≈ | — | — | — |
| 43 | Resumen (paso 5) | h2 con el nombre o «Perfil pendiente»; «{categorías} · {base}» o «Categorías pendientes»; métricas «Datos completados», «Tarifa mínima» («por hora»/«por día») y «Evidencia real» con «Verificación pendiente»; aviso «El porcentaje mide datos cumplimentados. No certifica cualificación, evidencia ni verificación.» (`Professional2.jsx:110`) | No existe. Lo cubren en parte los KPIs de Mi espacio | − | P3 | — | No portar (sin asistente) |
| 44 | Situación actual | No existe | «Situación actual»: «En plantilla», «Contractor», «Entre contratos» (`ProfileForm.tsx:127-135`; es:445-449) | + | — | — | Mantener |
| 45 | Visibilidad en el formulario | En v1.8 está en Privacidad (demo) o es una casilla del pasaporte (conectado) | Panel «03 · Visibilidad en la red» (`ProfileForm.tsx:148-184`) | ≈ | — | — | Ver TEC-07 |
| 46 | Intervalos con horas en el pasaporte | Conectado: `<details>` «Intervalos de disponibilidad con horas concretas (UTC)» (`Account.jsx:62`) | En la página de Disponibilidad (TEC-04, filas 55-59) | ≈ | — | — | — |
| 47 | Avisos, silencio y bloqueos en el pasaporte | Conectado: «Avisos de oportunidades», silencio, zona y bloqueos (`Account.jsx:62,81`) | No | − | P3 | — (v2: desbloqueado, alcance LATER; bloqueos con default v1.8) | Ver TEC-07 (N-08, N-10) |
| 48 | Campos que reinician la revisión | Conectado: cambiar nombre, categoría, aeronaves, países, restricciones, cursos, capacidades, años, categorías o habilitaciones → `review` vuelve a `pending` (V18-07) | Solo las fechas de una cualificación (BR-2.8). El perfil no tiene revisión | ≈ | — | — | Ver TEC-03, fila 14 |
| 49 | Diseño a 390 px | Demo: pasos en 3 filas, campos a una columna, «Siguiente» debajo (§2.M). Conectado: una columna | Paneles a una columna (`md:grid-cols-2/3`) | ≈ | — | — | — |
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

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cómo se declara | Demo: dentro del pasaporte, en borrador (`Professional2.jsx:81-108`). Conectado: dentro de `profile.save` (`server/app.mjs:62-76`) | Página propia con una declaración por tipo de catálogo (`src/features/qualifications/components/QualificationsManager.tsx`) | ≠ | P3 | — | Mantener |
| 2 | Catálogo | Demo: constantes (`business.js:7-10`). Conectado: categoría en `select` de 12; aeronaves, cursos y capacidades en texto libre | 17 tipos en BD (`20261009120100_qualification_catalog.sql:7-23`), agrupados con `optgroup`: «Licencias», «Type ratings», «Formación y cursos», «Habilitaciones», «Capacidades» (`QualificationsManager.tsx:240-252`; es:450-456) | ≠ | P1 | — (v2: default v1.8; antes C-10/D-03) | Ver TEC-02, filas 20-23 y 31-33 (N-01, N-02, N-05) |
| 3 | Nombres del catálogo | En español o códigos de la industria | En inglés en la BD («Type rating — Airbus A320 family», «Electrical Wiring Interconnection System»…), sin traducir (NX-12; es:949) | ≈ | P3 | — | Mantener (convención aeronáutica documentada) |
| 4 | Declarar | Conectado: «Añadir habilitación» y «Añadir curso», sin tipo cerrado | «Declarar», `select` «Selecciona del catálogo…» con los tipos aún no declarados; si no quedan: «Has declarado todos los tipos del catálogo.» (`QualificationsManager.tsx:224-271`; es:600-617) | ≈ | — | — | — |
| 5 | Fecha de emisión | No existe | «Emisión» (date) y la regla «La caducidad no puede ser anterior a la emisión» (es:607, 339) | + | — | — | Mantener |
| 6 | Caducidad | Demo: opcional en habilitaciones, obligatoria en cursos. Conectado: igual (`Account.jsx:62,76`) | Según `requires_expiry`: obligatoria en LICENSE, TRAINING y APPROVAL; opcional en TYPE_RATING y SKILL. Pistas «{code} requiere fecha de caducidad» / «Déjalo vacío si la cualificación no caduca» (es:619-620; BR-2.7) | ≈ | — | — | Mantener (V18-09: más estricto en licencias) |
| 7 | Validez por periodo | Demo: el matching exige vigencia hasta `endDate`; la medalla marca «Revisar vigencia» si ya pasó. Conectado: `!expires \|\| expires >= end` | `validityForPeriod`: caducada, caduca durante o válida, siempre contra el periodo (`src/domain/qualification.ts:44-55`; BR-2.3/2.4) | = | — | — | — |
| 8 | Tenencia | No existe: desmarcar equivale a borrar | «Vigencia»: «Activa» / «Retirada (no la posees)»; chips «Vigente» / «Retirada» (`QualificationsManager.tsx:201-205,328-330`; es:609-611, 422-425) | + | — | — | Mantener |
| 9 | Quitar | Demo: desmarcar en el borrador (reversible hasta guardar). Conectado: «Quitar habilitación» / «Quitar curso» dentro del formulario sin guardar | «Quitar» pide confirmación: el primer clic muestra «Sí, quitarla» / «Cancelar», con el foco en «Cancelar», y solo «Sí, quitarla» borra → «{code} eliminada.» (`QualificationsManager.tsx:346-357`; `src/components/ui/ConfirmButton.tsx:11-75`; es:593, 616). Runtime: «Quitar» → foco en «Cancelar»; «Cancelar» → foco de vuelta en «Quitar» (`evidencias/xhigh/20/TEC-04-5-next-interact-1440.txt`). Tras «Sí, quitarla» el foco ya no se pierde: el `Notice` del resultado lo toma si estaba en `<body>` (X-08, `src/components/ui/Notice.tsx:32-41`). Runtime v2 con la acción abortada: «Quitar» → foco en «Cancelar»; «Sí, quitarla» → foco en el aviso `P[role=alert]` «Se ha perdido la conexión…»; nada se borró (`evidencias/v2/20/TEC-04-9-next-1440.txt`). El camino con éxito, solo en código (`4357034`) | ≈ (antes ≠) | — (v2: antes P3) | — | Mantener (W1-10; foco: X-08, B-13 HECHO) |
| 10 | Editar | Dentro del formulario | Panel «Editar {code}» con Emisión, Caducidad y Vigencia; «Guardar» / «Cancelar» (`QualificationsManager.tsx:173-222`) | ≈ | — | — | — |
| 11 | Tipo inmutable | No aplica | Para cambiar el tipo, quitar y declarar de nuevo (BR-2.8) | + | — | — | — |
| 12 | Estados que ve el técnico | Demo, documentos: «Autodeclarado» (semilla) y «Pendiente» (subidos). Demo, medallas: «Declarado», «Tipo declarado», «Con restricciones», «Revisar vigencia» (`src/features/progress.js:3-11`). Conectado, perfil: «Pendiente» / «Revisión registrada» (`Account.jsx:15`) | Por cualificación: «Verificada» (ok), «Verificación pendiente» (warn), «Rechazada» (danger) y «Caducada» (danger; `expired` no lo escribe nada) (es:416-421; `QualificationsManager.tsx:35-40`). Runtime v2: echo «Verificación pendiente»; oscar «Rechazada» (`evidencias/v2/20/TEC-03-4-next-1440.txt`, `TEC-03-5-next-1440.txt`). | ≠ | — | — | Mantener (TD-45, más fuerte) |
| 13 | Qué se revisa | Conectado: un único `review` para todo el perfil (`server/app.mjs:73-75`) | Cada cualificación (BR-2.6) | + | — | — | — |
| 14 | Qué devuelve a «pendiente» | Conectado: cambiar nombre, categoría, aeronaves, países, restricciones, cursos, capacidades, años, categorías o habilitaciones (V18-07; `app.mjs:74-75`) | Cambiar las fechas (trigger, REV:73-90); retirar o reactivar no. Avisos «Cambiar las fechas la devuelve a verificación pendiente.» y «{code} actualizada: vuelve a verificación pendiente porque han cambiado sus fechas.» (es:604, 615) | ≈ | — | — | — |
| 15 | Quién revisa | Conectado: un administrador, en «Revisión administrativa», con «Evidencia / observaciones de la revisión» (`Account.jsx:74`, S-CON-13b). Demo: nadie | Un `platform_admin` en `/app/admin/verifications` (N-ADM-01). Tras el flag `QUALIFICATION_REVIEW_ENABLED`; la función `qualification-reviews` **no está desplegada** (next-static §0.3, §5.2) | ≈ | P1 | OD-3 (activación en PROD) | Ver fila 16 |
| 16 | Efecto en el matching | Demo: no exige verificación. Conectado: la elegibilidad no mira `review`; la **confirmación** exige `review==='reviewed'` y documentos revisados (V18-26) | Los requisitos obligatorios solo aceptan `verified` (C-3; `src/domain/matching.ts:80-102`). En PROD nadie puede verificar, así que ningún técnico externo cumple una necesidad, y toda necesidad tiene al menos una obligatoria (IDE:110-149). v2: con M07/M08, T-08 exige ser elegible para presentar candidatura y la confirmación vuelve a comprobarlo, así que en PROD tampoco se podría aplicar ni confirmar. | ≠ | P0 | OD-3 (activación en PROD) | Desbloquear OD-3 (procedimiento y lista de revisores) y desplegar `qualification-reviews`. No portar la permisividad de v1.8 |
| 17 | Motivo de rechazo | Conectado: el técnico no ve la nota, solo `labels[p.review]` | «Revisor: {motivo}» en la fila (`QualificationsManager.tsx:322-326`; es:625). Runtime v2: oscar tiene una rechazada sin nota en la semilla, así que solo se ve el chip «Rechazada»; la línea «Revisor:», solo en código (`evidencias/v2/20/TEC-03-5-next-1440.txt`). | + | — | — | Mantener |
| 18 | Aviso de pendientes en el inicio | — | Panel «Próximos pasos» en Mi espacio (`page.tsx:154-172`) | + | — | — | Mantener |
| 19 | Chip de caducidad | Demo: medalla con clase `expired` y `documentStatus` en los documentos | «Caduca pronto» (≤ 45 días) o «Caducado», solo en las activas (`QualificationsManager.tsx:309-319`; BR-12) | = | — | — | — |
| 20 | Restricciones | Demo y conectado: por habilitación y generales. La medalla dice «Con restricciones». `eligible` exige no tener restricciones si la oferta pide licencia (V18-08) | No existen | − | P1 | — (v2: default v1.8; antes C-10/D-02) | Ver TEC-02, filas 25-26 (N-02) |
| 21 | Habilitación ligada a la licencia | La habilitación es aeronave × categoría (`Professional2.jsx:81-94`; `Account.jsx:62`) | Los TR-* son independientes de la licencia | ≠ | P1 | — (v2: default v1.8; antes C-10/D-02, V18-08) | Ver TEC-02, fila 23 (N-02) |
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

---

## TEC-04 · Disponibilidad — v1.8 `S-TEC-03, S-TEC-03a, S-MOD-TEC-03, D-TEC-03, S-CON-02, S-CON-02a, S-CON-02b, S-CON-03a, C-TEC-03/14/15/16/17/18/34` ↔ Next `N-PRO-04, N-PRO-01 (mini calendario)`

**Estado global:** PARCIAL, muy cerca del modo conectado. Coinciden los 14 patrones, el ciclo libre de hasta 31 días, la
base 7–3/7–4, la generación del mes visible, la publicación de descansos, «reemplazar», el pintado por días, los días
parciales y «Solo AOG».

Next añade:
- deshacer paso a paso;
- KPIs;
- intervalos con horas y estado;
- el mes en la URL.

Le falta o difiere (v2, `038329f`):
- el control de versión cubre solo «Guardar calendario» y está sin desplegar (W5-03, local);
- «Asignada» ya se marca en los días de una asignación confirmada (M08, `db05af1`), pero el día sigue editable y el
  generador no lo salta: es el default técnico T-13, contrario a v1.8 (filas 26, 39, 43 y 52);
- el modal de revisión y el «deshacer tras guardar» de la demo;
- una ventana suelta con inicio pasado ya no pasa el formulario (X-19), aunque la API la sigue aceptando, como el conectado;
- resueltos en el bucle: la vista previa avisa cuando no genera ningún día (X-15) y un fallo de red conserva la página y el
  borrador (X-02) (filas 62-63).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | Demo: `#calendar` «Disponibilidad», dock «Calendario». Conectado: `#calendar` | `/app/professional/availability` con `?month=` (`AppShell.tsx:32`) | ≈ | — | — (v2: el dock va en SH-05, área 10) | — |
| 2 | Sin perfil | Conectado: «Primero, tu perfil» + «Guarda el pasaporte profesional para disponer de tu calendario conectado.» + «Completar perfil» (`src/beta/ConnectedCalendar.jsx:11`) | El perfil técnico se crea al registrarse (`handle_new_user`). Una cuenta de organización ve «Sin perfil profesional» (`src/app/app/professional/availability/page.tsx:26-33`). Runtime v2 con `admin.mro` (en): «No professional profile» (`evidencias/v2/20/TEC-04-7-next-1440.txt`). | ≈ | — | — | — |
| 3 | Kicker | Demo «TU CALENDARIO». Conectado «DISPONIBILIDAD CONECTADA» | «Mi tiempo» (es:629) | ≈ | P3 | — | — |
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
| 26 | Días que se saltan | Demo: pasados, `assigned` y excepciones manuales si no se reemplazan (`AvailabilityPlanner.jsx:13-14`). Conectado: pasados, `assigned` y días pendientes o en `schedule` si no se reemplazan; los intervalos parciales sin `schedule` se sobrescriben (C §4.3) | Pasados, y días con cualquier ventana si no se reemplaza (`rotation.ts:105-106`). Desde M08 hay asignaciones confirmadas, pero `planCycle` no las conoce: un ciclo puede marcar «Bloqueado» o limpiar un día asignado (la página solo pasa `assignedDays` al pintado, `AvailabilityManager.tsx:84,398-409`). Runtime v2 con delta: «7–3» + «Replace…» + vista previa → «2026-10-22: Blocked · working, not saved, confirmed assignment»; nada guardado (`evidencias/v2/20/TEC-04-11-next-1440.log.txt`, `.jpg`). Sin «Reemplazar», el día se salta porque tiene ventana, no por estar asignado. | ≠ (v2: antes ≈) | P2 | T-13 (default técnico contrario a v1.8; v2: antes D-06) | Default v1.8: saltar los días asignados al generar (N-04, con el visto bueno del owner a revertir T-13) |
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
| 39 | Estados de día | Demo: Trabajo, Descanso, Disponible, Solo AOG, Asignado. Conectado: los mismos y Parcial. Runtime v2 (conectado T1): «2026-10-22: Asignado» y «2026-10-30: Asignado», ambos `disabled` (`evidencias/v2/20/TEC-04-1-v18c-1440.aria.yml`). | Disponible, Bloqueado, Parcial, Descanso, Solo AOG (es:651-657). v2: los días de una asignación confirmada llevan «● Asignada» bajo el estado (también a 390 px) y «, asignación confirmada» en el `aria-label`; solo marcan, no bloquean (T-13) (`src/app/app/professional/availability/page.tsx:34-44`; `src/features/availability/calendar.ts:155-167`; `AvailabilityManager.tsx:84,398-409`; es:743-744). Test `assignmentDays` en verde. Runtime v2 con delta (en; confirmada el 22/10 por el área 30): «● Assigned» bajo «Available» y `aria-label` «2026-10-22: Available, confirmed assignment», sin `disabled` (`evidencias/v2/20/TEC-04-10-next-1440.txt`, `.aria.yml`). | ≈ | P3 (v2: antes P2) | — (v2: D-06 ratificada; marca hecha en `db05af1`) | Mantener. «Asignada» ≈ «Asignado». La protección, en la fila 43 |
| 40 | Precedencia de estados | Conectado `calendarState`: asignado > `schedule` > intervalo que cubre el día (aog si alguno es `aogOnly`) > parcial > off (`connectedModel.js:5-9`) | Bloqueado completo > bloqueo parcial = Parcial > AOG completo > AOG parcial = Parcial > disponible completo > parcial > Descanso (`calendar.ts:66-90`; BR-4.8) | ≈ | — | — | — |
| 41 | Estilo | AOG en naranja y parcial rayado (v18.css) | AOG en `warn` y parcial rayado con `bg-partial` (`calendar.ts:32-39`) | = | — | — | — (10:161 corregido en W4-02) |
| 42 | Días pasados | Deshabilitados en demo y conectado; el servidor del conectado también los rechaza (`server/connected.mjs:20`). Runtime demo: 21 de 31 días `disabled` (`evidencias/xhigh/20/TEC-04-1-v18-1440.jpg`). Pero el editor de intervalos con horas del pasaporte conectado sí acepta fechas pasadas: solo exige fin > inicio (`src/beta/Account.jsx:62`; `server/app.mjs:65-66`, `period()` sin suelo de fecha, `server/rules.mjs:10`) | Siempre deshabilitados y sin acción al pulsarlos, haya o no borrador: `isDayEditable(date, today)` (`src/features/availability/calendar.ts:118`; `AvailabilityManager.tsx:233,396`). El `PUT` por lotes ya los rechazaba en el servidor (`20261021120000_availability_version.sql:136-137`). v2 (X-19, solo formulario): una ventana nueva, o una cuyo inicio se mueve, no puede empezar en un día pasado: «El inicio no puede estar en el pasado» (`refusesPastStart`, `src/features/availability/calendar.ts:120-126`; `AvailabilityManager.tsx:277-284`; es:259). «Editar» de la ventana en curso conserva su inicio pasado sin error. Siguen aceptándolo la validación compartida, la Edge Function, la RPC y la tabla, como el conectado (`src/lib/validation/availability.ts:17-37`; `supabase/functions/professional-availability/index.ts:117-157`; `20261015130200_idempotent_creates.sql:154-182`). Runtime v2: 21 de 31 celdas `disabled`; «Añadir» con inicio el 01/10 y mover el inicio de la ventana en curso al 02/10 → error junto a «Inicio (UTC)», 0 POST (`evidencias/v2/20/TEC-04-9-next-1440.txt`) | ≈ (antes ≠) | — (v2: antes P3) | — | Mantener (W1-03 + X-19, `befd21d`). Opcional: el suelo también en servidor (N-26, resto de B-12) |
| 43 | Días asignados | Deshabilitados. Demo: «Una asignación confirmada está protegida.». Conectado: «No puedes modificar una fecha con asignación confirmada.» | v2: desde M08 hay asignaciones, pero sus días siguen editables: solo llevan la marca «● Asignada» (fila 39), sin `disabled` ni mensaje (runtime v2 con delta: el 22/10 asignado sigue habilitado, `evidencias/v2/20/TEC-04-10-next-1440.aria.yml`). Es el default técnico T-13 («Availability edits after a confirmation are not blocked (v1.8 blocks them)», `docs/integration/crewflex-v13/08-product-decisions.md` §T-13) | ≠ (v2: antes −) | P2 | T-13 (default técnico contrario a v1.8; v2: antes D-06) | Proponer al owner el default v1.8: día `disabled` + «Una asignación confirmada está protegida.» y rechazo en servidor (N-04) |
| 44 | Clic sin borrador | Demo: guarda al momento (`paintAvailability`), sin toast. Conectado: siempre va a pendientes | Guarda al momento si el día, de hoy en adelante (fila 42), está vacío o tiene una ventana de un día: «{fecha} marcado como {estado}» / «{fecha} limpiado». Si no, va al borrador con aviso de recorte (`AvailabilityManager.tsx:231-262`; es:669-670, 734) | ≈ | — | — | — |
| 45 | Excepciones manuales | Demo: `manualDates`, que se conservan al generar salvo que se reemplacen | No hay marca de excepción; se conservan los días que tienen ventanas | ≈ | — | — | — |
| 46 | Cambios sin guardar | Conectado: «{n} días modificados sin guardar. Revisa el calendario antes de publicarlos; guarda o descarta para cambiar de mes.», sin plural | «{n} día(s) modificado(s) sin guardar. Revisa el calendario y guarda o descarta para cambiar de mes.», con plural ICU (es:729); sin «antes de publicarlos». Runtime: «10 días modificados sin guardar…» (`evidencias/xhigh/20/TEC-04-2-next-1440.jpg`) | ≈ (xhigh: antes =) | — | — | — |
| 47 | Aviso de recorte | — | «{n} día(s) está(n) dentro de un intervalo más largo o de horas parciales…» (es:734) | + | — | — | Mantener |
| 48 | Guardar | Conectado: «Guardar calendario en mi cuenta» → «Cambios guardados.» | «Guardar calendario» → «{n} días guardados», «Patrón guardado; ningún día necesitaba cambios.» o «Nada que guardar…» (es:730-736) | ≈ | — | — | — |
| 49 | Descartar | Conectado: «Descartar cambios» | «Descartar cambios» (es:731) | = | — | — | — |
| 50 | Conflicto de versión | Conectado: `version` → 409 «El calendario ha cambiado. Actualiza antes de guardar.» (`server/app.mjs:77-81`; C-TEC-18) | El GET de `professional-availability` devuelve `version`, una huella md5 de las ventanas y el patrón (`availability_version()`). La página la pasa al calendario y «Guardar calendario» la envía como `expectedVersion`. Si no coincide: 409 `CONFLICT` y «Tu calendario cambió en otra ventana o dispositivo. No se ha guardado nada: recarga para ver la versión más reciente.»; el borrador se conserva (`supabase/migrations/20261021120000_availability_version.sql:12,132-133`; `supabase/functions/professional-availability/index.ts:67-72,91,165`; `src/app/app/professional/availability/page.tsx:54`; `AvailabilityManager.tsx:154-175`; es:738). Las escrituras de un día o una ventana (POST/PATCH/DELETE) no se comprueban, pero cambian la versión. Solo en local: migración y función sin desplegar | ≈ (antes −) | — | Despliegue (owner) | Desplegar migración y función con autorización del owner (W5-03) |
| 51 | Límites | Conectado: hasta 31 fechas del mes por guardado, 400 intervalos y 730 fechas en `schedule` («Días de calendario no válidos.», «Demasiados intervalos: simplifica tu calendario.»). Demo: un día por clic | Hasta 62 días por `PUT` («Como máximo 62 días a la vez»), ventanas de hasta 366 días y ciclos de hasta 31 (`src/lib/validation/availability.ts:13,44`; es:358) | ≈ | — | — | — |
| 52 | Pista de protección | Conectado: «Las fechas con asignación confirmada están protegidas también en el servidor. AOG requiere además activar tus avisos/consentimiento AOG en el perfil. No se envían candidaturas al guardar.» | Solo la pista de AOG (es:741), sin asignaciones ni consentimiento | ≈ | P3 | T-13 (v2: antes D-06) | Añadir la frase de protección si se revierte T-13 (N-04) |
| 53 | «Solo AOG» y consentimiento | Demo `availableOn`: el día AOG cuenta si la oferta es AOG **y** hay `aogOptIn` (`business.js:108-110`). Conectado: `aogOnly` solo con `aogOptIn` y oferta AOG por plazo (V18-20) | `aog_only` cuenta solo si la urgencia declarada es `aog`, sin consentimiento aparte (BR-4.8; C-8/D-05) | ≠ | — | — | Mantener: marcar `aog_only` ya es el consentimiento (TD-65) |
| 54 | AOG por plazo | Oferta a ≤ 10 días → AOG (`business.js:34-38`; `server/rules.mjs:7`) | Urgencia declarada (D-05) | ✗ | — | — | No portar |
| 55 | Intervalos con horas: dónde | Conectado: `<details>` del pasaporte «Intervalos de disponibilidad con horas concretas (UTC)» + «Para planificar por días y ciclos usa Disponibilidad. …» (`Account.jsx:62`). Demo: no hay («esta demo no reserva horas dentro de un día») | Panel «Añadir una ventana de tiempo» / «Editar ventana» en la misma página (`AvailabilityManager.tsx:434-485`; es:674-675) | + | — | — | Mantener |
| 56 | Intervalos: campos | «Inicio UTC» / «Fin UTC», `datetime-local`; solo disponibilidad | «Inicio (UTC)» / «Fin (UTC)», `datetime-local` con paso de 900 s; «Estado»: «Disponible», «No disponible», «Disponible solo para AOG» (es:676-680, 740) | + | — | — | — |
| 57 | Intervalos: validación | «Añadir intervalo» no hace nada, sin aviso, si el fin no es posterior al inicio; acepta fechas pasadas (fila 42) | «El fin debe ser posterior al inicio», «Una ventana puede abarcar como máximo 366 días»… (es:257-268). `v.window.status` dice ya «Elige disponible, no disponible o solo AOG» (es:266). Runtime: fin anterior al inicio → «El fin debe ser posterior al inicio» junto al campo, sin enviar. No hay regla de fecha mínima (fila 42). v2: el formulario añade el suelo de fecha del inicio (fila 42, X-19). | + | — | — | Mantener (W2-09) |
| 58 | Intervalos: lista | «{dt} → {dt}[ · Solo AOG]» + «Quitar intervalo», que se aplica al guardar el perfil | «Ventanas guardadas ({n})»: chip + «DD MMM YYYY, HH:MM UTC → …» + «Editar» / «Eliminar». «Eliminar» pide confirmación: «Sí, eliminarla» / «Cancelar» (`AvailabilityManager.tsx:487-526`; `ConfirmButton.tsx:11-75`; es:681-682, 628). Runtime: «Eliminar» → foco en «Cancelar»; «Cancelar» → foco en «Eliminar». v2: tras «Sí, eliminarla» el aviso del resultado toma el foco (X-08). Runtime v2 con la acción abortada: foco en `P[role=alert]` «Se ha perdido la conexión…», nada borrado («Ventanas guardadas (1)» tras recargar) (`evidencias/v2/20/TEC-04-9-next-1440.txt`) | ≈ | — (v2: antes P3) | — | Mantener (W1-10; foco: X-08, B-13 HECHO) |
| 59 | Efecto secundario | Editar intervalos en el pasaporte vacía `schedule` y borra las marcas privadas (C §3.15-8) | — | ✗ | — | — | No portar |
| 60 | Tarifa por día | No existe en v1.8 (D2 §3, S-TEC-03) | No existe | = | — | — | — |
| 61 | Diseño a 390 px | Celdas de 42×70 con etiquetas que se solapan (§2.M; C-TEC-14 a 390; demo: `evidencias/xhigh/20/TEC-04-1-v18-390.jpg`) | La etiqueta de estado se oculta por debajo de `sm` (`AvailabilityManager.tsx:404`; `evidencias/xhigh/20/TEC-04-1-next-390.jpg`) | + | — | — | Mantener |
| 62 (nueva xhigh) | Vista previa sin días que generar | Demo: el modal responde siempre: «{n} fechas futuras del mes. {m} tienen una excepción manual.» (`AvailabilityPlanner.jsx:15`; runtime: «10 fechas futuras del mes. 0 tienen una excepción manual.», `evidencias/xhigh/20/TEC-04-2-v18-1440.jpg`). Conectado: sin aviso, pero solo salta días con `schedule` o pendientes, no los que tienen intervalos (`ConnectedCalendar.jsx:10`) | X-15: si la vista previa no genera ningún día, avisa: «No hay días que generar: todos los días desde hoy ya tienen ventanas guardadas. Marca «Reemplazar también…» o elige otro mes.»; en un mes pasado, «Este mes ya ha pasado: elige el mes actual o uno futuro.» (`AvailabilityManager.tsx:200-204`; `rotation.ts:114-119`; es:725-726). Runtime v2 con alpha: octubre (cubierto por una ventana) y septiembre dan cada uno su aviso, 0 días en borrador (`evidencias/v2/20/TEC-04-9-next-1440.txt`). Test `emptyPreviewReason` en verde | ≈ (v2: antes ≠) | — | — | Mantener (X-15, `a941e87`; B-15 HECHO) |
| 63 (nueva xhigh) | Fallo de red al guardar | Conectado: `run()` captura el error y lo muestra bajo la cabecera sin perder el formulario (`src/beta/Account.jsx:31`) | X-02: `run()` envuelve la acción en `callAction` (`AvailabilityManager.tsx:134`; `src/components/ui/Notice.tsx:60-92`): sin conexión, «Se ha perdido la conexión. Tus cambios siguen aquí; comprueba la conexión y reintenta.» (es:223), sin límite de error. Runtime v2 sin conexión: «Añadir» conserva el formulario; «Guardar calendario» con 30 días en borrador los conserva (30 → 30) (`evidencias/v2/20/TEC-04-8-next-1440.jpg`, `TEC-04-9-next-1440.txt`). Lo mismo en `ProfileForm.tsx:62`, `QualificationsManager.tsx:85` y `DocumentWallet.tsx:111,132,158,171` (pasaporte y «Sí, quitarla» también en runtime) | ≈ (v2: antes ≠) | — | — | Mantener (X-02, `1c2616c`; B-14 HECHO) |
| 64 (nueva xhigh) | Nota bajo la vista previa | Demo: «Se respetan las asignaciones, las fechas pasadas y tus excepciones manuales. Los patrones nocturnos marcan días completos; esta demo no reserva horas dentro de un día.» (`AvailabilityPlanner.jsx:15`; `evidencias/xhigh/20/TEC-04-3-v18-1440.jpg`) | No hay frase propia; la pista del ciclo cubre lo esencial: «Se generan días completos UTC… Los intervalos parciales de los días que no reemplazas se conservan.» (es:696). No dice que se saltan los días pasados | ≈ | — | — | — |

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

---

## TEC-05 · Documentos / wallet — v1.8 `S-TEC-06, S-TEC-06a, S-MOD-TEC-04, S-MOD-TEC-05, S-MOD-TEC-06, D-TEC-06, S-CON-09, C-TEC-06/24` ↔ Next `N-PRO-05, N-PRO-01 (revisión a 60 días)`

**Estado global:** PARCIAL. El wallet de Next coincide con el conectado: 5 MB, PDF/PNG/JPEG por bytes mágicos y tipos
license/course/other. Además:
- la edición en línea viene de la demo;
- el vínculo con una cualificación y la confirmación al borrar son mejoras propias.

Le faltan:
- las pestañas por bloque, la papelera y la vista previa de la demo (pestañas y vista previa, aplazadas por el owner:
  AB-34 y AB-28; v2: SCOPE-2 las desbloquea, son del wallet propio);
- el análisis y la revisión del conectado (D-10);
- v2: la confirmación de borrado usa ya el `ConfirmButton` común y no pierde el foco (X-08).

En PROD no es visible: el flag de BD falla cerrado y ni la tabla ni la función están desplegadas.

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Disponibilidad de la pantalla | Siempre presente, en demo y conectado | Tras el flag de BD `document_wallet` (`src/server/feature-flags.ts:29-37`). Sin flag: 404 (`src/app/app/professional/documents/page.tsx:19`) y sin entrada «Documentos» (`AppShell.tsx:36`). En PROD no hay tabla ni función (next-static §0.1-0.2) | − | P1 | D-10 (despliegue release 2, M-3) | Desplegar con autorización del owner |
| 2 | Entrada | Demo: «Wallet documental» `#docs`. Conectado: «Documentos» `#documents` | «Documentos» → `/app/professional/documents` (es:73) | = | — | — | Igual al conectado |
| 3 | Kicker | Demo: «WALLET DOCUMENTAL». Conectado: ninguno | «MI EXPEDIENTE» (es:1197) | ≈ | P3 | — | — |
| 4 | Título | Demo: «Tu expediente, una vez.» (`Professional2.jsx:210`). Conectado: h2 «Wallet documental» (`Account.jsx:72`). Runtime v2: demo «Tu expediente, una vez.»; conectado «Wallet documental» (`evidencias/v2/20/TEC-05-1-v18-1440.txt`, `TEC-05-1-v18c-1440.txt`). | «Wallet documental» (es:1198) | = | — | — | Igual al conectado |
| 5 | Descripción | Demo: «Los archivos se guardan por referencia. Las copias históricas conservan su versión.». Conectado: «PDF, PNG o JPEG, hasta 5 MB. Los archivos quedan en cuarentena; subirlos no acredita una licencia. Administración puede analizarlos con ClamAV configurado y después revisar su contenido. Solo los archivos limpios permiten descarga.» | «Tus licencias, cursos y otros documentos, guardados de forma privada. Solo tú puedes verlos.» y, en la subida, «PDF, PNG o JPEG, hasta 5 MB. Subir un documento no acredita una licencia ni una habilitación: la verificación es un proceso aparte.» (es:1199, 1202) | ≈ | — | — | — |
| 6 | Pestañas por bloque | Demo: «Todos», «Licencias», «CV y experiencia», «Cursos», «Permisos y seguridad» (`Professional2.jsx:183`); runtime: las 5 pestañas y «Licencias» deja un solo panel (`evidencias/xhigh/20/TEC-05-2-v18-1440.jpg`). Conectado: no hay | No hay filtro; una sola lista (runtime, flag activo en local: `evidencias/xhigh/20/TEC-05-1-next-1440.jpg`) | − | P3 | — (v2: desbloqueado por SCOPE-2; antes AB-34, aplazamiento del owner) | Portar pestañas o filtro por tipo (N-20, antes B-06) |
| 7 | Tipos | Demo: 4 bloques (Licencias, CV y experiencia, Cursos, Permisos y seguridad). Conectado: license, course, other («Licencia», «Curso», «Otro») | license, course, other: «Licencia», «Curso», «Otro» (`src/domain/documents.ts:7`; es:1206-1210) | = | P3 | — | Igual al conectado. CV y permisos van como «Otro» |
| 8 | Formulario de subida | Demo: modal «Añadir documento». Conectado: formulario en la página | Panel «Subir un documento» en la página (`DocumentWallet.tsx:199-279`) | = | — | — | Igual al conectado |
| 9 | Campo de archivo | Demo: «Archivo · máximo 2 MB». Conectado: «Archivo de prueba» | «Archivo» con la pista «El tipo se comprueba por el contenido del archivo, no por su nombre.» (es:1203-1204) | ≈ | — | — | — |
| 10 | Formatos | Demo: `.pdf,.png,.jpg,.jpeg,.webp`, por MIME. Conectado: `.pdf,.png,.jpg,.jpeg` y bytes mágicos | `.pdf,.png,.jpg,.jpeg` + MIME en `accept` y bytes mágicos en la función (`DocumentWallet.tsx:42`; `documents.ts:37-42`) | = | P3 | — | Igual al conectado. No portar WebP |
| 11 | Tamaño máximo | Demo: 2 MB. Conectado: de 1 byte a 5 MB | 5 MiB en cliente y en bucket (`documents.ts:14`; `DocumentWallet.tsx:82`) | = | — | — | Igual al conectado |
| 12 | Errores del archivo | Demo: «Selecciona PDF, PNG, JPEG o WebP de hasta 2 MB.». Conectado: «El archivo debe ocupar entre 1 byte y 5 MB.», «Solo PDF, PNG y JPEG con cabecera válida.» | «Elige un archivo para subir», «Solo se aceptan archivos PDF, PNG o JPEG», «El archivo supera los 5 MB», «No se pudo leer la subida. Inténtalo de nuevo.» (es:374-379) | ≈ | — | — | — |
| 13 | Título | Demo: «Título», opcional; vacío → nombre del archivo. Conectado: no hay título, se usa el nombre | «Título», ≤ 180, con la pista «Si lo dejas vacío se usa el nombre del archivo.»; se limpia (`DocumentWallet.tsx:89`; `documents.ts:65-70`) | = | — | — | Igual a la demo |
| 14 | Tipo o bloque | Demo: «Bloque», por defecto Licencias. Conectado: «Tipo», por defecto Licencia | «Tipo», por defecto Licencia | = | — | — | — |
| 15 | Caducidad | Demo: «Caducidad (si aplica)», opcional; error «Caducidad inválida.». Conectado: «Caducidad», **obligatoria** | «Caducidad (opcional)» (es:1213) | ≈ (xhigh: antes =) | — | — | Igual a la demo en el comportamiento; cambia la etiqueta |
| 16 | Vincular a una cualificación | Desde el pasaporte, en los dos modos | «Vincular a una cualificación (opcional)»: «— Sin vincular —» + las propias «{code} · {name}», con la pista «Solo tus propias cualificaciones declaradas.» (es:1214-1216) | ≈ | — | — | Ver TEC-03, fila 22 |
| 17 | Aviso de la subida | Demo: «Pendiente de verificación. Vincula la evidencia al curso o habilitación en Mi pasaporte. Renovar un archivo crea una nueva versión sin cambiar expedientes anteriores.». La acción de renovar no existe (H-15) | El texto de la fila 5 | ≈ | — | — | No portar la promesa de «Renovar» |
| 18 | Botón y confirmación | Demo: «Guardar documento» / «Guardando…» → toast «Documento guardado». Conectado: «Guardar documento» → «Documento guardado en cuarentena.» | «Subir documento» → «Documento guardado en tu wallet privado.» (es:1217-1218) | ≈ | — | — | — |
| 19 | Transporte | Demo: IndexedDB local. Conectado: base64 dentro de JSON a `/api/documents` | Multipart del navegador a la Edge Function, con JWT e `Idempotency-Key` (`src/features/documents/upload.ts:22-63`) | + | — | — | — |
| 20 | Lista | Demo: un panel por bloque. Conectado: lista simple, sin título | «Tus documentos ({n})» + la nota «Ninguna empresa puede ver estos documentos. …» (es:1221-1222) | ≈ | — | — | — |
| 21 | Lista vacía | Demo, por bloque: «Sin documentos» + «Aporta evidencia cuando esté disponible.». Conectado: sin texto | «Todavía no has subido documentos.» (es:1223) | ≈ | — | — | — |
| 22 | Datos de cada fila | Demo: «{caducidad \|\| 'Sin caducidad declarada'} · {verificación}» + «Ejemplo sin archivo». Conectado: «{caducidad} · {Cuarentena\|Análisis limpio\|Bloqueado por amenaza} · {Pendiente\|Revisión registrada}». Runtime v2 (conectado T1): «2028-06-30 · Análisis limpio · Revisión registrada» + «Descargar archivo»; los dos cursos «Cuarentena · Pendiente» (`evidencias/v2/20/TEC-05-1-v18c-1440.txt`). | Chips de tipo, análisis («Sin analizar · no compartible» / «Analizado» / «Bloqueado») y caducidad; línea «PDF\|Imagen PNG\|Imagen JPEG · {tamaño} · caduca el {f} · vinculado a {q}» (`DocumentWallet.tsx:365-386`; es:1224-1235) | ≈ | — | — | — |
| 23 | Estado de caducidad | Demo `documentStatus`: «Sin caducidad», «Fecha inválida», «Caducado», «Caduca pronto» (≤ 45 días), «Vigente» (`business.js:79-84`). Conectado: no hay | «Vigente», «Caduca pronto» (≤ 45 días), «Caducado»; sin fecha no hay chip (`documents.ts:82-92`; es:1238-1242; BR-12) | = | — | — | — |
| 24 | Revisión a 60 días | Demo: `<details>` «Documentos y cursos próximos a revisar» en el pasaporte visual, con «Fecha superada» / «Próximos 60 días» y el pie «Según las fechas declaradas. No se envían avisos externos; los documentos sin fecha no se consideran verificados.»; sin texto de vacío (`Badges.jsx:10`) | Panel en Mi espacio con las cualificaciones activas y los documentos (si hay flag). Vacío: «Nada de lo declarado caduca en los próximos 60 días.». Error: «No se han podido cargar tus documentos; la lista solo incluye cualificaciones.» (`page.tsx:173-215`; es:518-524). Mismos literales que v1.8, pero en otro sitio (Mi espacio, no el pasaporte; panel en vez de `<details>`), con botón «Abrir» por fila, texto de vacío y sin los cursos que no son cualificaciones activas. Runtime: `evidencias/xhigh/20/TEC-01-1-next-1440.jpg` | ≈ (xhigh: antes =) | — | — | Mantener (TD-44 VERIFIED_PARITY_LOCAL). Coherente con TEC-01 fila 43 (≈) |
| 25 | Verificación del documento | Demo: «Autodeclarado» / «Pendiente». Conectado: `review` «Pendiente» / «Revisión registrada» | No hay revisión de documentos | − | P2 | D-10 / OD-3 | — |
| 26 | Análisis antivirus | Conectado: un administrador lanza ClamAV; cuarentena → limpio o bloqueado (`server/scanner.mjs:7-13`) | `scan_status` es siempre `not_scanned` (`documents.ts:18-22`) | − | P2 | D-10 (CX-14) | — |
| 27 | Descargar o abrir | Demo: «Descargar archivo» (blob) + «Vista previa», o «Archivo no disponible». Conectado: «Descargar archivo» solo si está limpio | «Abrir»: URL firmada de 60 s en pestaña nueva (`DocumentWallet.tsx:128-140,393-395`) | ≈ | — | — | — |
| 28 | Vista previa en la app | Demo: modal con el título; PDF en `<object>` de 450 px y «Usa Descargar para abrir este PDF.»; imagen en `<img>`; «Descargar documento» (runtime con un PNG subido en la demo: `evidencias/xhigh/20/TEC-05-3-v18-1440.jpg`) | No hay: se abre en pestaña nueva | − | P3 | — (v2: desbloqueado por SCOPE-2; es el wallet propio, no acceso de terceros; requiere `object-src`/`img-src` de Storage en la CSP; antes AB-28 / D-10) | Portar el visor (N-21, antes B-07) |
| 29 | Editar | Demo: modal «Editar metadatos» (Título, Caducidad) + «La modificación no cambia expedientes ya enviados.»; con título vacío no guarda y no avisa (H-15). Conectado: no se puede editar | En línea: Título, Tipo, Caducidad y Vincular; «Guardar» / «Cancelar» → «Documento actualizado.» (`DocumentWallet.tsx:299-356`; es:1219) | + | — | — | Mantener |
| 30 | Archivar y papelera | Demo: icono Trash2 «Archivar {título}» → papelera; botones «Papelera» / «Ver wallet»; «Restaurar»; vacío «Los documentos archivados pueden restaurarse.» (runtime: archivar → «Papelera» → fila con «Restaurar», `evidencias/xhigh/20/TEC-05-4-v18-1440.jpg`) | No: el borrado es definitivo | − | P3 | — (v2: default v1.8; borrado definitivo al vaciar; antes retención release 2, TD-51) | Portar «Archivar» / «Papelera» / «Restaurar» (N-19) |
| 31 | Eliminar | Conectado: «Eliminar», sin confirmación; error «Retira primero las candidaturas que comparten este documento.» | «Eliminar» usa ya el `ConfirmButton` común: «Confirmar eliminación» / «Cancelar», con el foco en «Cancelar» al abrir y de vuelta en «Eliminar» al cancelar; tras confirmar, el aviso «Documento eliminado.» toma el foco si se ha perdido (X-08) (`DocumentWallet.tsx:406-413`; `src/components/ui/ConfirmButton.tsx`; es:1237, 1220). Solo código: alpha no tiene documentos | + | — | — | Mantener |
| 32 | Documentos de ejemplo | Demo: 6 documentos con `demo:true`: Licencia EASA Part-66, CV profesional, Human Factors, EWIS, Fuel Tank Safety, PCP Madrid (`src/data/v11.js:5`) | Ninguno | ✗ | — | — | No portar (solo demo) |
| 33 | Compartir con empresas | Demo: se eligen en el Candidate Pack y los archivos se ven tras consentimiento y aceptación. Conectado: casillas en «Preparar candidatura»; la empresa descarga si está limpio | Imposible por diseño: `canShareWithThirdParties` siempre devuelve false (`documents.ts:77-79`; nota es:1222) | − | P1 | D-07 P3 + D-10 (CX-39) | — |
| 34 | Copias en expedientes enviados | «Las copias históricas conservan su versión.» | — | − | P3 | D-07 P3 + D-10 (copias para terceros; M09 preparado y apagado) | — |
| 35 | Exportar archivos | Conectado: los archivos van en base64 en «Exportar mis datos y archivos» | No | − | P3 | — (v2: SCOPE-2 «copiarlo todo»; no está en OUT; antes SCOPE, CX-43) | Portar con «Exportar mis datos» (N-13) |
| 36 | Mantenimiento | — | `documents-maintenance` limpia huérfanos y tombstones; no tiene cron | + | — | — | — |
| 37 (nueva xhigh) | Foco en la confirmación de borrado | Sin confirmación: la demo archiva y el conectado borra con un clic, sin pérdida de foco | X-08 sustituye la confirmación propia por el `ConfirmButton` común (`DocumentWallet.tsx:406-413`): foco en «Cancelar» al abrir, de vuelta en «Eliminar» al cancelar y, tras confirmar, en el aviso. El mismo componente se comprobó en runtime con las ventanas (TEC-04, fila 58); aquí, solo código (no hay documentos en local) | ≈ (v2: antes ≠) | — | — | Mantener (X-08, `4357034`; B-13 HECHO) |

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

---

## TEC-06 · Logbook — v1.8 `S-TEC-07, S-TEC-07a, S-MOD-TEC-07, D-TEC-07, S-CON-10, C-TEC-07/39` ↔ Next `—`

**Estado global:** AUSENTE EN NEXT. La V1 lo deja fuera: «logbook from the prototype» está en LATER
(`docs/product/V1_SCOPE.md:60`; M14 NOT_STARTED, TD-76/77 · SCOPE LATER). **v2:** con SCOPE-2 el LATER es portable en
local (`V1_SCOPE.md:56-57,63` de `038329f`), así que todas las filas pasan a «desbloqueado» (N-12). Comprobado en el
conectado en ejecución: T1 tiene 3 entradas (`evidencias/v2/20/TEC-06-1-v18c-1440.*`).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Entrada | Demo: «Logbook» `#logbook`, icono BookOpen (`src/LegacyApp.jsx:24`). Conectado: «Logbook» `#logbook` | No existe (`AppShell.tsx:28-37`) | − | P2 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 2 | Cabecera | Demo: «MI EXPERIENCIA» / «Logbook personal.» / «Registro auxiliar privado. No sustituye registros oficiales de la empresa.» (`src/components/v11/Logbook2.jsx:13-55`). Conectado: h2 «Logbook personal» / «Registro autodeclarado; no constituye certificación de experiencia ni puesta en servicio.» (`Account.jsx:73`). Runtime v2 (conectado): «Logbook personal» + «Registro autodeclarado; no constituye certificación de experiencia ni puesta en servicio.» (`evidencias/v2/20/TEC-06-1-v18c-1440.txt`); demo «Logbook personal.» (`TEC-06-1-v18-1440.txt`). | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 3 | Fecha | Demo: «Fecha de la tarea», `date`, `max=today`, obligatoria, por defecto hoy. Conectado: «Fecha», obligatoria; una fecha futura da «El logbook registra actividad realizada, no futura.» | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 4 | Aeronave | Demo: «Aeronave», `select` con AIRCRAFT (las 12 de TEC-02, fila 22), por defecto A320 Family. Conectado: «Aeronave», texto obligatorio ≤ 100 | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 5 | Categoría de tarea | Demo: «Defect Rectification», «Inspection», «Component Replacement», «Troubleshooting», «Sheet Metal / Structures», «Cabin / Interiors»; por defecto la primera | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 6 | Entorno | Demo: «Line Maintenance», «Base Maintenance», «Engine Bay Check», «AOG Intervention», «Workshop»; por defecto la primera | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 7 | ATA y horas | Conectado: «ATA», texto opcional ≤ 10; «Horas», number con paso 0,1, obligatorio, de 0 a 24 («Horas: valor no válido.») | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 8 | Descripción | Demo: «Descripción técnica privada», textarea ≤ 3000, obligatoria. Conectado: «Actividad realizada», textarea ≤ 3000 | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 9 | Seleccionable para el expediente | Demo: «Disponible para seleccionar en Candidate Pack» al crear y «Seleccionable para expediente» en el historial (`cvRelevant`) | — | − | P3 | — (v2: desbloqueado, alcance LATER; la selección para el Pack, con M09) | Portar (N-12) |
| 10 | Guardar y mensajes | Demo: «Guardar entrada» → «Entrada guardada» / «Logbook actualizado»; error «Indica una tarea realizada, fecha válida y descripción.». Conectado: «Guardar entrada» → «Cambios guardados.» (el formulario no se vacía) | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 11 | Historial | Demo: panel «Historial» con h3 «{aeronave} · {categoría}», fecha, descripción y entorno. Conectado: «{fecha} · {aeronave} · ATA {ata} · {horas} h» + descripción. Runtime v2 (conectado T1): «2026-10-20 · A320 EC-QAA · ATA 32 · 3.5 h» + «Sustitución de rueda principal izquierda…» y 2 entradas más (`evidencias/v2/20/TEC-06-1-v18c-1440.txt`). Las horas salen con punto decimal: al portarlas, formato del idioma. | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 12 | Editar | Demo: modal «Editar experiencia» + «Los expedientes ya enviados conservan su copia.». Conectado: no se puede editar | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 13 | Archivar | Demo: «Archivar», «Ver archivo» / «Ver activas», «Entradas archivadas», «Restaurar». Conectado: no se puede borrar | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 14 | Estado | Conectado: `status:'self-declared'` (`server/app.mjs:140`) | — | − | P3 | — (v2: desbloqueado, alcance LATER) | Portar (N-12) |
| 15 | Entradas de ejemplo | Demo: 3 de Marcos B. y 2 por cada técnico ficticio (`src/data/mockData.js:68-96`; `src/data/demoWorld.js:15`) | — | ✗ | — | — | No portar |
| 16 | Fallos de v1.8 | Demo: la semilla «A320 Family (LEAP-1A)» no está en AIRCRAFT; sin texto de vacío; el panel «Nueva entrada» queda vacío al editar (H-18). Conectado: el formulario no se vacía tras guardar | — | ✗ | — | — | No portar |

Capturas:
- v1.8 demo: `evidencias/shots/demo/D-TEC-07-logbook-1440.png`, `D-TEC-07b-logbook-editar-1440.png`, `D-TEC-07c-logbook-archivo-1440.png`.
- v1.8 conectado: `evidencias/shots/connected/C-TEC-07-logbook-empty-1440.png`, `C-TEC-39-logbook-1440.png`.
- xhigh (22/10): `evidencias/xhigh/20/TEC-06-1-v18-{1440,390}.*`.
- Next: no hay pantalla.
- v2: demo `evidencias/v2/20/TEC-06-1-v18-1440.*`; conectado `TEC-06-1-v18c-1440.*` (3 entradas de T1).

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

**Estado global:** PARCIAL (antes AUSENTE EN NEXT). Solo existe el avatar de iniciales de la tarjeta de Mi espacio
(W2-01). No hay insignias, medallas ni foto:
- las medallas se aplazan hasta que haya datos verificados (OD-3, TD-15/16); v2: pasan a default v1.8, porque resumen
  lo declarado y no necesitan la revisión (N-15);
- la foto, por D-07/D-10; v2: default v1.8 solo en el navegador, como la demo (N-23);
- los logros de aprendizaje están en SCOPE LATER; v2: desbloqueados (TOOL-08, área 40).

Lo que más se acerca son los chips de verificación y caducidad de cada cualificación. El seudónimo para empresas es
distinto por diseño (T-04).

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Cómo se calculan | `badges()` (`progress.js:3-11`): por categoría (`specialty` si es NDT o Sheet Metal; si no, `category`); por capacidad NDT o Sheet Metal que no sea categoría; por habilitación «{aircraft} · {category}» (`aircraft`); por experiencia «{years} años». Sin duplicados por `id` | No existen | − | P2 | — (v2: default v1.8, medallas de lo declarado; antes OD-3) | Portar (N-15) |
| 2 | Estados y detalle | «Declarado» con «Categoría declarada en el perfil; pendiente de validación de su alcance.» o «Especialidad declarada. No acredita métodos, niveles ni autorización.». «Revisar vigencia» con «La fecha declarada requiere revisión.». «Con restricciones» con el texto de las restricciones. «Tipo declarado» con «Habilitación de tipo declarada. La autorización de firma corresponde a la organización; no se deduce de una medalla.». «Experiencia declarada» con «Experiencia indicada por el profesional; no es una certificación.» | No existen | − | P2 | — (v2: default v1.8, medallas de lo declarado; antes OD-3) | Portar (N-15) |
| 3 | Tira principal | Hasta 4 medallas (experiencia, categoría, aeronave, especialidad) + «+{n}», con `aria-label` «Ver {n} insignias adicionales»; «−» para plegar (`MedalStrip.jsx:5-8`) | — | − | P2 | — (v2: default v1.8, medallas de lo declarado; antes OD-3) | Portar (N-15) |
| 4 | Contenido de la medalla | Experiencia: «{years}» + «AÑOS». Categoría: escudo con la etiqueta. Aeronave: avión + modelo sin « Family». Especialidad: Wrench + «SM» para Sheet Metal | — | − | P3 | — (v2: default v1.8, medallas de lo declarado; antes OD-3) | Portar (N-15) |
| 5 | Estado caducado | Clase `expired` si el estado es «Revisar vigencia» | Chip «Caducado» o «Caduca pronto» en la fila de la cualificación (`QualificationsManager.tsx:309-319`) | ≈ | — | — | Sustituto aceptable |
| 6 | Accesibilidad | `aria-label="{label}: {status}"`, `title="{label} · {status}"` | — | − | P3 | — (v2: default v1.8, medallas de lo declarado; antes OD-3) | Portar (N-15) |
| 7 | Detalle | `role="status"` con «×» (`aria-label` «Cerrar detalle de insignia»), «{label} · {status}», el detalle y «Resumen del perfil; no concede autorización de firma ni acredita formación por participar en retos.» (`MedalStrip.jsx:9`) | — | − | P3 | — (v2: default v1.8, medallas de lo declarado; antes OD-3) | Portar (N-15) |
| 8 | Dónde aparecen | Inicio (ambos modos), pasaporte (todas en la demo; vista previa en el conectado), directorio de empresas y Candidate Pack | — | − | P2 | — (v2: default v1.8; en el Pack con M09; antes OD-3 / D-07) | Portar en inicio y pasaporte (N-15) |
| 9 | Pasaporte visual | `<section aria-label="Insignias profesionales">`, kicker «PASAPORTE VISUAL»; vacío «Añade categorías, habilitaciones y experiencia para completar tu pasaporte visual.»; pie «Las insignias resumen datos declarados. No conceden autorización de firma ni sustituyen la revisión de licencia, tipo o competencia.» (`Badges.jsx:8-11`) | — | − | P3 | — (v2: default v1.8, medallas de lo declarado; antes OD-3) | Portar (N-15) |
| 10 | Logros de aprendizaje | «Logros de aprendizaje» + «Privados en este navegador · separados de las cualificaciones.»; «Primer reto» (1 día), «Una semana aprendiendo» (7 días seguidos), «Constancia de 30 días» (30 días seguidos); «Racha actual: {n} días · Mejor racha: {n} · Retos completados: {n}» (`Badges.jsx:9-10`) | — | − | P3 | — (v2: desbloqueado, alcance LATER; TOOL-08, área 40) | Ver área 40 (TOOL-08) |
| 11 | Sustituto en Next | — | Chips de verificación y caducidad por cualificación y el KPI «Verificadas {v} de {a}» (`QualificationsManager.tsx:328-333`; `page.tsx:133-144`) | + | — | — | Mantener |
| 12 | Foto del avatar | Solo demo: `localStorage['crewflex-avatar-v1-'+id]`, data URL jpeg/png/webp (`ProfileIdentity.jsx:5-12`). El conectado nunca ofrece la foto (C §3.15-16) | No existe | − | P3 | — (v2: default v1.8, solo en el navegador; subirla al servidor o enseñarla a empresas: D-07 P4/D-10) | Portar como en la demo, en `localStorage` (N-23) |
| 13 | Subir la foto | «Añadir foto» / «Cambiar foto» / «Guardando…» y «Quitar foto»; `accept="image/jpeg,image/png,image/webp"`; nota «Foto guardada solo en este navegador · JPG, PNG o WebP · hasta 2 MB». Errores: «Elige una foto JPG, PNG o WebP de hasta 2 MB.», «No se ha podido guardar la foto. Comprueba el archivo y el espacio del navegador.», «No se ha podido quitar la foto.». Recorte cuadrado de 320×320 en JPEG 0,85, hasta 8000 px (`ProfileIdentity.jsx:16-17`) | No existe | − | P3 | — (v2: default v1.8, solo en el navegador; antes D-07/D-10) | Portar (N-23) |
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
12. **N-13 · Exportar mis datos y archivos.** Filas: TEC-07 21; TEC-05 35. SCOPE-2 (no está en OUT).
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
19. **N-19 · Papelera del wallet.** Filas: TEC-05 30. Default v1.8.
    - Ficheros: migración (`archived_at`), `DocumentWallet.tsx`, `documents-maintenance` (purga al vaciar).
    - Aceptación: «Archivar», «Papelera», «Restaurar» y el vacío «Los documentos archivados pueden restaurarse.».
    - Tamaño: M. BD/Edge: sí.
20. **N-20 · Pestañas o filtro por tipo en el wallet** (antes B-06). Filas: TEC-05 6. SCOPE-2 desbloquea AB-34.
    - Aceptación: chips con `aria-pressed` («Todos», «Licencias», «Cursos», «Otros»); el contador refleja el filtro.
    - Tamaño: S. BD/Edge: no.
21. **N-21 · Visor de PDF e imagen en la app** (antes B-07). Filas: TEC-05 28. SCOPE-2 desbloquea AB-28.
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
