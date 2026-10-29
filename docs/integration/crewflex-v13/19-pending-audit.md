# 19 · Auditoría de las 216 filas pendientes de paridad v1.8 (29/10/2026)

**Después de la auditoría (29/10):** ORG-04 #22, la única fila B, quedó cerrada (`≈`; smoke `PKG ORG-04 22`, gate completo verde). Paridad **1 051 / 1 266 = 83,0 %**; quedan 215 filas, sin ninguna B. Si vuelves a ejecutar `pending.py`, escribe a otro fichero: el CSV de abajo es la foto de `0755ff7`. Desde ese día producción tiene toda la rama (`574fd4f`, 62 migraciones, 23 funciones) y §0b de Auth, así que §6 ya no describe producción.

Solo lectura: ninguna fila del inventario ha cambiado, la métrica es la de `18-v18-inventory/README.md` y todas las filas
bloqueadas siguen en el denominador. Matriz fila a fila (los 216 ids originales, una vez cada uno):
[`19-pending-216.csv`](19-pending-216.csv).

| Dato                     | Valor                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Código auditado          | `feat/v18-html-parity` @ `0755ff7`, árbol limpio; inventario modificado por última vez en `db0a232`         |
| Fuente v1.8              | `tmp/CrewFlex_v1.8.zip` sha256 `53ee5b61…c35af6`; extracción nueva idéntica a `tmp/references/crewflex-v18` |
| `recount.py` (sin tocar) | = 452 · ≈ 598 · ≠ 100 · − 116 · + 209 · ✗ 113 → **1 050 / 1 266 = 82,9 %**                                  |
| `pending.py`             | 216 filas = 100 ≠ + 116 −, ids únicos, 0 sin clasificar, 0 rutas de código citadas inexistentes             |

```bash
cd docs/integration/crewflex-v13/18-v18-inventory
python3 recount.py 10-*.md 20-*.md 30-*.md 40-*.md 50-*.md
python3 pending.py ../19-pending-216.csv 10-*.md 20-*.md 30-*.md 40-*.md 50-*.md
```

Columnas del CSV: id (`SECCIÓN#n`) e id original, fichero:línea, módulo, funcionalidad, v1.8, Next, diff, prioridad,
bloqueo del inventario, categoría A–G, causa, llave que la cierra, evidencia citada, `verified_local` /
`verified_stg` / `verified_production`, qué falta, acción del inventario, cómo se cierra, si requiere al owner y entorno.

## 1. Desglose exacto

| Cat. | Significado                                       |   Filas | Causas (filas)                                                                 |
| ---- | ------------------------------------------------- | ------: | ------------------------------------------------------------------------------ |
| A    | Defecto técnico corregible sin decisión           |       0 | —                                                                              |
| B    | Especificada y no implementada                    |       1 | ORG-04 #22 (tarifa y horas base en la fila de la lista)                        |
| C    | Implementada sin evidencia (como causa principal) |       0 | Bandera transversal: 36 filas `≠` no citan prueba (ver §4)                     |
| D    | Decisión de producto pendiente                    |      56 | DV-DIS 36 · Q6 7 · NEW-01 4 · DV-INT 4 · OD-8 2 · T-33 2 · OD-5 1              |
| E    | Restricción de seguridad, privacidad o normativa  |      71 | D-11 48 · D-07 P3 + D-10 16 · seguridad 4 · texto legal 2 · cookie de sesión 1 |
| F    | Verificable solo en producción                    |       4 | ADM-03 #1, TEC-03 #16 (OD-3), TEC-05 #1 (wallet), AUTH-06 #7 (CSP aplicada)    |
| G    | Fuera de alcance o no portable, con justificación |      84 | OUT 39 · defecto v1.8 24 · decisión aprobada 16 · demo 5                       |
|      | **Total**                                         | **216** |                                                                                |

Por prioridad: P0 2 · P1 37 · P2 39 · P3 114 · sin prioridad 24. Por módulo: TOOL 71 · HIRE 26 · ADM 18 · VIS 18 · ORG 16 ·
SH 14 · TEC 11 · AUTH 9 · MKT 8 · SHOT 8 · A11Y 6 · ACC 5 · I18N 4 · META 2.

Causas (ids completos en el CSV):

