import { z } from 'zod';

import { PositioningEnvelopeSchema } from '../envelope-schema';

/**
 * Per-section schema for the Buyer & ICP Validation subagent.
 *
 * Extends the legacy PositioningEnvelopeSchema with the rich structured
 * fields the SKILL.md prose has always asked for and that
 * platform-skills/ai-gos-buyer-icp-validation/scripts/validate.py enforces:
 *
 *   - personas[]                (>=5 named real persons with sourceUrl)
 *   - icpAccountCounts{}        (>=3 firmographic cuts with source + dateObserved)
 *   - awarenessDistribution[]   (all 5 Schwartz levels)
 *   - triggers[]                (>=3 publicly detectable)
 *   - clusters{}                (>=2 communities + >=2 newsletters)
 *
 * Cardinality minimums are enforced by validate.py inside the agent's
 * code_execution loop, NOT by Zod (Anthropic rejects .min()/.max() on
 * structured-output schemas — see learned-patterns.md). The schema declares
 * the shape; validate.py enforces the substance. The agent self-corrects
 * via the plan-validate-execute loop documented in SKILL.md.
 */

const FirmographicCutSchema = z.object({
  value: z.string().describe('e.g. "SaaS", "200-1000 employees", "$10M-$100M ARR"'),
  source: z
    .string()
    .describe('LinkedIn Sales Navigator / ZoomInfo / BuiltWith / public industry data'),
  dateObserved: z
    .string()
    .describe('YYYY-MM-DD when the count was observed; audience numbers drift weekly.'),
});

const PersonaSchema = z.object({
  name: z.string().describe('Real first + last name; no placeholders.'),
  title: z.string().describe('Current job title.'),
  company: z.string().describe('Named real ICP company.'),
  sourceUrl: z
    .string()
    .describe('Public URL (LinkedIn profile / conference roster / company bio).'),
  role: z.string().optional().describe('Persona archetype this person represents.'),
  evidence: z
    .string()
    .optional()
    .describe('Why this person counts as an ICP example (one sentence).'),
});

const AwarenessLevelSchema = z.object({
  level: z
    .enum(['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware'])
    .describe('Schwartz awareness level.'),
  sharePct: z
    .number()
    .optional()
    .describe('Approximate share of the ICP at this level (0-100); omit if unknown.'),
  evidence: z
    .string()
    .describe(
      'Evidence backing this share: search-volume split / review-language sample / content gap.',
    ),
});

const TriggerSchema = z.object({
  name: z
    .string()
    .describe('Trigger event type (funding round, leadership change, regulatory deadline...).'),
  detectionSignal: z
    .string()
    .describe(
      'How to detect this trigger from public data (Crunchbase / LinkedIn / SEC / news).',
    ),
  window: z
    .string()
    .optional()
    .describe('Trigger-to-evaluation window: "immediate" | "weeks" | "quarters"'),
});

const ClusterEntrySchema = z.object({
  name: z.string().describe('Named community / newsletter / conference / podcast.'),
  subscribers: z.number().optional().describe('Subscriber count where public.'),
  attendance: z.number().optional().describe('Conference attendance estimate.'),
  listeners: z.number().optional().describe('Podcast listenership estimate.'),
  sourceUrl: z
    .string()
    .describe('Public URL backing the count (subreddit / website / SimilarWeb).'),
});

const ClustersSchema = z.object({
  communities: z
    .array(ClusterEntrySchema)
    .describe('Named subreddits / Discord / Slack / forums. >=2 required.'),
  newsletters: z
    .array(ClusterEntrySchema)
    .describe('Named newsletters with subscriber estimates. >=2 required.'),
  conferences: z
    .array(ClusterEntrySchema)
    .optional()
    .describe('Named in-person + virtual events with attendance.'),
  podcasts: z
    .array(ClusterEntrySchema)
    .optional()
    .describe('Named podcasts where buyers and vendors appear.'),
});

const ICPAccountCountsSchema = z
  .object({
    industry: FirmographicCutSchema.optional(),
    employeeBands: FirmographicCutSchema.optional(),
    revenueBands: FirmographicCutSchema.optional(),
    geography: FirmographicCutSchema.optional(),
    techStack: FirmographicCutSchema.optional(),
  })
  .describe(
    'Firmographic ICP account counts. Provide >=3 cuts; each cut needs source + dateObserved.',
  );

/**
 * BuyerICPSectionSchema = PositioningEnvelopeSchema + the rich BuyerICP fields.
 *
 * Keeping the envelope core (sectionTitle / verdict / statusSummary / confidence
 * / keyFindings / evidenceQuotes / risksOrGaps / recommendedMoves / sources)
 * means the existing markdown formatter still works as a fallback while the
 * per-section formatter is added in a follow-up commit.
 */
export const BuyerICPSectionSchema = PositioningEnvelopeSchema.extend({
  personas: z
    .array(PersonaSchema)
    .describe(
      '>=5 named real persons at named real ICP companies, each with sourceUrl. Enforced by validate.py.',
    ),
  icpAccountCounts: ICPAccountCountsSchema,
  awarenessDistribution: z
    .array(AwarenessLevelSchema)
    .describe(
      'All 5 Schwartz awareness levels (unaware -> most-aware), each with evidence. Enforced by validate.py.',
    ),
  triggers: z
    .array(TriggerSchema)
    .describe(
      '>=3 publicly detectable triggers, each with detectionSignal. Internal frustration is not detectable.',
    ),
  clusters: ClustersSchema,
});

export type BuyerICPSection = z.infer<typeof BuyerICPSectionSchema>;
