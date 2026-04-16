/**
 * Opportunity card synthesizer — Phase 6.2 stub.
 * Throws until card-level migration lands. The dispatcher catches the throw
 * and marks the card as 'failed' without blocking siblings.
 */
import type { EvidencePack } from '../types';

export async function synthesizeOpportunity(_pack: EvidencePack): Promise<unknown> {
  throw new Error('synthesizeOpportunity: not implemented — Phase 6.2');
}
