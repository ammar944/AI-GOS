// Research context builder for the unified chat endpoint.
//
// Dispatch A2 (chat-redesign, 2026-04-20). Pulls three signal sources in
// parallel and returns compact text blocks that the chat route injects into
// the Claude dynamic (uncached) system suffix:
//
//   1. research_telemetry `extra` payloads — evidence from the current run's
//      completed section runners.
//   2. business_profile_documents — uploaded reference docs tagged for this
//      section.
//   3. meeting_transcripts / business_profile_documents.extracted_fields —
//      Fathom-style sales-call intelligence attached to the current run.
//
// Budget: soft-capped by characters (~4 chars/token). Each source has its own
// budget; if one source is empty, the unused budget does NOT roll over
// (simpler reasoning — sources stay independent). A failed query logs and
// returns empty for that source; the chat route MUST continue.
//
// Spec pointer: `.claude/workspaces/aigos-feature-dev/stages/03-build/PLAN.md`
// (A2 atom).

import { createAdminClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Boundary-form research section IDs as used by the telemetry writer
 * (`research-worker/src/index.ts` — TOOL_SECTION_MAP) and the dispatch route.
 * `null` means "no section context" — skip the research_telemetry query.
 */
export type ResearchSection =
  | 'identityResolution'
  | 'industryMarket'
  | 'icpValidation'
  | 'competitors'
  | 'offerAnalysis'
  | 'keywordIntel'
  | 'crossAnalysis'
  | 'mediaPlan';

export interface ResearchContext {
  researchEvidence: string;
  documentExcerpts: string;
  meetingInsights: string;
  totalTokensEstimate: number;
}

export interface BuildResearchContextParams {
  userId: string;
  runId: string | null;
  section: ResearchSection | null;
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_TOKENS = 14_000;

// Allocation (tokens). Sum = DEFAULT_MAX_TOKENS.
const RESEARCH_BUDGET_TOKENS = 8_000;
const DOCS_BUDGET_TOKENS = 4_000;
const MEETINGS_BUDGET_TOKENS = 2_000;

// Telemetry events that mark a section's terminal state. `section_complete`
// does not exist in the worker — we read `runner.end` as the canonical
// "section finished" signal. `card.write` is also included so per-card
// evidence payloads (stat blocks, opportunity tables, competitor diffs)
// appear in the context.
const SECTION_DONE_EVENTS = ['runner.end', 'card.write'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateToTokens(text: string, tokenBudget: number): string {
  const charBudget = tokenBudget * CHARS_PER_TOKEN;
  if (text.length <= charBudget) return text;
  return `${text.slice(0, charBudget)}\n\n[...truncated]`;
}

/**
 * Stable-key JSON stringify for readability. Keeps the model-facing block
 * small by using minimal whitespace.
 */
function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 1);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Source queries — each returns a formatted string or empty on failure
// ---------------------------------------------------------------------------

interface TelemetryRow {
  event: string;
  card: string | null;
  phase: string | null;
  extra: Record<string, unknown> | null;
  event_timestamp: string;
}

async function fetchResearchEvidence(
  userId: string,
  runId: string,
  section: ResearchSection,
  tokenBudget: number,
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('research_telemetry')
    .select('event, card, phase, extra, event_timestamp')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .eq('section', section)
    .in('event', SECTION_DONE_EVENTS as readonly string[] as string[])
    .order('event_timestamp', { ascending: true });

  if (error) {
    throw new Error(`research_telemetry query failed: ${error.message}`);
  }
  const rows = (data ?? []) as TelemetryRow[];
  const rowsWithExtra = rows.filter(
    (r) => r.extra && typeof r.extra === 'object' && Object.keys(r.extra).length > 0,
  );
  if (rowsWithExtra.length === 0) return '';

  const parts: string[] = [`## Research findings — ${section}`];
  for (const row of rowsWithExtra) {
    const label = row.card ? `${row.event} [card=${row.card}]` : row.event;
    parts.push(`### ${label}`);
    parts.push(compactJson(row.extra));
  }
  const block = parts.join('\n');
  return truncateToTokens(block, tokenBudget);
}

interface DocumentRow {
  file_name: string | null;
  parsed_markdown: string | null;
  doc_kind: string | null;
  token_count: number | null;
}

async function fetchDocumentExcerpts(
  userId: string,
  section: ResearchSection | null,
  tokenBudget: number,
): Promise<string> {
  const supabase = createAdminClient();
  let query = supabase
    .from('business_profile_documents')
    .select('file_name, parsed_markdown, doc_kind, token_count')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(6);
  if (section) {
    query = query.overlaps('section_tags', [section]);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`business_profile_documents query failed: ${error.message}`);
  }
  const docs = (data ?? []) as DocumentRow[];
  if (docs.length === 0) return '';

  let remaining = tokenBudget;
  const parts: string[] = ['## Uploaded documents'];
  for (const doc of docs) {
    if (remaining <= 0) break;
    if (!doc.parsed_markdown) continue;
    const title = doc.file_name ?? 'untitled';
    const kind = doc.doc_kind ?? 'document';
    const header = `### ${title} (${kind})`;
    const excerptBudget = Math.min(remaining, Math.max(500, Math.floor(tokenBudget / 3)));
    const body = truncateToTokens(doc.parsed_markdown, excerptBudget);
    const entry = `${header}\n${body}`;
    parts.push(entry);
    remaining -= estimateTokens(entry);
  }
  if (parts.length === 1) return '';
  return parts.join('\n\n');
}

interface JourneySessionMeetingRow {
  meeting_transcripts: unknown;
}

interface MeetingMetaLike {
  id?: string;
  title?: string;
  meetingType?: string;
  status?: string;
  documentId?: string;
  dateAdded?: string;
}

interface DocExtractedFieldsRow {
  id: string;
  extracted_fields: unknown;
}

async function fetchMeetingInsights(
  userId: string,
  runId: string,
  tokenBudget: number,
): Promise<string> {
  const supabase = createAdminClient();
  const { data: sessionRow, error: sessionErr } = await supabase
    .from('journey_sessions')
    .select('meeting_transcripts')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle<JourneySessionMeetingRow>();
  if (sessionErr) {
    throw new Error(`journey_sessions meeting fetch failed: ${sessionErr.message}`);
  }
  const rawMeetings = sessionRow?.meeting_transcripts;
  if (!Array.isArray(rawMeetings) || rawMeetings.length === 0) return '';

  const readyMeetings = (rawMeetings as MeetingMetaLike[]).filter(
    (m) => m && m.status === 'ready' && typeof m.documentId === 'string',
  );
  if (readyMeetings.length === 0) return '';

  const docIds = readyMeetings
    .map((m) => m.documentId)
    .filter((id): id is string => typeof id === 'string');
  const { data: docs, error: docsErr } = await supabase
    .from('business_profile_documents')
    .select('id, extracted_fields')
    .in('id', docIds);
  if (docsErr) {
    throw new Error(`business_profile_documents meeting lookup failed: ${docsErr.message}`);
  }
  const extractedById = new Map<string, unknown>();
  for (const doc of (docs ?? []) as DocExtractedFieldsRow[]) {
    if (doc.extracted_fields && typeof doc.extracted_fields === 'object') {
      extractedById.set(doc.id, doc.extracted_fields);
    }
  }
  if (extractedById.size === 0) return '';

  let remaining = tokenBudget;
  const parts: string[] = ['## Sales call intelligence'];
  for (const meeting of readyMeetings) {
    if (remaining <= 0) break;
    const extracted = meeting.documentId
      ? extractedById.get(meeting.documentId)
      : undefined;
    if (!extracted) continue;
    const title = meeting.title ?? 'untitled call';
    const date = meeting.dateAdded ?? '';
    const header = `### ${title}${date ? ` (${date})` : ''}`;
    const body = compactJson(extracted);
    const entryBudget = Math.min(remaining, Math.max(400, Math.floor(tokenBudget / 2)));
    const truncated = truncateToTokens(body, entryBudget);
    const entry = `${header}\n${truncated}`;
    parts.push(entry);
    remaining -= estimateTokens(entry);
  }
  if (parts.length === 1) return '';
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Build a research context block for the chat endpoint.
 *
 * All three underlying queries run in parallel. A failure in any single query
 * is logged and swallowed — the other two still contribute. Each block is
 * individually truncated to its token budget; the caller is responsible for
 * placing the blocks into the DYNAMIC (uncached) system prompt suffix so that
 * per-run context does not poison the prompt cache.
 */
export async function buildResearchContext(
  params: BuildResearchContextParams,
): Promise<ResearchContext> {
  const { userId, runId, section, maxTokens = DEFAULT_MAX_TOKENS } = params;

  // Scale each budget proportionally if the caller overrides maxTokens.
  const scale = maxTokens / DEFAULT_MAX_TOKENS;
  const researchBudget = Math.floor(RESEARCH_BUDGET_TOKENS * scale);
  const docsBudget = Math.floor(DOCS_BUDGET_TOKENS * scale);
  const meetingsBudget = Math.floor(MEETINGS_BUDGET_TOKENS * scale);

  const researchPromise: Promise<string> =
    runId && section
      ? fetchResearchEvidence(userId, runId, section, researchBudget).catch((err) => {
          console.warn('[context-builder] research evidence failed:', err?.message ?? err);
          return '';
        })
      : Promise.resolve('');

  const docsPromise: Promise<string> = fetchDocumentExcerpts(
    userId,
    section,
    docsBudget,
  ).catch((err) => {
    console.warn('[context-builder] document excerpts failed:', err?.message ?? err);
    return '';
  });

  const meetingsPromise: Promise<string> = runId
    ? fetchMeetingInsights(userId, runId, meetingsBudget).catch((err) => {
        console.warn('[context-builder] meeting insights failed:', err?.message ?? err);
        return '';
      })
    : Promise.resolve('');

  const [researchEvidence, documentExcerpts, meetingInsights] = await Promise.all([
    researchPromise,
    docsPromise,
    meetingsPromise,
  ]);

  const totalTokensEstimate =
    estimateTokens(researchEvidence) +
    estimateTokens(documentExcerpts) +
    estimateTokens(meetingInsights);

  return {
    researchEvidence,
    documentExcerpts,
    meetingInsights,
    totalTokensEstimate,
  };
}