- **D-11 combustible (48, 26 P1)**: TOOL-04 (28), TOOL-09 #4 #6 #8–#24, TOOL-01 #26.
- **OUT (39)**: comisiones, planes y ledger 24 (HIRE-08, ADM-01 #12–14 #20 #22, ADM-02, ORG-01 #12, ORG-03 #10–12,
  ORG-07 #11, SH-03 #23) · chat 9 (HIRE-06) · back office 5 (ADM-01 #5 #7 #17–19) · impresión del Pack 1 (VIS-05 #5).
- **DV-DIS (36)**: forma o texto de Next distintos por diseño, sin decisión del owner (rótulos, h1, «+ Nueva necesidad» en el
  menú, cajón superpuesto, botón teal en herramientas y login, toasts, contador de comparación, `description`…).
- **Defecto v1.8 corregido (24)**: TOOL-02…09 (dobles h1, plurales, filtros, portapapeles), contrastes y 44 px
  (A11Y-02 #2, A11Y-05 #11, A11Y-06 #3 #10, TOOL-01 #36), SH-06 #14, ACC-01 #11, ORG-04 #4.
- **D-07 P3 + D-10 (16, 7 P1) y Q6 (7)**: documentos, contacto e identidad del Candidate Pack; cobertura parcial.
- **Decisión aprobada (16)**: D-13 (7), C-5 (3), Q5 (2), C-3, C-8/D-05, ADR-001, BR-10.
- **Seguridad (4)**: AUTH-02 #13 y AUTH-04 #6 (no enumerar cuentas), ACC-01 #12 (borrado auditado), TOOL-07 #18 (progreso
  por usuario).

## 2. Bloqueos por impacto

| Bloqueo                                  | Filas |  P0 |  P1 | Qué lo cierra                                         |
| ---------------------------------------- | ----: | --: | --: | ----------------------------------------------------- |
| D-11 revisión técnica del combustible    |    48 |   — |  26 | Revisor designado + port literal                      |
| OUT (comisiones, chat, back office, PDF) |    39 |   — |   — | Cambio de alcance o regla ✗ del README                |
| DV-DIS desviaciones de diseño            |    36 |   — |   — | Copia literal de v1.8 o aceptar la desviación         |
| Defecto v1.8 / seguridad / demo / dec.   |    49 |   — |   — | Solo reclasificar (portar = reintroducir el problema) |
| D-07 P3 + D-10                           |    16 |   — |   7 | Plazo de retención + escáner                          |
| Q6 ↔ SCOPE-2 (2 piden además D-07 P3)    |     7 |   — |   1 | Reconciliar Q6 con SCOPE-2 y C-4                      |
| Producción (OD-3, wallet, CSP, cookie)   |     5 |   2 |   1 | Despliegue autorizado                                 |
| NEW-01, DV-INT, OD-8, T-33, legal, OD-5  |    15 |   — |   2 | Una decisión cada uno                                 |
| ORG-04 #22 (B)                           |     1 |   — |   — | Portar (S)                                            |

Las dos P0 (ADM-03 #1, TEC-03 #16) ya funcionan en local; solo la activación de OD-3 en producción las cierra.

## 3. Decisiones del owner

Filas = filas que se cerrarían portando. % = paridad resultante sola, sobre 1 266.

| Decisión                    | v1.8                                                                                                         | Next hoy                                                             | Alternativas y consecuencias                                                                                                                                                              | Por defecto (v1.8 aprobada)                               |   Filas | %      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------: | ------ |
| D-11 combustible            | Hoja de escala kg/L, masa↔volumen, plan de suministro, conciliación, CSV, textos de seguridad                | Nada                                                                 | a) revisión y port literal: tamaño L, solo cliente, sin BD; b) dejarlo fuera: las 48 filas siguen abiertas (o ✗ → 86,2 %)                                                                 | a). Falta designar revisor y alcance (textos o fórmulas)  |      48 | 86,7 % |
| DV-DIS copia literal        | Rótulos, h1, menú, cajón, colores y toasts propios de v1.8                                                   | Sistema de diseño de Next                                            | a) portar (S–M; algunas filas tocan a11y: toasts, contraste 3,41:1); b) aceptarlas: solo suben si se reclasifican ≈                                                                       | a) donde no empeore a11y (regla DEFAULTS)                 |      36 | 85,8 % |
| Comisiones y planes (OD-7)  | 2,3 / 4 / 10 %, ledger, borradores de factura, planes de 50/200/400 €/mes                                    | Nada (V1_SCOPE OUT)                                                  | a) seguir OUT: por la regla del README serían ✗; b) portar sin dinero real (como T-62): modelo comercial a ciegas                                                                         | a) seguir OUT (SCOPE-2 aprobado)                          |      24 | 84,8 % |
| Pack con documentos         | El técnico elige documentos; identidad y contacto tras aceptar con consentimiento; ClamAV antes de descargar | Pack sin documentos ni contacto; `scan_status` siempre `not_scanned` | Falta el plazo legal del registro de accesos (P3) y el escáner (D-10). v1.8 llamaba a `clamscan` desde su servidor Node; Next no tiene servidor propio: hace falta un servicio de escaneo | P1/P2/P4 ya ratificados; activar al fijar plazo y escáner | 16 (+2) | 84,2 % |
| Chat                        | Conversación por candidatura, no leídos                                                                      | Nada (OUT)                                                           | a) seguir OUT; b) portar: mensajería con moderación y privacidad nuevas                                                                                                                   | a)                                                        |       9 | 83,6 % |
| Q6 cobertura parcial        | Mínimo de días, bloques consecutivos, el técnico elige fechas, turnos recomendados                           | Una candidatura = todo el periodo                                    | a) mantener Q6 y C-4: 7 filas nunca se cierran (o ✗ → 83,4 %); b) portar: tamaño L, cambia elegibilidad (BR-4.4), capacidad, SQL↔TS y máquina de estados                                  | a) Q6 (ratificada y más específica)                       |  5 (+2) | 83,3 % |
| Back office (OUT)           | Pestañas, explorador de empresas, exportación CSV                                                            | Portada admin con lo que existe                                      | a) seguir OUT; b) portar sin dinero                                                                                                                                                       | a)                                                        |       5 | 83,3 % |
| NEW-01 sin conexión         | `/sw.js` cachea la app; chip «Sin conexión»                                                                  | Nada                                                                 | a) service worker solo para herramientas (AB-37): M, riesgo de cachear sesiones; b) fuera                                                                                                 | a) acotado a `/tools`                                     |       4 | 83,3 % |
| OD-8 alta y confirmación    | Enlace válido 24 h; «Tengo una invitación»                                                                   | 1 h (T-41); alta abierta + invitaciones                              | a) 24 h: más ventana si el correo se compromete; b) 1 h                                                                                                                                   | a) 24 h (DEFAULTS), con el flag de invitación             |       2 | 83,1 % |
| T-33 tarifa visible         | La empresa ve la tarifa mínima y filtra por «Máximo EUR/h»                                                   | Solo la ve su dueño                                                  | a) compartir: dato económico visible a toda organización con acceso, exige consentimiento; b) privada                                                                                     | Necesita tu consentimiento (privacidad)                   |       2 | 83,1 % |
| Texto legal del alta        | Casilla obligatoria (texto de beta local)                                                                    | Sin casilla                                                          | Texto real y versión aceptada guardada                                                                                                                                                    | Casilla cuando des el texto                               |       2 | 83,1 % |
| OD-5 puerta de confirmación | No se confirma con una organización sin revisar                                                              | Revisión existe, puerta apagada (T-52)                               | Activarla sin organizaciones revisadas bloquea toda confirmación                                                                                                                          | Activar junto con OD-3                                    |       1 | 83,0 % |
| Métrica: no portables       | —                                                                                                            | —                                                                    | 53 filas (24 defectos, 16 decisiones, 5 demo, 4 seguridad, 4 internas) solo se cierran reclasificando: ✗ según el README o ≈                                                              | Decisión tuya; no aplicada                                |      53 | 86,6 % |

