# Formato común de las secciones de diff (v1.8 HTML ↔ Next.js)

Idioma: español. Sin emojis. Una sección por pantalla o componente, con este encabezado:

## <ID-DIFF> · <Nombre> — v1.8 `<ids S-/D-/C->` ↔ Next `<ids N->`

Primero una línea de veredicto: **Estado global:** IGUAL | PARCIAL | AUSENTE EN NEXT | SOLO EN NEXT | NO PORTAR; y una frase.
Después la tabla de elementos (exhaustiva: cada bloque, texto clave, campo, opción, botón, estado, regla, columna):

| # | Elemento | v1.8 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|

- **Diff**: `=` igual · `≈` equivalente con otra redacción/forma · `≠` distinto · `−` falta en Next · `+` solo en Next (mejora o añadido) · `✗` no portar (bug, demo-only o inseguro en v1.8).
- **Sev.** (impacto para el usuario si falta o difiere): P0 bloquea el flujo principal · P1 funcional importante · P2 UX/visual · P3 cosmético/texto.
- **Bloqueo**: id de decisión abierta que lo bloquea (D-06, D-07, D-12, OD-3, OD-7, C-10, D-11, R-D4…, tomados de `~/pau/Crew_Flex/memory-bank/07-decisions-index.md` y de los docs de integración), o «—» si se puede portar ya, o «SCOPE» si `docs/product/V1_SCOPE.md` lo deja fuera.
- **Acción**: verbo concreto (portar, ajustar texto, añadir estado, no portar, corregir doc…).
- Cita SIEMPRE el origen: v1.8 con `src/…:línea` o id de captura (`evidencias/shots/demo/…png`, `evidencias/shots/connected/…png`); Next con `archivo:línea` relativo a `~/pau/Crew_Flex`.
- El código actual de Next gana a cualquier doc. Comprueba en el código de Next (lectura) cada afirmación que copies de los inventarios.
- Al final de cada sección: «Capturas:» con las rutas v1.8 y Next relevantes (Next: `docs/audit/evidence/v18-compare/next-after/*` o `docs/audit/evidence/*`; indica que son del lote 11 si las usas).
- Al final del fichero: «Backlog derivado»: lista numerada de tareas portables YA (sin bloqueo), cada una con: título, ficheros de Next a tocar, criterio de aceptación verificable, tamaño (S/M/L), y si necesita migración de BD o Edge Function (eso implica autorización del owner para desplegar, pero puede hacerse en local).
