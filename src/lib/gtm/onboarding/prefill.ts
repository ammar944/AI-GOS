import { z } from 'zod';
import {
  GTM_BRIEF_FIELD_GROUPS,
  GTM_BRIEF_FIELD_KEYS,
  buildEmptyGtmBrief,
  gtmBriefSchema,
  type GtmBrief,
  type GtmBriefField,
  type GtmBriefFieldKey,
} from '@/lib/gtm/schemas/gtm-brief';
import {
  researchEvidenceSchema,
  sourceGapSchema,
  type ResearchEvidence,
  type SourceGap,
} from '@/lib/gtm/schemas/evidence';
import {
  GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD,
} from '@/lib/gtm/onboarding/brief-mapping';
import { getGtmOnboardingQuestions } from '@/lib/gtm/onboarding/questionnaire';

export const GTM_PREFILL_MANIFEST_KEY = 'gtm_prefill';

export const GTM_PREFILL_STATUSES = [
  'discovering',
  'ready_for_review',
  'confirmed',
] as const;

export type GtmPrefillStatus = (typeof GTM_PREFILL_STATUSES)[number];

export interface BuildInitialGtmPrefillManifestInput {
  runId: string;
  inputUrl: string;
  now?: string;
}

export interface BuildGtmPrefillManifestFromDiscoveryInput extends BuildInitialGtmPrefillManifestInput {
  output: unknown;
  existingPrefill?: unknown;
}

export interface ConfirmGtmPrefillManifestInput {
  prefill: GtmPrefillManifest;
  fields?: Record<string, string>;
  now?: string;
}

export interface GtmPrefillQuestion {
  id: string;
  claim_path: string[];
  prompt: string;
  reason: string;
}

export interface GtmPrefillReviewField {
  fieldKey: GtmBriefFieldKey;
  label: string;
  value: string;
  status: GtmBriefField['status'];
  confidence: GtmBriefField['confidence'];
  sources: ResearchEvidence[];
}

export const gtmPrefillQuestionSchema = z.object({
  id: z.string().min(1),
  claim_path: z.array(z.string().min(1)).min(1),
  prompt: z.string().min(1),
  reason: z.string().min(1),
});

export const gtmPrefillManifestSchema = z.object({
  version: z.literal(1),
  status: z.enum(GTM_PREFILL_STATUSES),
  reviewRequired: z.boolean(),
  researchUnlocked: z.boolean(),
  websiteUrl: z.string().url(),
  draft: gtmBriefSchema,
  sourceGaps: z.array(sourceGapSchema),
  questions: z.array(gtmPrefillQuestionSchema),
  updatedAt: z.string().datetime(),
  discoveredAt: z.string().datetime().optional(),
  confirmedAt: z.string().datetime().optional(),
});

export type GtmPrefillManifest = z.infer<typeof gtmPrefillManifestSchema>;

const FIELD_LABEL_BY_KEY = buildFieldLabelsByKey();

export function buildInitialGtmPrefillManifest(
  input: BuildInitialGtmPrefillManifestInput,
): GtmPrefillManifest {
  const now = input.now ?? new Date().toISOString();
  const brief = setBriefField({
    brief: buildEmptyGtmBrief({
      briefId: `brief_${input.runId}`,
      createdAt: now,
      updatedAt: now,
    }),
    fieldKey: 'companyUrl',
    value: input.inputUrl,
    status: 'confirmed',
    confidence: 'high',
    sources: [
      buildUserInputEvidence({
        fieldKey: 'companyUrl',
        value: input.inputUrl,
        label: 'Submitted website',
      }),
    ],
    updatedBy: 'user',
    updatedAt: now,
  });

  return gtmPrefillManifestSchema.parse({
    version: 1,
    status: 'discovering',
    reviewRequired: true,
    researchUnlocked: false,
    websiteUrl: input.inputUrl,
    draft: brief,
    sourceGaps: [],
    questions: [],
    updatedAt: now,
  });
}

