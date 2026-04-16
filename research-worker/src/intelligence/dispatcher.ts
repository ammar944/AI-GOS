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
import { writeIntelligenceCard } from '../supabase';

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

/**
 * Override where a card's result is WRITTEN, independent of what section's
 * wiki completion TRIGGERED the card. Default (not listed here) is to write
 * under the trigger section, i.e. parentSection = input.section.
 *
 * The white-space-gap card is TRIGGERED by competitorIntel (it needs
 * competitor wiki entries to analyze) but SURFACES in the offer section
 * of the UI (it informs offer positioning moves). So the write section is
 * 'offerAnalysis' even though the trigger is 'competitorIntel'.
 */
const CARD_RENDER_SECTION: Record<string, string> = {
  'white-space-gap': 'offerAnalysis',
  // 'offer-statement' also surfaces in offerAnalysis, but its trigger IS
  // offerAnalysis so the default already sends it there — no override needed.
};

const CARD_IMPL: Record<string, (pack: ReturnType<typeof buildEvidencePack>) => Promise<unknown>> = {
  opportunity: synthesizeOpportunity,
  'white-space-gap': synthesizeWhiteSpaceGap,
  'offer-statement': synthesizeOfferStatements,
  'strategic-synthesis': synthesizeStrategicSynthesis,
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
    try {
      const pack = buildEvidencePack(
        cardName,
        input.section,
        input.wikiEntries,
        input.runId,
        input.userId,
        input.identityCard,
      );

      if (pack.entries.length === 0) {
        return {
          cardName,
          status: 'gated',
          gateReason: 'no_evidence_in_wiki',
          durationMs: Date.now() - start,
          model: 'n/a',
        };
      }

      const impl = CARD_IMPL[cardName];
      if (!impl) {
        return {
          cardName,
          status: 'failed',
          error: `no implementation for card ${cardName}`,
          durationMs: Date.now() - start,
          model: 'n/a',
        };
      }

      const draft = await impl(pack);
      const { validated, rejected, confidence } = await validateCardClaims(cardName, draft, pack);

      try {
        await writeIntelligenceCard(
          input.userId,
          input.runId,
          CARD_RENDER_SECTION[cardName] ?? input.section,
          cardName,
          validated,
          {
            durationMs: Date.now() - start,
            model: 'haiku',
            confidence,
            rejected,
          },
        );
      } catch (err) {
        // Non-fatal — card is rendered in memory even if the write fails.
        console.warn(`[intelligence] writeIntelligenceCard failed for ${cardName}:`, err);
      }

      return {
        cardName,
        status: 'rendered',
        data: validated,
        claimsRejected: rejected,
        durationMs: Date.now() - start,
        model: 'haiku', // cards override when they finalize — this is default
        cost: undefined,
      };
    } catch (err) {
      return {
        cardName,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
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
  for (const r of results) {
    if (r.status === 'rendered') {
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
  }
});
