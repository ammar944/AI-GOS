# Wiki Operation Log

Append-only. One line per operation. Format: `YYYY-MM-DD HH:MM op: detail`

2026-04-20 initial: wiki scaffold installed per Karpathy pattern
2026-04-20 seed: raw/herk-llm-wiki-transcript.md + raw/karpathy-noam-no-priors-transcript.md added — pending ingest

2026-04-20 system-update: added taxonomy.md, retrieval-rules.md, review-queue.md.
  Rewrote CLAUDE.md to install Simon Says's triage gate (yes/no/review + full/synthesis_only) and explicit retrieval order on top of the Karpathy/Herk base. Raw/ and existing wiki/ subdirs unchanged.

2026-04-20 ingest: raw/herk-llm-wiki-transcript.md — domain=Learning & Research intent=research,planning worth=yes tier=full → 1 source note + contributed to 6 synthesis pages (llm-wiki, wiki-lint-loop, obsidian, claude-code, nate-herk, karpathy)
2026-04-20 ingest: raw/karpathy-noam-no-priors-transcript.md — domain=Learning & Research intent=research,reflection worth=yes tier=full → 1 source note + contributed to 12 synthesis pages (auto-research, token-throughput, jaggedness, cognitive-core, markdown-for-agents, skill-issue, multi-agent-parallel, claude-code, codex, karpathy, peter-steinberg, llm-wiki)
2026-04-20 totals: 17 pages created (2 sources, 7 concepts, 3 entities, 3 tools, 2 techniques), 0 enriched (empty wiki)
2026-04-20 archive: moved raw/simon-batch-pipeline/ to .claude/archive/simon-batch-pipeline/ — Python batch tool for ChatGPT-export ingest, not used in this repo

2026-04-20 ingest: raw/meta-harness-lee-2026.pdf — domain=Code & AI, intent=research, worth=yes, tier=full → 5 new pages, 0 enriched (source note meta-harness-lee-2026; concepts harness-engineering, filesystem-as-feedback-channel, additive-over-mutation; technique harness-search-loop). Triggered synthesis-to-rules updates: see learned-patterns.md 2026-04-20 entries.
