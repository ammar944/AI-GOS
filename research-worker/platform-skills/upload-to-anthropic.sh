#!/usr/bin/env bash
set -euo pipefail

# Upload AI-GOS Platform Skills to Anthropic when the Skills Management API is enabled
# for the active workspace/key. This script does not print the API key.

: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$ROOT/anthropic-upload-manifest.json"
TMP="$ROOT/.upload-results.tmp"
: > "$TMP"

echo '{"skills":{' > "$OUT"
first=1
for dir in "$ROOT"/ai-gos-*; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  echo "Uploading $name..." >&2
  response="$(curl -sS -X POST "https://api.anthropic.com/v1/skills" \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: skills-2025-10-02" \
    -F "display_title=${name}" \
    -F "files[]=@${dir}/SKILL.md;filename=${name}/SKILL.md" \
    -F "files[]=@${dir}/references/evidence-standards.md;filename=${name}/references/evidence-standards.md")"
  if [ "$first" -eq 0 ]; then echo ',' >> "$OUT"; fi
  first=0
  python3 - "$name" "$response" >> "$OUT" <<'PY'
import json, sys
name, raw = sys.argv[1], sys.argv[2]
try:
    data = json.loads(raw)
except Exception:
    data = {"raw": raw}
print(json.dumps(name) + ':' + json.dumps(data, indent=2))
PY
done
echo '}}' >> "$OUT"
echo "Wrote $OUT" >&2
