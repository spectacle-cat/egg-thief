#!/bin/bash
# Screenshot the running dev server (http://127.0.0.1:5183) with headless Chromium on software rendering
# (it never touches the real GPU), and print what the page logged.
# Usage: tools/shot.sh "<query>" <out.png> [width] [height] [virtual-ms]
#   tools/shot.sh "skip=1&view=tilt&at=27,24" .shots/dunes.png
cd "$(dirname "$0")/.."
Q="$1"; OUT="${2:-.shots/shot.png}"; W="${3:-1280}"; H="${4:-720}"; WAIT="${5:-6000}"
mkdir -p "$(dirname "$OUT")"
LOG=$(mktemp)
timeout 120 chromium --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --hide-scrollbars --mute-audio --window-size="$W,$H" --virtual-time-budget="$WAIT" \
  --enable-logging=stderr --v=0 --screenshot="$OUT" "http://127.0.0.1:5183/?mute=1&$Q" >/dev/null 2>"$LOG"
echo "screenshot: $OUT"
grep -E "CONSOLE|Uncaught" "$LOG" | grep -viE "GPU stall|swiftshader|WebGL-|ReadPixels|fallback|vite\] conn" | sed -E 's/^.*CONSOLE\([0-9]+\)\] ?//' | head -30
rm -f "$LOG"
