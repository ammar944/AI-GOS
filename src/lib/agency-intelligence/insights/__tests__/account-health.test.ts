import { describe, it, expect } from 'vitest';
import {
  computeAccountHealth,
  compareAccountHealth,
  readLaunched,
  readDeliverableProgress,
  readSentiment,
  readUnownedOpenActions,
  readOnboardingDate,
  weeksSince,
  readCorpusRiskSignalsHigh,
  readCorpusIncidents,
  type AccountHealthInput,
  type FathomSignalLite,
  type AccountHealth,
} from '../account-health';

// Deterministic as-of for every fixture (spec §7).
const GEN_AT = '2026-05-20T00:00:00Z';

// ---------------------------------------------------------------------------
// client_json builders (corpus envelope shapes — { quote, source_id, value }).
// ---------------------------------------------------------------------------

function env(value: unknown): { quote: string; source_id: string; value: unknown } {
  return { quote: String(value), source_id: 'fixture', value };
}

function deliverable(status: string): Record<string, unknown> {
  return { item: env(status), quote: status, source_id: 'fixture', status: env(status) };
}

function action(owner: string): Record<string, unknown> {
  return {
    action: env('do thing'),
    owner: env(owner),
    priority: '',
    clickup_ready: true,
    quote: 'do thing',
    source_id: 'fixture',
  };
}

function meeting(date: string): Record<string, unknown> {
  return {
    call_type: 'sales',
    date,
    matched_by: 'domain',
    recording_id: '1',
    source_path: 'x',
    title: 't',
  };
}

function riskSignal(severity: string, quote: string): Record<string, unknown> {
  return {
    quote,
    severity: env(severity),
    signal: env(quote),
    source_id: 'fixture',
  };
}

function incident(type: string): Record<string, unknown> {
  return { quote: 'incident text', source_id: 'fixture', type: env(type) };
}

interface CorpusBuild {
  launched?: boolean;
  deliverables?: string[];
  sentiment?: 'pos' | 'neg' | 'neutral';
  actions?: string[]; // owner strings; '' = unowned
  meetingDates?: string[];
  riskSignals?: Array<{ severity: string; quote: string }>;
  incidents?: string[]; // type values
}

function buildClientJson(b: CorpusBuild): Record<string, unknown> {
  return {
    delivery: {
      launched: b.launched,
      clickup_status: '',
      deliverables: (b.deliverables ?? []).map(deliverable),
      time_tracked_ms: 0,
    },
    sentiment: b.sentiment ? { latest: env(b.sentiment) } : { latest: env('neutral') },
    actions: (b.actions ?? []).map(action),
    fathom_meetings: (b.meetingDates ?? []).map(meeting),
    risk: {
      churn_score: 0,
      gap_score: 0,
      incidents: (b.incidents ?? []).map(incident),
      signals: (b.riskSignals ?? []).map((s) => riskSignal(s.severity, s.quote)),
      scoring_note: '',
    },
  };
}

function sig(over: Partial<FathomSignalLite> & Pick<FathomSignalLite, 'signal_type' | 'severity'>): FathomSignalLite {
  return {
    quote: 'placeholder verbatim transcript quote here',
    speaker: 'Client CEO',
    call_date: '2026-05-13T00:00:00Z',
    recording_id: '146193190',
    share_url: null,
    ...over,
  };
}

function input(
  slug: string,
  over: Partial<AccountHealthInput> & { client_json: Record<string, unknown> }
): AccountHealthInput {
  return {
    client_slug: slug,
    client_display_name: slug,
    churn_score: 0,
    risk_tier: 'green',
    fathom_signals: [],
    generated_at: GEN_AT,
    ...over,
  };
}

// A date far enough before GEN_AT that weeksSince >= 6 (≈10 weeks).
const TEN_WEEKS_AGO = '2026-03-11T00:00:00Z';
// ≈5 weeks before GEN_AT.
const FIVE_WEEKS_AGO = '2026-04-15T00:00:00Z';

