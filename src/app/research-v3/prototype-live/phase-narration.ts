// PROTOTYPE — throwaway, but this is the load-bearing CORRECTNESS core
// (Lock 3: customer-safe activity feed). It maps raw lab Activity Events to
// product-phase narration via an ALLOWLIST. Raw payload.metadata
// (outputSummary, raw reason, Zod issue arrays) is NEVER surfaced here —
// only the clean `message`, a translated reason, and clean search-query chips.
// When the rebuild lands, this module folds into src/lib/research-v2.

import type { FixtureEvent, FixtureArtifactData } from './fixture-types';

export type ProductPhase =
  | 'preparing'
  | 'searching'
  | 'drafting'
  | 'checking'
  | 'refining'
  | 'committing'
  | 'done';

export type NarrationTone = 'active' | 'neutral' | 'success' | 'warning';

export const PHASE_ORDER: ProductPhase[] = [
  'preparing',
  'searching',
  'drafting',
  'checking',
  'refining',
  'committing',
  'done',
];

export const PHASE_META: Record<
  ProductPhase,
  { label: string; verb: string; tone: NarrationTone }
> = {
  preparing: { label: 'Preparing context', verb: 'Preparing context', tone: 'neutral' },
  searching: { label: 'Searching source evidence', verb: 'Searching sources', tone: 'active' },
  drafting: { label: 'Drafting section', verb: 'Drafting', tone: 'active' },
  checking: { label: 'Checking source support', verb: 'Checking sources', tone: 'active' },
  refining: { label: 'Refining unsupported claims', verb: 'Refining claims', tone: 'warning' },
  committing: { label: 'Committing verified section', verb: 'Committing', tone: 'success' },
  done: { label: 'Section verified & committed', verb: 'Verified', tone: 'success' },
};

// Allowlist: only these event types are ever shown. Anything else is dropped
// from the default feed (it can live behind a developer drawer instead).
const EVENT_PHASE: Record<string, ProductPhase> = {
  'section-started': 'preparing',
  'skill-loaded': 'preparing',
  'tool-started': 'searching',
  'tool-finished': 'searching',
  'structured-output-started': 'drafting',
  'validation-failed': 'checking',
  'repair-started': 'refining',
  'sub-section-committed': 'committing',
  'artifact-saved': 'committing',
  'section-completed': 'done',
  'section-failed': 'done',
};

export function phaseForEvent(eventType: string): ProductPhase | null {
  return EVENT_PHASE[eventType] ?? null;
}

const SECTION_TITLES: Record<string, string> = {
  positioningMarketCategory: 'Market & Category',
  positioningBuyerICP: 'Buyer & ICP',
  positioningCompetitorLandscape: 'Competitor Landscape',
  positioningVoiceOfCustomer: 'Voice of Customer',
  positioningDemandIntent: 'Demand & Intent',
  positioningOfferDiagnostic: 'Offer Diagnostic',
  positioningPaidMediaPlan: 'Paid Media Plan',
};

export function sectionTitle(zone: string): string {
  return SECTION_TITLES[zone] ?? zone;
}

const JSON_HINT = /[{}\[\]]|"code"|body\./;

// Translate an internal repair/validation reason into a calm, customer-safe
// line. Defaults to a generic phrase for anything structural or JSON-shaped —
// we never echo raw Zod arrays or schema paths.
export function translateReason(reason?: unknown): string | undefined {
  if (typeof reason !== 'string' || !reason.trim()) return undefined;
  const grounding = reason.match(/grounding (\d+) unsupported claim/i);
  if (grounding) return `Strengthening ${grounding[1]} claim${grounding[1] === '1' ? '' : 's'} with sources`;
  const sources = reason.match(/sources:\s*have (\d+),\s*need >?=?\s*(\d+)/i);
  if (sources) return `Gathering more sources (${sources[1]} of ${sources[2]})`;
  if (reason.length <= 72 && !JSON_HINT.test(reason)) return reason;
  return 'Refining section structure';
}

// A web_search query is safe to show as a chip (Perplexity-style). Drop
// anything suspiciously long or JSON-shaped.
export function searchChip(event: FixtureEvent): string | undefined {
  const q = event.payload?.metadata?.query;
  if (typeof q === 'string' && q.trim().length > 0 && q.length <= 96 && !JSON_HINT.test(q)) {
    return q.trim();
  }
  return undefined;
}

export interface NarrationItem {
  id: string;
  zone: string;
  phase: ProductPhase;
  label: string;
  detail?: string;
  chip?: string;
  tone: NarrationTone;
  at: string;
}

// Build the customer-safe feed. One item per allowlisted event, clean fields
// only. `message` from the engine is already safe; detail is translated.
export function buildNarration(events: FixtureEvent[]): NarrationItem[] {
  const items: NarrationItem[] = [];
  for (const e of events) {
    const phase = EVENT_PHASE[e.eventType];
    if (!phase) continue;
    const meta = PHASE_META[phase];
    let detail: string | undefined;
    if (e.eventType === 'repair-started') {
      detail = translateReason(e.payload?.metadata?.reason);
    } else if (e.eventType === 'validation-failed') {
      detail = 'Verifying claims against sources';
    }
    items.push({
      id: e.id,
      zone: e.zone,
      phase,
      label: meta.label,
      detail,
      chip: e.eventType === 'tool-finished' ? searchChip(e) : undefined,
      tone: meta.tone,
      at: e.createdAt,
    });
  }
  return items;
}

// Collapse consecutive same-phase items within a zone into one row with a
// count, for a compact feed ("Searching source evidence · 24 queries").
export interface CollapsedNarration extends NarrationItem {
  count: number;
  chips: string[];
}

export function collapseNarration(items: NarrationItem[]): CollapsedNarration[] {
  const out: CollapsedNarration[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.zone === item.zone && last.phase === item.phase) {
      last.count += 1;
      last.at = item.at;
      if (item.chip) last.chips.push(item.chip);
      if (item.detail) last.detail = item.detail;
      continue;
    }
    out.push({ ...item, count: 1, chips: item.chip ? [item.chip] : [] });
  }
  return out;
}

export interface PhaseSummary {
  currentPhase: ProductPhase | null;
  toolsRun: number;
  repairs: number;
  subSectionsCommitted: number;
  counts: Record<ProductPhase, number>;
}

export function phaseSummary(events: FixtureEvent[]): PhaseSummary {
  const counts = Object.fromEntries(PHASE_ORDER.map((p) => [p, 0])) as Record<ProductPhase, number>;
  let toolsRun = 0;
  let repairs = 0;
  let subSectionsCommitted = 0;
  let currentPhase: ProductPhase | null = null;
  for (const e of events) {
    const phase = EVENT_PHASE[e.eventType];
    if (!phase) continue;
    counts[phase] += 1;
    currentPhase = phase;
    if (e.eventType === 'tool-finished') toolsRun += 1;
    if (e.eventType === 'repair-started') repairs += 1;
    if (e.eventType === 'sub-section-committed') subSectionsCommitted += 1;
  }
  return { currentPhase, toolsRun, repairs, subSectionsCommitted, counts };
}

export interface VerificationBadge {
  verified: number;
  flagged: number;
}

// The fabrication-gate signal, surfaced as a calm per-section badge.
export function readVerification(data: FixtureArtifactData | null | undefined): VerificationBadge | null {
  const v = data?.verification;
  if (!v) return null;
  const verified = Number(v.verifiedCount ?? 0);
  const flagged = Number(v.unsupportedCount ?? 0);
  if (!Number.isFinite(verified) && !Number.isFinite(flagged)) return null;
  return { verified: verified || 0, flagged: flagged || 0 };
}
