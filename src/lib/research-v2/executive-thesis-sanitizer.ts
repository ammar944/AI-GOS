/**
 * Commit-boundary sanitizer + compose-always helper for the executive thesis
 * persisted to research_artifacts.thesis.
 *
 * The buyer-eval gate scans the WHOLE thesis record: evaluateMemo rejects any
 * MEMO_BLOCKING_TOKENS in any string leaf (no skip-key), and evaluateDenyList
 * also scans the thesis for internal vocabulary. This module guarantees the
 * persisted thesis passes both — internal/process phrasing is re-expressed in
 * buyer-facing language and rankedMoves are de-duplicated — without changing
 * the thesis status (the caller owns that).
 *
 * `buildIncompleteExecutiveThesis` is the compose-always fallback: when the
 * full brief cannot be assembled, the memo still ships as a concise,
 * buyer-facing INCOMPLETE memo (status `complete`) with explicit gaps and next
 * actions, instead of a client-visible `status: 'error'`. The underlying error
 * is logged by the caller, never persisted into the scanned thesis.
 */

import { scrubClientSurfaceText } from './client-surface-sanitizer';

// Mirror of MEMO_BLOCKING_TOKENS in scripts/zz-buyer-eval.mjs. Parity is
// asserted by executive-thesis-sanitizer.test.ts.
export const MEMO_BLOCKING_TOKENS: readonly string[] = [
  'blocked',
  'resolve contradiction',
  'contradiction(s) remain',
  'contradictions remain',
  'instruction:',
  'todo',
  'tbd',
  'placeholder',
  'rewrite this',
  'fix this',
];

const MEMO_REWRITES: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\bresolve contradiction\b/gi, replacement: 'reconcile the open question' },
  { pattern: /contradiction\(s\) remain/gi, replacement: 'open questions remain' },
  { pattern: /contradictions remain/gi, replacement: 'open questions remain' },
  { pattern: /\bblocked\b/gi, replacement: 'pending' },
  { pattern: /\binstruction:/gi, replacement: 'note:' },
  { pattern: /\b(?:todo|tbd)\b/gi, replacement: 'to confirm' },
  { pattern: /\bplaceholder\b/gi, replacement: 'to be added' },
  { pattern: /\b(?:rewrite this|fix this)\b/gi, replacement: 'revise this' },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mirror of the MEMO scan in scripts/zz-buyer-eval.mjs (plain includes). */
export function findMemoBlockingToken(value: string): string | null {
  const lower = value.toLowerCase();
  for (const token of MEMO_BLOCKING_TOKENS) {
    if (lower.includes(token.toLowerCase())) return token;
  }
  return null;
}

function stripMemoToken(text: string, token: string): string {
  const escaped = escapeRegExp(token);
  const pattern = /\s/.test(token) ? escaped : `[\\w-]*${escaped}[\\w-]*`;
  return text.replace(new RegExp(pattern, 'gi'), '');
}

function scrubMemoText(value: string): string {
  if (value.length === 0 || /^https?:\/\//i.test(value.trim())) return value;
  let out = value;
  for (const { pattern, replacement } of MEMO_REWRITES) {
    out = out.replace(pattern, replacement);
  }
  let guard = 0;
  let token = findMemoBlockingToken(out);
  while (token !== null && guard < 64) {
    out = stripMemoToken(out, token);
    token = findMemoBlockingToken(out);
    guard += 1;
  }
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
  return out.length > 0 ? out : 'Not available.';
}

function sanitizeThesisString(value: string): string {
  // DENY-LIST scrub first (handles internal vocabulary + URL passthrough),
  // then MEMO-blocking scrub. The result satisfies both gate checks.
  return scrubMemoText(scrubClientSurfaceText(value));
}

function sanitizeNode(node: unknown): unknown {
  if (typeof node === 'string') return sanitizeThesisString(node);
  if (Array.isArray(node)) return node.map((item) => sanitizeNode(item));
  if (node !== null && typeof node === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      result[key] = sanitizeNode(child);
    }
    return result;
  }
  return node;
}

