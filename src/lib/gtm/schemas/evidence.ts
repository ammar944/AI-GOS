import { z } from 'zod';

export const RESEARCH_EVIDENCE_SOURCE_TYPES = [
  'website_url',
  'web_page',
  'uploaded_document',
  'transcript',
  'tool_call',
  'user_input',
] as const;

export type ResearchEvidenceSourceType = (typeof RESEARCH_EVIDENCE_SOURCE_TYPES)[number];

export const RESEARCH_EVIDENCE_CONFIDENCES = ['low', 'medium', 'high'] as const;

export type ResearchEvidenceConfidence = (typeof RESEARCH_EVIDENCE_CONFIDENCES)[number];

export const researchEvidenceSchema = z
  .object({
    id: z.string().min(1),
    source_type: z.enum(RESEARCH_EVIDENCE_SOURCE_TYPES),
    label: z.string().min(1),
    url: z.string().url().optional(),
    file_reference: z.string().optional(),
    transcript_reference: z.string().optional(),
    tool_reference: z.string().optional(),
    quote: z.string().optional(),
    retrieved_at: z.string().datetime().optional(),
    observed_at: z.string().datetime().optional(),
    confidence: z.enum(RESEARCH_EVIDENCE_CONFIDENCES),
    claim_path: z.array(z.string().min(1)).min(1),
  })
  .refine(
    (ev) => {
      if (ev.source_type === 'user_input') return true;
      return ev.retrieved_at !== undefined || ev.observed_at !== undefined;
    },
    {
      message:
        'Non-user_input research evidence must have retrieved_at or observed_at.',
      path: ['retrieved_at'],
    },
  );

export type ResearchEvidence = z.infer<typeof researchEvidenceSchema>;

export const EVIDENCE_SOURCE_TYPES = RESEARCH_EVIDENCE_SOURCE_TYPES;
export const evidenceSourceSchema = researchEvidenceSchema;
export type EvidenceSource = ResearchEvidence;

export const SOURCE_GAP_SEVERITIES = ['blocker', 'degraded', 'informational'] as const;

export type SourceGapSeverity = (typeof SOURCE_GAP_SEVERITIES)[number];

export const sourceGapSchema = z.object({
  id: z.string().min(1),
  claim_path: z.array(z.string().min(1)).min(1),
  severity: z.enum(SOURCE_GAP_SEVERITIES),
  reason: z.string().min(1),
  remediation: z.string().optional(),
});

export type SourceGap = z.infer<typeof sourceGapSchema>;

const EMPTY_EVIDENCE_SET = { evidence: [], source_gaps: [] };

export const evidenceSetSchema = z.object({
  evidence: z.array(researchEvidenceSchema).default([]),
  source_gaps: z.array(sourceGapSchema).default([]),
});

export type EvidenceSet = z.infer<typeof evidenceSetSchema>;

export { EMPTY_EVIDENCE_SET };
