import { z } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';

export const AUDIT_ARTIFACT_STATUSES = [
  'idle',
  'running',
  'partial',
  'complete',
  'error',
] as const;

export const ZONE_STATUSES = ['idle', 'running', 'complete', 'error'] as const;

export const ACTIVITY_EVENT_TYPES = [
  'tool-start',
  'tool-finish',
  'step-finish',
  'snapshot',
  'thinking',
  'output',
  'heartbeat',
  'error',
] as const;

export const ZoneStatusSchema = z.enum(ZONE_STATUSES);
export type ZoneStatus = z.infer<typeof ZoneStatusSchema>;

export const ArtifactStatusSchema = z.enum(AUDIT_ARTIFACT_STATUSES);
export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>;

export const ActivityEventTypeSchema = z.enum(ACTIVITY_EVENT_TYPES);
export type ActivityEventType = z.infer<typeof ActivityEventTypeSchema>;

export const ArtifactClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  confidence: z.number().describe('0-1 confidence score'),
  sourceIds: z.array(z.string()),
});
export type ArtifactClaim = z.infer<typeof ArtifactClaimSchema>;

export const ArtifactSourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable().optional(),
  fetchedAt: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  zoneId: z.string().nullable().optional(),
});
export type ArtifactSource = z.infer<typeof ArtifactSourceSchema>;

export const ArtifactActivityEventSchema = z.object({
  ts: z.string(),
  type: ActivityEventTypeSchema,
  label: z.string(),
  detail: z.string().nullable().optional(),
});
export type ArtifactActivityEvent = z.infer<typeof ArtifactActivityEventSchema>;

export const ArtifactThesisSchema = z
  .object({
    positioning_statement: z.string().nullable().optional(),
    competitors: z.array(z.string()).nullable().optional(),
    win_axes: z.array(z.string()).nullable().optional(),
    target_user: z.string().nullable().optional(),
    jtbd: z.string().nullable().optional(),
  })
  .nullable();
export type ArtifactThesis = z.infer<typeof ArtifactThesisSchema>;

export const ArtifactZoneSchema = z.object({
  zone: z.string(),
  sectionRunId: z.string().nullable(),
  revision: z.number().int().nonnegative(),
  status: ZoneStatusSchema,
  title: z.string(),
  narrative: z.string(),
  claims: z.array(ArtifactClaimSchema),
  sources: z.array(ArtifactSourceSchema),
  activity: z.array(ArtifactActivityEventSchema),
  errorMessage: z.string().nullable().optional(),
  partialAt: z.number().min(0).max(100).nullable().optional(),
});
export type ArtifactZone = z.infer<typeof ArtifactZoneSchema>;

export const POSITIONING_ZONE_IDS = POSITIONING_SECTION_IDS;
export type PositioningZoneId = (typeof POSITIONING_ZONE_IDS)[number];

export const AuditArtifactSchema = z.object({
  artifactId: z.string().nullable(),
  runId: z.string(),
  status: ArtifactStatusSchema,
  thesis: ArtifactThesisSchema,
  zones: z.record(z.string(), ArtifactZoneSchema),
});
export type AuditArtifact = z.infer<typeof AuditArtifactSchema>;
