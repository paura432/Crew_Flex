# 20 · Diff de CrewFlex v1.9.0 frente a v1.8 y a Next (29/10/2026)

Delta de la nueva versión del prototipo: solo lo que v1.9.0 **añade o cambia** respecto a v1.8. Lo que no cambia ya está en
`../18-v18-inventory/`. Mismo formato (`../18-v18-inventory/_FORMAT.md`) y misma métrica (`recount.py`). La métrica canónica
v1.8 (1 051 / 1 266 = 83,0 %) **no cambia**: si v1.9.0 sustituye a v1.8 como referencia, lo decide el owner.

| Dato        | Valor                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fuente      | `tmp/CrewFlex_v1.9.0.zip`, sha256 `e5847409…054cbef`, 165 ficheros, «CrewFlex V1.9.0»; extraído en `tmp/references/crewflex-v190`, sin ejecutar nada |
| Integridad  | `RELEASE_MANIFEST.json`: 163 / 163 sha256 correctos                                                                          |
| Cambio      | 29 ficheros modificados y 34 nuevos frente a `tmp/references/crewflex-v18`; ~118 KB de código nuevo (Formación, ~78 KB)      |
| Notas       | `docs/V1.8.1.md` (legibilidad, Volver, ventanas), `docs/V1.8.2.md` (calendario, exportaciones, caducidades, logbook, Horas y UTC), `docs/V1.9.0.md` (Formación) |
| Next        | `feat/v18-html-parity` @ `2feb357` (lectura de código; sin capturas en navegador en este delta)                               |

```bash
python3 ../18-v18-inventory/recount.py A-*.md B-*.md C-*.md
```

## Resultado

| Fichero                                | Filas | =  | ≈  | ≠  | −   | +  | ✗  | Paridad              | Retenidas por decisión |
| -------------------------------------- | ----: | -: | -: | -: | --: | -: | -: | -------------------- | ---------------------- |
| `A-shell-legibilidad.md`               |    69 | 11 | 15 | 10 |   6 |  0 | 27 | 26 / 42              | 1                      |
| `B-calendario-logbook-herramientas.md` |    80 |  9 | 15 |  8 |  42 |  1 |  5 | 24 / 74              | 15 (D-11 12, SCOPE 3)  |
| `C-formacion.md`                       |   169 |  1 |  0 | 10 | 144 |  0 | 14 | 1 / 155              | 154 (SCOPE, OD-7, D-07) |
| **Total**                              |   318 | 21 | 30 | 28 | 192 |  1 | 46 | **51 / 271 = 18,8 %** | 170                    |
| Sin Formación (A + B)                  |   149 | 20 | 30 | 18 |  48 |  1 | 32 | **50 / 116 = 43,1 %** | 16                     |

Los ✗ (46) son, sobre todo, cosas ajenas a nuestra plataforma (Hostinger, SQLite, lanzador de Windows, HTML
independiente, `runtime-config`), comisiones (OD-7) y elementos solo de la demo. Cada fila da su motivo.

Portables ya, sin decisión: **51 filas** (A 16 · B 35), casi todas P2/P3; Formación, ninguna. 21 filas contadas de A y B
citan la fila del inventario v1.8 del mismo elemento: para fusionar los dos inventarios hay que conciliarlas
(decisión del owner sobre la referencia).

## Método y correcciones del integrador

Tres revisores en paralelo (A shell y legibilidad · B calendario, logbook, caducidades y Horas y UTC · C Formación) leyeron el
código de los dos lados, sin ejecutar el prototipo. Al integrar se corrigió lo que inflaba la paridad o la contaba dos veces.
Cada corrección queda en la propia celda como «(integración 29/10: antes X; motivo)»:

- **C, 55 filas `=`/`≈` → `−`**: comparaban con un patrón análogo de otro módulo (candidaturas, propuestas versionadas, RLS),
  pero Next no tiene Formación. Solo V19C-12 #3 sigue `=`: subir el diploma al wallet ya existe. Las 8 filas sin bloqueo
  pasan a «SCOPE (v1.9 Formación, owner)».
- **A, 8 filas → `≠`**: V19A-02 #5 (sin bloqueo del scroll de fondo), V19A-03 #1/#6 (Next no tiene un «Volver» con historial
  ni su landmark) y V19A-10 #4/#6/#8/#14/#15 («sin verificar»: no cuentan como paridad hasta medirlas).
- **B, 10 filas**: 5 `≈` → `≠` (describían una carencia), 4 → `−` (Next no tiene la función), y V19B-03 #8 → `✗` (no copiar el
  id del usuario en un `.ics` que se reenvía).
- **Duplicados**: B 02 #1–#4 = A 05 #1–#4 (aviso de cambios sin guardar) y B 06 #12 = A 06 #2 (copia manual): cuentan una vez,
  en A. V19A-05 #1 sube a P1, como lo valoró B (el calendario pierde el borrador sin avisar).

## Decisiones del owner

1. **Referencia de paridad**: ¿v1.9.0 sustituye a v1.8? Si es que sí, las 21 filas que citan una fila v1.8 se concilian y este delta
   se suma al inventario. Si es que no, queda como información.
2. **Formación** (C, 169 filas): no está en `docs/product/V1_SCOPE.md`. Es producto nuevo, no paridad. Implica un tercer
   actor (proveedor), mensajería (hoy OUT), precios de terceros (OD-7), declaraciones Part-147 con responsabilidad legal
   (como OD-3), privacidad del alumno, catálogo público sin sesión y solapes con el empleo. Coste estimado de porte: L.
   Detalle en `C-formacion.md` § «Riesgos y decisiones para el owner».
3. **Horas y UTC** (12 filas de B): D-11 limita las herramientas a unidades, par y duraciones. Añadir husos horarios necesita
   que amplíes D-11.
4. **Exportación del calendario** (`.ics` / `.csv`): no figura en `V1_SCOPE.md`. B la considera portable, pero conviene tu confirmación.

## Backlog portable (sin decisión, fusionando duplicados)

| #   | Tarea                                                                                      | Origen            | Tamaño |
| --- | ------------------------------------------------------------------------------------------ | ----------------- | ------ |
| 1   | Aviso de cambios sin guardar (`beforeunload` + confirmación al navegar), primero el calendario | A-3 + B-4      | M      |
| 2   | Copia manual cuando el portapapeles falla                                                  | A-2 + B-10        | S      |
| 3   | Cabecera fija y cuerpo con scroll en los cinco `<dialog>`                                  | A-1               | M      |
| 4   | Calendario: «Hoy», marca de hoy, leyenda, celdas por anchura, resumen del mes              | B-1, B-2, B-3     | M      |
| 5   | Fechas para revisar: antelación 7/30/90, «vence hoy», días restantes                       | B-6               | S      |
| 6   | Logbook: búsqueda sin acentos, filtros por aeronave y fechas, exportar CSV seguro          | B-7, B-8          | M      |
| 7   | Campos a 16 px en móvil; vaciado síncrono del autoguardado; `X-Robots-Tag: noindex`        | A-5, A-4, A-6     | S      |
| 8   | Exportación `.ics`/`.csv` del calendario (tras confirmar el alcance, decisión 4)           | B-5               | M      |

Criterios de aceptación y ficheros: en el «Backlog derivado» de cada fichero.
