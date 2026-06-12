import type {
  FactDomain,
  FactLedger,
  FactLedgerFact,
  FactLedgerReading,
  FactReadingBasis,
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
  occurrenceCount?: number;
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
const factOwnerByDomain: Record<FactDomain, string> = {
  "competitor-price": "positioningCompetitorLandscape",
  "customer-count": "positioningOfferDiagnostic",
  "keyword-cluster": "positioningDemandIntent",
  "operator-economics": "positioningPaidMediaPlan",
  "sales-cycle": "positioningOfferDiagnostic",
  "subject-price": "positioningOfferDiagnostic",
};
const numericBasisRank: Record<FactReadingBasis, number> = {
  "measured-tool-data": 50,
  "subject-own-page-sourced": 40,
  "corroborated-secondary": 40,
  benchmark: 10,
  "model-stated": 5,
  absent: 0,
};

type FactReadingUnitClass =
  | "bare-count"
  | "currency-absolute"
  | "currency-monthly"
  | "currency-rate"
  | "days"
  | "percentage"
  | "searches-per-month"
  | "unknown";

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

function isBriefSuppliedReading(reading: FactLedgerReading): boolean {
  return /\b(?:client brief|operator-supplied|user-supplied|user supplied|onboarding|gtm brief|brief)\b/i.test(
    reading.context,
  );
}

function isDerivedReading(reading: FactLedgerReading): boolean {
  return /\b(?:derived|calculated|computed|formula|modeled from|bridge|cascade|reconciled)\b/i.test(
    reading.context,
  );
}

function rankReading(reading: FactLedgerReading): number {
  if (isBriefSuppliedReading(reading)) {
    return 60;
  }

  if (isDerivedReading(reading)) {
    return 30;
  }

  return numericBasisRank[reading.basis];
}

function readingUnitClassForFact(
  fact: FactLedgerFact,
  reading: FactLedgerReading,
): FactReadingUnitClass {
  const value = reading.value.toLowerCase();
  const context = reading.context.toLowerCase();
  const combined = `${value} ${context}`;

  if (value.includes("%") || reading.unit === "percent") {
    return "percentage";
  }

  if (reading.unit === "searches-per-month") {
    return "searches-per-month";
  }

  if (reading.unit === "days") {
    return "days";
  }

  if (value.includes("$") || reading.unit === "money") {
    if (
      /\b(?:cac|cpl|cpc|cpm|cost per|per lead|per trial|per mql|per conversion|per click|\/\s*(?:lead|trial|mql|conversion|click))\b/i.test(
        combined,
      )
    ) {
      return "currency-rate";
    }

    if (
      fact.factKey === "monthly-budget" ||
      /\b(?:monthly|per month|\/\s*(?:mo|month)|media budget|ad budget|spend)\b/i.test(
        combined,
      )
    ) {
      return "currency-monthly";
    }

    return "currency-absolute";
  }

  if (reading.unit === "count" || /\b(?:customers|brands|organizations|companies)\b/i.test(context)) {
    return "bare-count";
  }

  return "unknown";
}

function expectedUnitClassForFact(
  fact: FactLedgerFact,
): FactReadingUnitClass | undefined {
  if (fact.domain === "customer-count") {
    return "bare-count";
  }

  if (fact.domain === "keyword-cluster") {
    return "searches-per-month";
  }

  if (fact.domain === "sales-cycle") {
    return "days";
  }

  if (fact.factKey === "monthly-budget") {
    return "currency-monthly";
  }

  if (fact.factKey === "cac-target") {
    return "currency-rate";
  }

  if (fact.factKey === "acv" || fact.factKey === "ARR") {
    return "currency-absolute";
  }

  if (fact.domain === "subject-price" || fact.domain === "competitor-price") {
    return "currency-absolute";
  }

  return undefined;
}

function readingParticipatesInFact(
  fact: FactLedgerFact,
  reading: FactLedgerReading,
): boolean {
  const expected = expectedUnitClassForFact(fact);

  if (expected === undefined) {
    return true;
  }

  return readingUnitClassForFact(fact, reading) === expected;
}

function factIsDisputed(readings: readonly FactLedgerReading[]): boolean {
  const values = readings
    .map((reading) => reading.normalizedValue)
    .filter((value): value is number => value !== undefined && value > 0);

  if (values.length < 2) {
    return false;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  return (max - min) / Math.max(min, 1) > 0.2;
}

function deterministicWinnerForFact(
  fact: FactLedgerFact,
  readings: readonly FactLedgerReading[],
): FactLedgerReading | undefined {
  const owner = factOwnerByDomain[fact.domain];

  return [...readings].sort((left, right) => {
    const rankDelta = rankReading(right) - rankReading(left);

    if (rankDelta !== 0) {
      return rankDelta;
    }

    if (left.sectionId === owner && right.sectionId !== owner) {
      return -1;
    }

    if (right.sectionId === owner && left.sectionId !== owner) {
      return 1;
    }

    return `${left.sectionId}:${left.value}`.localeCompare(
      `${right.sectionId}:${right.value}`,
    );
  })[0];
}

function basisLabel(reading: FactLedgerReading): string {
  if (isBriefSuppliedReading(reading)) {
    return "brief-supplied";
  }

  if (isDerivedReading(reading)) {
    return "derived";
  }

  return reading.basis;
}

function reconcileFactForMemo(fact: FactLedgerFact): FactLedgerFact | null {
  const readings = fact.readings.filter((reading) =>
    readingParticipatesInFact(fact, reading),
  );

  if (readings.length === 0) {
    return null;
  }

  const winner = deterministicWinnerForFact(fact, readings);

  return {
    ...fact,
    disputed: factIsDisputed(readings),
    readings,
    ...(winner === undefined ? {} : { winner }),
    winnerBasis:
      winner === undefined
        ? "no comparable readings available"
        : `${basisLabel(winner)}; selected from ${winner.sectionId}`,
  };
}

export function reconcileFactLedgerForMemo(ledger: FactLedger): FactLedger {
  return {
    ...ledger,
    facts: ledger.facts.flatMap((fact) => {
      const reconciled = reconcileFactForMemo(fact);

      return reconciled === null ? [] : [reconciled];
    }),
  };
}

function numericContradiction(fact: FactLedgerFact): Contradiction | null {
  const reconciled = reconcileFactForMemo(fact);

  if (reconciled === null || !reconciled.disputed) {
    return null;
  }

  const sections = [
    ...new Set(reconciled.readings.map((reading) => reading.sectionId)),
  ];
  const values = reconciled.readings
    .map((reading) => `${reading.sectionId}: ${reading.value}`)
    .join("; ");
  const winner = reconciled.winner;

  return {
    description: `${fact.label} has disagreeing readings: ${values}.`,
    id: `numeric:${fact.factKey}`,
    kind: "numeric",
    resolution:
      winner === undefined
        ? "We flagged the figure because no comparable reading can safely lead the memo."
        : `We use ${winner.value} from ${winner.sectionId} (${reconciled.winnerBasis}).`,
    resolved: winner !== undefined,
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
          "We used measured demand-intent volume for those themes and treated broader-volume language as a caveat.",
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

// review.removedItems is deliberately NOT ingested here: those entries are
// model-asserted removal claims (often phantom — referencing text that never
// existed in the body), not deterministic verifier strips. Only the
// verifierSummary strip records feed the contradiction scan.
function strippedClaimsFromSection(section: SynthesisSectionInput): StrippedClaim[] {
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

  return verifierClaims.filter(
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
          "We set aside an unverified claim that repeated across sections without surviving source-backed evidence.",
        resolved: false,
        sections: [claim.sectionId, section.sectionId],
        severity: "critical",
      });
    }
  }

  return contradictions;
}

function severityRank(severity: ContradictionSeverity): number {
  if (severity === "critical") {
    return 3;
  }

  if (severity === "warning") {
    return 2;
  }

  return 1;
}

function maxSeverity(
  left: ContradictionSeverity,
  right: ContradictionSeverity,
): ContradictionSeverity {
  return severityRank(left) >= severityRank(right) ? left : right;
}

function contradictionClaimText(contradiction: Contradiction): string | undefined {
  if (contradiction.kind !== "inherited-stripped-claim") {
    return undefined;
  }

  const separatorIndex = contradiction.description.indexOf(": ");

  return separatorIndex === -1
    ? undefined
    : normalizeWhitespace(contradiction.description.slice(separatorIndex + 2));
}

function normalizeContradictionKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[$,\s]+/g, " ")
    .replace(/[–—]/g, "-")
    .trim();
}

