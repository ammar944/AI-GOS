-- Migration: GTM Brief tables (Phase 1, contract-only)
-- Date: 2026-04-24
-- Run via Supabase dashboard SQL Editor.
-- Canonical spec: docs/superpowers/specs/2026-04-24-gtm-brief-architecture.md

-- gtm_briefs: the mutable working brief, one per client run-set.
CREATE TABLE IF NOT EXISTS gtm_briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gtm_briefs IS
  'Canonical GTM Brief working record. Source of truth for a SaaS client run-set.';
COMMENT ON COLUMN gtm_briefs.fields IS
  'Map of GtmBriefFieldKey -> GtmBriefField. Validated by src/lib/gtm/schemas/gtm-brief.ts.';

CREATE INDEX IF NOT EXISTS idx_gtm_briefs_user_id ON gtm_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_gtm_briefs_client_id ON gtm_briefs(client_id);

-- gtm_brief_snapshots: immutable snapshots. One per GtmRun.
CREATE TABLE IF NOT EXISTS gtm_brief_snapshots (
  id TEXT PRIMARY KEY,
  parent_brief_id TEXT NOT NULL REFERENCES gtm_briefs(id) ON DELETE RESTRICT,
  fields JSONB NOT NULL,
  brief_created_at TIMESTAMPTZ NOT NULL,
  brief_updated_at TIMESTAMPTZ NOT NULL,
  snapshot_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gtm_brief_snapshots IS
  'Immutable snapshot of a GTM Brief. A GtmRun reads from a snapshot, never the live brief.';
COMMENT ON COLUMN gtm_brief_snapshots.fields IS
  'Frozen copy of gtm_briefs.fields at snapshot_created_at. Validated by src/lib/gtm/schemas/gtm-brief-snapshot.ts.';

CREATE INDEX IF NOT EXISTS idx_gtm_brief_snapshots_parent ON gtm_brief_snapshots(parent_brief_id);

-- gtm_runs: one execution pass from locked snapshot to scripts.
CREATE TABLE IF NOT EXISTS gtm_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT,
  brief_id TEXT NOT NULL REFERENCES gtm_briefs(id) ON DELETE RESTRICT,
  brief_snapshot_id TEXT NOT NULL REFERENCES gtm_brief_snapshots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft',
  current_stage TEXT NOT NULL DEFAULT 'discover-url',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gtm_runs_status_check CHECK (status IN ('draft', 'running', 'needs_review', 'completed', 'failed')),
  CONSTRAINT gtm_runs_stage_check CHECK (current_stage IN (
    'discover-url','enrich-brief','review-brief','lock-brief',
    'research-market-category','research-buyer-icp','research-competitors','research-voc',
    'research-demand-intent','research-offer-funnel',
    'synthesize-strategy','generate-media-plan','generate-scripts'
  ))
);

COMMENT ON TABLE gtm_runs IS
  'One execution of the GTM workflow, anchored to an immutable brief snapshot.';

CREATE INDEX IF NOT EXISTS idx_gtm_runs_user_id ON gtm_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_brief_id ON gtm_runs(brief_id);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_snapshot_id ON gtm_runs(brief_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_status ON gtm_runs(status);
