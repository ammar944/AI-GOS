/**
 * Deterministic field normalization for parsed documents.
 */
import type { ParsedDocument } from "./parse-document.ts";
import type { ExtractedField, SourcedClaim } from "../schemas/output.ts";

export interface NormalizationResult {
  briefFragment: Record<string, Omit<ExtractedField, "field_key" | "label">>;
  fieldCatalog: ExtractedField[];
  conflicts: Array<{
    field_key: string;
    values: SourcedClaim[];
    resolution_note: string;
  }>;
  unresolvedFields: string[];
}

interface FieldRule {
  fieldKey: string;
  label: string;
  aliases: string[];
}

interface CandidateField {
  fieldKey: string;
  label: string;
  value: string;
  evidence: SourcedClaim;
  sourceDocumentId: string;
}

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^\s*$/i,
  /^\s*unknown\s*$/i,
  /^\s*tbd\s*$/i,
  /^\s*n\/a\s*$/i,
  /^\s*na\s*$/i,
  /^\s*not found\s*$/i,
  /\bscaffold\b/i,
];

export const FIELD_RULES: readonly FieldRule[] = [
  { fieldKey: "companyName", label: "Company name", aliases: ["company", "company name", "business name"] },
  { fieldKey: "companyUrl", label: "Company URL", aliases: ["website", "website url", "company url"] },
  { fieldKey: "category", label: "Category", aliases: ["category", "market category", "vertical"] },
  { fieldKey: "productDescription", label: "Product description", aliases: ["product", "product description", "what we do"] },
  { fieldKey: "primaryIcpDescription", label: "Primary ICP", aliases: ["primary icp", "ideal customer", "icp", "target customer"] },
  { fieldKey: "jobTitles", label: "Job titles", aliases: ["job titles", "target job titles", "buyers"] },
  { fieldKey: "companySize", label: "Company size", aliases: ["company size", "target company size", "employee range"] },
  { fieldKey: "geography", label: "Geography", aliases: ["geography", "region", "target region"] },
  { fieldKey: "buyingTriggers", label: "Buying triggers", aliases: ["buying triggers", "trigger events", "purchase triggers"] },
  { fieldKey: "systemsPlatforms", label: "Systems and platforms", aliases: ["systems", "platforms", "tools used"] },
  { fieldKey: "coreDeliverables", label: "Core deliverables", aliases: ["deliverables", "features", "core deliverables"] },
  { fieldKey: "pricingTiers", label: "Pricing tiers", aliases: ["pricing", "pricing tiers", "price", "packages"] },
  { fieldKey: "pricingModel", label: "Pricing model", aliases: ["pricing model", "billing model"] },
  { fieldKey: "valueProp", label: "Value proposition", aliases: ["value proposition", "value prop", "core promise"] },
  { fieldKey: "guarantees", label: "Guarantees", aliases: ["guarantee", "guarantees", "risk reversal"] },
  { fieldKey: "currentFunnelType", label: "Current funnel type", aliases: ["funnel", "current funnel", "conversion path"] },
  { fieldKey: "topCompetitors", label: "Top competitors", aliases: ["competitors", "top competitors", "alternatives"] },
  { fieldKey: "uniqueEdge", label: "Unique edge", aliases: ["unique edge", "differentiator", "differentiation"] },
  { fieldKey: "competitorFrustrations", label: "Competitor frustrations", aliases: ["competitor frustrations", "frustrations with competitors"] },
  { fieldKey: "marketBottlenecks", label: "Market bottlenecks", aliases: ["market bottlenecks", "market problems", "bottlenecks"] },
  { fieldKey: "proprietaryTech", label: "Proprietary technology", aliases: ["proprietary technology", "proprietary tech", "ip"] },
  { fieldKey: "situationBeforeBuying", label: "Situation before buying", aliases: ["before buying", "current pain", "situation before buying"] },
  { fieldKey: "desiredTransformation", label: "Desired transformation", aliases: ["desired transformation", "desired outcome", "after state"] },
  { fieldKey: "commonObjections", label: "Common objections", aliases: ["objections", "common objections"] },
  { fieldKey: "salesCycleLength", label: "Sales cycle length", aliases: ["sales cycle", "sales cycle length"] },
  { fieldKey: "salesProcessOverview", label: "Sales process overview", aliases: ["sales process", "sales process overview"] },
  { fieldKey: "brandPositioning", label: "Brand positioning", aliases: ["positioning", "brand positioning"] },
  { fieldKey: "customerVoice", label: "Customer voice", aliases: ["customer voice", "voice of customer", "testimonials"] },
  { fieldKey: "monthlyAdBudget", label: "Monthly ad budget", aliases: ["monthly ad budget", "ad budget", "media budget"] },
  { fieldKey: "dailyBudgetCeiling", label: "Daily budget ceiling", aliases: ["daily budget", "daily budget ceiling"] },
  { fieldKey: "campaignDuration", label: "Campaign duration", aliases: ["campaign duration", "duration"] },
  { fieldKey: "targetCpl", label: "Target CPL", aliases: ["target cpl", "cpl"] },
  { fieldKey: "targetCac", label: "Target CAC", aliases: ["target cac", "cac"] },
  { fieldKey: "targetSqlsPerMonth", label: "Target SQLs per month", aliases: ["target sqls", "sqls per month"] },
  { fieldKey: "targetDemosPerMonth", label: "Target demos per month", aliases: ["target demos", "demos per month"] },
  { fieldKey: "topicsToAvoid", label: "Topics to avoid", aliases: ["topics to avoid", "avoid topics"] },
  { fieldKey: "claimRestrictions", label: "Claim restrictions", aliases: ["claim restrictions", "compliance", "restricted claims"] },
];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function extractLinePairs(text: string): Array<{ key: string; value: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      const match = /^[-*]?\s*([^:\n]{2,80}):\s*(.+)$/.exec(line);
      if (!match) {
        return [];
      }
      const key = match[1]?.trim() ?? "";
      const value = match[2]?.trim() ?? "";
      if (isPlaceholder(key) || isPlaceholder(value)) {
        return [];
      }
      return [{ key, value }];
    });
}

