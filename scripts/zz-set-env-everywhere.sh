#!/usr/bin/env bash
# zz-set-env-everywhere.sh — set/rotate env vars across ALL THREE runtimes:
#   1. .env.local        (local dev — Next.js + CLI scripts)
#   2. Vercel production (lab engine runs IN-PROCESS on Vercel; vars bind at
#      build time, so one redeploy fires at the end when anything changed)
#   3. Railway worker    (research-worker; Railway auto-redeploys on var change)
#
# Usage (run via the `!` prefix — Vercel/Railway prod-mutating commands are
# blocked in the agent sandbox, and agents may not modify .env files):
#   !bash scripts/zz-set-env-everywhere.sh FIRECRAWL_API_KEY=fc-xxxx [VAR=VALUE ...]
#
# Rotation-safe: an existing Vercel value is removed then re-added (the
# ship-prod-env script skips present keys; this one OVERWRITES — that is the
# point of a rotation). Secret values flow arg -> stdin -> CLI and are never
# echoed; verification prints presence/length only.
set -uo pipefail

SCOPE=saaslaunch   # team slug — pin so an accidental `vercel login` scope
                   # switch can't land keys in the wrong team
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || { echo "FAIL: cannot cd to repo root"; exit 1; }

if [ "$#" -lt 1 ]; then
  echo "Usage: bash scripts/zz-set-env-everywhere.sh VAR=VALUE [VAR=VALUE ...]"
  exit 2
fi
if [ ! -f .env.local ]; then echo "FAIL: .env.local not found in $ROOT"; exit 1; fi

CHANGED=0
FAILED=0

for PAIR in "$@"; do
  VAR="${PAIR%%=*}"
  VAL="${PAIR#*=}"
  if [ -z "$VAR" ] || [ -z "$VAL" ] || [ "$VAR" = "$PAIR" ]; then
    echo "FAIL: argument must be VAR=VALUE (got: ${PAIR%%=*}=…)"
    FAILED=1
    continue
  fi

  echo "── ${VAR} (length ${#VAL}; value hidden) ──"

  # 1. .env.local — replace existing line or append (BSD sed; value via temp
  #    file to survive any sed-special characters in the secret).
  if grep -qE "^${VAR}=" .env.local; then
    grep -vE "^${VAR}=" .env.local > .env.local.tmp
    mv .env.local.tmp .env.local
    echo "  .env.local: replaced existing ${VAR}"
  else
    echo "  .env.local: appended ${VAR}"
  fi
  printf '%s=%s\n' "$VAR" "$VAL" >> .env.local

  # 2. Vercel production — remove (ignore absence) then add fresh.
  vercel env rm "$VAR" production --scope "$SCOPE" --yes >/dev/null 2>&1
  if printf '%s' "$VAL" | vercel env add "$VAR" production --scope "$SCOPE" >/dev/null 2>&1; then
    echo "  Vercel production: set"
    CHANGED=$((CHANGED + 1))
  else
    echo "  FAIL: vercel env add ${VAR} — run 'vercel whoami' / 'vercel link' and retry"
    FAILED=1
  fi

  # 3. Railway worker — requires research-worker to be railway-linked.
  if (cd research-worker && railway variables --set "${VAR}=${VAL}" >/dev/null 2>&1); then
    echo "  Railway worker: set (Railway restarts the service automatically)"
  else
    echo "  FAIL: railway variables --set ${VAR} — run 'cd research-worker && railway link' and retry"
    FAILED=1
  fi

  unset VAL
done

echo ""
echo "── verification (presence only, values never printed) ──"
for PAIR in "$@"; do
  VAR="${PAIR%%=*}"
  printf '  %-24s .env.local:%s  vercel-prod:%s  railway:%s\n' "$VAR" \
    "$(grep -cE "^${VAR}=" .env.local)" \
    "$(vercel env ls production --scope "$SCOPE" 2>/dev/null | grep -c "$VAR")" \
    "$(cd research-worker && railway variables --json 2>/dev/null | grep -c "\"${VAR}\"")"
done

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "✗ One or more targets failed — fix above and rerun (idempotent)."
  exit 1
fi

# Vercel env binds at BUILD time — one redeploy of the latest prod deployment.
if [ "$CHANGED" -gt 0 ]; then
  echo ""
  echo "→ Redeploying production so the new value binds…"
  LATEST="$(vercel ls ai-gos --scope "$SCOPE" 2>/dev/null | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | head -1)"
  if [ -n "$LATEST" ]; then
    vercel redeploy "$LATEST" --scope "$SCOPE" 2>&1 | tail -8
  else
    echo "  Could not detect latest deployment; running fresh prod deploy…"
    vercel deploy --prod --yes --scope "$SCOPE" 2>&1 | tail -8
  fi
fi

echo ""
echo "✓ DONE. Restart local processes to pick up .env.local:"
echo "    Terminal 1: npm run dev"
echo "    Terminal 2: cd research-worker && npm run dev"
