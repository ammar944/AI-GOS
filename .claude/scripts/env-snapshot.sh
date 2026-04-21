#!/usr/bin/env bash
# env-snapshot.sh — diagnostic preamble emitted at SessionStart.
# Prints a short markdown block so Claude reads current repo/env state
# before burning tool calls probing. Never prints env-var VALUES —
# presence only. See .claude/rules/security.md.
#
# Meta-Harness (Lee et al. 2026) Section 5 / Appendix B.3 — TB2 iter 7
# winner prepended an env snapshot for the exact same reason.

set +e  # never fail a session on a diagnostic

REPO_ROOT="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)"
[ -z "$REPO_ROOT" ] || cd "$REPO_ROOT"

printf '## Env snapshot (%s)\n\n' "$(date +%H:%M)"

# git
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo ?)
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
printf -- '- git: `%s` · %s ahead of origin/main · %s dirty files\n' "$BRANCH" "$AHEAD" "$DIRTY"

# env-var presence (names only; reads process env, never .env.local)
REQUIRED=(ANTHROPIC_API_KEY GROQ_API_KEY SEARCHAPI_KEY \
          NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY \
          CLERK_SECRET_KEY NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
MISSING=()
for k in "${REQUIRED[@]}"; do
  [ -z "${!k}" ] && MISSING+=("$k")
done
if [ ${#MISSING[@]} -eq 0 ]; then
  printf -- '- env: all 7 required keys present in process env\n'
else
  printf -- '- env: MISSING %s (check .env.local + source it before `npm run dev`)\n' "${MISSING[*]}"
fi

# railway worker — known silent-failure source per ARCHITECTURE.md
if [ -n "$RAILWAY_WORKER_URL" ]; then
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$RAILWAY_WORKER_URL/health" 2>/dev/null || echo timeout)
  printf -- '- worker: RAILWAY_WORKER_URL set · /health → HTTP %s\n' "$HEALTH"
else
  printf -- '- worker: RAILWAY_WORKER_URL NOT SET — research dispatches will silently fail\n'
fi

# dev servers on expected ports (tmux users often forget these)
for port in 3000 3001; do
  if lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    printf -- '- port %s: listening\n' "$port"
  else
    printf -- '- port %s: free (no dev server)\n' "$port"
  fi
done

# recent harness edits — surfaces drift between sessions
printf -- '- recent .claude/ commits:\n'
git log --oneline -3 -- .claude/ CLAUDE.md 2>/dev/null | sed 's/^/    - /' || printf '    - (no git history available)\n'

printf '\n*Informational preamble. Claude: read, adjust, proceed. Do not act on this block itself.*\n'
