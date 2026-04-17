/**
 * Intelligence dispatcher — fans out card synthesis jobs in parallel
 * once a section's wiki entries are written.
 *
 * Phase 6.1 delivers a skeleton. Phase 7.1 wires the event bus (see
 * ../events.ts). Phase 6.2 fills in the card stubs.
 *
 * Trigger map (which section's wiki write unlocks which cards):
 *   industryMarket  → opportunity
 *   competitorIntel → white-space-gap
 *   offerAnalysis   → offer-statement
 *   crossAnalysis   → strategic-synthesis
 */
import type { WikiEntry } from '../wiki';
import { workerBus } from '../events';
import type { CardResult } from './types';
import { buildEvidencePack } from './evidence-packer';
import { synthesizeOpportunity } from './cards/opportunity';
import { synthesizeWhiteSpaceGap } from './cards/white-space-gap';
import { synthesizeOfferStatements } from './cards/offer-statements';
import { synthesizeStrategicSynthesis } from './cards/strategic-synthesis';
import { validateCardClaims } from './validator';
import { writeIntelligenceCard } from './write-card';
import { MODELS } from '../models';
import { emitTelemetry } from '../telemetry';

/**
 * Which cards a given section unlocks. Multiple cards may fire for one
 * section; each card consumes its own evidence pack.
 */
const SECTION_CARD_MAP: Record<string, string[]> = {
  industryMarket: ['opportunity'],
  competitorIntel: ['white-space-gap'],
  offerAnalysis: ['offer-statement'],
  crossAnalysis: ['strategic-synthesis'],
};

const CARD_IMPL: Record<string, (pack: ReturnType<typeof buildEvidencePack>) => Promise<unknown>> = {
  opportunity: synthesizeOpportunity,
  'white-space-gap': synthesizeWhiteSpaceGap,
  'offer-statement': synthesizeOfferStatements,
  'strategic-synthesis': synthesizeStrategicSynthesis,
};

const CARD_MODEL: Record<string, string> = {
  opportunity: MODELS.FAST,
  'white-space-gap': MODELS.FAST,
  'offer-statement': MODELS.FAST,
  'strategic-synthesis': MODELS.STANDARD,
};

interface DispatchInput {
  section: string;
  runId: string;
  userId: string;
  /** All wiki entries for the run, not just this section's — cards may cross-filter. */
  wikiEntries: WikiEntry[];
  identityCard?: unknown;
}

/**
 * Fan out all cards unlocked by a completed section. Each card runs in
 * parallel via Promise.allSettled so one failure doesn't block the others.
 * Flag gates:
 *   INTELLIGENCE_PIPELINE=false → returns [] without running anything
 *   INTELLIGENCE_CARDS=<csv>    → restricts to listed card names
 *   INTELLIGENCE_PARALLEL=false → runs cards serially (diagnostic use)
 */
