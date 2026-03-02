# Hive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Use superpowers:dispatching-parallel-agents when tasks within a wave are independent.

**Goal:** Build Hive — a Tauri v2 desktop app that serves as a local dev command center with channels, agents, integrations, and automation, powered by Claude Code on a Max subscription.

**Architecture:** Tauri v2 app with Rust backend (SQLite, process management, file watchers, cron) and React frontend (shadcn/ui, Tailwind, zustand). Claude Code CLI spawned as child processes for intelligence. App-orchestrated: SQLite is the single source of truth.

**Tech Stack:** Tauri v2, Rust, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, SQLite (rusqlite), tokio, notify, zustand

**Design Doc:** `docs/plans/2026-03-01-hive-design.md`

---

## Execution Strategy

Tasks are grouped into **waves**. Within a wave, independent tasks can be dispatched to parallel subagents. Waves must execute sequentially (later waves depend on earlier ones).

```
Wave 1: Project Scaffolding (sequential — foundation)
Wave 2: Data Layer (sequential — schema + models)
Wave 3: Core UI Shell (parallel — independent components)
Wave 4: Channel System (sequential — builds on shell + data)
Wave 5: Claude Code Integration (sequential — core feature)
Wave 6: Task/Sprint System (parallel with Wave 7)
Wave 7: Integrations (parallel with Wave 6)
Wave 8: Automation & Scheduling (sequential — depends on integrations)
Wave 9: Memory System (sequential — final layer)
Wave 10: Polish & Packaging (sequential — final)
```

---

## Wave 1: Project Scaffolding

### Task 1: Initialize Tauri v2 + React + TypeScript Project

**Files:**
- Create: `hive/` (entire project scaffold)
- Modify: `hive/src-tauri/Cargo.toml` (add dependencies)
- Modify: `hive/package.json` (add frontend dependencies)
- Modify: `hive/src-tauri/tauri.conf.json` (window config)

**Step 1: Create Tauri project**

```bash
cd /Users/ammar/Dev-Projects
npm create tauri-app@latest hive -- --template react-ts
cd hive
```

**Step 2: Install Rust dependencies**

Update `hive/src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-build = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled", "chrono"] }
tokio = { version = "1", features = ["full"] }
notify = "6.1"
chrono = { version = "0.4", features = ["serde"] }
tokio-cron-scheduler = "0.15"
reqwest = { version = "0.12", features = ["json"] }
uuid = { version = "1", features = ["v4"] }
tauri-plugin-notification = "2"
tauri-plugin-shell = "2"
```

**Step 3: Install frontend dependencies**

```bash
cd hive
npm install zustand @tauri-apps/api @tauri-apps/plugin-notification @tauri-apps/plugin-shell
npm install -D tailwindcss@4 @tailwindcss/vite
npx shadcn@latest init -d
npx shadcn@latest add button input scroll-area separator badge dialog dropdown-menu command tooltip avatar tabs card progress
```

**Step 4: Configure Tauri window**

Update `hive/src-tauri/tauri.conf.json` — set window title to "Hive", width 1400, height 900, resizable true, decorations true, titleBarStyle "overlay" (macOS).

**Step 5: Verify scaffold builds**

```bash
cd hive && npm run tauri dev
```

Expected: Tauri window opens with default React template.

**Step 6: Commit**

```bash
git init && git add -A && git commit -m "feat: initialize Hive Tauri v2 project scaffold"
```

---

## Wave 2: Data Layer

### Task 2: SQLite Schema and Migration System

**Files:**
- Create: `hive/src-tauri/src/db/mod.rs`
- Create: `hive/src-tauri/src/db/migrations.rs`
- Create: `hive/src-tauri/src/db/models.rs`
- Modify: `hive/src-tauri/src/lib.rs` (register db module)
- Modify: `hive/src-tauri/src/main.rs` (initialize db on startup)

**Step 1: Create db module**

`hive/src-tauri/src/db/mod.rs`:
```rust
pub mod migrations;
pub mod models;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_dir)?;
    let db_path = app_dir.join("hive.db");
    let conn = Connection::open(db_path)?;

    // Enable WAL mode for concurrent reads
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    migrations::run_migrations(&conn)?;

    app.manage(DbState(Mutex::new(conn)));
    Ok(())
}
```

**Step 2: Create migrations**

