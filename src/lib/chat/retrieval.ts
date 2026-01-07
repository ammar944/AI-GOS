// src/lib/chat/retrieval.ts
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './embeddings';
import { BlueprintChunk, BlueprintSection } from './types';

export interface RetrievalOptions {
  blueprintId: string;
  query: string;
  matchThreshold?: number;  // Default 0.7
  matchCount?: number;      // Default 5
  sectionFilter?: BlueprintSection;
}

export interface RetrievalResult {
  chunks: BlueprintChunk[];
  embeddingCost: number;
}

/**
 * Retrieve relevant chunks from a blueprint using vector similarity search
 */
export async function retrieveRelevantChunks(
  options: RetrievalOptions
): Promise<RetrievalResult> {
  const {
    blueprintId,
    query,
    matchThreshold = 0.7,
    matchCount = 5,
    sectionFilter = null,
  } = options;

  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Call Supabase RPC for vector search
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('match_blueprint_chunks', {
    query_embedding: queryEmbedding,
    p_blueprint_id: blueprintId,
    match_threshold: matchThreshold,
    match_count: matchCount,
    section_filter: sectionFilter,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  // 3. Map to BlueprintChunk type (snake_case to camelCase)
  const chunks: BlueprintChunk[] = (data || []).map((row: any) => ({
    id: row.id,
    blueprintId,
    section: row.section as BlueprintSection,
    fieldPath: row.field_path,
    content: row.content,
    contentType: row.content_type,
    metadata: row.metadata,
    embedding: [], // Not returned from search
    similarity: row.similarity,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  return {
    chunks,
    embeddingCost: 0.00002 * (query.length / 4), // Rough estimate
  };
}

/**
 * Build context string from retrieved chunks for LLM prompt
 */
export function buildContextFromChunks(chunks: BlueprintChunk[]): string {
  if (chunks.length === 0) {
    return 'No relevant context found in the blueprint.';
  }

  return chunks
    .map((chunk, i) => {
      const similarity = chunk.similarity
        ? ` (relevance: ${(chunk.similarity * 100).toFixed(0)}%)`
        : '';
      return `[${i + 1}] ${chunk.metadata.sectionTitle} - ${chunk.metadata.fieldDescription}${similarity}:
${chunk.content}`;
    })
    .join('\n\n');
}