// ===========================================================================
// Pure readers
// ===========================================================================

describe('pure corpus readers', () => {
  it('readLaunched returns the raw boolean or null', () => {
    expect(readLaunched(buildClientJson({ launched: false }))).toBe(false);
    expect(readLaunched(buildClientJson({ launched: true }))).toBe(true);
    expect(readLaunched({})).toBeNull();
    expect(readLaunched({ delivery: { launched: 'yes' } })).toBeNull();
  });

  it('readDeliverableProgress normalizes done vocab incl. emoji strip + empty status', () => {
    const cj = buildClientJson({
      deliverables: ['complete', 'Completed', 'DONE', '✅ closed', 'live', '🚀 launched', 'in progress', ''],
    });
    const p = readDeliverableProgress(cj);
    expect(p.total).toBe(8);
    expect(p.done).toBe(6); // complete, completed, done, closed, live, launched
    expect(p.ratio).toBeCloseTo(6 / 8, 5);
  });

  it('readDeliverableProgress ratio is null when no deliverables', () => {
    expect(readDeliverableProgress(buildClientJson({})).ratio).toBeNull();
  });

  it('readSentiment matches "neg" exactly', () => {
    expect(readSentiment(buildClientJson({ sentiment: 'neg' }))).toBe('neg');
    expect(readSentiment(buildClientJson({ sentiment: 'pos' }))).toBe('pos');
    expect(readSentiment(buildClientJson({ sentiment: 'neutral' }))).toBe('neutral');
    expect(readSentiment({ sentiment: { latest: env('negative') } })).toBeNull();
  });

  it('readUnownedOpenActions counts empty owner values', () => {
    const cj = buildClientJson({ actions: ['', '  ', 'Wasam', ''] });
    expect(readUnownedOpenActions(cj)).toBe(3);
  });

  it('readOnboardingDate returns the earliest fathom meeting date', () => {
    const cj = buildClientJson({
      meetingDates: ['2026-04-01T00:00:00Z', '2026-02-07T00:00:00Z', '2026-03-15T00:00:00Z'],
    });
    expect(readOnboardingDate(cj)).toBe('2026-02-07T00:00:00Z');
    expect(readOnboardingDate(buildClientJson({}))).toBeNull();
  });

  it('weeksSince computes fractional weeks and null on missing date', () => {
    expect(weeksSince('2026-05-13T00:00:00Z', GEN_AT)).toBeCloseTo(1, 1);
    expect(weeksSince(null, GEN_AT)).toBeNull();
  });

  it('readCorpusRiskSignalsHigh is conservative: high sev AND churn language', () => {
    expect(
      readCorpusRiskSignalsHigh(
        buildClientJson({ riskSignals: [{ severity: 'high', quote: 'it feels like I have wasted $10K' }] })
      )
    ).toBe(true);
    // high severity but benign language (contract boilerplate) -> false
    expect(
      readCorpusRiskSignalsHigh(
        buildClientJson({ riskSignals: [{ severity: 'high', quote: 'Complete Offer Risk Assessment' }] })
      )
    ).toBe(false);
    // churn language but only medium severity -> false
    expect(
      readCorpusRiskSignalsHigh(
        buildClientJson({ riskSignals: [{ severity: 'medium', quote: 'we want a refund' }] })
      )
    ).toBe(false);
  });

  it('readCorpusIncidents counts high-sev incident types (low-trust, count only)', () => {
    const cj = buildClientJson({
      incidents: ['cross_client_data_leak', 'security_or_account', 'account_compromise', 'slack_incident'],
    });
    expect(readCorpusIncidents(cj).highSevCount).toBe(3);
  });
});

// ===========================================================================
// Fixtures F1–F13
// ===========================================================================

