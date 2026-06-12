#!/usr/bin/env bash
# zz-recover-key-from-vercel.sh — copy an env var's VALUE from Vercel
# (production) into .env.local without ever printing it. For keys that live
# in the cloud but were never in the local file (2026-06-11: SPYFU_API_KEY
# had sat in Vercel for 121 days while local dev ran keyless).
#
# Run via the `!` prefix (agents may not modify .env files):
#   !bash scripts/zz-recover-key-from-vercel.sh SPYFU_API_KEY [MORE_VARS...]
set -uo pipefail

SCOPE=saaslaunch
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || { echo "FAIL: cannot cd to repo root"; exit 1; }

if [ "$#" -lt 1 ]; then
  echo "Usage: bash scripts/zz-recover-key-from-vercel.sh VAR [VAR ...]"
  exit 2
fi
if [ ! -f .env.local ]; then echo "FAIL: .env.local not found in $ROOT"; exit 1; fi

TMP="$(mktemp /tmp/.vercel-env.XXXXXX)"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

echo "→ Pulling production env from Vercel (values stay in a temp file)…"
if ! vercel env pull "$TMP" --environment=production --scope "$SCOPE" --yes >/dev/null 2>&1; then
  echo "FAIL: vercel env pull — run 'vercel whoami' / 'vercel link' and retry"
  exit 1
fi

FAILED=0
for VAR in "$@"; do
  VAL="$(grep -E "^${VAR}=" "$TMP" | head -1 | sed -E "s/^${VAR}=[\"']?//; s/[\"']?$//")"
  if [ -z "$VAL" ]; then
    echo "✗ ${VAR}: not found in Vercel production env"
    FAILED=1
    continue
  fi

  if grep -qE "^${VAR}=" .env.local; then
    grep -vE "^${VAR}=" .env.local > .env.local.tmp
    mv .env.local.tmp .env.local
    echo "✓ ${VAR}: replaced in .env.local (length ${#VAL}; value hidden)"
  else
    echo "✓ ${VAR}: appended to .env.local (length ${#VAL}; value hidden)"
  fi
  printf '%s=%s\n' "$VAR" "$VAL" >> .env.local
  unset VAL
done

echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "✗ Some vars missing from Vercel — get those from the provider dashboard"
  echo "  and set them with: bash scripts/zz-set-env-everywhere.sh VAR=VALUE"
fi
echo "✓ DONE. Restart local processes to pick up .env.local:"
echo "    Terminal 1: npm run dev"
echo "    Terminal 2: cd research-worker && npm run dev"
echo "  Then verify SpyFu with one cheap call: npx tsx scripts/zz-spyfu-diag.ts"