`hive/src-tauri/src/db/migrations.rs`:
```rust
use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            slug TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(project_id, slug)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK(role IN ('user','claude','agent','system')),
            content TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sprints (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','completed')),
            goal TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            subject TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','blocked')),
            assigned_to TEXT,
            priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS agent_sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            agent_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','idle','completed','failed')),
            model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
            task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
            output_log TEXT DEFAULT '',
            started_at TEXT NOT NULL DEFAULT (datetime('now')),
            ended_at TEXT
        );

        CREATE TABLE IF NOT EXISTS project_settings (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            UNIQUE(project_id, key)
        );

        CREATE TABLE IF NOT EXISTS decisions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            decision TEXT NOT NULL,
            rationale TEXT,
            context TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS learned_patterns (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            pattern TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Full-text search on messages
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            content=messages,
            content_rowid=rowid
        );

        -- Triggers to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
        END;

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_agent_sessions_project_id ON agent_sessions(project_id);
        CREATE INDEX IF NOT EXISTS idx_channels_project_id ON channels(project_id);
    ")?;
    Ok(())
}
```

**Step 3: Create Rust models**

`hive/src-tauri/src/db/models.rs`:
```rust
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    pub id: String,
    pub project_id: String,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub channel_id: String,
    pub role: String,
    pub content: String,
    pub metadata: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Sprint {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub status: String,
    pub goal: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub sprint_id: Option<String>,
    pub project_id: String,
    pub subject: String,
    pub description: Option<String>,
    pub status: String,
    pub assigned_to: Option<String>,
    pub priority: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentSession {
    pub id: String,
    pub project_id: String,
    pub agent_type: String,
    pub status: String,
    pub model: String,
    pub task_id: Option<String>,
    pub output_log: String,
    pub started_at: String,
    pub ended_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Decision {
    pub id: String,
    pub project_id: String,
    pub decision: String,
    pub rationale: Option<String>,
    pub context: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LearnedPattern {
    pub id: String,
    pub project_id: String,
    pub pattern: String,
    pub created_at: String,
}
```

**Step 4: Wire db init into main.rs**

```rust
// In main.rs setup closure
.setup(|app| {
    db::init_db(app)?;
    Ok(())
})
```

**Step 5: Verify db creates on startup**

```bash
cd hive && npm run tauri dev
# Check ~/Library/Application Support/com.hive.app/hive.db exists
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add SQLite schema with migrations, models, and FTS5 search"
```

---

### Task 3: Tauri Commands — Projects CRUD

**Files:**
- Create: `hive/src-tauri/src/commands/mod.rs`
- Create: `hive/src-tauri/src/commands/projects.rs`
- Modify: `hive/src-tauri/src/lib.rs` (register commands)

**Step 1: Create projects commands**

`hive/src-tauri/src/commands/projects.rs`:
```rust
use crate::db::DbState;
use crate::db::models::{Project, Channel};
use tauri::State;
use uuid::Uuid;

const DEFAULT_CHANNELS: &[(&str, &str, &str)] = &[
    ("general", "General", "Architecture discussions, feature ideas, links, questions"),
    ("brain-dump", "Brain Dump", "End-of-session brain dumps — raw thoughts, decisions, context"),
    ("bugs-blockers", "Bugs & Blockers", "Bug reports with reproduction steps, blockers, build failures"),
    ("dev-updates", "Dev Updates", "Build status, deploy updates, agent completions, daily summaries"),
    ("pr-reviews", "PR Reviews", "Code review requests, feedback, QA agent reports"),
    ("sprint-tracking", "Sprint Tracking", "Sprint goals, task assignments, progress updates, retros"),
];

#[tauri::command]
pub fn create_project(db: State<DbState>, name: String, path: String) -> Result<Project, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let project_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![project_id, name, path, now, now],
    ).map_err(|e| e.to_string())?;

    // Create default channels
    for (slug, chan_name, desc) in DEFAULT_CHANNELS {
        let chan_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO channels (id, project_id, slug, name, description, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![chan_id, project_id, slug, chan_name, desc, now],
        ).map_err(|e| e.to_string())?;
    }

    Ok(Project { id: project_id, name, path, created_at: now.clone(), updated_at: now })
}

#[tauri::command]
pub fn list_projects(db: State<DbState>) -> Result<Vec<Project>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, path, created_at, updated_at FROM projects ORDER BY name")
        .map_err(|e| e.to_string())?;
    let projects = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(projects)
}

#[tauri::command]
pub fn delete_project(db: State<DbState>, project_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![project_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_project_channels(db: State<DbState>, project_id: String) -> Result<Vec<Channel>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, slug, name, description, created_at FROM channels WHERE project_id = ?1 ORDER BY created_at"
    ).map_err(|e| e.to_string())?;
    let channels = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Channel {
            id: row.get(0)?,
            project_id: row.get(1)?,
            slug: row.get(2)?,
            name: row.get(3)?,
            description: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(channels)
}
```

