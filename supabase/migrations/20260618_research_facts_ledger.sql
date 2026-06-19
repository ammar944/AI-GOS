-- Append-only evidence ledger for the research-OS rebuild (P0.2c).
-- Every promoted research fact pins a load-bearing claim to a live http(s)
-- source. The ledger is the durable record the readiness gate, deck compiler,
-- and deterministic liar-catcher all read from. Append-only in P0 — NO unique
-- constraint (dedup is a later phase), one INSERT per fact.

create table if not exists public.research_facts (
  id uuid primary key default gen_random_uuid(),
  run_id text,
  parent_audit_run_id text,
  section_id text,
  fact_kind text not null,
  source_url text not null,
  source_quote text not null,
  claim_token text not null,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_research_facts_parent_audit_run_id
  on public.research_facts (parent_audit_run_id);

comment on table public.research_facts is
  'Append-only research evidence ledger: each row pins a load-bearing claim to a live http(s) source.';

comment on column public.research_facts.source_url is
  'NOT NULL http(s) source page for the fact — the ledger refuses unsourced claims at the boundary.';

comment on column public.research_facts.claim_token is
  'A token that is a substring of source_quote, used by the deterministic liar-catcher containment check.';

alter table public.research_facts enable row level security;

-- service_role (research worker / in-process lab engine writers) owns writes;
-- end-user JWTs bypass RLS, so revoke PUBLIC first then grant only service_role.
revoke all on public.research_facts from public, anon, authenticated;
grant select, insert on public.research_facts to service_role;
