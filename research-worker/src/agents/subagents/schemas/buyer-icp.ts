import { z } from 'zod';

/**
 * Bespoke Section 02 Artifact schema for ADR-0002.
 *
 * BuyerICP no longer emits the legacy positioning envelope and no longer uses
 * a Python validator inside the agent loop. The Subagent gathers evidence with
 * research tools; the runner then calls streamObject(BuyerICPArtifactSchema)
 * after evidence gathering. Cardinality minimums live in
 * validateBuyerICPMinimums because provider structured-output schemas reject
 * Zod cardinality constraints.
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

const VALID_URL_PATTERN = /^https?:\/\/\S+\.\S+/;

export const SourceSchema = z
  .object({
    title: z.string().describe('Human-readable source title.'),
    url: z.string().describe('Canonical public URL for the source.'),
    whyItMatters: z
      .string()
      .optional()
      .describe('Why this source supports the BuyerICP judgment.'),
  })
  .describe('Public source used to support the Section 02 Artifact.');

export const FirmographicCutSchema = z
  .object({
    cutType: z
      .enum(CUT_TYPES)
      .describe('Dimension used to prove reachable account existence.'),
    value: z
      .string()
      .describe('Specific cut being counted, e.g. Series B-D SaaS, 200-1000 employees.'),
    accountCount: z
      .string()
      .optional()
      .describe('Public or sourced account-count estimate as free text.'),
    source: z
      .string()
      .describe('Named public source for this firmographic cut.'),
    sourceUrl: z
      .string()
      .describe('Public URL supporting this firmographic cut.'),
    dateObserved: z
      .string()
      .describe('YYYY-MM-DD date when the agent observed this cut.'),
  })
  .describe('Typed account-count cut proving the ICP exists in the wild.');

export const PersonaSchema = z
  .object({
    name: z.string().describe('Real named person inside the ICP.'),
    title: z.string().describe('Public title for the named person.'),
    company: z.string().describe('Real named company where the person works.'),
    sourceUrl: z.string().describe('Public URL proving the person and role.'),
    role: z
      .enum(PERSONA_ROLES)
      .describe('B2B buyer-circle role this person represents.'),
    seniority: z
      .string()
      .describe('Seniority band or org level, e.g. VP+, Director, Manager.'),
    teamSize: z
      .string()
      .optional()
      .describe('Observed team size or span of control when public.'),
    evidence: z
      .string()
      .describe('Concrete evidence tying this person to the ICP and buying motion.'),
  })
  .describe('Named real person at a named ICP company.');

export const AwarenessLevelSchema = z
  .object({
    level: z
      .enum(AWARENESS_LEVELS)
      .describe('Schwartz awareness level represented by this evidence.'),
    share: z
      .string()
      .describe('Directional share estimate as free text, e.g. ~40%.'),
    evidence: z
      .string()
      .describe('Evidence for this awareness level from search, reviews, or community language.'),
    sampleQuery: z
      .string()
      .optional()
      .describe('Representative query or phrase buyers use at this awareness level.'),
  })
  .describe('One Schwartz awareness-level card for the ICP.');

export const TriggerSchema = z
  .object({
    name: z.string().describe('Named buying trigger.'),
    detectionSignal: z
      .string()
      .describe('Public signal an operator can monitor to detect this trigger.'),
    window: z
      .enum(TRIGGER_WINDOWS)
      .describe('Likely trigger-to-action window.'),
    evidence: z
      .string()
      .describe('Public evidence that this trigger moves the ICP.'),
    sourceUrl: z
      .string()
      .optional()
      .describe('Public URL supporting the trigger when available.'),
  })
  .describe('Publicly detectable buying-context trigger.');

export const ClusterVenueSchema = z
  .object({
    bucketType: z
      .enum(CLUSTER_BUCKETS)
      .describe('Venue type where the ICP clusters.'),
    name: z.string().describe('Named venue, community, publication, or event.'),
    audienceSize: z
      .string()
      .describe('Public audience size as free text; say not disclosed when unknown.'),
    sourceUrl: z
      .string()
      .describe('Public URL for the venue or audience-size evidence.'),
    whyItMatters: z
      .string()
      .describe('Why this venue is useful for reaching or understanding the ICP.'),
  })
  .describe('Venue where ICP buyers actually cluster.');

export const IcpExistenceCheckSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative judgment on whether the ICP exists by firmographic cuts.'),
    firmographicCuts: FirmographicCutSchema.array().describe(
      'Typed firmographic cuts proving reachable account existence.',
    ),
  })
  .describe('Sub-section for ICP existence by firmographic count evidence.');

export const PersonaRealitySchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative judgment on named buyers, org position, and role reality.'),
    personas: PersonaSchema.array().describe(
      'Named real personas at named ICP companies.',
    ),
  })
  .describe('Sub-section for named real personas in the ICP.');

export const AwarenessDistributionSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative judgment on awareness distribution across the ICP.'),
    levels: AwarenessLevelSchema.array().describe(
      'Exactly one card for each Schwartz awareness level.',
    ),
  })
  .describe('Sub-section for Schwartz awareness-level distribution.');

export const BuyingContextSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative judgment on publicly detectable buying triggers.'),
    triggers: TriggerSchema.array().describe(
      'Publicly detectable triggers that move passive accounts into active demand.',
    ),
  })
  .describe('Sub-section for buying context and observable triggers.');

export const ClustersSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative judgment on where ICP buyers actually cluster.'),
    venues: ClusterVenueSchema.array().describe(
      'Communities, newsletters, events, podcasts, and Slack groups where buyers cluster.',
    ),
  })
  .describe('Sub-section for venues where ICP buyers cluster.');

export const BuyerICPArtifactSchema = z
  .object({
    sectionTitle: z
      .string()
      .describe('Section title, normally Buyer & ICP Validation.'),
    verdict: z
      .string()
      .describe('One-line judgment for Section 02, e.g. ICP exists and is reachable.'),
    statusSummary: z
      .string()
      .describe('Two to four sentence opening summary for the Section.'),
    confidence: z
      .number()
      .describe('0-10 confidence score; communicate uncertainty in prose, not schema bounds.'),
    sources: SourceSchema.array().describe(
      'Best public sources supporting the Section-level judgment.',
    ),
    icpExistenceCheck: IcpExistenceCheckSchema.describe(
      'ICP existence check by account-count cuts.',
    ),
    personaReality: PersonaRealitySchema.describe(
      'Persona reality by named real people at named ICP companies.',
    ),
    awarenessDistribution: AwarenessDistributionSchema.describe(
      'Awareness-level distribution from unaware to most-aware.',
    ),
    buyingContext: BuyingContextSchema.describe(
      'Observable triggers that create buying context.',
    ),
    clusters: ClustersSchema.describe(
      'Communities, newsletters, events, podcasts, and Slack groups where buyers cluster.',
    ),
  })
  .describe('Complete Section 02 Buyer & ICP Validation Artifact.');

export type BuyerICPArtifact = z.infer<typeof BuyerICPArtifactSchema>;

type ValidationResult = { ok: boolean; errors: string[] };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushMissingText(
  errors: string[],
  path: string,
  value: unknown,
): void {
  if (!hasText(value)) {
    errors.push(`${path}: required field missing.`);
  }
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Array.from(duplicates);
}

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
  pushMissingText(
    errors,
    'awarenessDistribution.prose',
    artifact.awarenessDistribution.prose,
  );
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
    pushMissingText(
      errors,
      `triggers[${index}].detectionSignal`,
      trigger.detectionSignal,
    );
    pushMissingText(errors, `triggers[${index}].evidence`, trigger.evidence);
  });

  artifact.clusters.venues.forEach((venue, index) => {
    pushMissingText(errors, `clusters.venues[${index}].name`, venue.name);
    pushMissingText(
      errors,
      `clusters.venues[${index}].audienceSize`,
      venue.audienceSize,
    );
    pushMissingText(errors, `clusters.venues[${index}].sourceUrl`, venue.sourceUrl);
    pushMissingText(
      errors,
      `clusters.venues[${index}].whyItMatters`,
      venue.whyItMatters,
    );
  });
}

export function validateBuyerICPMinimums(
  artifact: BuyerICPArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  const personaCount = artifact.personaReality.personas.length;
  if (personaCount < 5) {
    errors.push(
      `personas: have ${personaCount}, need >=5 named real persons at named real ICP companies.`,
    );
  }

  const firmographicCutCount = artifact.icpExistenceCheck.firmographicCuts.length;
  if (firmographicCutCount < 3) {
    errors.push(
      `firmographicCuts: have ${firmographicCutCount}, need >=3 typed cuts across distinct cutType values.`,
    );
  }

  const cutTypes = artifact.icpExistenceCheck.firmographicCuts.map(
    (cut) => cut.cutType,
  );
  for (const duplicate of findDuplicates(cutTypes)) {
    errors.push(`firmographicCuts: duplicate cutType ${duplicate} — one per dimension.`);
  }

  const observedAwarenessLevels = artifact.awarenessDistribution.levels.map(
    (level) => level.level,
  );
  const missingAwarenessLevels = AWARENESS_LEVELS.filter(
    (level) => !observedAwarenessLevels.includes(level),
  );
  if (missingAwarenessLevels.length > 0) {
    errors.push(
      `awarenessDistribution: missing Schwartz levels ${missingAwarenessLevels.join(', ')}.`,
    );
  }
  for (const duplicate of findDuplicates(observedAwarenessLevels)) {
    errors.push(`awarenessDistribution: duplicate Schwartz level ${duplicate}.`);
  }

  const triggerCount = artifact.buyingContext.triggers.length;
  if (triggerCount < 3) {
    errors.push(`triggers: have ${triggerCount}, need >=3 publicly detectable triggers.`);
  }

  const communityCount = artifact.clusters.venues.filter(
    (venue) => venue.bucketType === 'community',
  ).length;
  if (communityCount < 2) {
    errors.push(`clusters: have ${communityCount} community venues, need >=2.`);
  }

  const newsletterCount = artifact.clusters.venues.filter(
    (venue) => venue.bucketType === 'newsletter',
  ).length;
  if (newsletterCount < 2) {
    errors.push(`clusters: have ${newsletterCount} newsletter venues, need >=2.`);
  }

  artifact.personaReality.personas.forEach((persona, index) => {
    if (!VALID_URL_PATTERN.test(persona.sourceUrl)) {
      errors.push(
        `personas[${index}] (${persona.name}): sourceUrl is not a valid URL.`,
      );
    }
  });

  return { ok: errors.length === 0, errors };
}