export function buildGtmPrefillManifestFromDiscovery(
  input: BuildGtmPrefillManifestFromDiscoveryInput,
): GtmPrefillManifest {
  const now = input.now ?? new Date().toISOString();
  const existing = getGtmPrefillManifest(input.existingPrefill);
  const initial = existing ?? buildInitialGtmPrefillManifest({
    runId: input.runId,
    inputUrl: input.inputUrl,
    now,
  });
  const output = getDiscoverUrlOutput(input.output);
  let draft = initial.draft;
  const sourceGaps: SourceGap[] = [];

  for (const prefilledField of output.prefilledFields) {
    const fieldKey = getGtmBriefFieldKey(prefilledField.fieldKey);
    if (!fieldKey) {
      sourceGaps.push(buildSourceGap({
        id: `gap_unmapped_${stableKey(prefilledField.fieldKey)}`,
        claimPath: ['unmappedPrefill', prefilledField.fieldKey],
        severity: 'informational',
        reason: `Discovery returned unmapped prefill field ${prefilledField.fieldKey}.`,
        remediation: 'Map this field into the GTM Brief before using it downstream.',
      }));
      continue;
    }

    const evidence = prefilledField.evidence.flatMap((claim, index) => {
      const mapped = buildWebsiteEvidence({
        fieldKey,
        label: prefilledField.label,
        claim,
        confidence: prefilledField.confidence,
        inputUrl: input.inputUrl,
        index,
      });
      return mapped ? [mapped] : [];
    });

    if (evidence.length === 0) {
      sourceGaps.push(buildSourceGap({
        id: `gap_unsourced_${fieldKey}`,
        claimPath: getClaimPathForBriefField(fieldKey),
        severity: 'degraded',
        reason: `${getBriefFieldLabel(fieldKey)} was returned by discovery without source evidence.`,
        remediation: `Review ${getBriefFieldLabel(fieldKey)} manually before confirming the GTM Brief.`,
      }));
      continue;
    }

    draft = applySuggestedWebsiteField({
      brief: draft,
      fieldKey,
      value: prefilledField.value,
      confidence: prefilledField.confidence,
      sources: evidence,
      updatedAt: now,
    });
  }

  if (draft.fields.companyName.value.trim().length === 0) {
    const companyNameEvidence = buildWebsiteEvidence({
      fieldKey: 'companyName',
      label: 'Company Name',
      claim: output.companyName,
      confidence: 'high',
      inputUrl: input.inputUrl,
      index: 0,
    });
    if (companyNameEvidence) {
      draft = applySuggestedWebsiteField({
        brief: draft,
        fieldKey: 'companyName',
        value: output.companyName.value,
        confidence: 'high',
        sources: [companyNameEvidence],
        updatedAt: now,
      });
    }
  }

  const normalizedSourceGaps = [
    ...sourceGaps,
    ...output.unresolvedFields.map((fieldKey) => {
      return buildSourceGap({
        id: `gap_unresolved_${stableKey(fieldKey)}`,
        claimPath: getClaimPathForUnknownField(fieldKey),
        severity: 'informational',
        reason: `Website discovery could not verify ${getUnknownFieldLabel(fieldKey)}.`,
        remediation: `Ask the user to confirm ${getUnknownFieldLabel(fieldKey)} during the review step.`,
      });
    }),
    ...output.sourceGaps.map((gap, index) => {
      return buildSourceGap({
        id: `gap_discovery_${index}_${stableKey(gap.field)}`,
        claimPath: getClaimPathForUnknownField(gap.field),
        severity: mapLegacySourceGapSeverity(gap.severity),
        reason: gap.reason,
        remediation: gap.remediation,
      });
    }),
  ];

  const nextPrefill = {
    ...initial,
    status: 'ready_for_review' as const,
    reviewRequired: true,
    researchUnlocked: false,
    draft: {
      ...draft,
      updatedAt: now,
    },
    sourceGaps: dedupeSourceGaps(normalizedSourceGaps),
    questions: buildQuestionsFromSourceGaps(normalizedSourceGaps),
    discoveredAt: now,
    updatedAt: now,
  };

  return gtmPrefillManifestSchema.parse(nextPrefill);
}

