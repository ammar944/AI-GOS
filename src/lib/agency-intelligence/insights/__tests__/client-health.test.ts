import { describe, it, expect } from 'vitest';
import { computeClientHealth, type ClientHealthInput } from '../client-health';

const SITE_UUID = '33333333-3333-3333-8333-333333333333';
const SITE_UUID_2 = '44444444-4444-4444-8444-444444444444';
const GEN_AT = '2026-06-18T15:00:00Z';

function corpus(slug: string, over: Partial<ClientHealthInput['corpus']> = {}) {
  return {
    client_slug: slug,
    client_display_name: slug.charAt(0).toUpperCase() + slug.slice(1),
    risk_tier: 'green' as string | null,
    churn_score: 3 as number | null,
    gap_score: 0 as number | null,
    actions_count: 19,
    promises_count: 24,
    gaps_count: 0,
    fathom_meetings_count: 2,
    corpus_file_path: `corpus/clients/${slug}.json`,
    ...over,
  };
}

function tracker(
  slug: string,
  sites: ClientHealthInput['tracker']['sites'],
  over: Partial<ClientHealthInput['tracker']> = {}
) {
  const total_events = sites.reduce((a, s) => a + s.event_count, 0);
  const total_rejections = sites.reduce((a, s) => a + s.rejection_count, 0);
  return { client_slug: slug, sites, total_events, total_rejections, ...over };
}

function input(slug: string, t: ClientHealthInput['tracker'], c: ClientHealthInput['corpus']): ClientHealthInput {
  return { client_slug: slug, tracker: t, corpus: c, generated_at: GEN_AT };
}

describe('computeClientHealth — severity', () => {
  it('critical: tracker installed + zero events + corpus at-risk', () => {
    const i = input(
      'checkle',
      tracker('checkle', [
        { site_slug: 'www', site_id: SITE_UUID, tracker_status: 'installed', event_count: 0, last_event_at: null, rejection_count: 0 },
      ]),
      corpus('checkle', { risk_tier: 'red', churn_score: 6 })
    );
    const out = computeClientHealth(i);
    expect(out.severity).toBe('critical');
    expect(out.insight_kind).toBe('client_health');
    expect(out.headline).toMatch(/zero conversion events/);
    expect(out.headline).toMatch(/at-risk/i);
  });

  it('warning: tracker installed + zero events, corpus healthy', () => {
    const i = input(
      'anura',
      tracker('anura', [
        { site_slug: 'www', site_id: SITE_UUID, tracker_status: 'verified', event_count: 0, last_event_at: null, rejection_count: 0 },
      ]),
      corpus('anura', { risk_tier: 'green', churn_score: 0 })
    );
    const out = computeClientHealth(i);
    expect(out.severity).toBe('warning');
    expect(out.headline).toMatch(/zero conversion events on 1 site/);
  });

  it('warning: corpus at-risk with events flowing', () => {
    const i = input(
      'zuppler',
      tracker('zuppler', [
        { site_slug: 'app', site_id: SITE_UUID, tracker_status: 'verified', event_count: 12, last_event_at: '2026-06-17T10:00:00Z', rejection_count: 1 },
      ]),
      corpus('zuppler', { risk_tier: 'amber', churn_score: 7 })
    );
    const out = computeClientHealth(i);
    expect(out.severity).toBe('warning');
    expect(out.headline).toMatch(/corpus flags at-risk/);
  });

  it('info: tracker active, corpus healthy', () => {
    const i = input(
      'worksavi',
      tracker('worksavi', [
        { site_slug: 'www', site_id: SITE_UUID, tracker_status: 'verified', event_count: 40, last_event_at: '2026-06-18T09:00:00Z', rejection_count: 0 },
      ]),
      corpus('worksavi', { risk_tier: 'green', churn_score: 3 })
    );
    const out = computeClientHealth(i);
    expect(out.severity).toBe('info');
    expect(out.headline).toMatch(/tracker active with 40 event/);
  });

  it('info: no tracker sites registered', () => {
    const i = input('coda', tracker('coda', []), corpus('coda'));
    const out = computeClientHealth(i);
    expect(out.severity).toBe('info');
    expect(out.headline).toMatch(/no tracker sites registered/);
  });
});

