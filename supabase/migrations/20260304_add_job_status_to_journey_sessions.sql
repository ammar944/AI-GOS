-- Add job_status column to journey_sessions for Railway worker job tracking.
-- This is written BEFORE the worker returns 202, so crashed jobs leave a
-- detectable 'running' record rather than silently disappearing.
-- Format: { [jobId]: { status, tool, startedAt, completedAt?, error? } }

alter table journey_sessions
  add column if not exists job_status jsonb default '{}'::jsonb;

comment on column journey_sessions.job_status is
  'Tracks Railway worker job lifecycle. Keys are jobIds. Values: { status: running|complete|error, tool, startedAt, completedAt?, error? }. A stuck "running" entry indicates a worker crash.';
