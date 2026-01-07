// Blueprint Chat Types
// Types for RAG chunking and embedding storage

export type BlueprintSection =
  | 'industryMarketOverview'
  | 'icpAnalysisValidation'
  | 'offerAnalysisViability'
  | 'competitorAnalysis'
  | 'crossAnalysisSynthesis';

/**
 * Input for chunking - represents a semantic unit from the blueprint
 */
export interface ChunkInput {
  /** The blueprint this chunk belongs to */
  blueprintId: string;
  /** Which section of the blueprint */
  section: BlueprintSection;
  /** Dot-notation path to the field (e.g., "categorySnapshot.category") */
  fieldPath: string;
  /** Human-readable content for embedding */
  content: string;
  /** Type of the original value */
  contentType: 'string' | 'number' | 'array' | 'object' | 'enum';
  /** Additional metadata for context */
  metadata: {
    /** Human-readable section title */
    sectionTitle: string;
    /** Description of what this field represents */
    fieldDescription: string;
    /** Whether this field can be edited by users */
    isEditable: boolean;
    /** Original value before chunking */
    originalValue: unknown;
  };
}

/**
 * A chunk with embedding - stored in database
 */
export interface BlueprintChunk extends ChunkInput {
  /** Unique identifier for this chunk */
  id: string;
  /** Vector embedding for similarity search */
  embedding: number[];
  /** Similarity score when retrieved (optional, populated during search) */
  similarity?: number;
  /** When the chunk was created */
  createdAt: Date;
  /** When the chunk was last updated */
  updatedAt: Date;
}
