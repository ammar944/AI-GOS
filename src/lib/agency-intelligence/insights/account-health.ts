// Agency Intelligence Console — deterministic true-risk engine (spec §6).
// No LLM. No I/O. Pure function. Lives beside `client-health.ts` (unmodified).
//
// Computes a true-risk tier per client from corpus signals PLUS verified verbal
// Fathom escalations. Driver-severity model: each driver carries its own severity,
// tier = max driver severity, score = Σ points (sort key only — tier dominates sort).
// churn_score and risk.incidents NEVER drive tier (score + transparency only).

import {
  type Evidence,
  corpusFileLocator,
  dbKeyLocator,
} from '../contracts';

// ---------------------------------------------------------------------------
// Types (spec §6.1)
// ---------------------------------------------------------------------------

export type RiskTier = 'critical' | 'warning' | 'healthy';

export interface FathomSignalLite {
  signal_type:
    | 'churn_escalation'
    | 'going_dark'
    | 'payment_risk'
    | 'verbal_promise'
    | 'upsell_intent';
  severity: 'low' | 'medium' | 'high';
  quote: string;
  speaker: string | null;
  call_date: string | null;
  recording_id: string;
  /** Source call type (joined from sl_fathom_transcripts). 'sales' = prospect-stage. */
  call_type?: string | null;
  share_url?: string | null;
}

export interface AccountHealthInput {
  client_slug: string;
  client_display_name: string | null;
  churn_score: number | null;
  risk_tier: string | null;
  client_json: Record<string, unknown>;
  fathom_signals: FathomSignalLite[];
  /** deterministic as-of for tests */
  generated_at: string;
}

export interface HealthDriver {
  code: string;
  label: string;
  severity: 'critical' | 'warning' | 'info';
  points: number;
  evidence: Evidence[];
}

export interface AccountHealth {
  client_slug: string;
  tier: RiskTier;
  score: number;
  drivers: HealthDriver[];
  topUnblockAction: string;
  churn_score: number | null;
  launched: boolean | null;
  unowned_open_actions: number;
  last_signal: { type: string; severity: string; call_date: string | null } | null;
}

