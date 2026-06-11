import type {
  FactLedger,
  FactLedgerFact,
  KeywordMetric,
  SynthesisSectionInput,
} from "./fact-ledger";

export type ContradictionSeverity = "info" | "warning" | "critical";

export type ContradictionKind =
  | "numeric"
  | "strategic"
  | "inherited-stripped-claim";

export interface Contradiction {
  id: string;
  kind: ContradictionKind;
  severity: ContradictionSeverity;
  sections: string[];
  description: string;
  resolution: string;
  resolved: boolean;
}

export interface UnsupportedClaimRegistryEntry {
  sectionId: string;
  claim: string;
  field?: string;
}

interface FindContradictionsParams {
  ledger: FactLedger;
  sections: readonly SynthesisSectionInput[];
  unsupportedClaimsRegistry?: readonly UnsupportedClaimRegistryEntry[];
}

interface StringLeaf {
  path: string;
  value: string;
}

interface StrippedClaim {
  sectionId: string;
  claim: string;
  field?: string;
}

const lowVolumeThreshold = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function collectStringLeaves({
  out,
  path,
  value,
}: {
  out: StringLeaf[];
  path: string;
  value: unknown;
}): void {
  if (typeof value === "string") {
    if (value.trim().length > 0) {
      out.push({ path, value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStringLeaves({ out, path: `${path}[${index}]`, value: item });
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    collectStringLeaves({
      out,
      path: path.length === 0 ? key : `${path}.${key}`,
      value: child,
    });
  }
}

function sectionLeaves(section: SynthesisSectionInput): StringLeaf[] {
  const leaves: StringLeaf[] = [];

  collectStringLeaves({ out: leaves, path: "body", value: section.body });

  if (section.verdict !== undefined) {
    leaves.push({ path: "verdict", value: section.verdict });
  }

  if (section.statusSummary !== undefined) {
    leaves.push({ path: "statusSummary", value: section.statusSummary });
  }

  return leaves;
}

function criticalNumericFact(fact: FactLedgerFact): boolean {
  return (
    fact.domain === "keyword-cluster" ||
    fact.factKey === "acv" ||
    fact.factKey === "cac-target" ||
    fact.factKey === "monthly-budget"
  );
}

function numericContradiction(fact: FactLedgerFact): Contradiction {
  const sections = [...new Set(fact.readings.map((reading) => reading.sectionId))];
  const values = fact.readings
    .map((reading) => `${reading.sectionId}: ${reading.value}`)
    .join("; ");

  return {
    description: `${fact.label} has disagreeing readings: ${values}.`,
    id: `numeric:${fact.factKey}`,
    kind: "numeric",
    resolution:
      fact.winner === undefined
        ? "No winning reading could be selected; verify the source sections before using this figure."
        : `Use ${fact.winner.value} from ${fact.winner.sectionId} (${fact.winnerBasis}).`,
    resolved: fact.winner !== undefined,
    sections,
    severity: criticalNumericFact(fact) ? "critical" : "warning",
  };
}

function keywordReferenced(text: string, metric: KeywordMetric): boolean {
  const normalizedText = text.toLowerCase().replace(/[-–]/g, " ");
  const keyword = metric.keyword.toLowerCase().replace(/[-–]/g, " ");

  if (normalizedText.includes(keyword)) {
    return true;
  }

  if (/\blow code\b/.test(keyword) && /\b(?:low|no) code\b/.test(normalizedText)) {
    return true;
  }

  return false;
}

function strategicContradictions({
  keywordMetrics,
  sections,
}: {
  keywordMetrics: readonly KeywordMetric[];
  sections: readonly SynthesisSectionInput[];
}): Contradiction[] {
  const lowVolumeKeywords = keywordMetrics.filter(
    (metric) => metric.monthlyVolume < lowVolumeThreshold,
  );
  const contradictions: Contradiction[] = [];

  for (const section of sections) {
    for (const leaf of sectionLeaves(section)) {
      if (!/\b(?:higher volume|high-volume|broad(?:er)? category|carry higher volume)\b/i.test(leaf.value)) {
        continue;
      }

      const matched = lowVolumeKeywords.filter((metric) =>
        keywordReferenced(leaf.value, metric),
      );

      if (matched.length === 0) {
        continue;
      }

      contradictions.push({
        description: `${section.sectionId} recommends higher-volume keyword themes while referencing measured low-volume keyword(s): ${matched.map((metric) => `${metric.keyword} ${metric.monthlyVolume}/mo`).join(", ")}.`,
        id: `strategic:${section.sectionId}:${leaf.path}`,
        kind: "strategic",
        resolution:
          "Use demand-intent measured volume for these themes and describe them as low-volume unless a new measured table proves otherwise.",
        resolved: false,
        sections: [section.sectionId, "positioningDemandIntent"],
        severity: "critical",
      });
    }
  }

  return contradictions;
}

function claimTextFromRecord(record: Record<string, unknown>): string[] {
  const directKeys = ["removedText", "value", "claim", "raw"];
  const direct = directKeys.flatMap((key) => {
    const value = record[key];

    return typeof value === "string" && value.trim().length > 0
      ? [value.trim()]
      : [];
  });
  const values = Array.isArray(record.values)
    ? record.values.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  return [...direct, ...values];
}

function strippedClaimsFromValue({
  field,
  sectionId,
  value,
}: {
  field: string;
  sectionId: string;
  value: unknown;
}): StrippedClaim[] {
  if (typeof value === "string") {
    return value.trim().length > 0
      ? [{ claim: value.trim(), field, sectionId }]
      : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      strippedClaimsFromValue({
        field: `${field}[${index}]`,
        sectionId,
        value: item,
      }),
    );
  }

  if (!isRecord(value)) {
    return [];
  }

  return claimTextFromRecord(value).map((claim) => ({
    claim,
    field,
    sectionId,
  }));
}

function strippedClaimsFromSection(section: SynthesisSectionInput): StrippedClaim[] {
  const reviewRemoved = Array.isArray(section.review?.removedItems)
    ? section.review.removedItems.flatMap((item, index) =>
        typeof item === "string"
          ? [
              {
                claim: item,
                field: `review.removedItems[${index}]`,
                sectionId: section.sectionId,
              },
            ]
          : [],
      )
    : [];
  const verifierClaims = section.verifierSummary === undefined
    ? []
    : Object.entries(section.verifierSummary)
        .filter(([key]) => /stripped|removed|downgraded/i.test(key))
        .flatMap(([key, value]) =>
          strippedClaimsFromValue({
            field: `verifierSummary.${key}`,
            sectionId: section.sectionId,
            value,
          }),
        );

  return [...reviewRemoved, ...verifierClaims].filter(
    (claim) => normalizeWhitespace(claim.claim).length >= 4,
  );
}

function claimNeedle(claim: string): string | undefined {
  const quoted = /['"`]([^'"`]{4,})['"`]/.exec(claim);

  if (quoted !== null) {
    return quoted[1].toLowerCase();
  }

  const moneyOrPercent = claim.match(
    /\$?\d[\d,]*(?:\.\d+)?(?:\s?[KMBkmb]\b)?(?:\s*[-–]\s*\$?\d[\d,]*(?:\.\d+)?(?:\s?[KMBkmb]\b)?)?(?:%|\/(?:click|lead|trial|mo|month))?/,
  );

  if (moneyOrPercent !== null) {
    return moneyOrPercent[0].toLowerCase();
  }

  const normalized = normalizeWhitespace(claim).toLowerCase();

  return normalized.length >= 24 ? normalized.slice(0, 120) : undefined;
}

function sectionContainsClaim(
  section: SynthesisSectionInput,
  claim: StrippedClaim,
): boolean {
  const needle = claimNeedle(claim.claim);

  if (needle === undefined) {
    return false;
  }

  return sectionLeaves(section).some((leaf) =>
    leaf.value.toLowerCase().includes(needle),
  );
}

function inheritedStrippedClaimContradictions({
  sections,
  unsupportedClaimsRegistry,
}: {
  sections: readonly SynthesisSectionInput[];
  unsupportedClaimsRegistry?: readonly UnsupportedClaimRegistryEntry[];
}): Contradiction[] {
  const registryClaims = (unsupportedClaimsRegistry ?? []).map((entry) => ({
    claim: entry.claim,
    field: entry.field,
    sectionId: entry.sectionId,
  }));
  const strippedClaims = [
    ...registryClaims,
    ...sections.flatMap(strippedClaimsFromSection),
  ];
  const contradictions: Contradiction[] = [];

  for (const claim of strippedClaims) {
    for (const section of sections) {
      if (section.sectionId === claim.sectionId) {
        continue;
      }

      if (!sectionContainsClaim(section, claim)) {
        continue;
      }

      contradictions.push({
        description: `${section.sectionId} still relies on a claim stripped from ${claim.sectionId}: ${normalizeWhitespace(claim.claim)}`,
        id: `inherited:${claim.sectionId}:${section.sectionId}:${claim.field ?? "registry"}`,
        kind: "inherited-stripped-claim",
        resolution:
          "Remove or relabel the inherited statement unless the target section has its own surviving source-backed evidence.",
        resolved: false,
        sections: [claim.sectionId, section.sectionId],
        severity: "critical",
      });
    }
  }

  return contradictions;
}

function dedupeContradictions(
  contradictions: readonly Contradiction[],
): Contradiction[] {
  const byId = new Map<string, Contradiction>();

  for (const contradiction of contradictions) {
    if (!byId.has(contradiction.id)) {
      byId.set(contradiction.id, contradiction);
    }
  }

  return [...byId.values()];
}

export function findContradictions({
  ledger,
  sections,
  unsupportedClaimsRegistry,
}: FindContradictionsParams): Contradiction[] {
  return dedupeContradictions([
    ...ledger.facts.filter((fact) => fact.disputed).map(numericContradiction),
    ...strategicContradictions({
      keywordMetrics: ledger.keywordMetrics,
      sections,
    }),
    ...inheritedStrippedClaimContradictions({
      sections,
      unsupportedClaimsRegistry,
    }),
  ]);
}

export function hasUnresolvedCriticalContradiction(
  contradictions: readonly Contradiction[],
): boolean {
  return contradictions.some(
    (contradiction) =>
      contradiction.severity === "critical" && !contradiction.resolved,
  );
}
