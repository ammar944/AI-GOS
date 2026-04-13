# Spec: Keyword Runner — Fix Thin Results

## Problem

The keyword runner (`research-worker/src/runners/keywords.ts`) produces 4 keywords instead of 15+. Three root causes:

1. SpyFu tool called once for one competitor. Should query up to 3.
2. Primary phase produces narrative text instead of JSON — AI writes "Excellent — live SpyFu data retrieved..." instead of starting with `{`.
3. Fallback modes (repair/heuristic/rescue) have no SpyFu access, so they produce generic keywords from context only.

## Changes (all in research-worker/src/runners/keywords.ts)

### Fix 1: Allow multiple SpyFu calls

In `PRIMARY_SYSTEM_PROMPT` (around line 120), change:
```
"Use the spyfu tool once when it can add live keyword or competitor evidence"
```
to:
```
"Use the spyfu tool up to 3 times — once per competitor domain — to gather live keyword data. Query the top 2-3 competitors by relevance. More SpyFu data = better keyword coverage."
```

Also in the primary mode config (`getKeywordAttemptConfig`, around line 950), increase `maxToolIterations` or `maxSteps` if there is one, to allow 3+ tool calls instead of 1.

### Fix 2: Force JSON-first output in primary prompt

At the very TOP of `PRIMARY_SYSTEM_PROMPT` (before the current "TASK:" line), prepend:
```
CRITICAL: You MUST respond with valid JSON only. Start your response with { and end with }. No preamble, no commentary, no narrative text before or after the JSON. If you write anything other than JSON, the system will fail.
```

This matches the pattern already used in REPAIR and HEURISTIC prompts which work reliably.

### Fix 3: Add JSON-forcing user message

In the primary attempt execution (around line 1280-1290 where the streamText/generateText call is built), add a final user message to the messages array:
```
{ role: 'user', content: 'Now output the complete keyword intelligence JSON. Start with {' }
```

This nudge goes after the context/research messages and forces the AI to begin with JSON.

## Do NOT change

- The JSON schema (KEYWORDS_OUTPUT_FORMAT) — it's correct
- The repair/heuristic/rescue prompts — they already work
- The fallback chain logic — it's correct
- The SpyFu tool itself (research-worker/src/tools/spyfu.ts) — it's fine
- Any files outside research-worker/src/runners/keywords.ts

## Success criteria

After this fix, running the keyword runner should:
- Call SpyFu 2-3 times (visible in worker logs as multiple `[spyfu] GET` lines)
- Produce valid JSON on the primary attempt (no "JSON extraction failed" in logs)
- Return 15+ keywords across 3 campaign groups with real search volumes