describe('computeAccountHealth — fixtures F1–F13', () => {
  // F1 Zuppler — high verbal churn_escalation. Headline override test.
  it('F1 Zuppler → critical despite churn=3 (high_verbal_churn_escalation, score 126)', () => {
    const out = computeAccountHealth(
      input('zuppler', {
        churn_score: 3,
        client_json: buildClientJson({ launched: false, sentiment: 'neutral' }),
        fathom_signals: [
          sig({
            signal_type: 'churn_escalation',
            severity: 'high',
            recording_id: '146193190',
            quote: 'absolutely not happy with the responsiveness from your team',
          }),
        ],
      })
    );
    expect(out.tier).toBe('critical');
    expect(out.score).toBe(126);
    expect(out.drivers[0].code).toBe('high_verbal_churn_escalation');
    expect(out.last_signal?.type).toBe('churn_escalation');
  });

  // F2 PathfinderCRO (verbal) — high payment_risk. score 116.
  it('F2 PathfinderCRO (verbal) → critical (high_verbal_payment_risk, score 116)', () => {
    const out = computeAccountHealth(
      input('pathfindercro', {
        churn_score: 3,
        client_json: buildClientJson({ launched: false, deliverables: ['in progress'] }),
        fathom_signals: [
          sig({
            signal_type: 'payment_risk',
            severity: 'high',
            recording_id: '124463291',
            quote: '13K was for you guys to build out',
          }),
        ],
      })
    );
    expect(out.tier).toBe('critical');
    expect(out.score).toBe(116);
    expect(out.drivers[0].code).toBe('high_verbal_payment_risk');
  });

  // F3 PathfinderCRO (corpus fallback) — corpus_risk_signal_high is a WARNING, not
  // critical (calibration §6.4.2: unverified corpus risk.signals[] are too noisy to
  // scream critical; only verified verbal Fathom signals + stalled launch do).
  it('F3 PathfinderCRO (corpus fallback) → warning via corpus_risk_signal_high', () => {
    const out = computeAccountHealth(
      input('pathfindercro', {
        churn_score: 3,
        client_json: buildClientJson({
          launched: true,
          riskSignals: [{ severity: 'high', quote: 'it feels like I have wasted $10K' }],
        }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('warning');
    expect(out.drivers.some((d) => d.code === 'corpus_risk_signal_high')).toBe(true);
    // 50 (signal, demoted to warning) + churn 3*2=6 = 56
    expect(out.score).toBe(56);
  });

  // F3b regression (calibration flood guard): a HIGH-severity corpus risk signal
  // whose text is benign contract boilerplate must NOT match the tightened regex,
  // so it neither escalates nor even fires the warning. Prevents the 22/42 red flood.
  it('F3b boilerplate "30-day cancellation clause" (high sev) does NOT escalate', () => {
    const out = computeAccountHealth(
      input('flagship-healthy', {
        churn_score: 0,
        client_json: buildClientJson({
          launched: true,
          riskSignals: [{ severity: 'high', quote: 'Standard 30-day cancellation clause in the MSA' }],
        }),
        fathom_signals: [],
      })
    );
    expect(out.tier).not.toBe('critical');
    expect(out.drivers.some((d) => d.code === 'corpus_risk_signal_high')).toBe(false);
  });

  // F4 RapportScore — stalled_launch_six_weeks. churn=0 must NOT make it healthy. score 90.
  it('F4 RapportScore → critical via stalled_launch_six_weeks despite churn=0 (score 90)', () => {
    const out = computeAccountHealth(
      input('rapportscore', {
        churn_score: 0,
        client_json: buildClientJson({
          launched: false,
          deliverables: ['in progress', '', 'todo'], // ratio 0.0
          sentiment: 'pos',
          meetingDates: [TEN_WEEKS_AGO],
        }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('critical');
    expect(out.score).toBe(90);
    expect(out.drivers[0].code).toBe('stalled_launch_six_weeks');
  });

  // F5 PocketMarketer — stalled 4w (not 6); incidents alone don't escalate → warning.
  it('F5 PocketMarketer → warning (stalled_launch_four_weeks; incidents do not escalate)', () => {
    const out = computeAccountHealth(
      input('pocketmarketer', {
        churn_score: 0,
        client_json: buildClientJson({
          launched: false,
          // ratio ~0.31 (>0.20) so six-week critical can't fire even though weeks≈5
          deliverables: ['complete', 'complete', 'complete', 'in progress', '', '', 'todo', 'todo', 'todo'],
          sentiment: 'pos',
          meetingDates: [FIVE_WEEKS_AGO],
          incidents: Array(7).fill('account_compromise'),
        }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('warning');
    expect(out.drivers.some((d) => d.code === 'stalled_launch_four_weeks')).toBe(true);
    expect(out.drivers.every((d) => d.severity !== 'critical')).toBe(true);
  });

  // F6 — churn=3, launched, healthy. churn alone is NOT a tier driver.
  it('F6 → healthy: churn=3 alone is not a tier driver', () => {
    const out = computeAccountHealth(
      input('f6', {
        churn_score: 3,
        client_json: buildClientJson({ launched: true, sentiment: 'neutral', actions: [''] }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('healthy');
    // score = churn 3*2 = 6 only
    expect(out.score).toBe(6);
  });

  // F7 — clean healthy, no driver fires.
  it('F7 → healthy: nothing fires', () => {
    const out = computeAccountHealth(
      input('f7', {
        churn_score: 0,
        client_json: buildClientJson({
          launched: true,
          deliverables: ['complete', 'complete', 'complete', 'complete', 'complete', 'complete', 'complete', 'complete', 'complete', 'in progress'],
          sentiment: 'pos',
          actions: [''],
        }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('healthy');
    expect(out.drivers).toHaveLength(0);
    expect(out.topUnblockAction).toMatch(/Maintain cadence/);
  });

  // F8 — unowned backlog → warning.
  it('F8 → warning: unowned_action_backlog (4 unowned)', () => {
    const out = computeAccountHealth(
      input('f8', {
        churn_score: 0,
        client_json: buildClientJson({ launched: true, sentiment: 'neutral', actions: ['', '', '', ''] }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('warning');
    expect(out.drivers[0].code).toBe('unowned_action_backlog');
    expect(out.topUnblockAction).toMatch(/Assign owners — 4 open actions unowned/);
  });

  // F9 — neg + medium verbal → critical (neg_sentiment_corroborated).
  it('F9 → critical: neg_sentiment_corroborated (medium verbal + neg)', () => {
    const out = computeAccountHealth(
      input('f9', {
        churn_score: 0,
        client_json: buildClientJson({ launched: true, sentiment: 'neg' }),
        fathom_signals: [sig({ signal_type: 'churn_escalation', severity: 'medium', quote: 'we are getting frustrated with the pace' })],
      })
    );
    expect(out.tier).toBe('critical');
    expect(out.drivers[0].code).toBe('neg_sentiment_corroborated');
  });

  // F10 — neg alone → warning.
  it('F10 → warning: neg_sentiment uncorroborated', () => {
    const out = computeAccountHealth(
      input('f10', {
        churn_score: 0,
        client_json: buildClientJson({ launched: true, sentiment: 'neg' }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('warning');
    expect(out.drivers.some((d) => d.code === 'neg_sentiment')).toBe(true);
    expect(out.drivers.every((d) => d.severity !== 'critical')).toBe(true);
  });

  // F11 — incidents + neg, no verbal → warning (corpus_incident_corroborated, never critical).
  it('F11 → warning: corpus_incident_corroborated (never critical)', () => {
    const out = computeAccountHealth(
      input('f11', {
        churn_score: 0,
        client_json: buildClientJson({
          launched: true,
          sentiment: 'neg',
          incidents: ['cross_client_data_leak', 'security_or_account', 'account_compromise'],
        }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('warning');
    expect(out.drivers.some((d) => d.code === 'corpus_incident_corroborated')).toBe(true);
    expect(out.drivers.every((d) => d.severity !== 'critical')).toBe(true);
  });

  // F12 — upsell only → healthy (never promotes).
  it('F12 → healthy: high upsell_intent never promotes tier', () => {
    const out = computeAccountHealth(
      input('f12', {
        churn_score: 0,
        client_json: buildClientJson({ launched: true, sentiment: 'pos' }),
        fathom_signals: [sig({ signal_type: 'upsell_intent', severity: 'high', quote: 'we want to add another product line next quarter' })],
      })
    );
    expect(out.tier).toBe('healthy');
    expect(out.drivers.every((d) => d.severity === 'info')).toBe(true);
  });

  // F14 — neg sentiment + HIGH upsell_intent must NOT escalate to critical.
  // A positive high signal cannot corroborate negative sentiment into a churn
  // alarm — regression guard for the exact false-red the calibration prevents.
  it('F14 → warning not critical: neg sentiment + high upsell_intent is NOT corroborated', () => {
    const out = computeAccountHealth(
      input('f14', {
        churn_score: 0,
        client_json: buildClientJson({ launched: true, sentiment: 'neg' }),
        fathom_signals: [
          sig({ signal_type: 'upsell_intent', severity: 'high', quote: 'we want to add another product line next quarter' }),
        ],
      })
    );
    expect(out.tier).toBe('warning');
    expect(out.drivers.some((d) => d.code === 'neg_sentiment_corroborated')).toBe(false);
    // uncorroborated neg_sentiment warning still fires (it is not suppressed here)
    expect(out.drivers.some((d) => d.code === 'neg_sentiment')).toBe(true);
  });

  // F15 — a HIGH churn signal from a SALES call is a prospect objection, not
  // client churn: it must NOT set critical (caps to medium → warning). The same
  // signal on a cs_checkin call IS client churn and DOES set critical.
  it('F15 → sales-call high churn does not escalate; same signal on cs_checkin does', () => {
    const sales = computeAccountHealth(
      input('f15-sales', {
        churn_score: 0,
        client_json: buildClientJson({ launched: true, sentiment: 'neutral' }),
        fathom_signals: [
          sig({ signal_type: 'churn_escalation', severity: 'high', call_type: 'sales', quote: 'I really need to see some results before we commit here' }),
        ],
      })
    );
    expect(sales.tier).toBe('warning');
    expect(sales.drivers.some((d) => d.code === 'high_verbal_churn_escalation')).toBe(false);
    // still visible as a warning-level driver (its quote is real evidence)
    expect(sales.drivers.some((d) => d.code === 'medium_verbal_risk')).toBe(true);

    const cs = computeAccountHealth(
      input('f15-cs', {
        churn_score: 0,
        client_json: buildClientJson({ launched: true, sentiment: 'neutral' }),
        fathom_signals: [
          sig({ signal_type: 'churn_escalation', severity: 'high', call_type: 'cs_checkin', quote: 'I really need to see some results before we commit here' }),
        ],
      })
    );
    expect(cs.tier).toBe('critical');
    expect(cs.drivers.some((d) => d.code === 'high_verbal_churn_escalation')).toBe(true);
  });

  // F13 — no fathom calls; launched=false but onboarding null → stalled rules can't fire → healthy.
  it('F13 → healthy: no fathom calls means onboarding null, stalled rules cannot fire', () => {
    const out = computeAccountHealth(
      input('f13', {
        churn_score: 0,
        client_json: buildClientJson({ launched: false, sentiment: 'neutral' }),
        fathom_signals: [],
      })
    );
    expect(out.tier).toBe('healthy');
    expect(out.drivers).toHaveLength(0);
    expect(readOnboardingDate(buildClientJson({ launched: false }))).toBeNull();
  });
});

// ===========================================================================
// Acceptance: F1/F2/F4 are CRITICAL despite low churn
// ===========================================================================

describe('acceptance criterion — override cases critical despite low churn', () => {
  it('F1 Zuppler, F2 PathfinderCRO, F4 RapportScore all critical', () => {
    const f1 = computeAccountHealth(
      input('zuppler', {
        churn_score: 3,
        client_json: buildClientJson({ launched: false }),
        fathom_signals: [sig({ signal_type: 'churn_escalation', severity: 'high', quote: 'absolutely not happy with the responsiveness from your team' })],
      })
    );
    const f2 = computeAccountHealth(
      input('pathfindercro', {
        churn_score: 3,
        client_json: buildClientJson({ launched: false }),
        fathom_signals: [sig({ signal_type: 'payment_risk', severity: 'high', quote: '13K was for you guys to build out' })],
      })
    );
    const f4 = computeAccountHealth(
      input('rapportscore', {
        churn_score: 0,
        client_json: buildClientJson({ launched: false, deliverables: ['in progress'], meetingDates: [TEN_WEEKS_AGO] }),
        fathom_signals: [],
      })
    );
    expect([f1.tier, f2.tier, f4.tier]).toEqual(['critical', 'critical', 'critical']);
  });
});

// ===========================================================================
// Sort / tier-dominance + calibration
// ===========================================================================

describe('sort + calibration', () => {
  it('tier dominates score: a critical@score 30 sorts above a warning@score 90', () => {
    const critLow: AccountHealth = {
      client_slug: 'crit-low',
      tier: 'critical',
      score: 30,
      drivers: [],
      topUnblockAction: '',
      churn_score: 0,
      launched: null,
      unowned_open_actions: 0,
      last_signal: null,
    };
    const warnHigh: AccountHealth = {
      ...critLow,
      client_slug: 'warn-high',
      tier: 'warning',
      score: 90,
    };
    const sorted = [warnHigh, critLow].sort(compareAccountHealth);
    expect(sorted[0].client_slug).toBe('crit-low');
  });

  it('F1 sorts above F4 sorts above any warning', () => {
    const f1 = computeAccountHealth(
      input('zuppler', {
        churn_score: 3,
        client_json: buildClientJson({ launched: false }),
        fathom_signals: [sig({ signal_type: 'churn_escalation', severity: 'high', quote: 'absolutely not happy with the responsiveness from your team' })],
      })
    );
    const f4 = computeAccountHealth(
      input('rapportscore', {
        churn_score: 0,
        client_json: buildClientJson({ launched: false, deliverables: ['in progress'], meetingDates: [TEN_WEEKS_AGO] }),
        fathom_signals: [],
      })
    );
    const warn = computeAccountHealth(
      input('f8', {
        churn_score: 0,
        client_json: buildClientJson({ launched: true, actions: ['', '', '', ''] }),
        fathom_signals: [],
      })
    );
    const sorted = [warn, f4, f1].sort(compareAccountHealth);
    expect(sorted.map((r) => r.client_slug)).toEqual(['zuppler', 'rapportscore', 'f8']);
  });

  it('calibration: 42 minimal inputs with empty signals yield critical_count <= ~6', () => {
    const rows: AccountHealth[] = [];
    for (let i = 0; i < 42; i++) {
      rows.push(
        computeAccountHealth(
          input(`client-${i}`, {
            churn_score: i % 2 === 0 ? 0 : 3, // realistic bimodal {0,3}
            client_json: buildClientJson({}), // minimal: empty corpus, no signals
            fathom_signals: [],
          })
        )
      );
    }
    const criticalCount = rows.filter((r) => r.tier === 'critical').length;
    expect(criticalCount).toBeLessThanOrEqual(6);
    // minimal inputs with empty corpus => no driver fires => zero critical
    expect(criticalCount).toBe(0);
  });
});
