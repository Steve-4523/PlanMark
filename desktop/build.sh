#!/usr/bin/env bash
# Build the PlanMark Windows x64 installer (NSIS) + zip on Linux. No wine needed.
#   ./build.sh                      # uses /home/claude/pm-web
#   WEB_SRC=/path/to/web ./build.sh # build from another copy of the web app
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_SRC="${WEB_SRC:-/home/claude/pm-web}"
cd "$HERE"

# Proxy CA for electron / NSIS binary downloads.
if [[ -f "$HOME/.ccr/ca-bundle.crt" && -z "${NODE_EXTRA_CA_CERTS:-}" ]]; then
  export NODE_EXTRA_CA_CERTS="$HOME/.ccr/ca-bundle.crt"
fi

if [[ ! -d "$WEB_SRC" ]]; then
  echo "ERROR: web source dir not found: $WEB_SRC" >&2; exit 1
fi
if [[ ! -f "$WEB_SRC/index.html" ]]; then
  echo "ERROR: $WEB_SRC/index.html does not exist yet. Set WEB_SRC to a copy that has it." >&2
  exit 1
fi

echo "==> Copying web app from $WEB_SRC -> $HERE/web (source is read-only to us)"
rm -rf "$HERE/web"
mkdir -p "$HERE/web"
cp -a "$WEB_SRC/." "$HERE/web/"
# Drop VCS / editor junk if present.
rm -rf "$HERE/web/.git" "$HERE/web/node_modules"
find "$HERE/web" \( -name '*.swp' -o -name '*~' -o -name '.DS_Store' \) -delete 2>/dev/null || true

echo "==> Installing npm dependencies (if needed)"
if [[ ! -x node_modules/.bin/electron-builder ]]; then
  npm ci || npm install
fi

if [[ ! -f build/icon.ico ]]; then
  echo "==> Generating icon"
  python3 -I scripts/make-icon.py build || echo "WARN: icon generation failed; continuing"
fi

node --check main.js
node --check preload.js

echo "==> Building Windows x64 NSIS installer + zip"
rm -rf dist
node scripts/build-win.js

echo "==> Artifacts:"
ls -la dist/*.exe dist/*.zip
