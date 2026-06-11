# AGENTS.md - supabase

## Purpose

- Owns database schema, migrations, SQL functions, RLS policies, realtime-related SQL, and Supabase maintenance scripts.

## Ownership

- `migrations/` owns ordered SQL migrations.
- `schema.sql` owns the schema snapshot when maintained.
- `scripts/` owns Supabase-specific backfill/maintenance scripts.

## Local Contracts

- Treat migrations as append-only once applied unless the task explicitly asks for repair of unapplied local migrations.
- Coordinate schema changes with app contracts in `src/lib/research-v2/`, `src/lib/journey/`, `src/lib/profiles/`, and worker contracts when relevant.
- Preserve RLS and security-definer intent. Do not weaken policies without explicit approval.
- DB truth is the durable proof layer for research runs and artifacts.

## Work Guidance

- Include rollback or repair considerations in migration comments when risk is high.
- Keep SQL function names and column names stable for existing app code.
- Backfills must be idempotent or clearly scoped.

## Verification

- Run affected app/worker tests that query changed tables or functions.
- Use Supabase/local DB verification when available; otherwise report exactly what could not be run.

## Child DOX Index

- No child `AGENTS.md` files yet.
