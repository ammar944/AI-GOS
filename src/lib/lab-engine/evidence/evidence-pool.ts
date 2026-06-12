import { z } from "zod";

import {
  isoDateTimeSchema,
  sectionIdSchema,
  type SectionId,
} from "@/lib/lab-engine/events/activity-event";

export const EVIDENCE_POOL_DATA_KEY = "wave6EvidencePool";
export const EVIDENCE_POOL_VERSION = 1;
export const STRUCTURER_EVIDENCE_POOL_CHAR_LIMIT = 48_000;
export const THINKER_EVIDENCE_POOL_CHAR_LIMIT = 100_000;

export const evidencePoolEntryKindSchema = z.enum([
  "corpusExcerpt",
  "spyfuKeywordTable",
  "adLibraryPull",
  "reviewScrape",
  "admittedQuote",
  "ctaObservation",
  "perplexityAnswer",
  "webSearchResult",
  "toolResult",
]);

export const evidencePoolEntrySchema = z
  .object({
    kind: evidencePoolEntryKindSchema,
    sourceUrl: z.string().url().optional(),
    fetchedAt: isoDateTimeSchema,
    toolName: z.string().min(1),
    payload: z.unknown(),
    sectionId: sectionIdSchema.optional(),
  })
  .strict();

export const evidencePoolSchema = z
  .object({
    version: z.literal(EVIDENCE_POOL_VERSION),
    entries: z.array(evidencePoolEntrySchema),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type EvidencePoolEntryKind = z.infer<
  typeof evidencePoolEntryKindSchema
>;
export type EvidencePoolEntry = z.infer<typeof evidencePoolEntrySchema>;
export type EvidencePool = z.infer<typeof evidencePoolSchema>;

export interface EvidencePoolStoreReadInput {
  parentAuditRunId: string;
  runId: string;
}

export interface EvidencePoolStoreWriteInput
  extends EvidencePoolStoreReadInput {
  data: Record<string, unknown>;
}

export interface EvidencePoolStore {
  readArtifactData: (input: EvidencePoolStoreReadInput) => Promise<unknown>;
  writeArtifactData: (input: EvidencePoolStoreWriteInput) => Promise<unknown>;
}

export interface AppendEvidencePoolEntriesInput
  extends EvidencePoolStoreReadInput {
  entries: readonly EvidencePoolEntry[];
  maxAttempts?: number;
  now?: () => Date;
  store: EvidencePoolStore;
}

export interface EvidencePoolSliceInput {
  maxChars?: number;
  pool: EvidencePool;
  sectionId: SectionId;
}

export interface FormatEvidencePoolSliceInput extends EvidencePoolSliceInput {
  heading?: string;
}

export interface SupabaseMaybeSingleResult {
  data: unknown;
  error: { message: string } | null;
}

export interface SupabaseResearchArtifactsFilterBuilder {
  eq: (
    column: string,
    value: string,
  ) => SupabaseResearchArtifactsFilterBuilder;
  maybeSingle: () => Promise<SupabaseMaybeSingleResult>;
  select: (columns: string) => SupabaseResearchArtifactsFilterBuilder;
}

export interface SupabaseResearchArtifactsQueryBuilder {
  select: (columns: string) => SupabaseResearchArtifactsFilterBuilder;
  update: (values: {
    data: Record<string, unknown>;
  }) => SupabaseResearchArtifactsFilterBuilder;
}

export interface SupabaseEvidencePoolClient {
  from: (table: "research_artifacts") => SupabaseResearchArtifactsQueryBuilder;
}

export interface EvidencePoolStorageErrorOptions {
  action: string;
  cause: unknown;
  parentAuditRunId: string;
  runId: string;
}

export class EvidencePoolStorageError extends Error {
  public readonly action: string;
  public readonly parentAuditRunId: string;
  public readonly runId: string;

  public constructor(options: EvidencePoolStorageErrorOptions) {
    super(
      `${options.action} failed for parentAuditRunId=${options.parentAuditRunId} runId=${options.runId}: ${getErrorMessage(options.cause)}`,
      { cause: options.cause },
    );

    this.name = "EvidencePoolStorageError";
    this.action = options.action;
    this.parentAuditRunId = options.parentAuditRunId;
    this.runId = options.runId;
  }
}

const sectionRelevantKinds: Record<SectionId, readonly EvidencePoolEntryKind[]> =
  {
    positioningMarketCategory: [
      "corpusExcerpt",
      "perplexityAnswer",
      "webSearchResult",
      "toolResult",
      "ctaObservation",
    ],
    positioningBuyerICP: [
      "corpusExcerpt",
      "perplexityAnswer",
      "webSearchResult",
      "reviewScrape",
      "admittedQuote",
      "toolResult",
      "ctaObservation",
    ],
    positioningCompetitorLandscape: [
      "corpusExcerpt",
      "perplexityAnswer",
      "webSearchResult",
      "adLibraryPull",
      "toolResult",
      "ctaObservation",
    ],
    positioningVoiceOfCustomer: [
      "corpusExcerpt",
      "perplexityAnswer",
      "webSearchResult",
      "reviewScrape",
      "admittedQuote",
      "toolResult",
      "ctaObservation",
    ],
    positioningDemandIntent: [
      "corpusExcerpt",
      "perplexityAnswer",
      "webSearchResult",
      "spyfuKeywordTable",
      "toolResult",
      "ctaObservation",
    ],
    positioningOfferDiagnostic: [
      "corpusExcerpt",
      "perplexityAnswer",
      "webSearchResult",
      "reviewScrape",
      "admittedQuote",
      "toolResult",
      "ctaObservation",
    ],
    positioningPaidMediaPlan: [
      "corpusExcerpt",
      "spyfuKeywordTable",
      "adLibraryPull",
      "reviewScrape",
      "admittedQuote",
      "ctaObservation",
      "perplexityAnswer",
      "webSearchResult",
      "toolResult",
    ],
  };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function createEmptyEvidencePool(now: () => Date): EvidencePool {
  return {
    version: EVIDENCE_POOL_VERSION,
    entries: [],
    updatedAt: now().toISOString(),
  };
}

function normalizeForStableJson(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForStableJson);
  }

  const record = asRecord(value);
  if (record === null) {
    return String(value);
  }

  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key): [string, unknown] => [
        key,
        normalizeForStableJson(record[key]),
      ]),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForStableJson(value)) ?? "null";
}

