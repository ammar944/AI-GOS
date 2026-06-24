import { z } from "zod";

import {
  isoDateTimeSchema,
  sectionIdSchema,
} from "@/lib/lab-engine/events/activity-event";
import {
  isHttpUrl,
  isLikelyNamedBuyerIdentity,
} from "@/lib/lab-engine/artifacts/schemas/buyer-icp";
import type { BuyerPersonaCandidate } from "@/lib/lab-engine/agents/buyer-persona-acquisition";
import type { CorpusExcerpt } from "@/lib/lab-engine/artifacts/artifact-envelope";

// Canonical research-fact ledger type. This is the SINGLE source of truth for
// the evidence ledger — nothing imports from ledger/ or evidence-ledger/.
//
// Deliberately STRICTER than evidencePoolEntrySchema.sourceUrl (which is
// .optional() at evidence-pool.ts:29): a research fact's source_url is NOT NULL
// and must be an http(s) URL. A fact whose provenance cannot be pinned to a
// live page is not a fact — it is noise, and the ledger refuses it at the
// boundary.
//
// section_id admits the 6 positioning section IDs PLUS "orchestrator" (the
// GLM orchestrator's corpus-gather facts seed the sections and belong in the
// same ledger). The DB column is plain text (no CHECK), so this is additive.
export const researchFactSectionIdSchema = z.enum([
  ...sectionIdSchema.options,
  "orchestrator",
]);

export type ResearchFactSectionId = z.infer<typeof researchFactSectionIdSchema>;

export const researchFactKindSchema = z.enum([
  "named_champion",
  "voc_quote",
  "keyword_volume",
  "corpus_excerpt",
]);

export type ResearchFactKind = z.infer<typeof researchFactKindSchema>;

