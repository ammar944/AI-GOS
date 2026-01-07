// Blueprint Embedding Service
// Generates embeddings via OpenRouter and stores in Supabase

import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import { createClient } from '@/lib/supabase/server';
import type { ChunkInput } from './types';

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = createOpenRouterClient();
  const response = await client.embeddings({
    model: MODELS.EMBEDDING,
    input: text,
  });
  return response.embeddings[0];
}

/**
 * Generate embeddings for multiple texts (batch)
 * More efficient than individual calls
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = createOpenRouterClient();
  const response = await client.embeddings({
    model: MODELS.EMBEDDING,
    input: texts,
  });
  return response.embeddings;
}

/**
 * Store chunks with embeddings in Supabase
 * Generates embeddings in batch for efficiency
 */
export async function storeChunksWithEmbeddings(
  chunks: ChunkInput[]
): Promise<{ stored: number; cost: number }> {
  if (chunks.length === 0) {
    return { stored: 0, cost: 0 };
  }

  const client = createOpenRouterClient();
  const supabase = await createClient();

  // Generate all embeddings in batch
  const contents = chunks.map((c) => c.content);
  const response = await client.embeddings({
    model: MODELS.EMBEDDING,
    input: contents,
  });

  // Prepare rows for insert (snake_case for DB)
  const rows = chunks.map((chunk, index) => ({
    blueprint_id: chunk.blueprintId,
    section: chunk.section,
    field_path: chunk.fieldPath,
    content: chunk.content,
    content_type: chunk.contentType,
    embedding: response.embeddings[index],
    metadata: chunk.metadata,
  }));

  // Batch insert
  const { error } = await supabase.from('blueprint_chunks').insert(rows);

  if (error) {
    throw new Error(`Failed to store chunks: ${error.message}`);
  }

  return {
    stored: rows.length,
    cost: response.cost,
  };
}

/**
 * Delete all chunks for a blueprint (for re-chunking)
 */
export async function deleteChunksForBlueprint(
  blueprintId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('blueprint_chunks')
    .delete()
    .eq('blueprint_id', blueprintId);

  if (error) {
    throw new Error(`Failed to delete chunks: ${error.message}`);
  }
}

/**
 * Check if a blueprint has been chunked
 */
export async function hasChunks(blueprintId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('blueprint_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('blueprint_id', blueprintId);

  if (error) {
    throw new Error(`Failed to check chunks: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

/**
 * Get chunk count for a blueprint
 */
export async function getChunkCount(blueprintId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('blueprint_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('blueprint_id', blueprintId);

  if (error) {
    throw new Error(`Failed to count chunks: ${error.message}`);
  }

  return count ?? 0;
}