export async function dispatchIntelligenceCards(input: DispatchInput): Promise<CardResult[]> {
  if (process.env.INTELLIGENCE_PIPELINE === 'false') return [];

  const cards = SECTION_CARD_MAP[input.section] ?? [];
  if (cards.length === 0) return [];

  const allowList = parseAllowList(process.env.INTELLIGENCE_CARDS);
  const selectedCards = allowList
    ? cards.filter((c) => allowList.has(c))
    : cards;

  if (selectedCards.length === 0) return [];

  const runCard = async (cardName: string): Promise<CardResult> => {
    const start = Date.now();
    const telemetryBase = {
      runId: input.runId,
      userId: input.userId,
      section: input.section,
      card: cardName,
      model: CARD_MODEL[cardName],
    };
    emitTelemetry({ ...telemetryBase, event: 'card.synthesize.start' });
    try {
      const packStart = Date.now();
      const pack = buildEvidencePack(
        cardName,
        input.section,
        input.wikiEntries,
        input.runId,
        input.userId,
        input.identityCard,
      );
      emitTelemetry({
        ...telemetryBase,
        event: 'evidence.pack',
        durationMs: Date.now() - packStart,
        extra: { entryCount: pack.entries.length },
      });

      if (pack.entries.length === 0) {
        const durationMs = Date.now() - start;
        emitTelemetry({
          ...telemetryBase,
          event: 'card.gated',
          durationMs,
          extra: { reason: 'no_evidence_in_wiki' },
        });
        return {
          cardName,
          status: 'gated',
          gateReason: 'no_evidence_in_wiki',
          durationMs,
          model: 'n/a',
        };
      }

      const impl = CARD_IMPL[cardName];
      if (!impl) {
        const durationMs = Date.now() - start;
        emitTelemetry({
          ...telemetryBase,
          event: 'card.error',
          durationMs,
          errorMessage: `no implementation for card ${cardName}`,
        });
        return {
          cardName,
          status: 'failed',
          error: `no implementation for card ${cardName}`,
          durationMs,
          model: 'n/a',
        };
      }

      const draft = await impl(pack);
      emitTelemetry({
        ...telemetryBase,
        event: 'card.synthesize.end',
        durationMs: Date.now() - start,
      });

      const validateStart = Date.now();
      emitTelemetry({ ...telemetryBase, event: 'card.validate.start' });
      const { validated, rejected, confidence } = await validateCardClaims(cardName, draft, pack);
      emitTelemetry({
        ...telemetryBase,
        event: 'card.validate.end',
        durationMs: Date.now() - validateStart,
        extra: { rejectedCount: rejected?.length ?? 0, confidence },
      });

      return {
        cardName,
        status: 'rendered',
        data: validated,
        claimsRejected: rejected,
        durationMs: Date.now() - start,
        model: CARD_MODEL[cardName] ?? 'unknown',
        cost: undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - start;
      // Synthesizers can throw `GATED:<reason>` to indicate the card had
      // nothing meaningful to emit (e.g., empty scorecard + no actions).
      // Convert these to a gated status instead of failed — Supabase stays
      // clean and the frontend simply doesn't render an empty shell.
      if (message.startsWith('GATED:')) {
        const reason = message.slice('GATED:'.length) || 'empty_output';
        emitTelemetry({
          ...telemetryBase,
          event: 'card.gated',
          durationMs,
          extra: { reason },
        });
        return {
          cardName,
          status: 'gated',
          gateReason: reason,
          durationMs,
          model: CARD_MODEL[cardName] ?? 'n/a',
        };
      }
      emitTelemetry({
        ...telemetryBase,
        event: 'card.error',
        durationMs,
        errorMessage: message,
      });
      return {
        cardName,
        status: 'failed',
        error: message,
        durationMs,
        model: 'n/a',
      };
    }
  };

  if (process.env.INTELLIGENCE_PARALLEL === 'false') {
    const out: CardResult[] = [];
    for (const c of selectedCards) out.push(await runCard(c));
    return out;
  }

  const settled = await Promise.allSettled(selectedCards.map(runCard));
  return settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : {
          cardName: selectedCards[i],
          status: 'failed' as const,
          error: s.reason instanceof Error ? s.reason.message : String(s.reason),
          durationMs: 0,
          model: 'n/a',
        },
  );
}

function parseAllowList(csv: string | undefined): Set<string> | null {
  if (!csv || csv.trim().length === 0) return null;
  const values = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return values.length > 0 ? new Set(values) : null;
}

/**
 * Subscribe the dispatcher to the worker event bus. Called once at module
 * load — importing this file (e.g., from index.ts) wires everything up.
 *
 * Listener failures are isolated by workerBus (setImmediate + try/catch).
 */
workerBus.on('wiki:section-complete', async (payload) => {
  if (process.env.INTELLIGENCE_PIPELINE === 'false') return;
  const results = await dispatchIntelligenceCards({
    section: payload.section,
    runId: payload.runId,
    userId: payload.userId,
    wikiEntries: payload.entries,
    identityCard: payload.identityCard,
  });
  const tasks = results.map(async (r) => {
    if (r.status === 'rendered') {
      const writeStart = Date.now();
      await writeIntelligenceCard({
        userId: payload.userId,
        runId: payload.runId,
        card: r,
      });
      emitTelemetry({
        event: 'card.write',
        runId: payload.runId,
        userId: payload.userId,
        section: payload.section,
        card: r.cardName,
        durationMs: Date.now() - writeStart,
        model: r.model,
      });
      workerBus.emit('card:rendered', {
        userId: payload.userId,
        runId: payload.runId,
        section: payload.section,
        cardName: r.cardName,
        durationMs: r.durationMs,
        model: r.model,
      });
    } else if (r.status === 'gated') {
      workerBus.emit('card:gated', {
        userId: payload.userId,
        runId: payload.runId,
        section: payload.section,
        cardName: r.cardName,
        reason: r.gateReason ?? 'unknown',
      });
    } else if (r.status === 'failed') {
      console.warn(
        `[intelligence] card ${r.cardName} failed in ${r.durationMs}ms: ${r.error ?? 'unknown'}`,
      );
    }
  });
  await Promise.allSettled(tasks);
});
