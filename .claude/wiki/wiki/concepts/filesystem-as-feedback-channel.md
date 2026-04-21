# Filesystem as feedback channel

The agent's filesystem access to prior runs' **source + execution traces + scores** is the richest feedback channel available. Lee et al. (2026) show that giving a proposer unstructured filesystem access beats anticipating what feedback it "needs" and compressing accordingly.

## The ablation

Meta-Harness compared three feedback configurations:

| Feedback given to proposer | Median final-score |
|---|---|
| Source code only | 34.6 |
| Source + scores | 34.9 |
| Source + scores + **execution traces** | **50.0** |

Execution traces — raw, unsummarized per-iteration records of what the harness actually did — are what closed the gap. Not summaries. Not scalar scores. The full trace.

Proposer reads median **82 files per iteration**: 41% source, 40% traces, 19% scores. It chooses.

## Why compression fails

Prior code-search methods (OpenEvolve, GEPA) compressed the feedback:

- OpenEvolve: scalar scores + structured program database, 4-22K tokens/iter
- GEPA: fixed per-candidate critique format, 2-8K tokens/iter
- Meta-Harness: **unbounded filesystem access, 10M tokens/iter**

The compression forces the system designer to guess what information the proposer will want — 8 months before running the experiment. The proposer needs to **diagnose a causal chain** ("iteration 5's regression was caused by confounding prompt edits, not the structural change") which can require any part of any prior trace. Pre-compressed feedback destroys the signal.

## Application to AIGOS

We already have fragments of a filesystem feedback channel:

- `.claude/wiki/log.md` — append-only ingest/lint history
- `.claude/rules/learned-patterns.md` — distilled lessons ("when X happens, do Y")
- `~/.claude/projects/-Users-ammar-Dev-Projects-AI-GOS/memory/` — session summaries

What we have is **summaries**. What the paper says matters most is **raw traces**. Gap: when we learn a pattern, we capture the lesson but not the transcript that surfaced it. A future session cannot re-derive the causal chain.

Realistic delta: enrich `learned-patterns.md` entries with a session-transcript pointer (which session exposed this, so an agent can `mcp__session_info__read_transcript` when needed). Don't try to store full traces in-repo; do store retrievable links.

See the 2026-04-20 synthesis report for the proposed surgical change.

## Sources
- [[raw/meta-harness-lee-2026.pdf]] — Section 3.3, Table 6 (ablation)
- [[wiki/sources/meta-harness-lee-2026.md]]

## Related
- [[wiki/concepts/harness-engineering.md]]
- [[wiki/techniques/harness-search-loop.md]]
