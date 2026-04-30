# Egoos AI Agent Upgrade — Claude Code Orchestration Guide

## How to Use These Sprint Prompts

Each sprint is a self-contained Claude Code prompt. Run them in order (Sprint 1 → 2 → 3 → 4).

### Execution Workflow Per Sprint

```
1. Open Claude Code in the AI-GOS repo root
2. Run: claude --permission-mode plan
3. Paste the sprint prompt
4. Review the plan Claude generates
5. Approve → Claude exits plan mode and executes
6. Verify: npm run build && npm run test:run
7. Commit the sprint's changes
8. Move to next sprint
```

### Parallel Subagent Strategy

Each sprint prompt instructs Claude to use **parallel subagents** for independent work. The pattern:

```
Main Agent (Orchestrator)
├── Subagent A (worktree) → Layout/structure changes
├── Subagent B (worktree) → Component creation
├── Subagent C (worktree) → Backend/route changes
└── Main Agent → Integration, verification, cleanup
```

**Why worktrees?** Each subagent gets an isolated copy of the repo. No merge conflicts between parallel agents. Changes are merged back by the orchestrator.

### Key Rules for All Sprints

1. **Always read CLAUDE.md first** — it has project conventions
2. **Use `@file` references** — Claude reads exact files, not guessing
3. **Think hard** on architectural decisions — triggers extended reasoning
4. **Run tests after each subagent completes** — catch issues early
5. **Commit after each sprint** — clean git history per feature batch

### Reference Files (Read These Before Any Sprint)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project conventions, commands, architecture |
| `.claude/sprints/ORCHESTRATION-GUIDE.md` | This file |
| `EGOOS-AGENT-UI-SPEC.md` | Complete UI/UX specification |
| `EGOOS-CHAT-AGENT-V2.html` | Working HTML preview of target UI |
| `AGENT-UPGRADE-PLAN.md` | Full upgrade plan with architecture diagrams |

### Design Token Reference

All colors, typography, spacing, shadows, and animation values are documented in the HTML preview and UI spec. The existing design system in `src/app/globals.css` already has most tokens — new components should use the same CSS variables.

---

## Sprint Dependencies

```
Sprint 1 (Foundation) ← No dependencies, start here
    │
    ▼
Sprint 2 (Core Tools) ← Depends on Sprint 1 layout + route changes
    │
    ▼
Sprint 3 (Polish) ← Depends on Sprint 2 tool cards
    │
    ▼
Sprint 4 (Differentiation) ← Depends on Sprint 3 persistence
```