// ---------------------------------------------------------------------------
// Envelope helpers — most corpus scalars are { quote, source_id, value } envelopes.
// ---------------------------------------------------------------------------

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Unwrap a `{ value }` envelope to its `.value`; pass scalars through. */
function unwrap(x: unknown): unknown {
  if (isRecord(x) && 'value' in x) return x.value;
  return x;
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

/**
 * Normalize a deliverable status / display string: strip leading emoji and
 * whitespace, lowercase, trim. Matches the gate-style normalization the spec
 * requires for the "done" vocabulary (§1.1).
 */
function normalizeStatus(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : String(raw ?? '');
  return s
    .replace(
      // leading whitespace + emoji / pictographic / variation selectors
      /^[\s‍️\u{1f000}-\u{1ffff}\u{2600}-\u{27bf}\u{2b00}-\u{2bff}\u{1f900}-\u{1f9ff}]+/u,
      ''
    )
    .trim()
    .toLowerCase();
}

const DONE_STATUSES = new Set([
  'complete',
  'completed',
  'done',
  'closed',
  'live',
  'launched',
]);

// ---------------------------------------------------------------------------
// Pure corpus readers (spec §6.2 — exported for unit test)
// ---------------------------------------------------------------------------

/** `delivery.launched` (raw boolean, not enveloped) | null. */
export function readLaunched(clientJson: Record<string, unknown>): boolean | null {
  const delivery = clientJson.delivery;
  if (!isRecord(delivery)) return null;
  const launched = delivery.launched;
  return typeof launched === 'boolean' ? launched : null;
}

/**
 * Deliverable progress: { done, total, ratio|null }. A deliverable is done when
 * its normalized `status.value` ∈ DONE_STATUSES (case-insensitive, emoji-stripped).
 * Everything else (incl. "") is not-done. ratio is null when total === 0.
 */
export function readDeliverableProgress(clientJson: Record<string, unknown>): {
  done: number;
  total: number;
  ratio: number | null;
} {
  const delivery = clientJson.delivery;
  const deliverables = isRecord(delivery) ? asArray(delivery.deliverables) : [];
  let done = 0;
  for (const d of deliverables) {
    if (!isRecord(d)) continue;
    const statusValue = unwrap(d.status);
    if (DONE_STATUSES.has(normalizeStatus(statusValue))) done++;
  }
  const total = deliverables.length;
  return { done, total, ratio: total > 0 ? done / total : null };
}

/** `sentiment.latest.value` — match `"neg"` exactly (not "negative"). */
export function readSentiment(
  clientJson: Record<string, unknown>
): 'pos' | 'neg' | 'neutral' | null {
  const sentiment = clientJson.sentiment;
  if (!isRecord(sentiment)) return null;
  const latest = sentiment.latest;
  const value = unwrap(latest);
  if (value === 'pos' || value === 'neg' || value === 'neutral') return value;
  return null;
}

/** Count `actions[]` whose `(owner.value ?? '').trim() === ''` ⇒ unowned. */
export function readUnownedOpenActions(clientJson: Record<string, unknown>): number {
  const actions = asArray(clientJson.actions);
  let count = 0;
  for (const a of actions) {
    if (!isRecord(a)) continue;
    const owner = unwrap(a.owner);
    const ownerStr = typeof owner === 'string' ? owner : owner == null ? '' : String(owner);
    if (ownerStr.trim() === '') count++;
  }
  return count;
}

/** Earliest `fathom_meetings[].date` (ISO8601) | null — onboarding proxy (§9). */
export function readOnboardingDate(clientJson: Record<string, unknown>): string | null {
  const meetings = asArray(clientJson.fathom_meetings);
  let earliest: string | null = null;
  let earliestTime = Number.POSITIVE_INFINITY;
  for (const m of meetings) {
    if (!isRecord(m)) continue;
    const date = m.date;
    if (typeof date !== 'string') continue;
    const t = Date.parse(date);
    if (Number.isNaN(t)) continue;
    if (t < earliestTime) {
      earliestTime = t;
      earliest = date;
    }
  }
  return earliest;
}

/** Whole + fractional weeks between `date` and `generatedAt`; null if date null/unparseable. */
export function weeksSince(date: string | null, generatedAt: string): number | null {
  if (!date) return null;
  const from = Date.parse(date);
  const to = Date.parse(generatedAt);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return (to - from) / (1000 * 60 * 60 * 24 * 7);
}

/**
 * Churn-language regex (§6.4.2 hedge). Used to gate the corpus risk-signal
 * critical fallback so benign high-severity signals don't escalate.
 */
const CHURN_LANGUAGE =
  /(cut our losses|stop wasting|wasted|break the contract|(?:cancel(?:ling|led|ing)?|terminat(?:e|ing)?|end(?:ing)?) (?:the |our |this )?(?:contract|engagement|agreement|relationship|partnership)|part ways|no longer interested|turn (?:them|it) off|throwing (?:cash|money)|payment bounced|(?:want|demand|asking for|expect|requesting)(?:ing|s)?[^.\n]{0,24}\brefund|going dark)/i;

/**
 * Conservative, verification-gated read of `risk.signals[]` (§6.4.2). Returns
 * true only when a signal carries an explicit `severity.value === 'high'` AND
 * its quote/signal text matches the (deliberately tight) churn-language regex.
 *
 * The corpus DOES expose `severity`, but a live calibration scan of the 42 real
 * corpus files proved `risk.signals[]` high-sev entries are noisy: a loose regex
 * matched benign boilerplate (e.g. a "30-day cancellation clause") and flooded
 * 22/42 clients red. Per §6.4.2's conservative intent, this driver is therefore
 * a WARNING (not CRITICAL) — only verified VERBAL Fathom signals and hard
 * stalled-launch evidence set the critical tier. The regex now requires
 * contract/relationship or money-loss context, not bare "cancel"/"terminate".
 */
export function readCorpusRiskSignalsHigh(clientJson: Record<string, unknown>): boolean {
  const risk = clientJson.risk;
  if (!isRecord(risk)) return false;
  const signals = asArray(risk.signals);
  for (const s of signals) {
    if (!isRecord(s)) continue;
    if (unwrap(s.severity) !== 'high') continue;
    const quote = typeof s.quote === 'string' ? s.quote : '';
    const signalText = unwrap(s.signal);
    const signalStr = typeof signalText === 'string' ? signalText : '';
    if (CHURN_LANGUAGE.test(`${quote} ${signalStr}`)) return true;
  }
  return false;
}

/** High-severity incident types (§6.4 — low-trust, corroboration-only). */
const HIGH_SEV_INCIDENT_TYPES = new Set([
  'cross_client_data_leak',
  'security_or_account',
  'account_compromise',
]);

/**
 * Count `risk.incidents[]` whose `type.value` is a high-severity incident type.
 * Low-trust (§6.4): incidents do NOT expose a usable severity, so the type is
 * the only signal — and this count NEVER drives tier (corroboration-only).
 */
export function readCorpusIncidents(clientJson: Record<string, unknown>): {
  highSevCount: number;
} {
  const risk = clientJson.risk;
  if (!isRecord(risk)) return { highSevCount: 0 };
  const incidents = asArray(risk.incidents);
  let highSevCount = 0;
  for (const inc of incidents) {
    if (!isRecord(inc)) continue;
    const type = unwrap(inc.type);
    if (typeof type === 'string' && HIGH_SEV_INCIDENT_TYPES.has(type)) highSevCount++;
  }
  return { highSevCount };
}

// ---------------------------------------------------------------------------
// Tier / score derivation (spec §6.3)
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function tierRank(tier: RiskTier): number {
  return tier === 'critical' ? 3 : tier === 'warning' ? 2 : 1;
}

// Verbal severity sets used by several drivers.
const VERBAL_RISK_TYPES = new Set(['churn_escalation', 'going_dark', 'payment_risk']);

/**
 * Effective severity for TIERING. A high-severity signal from a SALES call is a
 * prospect-stage objection ("need to see results before I commit"), not client
 * churn, so it is capped to 'medium' — it cannot set the critical tier, but it
 * still surfaces as a warning-level driver with its verbatim quote. CS/check-in/
 * onboarding signals keep their severity (those are real client-health signals).
 */
function tierSeverity(s: FathomSignalLite): 'low' | 'medium' | 'high' {
  return s.severity === 'high' && s.call_type === 'sales' ? 'medium' : s.severity;
}

function signalEvidence(slug: string, signal: FathomSignalLite): Evidence[] {
  return [
    {
      kind: 'fathom_signal',
      locator: dbKeyLocator(
        'sl_fathom_transcripts',
        'recording_id',
        signal.recording_id
      ),
      summary: `${signal.signal_type} (${signal.severity}) on ${
        signal.call_date ?? 'unknown date'
      }: "${signal.quote.slice(0, 160)}"`,
      observed_at: signal.call_date ?? undefined,
    },
  ];
}

function corpusDriverEvidence(
  slug: string,
  pointer: string,
  kind: Evidence['kind'],
  summary: string,
  generatedAt: string
): Evidence[] {
  return [
    {
      kind,
      locator: corpusFileLocator(`corpus/clients/${slug}.json`, pointer),
      summary,
      observed_at: generatedAt,
    },
  ];
}

// ---------------------------------------------------------------------------
// Engine (spec §6.3 + §6.5)
// ---------------------------------------------------------------------------

/**
 * Compute one deterministic, evidence-backed AccountHealth. Pure: no LLM, no I/O.
 * tier = max driver severity; score = Σ points (clamped); sort key = (tier, score).
 */
export function computeAccountHealth(input: AccountHealthInput): AccountHealth {
  const {
    client_slug,
    churn_score,
    client_json,
    fathom_signals,
    generated_at,
  } = input;

  const launched = readLaunched(client_json);
  const { ratio } = readDeliverableProgress(client_json);
  const sentiment = readSentiment(client_json);
  const unownedOpenActions = readUnownedOpenActions(client_json);
  const onboardingDate = readOnboardingDate(client_json);
  const weeksSinceOnboarding = weeksSince(onboardingDate, generated_at);
  const corpusRiskSignalHigh = readCorpusRiskSignalsHigh(client_json);
  const { highSevCount: corpusHighSevIncidentCount } = readCorpusIncidents(client_json);

  // --- Fathom signal partitions (by TIERING severity — sales-call highs cap to medium) ---
  const highSignals = fathom_signals.filter((s) => tierSeverity(s) === 'high');
  const mediumSignals = fathom_signals.filter((s) => tierSeverity(s) === 'medium');
  const hasHighType = (t: FathomSignalLite['signal_type']): boolean =>
    highSignals.some((s) => s.signal_type === t);
  const mediumRiskSignals = mediumSignals.filter((s) =>
    VERBAL_RISK_TYPES.has(s.signal_type)
  );
  const hasMediumRisk = mediumRiskSignals.length > 0;
  // Only RISK-type high signals (churn/dark/payment) corroborate negative
  // sentiment into a critical. A high POSITIVE signal (upsell_intent /
  // verbal_promise) must never manufacture a churn alarm — that is the exact
  // false-red this engine's calibration exists to prevent (§6.4.2).
  const hasHighRisk = highSignals.some((s) => VERBAL_RISK_TYPES.has(s.signal_type));
  const negCorroborated = sentiment === 'neg' && (hasHighRisk || hasMediumRisk);

  const firstHighType = (t: FathomSignalLite['signal_type']): FathomSignalLite | undefined =>
    highSignals.find((s) => s.signal_type === t);

  const drivers: HealthDriver[] = [];

  // ---- CRITICAL drivers ----
  if (hasHighType('churn_escalation')) {
    const sig = firstHighType('churn_escalation')!;
    drivers.push({
      code: 'high_verbal_churn_escalation',
      label: 'High-severity verbal churn escalation',
      severity: 'critical',
      points: 120,
      evidence: signalEvidence(client_slug, sig),
    });
  }
  if (hasHighType('going_dark')) {
    const sig = firstHighType('going_dark')!;
    drivers.push({
      code: 'high_verbal_going_dark',
      label: 'High-severity verbal going-dark signal',
      severity: 'critical',
      points: 115,
      evidence: signalEvidence(client_slug, sig),
    });
  }
  if (hasHighType('payment_risk')) {
    const sig = firstHighType('payment_risk')!;
    drivers.push({
      code: 'high_verbal_payment_risk',
      label: 'High-severity verbal payment risk',
      severity: 'critical',
      points: 110,
      evidence: signalEvidence(client_slug, sig),
    });
  }
  // corpus_risk_signal_high (50) — WARNING, not critical. Calibration proved the
  // unverified corpus risk.signals[] are too noisy to set the critical tier (they
  // flooded 22/42 red). Only verified verbal Fathom signals + stalled launch are
  // critical; an unverified corpus churn signal is a watch-list warning. (§6.4.2)
  if (corpusRiskSignalHigh) {
    drivers.push({
      code: 'corpus_risk_signal_high',
      label: 'Corpus risk signal: high severity + churn language (unverified)',
      severity: 'warning',
      points: 50,
      evidence: corpusDriverEvidence(
        client_slug,
        '/risk',
        'corpus_risk_signal',
        'risk.signals[] high severity with churn-language match',
        generated_at
      ),
    });
  }
  // stalled_launch_six_weeks (90)
  const stalledSix =
    launched === false &&
    weeksSinceOnboarding !== null &&
    weeksSinceOnboarding >= 6 &&
    (ratio === null || ratio < 0.2);
  if (stalledSix) {
    drivers.push({
      code: 'stalled_launch_six_weeks',
      label: 'Launch stalled ≥6 weeks with little delivery progress',
      severity: 'critical',
      points: 90,
      evidence: corpusDriverEvidence(
        client_slug,
        '/delivery',
        'corpus_delivery',
        `launched=false, ${
          weeksSinceOnboarding !== null ? weeksSinceOnboarding.toFixed(1) : '?'
        }w since first call, ratio=${ratio === null ? 'n/a' : ratio.toFixed(2)}`,
        generated_at
      ),
    });
  }
  // neg_sentiment_corroborated (85) — neg + (any high-sev RISK signal OR any medium churn/dark/payment)
  if (negCorroborated) {
    drivers.push({
      code: 'neg_sentiment_corroborated',
      label: 'Negative sentiment corroborated by a verbal signal',
      severity: 'critical',
      points: 85,
      evidence: corpusDriverEvidence(
        client_slug,
        '/sentiment',
        'corpus_client',
        'sentiment.latest=neg corroborated by a Fathom signal',
        generated_at
      ),
    });
  }

  // ---- WARNING drivers (only meaningful if no critical, but always computed for score/transparency) ----
  // medium_verbal_risk (60)
  if (hasMediumRisk) {
    drivers.push({
      code: 'medium_verbal_risk',
      label: 'Medium-severity verbal churn/dark/payment signal',
      severity: 'warning',
      points: 60,
      evidence: signalEvidence(client_slug, mediumRiskSignals[0]),
    });
  }
  // unowned_action_backlog (45)
  if (unownedOpenActions >= 3) {
    drivers.push({
      code: 'unowned_action_backlog',
      label: `${unownedOpenActions} open actions unowned`,
      severity: 'warning',
      points: 45,
      evidence: corpusDriverEvidence(
        client_slug,
        '/actions',
        'corpus_action',
        `${unownedOpenActions} open actions with no owner`,
        generated_at
      ),
    });
  }
  // stalled_launch_four_weeks (40) — suppressed when the six-week critical
  // already fired (it is a strict superset; do not double-count the warning).
  const stalledFour =
    !stalledSix &&
    launched === false &&
    weeksSinceOnboarding !== null &&
    weeksSinceOnboarding >= 4;
  if (stalledFour) {
    drivers.push({
      code: 'stalled_launch_four_weeks',
      label: 'Launch stalled ≥4 weeks',
      severity: 'warning',
      points: 40,
      evidence: corpusDriverEvidence(
        client_slug,
        '/delivery',
        'corpus_delivery',
        `launched=false, ${
          weeksSinceOnboarding !== null ? weeksSinceOnboarding.toFixed(1) : '?'
        }w since first call`,
        generated_at
      ),
    });
  }
  // neg_sentiment (35) — uncorroborated. Suppressed when the corroborated
  // critical already fired (strict superset; mirrors the stalled-launch dedup).
  if (sentiment === 'neg' && !negCorroborated) {
    drivers.push({
      code: 'neg_sentiment',
      label: 'Negative latest sentiment',
      severity: 'warning',
      points: 35,
      evidence: corpusDriverEvidence(
        client_slug,
        '/sentiment',
        'corpus_client',
        'sentiment.latest=neg',
        generated_at
      ),
    });
  }
  // corpus_incident_corroborated (20) — highSevIncidentCount>=2 AND neg sentiment (never critical, never alone)
  if (corpusHighSevIncidentCount >= 2 && sentiment === 'neg') {
    drivers.push({
      code: 'corpus_incident_corroborated',
      label: 'Corpus incidents corroborated by negative sentiment',
      severity: 'warning',
      points: 20,
      evidence: corpusDriverEvidence(
        client_slug,
        '/risk',
        'corpus_risk_signal',
        `${corpusHighSevIncidentCount} high-severity incident types + neg sentiment`,
        generated_at
      ),
    });
  }

  // ---- INFO drivers (never promote tier) ----
  for (const sig of highSignals) {
    if (sig.signal_type === 'verbal_promise') {
      drivers.push({
        code: 'verbal_promise',
        label: 'Verbal promise on a call',
        severity: 'info',
        points: 5,
        evidence: signalEvidence(client_slug, sig),
      });
    } else if (sig.signal_type === 'upsell_intent') {
      drivers.push({
        code: 'upsell_intent',
        label: 'Upsell intent on a call',
        severity: 'info',
        points: 5,
        evidence: signalEvidence(client_slug, sig),
      });
    }
  }

  // ---- Tier + score (§6.3) ----
  const tier: RiskTier = drivers.some((d) => d.severity === 'critical')
    ? 'critical'
    : drivers.some((d) => d.severity === 'warning')
    ? 'warning'
    : 'healthy';

  // churn_score adds to score for sort only (NOT a tier driver — §6.4.1).
  const churnScorePoints = (churn_score ?? 0) * 2;
  const score = clamp(
    drivers.reduce((s, d) => s + d.points, 0) + churnScorePoints,
    0,
    999
  );

  // Sort drivers by severity desc then points desc so drivers[0] is the worst.
  drivers.sort((a, b) => {
    const sa = a.severity === 'critical' ? 3 : a.severity === 'warning' ? 2 : 1;
    const sb = b.severity === 'critical' ? 3 : b.severity === 'warning' ? 2 : 1;
    if (sa !== sb) return sb - sa;
    return b.points - a.points;
  });

  // ---- last_signal (most recent by call_date) ----
  const lastSignal = pickLastSignal(fathom_signals);

  // ---- topUnblockAction (§6.5) ----
  const topUnblockAction = buildTopUnblockAction(
    drivers[0],
    {
      lastSignal,
      done: readDeliverableProgress(client_json).done,
      total: readDeliverableProgress(client_json).total,
      weeksSinceOnboarding,
      unownedOpenActions,
    }
  );

  return {
    client_slug,
    tier,
    score,
    drivers,
    topUnblockAction,
    churn_score,
    launched,
    unowned_open_actions: unownedOpenActions,
    last_signal: lastSignal,
  };
}

function pickLastSignal(
  signals: FathomSignalLite[]
): { type: string; severity: string; call_date: string | null } | null {
  if (signals.length === 0) return null;
  let best: FathomSignalLite | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const s of signals) {
    const t = s.call_date ? Date.parse(s.call_date) : NaN;
    const effective = Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
    if (best === null || effective > bestTime) {
      best = s;
      bestTime = effective;
    }
  }
  if (!best) return null;
  return { type: best.signal_type, severity: best.severity, call_date: best.call_date };
}

