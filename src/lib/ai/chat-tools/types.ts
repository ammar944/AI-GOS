// Chat tool types — extracted from the legacy @/lib/chat/types module.
// Only the types still referenced by the active agent chat system.

export type BlueprintSection =
  | 'industryMarketOverview'
  | 'icpAnalysisValidation'
  | 'offerAnalysisViability'
  | 'competitorAnalysis'
  | 'crossAnalysisSynthesis';

export interface ChunkInput {
  blueprintId: string;
  section: BlueprintSection;
  fieldPath: string;
  content: string;
  contentType: 'string' | 'number' | 'array' | 'object' | 'enum';
  metadata: {
    sectionTitle: string;
    fieldDescription: string;
    isEditable: boolean;
    originalValue: unknown;
  };
}

export interface BlueprintChunk extends ChunkInput {
  id: string;
  embedding: number[];
  similarity?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfidenceFactors {
  avgSimilarity: number;
  chunkCount: number;
  coverageScore: number;
  highQualityChunks: number;
}

export interface SourceQuality {
  avgRelevance: number;
  sourceCount: number;
  highQualitySources: number;
  explanation: string;
}

export interface ConfidenceResult {
  level: 'high' | 'medium' | 'low';
  factors: ConfidenceFactors;
  explanation: string;
}

export interface PendingEdit {
  section: string;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
}

export interface EditHistoryEntry {
  id: string;
  appliedAt: Date;
  edits: PendingEdit[];
  blueprintBefore: Record<string, unknown>;
  blueprintAfter: Record<string, unknown>;
  label: string;
}

export interface EditHistoryState {
  history: EditHistoryEntry[];
  currentIndex: number;
  maxDepth: number;
}