**Step 2: Create commands mod.rs**

```rust
pub mod projects;
```

**Step 3: Register in lib.rs**

```rust
mod db;
mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            db::init_db(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::projects::create_project,
            commands::projects::list_projects,
            commands::projects::delete_project,
            commands::projects::get_project_channels,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4: Verify commands work from React**

Add a quick test in App.tsx that calls `invoke('list_projects')` and logs the result.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add project CRUD commands with default channel creation"
```

---

### Task 4: Tauri Commands — Channels & Messages CRUD

**Files:**
- Create: `hive/src-tauri/src/commands/channels.rs`
- Modify: `hive/src-tauri/src/commands/mod.rs`
- Modify: `hive/src-tauri/src/lib.rs` (register new commands)

**Step 1: Create channels commands**

`hive/src-tauri/src/commands/channels.rs` — implement:
- `get_channel_messages(db, channel_id, limit, offset)` → Vec<Message>
- `post_message(db, app_handle, channel_id, role, content, metadata)` → Message (also emits "message:new" event)
- `search_messages(db, project_id, query)` → Vec<Message> (uses FTS5)
- `get_channel_by_slug(db, project_id, slug)` → Channel

Each message insert should also emit a Tauri event `"message:new"` with the message payload so the frontend updates in real-time.

**Step 2: Register commands, verify from React**

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add channel messages CRUD with FTS5 search and real-time events"
```

---

### Task 5: Tauri Commands — Tasks & Sprints CRUD

**Files:**
- Create: `hive/src-tauri/src/commands/tasks.rs`
- Modify: `hive/src-tauri/src/commands/mod.rs`
- Modify: `hive/src-tauri/src/lib.rs`

**Step 1: Create task commands**

Implement:
- `create_sprint(db, project_id, name, goal)` → Sprint
- `list_sprints(db, project_id)` → Vec<Sprint>
- `update_sprint_status(db, sprint_id, status)` → Sprint
- `create_task(db, project_id, sprint_id, subject, description, priority)` → Task
- `list_tasks(db, project_id, sprint_id?)` → Vec<Task>
- `update_task(db, task_id, status?, assigned_to?, description?)` → Task (emits "task:updated" event)
- `get_sprint_progress(db, sprint_id)` → `{ total: u32, completed: u32, in_progress: u32, blocked: u32 }`

**Step 2: Register, verify, commit**

```bash
git add -A && git commit -m "feat: add sprint and task management commands"
```

---

### Task 6: Tauri Commands — Agent Sessions CRUD

**Files:**
- Create: `hive/src-tauri/src/commands/agents.rs`
- Modify: `hive/src-tauri/src/commands/mod.rs`
- Modify: `hive/src-tauri/src/lib.rs`

**Step 1: Create agent session commands**

Implement:
- `create_agent_session(db, app_handle, project_id, agent_type, model, task_id?)` → AgentSession (emits "agent:status")
- `update_agent_session(db, app_handle, session_id, status, output_line?)` → AgentSession (emits "agent:status")
- `list_agent_sessions(db, project_id, status?)` → Vec<AgentSession>
- `get_agent_session(db, session_id)` → AgentSession

**Step 2: Register, verify, commit**

```bash
git add -A && git commit -m "feat: add agent session tracking commands"
```

---

## Wave 3: Core UI Shell (PARALLEL — all 3 tasks are independent)

### Task 7: App Shell — Three-Panel Layout

**Files:**
- Create: `hive/src/components/layout/app-shell.tsx`
- Create: `hive/src/components/layout/sidebar.tsx`
- Create: `hive/src/components/layout/main-panel.tsx`
- Create: `hive/src/components/layout/status-panel.tsx`
- Modify: `hive/src/App.tsx` (use AppShell)
- Create: `hive/src/styles/globals.css` (theme variables)

**Implementation:**
- Three-panel responsive layout: sidebar (240px collapsible to 48px), main (flex-1), status (300px collapsible)
- Dark mode by default, zinc base color scheme
- CSS variables for theme tokens matching shadcn/ui
- Sidebar has three sections: project switcher, channel list, agent list
- Main panel is empty for now (placeholder)
- Status panel shows placeholder cards for sprint progress, agents, quick actions

**Step 1: Set up globals.css with dark theme variables**
**Step 2: Build AppShell with resizable panels**
**Step 3: Build Sidebar skeleton (project switcher dropdown, channel list, agent list)**
**Step 4: Build StatusPanel skeleton (sprint card, agent card, quick actions card)**
**Step 5: Build MainPanel with placeholder**
**Step 6: Wire into App.tsx, verify renders**
**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add three-panel app shell with sidebar, main, and status panels"
```

