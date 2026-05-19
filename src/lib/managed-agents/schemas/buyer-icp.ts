import { z } from 'zod';

import {
  SourceSchema,
  VALID_URL_PATTERN,
  type ValidationResult,
  findDuplicates,
  hasText,
  pushMissingText,
} from './_shared';

/**
 * Next.js-side mirror of the worker BuyerICPArtifactSchema. Source of truth
 * lives in research-worker/src/agents/subagents/schemas/buyer-icp.ts.
 */

const PERSONA_ROLES = [
  'champion',
  'economic-buyer',
  'decision-maker',
  'influencer',
  'end-user',
  'gatekeeper',
] as const;

const CUT_TYPES = [
  'industry',
  'employeeBands',
  'revenueBands',
  'geography',
  'techStack',
] as const;

const AWARENESS_LEVELS = [
  'unaware',
  'problem-aware',
  'solution-aware',
  'product-aware',
  'most-aware',
] as const;

const TRIGGER_WINDOWS = ['immediate', 'weeks', 'quarters'] as const;

const CLUSTER_BUCKETS = [
  'community',
  'newsletter',
  'conference',
  'podcast',
  'slack-group',
  'event',
] as const;

export const FirmographicCutSchema = z.object({
  cutType: z.enum(CUT_TYPES),
  value: z.string(),
  accountCount: z.string().optional(),
  source: z.string(),
  sourceUrl: z.string(),
  dateObserved: z.string(),
});

export const PersonaSchema = z.object({
  name: z.string(),
  title: z.string(),
  company: z.string(),
  sourceUrl: z.string(),
  role: z.enum(PERSONA_ROLES),
  seniority: z.string(),
  teamSize: z.string().optional(),
  evidence: z.string(),
});

export const AwarenessLevelSchema = z.object({
  level: z.enum(AWARENESS_LEVELS),
  share: z.string(),
  evidence: z.string(),
  sampleQuery: z.string().optional(),
});

export const TriggerSchema = z.object({
  name: z.string(),
  detectionSignal: z.string(),
  window: z.enum(TRIGGER_WINDOWS),
  evidence: z.string(),
  sourceUrl: z.string().optional(),
});

export const ClusterVenueSchema = z.object({
  bucketType: z.enum(CLUSTER_BUCKETS),
  name: z.string(),
  audienceSize: z.string(),
  sourceUrl: z.string(),
  whyItMatters: z.string(),
});

export const IcpExistenceCheckSchema = z.object({
  prose: z.string(),
  firmographicCuts: FirmographicCutSchema.array(),
});

export const PersonaRealitySchema = z.object({
  prose: z.string(),
  personas: PersonaSchema.array(),
});

export const AwarenessDistributionSchema = z.object({
  prose: z.string(),
  levels: AwarenessLevelSchema.array(),
});

export const BuyingContextSchema = z.object({
  prose: z.string(),
  triggers: TriggerSchema.array(),
});

export const ClustersSchema = z.object({
  prose: z.string(),
  venues: ClusterVenueSchema.array(),
});

export const BuyerICPArtifactSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: SourceSchema.array(),
    icpExistenceCheck: IcpExistenceCheckSchema,
    personaReality: PersonaRealitySchema,
    awarenessDistribution: AwarenessDistributionSchema,
    buyingContext: BuyingContextSchema,
    clusters: ClustersSchema,
  })
  .describe('Complete Section 02 Buyer & ICP Validation Artifact.');

export type BuyerICPArtifact = z.infer<typeof BuyerICPArtifactSchema>;

