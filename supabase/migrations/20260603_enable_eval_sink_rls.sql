-- Stage 0 hardening: eval sink tables should not be anonymously readable.
-- Worker/admin writes continue through the service role, which bypasses RLS.

alter table public.research_telemetry enable row level security;
alter table public.research_results_shadow enable row level security;
alter table public.research_eval_diffs enable row level security;
