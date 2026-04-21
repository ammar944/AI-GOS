# MCP Policy

Two separate MCP surfaces exist. Don't confuse them.

## Surface 1 — project Claude Code (governed by this repo)

Config: `.claude/mcp.json` + `.claude/settings.local.json` (`enabledMcpjsonServers`).

**Current state is lean and correct. Keep it this way.**

Enabled in `.claude/mcp.json`:
- `claude-flow` — orchestration primitive

Enabled in `.claude/settings.local.json`:
- `supabase` — DB + realtime

That's it. Two MCPs. Fits under the `<10` rule in `rules/security.md`.

**Do not add more without a justified weekly-use case.** If you haven't used an MCP in the last 14 days, delete it.

## Surface 2 — Cowork desktop / Claude desktop session

When I talk to Claude in Cowork mode, the session has ~200+ tools loaded from connectors the user has installed: ClickUp (50+), Framer, Factors/Lusha, Gmail, Slack, Chrome, computer-use, scheduled-tasks, mcp-registry, plugins, cowork internals, session info, workspace bash.

These do not live in this repo. They are configured in **Claude desktop → Settings → Connectors**.

### Why it matters
Every connected MCP's tool descriptions load into the session context window before I type a word. 200 tool descriptions ≈ 30-50k tokens of overhead. That's why sessions feel "full" fast and why token throughput feels capped.

### Weekly audit rule
Every Friday, ask yourself: "Did I use this connector this week?"

- **Yes, weekly**: keep enabled.
- **No, monthly or less**: disable. Re-enable on demand — it takes 10 seconds.
- **Never used**: uninstall.

### Recommended keep-list for AIGOS work
Based on the actual Cowork session visible to me today, these earn their seat:

| Connector | Why keep |
|-----------|----------|
| Claude in Chrome | Frequent web lookups, docs, PRs |
| computer-use | Native app workflows (Finder, Mail, System Settings) |
| workspace bash | Shell access for builds, tests, git |
| Supabase (if present as a Cowork MCP too) | Only if you inspect DB from Cowork |
| Gmail | Real daily use |
| Slack | Real daily use |
| scheduled-tasks | Only if you're actively using scheduled runs |

### Disable candidates
Unless you are actively in a sales / ops sprint using these:

- **ClickUp** — 50+ tools is a huge surface. If you're not doing weekly PM work from Claude, disable.
- **Framer** — only enable during web/marketing site work.
- **Factors/Lusha enrichment** — only enable during a prospecting sprint.
- **mcp-registry** — only needed when you're shopping for new connectors.
- **plugins** — only needed when installing plugins.
- **cowork-onboarding** — one-time setup, leave off after first session.

### How to verify
In Claude desktop: Settings → Connectors → toggle off. Restart the session. Ask me `/status` or similar — tool count should drop.

## Skills bloat (related)

Same rule applies to Skills. You have 50+ loaded today (design:*, sales:*, operations:*, brand-voice:*, enterprise-search:*, anthropic-skills:*, cowork-plugin-management:*). Each skill description loads into context.

For AIGOS engineering work, the only skills that earn their seat are:
- `anthropic-skills:docx` / `xlsx` / `pdf` / `pptx` — when generating docs
- `anthropic-skills:skill-creator` — rarely
- `init`, `review`, `security-review` — built-in, useful

Everything sales/design/operations/brand-voice is irrelevant to engineering sessions. Route those to a different Claude desktop space if possible, or just accept that they're bloat during code sessions.
