#!/bin/bash
# Worksheet Studio installer for Mac (macOS 11 Big Sur or newer, Intel or Apple Silicon).
# Double-click this file (first time: right-click > Open), or run:  bash install.command
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
DIR="$(pwd)"

echo
echo "  =============================================="
echo "     Worksheet Studio - installing (all free)"
echo "  =============================================="
echo

MAC_VER="$(sw_vers -productVersion)"
if [ "${MAC_VER%%.*}" -lt 11 ]; then
  echo "  This Mac has macOS $MAC_VER. The installed app needs macOS 11 (Big Sur) or newer."
  echo "  You can still use the online version in Chrome or Firefox:"
  echo "  https://hammaselhoucine21-a11y.github.io/worksheet-studio/"
  read -r -p "  Press Enter to close."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is needed. Downloading the free installer..."
  PKG="$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | awk '/\.pkg$/ {print $2; exit}')"
  if [ -z "$PKG" ] || ! curl -fL --progress-bar -o "/tmp/$PKG" "https://nodejs.org/dist/latest-v22.x/$PKG"; then
    echo "  Could not download Node.js. Please install it from https://nodejs.org (LTS), then run this again."
    read -r -p "  Press Enter to close."
    exit 1
  fi
  open "/tmp/$PKG"
  echo
  echo "  The Node.js installer is open. Click Continue/Install until it finishes,"
  echo "  then double-click install.command again."
  read -r -p "  Press Enter to close."
  exit 0
fi

fail() {
  echo
  echo "  Something went wrong. Check the internet connection and run install.command again."
  read -r -p "  Press Enter to close."
  exit 1
}

echo "  [1/4] Getting the app's parts..."
npm install --no-audit --no-fund || fail
echo
echo "  [2/4] Getting the magic eraser (AI)..."
node scripts/get-model.mjs || fail
echo
echo "  [3/4] Building the app..."
npm run build || fail
echo
echo "  [4/4] Adding Worksheet Studio to Applications and the Desktop..."
chmod +x start.command update.command 2>/dev/null
APP="$HOME/Applications/Worksheet Studio.app"
mkdir -p "$HOME/Applications"
rm -rf "$APP"
NODE_BIN="$(command -v node)"
osacompile -o "$APP" -e "do shell script \"cd \" & quoted form of \"$DIR\" & \" && nohup \" & quoted form of \"$NODE_BIN\" & \" scripts/serve.mjs --open > /dev/null 2>&1 &\"" || fail
ln -sf "$APP" "$HOME/Desktop/Worksheet Studio"
echo
echo "  All done! Open \"Worksheet Studio\" from the Desktop or from Applications."
echo
read -r -p "  Press Enter to close."
