# Área A · Shell, navegación y legibilidad — qué añade o cambia v1.9.0 (v1.8.1 + parte general de v1.8.2) respecto a v1.8, y qué tiene ya Next

Fecha: 2026-10-29. Fuente v1.9.0: `tmp/references/crewflex-v190/CrewFlex` (rutas `src/…` relativas a esa raíz; notas `docs/V1.8.1.md`, `docs/V1.8.2.md`). Referencia anterior: `tmp/references/crewflex-v18/CrewFlex-v1.8` (`diff -r` entre los dos árboles; 27 ficheros de código cambiados). Next: rutas relativas a `~/pau/Crew_Flex`, código leído en la rama `feat/v18-html-parity` (`2feb357`). Solo lectura: no se ha ejecutado nada del prototipo ni medido en navegador; donde una celda dice «sin medir» o «sin verificar» es literal.

Fuera de este fichero (otros revisores): calendario, exportaciones CSV/ICS, recordatorios de vencimiento, logbook y herramienta Horas/UTC (área B); todo lo de «Formación» (área C). Aquí solo se citan cuando un cambio general los toca.

Método de diff v1.8 → v1.9.0 en el ámbito A: ficheros nuevos `src/features/BackNavigation.jsx`, `src/features/useUnsavedChanges.jsx`, `src/styles/v181.css`, `src/styles/v182.css`, `src/deployment.js`, `server/deployment.mjs`, `deploy/hostinger/*`, `public/runtime-config.js`, `dist/runtime-config.js`, `tests/hosting.test.mjs`; cambios en `src/components/v11/Shared.jsx` (Modal), `src/LegacyApp.jsx`, `src/main.jsx`, `src/context/AppState.jsx`, `src/BetaPreview.jsx`, `src/beta/ConnectedShell.jsx`, `src/beta/Account.jsx` (literales), `src/components/v11/Professional2.jsx` (`useDraft`), `src/components/v11/Company2.jsx` (`forgetPendingDraft`), `src/tools/Toolbox.jsx` (`CopyResult`), `scripts/standalone.mjs`, `index.html`, `Iniciar_CrewFlex.cmd`, `server/app.mjs` (política de despliegue, cookie, cabeceras, `/runtime-config.js`, `/healthz`). Todo lo demás del diff es de las áreas B y C.

Símbolos: `=` igual · `≈` equivalente · `≠` distinto · `−` falta en Next · `+` solo en Next · `✗` no portar (demo-only, bug de v1.9, inseguro o ajeno a nuestra pila: Vercel + Supabase, ADR-001). Sev. P0–P3. Bloqueo: «—», «SCOPE» (`docs/product/V1_SCOPE.md`) o id de `memory-bank/07-decisions-index.md`.

---

## V19A-01 · Legibilidad de resúmenes económicos, notas, etiquetas y resultados (v1.8.1) — v1.9.0 `src/styles/v181.css:2,7`, `src/components/v11/Pricing.jsx:12`, `src/components/v11/Company2.jsx:126`, `src/tools/Toolbox.jsx:14-16` ↔ Next `src/app/globals.css:7-8`, `src/features/tools/components/parts.tsx:178-215`, `src/features/requirements/components/RequirementTerms.tsx:118-178`

