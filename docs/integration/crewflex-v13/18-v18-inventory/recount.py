import sys, re, collections
# Counts the Diff symbols of the inventory tables (source: the 2026-10-22 v2 diff, `herramientas/recount.py`).
# F3 addition: rows held by an open decision (Bloqueo ≠ «—») and the parity line, so the metric is reproducible.
SYM = "=≈≠−+✗"
SPLIT = re.compile(r"(?<!\\)\|")
def count(path):
    c = collections.Counter(); sev = collections.Counter(); blk = collections.Counter(); col = scol = bcol = None; in_tab = False
    for line in open(path, encoding='utf8'):
        if not line.startswith('|'):
            in_tab = False; continue
        cells = [x.strip() for x in SPLIT.split(line.strip())[1:-1]]
        if not in_tab:
            in_tab = True
            col = cells.index('Diff') if cells and cells[0] == '#' and 'Diff' in cells else None
            scol = cells.index('Sev.') if col is not None and 'Sev.' in cells else None
            bcol = cells.index('Bloqueo') if col is not None and 'Bloqueo' in cells else None
            continue
        if col is None or not cells or set(cells[0]) <= set('-: ') or len(cells) <= col: continue
        d = cells[col].lstrip('`*')
        if d and d[0] in SYM:
            c[d[0]] += 1
            m = re.match(r'P[0-3]', cells[scol]) if scol is not None and scol < len(cells) else None
            sev[m.group(0) if m else '—'] += 1
            b = cells[bcol] if bcol is not None and bcol < len(cells) else '—'
            b = re.sub(r'\((?:v2|xhigh|F3):[^)]*\)', '', b).strip()
            if d[0] in '=≈≠−' and b and b[0] not in '—–-': blk[d[0]] += 1  # «— (note)» = not held
    return c, sev, blk
tot = collections.Counter(); tsev = collections.Counter(); tblk = collections.Counter()
for p in sys.argv[1:]:
    c, sev, blk = count(p); tot += c; tsev += sev; tblk += blk
    print(p.split('/')[-1], sum(c.values()), ' · '.join(f"{s} {c[s]}" for s in SYM), '| sev', dict(sorted(sev.items())), '| blocked', sum(blk.values()))
print('TOTAL', sum(tot.values()), ' · '.join(f"{s} {tot[s]}" for s in SYM), '| sev', dict(sorted(tsev.items())), '| blocked', sum(tblk.values()), dict(tblk))
applicable = sum(tot[s] for s in '=≈≠−')
if applicable:
    ok = tot['='] + tot['≈']
    print(f"PARITY (= + ≈) / (= + ≈ + ≠ + −) = {ok}/{applicable} = {100 * ok / applicable:.1f} % · "
          f"held by an open decision {sum(tblk.values())}/{applicable} = {100 * sum(tblk.values()) / applicable:.1f} % "
          f"· out of scope (✗) {tot['✗']} · Next-only (+) {tot['+']}")
