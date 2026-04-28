/**
 * Builds the deterministic exclusion set for research-voc.
 * Sources: competitor_set, brief competitor/alternative fields, subject company, identity negative keywords.
 */
import * as fs from "fs";
import { researchVocInputSchema, type GtmBriefField, type ResearchVocInput } from "../schemas/input.ts";
import {
  containsNormalizedTerm,
  normalizeForExclusion,
  type ExclusionTerm,
} from "../schemas/output.ts";

type ExclusionSource = ExclusionTerm["source"];

const LIST_SPLIT_PATTERN = /[,;\n]|(?:\s+vs\.?\s+)|(?:\s+\|\s+)/i;

function cleanListValue(value: string): string {
  return value
    .trim()
    .replace(/\s+appear as\b.*$/i, "")
    .replace(/^and\s+/i, "")
    .replace(/^.*\bsuch as\s+/i, "")
    .replace(/\.$/, "")
    .trim();
}

function splitFieldValue(field: GtmBriefField | undefined): string[] {
  if (!field) {
    return [];
  }

  return field.value
    .split(LIST_SPLIT_PATTERN)
    .map(cleanListValue)
    .filter((value) => value.length > 0);
}

function addTerm(
  terms: ExclusionTerm[],
  seen: Set<string>,
  term: string,
  source: ExclusionSource,
  reason: string,
): void {
  const trimmed = term.trim();
  const normalized = normalizeForExclusion(trimmed);

  if (normalized.length < 2 || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  terms.push({ term: trimmed, source, reason });
}

export function buildExclusions(input: ResearchVocInput): ExclusionTerm[] {
  const terms: ExclusionTerm[] = [];
  const seen = new Set<string>();
  const fields = input.gtm_brief.fields;

  addTerm(
    terms,
    seen,
    fields.companyName.value,
    "brief",
    "Subject company must not appear in category VoC evidence.",
  );

  addTerm(
    terms,
    seen,
    input.ingest_identity.canonical_company_name,
    "ingest-identity",
    "Canonical subject company must not appear in category VoC evidence.",
  );

  for (const keyword of input.ingest_identity.negative_keywords) {
    addTerm(
      terms,
      seen,
      keyword,
      "ingest-identity",
      "Identity negative keyword marks a product, brand, or irrelevant entity to exclude.",
    );
  }

  for (const field of [
    fields.topCompetitors,
    fields.knownCompetitors,
    fields.alternatives,
    fields.currentAlternative,
  ]) {
    for (const value of splitFieldValue(field)) {
      addTerm(
        terms,
        seen,
        value,
        "brief",
        "Locked brief competitor or alternative must not appear in category VoC evidence.",
      );
    }
  }

  for (const competitor of input.research_competitor?.competitor_set ?? []) {
    addTerm(
      terms,
      seen,
      competitor.name,
      "research-competitor",
      "Competitor set member must be excluded from category-only VoC mining.",
    );
  }

  return terms;
}

export function findExcludedTerm(value: string, terms: ExclusionTerm[]): ExclusionTerm | undefined {
  return terms.find((entry) => containsNormalizedTerm(value, entry.term));
}

function readInput(path: string): ResearchVocInput {
  const raw = JSON.parse(fs.readFileSync(path, "utf-8")) as unknown;
  const parsed = researchVocInputSchema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.map(String).join(":")} - ${issue.message}`)
      .join("\n");
    throw new Error(`Input schema validation failed before exclusions:\n${issues}`);
  }

  return parsed.data;
}

function main(): void {
  const inputPath = process.argv[2] ?? "./example/input.json";
  const input = readInput(inputPath);
  const exclusions = buildExclusions(input);
  process.stdout.write(`${JSON.stringify(exclusions, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("build-exclusions.ts")) {
  main();
}
