import {
  researchEvidenceSchema,
  sourceGapSchema,
  type ResearchEvidence,
  type ResearchEvidenceConfidence,
  type ResearchEvidenceSourceType,
  type SourceGap,
} from "@/lib/gtm/schemas/evidence";

export type GtmRunSourceTrustLevel =
  | "external"
  | "tool_trace"
  | "user_provided";

export interface GtmRunSourceClaimRef {
  claim_path: string[];
  claim_path_label: string;
  section: string;
  section_label: string;
}

export interface GtmRunSourceLedgerSource {
  key: string;
  source_type: ResearchEvidenceSourceType;
  label: string;
  origin_label: string;
  url?: string;
  file_reference?: string;
  transcript_reference?: string;
  tool_reference?: string;
  retrieved_at?: string;
  observed_at?: string;
  confidence: ResearchEvidenceConfidence;
  trust_level: GtmRunSourceTrustLevel;
  trust_label: string;
  evidence_ids: string[];
  quote_snippets: string[];
  claim_refs: GtmRunSourceClaimRef[];
}

export interface GtmRunSourceLedgerGroup {
  source_type: ResearchEvidenceSourceType;
  label: string;
  source_count: number;
  sources: GtmRunSourceLedgerSource[];
}

export interface GtmRunSourceGapRef {
  id: string;
  claim_path: string[];
  claim_path_label: string;
  section: string;
  section_label: string;
  severity: SourceGap["severity"];
  reason: string;
  remediation?: string;
}

export interface GtmRunSourceLedger {
  evidence_count: number;
  source_count: number;
  source_gap_count: number;
  groups: GtmRunSourceLedgerGroup[];
  source_gaps: GtmRunSourceGapRef[];
}

export interface BuildGtmRunSourceLedgerInput {
  values: readonly unknown[];
}

const SOURCE_TYPE_ORDER: ResearchEvidenceSourceType[] = [
  "website_url",
  "web_page",
  "uploaded_document",
  "transcript",
  "tool_call",
  "user_input",
];

const SOURCE_TYPE_LABELS: Record<ResearchEvidenceSourceType, string> = {
  website_url: "Website URLs",
  web_page: "Web pages",
  uploaded_document: "Uploaded documents",
  transcript: "Transcripts",
  tool_call: "Tool calls",
  user_input: "User input",
};

const SECTION_LABELS: Record<string, string> = {
  brandAndConstraints: "Brand And Constraints",
  companyIdentity: "Company Identity",
  competitive: "Competitive",
  economics: "Economics",
  funnel: "Funnel",
  goal: "Goal",
  gtmMotion: "GTM Motion",
  icp: "ICP",
  market: "Market",
  messaging: "Messaging",
  productAndOffer: "Product And Offer",
  proof: "Proof",
};

const CONFIDENCE_RANK: Record<ResearchEvidenceConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function buildGtmRunSourceLedger(
  input: BuildGtmRunSourceLedgerInput,
): GtmRunSourceLedger {
  const collected = collectEvidenceValues(input.values);
  const sourcesByKey = new Map<string, GtmRunSourceLedgerSource>();

  for (const evidence of collected.evidence) {
    const key = getEvidenceSourceKey(evidence);
    const current = sourcesByKey.get(key);
    sourcesByKey.set(
      key,
      current
        ? mergeLedgerSource(current, evidence)
        : createLedgerSource(key, evidence),
    );
  }

  const sources = [...sourcesByKey.values()].sort(compareLedgerSources);
  const sourceGaps = dedupeSourceGaps(collected.source_gaps)
    .map(toSourceGapRef)
    .sort(compareSourceGapRefs);

  return {
    evidence_count: collected.evidence.length,
    source_count: sources.length,
    source_gap_count: sourceGaps.length,
    groups: groupSourcesByType(sources),
    source_gaps: sourceGaps,
  };
}

export function buildEmptyGtmRunSourceLedger(): GtmRunSourceLedger {
  return {
    evidence_count: 0,
    source_count: 0,
    source_gap_count: 0,
    groups: [],
    source_gaps: [],
  };
}

function collectEvidenceValues(values: readonly unknown[]): {
  evidence: ResearchEvidence[];
  source_gaps: SourceGap[];
} {
  const evidence: ResearchEvidence[] = [];
  const sourceGaps: SourceGap[] = [];
  const visited = new WeakSet<object>();

  for (const value of values) {
    collectEvidenceValue(value, visited, evidence, sourceGaps);
  }

  return {
    evidence,
    source_gaps: sourceGaps,
  };
}