---

### Task 8: Zustand State Store + Tauri Bindings

**Files:**
- Create: `hive/src/lib/store.ts`
- Create: `hive/src/lib/tauri-commands.ts`
- Create: `hive/src/lib/types.ts`
- Create: `hive/src/hooks/use-events.ts`

**Step 1: Define TypeScript types**

`hive/src/lib/types.ts`:
```typescript
export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface Channel {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
  unreadCount?: number;
}

export interface Message {
  id: string;
  channelId: string;
  role: 'user' | 'claude' | 'agent' | 'system';
  content: string;
  metadata: string; // JSON string
  createdAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  status: 'planned' | 'active' | 'completed';
  goal: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  sprintId: string | null;
  projectId: string;
  subject: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  assignedTo: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface AgentSession {
  id: string;
  projectId: string;
  agentType: string;
  status: 'running' | 'idle' | 'completed' | 'failed';
  model: string;
  taskId: string | null;
  outputLog: string;
  startedAt: string;
  endedAt: string | null;
}

export type ChannelSlug = 'general' | 'brain-dump' | 'bugs-blockers' | 'dev-updates' | 'pr-reviews' | 'sprint-tracking';
```

**Step 2: Create typed Tauri command wrappers**

`hive/src/lib/tauri-commands.ts` — typed `invoke()` wrappers for every Rust command.

**Step 3: Create zustand store**

`hive/src/lib/store.ts`:
```typescript
import { create } from 'zustand';

interface HiveState {
  // Active project
  activeProjectId: string | null;
  projects: Project[];

  // Channels
  channels: Channel[];
  activeChannelSlug: ChannelSlug | null;
  viewMode: 'feed' | 'channel';

  // Messages
  messages: Message[];

  // Agents
  agentSessions: AgentSession[];

  // Tasks
  sprints: Sprint[];
  tasks: Task[];

  // Actions
  setActiveProject: (id: string) => void;
  setActiveChannel: (slug: ChannelSlug) => void;
  setViewMode: (mode: 'feed' | 'channel') => void;
  addMessage: (message: Message) => void;
  updateAgentSession: (session: AgentSession) => void;
  // ... more actions
}
```

**Step 4: Create event listener hook**

`hive/src/hooks/use-events.ts` — listens to Tauri events ("message:new", "agent:status", "task:updated", etc.) and updates zustand store.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add zustand store, typed Tauri bindings, and event listener hooks"
```

---

### Task 9: Command Palette (⌘K)

**Files:**
- Create: `hive/src/components/layout/command-palette.tsx`
- Modify: `hive/src/App.tsx` (add keyboard listener)

**Step 1: Build command palette using shadcn Command component**

Actions:
- Switch channel (⌘1-6)
- Switch project
- New brain dump (⌘N)
- New bug report (⌘B)
- Spawn agent
- Search messages
- Toggle feed/channel view

**Step 2: Add global keyboard shortcuts**
**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add command palette with keyboard shortcuts"
```

---

## Wave 4: Channel System

### Task 10: Channel View + Message List

**Files:**
- Create: `hive/src/components/channels/channel-view.tsx`
- Create: `hive/src/components/channels/message.tsx`
- Create: `hive/src/components/channels/message-input.tsx`
- Modify: `hive/src/components/layout/main-panel.tsx` (render channel view)

**Step 1: Build Message component**

