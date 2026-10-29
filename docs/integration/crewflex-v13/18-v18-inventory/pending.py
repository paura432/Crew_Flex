import sys, re, csv, collections, os
# The 216 pending rows (≠ / −) of the inventory, one cause each, written to CSV (2026-10-29 audit, `19-pending-audit.md`).
# Same row rules as recount.py; the metric is NOT changed here: every row stays in the denominator.
# Usage: python3 pending.py OUT.csv 10-*.md 20-*.md 30-*.md 40-*.md 50-*.md
SPLIT = re.compile(r"(?<!\\)\|")
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 4))

# cause → category (A–G of the audit), key that closes the row, how it closes, what is missing, owner needed, where verifiable
CAUSES = {
    "PORT":   ("B", "—", "portar", "Tarifa y horas base en la fila de la lista (el detalle ya las tiene); modo y % siguen OUT", "no (DEFAULTS, T-62)", "LOCAL"),
    "FUEL":   ("E", "D-11", "portar tras la revisión técnica", "FuelTools + FuelSheet completos: no hay ruta, componente, texto ni test", "sí", "LOCAL"),
    "PACK":   ("E", "D-07 P3 + D-10", "decidir plazo de retención y escáner; activar M09", "Documentos, contacto e identidad del Candidate Pack (M09 preparado y apagado)", "sí", "LOCAL + PROD (escáner)"),
    "LEGAL":  ("E", "texto legal", "portar la casilla con versión aceptada", "Texto de condiciones del owner (el de v1.8 describe una beta local)", "sí", "LOCAL"),
    "SECDEV": ("E", "reclasificación", "solo reclasificando: portar v1.8 abre una fuga", "Nada en Next: v1.8 enumera cuentas o mezcla datos", "sí (métrica)", "LOCAL"),
    "SECGAP": ("E", "CX-09 + T22", "CSP aplicada y T22 en producción", "Cookies de sesión legibles desde JS (Next peor que v1.8)", "sí", "PROD"),
    "PROD":   ("F", "despliegue", "activar y desplegar en producción", "Funciona en local; producción no la tiene", "sí", "PROD"),
    "Q6":     ("D", "Q6", "portar cobertura parcial si se revisa Q6", "Jornadas, mínimo de días y bloques consecutivos (v1.8)", "sí", "LOCAL"),
    "T33":    ("D", "T-33", "portar si la tarifa se comparte", "Tarifa del pasaporte visible y filtrable por organizaciones", "sí", "LOCAL"),
    "OD5":    ("D", "OD-5", "activar la puerta de confirmación", "Puerta «organización revisada» antes de confirmar (T-52)", "sí", "LOCAL"),
    "OD8":    ("D", "OD-8", "volver al valor de v1.8", "Caducidad 24 h / entrada «Tengo una invitación»", "sí", "LOCAL + PROD (Auth)"),
    "NEW01":  ("D", "NEW-01", "portar service worker solo de herramientas", "Service worker e indicador «Sin conexión»", "sí", "LOCAL"),
    "DESIGN": ("D", "DV-DIS", "portar forma/texto v1.8 o aceptar la desviación", "Forma o texto distintos por diseño de Next, sin decisión del owner", "sí", "LOCAL"),
    "INTERNAL": ("D", "DV-INT", "solo reclasificando (≈): no hay comportamiento v1.8 que portar", "Nada visible: la fila compara mecanismos internos", "sí (métrica)", "—"),
    "OUT":    ("G", "SCOPE-2 OUT", "mover a alcance o reclasificar ✗ (regla del README)", "Nada dentro del alcance aprobado", "sí (alcance o métrica)", "—"),
    "DEMO":   ("G", "DEMO-ONLY", "reclasificar ✗ (regla del README)", "Nada: solo existe en la demo de v1.8", "sí (métrica)", "—"),
    "DECOK":  ("G", "decisión aprobada", "reclasificar o revocar la decisión", "Nada: Next sigue una decisión aprobada", "sí (métrica)", "—"),
    "V18BUG": ("G", "defecto v1.8", "reclasificar ✗ (regla del README: bug)", "Nada: portar reintroduce el defecto de v1.8", "sí (métrica)", "—"),
}
# Free rows (Bloqueo «—») read one by one; blocked rows follow their Bloqueo below.
MANUAL = {
    "PORT": "ORG-04#22",
    "SECDEV": "AUTH-02#13 AUTH-04#6 ACC-01#12 TOOL-07#18",
    "SECGAP": "AUTH-06#9",
    "PROD": "AUTH-06#7",
    "OD8": "AUTH-05#4 SHOT-08#4",
    "DEMO": "SH-01#1 TEC-02#43 VIS-06#6",
    "DECOK": "SH-02#1 SH-02#21 SH-02#22 SH-02#24 SH-03#16 ADM-01#1 ACC-02#2 ADM-03#8 AUTH-05#1 TEC-04#53 "
             "MKT-05#13 HIRE-02#25 TOOL-01#35 TOOL-02#20 I18N-01#5",
    "V18BUG": "SH-06#14 ACC-01#11 ORG-04#4 TOOL-01#36 TOOL-02#24 TOOL-03#4 TOOL-03#8 TOOL-05#9 TOOL-05#10 TOOL-05#14 "
              "TOOL-06#2 TOOL-06#5 TOOL-07#2 TOOL-07#6 TOOL-07#8 TOOL-07#19 TOOL-08#2 TOOL-08#3 TOOL-08#6 TOOL-09#28 "
              "A11Y-02#2 A11Y-05#11 A11Y-06#3 A11Y-06#10",
    "INTERNAL": "TOOL-01#19 VIS-01#1 VIS-04#7 VIS-06#1",
    "DESIGN": "SH-03#17 SH-03#27 SH-05#7 SH-05#8 SH-06#1 AUTH-01#1 AUTH-02#10 ORG-01#3 ORG-01#4 ORG-02#3 ORG-02#4 ORG-02#5 "
              "ORG-04#2 ORG-04#7 MKT-02#16 VIS-02#2 VIS-02#4 VIS-02#8 VIS-02#12 VIS-03#2 "
              "VIS-06#2 VIS-06#9 VIS-06#10 VIS-06#13 VIS-06#16 VIS-07#15 VIS-09#9 META-01#4 A11Y-04#9 I18N-01#6 "
              "I18N-03#9 SHOT-03#5 SHOT-08#1 SHOT-08#2 SHOT-08#3 SHOT-09#1",
}
MANUAL = {rid: cause for cause, ids in MANUAL.items() for rid in ids.split()}
OUT_GROUP = {"HIRE-06": "chat", "VIS-05": "impresión del Pack"}   # else money (OD-7 / commissions) or back office

