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

// ---------------------------------------------------------------------------
// Tool progress streaming (Fix #7 — multi-step progress)
// ---------------------------------------------------------------------------

/**
 * Emitted by tools during execution to provide real-time progress updates.
 * Used with SSE or data stream annotations to show phase transitions
 * (e.g., Deep Research: Decompose → Research → Synthesize).
 */
export interface ToolProgressEvent {
  toolName: string;
  phase: string;
  status: 'start' | 'update' | 'complete';
  duration?: number;
  data?: Record<string, unknown>;
}

/**
 * Callback type for tool progress emission.
 * Pass this to tool factory functions to enable streaming progress.
 */
export type OnToolProgress = (event: ToolProgressEvent) => void;

// ---------------------------------------------------------------------------
// Sprint 2 tool result types
// ---------------------------------------------------------------------------

export interface DeepResearchResult {
  query: string;
  phases: { name: string; status: 'done' | 'in-progress' | 'pending'; duration: number }[];
  findings: { title: string; content: string; citations: { label: string; url: string }[] }[];
  sources: { domain: string; url: string }[];
  totalDuration: number;
  totalCost?: number;
  error?: string;
}

export interface ComparisonResult {
  competitors: string[];
  dimensions: string[];
  headers: string[];
  rows: Record<string, string>[];
  winnerPerColumn?: Record<string, string>;
  error?: string;
}

export interface AnalysisResult {
  section: string;
  overallScore: number;
  dimensions: { name: string; score: number; reasoning?: string }[];
  recommendations: string[];
  summary?: string;
  error?: string;
}

export interface VisualizationResult {
  type: 'bar' | 'radar' | 'timeline';
  title: string;
  data: Array<Record<string, string | number>>;
  config: {
    colors: string[];
    dataKey: string;
    categoryKey: string;
    labels?: string[];
  };
  error?: string;
}