Renders a single message with:
- Avatar/icon based on role (user, claude, agent, system)
- Agent name from metadata if role=agent
- Timestamp
- Markdown content rendering
- Channel tag (in feed mode)

**Step 2: Build ChannelView component**

- Scroll area with messages
- Auto-scroll to bottom on new messages
- Loads messages from Tauri command on mount
- Subscribes to "message:new" events for real-time updates

**Step 3: Build MessageInput component**

- Text input with ⌘↵ to send
- Calls `post_message` Tauri command
- Shows which channel the message will post to

**Step 4: Wire into MainPanel**

- Feed mode: show all messages across channels
- Channel mode: filter to active channel

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add channel view with message list, input, and real-time updates"
```

---

### Task 11: Feed View (Unified Activity Stream)

**Files:**
- Create: `hive/src/components/channels/feed-view.tsx`
- Modify: `hive/src/components/layout/main-panel.tsx`

**Step 1: Build FeedView**

- Shows latest messages across ALL channels for the active project
- Each message tagged with source channel badge
- Clicking a message's channel badge switches to that channel view
- Newest at bottom, auto-scroll
- Load from Tauri command: `get_feed_messages(project_id, limit)` — need to add this Rust command (union query across channels)

**Step 2: Add feed Tauri command in Rust**

```rust
#[tauri::command]
pub fn get_feed_messages(db: State<DbState>, project_id: String, limit: u32) -> Result<Vec<FeedMessage>, String> {
    // JOIN messages with channels, ORDER BY created_at DESC, LIMIT
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add unified feed view across all channels"
```

---

### Task 12: Sidebar — Live Channel + Agent Status

**Files:**
- Modify: `hive/src/components/layout/sidebar.tsx`
- Create: `hive/src/components/agents/agent-status.tsx`

**Step 1: Wire sidebar to zustand store**

- Project switcher loads projects, switches active project
- Channel list shows channels for active project with unread count badges
- Clicking channel switches to channel mode
- Agent list shows agent sessions for active project with status dots (green=running, gray=idle, red=failed)
- Clicking agent shows its session log

**Step 2: Build AgentStatus component**

- Colored dot indicator
- Agent type label
- Current action (from latest output_line) when running
- Truncated to fit sidebar width

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: wire sidebar with live channel list and agent status indicators"
```

---

## Wave 5: Claude Code Integration

### Task 13: Process Manager — Spawn and Stream Claude Code

**Files:**
- Create: `hive/src-tauri/src/claude/mod.rs`
- Create: `hive/src-tauri/src/claude/process.rs`
- Modify: `hive/src-tauri/src/lib.rs`

**Step 1: Build Claude Code process spawner**

`hive/src-tauri/src/claude/process.rs`:
```rust
use tokio::process::Command as TokioCommand;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::process::Stdio;
use tauri::Manager;

pub struct ClaudeProcess {
    pub session_id: String,
    pub model: String,
    pub max_turns: u32,
    pub project_path: String,
    pub prompt: String,
    pub allowed_tools: Vec<String>,
}

impl ClaudeProcess {
    pub async fn spawn(self, app_handle: tauri::AppHandle) -> Result<(), String> {
        let mut cmd = TokioCommand::new("claude");
        cmd.current_dir(&self.project_path);
        cmd.args(&[
            "--print",
            "--output-format", "stream-json",
            "--model", &self.model,
            "--max-turns", &self.max_turns.to_string(),
        ]);

        if !self.allowed_tools.is_empty() {
            cmd.arg("--allowedTools");
            cmd.arg(self.allowed_tools.join(","));
        }

        cmd.arg("-p");
        cmd.arg(&self.prompt);

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| e.to_string())?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let mut reader = BufReader::new(stdout).lines();

        let session_id = self.session_id.clone();

        while let Ok(Some(line)) = reader.next_line().await {
            // Parse JSON line and emit event
            app_handle.emit("agent:output", serde_json::json!({
                "sessionId": session_id,
                "line": line,
            })).ok();
        }

        let status = child.wait().await.map_err(|e| e.to_string())?;

        app_handle.emit("agent:exit", serde_json::json!({
            "sessionId": session_id,
            "exitCode": status.code().unwrap_or(-1),
            "success": status.success(),
        })).ok();

        Ok(())
    }
}
```

**Step 2: Build process manager with concurrency control**

Max 5 concurrent processes, queue beyond that.

**Step 3: Create Tauri command to spawn agent**

```rust
#[tauri::command]
pub async fn spawn_agent(
    db: State<'_, DbState>,
    app_handle: tauri::AppHandle,
    project_id: String,
    agent_type: String,
    model: String,
    prompt: String,
    task_id: Option<String>,
    max_turns: Option<u32>,
) -> Result<String, String> {
    // 1. Look up project path
    // 2. Create agent_session in db
    // 3. Spawn ClaudeProcess in background
    // 4. Return session_id
}
```

**Step 4: Verify — spawn a real Claude Code process and see output stream**

```bash
# From React, call spawn_agent with a simple prompt
# Verify agent:output events arrive in frontend
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Claude Code process manager with streaming output"
```

---

### Task 14: Smart Router — Channel-Based Message Routing

**Files:**
- Create: `hive/src-tauri/src/claude/router.rs`
- Modify: `hive/src-tauri/src/commands/channels.rs` (integrate router on message post)

**Step 1: Build message router**

When a user posts a message to a channel, the router decides what additional action to take:

```rust
pub enum RouteAction {
    None,                              // Just save the message
    QuickAnalysis(String),             // Spawn haiku with this prompt
    Research(String),                   // Spawn haiku researcher
    SpawnAgent(String, String, String), // agent_type, model, prompt
    UpdateTask(String, String),         // task_id, new_status
}

pub fn route_message(channel_slug: &str, content: &str) -> RouteAction {
    match channel_slug {
        "brain-dump" => RouteAction::QuickAnalysis(format!(
            "Analyze this brain dump and extract: 1) action items, 2) key decisions, 3) things to pick up next. Brain dump: {}",
            content
        )),
        "bugs-blockers" => RouteAction::Research(format!(
            "A bug was reported: {}. Search the codebase to find the most relevant files and suggest which agent should handle this.",
            content
        )),
        "pr-reviews" => RouteAction::SpawnAgent(
            "qa".to_string(),
            "claude-sonnet-4-6".to_string(),
            format!("Review this PR: {}", content),
        ),
        _ => RouteAction::None,
    }
}
```

**Step 2: Integrate into post_message — after saving, execute route action**
**Step 3: Verify — post a brain dump, see analysis response appear**
**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add smart message router for channel-based Claude Code dispatch"
```

---

### Task 15: Agent Session Log Viewer

**Files:**
- Create: `hive/src/components/agents/agent-log.tsx`
- Create: `hive/src/components/agents/spawn-dialog.tsx`
- Modify: `hive/src/components/layout/main-panel.tsx` (add agent log view)

**Step 1: Build AgentLog component**

- Shows streaming output from an agent session
- Parses JSON lines to show: text output, tool calls (with file names), thinking
- Auto-scrolls, monospace font
- Status header: agent type, model, started time, current status

**Step 2: Build SpawnDialog**

- Dialog to manually spawn an agent
- Select: agent type (frontend/backend/qa/researcher/general), model (haiku/sonnet/opus)
- Text area for prompt
- Optional: assign to existing task
- Submit calls `spawn_agent` command

**Step 3: Wire clicking agent in sidebar → opens agent log in main panel**
**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add agent session log viewer and spawn dialog"
```

---

## Wave 6: Task/Sprint System (PARALLEL with Wave 7)

### Task 16: Sprint Board + Task Cards

**Files:**
- Create: `hive/src/components/tasks/sprint-board.tsx`
- Create: `hive/src/components/tasks/task-card.tsx`
- Create: `hive/src/components/tasks/sprint-progress.tsx`
- Create: `hive/src/components/tasks/create-task-dialog.tsx`
- Modify: `hive/src/components/layout/status-panel.tsx` (wire sprint progress)

**Step 1: Build TaskCard**

- Subject, status badge, priority badge, assigned-to avatar
- Click to expand description
- Status dropdown to change status
- "Assign to agent" button (triggers spawn_agent)

**Step 2: Build SprintBoard**

- Kanban columns: Pending | In Progress | Completed | Blocked
- Drag-and-drop task cards between columns (updates status via Tauri command)
- Sprint selector dropdown at top
- Task count per column

**Step 3: Build SprintProgress**

- Progress bar (completed / total)
- Stats: X pending, Y in progress, Z completed, W blocked
- Used in status panel sidebar

**Step 4: Build CreateTaskDialog**

- Form: subject, description, priority, sprint, assigned_to
- Creates task via Tauri command

**Step 5: Wire sprint progress into StatusPanel**
**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add sprint board with kanban task cards and progress tracking"
```

---

## Wave 7: Integrations (PARALLEL with Wave 6)

### Task 17: GitHub Integration

**Files:**
- Create: `hive/src-tauri/src/integrations/mod.rs`
- Create: `hive/src-tauri/src/integrations/github.rs`
- Create: `hive/src/components/integrations/github-feed.tsx`
- Modify: `hive/src-tauri/src/lib.rs`

**Step 1: Build GitHub poller in Rust**

Uses `tokio::process::Command` to run `gh` CLI commands:
- `gh pr list --json number,title,state,author,url,createdAt`
- `gh issue list --json number,title,state,assignees,url`
- `gh run list --json status,conclusion,name,url --limit 5`

Polls every 5 minutes. Diffs against previous state. New items get posted to appropriate channels as system messages.

**Step 2: Build GitHub Tauri commands**

- `get_github_prs(project_id)` → Vec<PR>
- `get_github_issues(project_id)` → Vec<Issue>
- `get_github_actions(project_id)` → Vec<Run>

**Step 3: Build GitHubFeed component**

- Cards showing recent PRs, issues, CI runs
- Status badges (open/closed/merged, pass/fail)
- Used in status panel or as its own view

**Step 4: Wire poller to auto-post**

- New PR → #pr-reviews
- CI fail → #bugs-blockers
- Issue assigned → create task

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add GitHub integration with PR, issue, and CI polling"
```

---

### Task 18: Git Watcher

**Files:**
- Create: `hive/src-tauri/src/integrations/git_watcher.rs`
- Create: `hive/src/components/integrations/git-status.tsx`

**Step 1: Build git state watcher**

Uses `notify` crate to watch `.git/HEAD` and `.git/refs/`. On change:
- Read current branch: `git rev-parse --abbrev-ref HEAD`
- Read recent commits: `git log --oneline -5`
- Read uncommitted changes: `git status --porcelain`
- Emit "git:changed" event

**Step 2: Track uncommitted time**

If uncommitted changes persist for >2 hours, post gentle reminder to #brain-dump.

**Step 3: Build GitStatus component**

- Branch name, last commit, uncommitted file count
- Shown in status panel

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add git watcher with branch tracking and uncommitted change alerts"
```

---

## Wave 8: Automation & Scheduling

### Task 19: Cron Scheduler

**Files:**
- Create: `hive/src-tauri/src/automation/mod.rs`
- Create: `hive/src-tauri/src/automation/cron.rs`
- Modify: `hive/src-tauri/src/main.rs` (start scheduler on setup)

**Step 1: Build scheduler with configurable jobs**

Default jobs:
- Morning standup (9:00 AM): Spawns haiku to analyze git log + tasks + brain dumps → posts to #dev-updates
- End-of-day digest (18:00): Summarize today's work → posts to #brain-dump
- Sprint report (Friday 17:00): Sprint analysis → posts to #sprint-tracking
- GitHub poll (every 5 min): Check for new PRs/issues/CI

Jobs stored in project_settings table, configurable per project.

**Step 2: Build Tauri commands for managing scheduled jobs**

- `list_scheduled_jobs(project_id)` → Vec<ScheduledJob>
- `update_scheduled_job(project_id, job_name, cron_expr, enabled)` → ScheduledJob

**Step 3: Verify — set a test cron to run every minute, confirm it fires**
**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add cron scheduler with standup, digest, and sprint report jobs"
```

---

### Task 20: Native macOS Notifications

**Files:**
- Create: `hive/src-tauri/src/automation/notifications.rs`
- Modify: `hive/src-tauri/src/claude/process.rs` (notify on agent complete)
- Modify: `hive/src-tauri/src/integrations/github.rs` (notify on CI fail)

**Step 1: Build notification helper**

```rust
pub fn send_notification(app_handle: &tauri::AppHandle, title: &str, body: &str) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app_handle.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}
```

**Step 2: Wire notifications to events**

- Agent completed task → "Agent completed: [task subject]"
- Build failed → "Build failed: [error summary]"
- New PR → "New PR: [title]"
- Scheduled report ready → "Standup ready in #dev-updates"

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add native macOS notifications for agent completions and alerts"
```

---

## Wave 9: Memory System

### Task 21: Context Injection System

**Files:**
- Create: `hive/src-tauri/src/claude/context.rs`
- Modify: `hive/src-tauri/src/claude/process.rs` (inject context before spawn)

**Step 1: Build context builder**

Before spawning any Claude Code process, gather and inject:

```rust
pub fn build_context(conn: &Connection, project_id: &str) -> String {
    // 1. Get project name, path, git branch
    // 2. Last 5 brain dump messages
    // 3. Open bugs (status != completed from bugs-blockers)
    // 4. Current sprint status
    // 5. Learned patterns for this project
    // 6. Active tasks assigned to the agent type
    // Format as markdown context block
}
```

**Step 2: Inject context as prompt prefix in ClaudeProcess::spawn**
**Step 3: Verify — spawn an agent, confirm it sees project context**
**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add context injection system for Claude Code agent prompts"
```

---

### Task 22: Decision & Pattern Extraction

**Files:**
- Modify: `hive/src-tauri/src/claude/router.rs` (extract decisions from brain dumps)
- Create: `hive/src-tauri/src/commands/memory.rs`

**Step 1: Enhance brain dump analysis**

When Claude Code analyzes a brain dump, include instruction to extract:
- Decisions: "We decided to use X because Y"
- Patterns: "When X happens, do Y because Z"

Parse the analysis response and store in `decisions` and `learned_patterns` tables.

**Step 2: Build memory query commands**

- `search_decisions(db, project_id, query)` → Vec<Decision>
- `list_learned_patterns(db, project_id)` → Vec<LearnedPattern>
- `get_project_graph(db, project_id, entity)` → related items across all tables

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add decision and pattern extraction from brain dumps"
```

---

## Wave 10: Polish & Packaging

### Task 23: Settings Panel

**Files:**
- Create: `hive/src/components/settings/settings-dialog.tsx`

**Step 1: Build settings dialog**

- Default model selection per agent type
- Cron schedule configuration
- Max concurrent agents slider
- GitHub repo configuration
- Notification preferences
- Theme (dark/light/system)

**Step 2: Persist to project_settings table**
**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add settings dialog with project configuration"
```

---

### Task 24: App Icon, Menu Bar, Final Polish

**Files:**
- Modify: `hive/src-tauri/tauri.conf.json` (app metadata)
- Create: `hive/src-tauri/icons/` (app icon)
- Modify: `hive/src/App.tsx` (loading state, error boundaries)

**Step 1: Design app icon (honeycomb/hive motif)**
**Step 2: Configure Tauri app metadata (name, identifier, version)**
**Step 3: Add loading states and error boundaries**
**Step 4: Build DMG for macOS**

```bash
cd hive && npm run tauri build
```

**Step 5: Final commit**

```bash
git add -A && git commit -m "feat: add app icon, metadata, and production build"
```

---

## Dependency Graph

```
Wave 1: [Task 1] ──────────────────────────────────────────────┐
                                                                │
Wave 2: [Task 2] → [Task 3] ──┬──→ [Task 4]                   │
                               │                                │
                               └──→ [Task 5] → [Task 6]        │
                                                                │
Wave 3: [Task 7] ──┐                                           │
        [Task 8] ──┼── (parallel, all need Wave 2)             │
        [Task 9] ──┘                                           │
                                                                │
Wave 4: [Task 10] → [Task 11] → [Task 12]                     │
        (needs Wave 3)                                          │
                                                                │
Wave 5: [Task 13] → [Task 14] → [Task 15]                     │
        (needs Wave 2 + Wave 3)                                 │
                                                                │
Wave 6: [Task 16]  ──┐                                         │
                      ├── (parallel, both need Wave 4 + 5)     │
Wave 7: [Task 17] ──┤                                         │
        [Task 18] ──┘                                          │
                                                                │
Wave 8: [Task 19] → [Task 20]                                  │
        (needs Wave 5 + 7)                                      │
                                                                │
Wave 9: [Task 21] → [Task 22]                                  │
        (needs Wave 5)                                          │
                                                                │
Wave 10: [Task 23] → [Task 24]                                 │
         (needs everything)                                     │
```

## Total: 24 Tasks across 10 Waves
