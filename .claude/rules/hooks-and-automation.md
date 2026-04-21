# Hooks & Automation Patterns

## Active Hooks (settings.json)

| Hook | Trigger | What It Does |
|------|---------|--------------|
| TypeScript Check | PostToolUse (Write/Edit) | Runs `tsc --noEmit` after every file change |
| Prettier Format | PostToolUse (Edit/Write) | Auto-formats .ts/.tsx/.js/.jsx files |
| Dev Server Blocker | PreToolUse (Bash) | Warns if `npm run dev` is run outside tmux |

## Memory Persistence

Session summaries are handled automatically by the `auto-memory-hook` (see `settings.json` SessionStart + Stop hooks). Memory lives at `~/.claude/projects/-Users-ammar-Dev-Projects-AI-GOS/memory/` and is indexed through `MEMORY.md`. Do not write ad-hoc session files to `.claude/memory/` — that directory is deprecated and does not exist.

For durable cross-session knowledge that isn't conversation-scoped (architecture, concepts, third-party material), use the wiki: `.claude/wiki/`. See `.claude/wiki/CLAUDE.md`.

## Continuous Learning Pattern

When Claude discovers a non-obvious solution (a bug fix that required understanding architecture, an API pattern that works better than the docs suggest), convert it into a rule:

1. Add a one-liner to `.claude/rules/learned-patterns.md`
2. Keep it factual: "When X happens, do Y because Z"
3. Prune monthly — if a pattern hasn't been useful in 4 weeks, remove it

## tmux for Long-Running Tasks

```bash
# Start dev server in background
tmux new-session -d -s dev "cd ~/projects/AI-GOS && npm run dev"

# Start test watcher in background
tmux new-session -d -s tests "cd ~/projects/AI-GOS && npm test"

# Check on them
tmux attach -t dev
tmux attach -t tests
```

## Bypass-permissions policy (Karpathy-style auto-loops)

Claude Code supports `--dangerously-skip-permissions` (alias: `claude --yolo`). Used right, it removes the permission-dialog friction that kills auto-research loops. Used wrong, it is how you destroy a repo.

### Safe to run with bypass-permissions

These operations are additive, reversible, or sandboxed. Run them in bypass mode to let the agent loop freely.

| Loop | Why safe |
|------|----------|
| Wiki ingest (`ingest raw/*` → writes into `.claude/wiki/wiki/`) | Only writes into a wiki dir, never touches source |
| Wiki lint / health-check | Reports, doesn't auto-fix source |
| Auto-research on a sandboxed training repo (e.g. nanochat in a worktree) | Sandboxed to the experiment dir |
| Reading/grepping source to answer a question | Read-only |
| Running tests (`npm run test:run`) | Read-only re: source |
| Running `npm run build` | Read-only re: source |

### NOT safe with bypass-permissions

These edit production source or can trigger deploys. Always keep permission-gated.

- Edits to `src/**` or `research-worker/src/**` outside an isolated worktree
- Edits to `.env*` files — never, under any circumstance
- `git push`, `railway up`, `vercel deploy`
- Deleting files (even "orphans") without explicit `y` from the user
- Schema migrations, Supabase writes
- `rm -rf` of anything

### Recommended setup

1. Run the main Claude Code session with permissions ON for source work.
2. For wiki ingest / lint / auto-research: start a second terminal in a worktree:
   ```bash
   git worktree add .claude/worktrees/wiki-ingest
   cd .claude/worktrees/wiki-ingest
   claude --dangerously-skip-permissions
   ```
3. Tell that session: "only touch `.claude/wiki/`. Never edit `src/` or `research-worker/src/`."
4. If it tries to edit source, kill it.

This gives you the Karpathy "hit go and walk away" loop for knowledge work, without risking your codebase.
