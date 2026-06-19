/**
 * persona-ledger-check.ts — a per-persona grounding check that mirrors the
 * production deck-ledger liar-catcher (deck-ledger-gate.ts) at the BuyerICP
 * persona level.
 *
 * The shipped gate (checkDeckAgainstLedger) only walks the positioningPaidMediaPlan
 * capstone deck. When proving the spine on a SINGLE freshly-run section (no
 * capstone), we apply the same logic one level down: every committed persona
 * must trace to a real ResearchFact whose sourceUrl matches AND whose
 * sourceQuote literally contains the persona's name token at a clean boundary.
 *
 * A persona with no backing fact is exactly the failure the spine exists to
 * catch: either the section fabricated it, or it was "laundered" onto a shared
 * listing URL that does not actually name that person.
 *
 * Pure, no I/O. Reuses isCleanTokenBoundary so "Cox" inside "Coxwell" never
 * counts as a match — identical to the gate's quoteContainsTokenCleanly.
 */

import { isCleanTokenBoundary } from "@/lib/lab-engine/agents/verification/evidence-support";
import type { ResearchFact } from "@/lib/lab-engine/evidence/research-fact";

export interface PersonaLike {
  name: string;
  sourceUrl: string;
  title?: string;
  company?: string;
}

export type PersonaGroundingReason =
  | "backed"
  | "no-ledger-fact-for-source"
  | "name-token-not-in-ledger-quote";

export interface PersonaGroundingDetail {
  name: string;
  sourceUrl: string;
  backed: boolean;
  reason: PersonaGroundingReason;
}

export interface PersonaGroundingResult {
  total: number;
  backed: number;
  unbacked: number;
  details: PersonaGroundingDetail[];
}

function firstToken(text: string): string {
  return text.trim().split(/\s+/u, 1)[0] ?? "";
}

// Clean-boundary containment, identical to the gate's quoteContainsTokenCleanly.
function quoteContainsTokenCleanly(quote: string, token: string): boolean {
  if (token.length === 0 || !quote.includes(token)) {
    return false;
  }
  let from = 0;
  for (;;) {
    const offset = quote.indexOf(token, from);
    if (offset === -1) {
      return false;
    }
    if (isCleanTokenBoundary({ matchLength: token.length, offset, source: quote })) {
      return true;
    }
    from = offset + 1;
  }
}

export function checkPersonasBackedByLedger(
  personas: readonly PersonaLike[],
  ledger: readonly ResearchFact[],
): PersonaGroundingResult {
  const details: PersonaGroundingDetail[] = personas.map((persona) => {
    const factsAtUrl = ledger.filter((fact) => fact.sourceUrl === persona.sourceUrl);
    if (factsAtUrl.length === 0) {
      return {
        name: persona.name,
        sourceUrl: persona.sourceUrl,
        backed: false,
        reason: "no-ledger-fact-for-source",
      };
    }

    const token = firstToken(persona.name);
    const backed =
      token.length > 0 &&
      factsAtUrl.some((fact) => quoteContainsTokenCleanly(fact.sourceQuote, token));

    return {
      name: persona.name,
      sourceUrl: persona.sourceUrl,
      backed,
      reason: backed ? "backed" : "name-token-not-in-ledger-quote",
    };
  });

  const backed = details.filter((detail) => detail.backed).length;
  return {
    total: personas.length,
    backed,
    unbacked: personas.length - backed,
    details,
  };
}
