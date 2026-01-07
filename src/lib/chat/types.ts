// Blueprint Chat Types
// Types for RAG chunking, embedding storage, and intent classification

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

// =============================================================================
// Intent Classification Types
// =============================================================================

/**
 * Intent for asking questions about the blueprint
 */
export interface QuestionIntent {
  type: 'question';
  /** What the user is asking about */
  topic: string;
  /** Which sections are likely relevant */
  sections: BlueprintSection[];
}

/**
 * Intent for editing a specific field in the blueprint
 */
export interface EditIntent {
  type: 'edit';
  /** Which section to edit */
  section: BlueprintSection;
  /** Specific field path within the section */
  field: string;
  /** What the user wants to change */
  desiredChange: string;
}

/**
 * Intent for explaining why something is the way it is
 */
export interface ExplainIntent {
  type: 'explain';
  /** Which section contains the item to explain */
  section: BlueprintSection;
  /** Specific field to explain */
  field: string;
  /** What aspect needs explanation */
  whatToExplain: string;
}

/**
 * Intent for regenerating an entire section with new instructions
 */
export interface RegenerateIntent {
  type: 'regenerate';
  /** Which section to regenerate */
  section: BlueprintSection;
  /** Special instructions for regeneration */
  instructions: string;
}

/**
 * Intent for general conversation (greetings, unclear requests)
 */
export interface GeneralIntent {
  type: 'general';
  /** What the conversation is about */
  topic: string;
}

/**
 * Discriminated union of all chat intents
 */
export type ChatIntent =
  | QuestionIntent
  | EditIntent
  | ExplainIntent
  | RegenerateIntent
  | GeneralIntent;

/**
 * Result from intent classification including cost tracking
 */
export interface IntentClassificationResult {
  /** The classified intent */
  intent: ChatIntent;
  /** Token usage for the classification */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Cost of the classification call */
  cost: number;
}
