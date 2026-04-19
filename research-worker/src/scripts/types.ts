// Shared input/output types for the ICM script pipeline.
// Single source of truth — both pipeline.ts and stage modules import from here.

export interface StyleReference {
  name: string;
  content: string;
  source: string;
}

export interface ProofPoint {
  id: string;
  type: string;
  headline: string;
  detail: string;
  clientName?: string;
  verified: boolean;
}

export interface BrandVoiceNotes {
  tone: string;
  constraints: string;
  goodExample: string;
  badExample: string;
}

export interface PipelineInput {
  companyName: string;
  researchContext: Record<string, unknown>;
  styleReferences: StyleReference[];
  targetAudience: string;
  brandVoiceNotes?: BrandVoiceNotes | null;
  proofPoints?: ProofPoint[];
}
