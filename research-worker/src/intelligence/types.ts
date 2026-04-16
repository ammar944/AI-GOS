/**
 * Intelligence layer — shared types.
 *
 * Synthesis cards consume WikiEntry[] from the research wiki and emit
 * validated card output. Every claim must cite evidenceIds that resolve
 * to entries in the EvidencePack.
 */
import type { WikiEntry } from '../wiki';

export interface EvidencePack {
  cardName: string;
  section: string;
  /** Pre-filtered by the card's topic filter (see evidence-packer CARD_TOPIC_FILTERS). */
  entries: WikiEntry[];
  /** Stable "topic#N" IDs in insertion order — cards cite these. */
  entryIds: string[];
  /** Optional resolved identity summary — available for all cards. */
  identityCard?: unknown;
  runId: string;
  userId: string;
}

export interface CardResult<T = unknown> {
  cardName: string;
  status: 'rendered' | 'gated' | 'failed';
  data?: T;
  claimsRejected?: string[];
  durationMs: number;
  model: string;
  cost?: number;
  /** Non-fatal error message when status === 'failed'. */
  error?: string;
  /** Reason the card was gated (e.g., 'insufficient_evidence'). */
  gateReason?: string;
}

/**
 * EvidenceCited<T> — every synthesized claim must cite at least one
 * evidenceId from the EvidencePack. Confidence is 0-100.
 */
export interface EvidenceCited<T> {
  value: T;
  evidenceIds: string[];
  confidence: number;
}
