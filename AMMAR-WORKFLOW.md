# Ammar's Claude Code Workflow System

> The definitive guide to shipping AI-GOS V2 and all future projects using Claude Code multi-agent workflows.
> Built from official Anthropic docs, community best practices (Reddit, HN, X), Boris Cherny's workflow, Stanford AI-native engineering research, and The Vibe Stack methodology.

---

## The Philosophy

You are a **manager of AI agents**, not a solo coder. Your job is to:

1. **Define what needs to be built** (PRD, specs, CLAUDE.md)
2. **Break work into isolated chunks** (tasks that don't touch the same files)
3. **Kick off agents** and watch them work
4. **Context-switch** between agents, catching errors early
5. **Verify and ship**

The #1 rule from everyone who's mastered this: **start with 1 agent doing work well, then add more incrementally.** Never start with 8 agents on day one.

---

## Part 1: The 4-Agent Ghostty Setup

### Terminal Layout (Ghostty Splits)

```
┌─────────────────────────┬─────────────────────────┐
│                         │                         │
│   LEAD / ARCHITECT      │   FRONTEND              │
│   (You talk to this)    │   (UI, components)      │
│                         │                         │
├─────────────────────────┼─────────────────────────┤
│                         │                         │
│   BACKEND / API         │   QA / TESTING          │
│   (Routes, AI pipeline) │   (Tests, verification) │
│                         │                         │
└─────────────────────────┴─────────────────────────┘
```

### How to Start Each Agent

**Step 1: Create worktrees** (each agent gets its own copy of the code)

```bash
# Terminal 1 — Lead (works on main or feature branch)
cd ~/projects/AI-GOS
claude

# Terminal 2 — Frontend
cd ~/projects/AI-GOS
claude --worktree frontend-work

# Terminal 3 — Backend
cd ~/projects/AI-GOS
claude --worktree backend-work

# Terminal 4 — QA (read-only to start)
cd ~/projects/AI-GOS
claude --worktree qa-work --permission-mode plan
```

**Step 2: Give each agent its role**

Copy-paste these prompts into each terminal:

**Lead/Architect (Terminal 1):**
```
You are the Lead Architect for AI-GOS V2. Your job:
1. Read the current sprint tasks from .claude/orchestration-*/
2. Break work into Frontend tasks and Backend tasks
3. Coordinate — never assign two agents to the same file
4. Review PRs from other worktrees before merging
5. You own: CLAUDE.md updates, architecture decisions, git merges

Start by reading the current PROGRESS.md and tell me what's next.
```

**Frontend (Terminal 2):**
```
You are the Frontend agent for AI-GOS V2. Your scope:
- src/components/**, src/app/**/page.tsx, src/app/**/layout.tsx
- Tailwind CSS, shadcn/ui components, animations
- You NEVER touch: API routes, lib/ai/**, database code

Rules:
- Run `npm run build` after every significant change
- Take screenshots with the browser to verify UI
- Commit with descriptive messages to your worktree branch

What task should I work on? Check .claude/orchestration-*/PROGRESS.md
```

**Backend/API (Terminal 3):**
```
You are the Backend/AI Pipeline agent for AI-GOS V2. Your scope:
- src/app/api/**, src/lib/ai/**, src/lib/media-plan/**
- Vercel AI SDK, Anthropic models, Supabase integration
- You NEVER touch: UI components, page layouts, CSS

Rules:
- Run `npm run test:run` after every change
- Verify API routes with curl or test files
- Follow the AI SDK patterns in CLAUDE.md exactly

What task should I work on? Check .claude/orchestration-*/PROGRESS.md
```

**QA/Testing (Terminal 4):**
```
You are the QA agent for AI-GOS V2. Your job:
1. Review code from other worktrees (git diff worktree-frontend-work...main)
2. Write tests for new features in src/**/__tests__/
3. Run the full test suite and report failures
4. Check for TypeScript errors: npm run build
5. Verify the app actually works: npm run dev + browser check

Start in plan mode. Read the recent commits and tell me what needs testing.
```

### The Merge Flow

```
Frontend worktree ──→ PR to main ──→ Lead reviews ──→ Merge
Backend worktree  ──→ PR to main ──→ Lead reviews ──→ Merge
QA worktree       ──→ Reports issues ──→ Frontend/Backend fix
```

Key rules:
- **Never merge without tests passing**: `npm run test:run && npm run build`
- **Lead reviews every merge**: The Lead agent (Terminal 1) reviews diffs before merging
- **QA runs after every merge**: Terminal 4 pulls latest and re-tests

---

## Part 2: Native Agent Teams (For Complex Features)

When a feature needs tight coordination between frontend + backend (like a new chat tool), use Claude's built-in Agent Teams instead of manual terminals.

### Enable Agent Teams

Already enabled in your settings.json:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### When to Use Agent Teams vs Manual Terminals

| Scenario | Use |
|----------|-----|
| Independent tasks (UI + API that don't share files) | Manual terminals (4-agent Ghostty) |
| Tightly coupled feature (new tool with UI + API + schema) | Agent Teams |
| Debugging (competing theories about a bug) | Agent Teams with debate |
| Code review | Manual terminals (reviewer in plan mode) |
| Research / exploration | Single session with subagents |

### Starting an Agent Team

```
Create an agent team to build the new [feature name]:
- Frontend teammate: owns src/components/[feature]/ and src/app/[feature]/
- Backend teammate: owns src/app/api/[feature]/ and src/lib/ai/[feature]/
- Testing teammate: writes tests and verifies both

Rules:
- Each teammate works in its own worktree
- No two teammates edit the same file
- Testing teammate requires plan approval before writing tests
- Keep team to 3 teammates max

Start with a plan. Break the feature into 5-6 tasks per teammate.
```

### Team Size: Always 3-5

From the official docs: "Coordination overhead increases with more teammates; starting with 3–5 teammates for most workflows balances parallel work with manageable coordination."

Boris Cherny's rule: 5-6 tasks per teammate keeps everyone productive.

---

## Part 3: The CLAUDE.md That Actually Works

### What Goes In CLAUDE.md (Keep Under 100 Lines)

The golden rule from Anthropic: "For each line, ask 'Would removing this cause Claude to make mistakes?' If not, cut it."

Your CLAUDE.md should contain ONLY:
1. Build/test commands (what Claude can't guess)
2. Architecture patterns specific to your project
3. Code style rules that differ from defaults
4. Common mistakes to avoid
5. File organization rules

### What Does NOT Go In CLAUDE.md

- Anything Claude can figure out by reading code
- Long tutorials or explanations
- File-by-file descriptions
- Things that change frequently
- "Write clean code" (self-evident)

### Import Structure

```markdown
# CLAUDE.md (root — keep this short)

@.claude/rules/architecture.md
@.claude/rules/ai-sdk-patterns.md
@.claude/rules/testing.md

## Commands
npm run dev / npm run build / npm run test:run

## Critical Rules
- Use @/* absolute imports, never relative
- All AI calls use @ai-sdk/anthropic directly
- Never use OpenRouter
- Commit messages: conventional commits format
```

Then put detailed rules in imported files that Claude loads on-demand.

---

## Part 4: The Verification Gate (From Vibe Stack)

**NEVER deliver code without verification. This is non-negotiable.**

Before ANY task is marked complete:

1. **Build passes**: `npm run build` exits 0
2. **Tests pass**: `npm run test:run` exits 0 (or specific test file)
3. **Manual check**: For UI — take a screenshot. For API — curl the endpoint.
4. **Matches the spec**: Re-read the task description. Does the code do what was asked?

### Verification Report Format

Every completed task gets this:

```
## Verification
- Requirement: [what was asked]
- Implementation: [what was built]
- Build: ✅ npm run build passed
- Tests: ✅ [X] tests passing
- Manual check: [screenshot or curl output]
- Matches requirement: Yes
```

---

## Part 5: Context Management (The #1 Skill)

### The Rules

1. **`/clear` between unrelated tasks** — this is the most important habit
2. **Compact at 70% context** — don't wait for auto-compact
3. **Use subagents for research** — "use a subagent to investigate X" keeps your main context clean
4. **Scope investigations narrowly** — "look at src/auth/" not "investigate the codebase"
5. **After 2 failed corrections, `/clear` and start fresh** — polluted context causes more errors

### Context-Efficient Prompting

```
# BAD — vague, causes exploration that fills context
"Fix the bug in the app"

# GOOD — scoped, gives verification criteria
"The build fails with 'Type error in src/lib/ai/chat-tools/search.ts line 45'.
Fix the type error and verify npm run build passes."
```

### Session Management

- **Name your sessions**: `/rename sprint2-chat-agent`
- **Resume when needed**: `claude --resume sprint2-chat-agent`
- **Different sessions for different features**: Don't mix work in one session

---

## Part 6: Scheduled Tasks & Automation (Cowork)

### Daily Brain Dump Task

Set up a scheduled task that runs when you start your day:

```
Task: daily-alignment
Schedule: Manual trigger (you run it when you start working)
Prompt:
  1. Read the latest git log (last 24h of commits)
  2. Read .claude/orchestration-*/PROGRESS.md
  3. Check for any failing tests: npm run test:run
  4. Summarize: what was done, what's next, any blockers
  5. Post summary to Slack #dev-updates channel
  6. Update PROGRESS.md with current status
```

### Work Stream Organizer Task

```
Task: organize-work-streams
Schedule: Manual trigger (run after each planning session)
Prompt:
  1. Read all .claude/orchestration-*/ directories
  2. For each sprint/feature, summarize: status, tasks remaining, blockers
  3. Post organized update to Slack #sprint-tracking
  4. If any task has been "in progress" for >2 days, flag it
```

### Slack Channel Structure

Create these channels:

| Channel | Purpose |
|---------|---------|
| #dev-updates | Daily alignment summaries, automated |
| #sprint-tracking | Sprint progress, task status |
| #pr-reviews | PR links and review requests |
| #bugs-blockers | Bug reports and blockers |
| #brain-dump | Your raw thoughts, ideas, pivots |
| #ai-gos-v2 | Main project channel |

---

## Part 7: The Workflow Day-by-Day

### Starting Your Work Day

1. **Open Cowork** → Run daily-alignment task
2. **Read the Slack summary** it generates
3. **Open Ghostty** → 4 terminal splits
4. **Start agents** with worktrees
5. **Tell the Lead** what to work on today

### During Work

1. **Check agents every 10-15 minutes** — context-switch between terminals
2. **Course-correct early** — if an agent is going wrong, `Esc` and redirect
3. **Merge completed work** through the Lead agent
4. **QA validates** after each merge

### Ending Your Day

1. **Tell each agent to commit and push** their worktree work
2. **Lead merges** what's ready
3. **Run full test suite** one final time
4. **Post to Slack** #dev-updates with what got done

### Using Remote Control (Phone)

When you're away from your desk:
```bash
# On your computer — start a remote control session
claude remote-control
# Scan the QR code with Claude mobile app
# Now you can give instructions from your phone
```

Best uses for Remote Control:
- Checking agent progress while you're out
- Kicking off a new task from your phone
- Approving PRs from the Claude mobile app
- Quick fixes or redirects when you notice something wrong

---

## Part 8: What to Remove from Current Setup

### Keep

- `.claude/orchestration-*/` — Sprint docs, task specs, research (this is valuable planning work)
- `.claude/settings.json` — But we'll simplify it heavily
- `.claude/sprints/` — Sprint planning docs
- `CLAUDE.md` — But we'll rewrite it

### Remove

- `.claude-flow/` — Claude Flow V3 entire directory (replace with native Agent Teams)
- `.claude/agents/` — 26 agent folders, most are Claude Flow artifacts. We'll recreate 4 clean ones.
- `.claude/skills/` — 29 skill folders, most are Claude Flow generated. Keep only what you actually use.
- `.claude/helpers/` — Hook handler scripts from Claude Flow. We'll write simple new hooks.
- `.claude/battleship-sprint-prompts.md` — Old prompt files
- `.claude/sprint2-superpowers-prompts.md` — Old prompt files
- `.claude/sprint3-claude-flow-prompts.md` — Old prompt files
- All daemon worker configs, neural network configs, HNSW configs, learning bridges

### Simplified settings.json

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "npx tsc --noEmit 2>&1 | head -20",
            "timeout": 15000
          }
        ]
      }
    ]
  },
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(npx tsc *)",
      "Bash(git *)",
      "Bash(curl *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)"
    ]
  }
}
```

That's it. No daemon workers. No neural networks. No Claude Flow. Just TypeScript checking after edits, agent teams enabled, and sensible permissions.

---

## Part 9: The 4 Custom Subagents

Located in `.claude/agents/`. Each uses advanced features from the official subagent spec: persistent memory, git worktree isolation, scoped hooks, permission modes, and turn limits.

### Agent Architecture

```
┌──────────────────────────────────────────────────────────┐
│  YOU (Lead / Architect)                                  │
│  Model: Opus  │  Runs on main branch                    │
│  Delegates to agents, reviews PRs, merges                │
├──────────────┬──────────────┬──────────────┬─────────────┤
│  FRONTEND    │  BACKEND     │  QA          │  RESEARCHER │
│  Opus 4.6    │  Opus 4.6    │  Opus 4.6    │  Haiku      │
│  Worktree    │  Worktree    │  Main branch │  Plan mode  │
│  acceptEdits │  acceptEdits │  default     │  Read-only  │
│  Memory: ✅  │  Memory: ✅  │  Memory: ✅  │  Memory: ✅ │
│  maxTurns:40 │  maxTurns:40 │  maxTurns:30 │  maxTurns:20│
└──────────────┴──────────────┴──────────────┴─────────────┘
```

### Key Features (per official spec)

| Feature | Frontend | Backend | QA | Researcher |
|---------|----------|---------|----|------------|
| **model** | claude-opus-4-6 | claude-opus-4-6 | claude-opus-4-6 | haiku |
| **isolation** | worktree | worktree | — | — |
| **permissionMode** | acceptEdits | acceptEdits | default | plan |
| **memory** | project | project | project | project |
| **maxTurns** | 40 | 40 | 30 | 20 |
| **disallowedTools** | Agent | Agent | Agent | Write, Edit, Agent |
| **PostToolUse hook** | tsc on edit | tsc on edit | — | — |
| **Stop hook** | npm run build | npm run test:run | npm run build | — |

### What These Features Do

- **`isolation: worktree`** — Frontend and Backend each get their own git worktree copy. No file conflicts. Work merges back via PR.
- **`memory: project`** — Each agent writes learnings to `.claude/agent-memory/{name}/MEMORY.md`. Cross-session knowledge persists. First 200 lines auto-loaded on startup.
- **`permissionMode: acceptEdits`** — Frontend and Backend auto-accept file edits (no prompts slowing them down). QA keeps default permissions for safety. Researcher is plan-only (read-only).
- **`maxTurns`** — Prevents runaway agents. Frontend/Backend get 40 turns (enough for a feature). QA gets 30. Researcher gets 20 (should be fast).
- **`disallowedTools: Agent`** — No agent can spawn sub-subagents. Only the lead (you) can delegate.
- **Stop hooks** — When an agent finishes, a final verification runs automatically (build for frontend, tests for backend).

### Agent Chaining Patterns

For tasks that span multiple agents, chain them in sequence:

**New Feature:**
```
researcher → [understand existing code] → backend → frontend → qa
```

**Bug Fix:**
```
researcher → [find root cause] → backend OR frontend → qa → [verify fix]
```

**UI-Only Change:**
```
frontend → qa → [verify build + visual check]
```

**API-Only Change:**
```
backend → qa → [verify tests + curl endpoint]
```

**Full Sprint Task:**
```
researcher → backend → frontend → qa → [merge if all pass]
```

The full agent files are in `.claude/agents/frontend.md`, `backend.md`, `qa.md`, and `researcher.md`. Each contains detailed scope boundaries, code standards, verification requirements, and memory instructions.

---

## Part 10: Making AI-GOS Feel Like Claude

Your app should feel like you're inside Claude. Here's how:

### Design Principles
1. **Thinking is visible** — Show the AI's reasoning process (thinking blocks)
2. **Streaming everything** — Never show loading spinners, show progress
3. **Tools are transparent** — When the AI uses a tool, show what it's doing
4. **Conversation is natural** — The chat agent should feel like talking to Claude

### Technical Implementation
- Model: `claude-opus-4-6` with `thinking: { type: "adaptive" }`
- Streaming: `streamText()` + `toUIMessageStreamResponse()`
- Transport: `DefaultChatTransport` (matches `toUIMessageStreamResponse`)
- Tools: `inputSchema` (not `parameters`), `maxOutputTokens` (not `maxTokens`)
- Font stack: DM Sans (body), Instrument Sans (heading), JetBrains Mono (mono)

---

## Part 11: Advanced Patterns (from everything-claude-code)

Integrated from [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) — an Anthropic hackathon-winning framework with 10+ months of production use.

### Memory Persistence

Save session state so you never lose context between work sessions:

```bash
# End of session — save memory
mkdir -p .claude/memory
cat > .claude/memory/$(date +%Y-%m-%d)-session.md << 'EOF'
## Session: [date]-[feature]
### What was done
- [completed tasks]
### What's left
- [remaining tasks]
### Key decisions
- [why you chose X over Y]
### Gotchas found
- [things that surprised you]
EOF

