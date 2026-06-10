#!/usr/bin/env bash
# zz-cmp-perplexity-key.sh — READ-ONLY. Prints SHA-256 fingerprints (first 12
# hex) of the PERPLEXITY_API_KEY used by the LOCAL worker vs the RAILWAY worker,
# to prove whether prod and local use the SAME key or DIFFERENT keys.
# It prints ONLY hashes — never the key value. No writes, no deploys.
#   Run:  bash scripts/zz-cmp-perplexity-key.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1

fp() { # stdin -> first 12 hex of sha256, or MISSING if empty
  local v; v="$(cat)"; v="${v%$'\n'}"
  if [ -z "$v" ]; then echo "MISSING"; else printf '%s' "$v" | shasum -a 256 | cut -c1-12; fi
}

# --- local: first env file that defines the key (worker reads its own first) ---
LOCAL_FILE=""
for f in research-worker/.env.local research-worker/.env .env.local .env; do
  if [ -f "$f" ] && grep -qE '^PERPLEXITY_API_KEY=' "$f"; then LOCAL_FILE="$f"; break; fi
done
if [ -n "$LOCAL_FILE" ]; then
  LOCAL_FP="$(grep -E '^PERPLEXITY_API_KEY=' "$LOCAL_FILE" | head -1 \
    | sed -E 's/^PERPLEXITY_API_KEY=//; s/^["'"'"']//; s/["'"'"']$//' | fp)"
else
  LOCAL_FP="NOT_FOUND_IN_ENV_FILES"
fi

# --- railway: pull value via json and hash it (value never printed) ---
RAILWAY_FP="$( (cd research-worker && railway variables --json 2>/dev/null) | python3 -c "import json,sys,hashlib
try:
    v=json.load(sys.stdin).get('PERPLEXITY_API_KEY','')
    print(hashlib.sha256(v.encode()).hexdigest()[:12] if v else 'MISSING')
except Exception:
    print('ERR_READING_RAILWAY')" )"

echo "local   (${LOCAL_FILE:-none}): PERPLEXITY_API_KEY fingerprint = ${LOCAL_FP}"
echo "railway (aigos-research-worker)       : PERPLEXITY_API_KEY fingerprint = ${RAILWAY_FP}"
echo ""
if [ "$LOCAL_FP" = "$RAILWAY_FP" ] && [ "$LOCAL_FP" != "MISSING" ] && [ "$LOCAL_FP" != "NOT_FOUND_IN_ENV_FILES" ]; then
  echo "VERDICT: SAME key. The Perplexity account is globally out of quota —"
  echo "         a fresh local corpus run would 429 too right now. Fix = top up billing."
else
  echo "VERDICT: DIFFERENT keys. Prod (Railway) uses a separate Perplexity account"
  echo "         that's out of quota; your local key is funded. Fix = fund the Railway"
  echo "         account, or set Railway's PERPLEXITY_API_KEY to your funded local key."
fi