export function confirmGtmPrefillManifest(
  input: ConfirmGtmPrefillManifestInput,
): GtmPrefillManifest {
  const now = input.now ?? new Date().toISOString();
  const reviewedFields = input.fields ?? getSuggestedFieldValueRecord(input.prefill.draft);
  let draft = input.prefill.draft;

  for (const [rawFieldKey, rawValue] of Object.entries(reviewedFields)) {
    const fieldKey = getGtmBriefFieldKey(rawFieldKey);
    if (!fieldKey) {
      continue;
    }

    const value = rawValue.trim();
    if (value.length === 0) {
      continue;
    }

    const current = draft.fields[fieldKey];
    const sources = current.value === value && current.sources.length > 0
      ? current.sources
      : [
          ...current.sources,
          buildUserInputEvidence({
            fieldKey,
            value,
            label: 'Prefill review',
          }),
        ];

    draft = setBriefField({
      brief: draft,
      fieldKey,
      value,
      status: 'confirmed',
      confidence: current.confidence === 'missing' ? 'high' : current.confidence,
      sources,
      updatedBy: 'user',
      updatedAt: now,
    });
  }

  return gtmPrefillManifestSchema.parse({
    ...input.prefill,
    status: 'confirmed',
    reviewRequired: false,
    researchUnlocked: true,
    draft: {
      ...draft,
      updatedAt: now,
    },
    confirmedAt: now,
    updatedAt: now,
  });
}

export function getGtmPrefillManifestFromRunManifest(
  manifest: Record<string, unknown> | null | undefined,
): GtmPrefillManifest | null {
  if (!manifest) {
    return null;
  }

  return getGtmPrefillManifest(manifest[GTM_PREFILL_MANIFEST_KEY]);
}

export function upsertGtmPrefillManifest(
  manifest: Record<string, unknown> | null | undefined,
  prefill: GtmPrefillManifest,
): Record<string, unknown> {
  return {
    ...(manifest ?? {}),
    [GTM_PREFILL_MANIFEST_KEY]: prefill,
  };
}

export function isGtmPrefillResearchUnlocked(
  manifest: Record<string, unknown> | null | undefined,
): boolean {
  const prefill = getGtmPrefillManifestFromRunManifest(manifest);
  return prefill?.status === 'confirmed' && prefill.researchUnlocked === true;
}

export function getGtmPrefillReviewFields(
  prefill: GtmPrefillManifest,
): GtmPrefillReviewField[] {
  return GTM_BRIEF_FIELD_KEYS.flatMap((fieldKey) => {
    const field = prefill.draft.fields[fieldKey];
    const hasWebsiteEvidence = field.sources.some((source) => {
      return source.source_type === 'website_url' || source.source_type === 'web_page';
    });

    if (!field.value || !hasWebsiteEvidence) {
      return [];
    }

    return [{
      fieldKey,
      label: getBriefFieldLabel(fieldKey),
      value: field.value,
      status: field.status,
      confidence: field.confidence,
      sources: field.sources,
    }];
  });
}

function getGtmPrefillManifest(value: unknown): GtmPrefillManifest | null {
  const result = gtmPrefillManifestSchema.safeParse(value);
  return result.success ? result.data : null;
}

function applySuggestedWebsiteField(input: {
  brief: GtmBrief;
  fieldKey: GtmBriefFieldKey;
  value: string;
  confidence: ResearchEvidence['confidence'];
  sources: ResearchEvidence[];
  updatedAt: string;
}): GtmBrief {
  const current = input.brief.fields[input.fieldKey];
  if (current.status === 'confirmed' && current.updatedBy === 'user') {
    return input.brief;
  }

  return setBriefField({
    brief: input.brief,
    fieldKey: input.fieldKey,
    value: input.value,
    status: 'suggested',
    confidence: input.confidence,
    sources: input.sources,
    updatedBy: 'ai',
    updatedAt: input.updatedAt,
  });
}

function setBriefField(input: {
  brief: GtmBrief;
  fieldKey: GtmBriefFieldKey;
  value: string;
  status: GtmBriefField['status'];
  confidence: GtmBriefField['confidence'];
  sources: ResearchEvidence[];
  updatedBy: GtmBriefField['updatedBy'];
  updatedAt: string;
}): GtmBrief {
  return {
    ...input.brief,
    fields: {
      ...input.brief.fields,
      [input.fieldKey]: {
        ...input.brief.fields[input.fieldKey],
        value: input.value,
        status: input.status,
        confidence: input.confidence,
        sources: input.sources,
        updatedBy: input.updatedBy,
        updatedAt: input.updatedAt,
      },
    },
    updatedAt: input.updatedAt,
  };
}

