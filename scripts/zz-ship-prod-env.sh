#!/usr/bin/env bash
# zz-ship-prod-env.sh — ensure every REQUIRED prod env var is present in
# Vercel, pulling values from .env.local WITHOUT printing them, then redeploy
# production once so new vars bind at build time.
#
# Required keys (the lab engine runs IN-PROCESS on Vercel, so research tools
# credential-gap without them):
#   BRAVE_SEARCH_API_KEY   — web_search
#   PERPLEXITY_API_KEY     — perplexity_research (VoC/Buyer prepasses + agent)
#
# Run from anywhere in the repo, via the `!` prefix so it executes in YOUR
# session (Vercel prod-mutating commands are blocked in the agent sandbox):
#   !bash scripts/zz-ship-prod-env.sh
#
# Idempotent: keys already present in Production are skipped; the redeploy
# only fires when at least one key was added. Secret values flow
# file -> stdin -> vercel and are never echoed.
set -uo pipefail

REQUIRED_KEYS=(BRAVE_SEARCH_API_KEY PERPLEXITY_API_KEY)
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || { echo "FAIL: cannot cd to repo root"; exit 1; }

if [ ! -f .env.local ]; then echo "FAIL: .env.local not found in $ROOT"; exit 1; fi

SCOPE=saaslaunch   # team slug — project lives under saaslaunch/ai-gos (pin so
                   # an accidental scope switch from `vercel login` can't break it)

PROD_ENV_LIST="$(vercel env ls production --scope "$SCOPE" 2>/dev/null)"
ADDED=0
FAILED=0

for VAR in "${REQUIRED_KEYS[@]}"; do
  if printf '%s' "$PROD_ENV_LIST" | grep -q "$VAR"; then
    echo "✓ ${VAR} already present in Production env — skipping add."
    continue
  fi

  VAL="$(grep -E "^${VAR}=" .env.local | head -1 | sed -E "s/^${VAR}=[\"']?//; s/[\"']?$//")"
  if [ -z "$VAL" ]; then
    echo "FAIL: ${VAR} not in prod and not present/empty in .env.local."
    echo "      Add it to .env.local first, or run: vercel env add ${VAR} production --scope ${SCOPE}"
    FAILED=1
    continue
  fi

  echo "✓ Loaded ${VAR} from .env.local (length ${#VAL}; value hidden)"
  if printf '%s' "$VAL" | vercel env add "$VAR" production --scope "$SCOPE"; then
    echo "✓ ${VAR} added to Production"
    ADDED=$((ADDED + 1))
  else
    echo "FAIL: vercel env add ${VAR} failed"
    FAILED=1
  fi
  unset VAL
done

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "✗ One or more keys could not be added — fix the failures above, then rerun."
  exit 1
fi

if [ "$ADDED" -eq 0 ]; then
  echo ""
  echo "✓ DONE. All required keys already present — no redeploy needed."
  exit 0
fi

# Redeploy the latest prod deployment so new vars bind at build time.
echo "→ Detecting latest production deployment…"
LATEST="$(vercel ls ai-gos --scope "$SCOPE" 2>/dev/null | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | head -1)"
if [ -n "$LATEST" ]; then
  echo "→ Redeploying $LATEST …"
  vercel redeploy "$LATEST" --scope "$SCOPE" 2>&1 | tail -15
else
  echo "→ Could not detect latest deployment; running a fresh prod deploy…"
  vercel deploy --prod --yes --scope "$SCOPE" 2>&1 | tail -15
fi

echo ""
echo "✓ DONE. ${ADDED} key(s) added + redeploy triggered."
echo "  Now tell Claude to verify: 'vercel env ls' shows every required key,"
echo "  and the new deployment is Ready. Functional proof = a live prod run."
