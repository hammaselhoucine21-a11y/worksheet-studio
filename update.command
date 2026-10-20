#!/bin/bash
# Updates Worksheet Studio on a Mac to the newest version.
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v git >/dev/null 2>&1 || [ ! -d .git ]; then
  echo "Download the newest ZIP from GitHub instead, then run install.command."
  read -r -p "Press Enter to close."
  exit 1
fi
git pull && npm install --no-audit --no-fund && node scripts/get-model.mjs && npm run build
echo
echo "Updated. Open Worksheet Studio as usual."
read -r -p "Press Enter to close."
