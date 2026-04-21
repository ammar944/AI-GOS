# Task 1.5: Supabase Migration — journey_sessions Table

## Objective

Create the `journey_sessions` table in Supabase via migration. This stores session state for the /journey chat. Schema defined in DISCOVERY.md D7.

## Context

Phase 1 foundational task. Supabase is the persistence layer from day 1 (DISCOVERY.md D6). Sessions are created on first user message (D9). The table uses JSONB for messages to keep the schema minimal.

## Dependencies

- None

## Blocked By

- None

## Research Findings

- From DISCOVERY.md D7: Single table, JSONB messages column.
- From DISCOVERY.md D8: Service role + Clerk ID. Use Supabase service role key in API routes (bypasses RLS). Filter by `user_id = clerk_user_id`.
- From DISCOVERY.md D9: Session created on first message, not on page load.
- From DISCOVERY.md D10: Phase stored in `journey_sessions.phase` column.

## Implementation Plan

### Step 1: Apply migration via Supabase MCP

Use the Supabase MCP `apply_migration` tool with the following SQL:

```sql
-- Journey Sessions table for AI-GOS v2
create table if not exists journey_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  phase text default 'setup',
  messages jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast user lookups
create index if not exists idx_journey_sessions_user_id on journey_sessions(user_id);

-- Auto-update updated_at timestamp
create or replace function update_journey_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger journey_sessions_updated_at
  before update on journey_sessions
  for each row
  execute function update_journey_sessions_updated_at();
```

### Step 2: Verify table creation

Use Supabase MCP `execute_sql` to verify:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'journey_sessions'
order by ordinal_position;
```

### Step 3: Test insert and select

```sql
-- Insert test row
insert into journey_sessions (user_id, phase, messages)
values ('test-user-123', 'setup', '[]'::jsonb)
returning *;

-- Verify defaults
select * from journey_sessions where user_id = 'test-user-123';

-- Clean up
delete from journey_sessions where user_id = 'test-user-123';
```

## Files to Create

- Supabase migration (applied via MCP, not a local file)

## Contracts

### Provides (for downstream tasks)

- Table `journey_sessions` with columns:
  - `id` (uuid, PK, auto-generated)
  - `user_id` (text, not null) — Clerk user ID
  - `phase` (text, default 'setup')
  - `messages` (jsonb, default '[]')
  - `metadata` (jsonb, default '{}')
  - `created_at` (timestamptz, auto)
  - `updated_at` (timestamptz, auto-updated on modification)
- Index `idx_journey_sessions_user_id`

### Consumes (from upstream tasks)

- None

## Acceptance Criteria

- [ ] Table `journey_sessions` exists in Supabase
- [ ] All columns have correct types and defaults
- [ ] `user_id` index exists
- [ ] Insert with only `user_id` succeeds (defaults work)
- [ ] `updated_at` auto-updates on row modification
- [ ] No RLS policies needed (service role bypasses RLS per D8)

## Testing Protocol

### External Service Verification

- [ ] Supabase MCP: `list_tables` includes `journey_sessions`
- [ ] Supabase MCP: `execute_sql` — insert test row, verify defaults, delete
- [ ] Supabase MCP: `execute_sql` — update row, verify `updated_at` changes

## Skills to Read

- None specific

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/DISCOVERY.md` — D6, D7, D8, D9, D10

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.5:`
