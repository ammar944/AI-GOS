# AFFiNE Setup for AI-GOS

This folder is the **AFFiNE import pack** for managing AI-GOS as a project operating system.

AFFiNE is the human-facing workspace: product map, architecture canvas, backlog, decisions, and agent run logs.

The Git repo remains the engineering source of truth. AFFiNE should link back to repo docs, plans, commits, and PRs — not replace them.

## Installed

AFFiNE Desktop is installed at:

```text
/Applications/AFFiNE.app
```

Open it with:

```bash
open -a AFFiNE
```

or:

```bash
scripts/open-aigos-affine.sh
```

## Import / Create Workspace

1. Open AFFiNE.
2. Create a local workspace named:

```text
AI-GOS Project OS
```

3. Import or copy these Markdown pages into the workspace, in order:

```text
docs/affine/pages/00-command-center.md
docs/affine/pages/01-product-map.md
docs/affine/pages/02-architecture-canvas.md
docs/affine/pages/03-data-model.md
docs/affine/pages/04-backlog-kanban.md
docs/affine/pages/05-agent-runs.md
docs/affine/pages/06-decisions.md
docs/affine/pages/07-dev-pipeline.md
```

4. Use `00 Command Center` as the homepage.

## Operating Model

```text
AFFiNE              = human/project operating system
Git repo docs       = engineering source of truth
.ai-flow/           = active agent run state
jflow               = unified AI execution pipeline
jcode/Codex         = implementation
Ollama              = review / critic / summarizer
Tests/build/git     = truth layer
```

## Daily Use

- Start in `00 Command Center`.
- Pick one `Now` task from `04 GTM Run Kanban`.
- Use `docs/affine/pages/04-backlog-kanban.md` as the canonical tracker.
- Open `docs/affine/gtm-run-kanban.html` for the static visual mirror.
- Convert exactly one Kanban card into one Codex session.
- Let the session implement, verify, review, and checkpoint only that card.
- Paste the final summary into `05 Agent Runs`.
- Record architectural/product decisions in `06 Decisions`.

## Do Not

- Do not make AFFiNE the only source of technical truth.
- Do not store secrets/API keys in AFFiNE pages.
- Do not let project-management docs drift from repo docs; link back to exact files/commits.
- Do not use AI to generate code without verification gates.
- Do not treat the HTML Kanban as source of truth; update the Markdown tracker first.