function signatureForEntry(entry: EvidencePoolEntry): string {
  return [
    entry.kind,
    entry.sectionId ?? "",
    entry.toolName,
    entry.sourceUrl ?? "",
    entry.fetchedAt,
    stableStringify(entry.payload),
  ].join("\n");
}

function getEntrySignatures(entries: readonly EvidencePoolEntry[]): Set<string> {
  return new Set(entries.map(signatureForEntry));
}

function mergeEntries(
  currentEntries: readonly EvidencePoolEntry[],
  nextEntries: readonly EvidencePoolEntry[],
): EvidencePoolEntry[] {
  const seen = getEntrySignatures(currentEntries);
  const merged = [...currentEntries];

  for (const entry of nextEntries) {
    const signature = signatureForEntry(entry);
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    merged.push(entry);
  }

  return merged;
}

function includesAllEntries(
  entries: readonly EvidencePoolEntry[],
  expectedEntries: readonly EvidencePoolEntry[],
): boolean {
  const signatures = getEntrySignatures(entries);

  return expectedEntries.every((entry) => signatures.has(signatureForEntry(entry)));
}

function compareEntriesByRecency(
  left: EvidencePoolEntry,
  right: EvidencePoolEntry,
): number {
  return Date.parse(right.fetchedAt) - Date.parse(left.fetchedAt);
}

function isEntryRelevantToSection(
  entry: EvidencePoolEntry,
  sectionId: SectionId,
): boolean {
  if (sectionId === "positioningPaidMediaPlan") {
    return true;
  }

  if (entry.sectionId === sectionId) {
    return true;
  }

  if (entry.sectionId !== undefined) {
    return false;
  }

  return sectionRelevantKinds[sectionId].includes(entry.kind);
}

function truncateToLimit(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n[truncated to ${maxChars} characters]`;
}

function formatEntryPayload(payload: unknown): string {
  try {
    return JSON.stringify(normalizeForStableJson(payload), null, 2) ?? "null";
  } catch (error) {
    return `[unserializable payload: ${getErrorMessage(error)}]`;
  }
}

function formatEvidencePoolEntry(entry: EvidencePoolEntry, index: number): string {
  const source = entry.sourceUrl === undefined ? "none" : entry.sourceUrl;
  const section =
    entry.sectionId === undefined ? "sectionId: run-level" : entry.sectionId;

  return [
    `### Evidence ${index + 1}: ${entry.kind}`,
    `toolName: ${entry.toolName}`,
    `fetchedAt: ${entry.fetchedAt}`,
    `sourceUrl: ${source}`,
    `sectionId: ${section}`,
    "payload:",
    formatEntryPayload(entry.payload),
  ].join("\n");
}

function readResponseDataField(responseData: unknown): unknown {
  return asRecord(responseData)?.data ?? null;
}

function createStorageError(options: EvidencePoolStorageErrorOptions): Error {
  return new EvidencePoolStorageError(options);
}

export function readEvidencePoolFromArtifactData(
  artifactData: unknown,
  now: () => Date = () => new Date(),
): EvidencePool {
  const record = asRecord(artifactData);
  if (record === null || record[EVIDENCE_POOL_DATA_KEY] === undefined) {
    return createEmptyEvidencePool(now);
  }

  return evidencePoolSchema.parse(record[EVIDENCE_POOL_DATA_KEY]);
}

export function writeEvidencePoolToArtifactData(
  artifactData: unknown,
  pool: EvidencePool,
): Record<string, unknown> {
  const record = asRecord(artifactData);

  return {
    ...(record ?? {}),
    [EVIDENCE_POOL_DATA_KEY]: evidencePoolSchema.parse(pool),
  };
}

