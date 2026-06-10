#!/usr/bin/env bash
# zz-set-railway-perplexity.sh — point the Railway worker's PERPLEXITY_API_KEY at
# the FUNDED key from local .env.local, so prod corpus stops 429-ing.
#
# The value is read from .env.local and handed to `railway`; it is NEVER printed
# to output and NOT written to shell history (passed via a shell variable).
# Caveat: it appears transiently in THIS machine's process list while `railway`
# runs (local-only, a couple seconds). For zero exposure, use the Railway
# dashboard instead (research-worker → Variables → PERPLEXITY_API_KEY).
#
# Run:  bash scripts/zz-set-railway-perplexity.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1

VAL="$(grep -E '^PERPLEXITY_API_KEY=' .env.local | head -1 \
  | sed -E 's/^PERPLEXITY_API_KEY=//; s/^["'"'"']//; s/["'"'"']$//')"
if [ -z "$VAL" ]; then echo "FAIL: PERPLEXITY_API_KEY not found in .env.local"; exit 1; fi
echo "✓ Loaded funded PERPLEXITY_API_KEY from .env.local (length ${#VAL}; value hidden)"

( cd research-worker && railway variables --set "PERPLEXITY_API_KEY=$VAL" )
rc=$?
unset VAL
if [ $rc -ne 0 ]; then echo "FAIL: 'railway variables --set' exited $rc"; exit $rc; fi

echo "✓ Set PERPLEXITY_API_KEY on Railway (aigos-research-worker / production)."
echo "  Railway redeploys the worker automatically on a variable change."
echo "  Verify: bash scripts/zz-cmp-perplexity-key.sh  → fingerprints should now MATCH."