describe('computeClientHealth — evidence', () => {
  it('cites a site_registry + landing_event per site and all corpus kinds', () => {
    const i = input(
      'checkle',
      tracker('checkle', [
        { site_slug: 'www', site_id: SITE_UUID, tracker_status: 'installed', event_count: 0, last_event_at: null, rejection_count: 0 },
        { site_slug: 'lp', site_id: SITE_UUID_2, tracker_status: 'verified', event_count: 5, last_event_at: '2026-06-17T10:00:00Z', rejection_count: 2 },
      ]),
      corpus('checkle')
    );
    const out = computeClientHealth(i);
    const kinds = out.evidence.map((e) => e.kind);
    expect(kinds.filter((k) => k === 'site_registry')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'landing_event')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'landing_rejection')).toHaveLength(1);
    expect(kinds).toContain('corpus_client');
    expect(kinds).toContain('corpus_action');
    expect(kinds).toContain('corpus_promise');
    expect(kinds).toContain('corpus_gap');
    expect(kinds).toContain('corpus_call');
  });

  it('is honest about absent events — zero-event site evidence states 0 rows observed', () => {
    const i = input(
      'checkle',
      tracker('checkle', [
        { site_slug: 'www', site_id: SITE_UUID, tracker_status: 'installed', event_count: 0, last_event_at: null, rejection_count: 0 },
      ]),
      corpus('checkle')
    );
    const out = computeClientHealth(i);
    const zeroEv = out.evidence.find(
      (e) => e.kind === 'landing_event' && e.summary.includes('0 landing_events rows observed')
    );
    expect(zeroEv).toBeDefined();
    expect(zeroEv?.locator.type).toBe('db_row');
    if (zeroEv?.locator.type === 'db_row') {
      expect(zeroEv.locator.table).toBe('agency_client_sites');
      expect(zeroEv.locator.id).toBe(SITE_UUID);
    }
  });

  it('corpus locators are corpus_file with resolvable paths + pointers', () => {
    const i = input('checkle', tracker('checkle', []), corpus('checkle'));
    const out = computeClientHealth(i);
    const cc = out.evidence.find((e) => e.kind === 'corpus_client');
    expect(cc?.locator.type).toBe('corpus_file');
    if (cc?.locator.type === 'corpus_file') {
      expect(cc.locator.path).toBe('corpus/clients/checkle.json');
    }
    const promises = out.evidence.find((e) => e.kind === 'corpus_promise');
    if (promises?.locator.type === 'corpus_file') {
      expect(promises.locator.pointer).toBe('/promises');
    }
  });

  it('evidence is non-empty even with no sites (corpus-only)', () => {
    const i = input('coda', tracker('coda', []), corpus('coda'));
    const out = computeClientHealth(i);
    expect(out.evidence.length).toBeGreaterThanOrEqual(5);
  });

  it('body reports both truths and names the zero-event sites', () => {
    const i = input(
      'checkle',
      tracker('checkle', [
        { site_slug: 'www', site_id: SITE_UUID, tracker_status: 'installed', event_count: 0, last_event_at: null, rejection_count: 0 },
      ]),
      corpus('checkle', { churn_score: 3 })
    );
    const out = computeClientHealth(i);
    expect(out.body).toMatch(/Tracker truth: 1 site\(s\), 0 total event\(s\), 0 rejection\(s\)\. Sites with tracker installed but zero events: www\./);
    expect(out.body).toMatch(/Corpus truth: risk_tier=green, churn_score=3/);
  });

  it('threads refresh_run_id and source_metadata through', () => {
    const i = input('checkle', tracker('checkle', []), corpus('checkle'));
    i.refresh_run_id = '55555555-5555-5555-8555-555555555555';
    const out = computeClientHealth(i);
    expect(out.refresh_run_id).toBe('55555555-5555-5555-8555-555555555555');
    expect(out.source_metadata.tracker_total_events).toBe(0);
    expect(out.source_metadata.corpus_risk_tier).toBe('green');
  });

  it('is deterministic — same input yields identical output', () => {
    const i = input(
      'checkle',
      tracker('checkle', [
        { site_slug: 'www', site_id: SITE_UUID, tracker_status: 'installed', event_count: 0, last_event_at: null, rejection_count: 0 },
      ]),
      corpus('checkle', { churn_score: 6, risk_tier: 'red' })
    );
    const a = computeClientHealth(i);
    const b = computeClientHealth(i);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});