function ruleForKey(key: string): FieldRule | undefined {
  const normalized = normalizeKey(key);
  return FIELD_RULES.find((rule) =>
    rule.aliases.some((alias) => normalizeKey(alias) === normalized),
  );
}

function confidenceForValue(value: string): "low" | "medium" | "high" {
  if (value.length >= 40 || /,|;|\|/.test(value)) {
    return "high";
  }
  if (value.length >= 12) {
    return "medium";
  }
  return "low";
}

function extractCandidates(document: ParsedDocument): CandidateField[] {
  return extractLinePairs(document.text).flatMap((pair) => {
    const rule = ruleForKey(pair.key);
    if (!rule) {
      return [];
    }
    return [
      {
        fieldKey: rule.fieldKey,
        label: rule.label,
        value: pair.value,
        evidence: {
          value: pair.value,
          source_url: document.sourceUrl,
          retrieved_at: document.retrievedAt,
        },
        sourceDocumentId: document.documentId,
      },
    ];
  });
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function mergeCandidate(candidate: CandidateField): ExtractedField {
  return {
    field_key: candidate.fieldKey,
    label: candidate.label,
    value: candidate.value,
    confidence: confidenceForValue(candidate.value),
    evidence: [candidate.evidence],
    source_document_ids: [candidate.sourceDocumentId],
  };
}

export function normalizeDocuments(documents: ParsedDocument[]): NormalizationResult {
  const fieldCatalog = documents.flatMap(extractCandidates).map(mergeCandidate);
  const byField = new Map<string, ExtractedField[]>();

  for (const field of fieldCatalog) {
    const existing = byField.get(field.field_key) ?? [];
    byField.set(field.field_key, [...existing, field]);
  }

  const conflicts: NormalizationResult["conflicts"] = [];
  const briefFragment: NormalizationResult["briefFragment"] = {};

  for (const [fieldKey, fields] of byField.entries()) {
    const uniqueValues = new Map<string, ExtractedField[]>();
    for (const field of fields) {
      const normalized = normalizeValue(field.value);
      uniqueValues.set(normalized, [...(uniqueValues.get(normalized) ?? []), field]);
    }

    if (uniqueValues.size > 1) {
      const values = [...uniqueValues.values()].map((group) => group[0]?.evidence[0]).filter(Boolean);
      conflicts.push({
        field_key: fieldKey,
        values,
        resolution_note: `Conflicting document values found for ${fieldKey}; keep field out of brief_fragment until review.`,
      });
      continue;
    }

    const firstField = fields[0];
    if (firstField) {
      briefFragment[fieldKey] = {
        value: firstField.value,
        confidence: firstField.confidence,
        evidence: fields.flatMap((field) => field.evidence),
        source_document_ids: [...new Set(fields.flatMap((field) => field.source_document_ids))],
      };
    }
  }

  const seenFieldKeys = new Set(fieldCatalog.map((field) => field.field_key));
  const unresolvedFields = FIELD_RULES.map((rule) => rule.fieldKey).filter(
    (fieldKey) => !seenFieldKeys.has(fieldKey),
  );

  return {
    briefFragment,
    fieldCatalog,
    conflicts,
    unresolvedFields,
  };
}