function validateRequiredFields(
  artifact: BuyerICPArtifact,
  errors: string[],
): void {
  pushMissingText(errors, 'sectionTitle', artifact.sectionTitle);
  pushMissingText(errors, 'verdict', artifact.verdict);
  pushMissingText(errors, 'statusSummary', artifact.statusSummary);
  if (typeof artifact.confidence !== 'number' || Number.isNaN(artifact.confidence)) {
    errors.push('confidence: required numeric field missing.');
  }

  pushMissingText(errors, 'icpExistenceCheck.prose', artifact.icpExistenceCheck.prose);
  pushMissingText(errors, 'personaReality.prose', artifact.personaReality.prose);
  pushMissingText(errors, 'awarenessDistribution.prose', artifact.awarenessDistribution.prose);
  pushMissingText(errors, 'buyingContext.prose', artifact.buyingContext.prose);
  pushMissingText(errors, 'clusters.prose', artifact.clusters.prose);

  artifact.icpExistenceCheck.firmographicCuts.forEach((cut, index) => {
    pushMissingText(errors, `firmographicCuts[${index}].value`, cut.value);
    pushMissingText(errors, `firmographicCuts[${index}].source`, cut.source);
    pushMissingText(errors, `firmographicCuts[${index}].sourceUrl`, cut.sourceUrl);
    pushMissingText(errors, `firmographicCuts[${index}].dateObserved`, cut.dateObserved);
  });

  artifact.personaReality.personas.forEach((persona, index) => {
    pushMissingText(errors, `personas[${index}].name`, persona.name);
    pushMissingText(errors, `personas[${index}].title`, persona.title);
    pushMissingText(errors, `personas[${index}].company`, persona.company);
    pushMissingText(errors, `personas[${index}].sourceUrl`, persona.sourceUrl);
    pushMissingText(errors, `personas[${index}].seniority`, persona.seniority);
    pushMissingText(errors, `personas[${index}].evidence`, persona.evidence);
  });

  artifact.awarenessDistribution.levels.forEach((level, index) => {
    pushMissingText(errors, `awarenessDistribution.levels[${index}].share`, level.share);
    pushMissingText(
      errors,
      `awarenessDistribution.levels[${index}].evidence`,
      level.evidence,
    );
  });

  artifact.buyingContext.triggers.forEach((trigger, index) => {
    pushMissingText(errors, `triggers[${index}].name`, trigger.name);
    pushMissingText(errors, `triggers[${index}].detectionSignal`, trigger.detectionSignal);
    pushMissingText(errors, `triggers[${index}].evidence`, trigger.evidence);
  });

  artifact.clusters.venues.forEach((venue, index) => {
    pushMissingText(errors, `clusters.venues[${index}].name`, venue.name);
    pushMissingText(errors, `clusters.venues[${index}].audienceSize`, venue.audienceSize);
    pushMissingText(errors, `clusters.venues[${index}].sourceUrl`, venue.sourceUrl);
    pushMissingText(errors, `clusters.venues[${index}].whyItMatters`, venue.whyItMatters);
  });
}

export function validateBuyerICPMinimums(
  artifact: BuyerICPArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  if (artifact.confidence < 0 || artifact.confidence > 10) {
    errors.push(`confidence: expected 0-10, got ${artifact.confidence}.`);
  }

  if (artifact.personaReality.personas.length < 5) {
    errors.push(
      `personas: have ${artifact.personaReality.personas.length}, need >=5 named real persons at named real ICP companies.`,
    );
  }

  if (artifact.icpExistenceCheck.firmographicCuts.length < 3) {
    errors.push(
      `firmographicCuts: have ${artifact.icpExistenceCheck.firmographicCuts.length}, need >=3 typed cuts across distinct cutType values.`,
    );
  }

  const cutTypes = artifact.icpExistenceCheck.firmographicCuts.map((c) => c.cutType);
  for (const duplicate of findDuplicates(cutTypes)) {
    errors.push(`firmographicCuts: duplicate cutType ${duplicate} — one per dimension.`);
  }

  const observedLevels = artifact.awarenessDistribution.levels.map((l) => l.level);
  const missingLevels = AWARENESS_LEVELS.filter((l) => !observedLevels.includes(l));
  if (missingLevels.length > 0) {
    errors.push(
      `awarenessDistribution: missing Schwartz levels ${missingLevels.join(', ')}.`,
    );
  }
  for (const duplicate of findDuplicates(observedLevels)) {
    errors.push(`awarenessDistribution: duplicate Schwartz level ${duplicate}.`);
  }

  if (artifact.buyingContext.triggers.length < 3) {
    errors.push(
      `triggers: have ${artifact.buyingContext.triggers.length}, need >=3 publicly detectable triggers.`,
    );
  }

  const communityCount = artifact.clusters.venues.filter(
    (v) => v.bucketType === 'community',
  ).length;
  if (communityCount < 2) {
    errors.push(`clusters: have ${communityCount} community venues, need >=2.`);
  }

  const newsletterCount = artifact.clusters.venues.filter(
    (v) => v.bucketType === 'newsletter',
  ).length;
  if (newsletterCount < 2) {
    errors.push(`clusters: have ${newsletterCount} newsletter venues, need >=2.`);
  }

  artifact.personaReality.personas.forEach((persona, index) => {
    if (hasText(persona.sourceUrl) && !VALID_URL_PATTERN.test(persona.sourceUrl)) {
      errors.push(`personas[${index}] (${persona.name}): sourceUrl is not a valid URL.`);
    }
  });

  return { ok: errors.length === 0, errors };
}
