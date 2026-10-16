#!/usr/bin/env bash
# export-zip.sh — package the Crew Flex project (code, docs, migrations, tests) into a shareable zip.
#
# Default: the current working tree, uncommitted changes included, honouring .gitignore
# (no node_modules, .next, tmp/, root *.zip, nor any real .env file).
# --committed: only what is committed at HEAD (git archive), ignoring local changes.
# Never includes secrets: real .env* files and *.pem are always dropped, and the export aborts if a
# file looks like it carries a Supabase secret key or a JWT.
# Output: tmp/exports/crewflex-<date>-<sha>[-dirty].zip (tmp/ is git-ignored).
# Usage: bash scripts/export-zip.sh [--committed] [--out <file.zip>]
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$REPO_ROOT"

MODE=worktree; OUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --committed) MODE=committed ;;
    --out) OUT="${2:?--out needs a path}"; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

command -v zip >/dev/null || { echo "zip not found (sudo apt install zip)" >&2; exit 1; }

SHA="$(git rev-parse --short HEAD)"
SUFFIX=""
[ "$MODE" = worktree ] && [ -n "$(git status --porcelain)" ] && SUFFIX="-dirty"
OUT="${OUT:-tmp/exports/crewflex-$(date +%Y%m%d)-${SHA}${SUFFIX}.zip}"
mkdir -p "$(dirname "$OUT")"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
rm -f "$OUT"

if [ "$MODE" = committed ]; then
  LIST_CMD=(git ls-files)
else
  LIST_CMD=(git ls-files --cached --others --exclude-standard)
fi

LIST="$(mktemp)"; trap 'rm -f "$LIST"' EXIT
# Deleted-but-unstaged files still appear in ls-files --cached; keep only what exists on disk.
"${LIST_CMD[@]}" \
  | grep -vE '(^|/)\.env($|\.)' \
  | grep -vE '\.pem$' \
  | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done > "$LIST" || true
# Re-admit the tracked templates the filter above dropped.
"${LIST_CMD[@]}" | grep -E '(^|/)\.env(\.e2e)?\.example$' >> "$LIST" || true

# Secret guard: Supabase secret keys, legacy service_role JWTs, private keys.
SECRET_RE='sb_secret_[A-Za-z0-9_-]{10,}|eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
if [ "$MODE" = committed ]; then
  git grep -lIE "$SECRET_RE" HEAD -- > "$LIST.hits" || true
else
  xargs -d '\n' grep -lIE "$SECRET_RE" < "$LIST" > "$LIST.hits" 2>/dev/null || true
fi
if [ -s "$LIST.hits" ]; then
  echo "ABORT: possible secrets in:" >&2; sed 's/^/  /' "$LIST.hits" >&2; rm -f "$LIST.hits"; exit 1
fi
rm -f "$LIST.hits"

if [ "$MODE" = committed ]; then
  # HEAD never holds a real .env (git-ignored), so the whole tree is safe to archive.
  git archive --format=zip --prefix=crewflex/ -o "$OUT" HEAD
else
  # Files are zipped under a crewflex/ prefix via a temporary symlink.
  STAGE="$(mktemp -d)"; trap 'rm -f "$LIST"; rm -rf "$STAGE"' EXIT
  ln -s "$REPO_ROOT" "$STAGE/crewflex"
  sed 's|^|crewflex/|' "$LIST" | (cd "$STAGE" && zip -q -X "$OUT" -@)
fi

echo "OK  $(wc -l < "$LIST") files  $(du -h "$OUT" | cut -f1)  ->  $OUT"