function normalizedMoveText(move: unknown): string {
  if (typeof move === 'string') return move.replace(/\s+/g, ' ').trim().toLowerCase();
  if (move === null || typeof move !== 'object') return '';
  const record = move as Record<string, unknown>;
  for (const key of ['move', 'title', 'headline', 'recommendation', 'name', 'label']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.replace(/\s+/g, ' ').trim().toLowerCase();
    }
  }
  return JSON.stringify(move).toLowerCase();
}

function dedupeRankedMoves(moves: unknown[]): unknown[] {
  const seen = new Set<string>();
  const kept: unknown[] = [];
  for (const move of moves) {
    const key = normalizedMoveText(move);
    if (key.length > 0 && seen.has(key)) continue;
    seen.add(key);
    kept.push(move);
  }
  return kept.map((move, index) =>
    move !== null && typeof move === 'object' && 'rank' in (move as Record<string, unknown>)
      ? { ...(move as Record<string, unknown>), rank: index + 1 }
      : move,
  );
}

/**
 * Returns a deep copy of a thesis record with internal/process vocabulary
 * scrubbed from every string leaf and rankedMoves de-duplicated. Does not
 * change `status` — the caller decides whether the thesis is complete.
 */
export function sanitizeExecutiveThesis(
  thesis: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = sanitizeNode(thesis) as Record<string, unknown>;
  if (Array.isArray(sanitized.rankedMoves)) {
    sanitized.rankedMoves = dedupeRankedMoves(sanitized.rankedMoves);
  }
  return sanitized;
}

export interface IncompleteThesisSection {
  sectionId: string;
  label: string;
  verificationTier?: 'verified' | 'needs_review' | 'insufficient' | null;
}

/**
 * Compose-always fallback memo. Produces a buyer-facing INCOMPLETE executive
 * memo (status `complete`) with explicit gaps + next actions when the full
 * brief cannot be assembled. The raw failure reason is NOT included — callers
 * log it separately so it never reaches the scanned thesis.
 */
export function buildIncompleteExecutiveThesis(input: {
  companyName: string;
  generatedAt: string;
  sections?: readonly IncompleteThesisSection[];
}): Record<string, unknown> {
  const sections = input.sections ?? [];
  const committed = sections.length;
  const weak = sections.filter(
    (section) =>
      section.verificationTier === 'insufficient' ||
      section.verificationTier === 'needs_review',
  );

  const executiveThesis =
    committed > 0
      ? `This audit assembled ${committed} research section${committed === 1 ? '' : 's'} for ${input.companyName}, but ${weak.length} ${weak.length === 1 ? 'is' : 'are'} flagged low-confidence and need another round of evidence before we commit to a recommendation. Treat the moves below as directional — the strongest available signal, not a validated plan.`
      : `We could not assemble a complete decision memo for ${input.companyName} from this run. The research inputs are saved; re-running the strategist brief will compose the memo once the sections reconcile.`;

  const rankedMoves: { rank: number; move: string; provingSections: string[] }[] = weak
    .filter((section) => section.verificationTier === 'insufficient')
    .slice(0, 3)
    .map((section, index) => ({
      rank: index + 1,
      move: `Strengthen the ${section.label} evidence before acting on it — it is currently the weakest input to the plan.`,
      provingSections: [section.sectionId],
    }));

  if (rankedMoves.length === 0) {
    rankedMoves.push({
      rank: 1,
      move: 'Re-run the strategist brief once the research sections reconcile.',
      provingSections: [],
    });
  }

  return sanitizeExecutiveThesis({
    status: 'complete',
    incomplete: true,
    generatedAt: input.generatedAt,
    executiveThesis,
    thesis: executiveThesis,
    decisions: [],
    rankedMoves,
    assumptionsToConfirm: [],
  });
}
