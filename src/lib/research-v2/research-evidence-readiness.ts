import {
  POSITIONING_SECTION_IDS,
  isPositioningSectionId,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  isHttpUrl,
  isLikelyNamedBuyerIdentity,
} from '@/lib/lab-engine/artifacts/schemas/buyer-icp';
import {
  readVerificationFlag,
  readVerificationTier,
} from '@/lib/research-v2/verification-tier';

export interface ResearchEvidenceReadinessRow {
  zone: string | null;
  data: unknown;
  markdown?: unknown;
  verification_tier?: unknown;
  verification_flag?: unknown;
}

export interface ResearchEvidenceBlockedSection {
  zone: PositioningSectionId;
  reasons: string[];
}

export interface ResearchEvidenceReadinessResult {
  ready: boolean;
  blockedSections: ResearchEvidenceBlockedSection[];
  reasons: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function artifactBody(data: unknown): Record<string, unknown> {
  return isRecord(data) && isRecord(data.body) ? data.body : {};
}

function quoteRecords(
  body: Record<string, unknown>,
  key: 'painLanguage' | 'successLanguage',
): Record<string, unknown>[] {
  const group = isRecord(body[key]) ? body[key] : {};
  return recordArray(group.quotes);
}

function realBuyerQuoteCount(body: Record<string, unknown>): number {
  return [
    ...quoteRecords(body, 'painLanguage'),
    ...quoteRecords(body, 'successLanguage'),
  ].filter((quote) => readString(quote.verbatimText) !== null).length;
}

// Shared with the run-lab-section starved-VoC auto-rescue so the "real buyer
// quote" rule and the persisted artifact envelope shape (`data.body`) stay
// single-sourced. Takes the raw `research_artifact_sections.data` column value.
export function realBuyerQuoteCountFromArtifactData(data: unknown): number {
  return realBuyerQuoteCount(artifactBody(data));
}

// A core section that committed `complete` only by degrading to the R1 deadline
// honest-gap body carries the "exceeded its time budget" marker across its
// leaves (the commit-boundary sanitizer rewrites "evidence gap:" but preserves
// this phrase). Detecting it lets the ADR-0012 auto-rerun give the section one
// solo retry — no fan-out contention, ~2-3 min — instead of shipping the
// 38-leaf "rerun to retry" placeholder wall a buyer paid for (offer-diagnostic).
export function committedAsDeadlineExhaustedFromArtifactData(
  data: unknown,
): boolean {
  const body = artifactBody(data);

  if (Object.keys(body).length === 0) {
    return false;
  }

  return /exceeded its time budget/i.test(JSON.stringify(body));
}

function namedBuyerIdentityCount(body: Record<string, unknown>): number {
  const personaReality = isRecord(body.personaReality)
    ? body.personaReality
    : {};

  return recordArray(personaReality.personas).filter((persona) => {
    const name = readString(persona.name);
    const sourceUrl = readString(persona.sourceUrl);

    if (name === null || sourceUrl === null || !isHttpUrl(sourceUrl)) {
      return false;
    }

    return isLikelyNamedBuyerIdentity(name, {
      company: readString(persona.company) ?? undefined,
      role: readString(persona.role) ?? undefined,
      seniority: readString(persona.seniority) ?? undefined,
      title: readString(persona.title) ?? undefined,
    });
  }).length;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function readinessReasonsForRow(
  zone: PositioningSectionId,
  row: ResearchEvidenceReadinessRow,
): string[] {
  const body = artifactBody(row.data);
  const verificationFlag = readVerificationFlag(row.verification_flag);
  const verificationTier =
    readVerificationTier(row.verification_tier) ?? verificationFlag?.tier ?? null;
  const reasons: string[] = [];

  if (verificationTier === 'insufficient') {
    reasons.push(`${zone} verification_tier is insufficient`);
  }

  if (verificationFlag?.evidenceGap === true) {
    reasons.push(`${zone} verification_flag.evidenceGap=true`);
  }

  if (body.evidenceGap === true) {
    reasons.push(`${zone} body.evidenceGap=true`);
  }

  if (zone === 'positioningVoiceOfCustomer') {
    const quoteCount = realBuyerQuoteCount(body);
    if (quoteCount === 0) {
      reasons.push('positioningVoiceOfCustomer has zero real buyer quotes');
    }
  }

  if (zone === 'positioningBuyerICP') {
    const identityCount = namedBuyerIdentityCount(body);
    if (identityCount < 2) {
      reasons.push(
        `positioningBuyerICP named buyer identities=${identityCount}; need >=2`,
      );
    }
  }

  return uniqueStrings(reasons);
}

export function evaluateResearchEvidenceReadiness(
  rows: readonly ResearchEvidenceReadinessRow[],
): ResearchEvidenceReadinessResult {
  const rowsByZone = new Map<PositioningSectionId, ResearchEvidenceReadinessRow>();

  for (const row of rows) {
    if (isPositioningSectionId(row.zone)) {
      rowsByZone.set(row.zone, row);
    }
  }

  const blockedSections = POSITIONING_SECTION_IDS.flatMap((zone) => {
    const row = rowsByZone.get(zone);

    if (row === undefined) {
      return [
        {
          zone,
          reasons: [`${zone} committed artifact row is missing`],
        },
      ];
    }

    const reasons = readinessReasonsForRow(zone, row);
    return reasons.length === 0 ? [] : [{ zone, reasons }];
  });
  const reasons = blockedSections.flatMap((section) => section.reasons);

  return {
    ready: blockedSections.length === 0,
    blockedSections,
    reasons,
  };
}