def cause_of(rid, sec, b):
    if rid in MANUAL: return MANUAL[rid], []
    if "D-11" in b: return "FUEL", []
    if "Q6" in b: return "Q6", ["PACK"] if ("D-07" in b or "D-10" in b) else []
    if rid in ("ADM-03#1", "TEC-03#16", "TEC-05#1"): return "PROD", []
    if "D-07" in b or "D-10" in b: return "PACK", []
    if "T-33" in b: return "T33", []
    if "OD-5" in b: return "OD5", []
    if "legal" in b: return "LEGAL", []
    if "NEW-01" in b or sec == "META-03": return "NEW01", []
    if "C-5" in b: return "DECOK", []           # C-5 is ACCEPTED (07-decisions-index): the row's «sigue abierta» is stale
    if "DEMO-ONLY" in b: return "DEMO", []
    if b.startswith("SCOPE") or sec in ("HIRE-06", "HIRE-08"): return "OUT", []
    raise SystemExit(f"unclassified row {rid}: {b!r}")

EVID = re.compile(r"PKG [\w-]+(?: [\w/.-]+)?|[\w.-]+\.test\.ts|smoke \d+\w*|E2E [^,;)]*|evidencias/[^`\s,;)]+|docs/audit/evidence/[^`\s,;)]+")
PATH = re.compile(r"`((?:src|supabase|tests|docs|scripts|messages)/[^`:\s]+?)(?::[\d,-]+)?`")