## 4. Trabajo que puede seguir sin decisiones nuevas

1. **ORG-04 #22** (B, S): tarifa y horas base en la fila de «Necesidades» (el tipo `WorkRequirement` ya trae
   `conditions` y `shifts`; modo y % siguen OUT). Única fila cerrable: 1 051 / 1 266 = **83,0 %**. No está hecha: espera tu sí.
2. Erratas del inventario, sin cambio de métrica: I18N-01 #3 dice «C-5 sigue abierta», pero C-5 está aceptada; el informe
   F3 da «155 retenidas por decisión», pero 30 de ellas ya son `=`/`≈` (de las 216 pendientes, 125).
3. AUTH-04 #6 pide «documentarlo»: `docs/product/SECURITY_PRIVACY.md` no menciona el límite de recuperación.
4. Evidencia: 36 filas `≠` no citan prueba ni medición en el propio inventario (lista en el CSV, `verified_local` = «no citada»),
   p. ej. ACC-01 #12, ADM-03 #8, ORG-01 #3/#4, VIS-06 #13. Añadir el paso de smoke o el test no cambia la métrica.

## 5. Porcentaje local alcanzable

- Sin decisiones nuevas: **83,0 %** (1 051 / 1 266).
- Con todas las decisiones de §3 tomadas a favor del port y sin reclasificar: **95,8 %** (1 213 / 1 266); en local
  95,4 %, porque 5 filas solo se cierran en producción.