function collectEvidenceValue(
  value: unknown,
  visited: WeakSet<object>,
  evidence: ResearchEvidence[],
  sourceGaps: SourceGap[],
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectEvidenceValue(item, visited, evidence, sourceGaps);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (visited.has(value)) {
    return;
  }
  visited.add(value);

  const evidenceResult = researchEvidenceSchema.safeParse(value);
  if (evidenceResult.success) {
    evidence.push(evidenceResult.data);
    return;
  }

  const sourceGapResult = sourceGapSchema.safeParse(value);
  if (sourceGapResult.success) {
    sourceGaps.push(sourceGapResult.data);
    return;
  }

  for (const nestedValue of Object.values(value)) {
    collectEvidenceValue(nestedValue, visited, evidence, sourceGaps);
  }
}

function createLedgerSource(
  key: string,
  evidence: ResearchEvidence,
): GtmRunSourceLedgerSource {
  return {
    key,
    source_type: evidence.source_type,
    label: evidence.label,
    origin_label: getOriginLabel(evidence),
    ...(evidence.url ? { url: evidence.url } : {}),
    ...(evidence.file_reference
      ? { file_reference: evidence.file_reference }
      : {}),
    ...(evidence.transcript_reference
      ? { transcript_reference: evidence.transcript_reference }
      : {}),
    ...(evidence.tool_reference
      ? { tool_reference: evidence.tool_reference }
      : {}),
    ...(evidence.retrieved_at ? { retrieved_at: evidence.retrieved_at } : {}),
    ...(evidence.observed_at ? { observed_at: evidence.observed_at } : {}),
    confidence: evidence.confidence,
    trust_level: getTrustLevel(evidence.source_type),
    trust_label: getTrustLabel(evidence.source_type),
    evidence_ids: [evidence.id],
    quote_snippets: getQuoteSnippets(evidence),
    claim_refs: [toClaimRef(evidence.claim_path)],
  };
}

function mergeLedgerSource(
  source: GtmRunSourceLedgerSource,
  evidence: ResearchEvidence,
): GtmRunSourceLedgerSource {
  return {
    ...source,
    confidence: getHigherConfidence(source.confidence, evidence.confidence),
    retrieved_at: source.retrieved_at ?? evidence.retrieved_at,
    observed_at: source.observed_at ?? evidence.observed_at,
    evidence_ids: addUniqueString(source.evidence_ids, evidence.id),
    quote_snippets: mergeUniqueStrings(
      source.quote_snippets,
      getQuoteSnippets(evidence),
    ),
    claim_refs: addUniqueClaimRef(
      source.claim_refs,
      toClaimRef(evidence.claim_path),
    ),
  };
}

function getEvidenceSourceKey(evidence: ResearchEvidence): string {
  if (evidence.url) {
    return `url:${normalizeUrlKey(evidence.url)}`;
  }

  if (evidence.file_reference) {
    return `${evidence.source_type}:file:${evidence.file_reference}`;
  }

  if (evidence.transcript_reference) {
    return `${evidence.source_type}:transcript:${evidence.transcript_reference}`;
  }

  if (evidence.tool_reference) {
    return `${evidence.source_type}:tool:${evidence.tool_reference}`;
  }

  if (evidence.source_type === "user_input") {
    return `user:${evidence.id}`;
  }

  return `${evidence.source_type}:source:${evidence.id}`;
}

function normalizeUrlKey(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return value.trim();
  }
}

function groupSourcesByType(
  sources: readonly GtmRunSourceLedgerSource[],
): GtmRunSourceLedgerGroup[] {
  const groups = new Map<ResearchEvidenceSourceType, GtmRunSourceLedgerSource[]>();

  for (const source of sources) {
    groups.set(source.source_type, [
      ...(groups.get(source.source_type) ?? []),
      source,
    ]);
  }

  return [...groups.entries()]
    .map(([sourceType, groupSources]) => {
      return {
        source_type: sourceType,
        label: SOURCE_TYPE_LABELS[sourceType],
        source_count: groupSources.length,
        sources: groupSources,
      };
    })
    .sort((left, right) => {
      return getSourceTypeIndex(left.source_type) - getSourceTypeIndex(right.source_type);
    });
}