**Estado global:** NO PORTAR en su mayor parte; el bloque que arregla v1.8.1 es el desglose de comisión (`fee-summary`), que en Next no existe por alcance (comisiones OUT), y los textos auxiliares de Next ya usan tokens con contraste calculado (`--color-muted #5b6f84`, 5,18:1 sobre blanco; v1.8: A11Y-06). Queda una comprobación pendiente (lista ✓/✗ de requisitos).

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Desglose económico sobre fondo claro | `.fee-summary` con colores explícitos: fondo `#f0f5fa`, texto `#19384e`, líneas «Personal base», «Comisión {n} %», «Dietas» y «Total estimado» con `tabular-nums`; el total con fondo `#dcece7` y texto `#164936` propios (`v181.css:2`; markup `Pricing.jsx:12`). Las notas dicen 11,15:1 en importes y 8,43:1 en el total (`docs/V1.8.1.md`, no medido aquí) | No hay desglose de comisión: comisiones OUT (`V1_SCOPE.md:91-95`). Los importes que sí existen (tarifa, horas base, dietas informativas) van en `<dd class="font-medium tabular-nums">` sobre blanco con `text-ink` (`RequirementTerms.tsx:118-119,137-147`; `globals.css:7`) | ✗ | — | SCOPE / OD-7 | No portar; la legibilidad de los importes de Next ya depende de los tokens (VIS-01 #6-#7) |
| 2 | Variante oscura del desglose | `.dark-panel .fee-summary` (`#16374e` / `#edf5fa`, total `#d4ede4` / `#123e30`) en el lateral oscuro del constructor de ofertas (`Company2.jsx:126`) | El constructor de necesidades de Next no tiene panel oscuro ni desglose (`RequirementForm.tsx`, `RequirementTerms.tsx`) | ✗ | — | SCOPE / OD-7 | No portar |
| 3 | Texto secundario en paneles oscuros | `.dark-panel>p,.dark-panel .secondary{color:#cfdfeb}`, `.dark-panel .panel-head h2{color:#e2edf5}` (`v181.css:2`; reforzado en `v182.css:74`) | Superficies oscuras de Next: hero de «Mi espacio» con cuerpo `#a9bfd2` (8,6:1) y h2 blanco 16,3:1 (`docs/product/DESIGN_SYSTEM.md:42`; medido en v1.8 A11Y-06 #15). Sin panel oscuro en el constructor | ≈ | — | — | Mantener |
| 4 | Resultados de herramientas (`.tb-result`) | Texto blanco en `.tb-result` y sus `h2/h3/strong`; `p`, `.tb-hint`, `.tb-footnote` `#d6e8ec!important`; `span`/`b` `#c1ece3`; **botones dentro del resultado oscuro con fondo oscuro y texto claro** (`.tb-result .tb-button{background:#214e5e;color:#fff;border-color:#88acb6}`) (`v181.css:2`; markup `Toolbox.jsx:16`) | El botón «Copiar» de Next ya tiene variante oscura por defecto (`border-[#547e89] text-[#c7e9e6] hover:bg-white/5`) y `light` para paneles blancos (`parts.tsx:178-201`). Contraste de la tarjeta de resultado: medido en v1.8 (A11Y-06 #17: 3,96 → `+` tras X-10, 4,82) | ≈ | — | — | Mantener; no se ha vuelto a medir en esta pasada |
| 5 | Avisos y notas de herramientas | `.toolbox .tb-notice{color:#65430e}`; `.tb-panel .tb-hint,.tb-footnote{color:#4b6577!important}` (`v181.css:2`) | Notas y pies con `text-muted` (`#5b6f84`, `globals.css:8`; `parts.tsx:220` `References`), 5,18:1 sobre blanco y 4,83:1 sobre canvas (v1.8 VIS-01 #7) | ≈ | — | — | Mantener |
| 6 | Lista de requisitos dentro de la ventana | `.dialog-body .requirements .ok{color:#25684f}`, `.missing{color:#9c333c}` (`v181.css:7`) | La lista ✓/✗ de elegibilidad de Next vive en la página de la oportunidad, no en un diálogo (v1.8 inventario, fila «Detalle» 7 nueva v2: `opportunities/[id]/page.tsx`). Colores: tokens `--color-success`/`--color-danger` (`globals.css`); **no verificado** el par exacto en esta pasada | ≈ | P3 | — | Comprobar contraste del ✓/✗ en la próxima medida (A11Y-06) |
| 7 | Notas de la ventana (`.dialog-body .secondary/.notice/.detail-grid small/.document-row p/.modal-intro p`) | `#435d72` y `#4b6479` (`v181.css:4,7`; markup `Marketplace.jsx:43,66`, `Workflow.jsx:15`) | Los cinco `<dialog>` de Next usan `text-muted` para lo secundario (`RequirementPreview.tsx:81`, `DocumentViewer.tsx`), mismo token que el resto | ≈ | — | — | Mantener |

Capturas: ninguna nueva (solo lectura). v1.8 relacionadas: `evidencias/shots/demo/D-TOOL-00-herramientas-1440.png`; Next: `docs/audit/evidence/v18-compare/next-after/tools-1440.jpg` (lote 11).

---

## V19A-02 · Modal: cabecera fija, cuerpo con scroll, X de 44 px, Escape en la ventana superior (v1.8.1) — v1.9.0 `src/components/v11/Shared.jsx:106-153`, `src/styles/v181.css:4-6` ↔ Next `src/features/professional/components/ProfileStatusDialog.tsx:45-82`, `src/features/requirements/components/RequirementPreview.tsx:73-109`, `src/features/directory/components/ProfileDialog.tsx:35-57`, `src/features/professional/components/PassportDraft.tsx:47-71`, `src/features/documents/components/DocumentViewer.tsx:95-134`

**Estado global:** PARCIAL. Next ya cubre con `<dialog>` nativo lo que v1.8.1 reimplementa a mano (Escape en la ventana superior, inerte del fondo, bucle de foco, devolución del foco: v1.8 VIS-09 #8, A11Y-02 #4). Lo que v1.8.1 añade de verdad —cabecera con título y X que no se desplaza mientras solo el cuerpo hace scroll— **no está** en ninguno de los cinco diálogos de Next.

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Estructura de la ventana | `Modal` envuelve `children` en `<div class="dialog-body">` (`Shared.jsx:152`). CSS: `.dialog{display:flex;flex-direction:column;max-height:calc(100dvh - 48px);overflow:hidden}`, `.dialog-head{flex:0 0 auto;…;z-index:2}`, `.dialog-body{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}` (`v181.css:4`). Móvil ≤760: `max-height:calc(100dvh - 20px)`, `scrollbar-gutter:auto` (`:5`) | `DocumentViewer`: `overflow-auto max-h-[90vh]` en el propio `<dialog>` y la cabecera dentro, así que **la cabecera se desplaza con el contenido** (`DocumentViewer.tsx:105-107`). `ProfileDialog`: `max-h-[calc(100dvh_-_2rem)]` en el `<dialog>` sin separar cabecera/cuerpo (`ProfileDialog.tsx:39-42`). `ProfileStatusDialog`, `RequirementPreview`, `PassportDraft`: sin `max-h`/`overflow` propios; queda el estilo UA del `<dialog>` (`max-height:calc(100% - 6px - 2em); overflow:auto`), de nuevo con la cabecera dentro del área que se desplaza (`ProfileStatusDialog.tsx:50-53`, `RequirementPreview.tsx:76-79`, `PassportDraft.tsx:51-54`) | ≠ | P2 | — | Portar: cabecera `shrink-0` + cuerpo `min-h-0 overflow-y-auto` en los cinco (ver backlog 1) |
| 2 | Botón de cierre | X «Cerrar ventana» `.dialog-head>.icon-button{width:44px;height:44px;min-width:44px}` también en móvil; fondo `#f3f7fa`, hover `#dfeaf1` (`v181.css:4`) | `ProfileDialog`: botón «×» `size-10` (40 px) + `pointer-coarse:min-h-11 pointer-coarse:min-w-11` (`ProfileDialog.tsx:46-51`). Los otros cuatro cierran con un `Button size="sm"` de texto «Cerrar»/«Cerrar vista previa»/«Cancelar» (`ProfileStatusDialog.tsx:57`, `RequirementPreview.tsx:88`, `PassportDraft.tsx:59`, `DocumentViewer.tsx:111`; alto 44 con puntero grueso por `Button.tsx:11`) | ≈ | P3 | — | Mantener (44 px con puntero grueso ya cubierto, X-09); unificar en el backlog 1 si se crea un marco común |
| 3 | Escape solo en la ventana superior | Pila `modalLayers`: cada `Modal` guarda un `Symbol` y el `keydown` solo actúa si es el último (`Shared.jsx:106,112-116,127`); `close.current` evita cierres con `onClose` obsoleto | `<dialog>.showModal()`: el navegador manda Escape solo al diálogo modal superior y hace inerte el resto (`ProfileStatusDialog.tsx:41`, `RequirementPreview.tsx:70`, `ProfileDialog.tsx:31`, `PassportDraft.tsx:44`, `DocumentViewer.tsx:97`). Escape medido en el smoke (`scripts/local/ui-smoke.mjs:2112-2116`) | = | — | — | — |
| 4 | Devolución del foco | `last.current=document.activeElement` al abrir y `last.current?.focus()` al desmontar (`Shared.jsx:118,145`) | `onClose={() => opener.current?.focus()}` (`ProfileStatusDialog.tsx:49`, `ProfileDialog.tsx:38`, `PassportDraft.tsx:50`); `DocumentViewer` delega en el llamador (`:86-87,104`); `RequirementPreview` no declara `onClose` y confía en la devolución nativa del `<dialog>` (`:73-77`) | = | — | — | — |
| 5 | Bloqueo del fondo | `document.body.style.overflow='hidden'` + `#root.inert=true` mientras está abierta (`Shared.jsx:121-124`); `.dialog-backdrop{overscroll-behavior:contain}` (`v181.css:4`) | `showModal()` hace inerte todo lo demás; **no hay** regla que bloquee el scroll del `body` tras el diálogo (sin `body:has(dialog[open])` en `globals.css`, 113 líneas; no medido) | ≠ (integración 29/10: antes ≈; Next no lo tiene igual) | P3 | — | Opcional: `overscroll-behavior:contain` en el cuerpo del diálogo; medir si el fondo se desplaza en móvil |
| 6 | Bucle de Tab | Excluye `select:not(:disabled)` y `textarea:not(:disabled)` (antes solo `button`/`input`) (`Shared.jsx:130`) | Inerte nativo: Tab no sale del `<dialog>` modal | = | — | — | — |
| 7 | Título largo | `.dialog-head h2{line-height:1.4;overflow-wrap:anywhere}` (`v181.css:4`); 17 px en móvil (`:5`) | `DocumentViewer`: `[overflow-wrap:anywhere]` (`:108`); `RequirementPreview`: `break-words` (`:84`); `ProfileDialog`, `ProfileStatusDialog`, `PassportDraft`: `text-lg font-semibold` sin regla de corte (`ProfileDialog.tsx:43`, `ProfileStatusDialog.tsx:54`, `PassportDraft.tsx:54`) | ≈ | P3 | — | Añadir `break-words` a los tres títulos (backlog 1) |
| 8 | Márgenes y anchura | Backdrop `padding:24px` (10 px ≤760); diálogo `padding:0`, cabecera `18px 24px` (12/14 móvil), cuerpo `22px 24px 26px` (16/14/22 móvil) (`v181.css:4-5`) | `m-auto w-[calc(100%-2rem)]` + `p-5 sm:p-6` (`ProfileStatusDialog.tsx:50-52`, `RequirementPreview.tsx:76-78`, `PassportDraft.tsx:51-53`); `ProfileDialog` `w-[min(100%_-_2rem,40rem)]` (`:39`); `DocumentViewer` `w-[min(100%-2rem,56rem)]` y `p-4` (`:105-107,115`) | ≈ | — | — | Mantener |
| 9 | Acciones dentro del cuerpo | `.dialog-body .card-actions{gap:10px;flex-wrap:wrap}`, `.dialog-body .action{min-width:0;word-break:normal}` (`v181.css:4`) | Cabeceras con `flex-wrap` (`RequirementPreview.tsx:79`); acciones del cuerpo con `flex flex-wrap gap-2` en `PassportDraft.tsx:58-59` | ≈ | — | — | Mantener |
| 10 | Contenido embebido | `.dialog-body a{color:#17568b}`, `.dialog-body iframe{max-width:100%}` (`v181.css:4`) | Visor: imagen `mx-auto max-h-[65vh] max-w-full object-contain` (`DocumentViewer.tsx:176`); enlaces con el estilo global | ≈ | — | — | Mantener |

Capturas: ninguna nueva. v1.8: `evidencias/shots/demo/D-TEC-04c-detalle-oferta-1440.png` (modal v1.8 sin cabecera fija). Next: `evidencias/v2/10/…` no cubre los diálogos; smoke `scripts/local/ui-smoke.mjs:266-295,2085-2143`.

---

## V19A-03 · Botón «Volver» en pantallas secundarias (v1.8.1) — v1.9.0 `src/features/BackNavigation.jsx:1-8`, `src/LegacyApp.jsx:91`, `src/beta/ConnectedShell.jsx:14`, `src/styles/v181.css:4-6` (`.screen-back`) ↔ Next enlaces «Volver…» por pantalla (`src/app/app/professional/opportunities/[id]/page.tsx:77`, `src/app/app/organization/requirements/[id]/matches/page.tsx:77`, `src/app/app/organization/requirements/[id]/applications/page.tsx:71`, `src/app/app/organization/applications/page.tsx:116`, `src/app/app/organization/network/[id]/page.tsx:52`, `src/features/applications/components/ApplicationActions.tsx:175`, `src/app/not-found.tsx:13`, `src/app/(auth)/forgot-password/page.tsx:31`)

**Estado global:** PARCIAL. v1.8.1 necesita un historial propio porque la demo navega por `#hash` dentro de una SPA sin rutas; Next tiene rutas reales (el Atrás del navegador funciona) y enlaces «Volver a …» explícitos en las pantallas secundarias inventariadas. No se porta el componente; sí conviene revisar qué pantallas secundarias quedan sin enlace de retorno.

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Componente | `BackNavigation`: pila local (`trail`, máx. 40) con clave `tab:jobId`; al navegar se apila la ruta anterior salvo que se esté «volviendo» (entonces se desapila); oculto en `home`; `<nav aria-label="Navegación de retorno">` con botón «Volver» (o «Volver al inicio» si no hay recorrido) (`BackNavigation.jsx:3-7`) | Sin componente genérico. Enlaces estáticos al padre lógico: «Volver a oportunidades» (es:2054), «Volver a la necesidad» (es:1249, 2096), «Volver a ofertas» (es:2420), «Volver» (es:2131, red), «Volver a CrewFlex» (es:25, 404), «Volver a iniciar sesión» (es:202); `common.back` «Volver» (es:17) sin uso (v1.8 I18N fila 8) | ≠ (integración 29/10: antes ≈; Next no lo tiene igual) | P3 | — | No portar la pila; inventariar pantallas secundarias sin «Volver» (p. ej. `/app/settings`, `/app/tools/*`) y añadir el enlace al padre donde falte |
| 2 | Recupera la referencia de oferta | `navigate(target.tab,target.jobId\|\|null)` devuelve `jobId` al volver (`BackNavigation.jsx:7`) | Las rutas llevan el id en la URL (`/app/organization/requirements/[id]/…`); el enlace de retorno apunta a la necesidad concreta (`matches/page.tsx:77`, `applications/page.tsx:71`) | = | — | — | — |
| 3 | Reinicio al cambiar de rol o identidad | `key={userRole}` en la demo (`LegacyApp.jsx:91`) y `key={user?.id\|\|'guest'}` en el conectado (`ConnectedShell.jsx:14`) vacían la pila | No aplica: no hay cambio de rol en sesión; «Ver como» del admin (D-13) es una navegación real | ✗ | — | — | No portar (sin equivalente) |
| 4 | Volver no equivale a guardar | «Los formularios conservan sus reglas de guardado; volver no equivale a guardar» (`docs/V1.8.1.md`); el autoguardado de la demo se vacía al navegar (V19A-07) | Igual: los enlaces navegan; `RequirementForm` conserva el borrador en `localStorage` y ofrece «Restaurar» (`RequirementForm.tsx:150-170,392-400`) | = | — | — | — |
| 5 | Aspecto del botón | `.screen-back .action{background:#fff;border-color:#bdcfdc;color:#23475e;min-height:44px;padding:9px 14px;font-size:12px}`, margen inferior 20/18 px; oculto al imprimir (`v181.css:4-6`) | `ButtonLink` con las clases de `Button` (`pointer-coarse:min-h-11`, `Button.tsx:11`), colocado en `actions` de `PageHeader` | ≈ | — | — | Mantener |
| 6 | Landmark | `<nav aria-label="Navegación de retorno">` | Enlace suelto dentro de la cabecera de página; sin landmark propio | ≠ (integración 29/10: antes ≈; Next no lo tiene igual) | P3 | — | Mantener (un `nav` por enlace es ruido) |
| 7 | Inicio del admin | En el conectado el «inicio» de la pila es `admin` para `role==='admin'` (`ConnectedShell.jsx:14`) | `/app/admin` es la página de entrada del admin de plataforma (`src/app/app/admin/page.tsx`); sin pila | ✗ | — | — | No portar |

Capturas: ninguna nueva.

---

## V19A-04 · Impresión de expedientes (v1.8.1) — v1.9.0 `src/styles/v181.css:6`, `src/components/v11/Workflow.jsx:28-32` ↔ Next —

**Estado global:** NO PORTAR. v1.8.1 solo corrige una regresión propia (el nuevo límite de altura del modal cortaba la impresión del Candidate Pack). En Next no hay impresión del pack (Candidate Pack PDF OUT; pack en LATER: v1.8 VIS-05 #5).

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | `@media print` del diálogo | `.dialog{display:block;max-height:none;overflow:visible}`, `.dialog-body{overflow:visible;max-height:none;padding:0}`, `.screen-back{display:none!important}` (`v181.css:6`); el botón «Imprimir / guardar PDF» del modal «Candidate Pack» no cambia (`Workflow.jsx:32`, `window.print()`) | Sin estilos de impresión en `globals.css` (grep `print`: 0); sin pack imprimible | ✗ | — | SCOPE | No portar (corrige una regresión de v1.8.1 sobre una función OUT) |

Capturas: ninguna.

---

## V19A-05 · Guardia de cambios sin guardar (v1.8.2, parte general) — v1.9.0 `src/features/useUnsavedChanges.jsx:1-28`, `src/beta/ConnectedShell.jsx:1,9,14`, `src/beta/Account.jsx:1,50` ↔ Next `src/features/requirements/components/RequirementForm.tsx:129-166`, `src/components/layout/AppShell.tsx:178-183,203-208`

**Estado global:** AUSENTE EN NEXT. El mecanismo es general (evento cancelable + `beforeunload` + modal), aunque su único consumidor y su literal son el calendario conectado (área B). Next no tiene `beforeunload` en ningún sitio (grep: 0) ni intercepción de la navegación interna; el formulario de necesidad lo mitiga con autoguardado y «Restaurar».

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Hook `useUnsavedChanges(dirty)` | Mientras `dirty`: `beforeunload` con `preventDefault` + `returnValue=''` (diálogo nativo del navegador) y escucha de `crewflex:before-navigation`, que cancela la navegación y abre un `Modal` «Tienes cambios sin guardar» con «Seguir editando» (primario) y «Salir sin guardar» (`useUnsavedChanges.jsx:18-28`) | No existe. `RequirementForm` tiene `dirty` (`:129,141-143`) pero solo lo usa para el autoguardado (`:162-166`); el calendario es del área B | − | P1 (integración 29/10: antes P2; B lo valoró P1: el calendario pierde el borrador sin avisar) | — | Portar el hook (beforeunload + confirmación) para editores con estado sucio; consumidor principal: calendario (área B); segundo: `RequirementForm` (ver backlog 3) |
| 2 | `requestNavigation(action)` | `CustomEvent` cancelable; si nadie lo cancela ejecuta `action()` (`useUnsavedChanges.jsx:12-15`). Lo usan el menú lateral y el dock del conectado (`ConnectedShell.jsx:9`), «Volver a la demo» y «Ver demo» (`:14`) y «Cerrar sesión» (`Account.jsx:50`) | Navegación por `<Link>`/`ButtonLink` y cierre de sesión con `<form action={signOutAction}>` (`AppShell.tsx:178,203`); sin punto de intercepción común. App Router no expone eventos de ruta: habría que interceptar clics en enlaces o usar un `onClick` en los enlaces del shell | − | P3 | — | Solo si el área B lo necesita para el calendario; evaluar intercepción de clic en `NavLinks`/`MobileDock` (M) |
| 3 | Literal del modal | «Si sales ahora, perderás los cambios de este calendario. Puedes seguir revisándolo y guardarlo, o salir sin guardar.» (`useUnsavedChanges.jsx:28`): el hook es genérico pero el texto es del calendario | — | − | P3 | — | Si se porta, parametrizar el texto (clave i18n por editor); detalle en área B |
| 4 | Cancelar la salida no consume el recorrido de «Volver» | `returning.current` solo se reinicia cuando cambia la ruta (`BackNavigation.jsx:5`); al cancelar no hay cambio de ruta | Sin pila de retorno (V19A-03 #1) | ✗ | — | — | No aplica |
| 5 | Clic en la pestaña actual | `navigate` ignora `tab===page` (solo cierra el menú) y no dispara la guardia (`ConnectedShell.jsx:9`) | Un `<Link>` a la ruta actual no navega | = | — | — | — |

Capturas: ninguna.

---

## V19A-06 · Copia al portapapeles con alternativa manual (v1.8.2) — v1.9.0 `src/tools/Toolbox.jsx:14` ↔ Next `src/features/tools/components/parts.tsx:178-215`, `messages/es.json:1827-1828`

**Estado global:** PARCIAL. El botón y sus literales ya coinciden; falta la alternativa manual cuando el navegador deniega el portapapeles (en Next el fallo es silencioso).

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Botón | «Copiar con unidades» → «Copiado» 1,8 s; `tb-button subtle` con icono `Copy`/`Check` (`Toolbox.jsx:14`) | «Copiar con unidades» / «Copiado» (es:1827-1828), 1,8 s, iconos copiar/check (`parts.tsx:190-213`) | = | — | — | — |
| 2 | Alternativa manual | Si `navigator.clipboard?.writeText` no existe o falla: `manual=true` y aparece `<label class="tb-field"><span role="status">El navegador no permite copiar automáticamente. Selecciona y copia el texto.</span><textarea aria-label="Resultado para copiar manualmente" readOnly value={text} onFocus=select/></label>` (`Toolbox.jsx:14`; estilos `v182.css:101-102`) | `try { await navigator.clipboard.writeText(text); setCopied(true) } catch { setCopied(false) }`: sin mensaje ni alternativa (`parts.tsx:203-209`); sin guarda de `navigator.clipboard` indefinido (en contextos no seguros lanza igualmente y cae en el `catch`) | − | P2 | — | Portar: estado `manual` + `textarea` de solo lectura + aviso `role="status"`, claves ES/EN (backlog 2) |

Capturas: ninguna. Next: `docs/audit/evidence/v18-compare/next-after/tools-1440.jpg` (lote 11, botón «Copiar con unidades»).

---

## V19A-07 · Borradores: vaciado antes de navegar y descarte al publicar (v1.8.2) — v1.9.0 `src/context/AppState.jsx:85,421,466`, `src/LegacyApp.jsx:97`, `src/components/v11/Professional2.jsx:16-27`, `src/components/v11/Company2.jsx:29,108` ↔ Next `src/features/requirements/components/RequirementForm.tsx:150-170,276-282,392-400`

**Estado global:** PARCIAL. El descarte del borrador al publicar ya está en Next. El vaciado del autoguardado pendiente antes de navegar no: Next cancela el temporizador al desmontar, así que la última edición de menos de 350 ms se pierde (la misma clase de fallo que v1.8.2 corrige en la demo).

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Vaciado del borrador pendiente | `useDraft` guarda `latest`/`save` en refs y expone `flush()`; escucha `crewflex:flush-drafts` y lo dispara `setActiveTab`, `selectDemoTechnician`, `setOrganizationId` (`AppState.jsx:85,421,466`) y `choose()` demo↔conectado (`LegacyApp.jsx:97`) (`Professional2.jsx:16-20`) | Autoguardado a 350 ms con `return () => clearTimeout(timer)` (`RequirementForm.tsx:162-166`): al desmontar el formulario (navegar) un cambio hecho en los últimos 350 ms no llega a `localStorage` | − | P3 | — | Portar: escribir el borrador de forma síncrona en la limpieza del efecto si hay un temporizador pendiente (backlog 4) |
| 2 | Descarte al publicar | `forgetPendingDraft()` antes de `saveDraft(key,null)` para no regenerar el borrador tras publicar (`Professional2.jsx:21`, `Company2.jsx:108-109`) | `forgetAutosave()` antes de la acción (`RequirementForm.tsx:276-278`); como `dirty`/`draft` no cambian, el efecto no vuelve a escribir; «Empezar de cero» también lo borra (`:392-400`) | = | — | — | — |
| 3 | Vaciado al cambiar de personaje/organización de demo | `selectDemoTechnician`, `setOrganizationId` (`AppState.jsx:421,466`) | Sin personajes de demo | ✗ | — | — | No portar (DEMO-ONLY) |
| 4 | Límite declarado | «no promete que el navegador pueda completar una escritura si se fuerza su cierre» (`docs/V1.8.2.md`) | Mismo límite en Next (sin `beforeunload`, V19A-05 #1) | = | — | — | — |

Capturas: ninguna.

---

## V19A-08 · HTML compartible, modo estático y literales del conectado (v1.8.2) — v1.9.0 `src/deployment.js:1-4`, `src/main.jsx:6`, `src/LegacyApp.jsx:1,46-48,91-97`, `src/beta/ConnectedShell.jsx:2,14`, `src/beta/Account.jsx:34,40,44,61`, `scripts/standalone.mjs:4-6`, `index.html:6,13`, `dist/runtime-config.js`, `public/runtime-config.js` ↔ Next —

**Estado global:** NO PORTAR. Todo depende de `window.CREWFLEX_CONFIG` (HTML independiente vs servidor propio), que no existe en nuestra pila (Vercel + Supabase, ADR-001; sin demo ni HTML autónomo en Next). Varios literales que el inventario v1.8 cita han cambiado; conviene anotarlo en esas filas.

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Configuración en tiempo de ejecución | `<script src="/runtime-config.js">` antes del módulo (`index.html:13`); `window.CREWFLEX_CONFIG={deployment:'local-beta',staticDemo:false}` (`dist/runtime-config.js`, `public/runtime-config.js`); el servidor lo sirve con `Cache-Control: no-store` (`server/app.mjs:161`); `staticDemo`, `hostedBeta`, `deploymentLabel` (`src/deployment.js:2-4`) | No existe; la configuración pública va por `NEXT_PUBLIC_*` en build (`ENVIRONMENTS.md`) | ✗ | — | — | No portar (ajeno a la pila) |
| 2 | HTML compartible oculta las cuentas | `standalone.mjs` reescribe a `deployment:'static-demo',staticDemo:true` (`:6`); con `staticDemo`: sin entrada «Mi cuenta» (`LegacyApp.jsx:46`), `#account`/`?token` → `home` (`:48`), modo forzado `demo` (`:93,97`), banda «Demo online · ejemplos y herramientas. Los cambios se guardan en tu navegador.» sin botón «Entrar en mi cuenta conectada» (`:91`), sin registro del service worker (`main.jsx:6`) | Sin HTML independiente ni demo (v1.8 SH-01 #4, #8: DEMO-ONLY) | ✗ | — | — | No portar |
| 3 | Modo por defecto alojado | `hostedBeta` → modo inicial `connected` si no hay preferencia guardada (`LegacyApp.jsx:93`) | Next siempre es «conectado» (`/` landing → `/login` → `/app`) | ✗ | — | — | No portar |
| 4 | Literales del shell conectado | «V1.9.0 · Cuenta conectada»; pie del lateral «Servidor de CrewFlex · datos propios» (antes «Servidor local · datos propios»); banner «Cuenta conectada al servidor de CrewFlex. Datos de tu cuenta, sin personajes ficticios. Acceso por invitación.» (antes «…al servidor local… Los correos externos siguen pendientes.»); pie «V1.9.0 · {Beta privada alojada \| Beta local}» (`ConnectedShell.jsx:14`) | Next no muestra banda de servidor ni versión; pie del lateral con nombre + tipo de cuenta + «Cerrar sesión» (v1.8 VIS-06 #15, SH-03 tabla «Pie del lateral») | ✗ | — | — | No portar; actualizar en el inventario v1.8 (SH-03 pie, VIS-06 #15) que el literal v1.9.0 ya no dice «local» |
| 5 | Literales de `Account` | Error sin servidor: «No se pudo conectar con el servidor de CrewFlex. Comprueba la conexión y vuelve a intentarlo. El HTML independiente contiene la demo y las herramientas.» (`Account.jsx:34`; antes «Abre esta pantalla desde el servidor local…», citado en v1.8 SH-01 #10). Aviso de login: «Los enlaces de invitación, verificación y recuperación se gestionan desde el buzón del administrador. El envío de correo externo aún no está configurado.» (`:40`). Casilla de registro: «Acepto participar en la beta con datos ficticios. Mi cuenta se guarda en el servidor de esta beta.» (`:44`). Privacidad: «Esta beta es para pruebas controladas; utiliza documentación ficticia durante la validación.» (`:61`) | Next: `ApiErrorState`/«Reintentar» (es:15) para errores de red; texto legal del registro del owner (v1.8 AUTH-02 #8); sin buzón local (OD-8) | ≈ | P3 | OD-8 (registro) | Corregir doc: SH-01 #10 y AUTH-02 #8 citan los literales de v1.8; sin cambio de código |
| 6 | Título del documento | «CrewFlex V1.9.0 — Aviation» (`index.html:6`); etiqueta «V1.9.0 · Espacio unificado», pie «V1.9.0 · Unificada» (`LegacyApp.jsx:82,91`) | Título «CrewFlex» sin versión (v1.8 META) | ✗ | — | — | No portar (etiqueta de versión del prototipo) |

Capturas: ninguna.

---

## V19A-09 · Lanzador Windows, política de despliegue y ficheros Hostinger (v1.8.2) — v1.9.0 `Iniciar_CrewFlex.cmd:1-20`, `server/deployment.mjs:1-16`, `server/app.mjs:19-21,44,157-163,174-176,212-215`, `deploy/hostinger/{LEEME_HOSTINGER.md,crewflex.env.example,nginx.conf.example,crewflex.service,crewflex-backup.service,crewflex-backup.timer,preflight.mjs,static.htaccess}`, `tests/hosting.test.mjs:10,18` ↔ Next `next.config.ts:6-11,27-29`, `src/proxy.ts`, Vercel + Supabase

**Estado global:** NO PORTAR salvo una cabecera. Todo es del servidor Node + SQLite autoalojado (ADR-001 descarta esa pila). Lo único con equivalente útil es `X-Robots-Tag: noindex` para una beta privada.

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Lanzador Windows | Comprueba Node 24 (`process.versions.node` mayor === 24) en el `node` del PATH y, si no, en el runtime empaquetado; si falta: «CrewFlex necesita Node.js 24 para abrir las cuentas y la base de datos. Instala Node.js 24 desde https://nodejs.org o abre el HTML de demo.» (`Iniciar_CrewFlex.cmd:4-19`) | No aplica (Vercel) | ✗ | — | — | No portar |
| 2 | `deploymentPolicy` | `CREWFLEX_DEPLOYMENT` ∈ {`local-beta`,`hosted-beta`}; local exige origen loopback y bloquea `NODE_ENV=production`; alojado exige dominio HTTPS, `CREWFLEX_DB` absoluta y fuera de la carpeta de la app; siempre `bind:'127.0.0.1'` (`server/deployment.mjs:2-14`; `server/app.mjs:19-21,213`) | No aplica | ✗ | — | — | No portar |
| 3 | Cookie de sesión | `__Host-crewflex_session` con `Secure` en alojado, `cf_session` en local; `HttpOnly; SameSite=Strict; Path=/` (`server/deployment.mjs:13`; `server/app.mjs:44,174-175`) | Sesión gestionada por `@supabase/ssr` (cookies del SDK); no auditado aquí | ✗ | — | — | No portar (pila distinta); la revisión de cookies queda en `SECURITY_PRIVACY.md` |
| 4 | Proxy seguro | `secureProxyRequest`: en alojado solo acepta peticiones desde loopback con `x-forwarded-proto: https`; «Se requiere HTTPS a través del proxy local.» 403 (`server/deployment.mjs:15`; `server/app.mjs:157`) | TLS y proxy los pone Vercel | ✗ | — | — | No portar |
| 5 | `X-Robots-Tag` | En alojado: `noindex, nofollow, noarchive` en todas las respuestas (`server/app.mjs:158`) | `securityHeaders` = `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (`next.config.ts:6-11,27-29`); sin `robots.ts` en `src/app` ni `X-Robots-Tag` (grep: 0). La producción actual es una beta privada por invitación (OD-8, OD-9) | − | P3 | — | Portar: añadir `X-Robots-Tag: noindex, nofollow` en `next.config.ts` (o `app/robots.ts`) mientras la beta sea privada; el owner decide cuándo retirarlo (backlog 6) |
| 6 | `/healthz` | `GET /healthz` → `{ok:true,deployment}` (`server/app.mjs:162`) | Sin endpoint; Vercel y Supabase exponen su propio estado | ✗ | — | — | No portar (sin proceso propio que vigilar) |
| 7 | `/api/session.mode` | Devuelve `policy.deployment` en vez de `'local-beta'` (`server/app.mjs:165`) | No aplica | ✗ | — | — | No portar |
| 8 | Puerto y arranque | `CREWFLEX_PORT` (1024-65535) y mensaje «CrewFlex: {origin} · servidor interno 127.0.0.1:{port}» (`server/app.mjs:213-215`) | No aplica | ✗ | — | — | No portar |
| 9 | Ficheros Hostinger | `deploy/hostinger/`: guía, `.env` de ejemplo, `nginx.conf.example`, unidades systemd + timer de copia, `preflight.mjs`, `.htaccess` para la variante estática; `tests/hosting.test.mjs` (2 pruebas) | No aplica (`ENVIRONMENTS.md`: Vercel + un proyecto Supabase) | ✗ | — | — | No portar |

Capturas: ninguna.

---

## V19A-10 · Estilos generales v1.8.2: legibilidad, campos adaptables, acciones en móvil, movimiento reducido (v1.8.2) — v1.9.0 `src/styles/v182.css:49-92,118-146`, `src/BetaPreview.jsx:5-6` ↔ Next `src/app/globals.css:7-8`, `src/components/ui/Field.tsx:3-4`, `src/components/ui/Button.tsx:11`, `src/components/ui/FilterPill.tsx:18`, `docs/product/DESIGN_SYSTEM.md:18-20,42`

**Estado global:** PARCIAL. Lo sustantivo (gris secundario ≥ 4,5:1, objetivos de 44 px con puntero grueso, `prefers-reduced-motion`) Next ya lo tenía antes que v1.8.2 (X-09, X-10, W3-06). Diferencia real: v1.8.2 pone los campos a **16 px** en móvil (evita el zoom automático de iOS); Next usa 15 px. Las reglas de calendario, logbook, vencimientos y UTC de esta hoja (`v182.css:2-47,65-72,93-117`) son de las áreas B/C y no se tabulan aquí.

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Gris secundario | `.v11-shell .secondary,.page-title p{color:#526b7d}` (antes `#536b80`/`#718396`, v1.8 VIS-01 #7), `.metric span/small`, `.ops-kpis small`, `.candidate-* small`, `.home-feed-row p/small`, `.tb-header p`, `.tb-footnote` → `#526b7c`, 11-12 px (`v182.css:73-88`) | Un único `--color-muted: #5b6f84` (`globals.css:8`; `DESIGN_SYSTEM.md:20`), 5,18:1 sobre blanco y 4,83:1 sobre canvas (v1.8 VIS-01 #7, A11Y-06) | = | — | — | — (v1.8.2 converge con lo que Next ya hacía) |
| 2 | Hero del pasaporte | `.personal-passport .cf-identity p/small`, `.profile-progress p`, `.personal-stats span` → `#d2e6e9` (`v182.css:89-91`) | Hero de «Mi espacio»: cuerpo `#a9bfd2` (8,6:1) sobre `bg-hero` (`DESIGN_SYSTEM.md:42`; v1.8 VIS-01 #20) | ≈ | — | — | Mantener |
| 3 | Campos en móvil | ≤760 px: `input:not([type=checkbox]):not([type=radio]),select,textarea{font-size:16px;min-height:44px}` (`v182.css:121`) | `controlClass`: `min-h-10 pointer-coarse:min-h-11 … text-[15px]` a todos los anchos (`Field.tsx:3-4`). 15 px < 16 px: Safari iOS amplía la página al enfocar el campo | ≠ | P2 | — | Portar: `text-base` por debajo de `md` (o `max-md:text-base`) en `controlClass` y en los campos que no lo usan (backlog 5) |
| 4 | Campos adaptables | `:is(input,select,textarea){max-width:100%;min-width:0;box-sizing:border-box}`, `textarea{resize:vertical;min-height:96px}`, `min-width:0` en `.control`, `.form-grid>*`, `.detail-grid>*` (`v182.css:50-53`) | `block w-full` en `controlClass` (`Field.tsx:4`); `resize`/`min-height` del `textarea` **sin verificar** en esta pasada | ≠ (integración 29/10: antes ≈; sin verificar: no cuenta como paridad hasta medirlo) | P3 | — | Comprobar `textarea` (resize vertical, altura mínima) al tocar backlog 5 |
| 5 | Nombres e importes largos | `overflow-wrap:anywhere` en títulos de tarjeta, `.candidate-person`, `.logbook-entry p`, `.beta-row p`, `.document-row p`; `tabular-nums` en `.tb-line>b`/`.summary-line>b` (`v182.css:56-57`); grupos de acciones `max-width:100%;min-height:44px` (`:58`) | `tabular-nums` en importes (`RequirementTerms.tsx:119,137,147`); cortes en diálogos (`DocumentViewer.tsx:108`, `RequirementPreview.tsx:84`); en v1.8 se midió 0 desbordamiento horizontal a 390 en 27 páginas (50 §Verificación v2) | ≈ | — | — | Mantener |
| 6 | Cabecera de página en móvil | `.page-title,.tb-header{flex-wrap:wrap}`, `h1{font-size:clamp(25px,6vw,32px)}`, `.title-actions{width:100%}` con botones `flex:1 1 140px` (`v182.css:122-125`) | `PageHeader.tsx` con acciones en `actions`; comportamiento a 390 **sin verificar** aquí (capturas v1.8 `evidencias/v2/10/*-390.jpg` muestran la cabecera envuelta) | ≠ (integración 29/10: antes ≈; sin verificar: no cuenta como paridad hasta medirlo) | P3 | — | Mantener; revisar en la próxima medida a 390 |
| 7 | Objetivos de 44 px | `.icon-button{min-width:42px;min-height:42px}` en móvil (`v182.css:135`), `.row.wrap>.action,.beta-actions>.tb-button{min-height:44px}` (`:58`), `.calendar-controls` 44 (área B) | `pointer-coarse:min-h-11` en `Button`, `Field`, `FilterPill`, enlaces y casillas (43 ficheros; X-09; v1.8 A11Y-05) | ≈ | — | — | Mantener (v1.8.2 queda en 42 px donde Next da 44) |
| 8 | Dock móvil | `.mobile-dock button{font-size:10px}`, `span{font-size:clamp(8px,2.1vw,10px);white-space:nowrap}` (`v182.css:137-138`) | `MobileDock.tsx` (v1.8 VIS-07 #22, medido 20 px de icono); tamaño del texto **sin verificar** aquí | ≠ (integración 29/10: antes ≈; sin verificar: no cuenta como paridad hasta medirlo) | P3 | — | Mantener |
| 9 | Banda de demo y selector | `.demo-banner{color:#4b6378}`, `.demo-switcher small` `#526b7c`, padding móvil (`v182.css:86-87,126-127`) | Sin banda de demo (DEMO-ONLY, v1.8 SH-02) | ✗ | — | — | No portar |
| 10 | Dinero del panel de operaciones | `.ops-dashboard .ops-money p{color:#d5e9ed}`, `.ops-money.secondary` `#234c5e` (`v182.css:78-80`) | Sin panel de comisiones (OUT) | ✗ | — | SCOPE / OD-7 | No portar |
| 11 | `prefers-reduced-motion` | `.v11-shell *{scroll-behavior:auto!important;transition:none!important;animation:none!important}` (`v182.css:145`) | Ya medido: 0 animaciones con `reduce` en 24 rutas (v1.8 VIS-05 #4, `+`, W3-06 `6ac67d2`) | = | — | — | — |
| 12 | Vista móvil simulada | `.phone-preview .logbook-toolbar`, `.phone-preview .panel-head` (`v182.css:143-144`) | Sin vista simulada (DEMO-ONLY, v1.8 SH-02 #5 / TD-05) | ✗ | — | — | No portar |
| 13 | `@media print` general | Oculta exportaciones, controles y leyendas de calendario/logbook (`v182.css:146`) | Sin estilos de impresión (V19A-04 #1; v1.8 VIS-05 #5) | ✗ | — | SCOPE | No portar (impresión fuera de alcance; detalle de calendario/logbook en área B) |
| 14 | Relleno del contenido en móvil | `.v11-shell .content{padding:24px 16px 30px}`, paneles 18 px (`v182.css:119-120`) | Relleno del `main` del shell **sin verificar** en esta pasada (`AppShell.tsx`) | ≠ (integración 29/10: antes ≈; sin verificar: no cuenta como paridad hasta medirlo) | P3 | — | Mantener |
| 15 | Buscador de herramientas | `.tb-search input{width:100%}` (`v182.css:92`) | Buscador del glosario con `controlClass` `w-full` (`Field.tsx:4`; `knowledge`), **sin verificar** el componente concreto | ≠ (integración 29/10: antes ≈; sin verificar: no cuenta como paridad hasta medirlo) | P3 | — | Mantener |

Capturas: ninguna nueva. Next: `evidencias/v2/10/*-390.jpg`, `evidencias/next-2026-10-22/*` (anteriores a v1.8.2; muestran el estado de Next, no el de v1.9.0).

---

## V19A-11 · Shell: cambios menores de navegación (v1.8.2 / v1.9.0) — v1.9.0 `src/LegacyApp.jsx:27,46-48,70,73,82`, `src/beta/ConnectedShell.jsx:9,12-14`, `src/components/v11/Shared.jsx:16` ↔ Next `src/components/layout/AppShell.tsx`, `NavLinks.tsx`, `MobileDock.tsx`

**Estado global:** NO PORTAR. Los cambios del shell en el diff son la entrada «Formación» (menú, dock, icono `training: BookOpen`, exclusión del selector «Probar como»): área C. Aquí solo quedan dos detalles de comportamiento.

| # | Elemento | v1.9.0 (literal «…» / comportamiento) | Next (literal «…» / comportamiento, `archivo:línea`) | Diff | Sev. | Bloqueo | Acción |
|---|---|---|---|---|---|---|---|
| 1 | Clave de remontaje de la pantalla | La `key` compuesta pasa de `<main>` a `<Screen>` para que `BackNavigation` sobreviva al cambio de pantalla (`LegacyApp.jsx:91`) | Sin equivalente: cada ruta es una página; el shell es un `layout` persistente (`src/app/app/layout.tsx`) | ✗ | — | — | No portar |
| 2 | Hash desconocido o `#account` en estático | `sync` manda a `home` los hashes no listados y, en `staticDemo`, también `#account` y cualquier `?token` (`LegacyApp.jsx:48`) | `not-found.tsx` con 404 real (v1.8 SH-07 fila 10) | ✗ | — | — | No portar |
| 3 | «Formación» en menú, dock e icono | `['training','Formación']` en técnico, empresa, admin y dock; `icons.training=BookOpen` (`LegacyApp.jsx:27,46,73`; `ConnectedShell.jsx:9,12`; `Shared.jsx:16`) | Ver área C | ✗ | — | — | Fuera de este fichero (área C); sin fila propia aquí |

Capturas: ninguna.

---

## Backlog derivado (portable ya, sin bloqueo)

1. **Cabecera fija y cuerpo con scroll en los cinco `<dialog>`** (V19A-02 #1, #7).
   Ficheros: `src/features/professional/components/ProfileStatusDialog.tsx`, `src/features/requirements/components/RequirementPreview.tsx`, `src/features/directory/components/ProfileDialog.tsx`, `src/features/professional/components/PassportDraft.tsx`, `src/features/documents/components/DocumentViewer.tsx`; opcionalmente un `src/components/ui/DialogFrame.tsx` (cabecera + cuerpo) para no duplicar clases.
   Criterio: el `<dialog>` es `flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden`, la cabecera `shrink-0` con borde y el cuerpo `min-h-0 overflow-y-auto overscroll-contain`; a 390×844 con contenido más alto que la pantalla (visor de documento, vista previa de necesidad larga), tras desplazar el cuerpo el título y el botón de cierre siguen visibles (captura antes/después); Escape sigue cerrando y el foco vuelve al disparador (smoke existente `ui-smoke.mjs:2112-2116` en verde); los tres títulos sin regla de corte llevan `break-words`.
   Tamaño: M. Migración/Edge Function: no.

2. **Alternativa manual al portapapeles** (V19A-06 #2).
   Ficheros: `src/features/tools/components/parts.tsx` (`CopyButton`), `messages/es.json`, `messages/en.json` (`tools.copyManualNotice`, `tools.copyManualLabel`).
   Criterio: con `navigator.clipboard` indefinido o `writeText` rechazado (test de componente con `vi.stubGlobal`), aparece un `textarea` de solo lectura con el texto, un aviso `role="status"` «El navegador no permite copiar automáticamente. Selecciona y copia el texto.» y el foco en el `textarea` selecciona todo; con portapapeles disponible no cambia nada («Copiado» 1,8 s).
   Tamaño: S. Migración/Edge Function: no.

3. **Hook `useUnsavedChanges` (beforeunload + confirmación)** (V19A-05 #1-#3).
   Ficheros: nuevo `src/features/shared/useUnsavedChanges.ts` (o junto al consumidor), `src/features/requirements/components/RequirementForm.tsx` (consumidor: `dirty && !pending`), claves i18n parametrizadas por editor; el consumidor principal (calendario) lo define el área B.
   Criterio: con el formulario sucio, recargar o cerrar la pestaña muestra el diálogo nativo del navegador (test de componente: `beforeunload` recibe `preventDefault`); sin cambios no se registra el listener; tras guardar con éxito el listener se retira antes de la redirección. La intercepción de la navegación interna (enlaces del shell) queda como paso opcional M, solo si el área B la exige.
   Tamaño: S (beforeunload) / M (intercepción interna). Migración/Edge Function: no.

4. **Vaciado síncrono del autoguardado al desmontar** (V19A-07 #1).
   Ficheros: `src/features/requirements/components/RequirementForm.tsx:162-166`.
   Criterio: test de componente: escribir en un campo y desmontar antes de 350 ms deja el borrador en `localStorage` (`autosaveKey`); publicar con éxito sigue sin dejar borrador (`forgetAutosave` antes de la acción, test existente si lo hay o nuevo).
   Tamaño: S. Migración/Edge Function: no.

5. **Campos a 16 px por debajo de `md`** (V19A-10 #3-#4).
   Ficheros: `src/components/ui/Field.tsx` (`controlClass`), cualquier `<input>`/`<select>`/`<textarea>` que no use `controlClass` (grep `text-[15px]`/`text-sm` en campos), `docs/product/DESIGN_SYSTEM.md` (regla de tamaño de campo).
   Criterio: a 390 px `getComputedStyle(input).fontSize === '16px'` en login, nueva necesidad, pasaporte y herramientas (añadir al smoke); a 1440 se mantiene 15 px; `textarea` con `resize-y` y altura mínima documentada.
   Tamaño: S. Migración/Edge Function: no.

6. **`X-Robots-Tag: noindex, nofollow` mientras la beta sea privada** (V19A-09 #5).
   Ficheros: `next.config.ts` (`securityHeaders`) o `src/app/robots.ts`; `docs/product/SECURITY_PRIVACY.md` (nota) y `docs/architecture/ENVIRONMENTS.md`.
   Criterio: `curl -I` local muestra la cabecera en `/`, `/login` y `/app`; test de la configuración si existe suite de cabeceras; el owner decide la fecha de retirada (producción = push a `main`, requiere su autorización).
   Tamaño: S. Migración/Edge Function: no.

Filas: = 11 · ≈ 23 · ≠ 2 · − 6 · + 0 · ✗ 27