rows = []
for path in sys.argv[2:]:
    sec = hdr = None; ln = 0
    for line in open(path, encoding="utf8"):
        ln += 1
        if line.startswith("## "): sec = line[3:].strip()
        if not line.startswith("|"):
            hdr = None; continue
        cells = [x.strip() for x in SPLIT.split(line.strip())[1:-1]]
        if hdr is None:
            hdr = cells if cells and cells[0] == "#" and "Diff" in cells else []
            continue
        if not hdr or not cells or set(cells[0]) <= set("-: ") or len(cells) <= hdr.index("Diff"): continue
        d = cells[hdr.index("Diff")].lstrip("`*")
        if not d or d[0] not in "≠−": continue
        g = lambda h: cells[hdr.index(h)] if h in hdr and hdr.index(h) < len(cells) else ""
        v18 = cells[2] if len(cells) > 2 else ""; nxt = cells[3] if len(cells) > 3 else ""
        sid = sec.split(" ")[0]; rid = sid + "#" + re.match(r"\d+", cells[0]).group(0)
        b = re.sub(r"\((?:v2|xhigh|F3):[^)]*\)", "", g("Bloqueo")).strip()
        cause, extra = cause_of(rid, sid, b)
        cat, key, closes, missing, owner, env = CAUSES[cause]
        keys = [key] + [CAUSES[x][1] for x in extra]
        if cause == "OUT":
            keys = ["OUT " + OUT_GROUP.get(sid, "comisiones" if re.search(r"OD-7|commission|comisi", b) or sid == "HIRE-08" else "back office")]
        ev = sorted(set(EVID.findall(nxt)))
        broken = [p for p in PATH.findall(nxt) if not os.path.exists(os.path.join(ROOT, p))]
        # ≠ = Next has its own behaviour, which needs evidence; − = missing in Next, nothing to verify yet
        verif = "sí" if ev or re.search(r"[Mm]edido|[Ee]n ejecución", nxt) else ("no citada" if d[0] == "≠" else "n/a (falta en Next)")
        rows.append({"id": rid, "id_original": f"{sid} #{cells[0]}", "archivo": f"{os.path.basename(path)}:{ln}",
                     "modulo": sec.split(" — ")[0], "funcionalidad": g("Elemento"), "v18": v18, "next": nxt,
                     "diff": d[0], "prioridad": (re.match(r"P[0-3]", g("Sev.")) or [None])[0] or "—",
                     "bloqueo_inventario": g("Bloqueo"), "categoria": cat, "causa": cause, "llaves": " + ".join(keys),
                     "evidencia": " · ".join(ev), "verified_local": verif, "verified_stg": "n/a (sin STG, OD-9)",
                     "verified_production": "no", "rutas_rotas": " ".join(broken), "falta": missing,
                     "accion_inventario": g("Acción"), "cierre": closes, "requiere_owner": owner, "entorno": env})

ids = collections.Counter(r["id"] for r in rows)
assert all(v == 1 for v in ids.values()), [k for k, v in ids.items() if v > 1]
assert not set(MANUAL) - set(ids), set(MANUAL) - set(ids)
with open(sys.argv[1], "w", newline="", encoding="utf8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n"); w.writeheader(); w.writerows(rows)

OK, APP = 1050, 1266   # recount.py at 0755ff7: = 452 + ≈ 598 over = + ≈ + ≠ + − = 1 266
assert len(rows) == APP - OK, len(rows)
pct = lambda n, d=APP: f"{100 * n / d:.1f} %"
C = collections.Counter
print("filas", len(rows), dict(C(r["diff"] for r in rows)))
print("categoría", dict(sorted(C(r["categoria"] for r in rows).items())))
print("causa", dict(C(r["causa"] for r in rows).most_common()))
print("prioridad", dict(sorted(C(r["prioridad"] for r in rows).items())))
print("módulo", dict(sorted(C(re.sub(r"-\d+$", "", r["id"].split("#")[0]) for r in rows).items())))
print("categoría×prioridad", dict(sorted(C((r["categoria"], r["prioridad"]) for r in rows).items())))
print("verified_local", dict(C(r["verified_local"] for r in rows)), "| rutas rotas", [(r["id"], r["rutas_rotas"]) for r in rows if r["rutas_rotas"]])
print("--- cerrar portando (numerador +n):")
for k, n in C(r["llaves"] for r in rows if r["causa"] not in ("DEMO", "DECOK", "V18BUG", "SECDEV", "INTERNAL")).most_common():
    print(f"  {k:28} {n:3}  → {OK + n}/{APP} = {pct(OK + n)}")
rec = [r for r in rows if r["causa"] in ("DEMO", "DECOK", "V18BUG", "SECDEV", "INTERNAL", "OUT")]
print(f"--- solo reclasificando (✗/≈, denominador −n): {len(rec)} filas", dict(C(r["causa"] for r in rec)))
port = len(rows) - len(rec) + sum(r["causa"] == "OUT" for r in rows)
print(f"techo portando todo lo portable: {OK + port}/{APP} = {pct(OK + port)}; sin decisión nueva: {OK + 1}/{APP} = {pct(OK + 1)}")