function buildWebsiteEvidence(input: {
  fieldKey: GtmBriefFieldKey;
  label: string;
  claim: SourcedClaim;
  confidence: ResearchEvidence['confidence'];
  inputUrl: string;
  index: number;
}): ResearchEvidence | null {
  const sourceType = isSameUrl(input.claim.sourceUrl, input.inputUrl)
    ? 'website_url'
    : 'web_page';
  const evidence = {
    id: `ev_${input.fieldKey}_${input.index}_${stableKey(input.claim.sourceUrl)}`,
    source_type: sourceType,
    label: input.label,
    url: input.claim.sourceUrl,
    quote: input.claim.value,
    retrieved_at: input.claim.retrievedAt,
    confidence: input.confidence,
    claim_path: getClaimPathForBriefField(input.fieldKey),
  };
  const result = researchEvidenceSchema.safeParse(evidence);
  return result.success ? result.data : null;
}

function buildUserInputEvidence(input: {
  fieldKey: GtmBriefFieldKey;
  value: string;
  label: string;
}): ResearchEvidence {
  return researchEvidenceSchema.parse({
    id: `ev_user_${input.fieldKey}_${stableKey(input.value)}`,
    source_type: 'user_input',
    label: input.label,
    quote: input.value,
    confidence: 'high',
    claim_path: getClaimPathForBriefField(input.fieldKey),
  });
}

function buildSourceGap(input: {
  id: string;
  claimPath: string[];
  severity: SourceGap['severity'];
  reason: string;
  remediation?: string;
}): SourceGap {
  return sourceGapSchema.parse({
    id: input.id,
    claim_path: input.claimPath,
    severity: input.severity,
    reason: input.reason,
    ...(input.remediation ? { remediation: input.remediation } : {}),
  });
}

function buildQuestionsFromSourceGaps(sourceGaps: readonly SourceGap[]): GtmPrefillQuestion[] {
  return dedupeSourceGaps(sourceGaps).map((sourceGap) => {
    const fieldKey = sourceGap.claim_path.at(-1) ?? sourceGap.claim_path.join('.');
    const prompt = getUnknownFieldLabel(fieldKey);
    return {
      id: `question_${stableKey(sourceGap.claim_path.join('_'))}`,
      claim_path: sourceGap.claim_path,
      prompt: `Confirm ${prompt}`,
      reason: sourceGap.reason,
    };
  });
}

