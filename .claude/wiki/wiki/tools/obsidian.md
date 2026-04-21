# Obsidian

Markdown-vault IDE. Renders `[[wiki-links]]` natively, visualises graphs of connected notes, indexes headers. Karpathy's choice for the LLM-wiki pattern.

## Why it's relevant

- The LLM wiki in this repo uses `[[wiki/...]]` backlinks specifically because Obsidian renders them.
- Obsidian graph view is the "zoom out and see the clusters" visualization Herk shows in his walkthrough (each dot = a note, lines = backlinks).
- The vault is just markdown files, so Obsidian is optional — VS Code + a markdown preview works equally well. Obsidian is preferred only for the graph view.

## If you want the graph view

Point Obsidian at `.claude/wiki/` as the vault root. Enable:

- Graph view (core plugin, on by default).
- Backlinks panel (core plugin).
- Outgoing links (core plugin).

Do NOT enable Obsidian Sync or Obsidian Publish — that would push private project content to Obsidian's servers.

## What it's NOT for

- Editing ingested raw files (`raw/` is immutable).
- Auto-generating wiki pages — that's the LLM's job.
- Querying the wiki from code — use the retrieval order in `.claude/wiki/retrieval-rules.md`.

## Alternative

You can read the wiki directly from the filesystem. Obsidian just makes the graph pretty.

## Sources

- [[raw/herk-llm-wiki-transcript.md]]

## Related

- [[wiki/sources/herk-llm-wiki-transcript.md]]
- [[wiki/concepts/llm-wiki.md]]
- [[wiki/concepts/markdown-for-agents.md]]