export const researchFactSchema = z
  .object({
    runId: z.string().min(1),
    sectionId: researchFactSectionIdSchema,
    factKind: researchFactKindSchema,
    sourceUrl: z
      .string()
      .url()
      .refine(isHttpUrl, { message: "source_url must be an http(s) URL" }),
    sourceQuote: z.string().min(1),
    claimToken: z.string().min(1),
    createdAt: isoDateTimeSchema,
    parentAuditRunId: z.string().min(1).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type ResearchFact = z.infer<typeof researchFactSchema>;

export interface ResearchFactStore {
  appendFacts: (facts: readonly ResearchFact[]) => void | Promise<void>;
  // ASYNC: a Supabase-backed store returns the UNION of its own in-process
  // appended facts AND a real DB SELECT (cross-invocation reads — the
  // orchestrator writes facts before fan-out; a section reads them here). The
  // in-memory / noop stores resolve synchronously to their array.
  getFacts: () => Promise<ResearchFact[]>;
}

export function createInMemoryResearchFactStore(): ResearchFactStore {
  const facts: ResearchFact[] = [];

  return {
    appendFacts: (incoming: readonly ResearchFact[]): void => {
      for (const fact of incoming) {
        facts.push(fact);
      }
    },
    getFacts: async (): Promise<ResearchFact[]> => [...facts],
  };
}

export function createNoopResearchFactStore(): ResearchFactStore {
  return {
    appendFacts: (): void => {},
    getFacts: async (): Promise<ResearchFact[]> => [],
  };
}

export async function readResearchFactsFromStore(
  store: Pick<ResearchFactStore, "getFacts">,
): Promise<ResearchFact[]> {
  const result = researchFactSchema.array().safeParse(await store.getFacts());

  if (!result.success) {
    throw new Error(
      `research_facts getFacts returned invalid facts: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return result.data;
}

// Mirrors getEvidencePoolStorageContext (run-section.ts ~:579-593): only wire
// the ledger when BOTH the parent audit run id and a store are present.
export function getResearchFactStorageContext(args: {
  parentAuditRunId?: string;
  factStore?: ResearchFactStore;
}): { parentAuditRunId: string; store: ResearchFactStore } | null {
  if (args.parentAuditRunId === undefined || args.factStore === undefined) {
    return null;
  }

  return {
    parentAuditRunId: args.parentAuditRunId,
    store: args.factStore,
  };
}

// Mirrors appendEvidencePoolBestEffort (run-section.ts ~:801-832): a throwing
// store must NEVER take down the section run. Swallow and log, never rethrow.
export async function appendResearchFactsBestEffort(
  store: ResearchFactStore,
  facts: readonly ResearchFact[],
): Promise<void> {
  if (facts.length === 0) {
    return;
  }

  try {
    await store.appendFacts(facts);
  } catch (error) {
    console.warn("[research-fact] append failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Pure promoters (no I/O). Each maps a section's already-acquired candidate
// shape onto canonical ResearchFacts, dropping anything that cannot pin to a
// live http(s) source. claimToken is always a substring of sourceQuote so the
// downstream liar-catcher's substring check passes trivially while sourceUrl
// carries the real page.
// ---------------------------------------------------------------------------

export interface ResearchFactPromoterContext {
  runId: string;
  sectionId: ResearchFactSectionId;
  createdAt: string;
  parentAuditRunId?: string;
}

export interface VoiceOfCustomerFactCandidate {
  verbatim: string;
  sourceUrl: string;
}

function deriveTokenFromText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // First whitespace-delimited token of the verbatim/text. Always a substring
  // of the source quote by construction.
  const firstToken = trimmed.split(/\s+/u, 1)[0];
  return firstToken !== undefined && firstToken.length > 0
    ? firstToken
    : trimmed;
}

export function buildResearchFactsFromBuyerPersonaCandidates(
  candidates: readonly BuyerPersonaCandidate[],
  ctx: ResearchFactPromoterContext,
): ResearchFact[] {
  const facts: ResearchFact[] = [];

  for (const candidate of candidates) {
    if (
      !isLikelyNamedBuyerIdentity(candidate.name, {
        company: candidate.company,
        title: candidate.title,
      })
    ) {
      continue;
    }

    if (!isHttpUrl(candidate.url)) {
      continue;
    }

    facts.push({
      runId: ctx.runId,
      sectionId: ctx.sectionId,
      factKind: "named_champion",
      sourceUrl: candidate.url,
      sourceQuote: `${candidate.name} — ${candidate.title}, ${candidate.company}`,
      claimToken: candidate.name,
      createdAt: ctx.createdAt,
      ...(ctx.parentAuditRunId !== undefined
        ? { parentAuditRunId: ctx.parentAuditRunId }
        : {}),
    });
  }

  return facts;
}

export function buildResearchFactsFromVoiceOfCustomerCandidates(
  candidates: readonly VoiceOfCustomerFactCandidate[],
  ctx: ResearchFactPromoterContext,
): ResearchFact[] {
  const facts: ResearchFact[] = [];

  for (const candidate of candidates) {
    if (!isHttpUrl(candidate.sourceUrl)) {
      continue;
    }

    const claimToken = deriveTokenFromText(candidate.verbatim);
    if (claimToken === null) {
      continue;
    }

    facts.push({
      runId: ctx.runId,
      sectionId: ctx.sectionId,
      factKind: "voc_quote",
      sourceUrl: candidate.sourceUrl,
      sourceQuote: candidate.verbatim,
      claimToken,
      createdAt: ctx.createdAt,
      ...(ctx.parentAuditRunId !== undefined
        ? { parentAuditRunId: ctx.parentAuditRunId }
        : {}),
    });
  }

  return facts;
}

export function buildResearchFactsFromCorpusExcerpts(
  excerpts: readonly CorpusExcerpt[],
  ctx: ResearchFactPromoterContext,
): ResearchFact[] {
  const facts: ResearchFact[] = [];

  for (const excerpt of excerpts) {
    if (!isHttpUrl(excerpt.sourceUrl)) {
      continue;
    }

    const claimToken =
      deriveTokenFromText(excerpt.text) ?? deriveTokenFromText(excerpt.title);
    if (claimToken === null) {
      continue;
    }

    facts.push({
      runId: ctx.runId,
      sectionId: ctx.sectionId,
      factKind: "corpus_excerpt",
      sourceUrl: excerpt.sourceUrl,
      sourceQuote: excerpt.text,
      claimToken,
      createdAt: ctx.createdAt,
      ...(ctx.parentAuditRunId !== undefined
        ? { parentAuditRunId: ctx.parentAuditRunId }
        : {}),
    });
  }

  return facts;
}

// ---------------------------------------------------------------------------
// Supabase-backed append-only ledger store. One INSERT per fact into the
// public.research_facts table (migration 20260618_research_facts_ledger.sql).
// Append-only, no unique constraint in P0, every row carries a non-empty
// source_url by schema invariant.
// ---------------------------------------------------------------------------

export interface ResearchFactsInsertResult {
  error: { message: string } | null;
}

export interface ResearchFactsSelectResult {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
}

export interface ResearchFactsSelectBuilder {
  eq: (column: string, value: string) => Promise<ResearchFactsSelectResult>;
}

// The table builder now carries BOTH insert and select (mirrors
// evidence-pool.ts:519-522) so a Supabase-backed store can read
// cross-invocation rows, not just append-only.
export interface ResearchFactsTableBuilder {
  insert: (
    rows: Record<string, unknown>[],
  ) => Promise<ResearchFactsInsertResult>;
  select: (columns: string) => ResearchFactsSelectBuilder;
}

export interface ResearchFactsSupabaseClient {
  from: (table: "research_facts") => ResearchFactsTableBuilder;
}

function toResearchFactRow(fact: ResearchFact): Record<string, unknown> {
  return {
    run_id: fact.runId,
    parent_audit_run_id: fact.parentAuditRunId ?? null,
    section_id: fact.sectionId,
    fact_kind: fact.factKind,
    source_url: fact.sourceUrl,
    source_quote: fact.sourceQuote,
    claim_token: fact.claimToken,
    payload: fact.payload ?? null,
    created_at: fact.createdAt,
  };
}

// Inverse of toResearchFactRow: snake_case DB row -> canonical ResearchFact.
// A NULL parent_audit_run_id is OMITTED (the schema field is .optional(), not
// nullable). Returns null when the row fails schema validation so a single
// malformed row never poisons the whole SELECT.
function fromResearchFactRow(row: Record<string, unknown>): ResearchFact | null {
  const candidate = {
    runId: row.run_id,
    sectionId: row.section_id,
    factKind: row.fact_kind,
    sourceUrl: row.source_url,
    sourceQuote: row.source_quote,
    claimToken: row.claim_token,
    createdAt: row.created_at,
    ...(row.parent_audit_run_id === null || row.parent_audit_run_id === undefined
      ? {}
      : { parentAuditRunId: row.parent_audit_run_id }),
    ...(row.payload === null || row.payload === undefined
      ? {}
      : { payload: row.payload }),
  };

  const result = researchFactSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

// The table has NO unique constraint (migration :4-5), so the in-process
// appended array and the DB SELECT can both surface the same fact. Dedup by a
// deterministic content key (there is no `id` field on ResearchFact — the DB
// `id` is generated and not round-tripped through the row mapper).
function researchFactDedupKey(fact: ResearchFact): string {
  return [
    fact.runId,
    fact.parentAuditRunId ?? "",
    fact.sectionId,
    fact.factKind,
    fact.sourceUrl,
    fact.claimToken,
    fact.sourceQuote,
  ].join(" ");
}

export function createResearchArtifactsResearchFactStore(
  client: ResearchFactsSupabaseClient,
  parentAuditRunId?: string,
): ResearchFactStore {
  const appended: ResearchFact[] = [];

  return {
    appendFacts: async (
      facts: readonly ResearchFact[],
    ): Promise<void> => {
      for (const fact of facts) {
        const response = await client
          .from("research_facts")
          .insert([toResearchFactRow(fact)]);

        if (response.error) {
          throw new Error(
            `research_facts insert failed: ${response.error.message}`,
          );
        }

        appended.push(fact);
      }
    },
    // UNION of (a) this instance's in-process appended facts AND (b) a DB
    // SELECT of all rows under parent_audit_run_id (the cross-invocation read
    // — a sibling/orchestrator instance's writes). Deduped by content key.
    // When no parentAuditRunId is supplied there is nothing to filter a SELECT
    // by, so we return the in-process echo only (matches prior behavior).
    getFacts: async (): Promise<ResearchFact[]> => {
      const byKey = new Map<string, ResearchFact>();
      for (const fact of appended) {
        byKey.set(researchFactDedupKey(fact), fact);
      }

      if (parentAuditRunId !== undefined) {
        const response = await client
          .from("research_facts")
          .select("*")
          .eq("parent_audit_run_id", parentAuditRunId);

        if (response.error) {
          throw new Error(
            `research_facts select failed: ${response.error.message}`,
          );
        }

        for (const row of response.data ?? []) {
          const fact = fromResearchFactRow(row);
          if (fact === null) {
            continue;
          }
          const key = researchFactDedupKey(fact);
          if (!byKey.has(key)) {
            byKey.set(key, fact);
          }
        }
      }

      return [...byKey.values()];
    },
  };
}