export function mergeEvidencePoolEntries(
  pool: EvidencePool,
  entries: readonly EvidencePoolEntry[],
  now: () => Date = () => new Date(),
): EvidencePool {
  const parsedEntries = z.array(evidencePoolEntrySchema).parse(entries);

  return evidencePoolSchema.parse({
    ...pool,
    entries: mergeEntries(pool.entries, parsedEntries),
    updatedAt: now().toISOString(),
  });
}

export function selectEvidencePoolEntriesForSection({
  maxChars,
  pool,
  sectionId,
}: EvidencePoolSliceInput): EvidencePoolEntry[] {
  const selected = pool.entries
    .filter((entry) => isEntryRelevantToSection(entry, sectionId))
    .toSorted(compareEntriesByRecency);

  if (maxChars === undefined) {
    return selected;
  }

  const bounded: EvidencePoolEntry[] = [];
  let usedChars = 0;

  for (const entry of selected) {
    const formatted = formatEvidencePoolEntry(entry, bounded.length);
    if (bounded.length > 0 && usedChars + formatted.length > maxChars) {
      break;
    }

    bounded.push(entry);
    usedChars += formatted.length;
  }

  return bounded;
}

export function formatEvidencePoolSlice({
  heading = "Run-level evidence pool",
  maxChars = STRUCTURER_EVIDENCE_POOL_CHAR_LIMIT,
  pool,
  sectionId,
}: FormatEvidencePoolSliceInput): string {
  const selected = selectEvidencePoolEntriesForSection({ pool, sectionId });

  if (selected.length === 0) {
    return `${heading}\nNo pooled evidence is available for ${sectionId}.`;
  }

  const body = selected
    .map((entry, index) => formatEvidencePoolEntry(entry, index))
    .join("\n\n");

  return truncateToLimit(
    `${heading}\nSelected ${selected.length} pooled evidence item(s) for ${sectionId}.\n\n${body}`,
    maxChars,
  );
}

export async function appendEvidencePoolEntries({
  entries,
  maxAttempts = 3,
  now = () => new Date(),
  parentAuditRunId,
  runId,
  store,
}: AppendEvidencePoolEntriesInput): Promise<EvidencePool> {
  const parsedEntries = z.array(evidencePoolEntrySchema).parse(entries);

  if (parsedEntries.length === 0) {
    const currentData = await store.readArtifactData({ parentAuditRunId, runId });
    return readEvidencePoolFromArtifactData(currentData, now);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const currentData = await store.readArtifactData({ parentAuditRunId, runId });
    const currentPool = readEvidencePoolFromArtifactData(currentData, now);
    const nextPool = mergeEvidencePoolEntries(currentPool, parsedEntries, now);
    const nextData = writeEvidencePoolToArtifactData(currentData, nextPool);
    const storedData = await store.writeArtifactData({
      parentAuditRunId,
      runId,
      data: nextData,
    });
    const storedPool = readEvidencePoolFromArtifactData(storedData, now);

    if (includesAllEntries(storedPool.entries, parsedEntries)) {
      return storedPool;
    }
  }

  throw createStorageError({
    action: "append evidence pool entries",
    cause: new Error(
      `appended entries were not visible after ${maxAttempts} attempt(s)`,
    ),
    parentAuditRunId,
    runId,
  });
}

export function createResearchArtifactsEvidencePoolStore(
  client: SupabaseEvidencePoolClient,
): EvidencePoolStore {
  return {
    readArtifactData: async ({
      parentAuditRunId,
      runId,
    }: EvidencePoolStoreReadInput): Promise<unknown> => {
      const response = await client
        .from("research_artifacts")
        .select("data")
        .eq("id", parentAuditRunId)
        .eq("run_id", runId)
        .maybeSingle();

      if (response.error) {
        throw createStorageError({
          action: "read research_artifacts.data",
          cause: response.error,
          parentAuditRunId,
          runId,
        });
      }

      if (response.data === null) {
        throw createStorageError({
          action: "read research_artifacts.data",
          cause: new Error("research_artifacts row was not found"),
          parentAuditRunId,
          runId,
        });
      }

      return readResponseDataField(response.data);
    },
    writeArtifactData: async ({
      data,
      parentAuditRunId,
      runId,
    }: EvidencePoolStoreWriteInput): Promise<unknown> => {
      const response = await client
        .from("research_artifacts")
        .update({ data })
        .eq("id", parentAuditRunId)
        .eq("run_id", runId)
        .select("data")
        .maybeSingle();

      if (response.error) {
        throw createStorageError({
          action: "write research_artifacts.data",
          cause: response.error,
          parentAuditRunId,
          runId,
        });
      }

      if (response.data === null) {
        throw createStorageError({
          action: "write research_artifacts.data",
          cause: new Error("research_artifacts row was not found"),
          parentAuditRunId,
          runId,
        });
      }

      return readResponseDataField(response.data);
    },
  };
}
