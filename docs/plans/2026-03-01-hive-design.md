# Hive — Local Dev Command Center

> Design doc for Hive, a Tauri v2 desktop app that serves as a local dev command center across any project, powered by Claude Code on a Max subscription.

**Date:** 2026-03-01
**Status:** Approved
**Author:** Ammar + Claude

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Interaction model | Dashboard-first command center |
| Runtime | Local desktop app (Tauri v2) |
| App role | Smart app with Claude Code brain |
| Claude Code link | Claude Code CLI (Max subscription) |
| Architecture | App-Orchestrated (SQLite = source of truth) |
| Framework | Tauri v2 + React + TypeScript + Tailwind |
| MVP scope | All 6 channels from day one |
| Project scope | General workspace (multi-project) |
| Name | **Hive** |

## Reference: OpenClaw

Inspired by [OpenClaw](https://github.com/openclaw/openclaw) (140k stars) — a 24/7 personal AI agent with 13+ messaging channels, 5,400+ skills, device nodes, voice, cron scheduling, agent-to-agent coordination.

Hive takes the same always-on AI command center concept but:
1. Built on Claude Code (not raw API) — uses Max subscription
2. Developer-focused — dev workspace manager, not general assistant
3. Local-first with Tauri — not a Node.js gateway with messaging bridges
4. You own it — no dependency on someone else's framework

---

## Section 1: System Architecture

```
┌─────────────────────────────────────────────────┐
│                   HIVE (Tauri v2)                │
│                                                  │
│  ┌──────────────────┐   ┌────────────────────┐  │
│  │   React Frontend  │   │   Rust Backend     │  │
│  │                   │   │                    │  │
│  │  Dashboard UI     │◄─►│  Tauri Commands    │  │
│  │  Channel views    │IPC│  SQLite (rusqlite) │  │
│  │  Task board       │   │  Process Manager   │  │
│  │  Agent status     │   │  File Watcher      │  │
│  │  Chat input       │   │  Notification sys  │  │
│  └──────────────────┘   └────────┬───────────┘  │
│                                   │              │
└───────────────────────────────────┼──────────────┘
                                    │
                         spawn / capture output
                                    │
                          ┌─────────▼──────────┐
                          │   Claude Code CLI   │
                          │  (Max subscription) │
                          │                     │
                          │  --json output mode │
                          │  --session mgmt     │
                          │  --model selection  │
                          │  Full tool access   │
                          └─────────────────────┘
```

**Key pieces:**
- **React frontend** — dashboard UI, channels, tasks, chat. Uses shadcn/ui + Tailwind.
- **Rust backend** — Tauri commands that manage SQLite, spawn Claude Code processes, watch project directories, send native OS notifications.
- **Claude Code CLI** — spawned as child processes via Rust's `Command`. Uses `--json` flag for structured output. Each agent session is a separate process. All on Max subscription.
- **SQLite** — single source of truth. Channels, messages, tasks, agent sessions, project configs. All local, no cloud dependency.

---

## Section 2: Data Model (SQLite)

```sql
-- Multi-project support
projects
  id, name, path, created_at, updated_at

-- 6 channels per project (can add custom ones later)
channels
  id, project_id, slug, name, description, created_at
  -- slugs: brain-dump, bugs-blockers, dev-updates,
  --        pr-reviews, sprint-tracking, general

-- Every message in every channel
messages
  id, channel_id, role, content, metadata, created_at
  -- role: "user" | "claude" | "agent" | "system"
  -- metadata: JSON blob (agent_name, session_id, etc.)

-- Sprint and task tracking
sprints
  id, project_id, name, status, goal, created_at
  -- status: "active" | "completed" | "planned"

tasks
  id, sprint_id, subject, description, status,
  assigned_to, priority, created_at, updated_at
  -- status: "pending" | "in_progress" | "completed" | "blocked"
  -- assigned_to: "frontend" | "backend" | "qa" | null

-- Claude Code sessions (agent processes)
agent_sessions
  id, project_id, agent_type, status, model,
  started_at, ended_at, task_id, output_log
  -- agent_type: "frontend" | "backend" | "qa" | "researcher" | "general"
  -- status: "running" | "idle" | "completed" | "failed"

-- Key-value store for project-level settings, memory, etc.
project_settings
  id, project_id, key, value

-- Decision log (auto-extracted from brain dumps)
decisions
  id, project_id, decision, rationale, context, created_at

-- Learned patterns (auto-extracted from agent sessions)
learned_patterns
  id, project_id, pattern, created_at
  -- format: "When X happens, do Y because Z"
```

**Design choices:**
- `metadata` as JSON on messages gives flexibility
- Agent sessions tracked for real-time dashboard status
- One SQLite file per Hive installation (not per project)
- Sprints and tasks are first-class, not buried in channels
- FTS5 index on messages for full-text search

---

## Section 3: Frontend Layout & UI

```
┌──────────────────────────────────────────────────────────┐
│  Hive                              AI-GOS-v2  ▼    ─ □ x│
├────────┬─────────────────────────────────┬───────────────┤
│        │                                 │               │
│ PROJ   │  Activity Feed / Channel View   │  Status Panel │
│        │                                 │               │
│ AI-GOS │  ┌─────────────────────────┐    │  Sprint 1     │
│ Client │  │ [agent] QA passed build │    │  ████████░ 67%│
│ Side   │  │ [you] brain-dump: Left  │    │  12/18 tasks  │
│        │  │   off at middleware...  │    │               │
├────────┤  │ [bug] SSE mismatch #23 │    │  Agents       │
│        │  │ [deploy] v2.1 shipped  │    │  fe: idle     │
│ CHANS  │  │ [agent] Backend fixing │    │  be: ● running│
│        │  │   auth middleware...   │    │  qa: idle     │
│ #general│  └─────────────────────────┘    │  re: idle     │
│ #brain │                                 │               │
│ #bugs  │                                 │  Quick Actions│
│ #dev   │                                 │  [+ Brain Dump]│
│ #prs   │                                 │  [+ Bug]      │
│ #sprint│                                 │  [Spawn Agent]│
│        │                                 │               │
├────────┤  ┌─────────────────────────┐    │  Recent Files │
│        │  │ Type a message...    ⌘↵ │    │  app-shell.tsx│
│ AGENTS │  └─────────────────────────┘    │  route.ts     │
│ fe     │                                 │  generator.ts │
│ be ●   │                                 │               │
│ qa     │                                 │               │
│ re     │                                 │               │
└────────┴─────────────────────────────────┴───────────────┘
```

**Three-panel layout:**

**Left sidebar (240px, collapsible):**
- Project switcher at top (dropdown)
- Channel list with unread indicators
- Agent status indicators (colored dots)
- Clicking a channel filters the main panel
- Clicking an agent opens its session log

**Main panel (flex):**
- Feed mode (default) — unified activity stream
- Channel mode — filtered to one channel
- Input bar at bottom with smart routing

**Right panel (300px, collapsible):**
- Sprint progress bar and task count
- Agent status with uptime
- Quick action buttons
- Recently touched files

**Keyboard shortcuts:**
- `⌘K` — command palette
- `⌘1-6` — jump to channel
- `⌘↵` — send message
- `⌘N` — new brain dump
- `⌘B` — new bug report

**Design system:** shadcn/ui + Tailwind, dark mode default, zinc base.

---

## Section 4: Claude Code Integration

**Five types of Claude Code calls:**

| Type | When | Model | Max Turns | Example |
|------|------|-------|-----------|---------|
| Quick analysis | Brain dump categorization, bug triage | haiku | 3 | "Categorize this brain dump" |
| Research | Investigate codebase, answer questions | haiku | 10 | "What files handle auth?" |
| Agent task | Feature work, bug fixes, code review | sonnet | 25 | "Fix bug #23 in SSE handler" |
| Deep work | Architecture, multi-file refactors | opus | 50 | "Refactor auth middleware" |
| Chat | Free-form conversation in #general | sonnet | 15 | "What should I work on next?" |

**Smart routing — channel-based:**
- `#brain-dump` → Save + quick analysis (extract action items, decisions)
- `#bugs-blockers` → Save + research (find relevant files) + offer agent
- `#dev-updates` → Save (mostly auto-posted by agents and builds)
- `#pr-reviews` → Save + spawn QA agent for review
- `#sprint-tracking` → Save + update task status + recalculate progress
- `#general` → Save + chat with Claude Code (free-form, context-aware)

**Agent session lifecycle:**
1. User triggers agent (assign task, click "Spawn Agent", etc.)
2. Rust creates agent_sessions row (status: "running")
3. Rust spawns: `claude --output-format stream-json --model <model> -p <prompt>`
4. JSON lines stream in → parsed → emitted as Tauri events → UI updates
5. Process exits → status updated → auto-post to channel → task updated

**Concurrency:** Max 5 simultaneous Claude Code processes (configurable). Beyond that, requests queue.

**Context injection:** Claude Code spawned with project path as working directory. Picks up CLAUDE.md, rules, agents automatically.

---

## Section 5: Integration Layer

```
┌─────────────────────────────────────────────────────┐
│              INTEGRATION LAYER                       │
│                                                      │
│  GitHub ──── PRs, issues, actions, webhooks          │
│  Vercel ──── Deploy status, logs, previews           │
│  Supabase ── Migrations, table status, logs          │
│  Git ─────── Branch status, diff, commit log         │
│  npm ─────── Build status, test results              │
│  Filesystem ─ File watchers, change detection        │
│  Slack ───── Import/export (bridge to team)          │
└─────────────────────────────────────────────────────┘
```

**GitHub (via `gh` CLI):**
- PR opened → auto-post to #pr-reviews with diff summary
- CI fails → auto-post to #bugs-blockers with error
- Issue assigned → auto-create task in sprint board
- Push to main → auto-post to #dev-updates

**Vercel (via API):**
- Deploy starts → status in #dev-updates
- Deploy fails → error to #bugs-blockers
- Preview URL → posted to #pr-reviews

**Git watcher (local):**
- Branch switch → update project context
- Uncommitted changes >2 hours → reminder in #brain-dump
- Merge conflicts → alert in #bugs-blockers

**Build/Test watcher:**
- Build fails → parse errors, post to #bugs-blockers, offer agent
- Test failures → identify failing tests, post context, offer agent

---

## Section 6: Real-Time Event Flow

Tauri event bus — typed events, no polling:

```
"message:new"       → { channel_id, message }
"agent:status"      → { agent_id, status, output_line }
"agent:completed"   → { agent_id, summary, task_id }
"task:updated"      → { task_id, status, assigned_to }
"build:result"      → { project_id, success, errors[] }
"deploy:status"     → { project_id, url, status }
"git:changed"       → { project_id, branch, files[] }
"cron:fired"        → { job_name, output }
"integration:event" → { source, type, payload }
```

React listens via `listen('event:name', handler)`. Every event also writes to SQLite for audit trail.

---

## Section 7: Automation & Scheduling

**Scheduled jobs (cron):**
- Morning standup (configurable time) → #dev-updates
- End-of-day digest → #brain-dump
- Sprint report (weekly) → #sprint-tracking
- GitHub poll (every 5 min) → #pr-reviews, #bugs-blockers

**File watchers (always running):**
- Git state (`.git/HEAD`, `.git/refs/`)
- Project files (`src/**`)
- Build output (stderr)
- Test results (Vitest output)
- CLAUDE.md changes (`.claude/**`)

**Native macOS notifications:**
- Agent completed a task
- Build failed
- New PR needs review
- Scheduled report ready
- Uncommitted changes >2 hours

---

## Section 8: Memory & Context Persistence

**5-layer memory system:**

1. **Message History** — every message, every channel, forever. FTS5 search.
2. **Decision Log** — auto-extracted decisions with rationale and context.
3. **Session Context** — last 5 brain dumps + open bugs + sprint status injected into every agent prompt.
4. **Learned Patterns** — "When X happens, do Y because Z" auto-extracted from agent sessions.
5. **Project Graph** — files ↔ bugs ↔ tasks ↔ PRs ↔ decisions. "Show me everything related to auth."

**Context injection template (every agent gets this):**
```
You are working on project: {name}
Path: {path}
Branch: {branch}

Recent context:
- [brain-dump {time}] "{content}"
- [bug open] {bug_summary}
- [task assigned to you] {task_summary}

Sprint: {completed}/{total} tasks done

Learned patterns for this project:
- {pattern_1}
- {pattern_2}

Your task: {actual_prompt}
```

---

## Project Structure

```
hive/
├── src-tauri/                    # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── db/                   # SQLite (rusqlite + serde)
│   │   ├── claude/               # Process manager, router, sessions
│   │   ├── integrations/         # GitHub, Vercel, git, build watchers
│   │   ├── automation/           # Cron, file watchers, webhooks, triggers
│   │   └── commands/             # Tauri IPC commands
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                          # React frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/               # app-shell, sidebar, panels
│   │   ├── channels/             # channel-view, feed, messages
│   │   ├── tasks/                # sprint-board, task-card
│   │   ├── agents/               # agent-status, agent-log, spawn
│   │   ├── integrations/         # github, vercel, git cards
│   │   └── ui/                   # shadcn/ui primitives
│   ├── hooks/                    # use-tauri, use-channel, use-agents
│   ├── lib/                      # types, utils, tauri bindings
│   └── styles/
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

**Key dependencies:**

| Layer | Package | Purpose |
|-------|---------|---------|
| Desktop | `@tauri-apps/api` v2 | IPC, events, windows |
| UI | `shadcn/ui` + `@radix-ui/*` | Components |
| Styling | `tailwindcss` v4 | Styling |
| State | `zustand` | Client state |
| Rust DB | `rusqlite` + `serde` | SQLite |
| Rust async | `tokio` | Process management |
| Rust CLI | `tokio::process::Command` | Spawn Claude Code |
| Rust cron | `tokio-cron-scheduler` | Scheduled automations |
| Rust FS | `notify` | File system watchers |
| Rust HTTP | `reqwest` | API calls |