function buildTopUnblockAction(
  worst: HealthDriver | undefined,
  ctx: {
    lastSignal: { type: string; severity: string; call_date: string | null } | null;
    done: number;
    total: number;
    weeksSinceOnboarding: number | null;
    unownedOpenActions: number;
  }
): string {
  if (!worst) return 'Maintain cadence — no open escalations.';
  const code = worst.code;
  const isCriticalVerbal =
    worst.severity === 'critical' &&
    (code === 'high_verbal_churn_escalation' ||
      code === 'high_verbal_going_dark' ||
      code === 'high_verbal_payment_risk' ||
      code === 'neg_sentiment_corroborated');
  if (isCriticalVerbal) {
    const date = ctx.lastSignal?.call_date ?? 'recent call';
    return `Escalate to owner — verbal churn signal on ${date}`;
  }
  if (code === 'stalled_launch_six_weeks' || code === 'stalled_launch_four_weeks') {
    const weeks =
      ctx.weeksSinceOnboarding !== null ? Math.floor(ctx.weeksSinceOnboarding) : '?';
    return `Recover launch — ${ctx.done}/${ctx.total} done after ${weeks}w; assign owner+date`;
  }
  if (code === 'unowned_action_backlog') {
    return `Assign owners — ${ctx.unownedOpenActions} open actions unowned`;
  }
  if (worst.severity === 'warning') {
    return 'Review account — open warning signal needs an owner';
  }
  return 'Maintain cadence — no open escalations.';
}

// ---------------------------------------------------------------------------
// Sort helper (spec §6 / §8): tier dominates, then score desc, then
// lastSignalDate desc (nulls last), then slug.
// ---------------------------------------------------------------------------

/** Stable comparator over AccountHealth rows: (tierRank desc, score desc, lastSignalDate desc nulls last, slug asc). */
export function compareAccountHealth(a: AccountHealth, b: AccountHealth): number {
  const tr = tierRank(b.tier) - tierRank(a.tier);
  if (tr !== 0) return tr;
  if (b.score !== a.score) return b.score - a.score;
  const at = a.last_signal?.call_date ? Date.parse(a.last_signal.call_date) : NaN;
  const bt = b.last_signal?.call_date ? Date.parse(b.last_signal.call_date) : NaN;
  const aValid = !Number.isNaN(at);
  const bValid = !Number.isNaN(bt);
  if (aValid && bValid && at !== bt) return bt - at;
  if (aValid !== bValid) return aValid ? -1 : 1; // nulls last
  return a.client_slug.localeCompare(b.client_slug);
}
