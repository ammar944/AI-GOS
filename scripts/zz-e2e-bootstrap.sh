#!/usr/bin/env bash
# zz-e2e-bootstrap.sh — launch a persistent-profile CDP Chrome for E2E driving.
# Pairs with scripts/zz-e2e-clerk-signin.mjs (auto sign-in via Clerk ticket).
# Usage:  node scripts/zz-e2e-preflight.mjs            # CDP DOWN
#         bash scripts/zz-e2e-bootstrap.sh             # launch Chrome on :9223
#         E2E_CDP_URL=http://localhost:9223 node scripts/zz-e2e-clerk-signin.mjs
set -euo pipefail
PORT="${E2E_CDP_PORT:-9223}"
PROFILE="${E2E_CHROME_PROFILE:-$PWD/tmp/e2e-chrome-profile}"
CHROME="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p "$PROFILE"
echo "[bootstrap] launching Chrome CDP on :$PORT profile=$PROFILE"
exec "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run --no-default-browser-check \
  --disable-background-timer-throttling \
  --headless=new \
  about:blank