function dedupeSourceGaps(sourceGaps: readonly SourceGap[]): SourceGap[] {
  const seen = new Set<string>();
  const deduped: SourceGap[] = [];

  for (const sourceGap of sourceGaps) {
    const key = `${sourceGap.claim_path.join('.')}:${sourceGap.reason}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(sourceGap);
  }

  return deduped;
}

function getDiscoverUrlOutput(value: unknown): DiscoverUrlOutput {
  const record = asRecord(value);
  const companyName = asSourcedClaim(record?.company_name) ?? {
    value: '',
    sourceUrl: '',
    retrievedAt: '',
  };

  return {
    companyName,
    prefilledFields: asArray(record?.prefilled_fields).flatMap((field) => {
      const fieldRecord = asRecord(field);
      const fieldKey = getStringField(fieldRecord, 'field_key');
      const label = getStringField(fieldRecord, 'label');
      const fieldValue = getStringField(fieldRecord, 'value');
      const confidence = getConfidence(getStringField(fieldRecord, 'confidence'));

      if (!fieldKey || !label || !fieldValue || !confidence) {
        return [];
      }

      return [{
        fieldKey,
        label,
        value: fieldValue,
        confidence,
        evidence: asArray(fieldRecord?.evidence).flatMap((claim) => {
          const sourcedClaim = asSourcedClaim(claim);
          return sourcedClaim ? [sourcedClaim] : [];
        }),
      }];
    }),
    unresolvedFields: asArray(record?.unresolved_fields).flatMap((field) => {
      return typeof field === 'string' && field.trim().length > 0 ? [field.trim()] : [];
    }),
    sourceGaps: asArray(record?.source_gaps).flatMap((gap) => {
      const sourceGap = asLegacySourceGap(gap);
      return sourceGap ? [sourceGap] : [];
    }),
  };
}

function asSourcedClaim(value: unknown): SourcedClaim | null {
  const record = asRecord(value);
  const claimValue = getStringField(record, 'value');
  const sourceUrl = getStringField(record, 'source_url');
  const retrievedAt = getStringField(record, 'retrieved_at');

  if (!claimValue || !sourceUrl || !retrievedAt) {
    return null;
  }

  return {
    value: claimValue,
    sourceUrl,
    retrievedAt,
  };
}

function asLegacySourceGap(value: unknown): LegacySourceGap | null {
  const record = asRecord(value);
  const field = getStringField(record, 'field');
  const reason = getStringField(record, 'reason');

  if (!field || !reason) {
    return null;
  }

  return {
    field,
    reason,
    remediation: getStringField(record, 'remediation'),
    severity: getStringField(record, 'severity'),
  };
}

function getClaimPathForUnknownField(field: string): string[] {
  const fieldKey = getGtmBriefFieldKey(field);
  return fieldKey ? getClaimPathForBriefField(fieldKey) : ['unknown', field];
}

function getClaimPathForBriefField(fieldKey: GtmBriefFieldKey): string[] {
  for (const [group, fields] of Object.entries(GTM_BRIEF_FIELD_GROUPS)) {
    if ((fields as readonly string[]).includes(fieldKey)) {
      return [group, fieldKey];
    }
  }

  return [fieldKey];
}

function getGtmBriefFieldKey(value: string): GtmBriefFieldKey | null {
  return (GTM_BRIEF_FIELD_KEYS as readonly string[]).includes(value)
    ? (value as GtmBriefFieldKey)
    : null;
}

function getSuggestedFieldValueRecord(brief: GtmBrief): Record<string, string> {
  return Object.fromEntries(
    GTM_BRIEF_FIELD_KEYS.flatMap((fieldKey) => {
      const field = brief.fields[fieldKey];
      if (field.status !== 'suggested' || field.value.trim().length === 0) {
        return [];
      }

      return [[fieldKey, field.value]];
    }),
  );
}

function getBriefFieldLabel(fieldKey: GtmBriefFieldKey): string {
  return FIELD_LABEL_BY_KEY[fieldKey] ?? fieldKey;
}

function getUnknownFieldLabel(field: string): string {
  const fieldKey = getGtmBriefFieldKey(field);
  return fieldKey ? getBriefFieldLabel(fieldKey) : field;
}

function buildFieldLabelsByKey(): Partial<Record<GtmBriefFieldKey, string>> {
  const labels: Partial<Record<GtmBriefFieldKey, string>> = {
    companyUrl: 'Company URL',
  };

  for (const question of getGtmOnboardingQuestions()) {
    const answerKey = getMappedOnboardingAnswerKey(question.answerKey);
    if (!answerKey) {
      continue;
    }

    const mappedField = GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD[answerKey];
    labels[mappedField] = question.prompt;
  }

  return labels;
}

function getMappedOnboardingAnswerKey(
  value: string,
): keyof typeof GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD | null {
  return value in GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD
    ? (value as keyof typeof GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD)
    : null;
}

function mapLegacySourceGapSeverity(severity: string | undefined): SourceGap['severity'] {
  if (severity === 'blocker') {
    return 'blocker';
  }

  if (severity === 'warn') {
    return 'degraded';
  }

  return 'informational';
}

function getConfidence(value: string | undefined): ResearchEvidence['confidence'] | null {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  return null;
}

function isSameUrl(left: string, right: string): boolean {
  try {
    return new URL(left).toString() === new URL(right).toString();
  } catch {
    return false;
  }
}

function stableKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'value';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringField(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

interface DiscoverUrlOutput {
  companyName: SourcedClaim;
  prefilledFields: PrefilledField[];
  unresolvedFields: string[];
  sourceGaps: LegacySourceGap[];
}

interface PrefilledField {
  fieldKey: string;
  label: string;
  value: string;
  confidence: ResearchEvidence['confidence'];
  evidence: SourcedClaim[];
}

interface SourcedClaim {
  value: string;
  sourceUrl: string;
  retrievedAt: string;
}

interface LegacySourceGap {
  field: string;
  reason: string;
  remediation?: string;
  severity?: string;
}