function dedupeKeys(contradiction: Contradiction): string[] {
  const keys = [
    `${contradiction.kind}:description:${normalizeContradictionKey(contradiction.description)}`,
  ];
  const claim = contradictionClaimText(contradiction);

  if (claim !== undefined) {
    keys.push(
      [
        contradiction.kind,
        "sections-claim",
        [...contradiction.sections].sort().join("|"),
        normalizeContradictionKey(claim),
      ].join(":"),
    );
  }

  return keys;
}

function mergeContradictions(
  left: Contradiction,
  right: Contradiction,
): Contradiction {
  return {
    ...left,
    occurrenceCount: (left.occurrenceCount ?? 1) + (right.occurrenceCount ?? 1),
    resolved: left.resolved && right.resolved,
    sections: [...new Set([...left.sections, ...right.sections])],
    severity: maxSeverity(left.severity, right.severity),
  };
}

function dedupeContradictions(
  contradictions: readonly Contradiction[],
): Contradiction[] {
  const deduped: Contradiction[] = [];
  const indexByKey = new Map<string, number>();

  for (const contradiction of contradictions) {
    const keys = [contradiction.id, ...dedupeKeys(contradiction)];
    const existingIndex = keys
      .map((key) => indexByKey.get(key))
      .find((index): index is number => index !== undefined);

    if (existingIndex === undefined) {
      const nextIndex = deduped.length;

      deduped.push(contradiction);
      keys.forEach((key) => indexByKey.set(key, nextIndex));
      continue;
    }

    deduped[existingIndex] = mergeContradictions(
      deduped[existingIndex],
      contradiction,
    );
    keys.forEach((key) => indexByKey.set(key, existingIndex));
  }

  return deduped;
}

export function findContradictions({
  ledger,
  sections,
  unsupportedClaimsRegistry,
}: FindContradictionsParams): Contradiction[] {
  return dedupeContradictions([
    ...ledger.facts.flatMap((fact) => {
      if (!fact.disputed) {
        return [];
      }

      const contradiction = numericContradiction(fact);

      return contradiction === null ? [] : [contradiction];
    }),
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