function dedupeSourceGaps(sourceGaps: readonly SourceGap[]): SourceGap[] {
  const sourceGapsByKey = new Map<string, SourceGap>();

  for (const sourceGap of sourceGaps) {
    sourceGapsByKey.set(
      `${sourceGap.id}:${formatClaimPath(sourceGap.claim_path)}`,
      sourceGap,
    );
  }

  return [...sourceGapsByKey.values()];
}

function toSourceGapRef(sourceGap: SourceGap): GtmRunSourceGapRef {
  const claimRef = toClaimRef(sourceGap.claim_path);

  return {
    id: sourceGap.id,
    claim_path: sourceGap.claim_path,
    claim_path_label: claimRef.claim_path_label,
    section: claimRef.section,
    section_label: claimRef.section_label,
    severity: sourceGap.severity,
    reason: sourceGap.reason,
    ...(sourceGap.remediation ? { remediation: sourceGap.remediation } : {}),
  };
}

function toClaimRef(claimPath: readonly string[]): GtmRunSourceClaimRef {
  const section = claimPath[0] ?? "unknown";

  return {
    claim_path: [...claimPath],
    claim_path_label: formatClaimPath(claimPath),
    section,
    section_label: SECTION_LABELS[section] ?? toTitleCase(section),
  };
}

function formatClaimPath(claimPath: readonly string[]): string {
  return claimPath.join(".");
}

function getTrustLevel(
  sourceType: ResearchEvidenceSourceType,
): GtmRunSourceTrustLevel {
  if (sourceType === "user_input") {
    return "user_provided";
  }

  if (sourceType === "tool_call") {
    return "tool_trace";
  }

  return "external";
}

function getTrustLabel(sourceType: ResearchEvidenceSourceType): string {
  if (sourceType === "user_input") {
    return "User-provided provenance";
  }

  if (sourceType === "tool_call") {
    return "Tool trace";
  }

  return "External source";
}

function getOriginLabel(evidence: ResearchEvidence): string {
  if (evidence.url) {
    return formatUrlHost(evidence.url);
  }

  if (evidence.file_reference) {
    return evidence.file_reference;
  }

  if (evidence.transcript_reference) {
    return evidence.transcript_reference;
  }

  if (evidence.tool_reference) {
    return evidence.tool_reference;
  }

  if (evidence.source_type === "user_input") {
    return "User provided";
  }

  return evidence.label;
}

function formatUrlHost(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function getQuoteSnippets(evidence: ResearchEvidence): string[] {
  const quote = evidence.quote?.trim();
  return quote ? [quote] : [];
}

function getHigherConfidence(
  left: ResearchEvidenceConfidence,
  right: ResearchEvidenceConfidence,
): ResearchEvidenceConfidence {
  return CONFIDENCE_RANK[right] > CONFIDENCE_RANK[left] ? right : left;
}

function addUniqueString(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}

function mergeUniqueStrings(
  current: readonly string[],
  next: readonly string[],
): string[] {
  return next.reduce<string[]>((merged, value) => {
    return merged.includes(value) ? merged : [...merged, value];
  }, [...current]);
}

function addUniqueClaimRef(
  claimRefs: readonly GtmRunSourceClaimRef[],
  nextClaimRef: GtmRunSourceClaimRef,
): GtmRunSourceClaimRef[] {
  if (
    claimRefs.some((claimRef) => {
      return claimRef.claim_path_label === nextClaimRef.claim_path_label;
    })
  ) {
    return [...claimRefs];
  }

  return [...claimRefs, nextClaimRef].sort(compareClaimRefs);
}

function compareLedgerSources(
  left: GtmRunSourceLedgerSource,
  right: GtmRunSourceLedgerSource,
): number {
  return (
    getSourceTypeIndex(left.source_type) - getSourceTypeIndex(right.source_type) ||
    left.origin_label.localeCompare(right.origin_label) ||
    left.label.localeCompare(right.label)
  );
}

function compareClaimRefs(
  left: GtmRunSourceClaimRef,
  right: GtmRunSourceClaimRef,
): number {
  return left.claim_path_label.localeCompare(right.claim_path_label);
}

function compareSourceGapRefs(
  left: GtmRunSourceGapRef,
  right: GtmRunSourceGapRef,
): number {
  return (
    left.section_label.localeCompare(right.section_label) ||
    left.claim_path_label.localeCompare(right.claim_path_label) ||
    left.id.localeCompare(right.id)
  );
}

function getSourceTypeIndex(sourceType: ResearchEvidenceSourceType): number {
  const index = SOURCE_TYPE_ORDER.findIndex((candidate) => {
    return candidate === sourceType;
  });
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function toTitleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
