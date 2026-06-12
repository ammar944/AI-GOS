-- Adds the run-level evidence pool column that Wave 6 (ae95460c) shipped code
-- for without schema. src/lib/lab-engine/evidence/evidence-pool.ts reads and
-- writes research_artifacts.data; without this column every section run logs
-- "[lab-section] evidence pool read failed ... 42703" and executes with an
-- empty evidence pool (silent quality degradation, observed on every run since
-- 2026-06-11 including f3993043).
--
-- Additive and nullable: existing rows are unaffected; the evidence-pool code
-- treats null as "no pool yet".

alter table public.research_artifacts
  add column if not exists data jsonb;

comment on column public.research_artifacts.data is
  'Run-level evidence pool (lab-engine Wave 6): shared tool-evidence excerpts appended per section, read at prompt build. Null = no pool.';
