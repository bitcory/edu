#!/usr/bin/env bash
# Package the TB Magic Book extension into public/ so the app can serve it as the
# "새 버전 받기" download (EXT_DOWNLOAD_URL=/tbbook-imagegen-ext.zip).
#
# Run after bumping manifest.json "version". The archive holds the
# tbbook-imagegen-ext/ folder so users can unzip → chrome://extensions → Load
# unpacked. Stable filename (no version) so EXT_DOWNLOAD_URL never changes;
# only the zip contents + EXT_LATEST_VERSION are updated per release.
set -euo pipefail

ext_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$ext_dir/.." && pwd)"
out="$repo_root/public/tbbook-imagegen-ext.zip"
ver="$(grep -o '"version": *"[^"]*"' "$ext_dir/manifest.json" | head -1 | sed 's/.*"\([0-9.]*\)"$/\1/')"

rm -f "$out"
cd "$repo_root"
# Bundle only the runtime files; skip docs, packaging script, and OS cruft.
zip -r "$out" tbbook-imagegen-ext \
  -x '*/.DS_Store' '*/README.md' '*/pack.sh' >/dev/null

echo "packed v$ver → $out"
