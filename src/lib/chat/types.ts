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

// =============================================================================
// Source Quality Types
// =============================================================================

/**
 * Factors used to calculate confidence in a response
 */
export interface ConfidenceFactors {
  /** Average similarity score across all chunks (0-1) */
  avgSimilarity: number;
  /** Total number of source chunks used */
  chunkCount: number;
  /** Estimated coverage - how much of the answer is supported by sources */
  coverageScore: number;
  /** Number of high-quality chunks (similarity > 0.85) */
  highQualityChunks: number;
}

/**
 * Quality assessment of retrieved sources
 */
export interface SourceQuality {
  /** Average relevance score across all sources (0-1) */
  avgRelevance: number;
  /** Total number of sources retrieved */
  sourceCount: number;
  /** Number of high-quality sources (similarity > 0.85) */
  highQualitySources: number;
  /** Human-readable explanation of the quality assessment */
  explanation: string;
}

/**
 * Enhanced confidence result with detailed factors
 */
export interface ConfidenceResult {
  /** Overall confidence level */
  level: 'high' | 'medium' | 'low';
  /** Detailed factors that contributed to the confidence level */
  factors: ConfidenceFactors;
  /** Human-readable explanation of why this confidence level was assigned */
  explanation: string;
}

// =============================================================================
// Database Record Types
// =============================================================================

/**
 * Conversation record as stored in the database
 */
export interface ConversationRecord {
  id: string;
  blueprint_id: string | null;
  user_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Chat message record as stored in the database
 */
export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  confidence: 'high' | 'medium' | 'low' | null;
  confidence_explanation: string | null;
  intent: string | null;
  sources: unknown[] | null;
  source_quality: SourceQuality | null;
  pending_edits: PendingEdit[] | null;
  created_at: string;
  tokens_used: number | null;
  cost: number | null;
}

/**
 * Pending edit proposal from assistant
 */
export interface PendingEdit {
  section: string;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
}

/**
 * Input for creating a new conversation
 */
export interface CreateConversationInput {
  blueprintId?: string;
  title?: string;
}

/**
 * Input for saving a chat message
 */
export interface SaveMessageInput {
  conversationId: string;
  blueprintId?: string;
  message: {
    role: 'user' | 'assistant';
    content: string;
    confidence?: 'high' | 'medium' | 'low';
    confidenceExplanation?: string;
    intent?: string;
    sources?: unknown[];
    sourceQuality?: SourceQuality;
    pendingEdits?: PendingEdit[];
    tokensUsed?: number;
    cost?: number;
  };
}

/**
 * Response from save message API
 */
export interface SaveMessageResponse {
  messageId: string;
  conversationId: string;
}

/**
 * Response from load conversation API
 */
export interface LoadConversationResponse {
  conversation: ConversationRecord;
  messages: ChatMessageRecord[];
}

/**
 * Response from list conversations API
 */
export interface ListConversationsResponse {
  conversations: ConversationRecord[];
}

/**
 * Response from create conversation API
 */
export interface CreateConversationResponse {
  conversationId: string;
}

// =============================================================================
// Edit History Types (Undo/Redo)
// =============================================================================

/**
 * A single entry in the edit history stack
 */
export interface EditHistoryEntry {
  /** Unique identifier for this history entry */
  id: string;
  /** When this edit was applied */
  appliedAt: Date;
  /** The edits that were applied */
  edits: PendingEdit[];
  /** Blueprint state before the edits */
  blueprintBefore: Record<string, unknown>;
  /** Blueprint state after the edits */
  blueprintAfter: Record<string, unknown>;
  /** Human-readable label describing the edits */
  label: string;
}

/**
 * State for the edit history (undo/redo stack)
 */
export interface EditHistoryState {
  /** Stack of edit history entries */
  history: EditHistoryEntry[];
  /** Current position in the history (-1 means no history) */
  currentIndex: number;
  /** Maximum number of entries to keep */
  maxDepth: number;
}
