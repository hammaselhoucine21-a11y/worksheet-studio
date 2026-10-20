#!/bin/bash
# Starts Worksheet Studio on a Mac and opens it in the browser.
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
nohup node scripts/serve.mjs --open > /dev/null 2>&1 &
sleep 1
osascript -e 'tell application "Terminal" to close (every window whose name contains "start.command")' > /dev/null 2>&1 &
