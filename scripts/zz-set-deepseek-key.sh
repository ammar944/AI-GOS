#!/usr/bin/env bash
# zz-set-deepseek-key.sh — replace DEEPSEEK_API_KEY in .env.local (and, with
# --prod, in Vercel production + redeploy). DeepSeek runs in-process on Vercel
# and locally; it is NOT used by the Railway worker, so this script deliberately
# skips Railway (that's why the everywhere-script reports a false FAIL here).
# The secret value is never echoed; verification prints presence only.
#
# Run via the `!` prefix (agents may not modify .env files / mutate prod):
#   !bash scripts/zz-set-deepseek-key.sh sk-your-new-key            # .env.local only (local grill)
#   !bash scripts/zz-set-deepseek-key.sh sk-your-new-key --prod     # + Vercel prod + redeploy
set -uo pipefail

VAR=DEEPSEEK_API_KEY
KEY="${1:-}"
PROD=0
[ "${2:-}" = "--prod" ] && PROD=1

if [ -z "$KEY" ] || [ "$KEY" = "--prod" ]; then
  echo "Usage: bash scripts/zz-set-deepseek-key.sh <new-key> [--prod]"
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || { echo "FAIL: cannot cd to repo root"; exit 1; }
[ -f .env.local ] || { echo "FAIL: .env.local not found in $ROOT"; exit 1; }

# 1. .env.local — replace the existing line or append. Value written via printf
#    (a temp file copy survives any sed-special characters in the secret).
if grep -qE "^${VAR}=" .env.local; then
  grep -vE "^${VAR}=" .env.local > .env.local.tmp && mv .env.local.tmp .env.local
  echo "  .env.local: replaced ${VAR} (length ${#KEY}; value hidden)"
else
  echo "  .env.local: appended ${VAR} (length ${#KEY}; value hidden)"
fi
printf '%s=%s\n' "$VAR" "$KEY" >> .env.local

# 2. Vercel production (only with --prod) — remove then add, then redeploy so it
#    binds at build time. Pinned to the saaslaunch team scope.
if [ "$PROD" -eq 1 ]; then
  SCOPE=saaslaunch
  vercel env rm "$VAR" production --scope "$SCOPE" --yes >/dev/null 2>&1
  if printf '%s' "$KEY" | vercel env add "$VAR" production --scope "$SCOPE" >/dev/null 2>&1; then
    echo "  Vercel prod: set — redeploying so it binds…"
    LATEST="$(vercel ls ai-gos --scope "$SCOPE" 2>/dev/null | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | head -1)"
    if [ -n "$LATEST" ]; then vercel redeploy "$LATEST" --scope "$SCOPE" 2>&1 | tail -4; fi
  else
    echo "  FAIL: vercel env add — run 'vercel whoami' / 'vercel link' and retry"; exit 1
  fi
fi

unset KEY
echo ""
echo "── verification (presence only, value never printed) ──"
printf '  %-22s .env.local:%s\n' "$VAR" "$(grep -cE "^${VAR}=" .env.local)"
echo ""
echo "✓ DONE. Restart local dev to pick it up:  npm run dev"
echo "  Validate the key actually works (proves key + balance together):"
echo "    node scripts/zz-judge-run.mjs d838ed4e-7cc7-43ef-ad94-dea30abdb1c2 --provider deepseek"
