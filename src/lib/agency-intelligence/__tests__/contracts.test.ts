import { describe, it, expect } from 'vitest';
import {
  Evidence,
  EvidenceKind,
  CorpusSnapshot,
  CorpusClientSnapshot,
  CorpusClientCurrent,
  RefreshRun,
  AgencyInsight,
  parseCorpusClientFile,
  corpusFileLocator,
  dbRowLocator,
} from '../contracts';

// RFC 4122 variant: 4th group must start with 8/9/a/b.
const UUID = '11111111-1111-1111-8111-111111111111';
const ALT_UUID = '22222222-2222-2222-8222-222222222222';

describe('Evidence', () => {
  it.each(EvidenceKind.options as readonly string[])('accepts kind "%s"', (kind) => {
    const ev = {
      kind,
      locator: { type: 'db_row', table: 'landing_events', id: UUID },
      summary: 'a recorded event',
    };
    expect(() => Evidence.parse(ev)).not.toThrow();
  });

  it('accepts a corpus_file locator with a json pointer', () => {
    const ev = Evidence.parse({
      kind: 'corpus_action',
      locator: { type: 'corpus_file', path: 'corpus/clients/checkle.json', pointer: '/actions/3' },
      summary: 'Build Creative Brief',
    });
    expect(ev.locator.type).toBe('corpus_file');
  });

  it('rejects an unknown evidence kind', () => {
    expect(() =>
      Evidence.parse({
        kind: 'not_a_kind',
        locator: { type: 'db_row', table: 't', id: UUID },
        summary: 'x',
      })
    ).toThrow();
  });

  it('rejects a db_row locator with a non-uuid id', () => {
    expect(() =>
      Evidence.parse({
        kind: 'landing_event',
        locator: { type: 'db_row', table: 't', id: 'not-a-uuid' },
        summary: 'x',
      })
    ).toThrow();
  });

  it('rejects evidence without a summary', () => {
    expect(() =>
      Evidence.parse({
        kind: 'landing_event',
        locator: { type: 'db_row', table: 't', id: UUID },
      })
    ).toThrow();
  });

  it('rejects a locator that is neither db_row nor corpus_file', () => {
    expect(() =>
      Evidence.parse({
        kind: 'landing_event',
        locator: { type: 'web_url', url: 'https://x' },
        summary: 'x',
      })
    ).toThrow();
  });
});

describe('locator helpers', () => {
  it('corpusFileLocator builds a corpus_file locator', () => {
    expect(corpusFileLocator('corpus/clients/anura.json', '/promises/0')).toEqual({
      type: 'corpus_file',
      path: 'corpus/clients/anura.json',
      pointer: '/promises/0',
    });
  });
  it('dbRowLocator builds a db_row locator', () => {
    expect(dbRowLocator('landing_events', UUID, 'event_key')).toEqual({
      type: 'db_row',
      table: 'landing_events',
      id: UUID,
      column: 'event_key',
    });
  });
});

describe('CorpusSnapshot', () => {
  it('parses a valid snapshot', () => {
    const snap = CorpusSnapshot.parse({
      refresh_run_id: UUID,
      manifest_hash: 'sha256:abc',
      client_count: 42,
      index_json: { clients: [{ slug: 'anura', client: 'Anura', risk_tier: 'green' }] },
      captured_at: '2026-06-18T09:00:00Z',
    });
    expect(snap.client_count).toBe(42);
    expect(snap.index_json.clients[0]?.slug).toBe('anura');
  });
  it('rejects a negative client_count', () => {
    expect(() =>
      CorpusSnapshot.parse({
        refresh_run_id: UUID,
        manifest_hash: 'h',
        client_count: -1,
        index_json: { clients: [] },
        captured_at: '2026-06-18T09:00:00Z',
      })
    ).toThrow();
  });
});

describe('CorpusClientSnapshot', () => {
  it('defaults counts to 0 and source_counts to {}', () => {
    const s = CorpusClientSnapshot.parse({
      refresh_run_id: UUID,
      snapshot_id: ALT_UUID,
      client_slug: 'checkle',
      client_json: { client: 'Checkle' },
      captured_at: '2026-06-18T09:00:00Z',
    });
    expect(s.actions_count).toBe(0);
    expect(s.promises_count).toBe(0);
    expect(s.gaps_count).toBe(0);
    expect(s.fathom_meetings_count).toBe(0);
    expect(s.source_counts).toEqual({});
  });
  it('rejects a negative promises_count', () => {
    expect(() =>
      CorpusClientSnapshot.parse({
        refresh_run_id: UUID,
        snapshot_id: ALT_UUID,
        client_slug: 'checkle',
        client_json: {},
        promises_count: -3,
        captured_at: '2026-06-18T09:00:00Z',
      })
    ).toThrow();
  });
});

