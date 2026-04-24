import {
  buildEmptyGtmBrief,
  type GtmBrief,
  type GtmBriefFieldKey,
} from '../schemas/gtm/gtm-brief';
import {
  freezeBriefAsSnapshot,
  type GtmBriefSnapshot,
} from '../schemas/gtm/gtm-brief-snapshot';

const LOCAL_FIXTURE_FIELDS = {
  companyName: 'AIGOS',
  companyUrl: 'https://aigos.example',
  productDescription: 'AI-powered go-to-market operations system for SaaS teams.',
  targetCustomer: 'B2B SaaS founders and growth leaders.',
  salesMotion: 'Hybrid',
  pricingModel: 'Subscription (monthly / annual)',
  conversionPath: 'Demo required',
  avgAcv: '$10K–$50K',
  primaryIcpDescription: 'Growth-stage SaaS companies that need clearer GTM execution.',
  industryVertical: 'B2B SaaS',
  topCompetitors: 'Legacy agencies, internal spreadsheets, generic AI tools',
  uniqueEdge: 'Research, strategy, media planning, and scripts share one locked GTM Brief.',
  goals: 'Create an execution-ready GTM plan from a trusted company brief.',
  channels: 'LinkedIn, Google, outbound',
  brandPositioning: 'AI-GOS is the operating layer for SaaS go-to-market work.',
} as const satisfies Partial<Record<GtmBriefFieldKey, string>>;

export function buildLocalGtmFixtureSnapshot(now = new Date().toISOString()): GtmBriefSnapshot {
  const emptyBrief = buildEmptyGtmBrief({
    briefId: 'brief_local_fixture',
    clientId: 'client_local_fixture',
    createdAt: now,
    updatedAt: now,
  });

  const briefWithFixtureFields = applyFixtureFields(emptyBrief, now);

  return freezeBriefAsSnapshot(briefWithFixtureFields, {
    snapshotId: 'snapshot_local_fixture',
    now,
  });
}

function applyFixtureFields(brief: GtmBrief, updatedAt: string): GtmBrief {
  const fields: GtmBrief['fields'] = { ...brief.fields };
  const entries = Object.entries(LOCAL_FIXTURE_FIELDS) as Array<[GtmBriefFieldKey, string]>;

  for (const [fieldKey, value] of entries) {
    fields[fieldKey] = {
      ...fields[fieldKey],
      value,
      status: 'confirmed',
      confidence: 'high',
      updatedBy: 'system',
      updatedAt,
    };
  }

  return {
    ...brief,
    fields,
    updatedAt,
  };
}