- **100 %**: exige además la decisión de métrica sobre 53 filas (defectos de v1.8, fugas de seguridad, demo, decisiones
  aprobadas y mecanismos internos), que no se pueden portar con sentido. Dos rutas, las dos con esa decisión:
  portar los 163 portables (OUT incluido) → 1 217 / 1 217; o confirmar OUT como ✗ y portar 124 → 1 178 / 1 178.

## 6. Brechas que requieren despliegue

- Filas: ADM-03 #1 y TEC-03 #16 (OD-3: lista de verificadores, procedimiento, `qualification-reviews` y flags),
  TEC-05 #1 (wallet, release 2), AUTH-06 #7 (CSP aplicada tras una ventana limpia, CX-09) y AUTH-06 #9 (cookie de sesión,
  con la CSP y T22).
- Todo el 82,9 % es `VERIFIED_LOCAL`. No hay STG (OD-9), y producción sigue en release 1 con el frontend `51c835a`:
  ninguna fila del inventario se ha verificado allí (solo sondas sin sesión). Para desplegarla faltan 47 migraciones (42 de la rama + 5 de
  `main` nunca aplicadas) y 15 funciones (`docs/qa/ROLLOUT_PLAN_V18_LOOP.md`).

## 7. Riesgos

- **Seguridad**: cookies de sesión legibles desde JS con la CSP solo en report-only (AUTH-06 #9: Next peor que v1.8).
  Portar AUTH-02 #13 o AUTH-04 #6 reabriría la enumeración de cuentas. T-33 expone tarifas. El Pack sin escáner no debe
  abrir documentos a terceros (D-10). Un service worker no debe cachear páginas con sesión (AB-37).
- **Seguridad operacional**: el combustible da cantidades para repostar aeronaves. Por eso existe la revisión de D-11.
- **Compatibilidad**: cobertura parcial toca el motor de elegibilidad y la paridad SQL↔TS. En producción, el frontend
  `51c835a` sobre el backend de release 1 da 400/405 latentes, y `db push` no puede saltar las migraciones de wallet.
  Además siguen abiertos el hotfix X-01 + GHSA y la configuración de Auth (`site_url` localhost), según `memory-bank/01-current-state.md`.

## Contradicciones detectadas

1. **D-11** está aceptada (`07-decisions-index`), así que no es una decisión abierta: lo pendiente es una acción, la revisión.
   Su objeto difiere según el documento: «domain review of the wording» (`08-product-decisions.md:21`), «specific technical
   review» (`:43`) y «technical review of its wording» (`V1_SCOPE.md:78`). No hay revisor ni procedimiento designados.
2. **Q6 ↔ SCOPE-2 ↔ C-4**: Q6 (ratificada el 22/10 por la mañana) prohíbe la cobertura parcial. SCOPE-2 (22/10 por la tarde) la declara
   implementable en local. C-4 (aceptada) excluye la disponibilidad parcial. El código sigue Q6 (T-60, T-92, T-164).
3. **T-33 contra DEFAULTS**: DEFAULTS manda implementar el comportamiento de v1.8 en las decisiones abiertas (OD-7), pero T-33
   hace lo contrario: esconde la tarifa que v1.8 enseña, y T-154 sustituye el filtro. Lo mismo pasa con T-41 (1 h frente a 24 h, OD-8) y con
   T-09 (prohíbe volver a presentar tras una cancelación, cosa que v1.8 conectado permite y Q5 no regula).
4. **Regla ✗ del README**: define `✗` como bug, demo, inseguro o SCOPE OUT fuera del denominador, pero 72 filas con
   esas causas siguen como `≠`/`−` (P15 eligió «Next lo hace mejor → ≠»). Las 4 filas DV-INT comparan mecanismos internos
   sin comportamiento que portar. Corregirlo es decisión de métrica del owner y no se ha aplicado.
5. **Migraciones**: el memory-bank decía «42 sin aplicar en remoto», pero 42 es la cifra frente a `main`. Frente a producción
   (15 aplicadas) son 47 de las 62.