describe('CorpusClientCurrent', () => {
  it('requires client_slug', () => {
    expect(() =>
      CorpusClientCurrent.parse({
        manifest_hash: 'h',
        client_json: {},
        captured_at: '2026-06-18T09:00:00Z',
        updated_at: '2026-06-18T09:00:00Z',
      })
    ).toThrow();
  });
  it('parses a valid current row', () => {
    const c = CorpusClientCurrent.parse({
      client_slug: 'checkle',
      manifest_hash: 'h',
      risk_tier: 'green',
      churn_score: 3,
      client_json: { client: 'Checkle' },
      captured_at: '2026-06-18T09:00:00Z',
      updated_at: '2026-06-18T09:00:00Z',
    });
    expect(c.client_slug).toBe('checkle');
    expect(c.churn_score).toBe(3);
  });
});

describe('RefreshRun', () => {
  it('parses a valid running sync run', () => {
    const r = RefreshRun.parse({
      run_kind: 'corpus_sync',
      status: 'running',
      manifest_hash: 'h',
      client_count: 42,
      started_at: '2026-06-18T09:00:00Z',
    });
    expect(r.dry_run).toBe(false);
    expect(r.source_metadata).toEqual({});
  });
  it('rejects an unknown status', () => {
    expect(() =>
      RefreshRun.parse({
        run_kind: 'corpus_sync',
        status: 'paused',
        manifest_hash: 'h',
        client_count: 1,
        started_at: '2026-06-18T09:00:00Z',
      })
    ).toThrow();
  });
  it('rejects an unknown run_kind', () => {
    expect(() =>
      RefreshRun.parse({
        run_kind: 'partial',
        status: 'running',
        manifest_hash: 'h',
        client_count: 1,
        started_at: '2026-06-18T09:00:00Z',
      })
    ).toThrow();
  });
});

describe('AgencyInsight', () => {
  const validInsight = {
    client_slug: 'checkle',
    insight_kind: 'client_health',
    severity: 'warning',
    headline: 'Tracker installed, zero conversion events',
    body: 'No landing_events in 14 days despite tracker_status=installed.',
    evidence: [
      {
        kind: 'site_registry',
        locator: { type: 'db_row', table: 'agency_client_sites', id: UUID },
        summary: 'site tracker_status=installed',
      },
      {
        kind: 'landing_event',
        locator: { type: 'db_row', table: 'landing_events', id: UUID },
        summary: 'zero rows observed',
      },
    ],
    generated_at: '2026-06-18T09:00:00Z',
  };

  it('parses a valid insight with evidence', () => {
    const i = AgencyInsight.parse(validInsight);
    expect(i.evidence).toHaveLength(2);
    expect(i.source_metadata).toEqual({});
  });
  it('rejects an insight with empty evidence', () => {
    expect(() =>
      AgencyInsight.parse({ ...validInsight, evidence: [] })
    ).toThrow();
  });
  it('rejects an insight with an unknown severity', () => {
    expect(() =>
      AgencyInsight.parse({ ...validInsight, severity: 'blocker' })
    ).toThrow();
  });
  it('rejects an insight with an unknown insight_kind', () => {
    expect(() =>
      AgencyInsight.parse({ ...validInsight, insight_kind: 'sales_call_prep' })
    ).toThrow();
  });
});

describe('CorpusClientFile', () => {
  it('parses the Checkle-shaped file and defaults missing arrays', () => {
    const f = parseCorpusClientFile({
      client: 'Checkle',
      actions: [{ action: { value: 'Build Creative Brief' } }],
      promises: [{ made_by: { value: 'x' } }],
      gaps: [],
      fathom_meetings: [{ recording_id: '120601620' }],
      risk: { tier: 'green', churn_score: 3, gap_score: 0 },
    });
    expect(f.client).toBe('Checkle');
    expect(f.actions).toHaveLength(1);
    expect(f.risk?.churn_score).toBe(3);
    expect(f.calls).toEqual([]);
  });
  it('rejects a file missing the client name', () => {
    expect(() => parseCorpusClientFile({ actions: [] })).toThrow();
  });
});