# Start of next session — load memory
Read .claude/memory/ and continue from where we left off.
```

### Model Selection (Cost Optimization)

Don't use Opus for everything. Match model to task:

| Task | Model | Why |
|------|-------|-----|
| Code search, file reads, simple edits | Haiku | Fast, cheap, sufficient |
| Feature implementation, tests, bug fixes | Sonnet | Good balance of quality/cost |
| Architecture, multi-file refactors, security review | Opus | Complex reasoning needed |
| Research subagents | Haiku | Cost efficiency for read-only work |

**Rule of thumb**: Default Sonnet. Escalate to Opus after 2 failed attempts.

### Continuous Learning

When Claude discovers a non-obvious solution, capture it:

```
# .claude/rules/learned-patterns.md
When MissingToolResultsError fires, sanitize incomplete tool parts BEFORE convertToModelMessages()
When SSE events aren't received, check event name casing — must match exactly between backend/frontend
```

Prune monthly — remove patterns unused for 4+ weeks.

### Iterative Retrieval for Subagents

Subagents have limited context. Use this pattern:

1. Give subagent the task + objective context (why, not just what)
2. Evaluate the response — is it complete?
3. If incomplete, ask a follow-up with specific gaps identified
4. Maximum 3 retrieval cycles, then escalate to a higher-capability model

```
Use a subagent to find how SSE streaming works in this codebase.
Objective: We need to add a new event type to the generator pipeline.
Look at: src/lib/ai/generator.ts, src/app/api/strategic-blueprint/generate/route.ts
Report: which event names exist, how they're emitted, and how frontend consumes them.
```

### MCP Tool Hygiene

Every enabled MCP tool consumes context window tokens. From everything-claude-code:

- Keep active MCPs under 10 at any time
- Disabling unused MCPs can reclaim 50%+ of available context
- Each tool description eats ~200-500 tokens
- Review active tools: if you haven't used it in this session, disable it

### Security Scanning

Run `npx ecc-agentshield scan` periodically to check:

- Hardcoded secrets in code or configs
- Overly broad permissions in settings.json
- Suspicious hooks that could exfiltrate data
- Typosquatted package names in dependencies
- Unverified MCP server sources

### The Groundwork Pattern (New Projects)

When starting a new feature or project, run two parallel instances:

1. **Instance 1 (Scaffolder)**: Creates file structure, configs, boilerplate
2. **Instance 2 (Researcher)**: Investigates requirements, reads existing patterns, checks docs

They work simultaneously. When both finish, the scaffolder has a structure and the researcher has context. Merge the knowledge and start building.

### Hooks Worth Stealing

From everything-claude-code's hook library:

| Hook | Event | Purpose |
|------|-------|---------|
| Dev Server Blocker | PreToolUse | Warns before `npm run dev` outside tmux |
| Prettier Format | PostToolUse | Auto-formats TS/TSX files after edit |
| TypeScript Check | PostToolUse | Runs tsc after every file change |
| Console.log Warning | PostToolUse | Alerts about debug statements left in code |
| Strategic Compact | PostToolUse | Suggests `/compact` every ~50 tool calls |

All are implemented in your `settings.json` already.

---

## Part 12: Slack Channel Reference

| Channel | ID | Purpose |
|---------|----|---------|
| #dev-updates | C0AHLECK4HZ | Daily build/deploy status, automated summaries |
| #sprint-tracking | C0AHWEERKEY | Sprint progress, task assignments |
| #pr-reviews | C0AHLEHEEBD | Code review requests and discussions |
| #bugs-blockers | C0AHSS3KV98 | Bug reports and blockers |
| #brain-dump | C0AHQQB27C6 | End-of-session raw thoughts |
| #ai-gos-v2 | C0AHLEK88H1 | General V2 discussion |

---

## Sources

- [Claude Code Agent Teams (Official)](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Best Practices (Official)](https://code.claude.com/docs/en/best-practices)
- [Claude Code Common Workflows (Official)](https://code.claude.com/docs/en/common-workflows)
- [Claude Code Remote Control](https://code.claude.com/docs/en/remote-control)
- [Everything Claude Code (affaan-m)](https://github.com/affaan-m/everything-claude-code) — Anthropic hackathon winner, 56 skills, 14 agents, 32 commands
- [Boris Cherny's Workflow (InfoQ)](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- [Addy Osmani — Claude Code Swarms](https://addyosmani.com/blog/claude-code-agent-teams/)
- [Claude Code Swarm Orchestration Skill (GitHub Gist)](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea)
- [The Vibe Stack](https://github.com/solune-lab/the-vibe-stack)
- [Stanford AI-Native Engineering (Mihel's Class)](https://www.youtube.com/watch?v=...)
- [OpenClaw vs Claude Code Remote Control](https://www.unite.ai/openclaw-vs-claude-code-remote-control-agents/)
- [Claude Code Reddit Community Best Practices](https://www.aitooldiscovery.com/guides/claude-code-reddit)
- [Claude Code Tips: 10 Productivity Workflows](https://www.f22labs.com/blogs/10-claude-code-productivity-tips-for-every-developer/)
- [Multi-Agent Systems: 2026 Guide (eesel.ai)](https://www.eesel.ai/blog/claude-code-multiple-agent-systems-complete-2026-guide)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
