# Phase 15 Discovery: RAG Foundation

**Discovery Level:** Level 2 (Standard Research)
**Date:** 2026-01-07
**Topics:** pgvector Supabase setup, OpenRouter embeddings API, vector indexing

## Key Findings

### 1. Supabase Project State

**Current Setup:**
- Project ID: `sidrtuxpqftyzwdusdha`
- PostgreSQL: 17.6.1
- Status: ACTIVE_HEALTHY
- Region: us-west-2

**Extensions Available:**
- `vector` extension v0.8.0 available but NOT installed
- Need to enable via `CREATE EXTENSION vector;`

**Current Tables:**
- Only `shared_blueprints` exists (for sharing functionality)
- No `blueprints` table - blueprints currently stored in localStorage

**Implication:** We need to create the `blueprints` table first to have a parent reference for `blueprint_chunks`.

### 2. OpenRouter Embeddings API

**API Endpoint:** Same as chat completions - use `/api/v1/embeddings`

**Request Format (OpenAI-compatible):**
```typescript
const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
    'X-Title': 'AI-GOS Blueprint Chat',
  },
  body: JSON.stringify({
    model: 'openai/text-embedding-3-small',
    input: text, // string or string[]
  }),
});
```

**Response Format:**
```typescript
{
  data: [
    { index: 0, embedding: number[] }, // 1536 dimensions
  ],
  model: string,
  usage: { prompt_tokens: number, total_tokens: number }
}
```

**Model Choice:**
- `openai/text-embedding-3-small` - 1536 dimensions, $0.02/1M tokens
- Best balance of cost/quality for RAG use case
- Matches specification recommendation

### 3. pgvector Setup for Supabase

**Enable Extension:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Vector Column Definition:**
```sql
embedding vector(1536)  -- matches text-embedding-3-small dimensions
```

**Recommended Index (IVFFlat):**
```sql
CREATE INDEX idx_blueprint_chunks_embedding
ON blueprint_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Note on Index Type:**
- IVFFlat: Good for datasets up to ~1M vectors, faster indexing
- HNSW: Better for larger datasets, better recall, slower to build
- For our use case (tens of thousands of chunks max), IVFFlat is appropriate

**Similarity Search Function:**
```sql
CREATE OR REPLACE FUNCTION match_blueprint_chunks(
  query_embedding vector(1536),
  p_blueprint_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  section_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  section TEXT,
  field_path TEXT,
  content TEXT,
  content_type TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.section,
    bc.field_path,
    bc.content,
    bc.content_type,
    bc.metadata,
    1 - (bc.embedding <=> query_embedding) AS similarity
  FROM blueprint_chunks bc
  WHERE bc.blueprint_id = p_blueprint_id
    AND (section_filter IS NULL OR bc.section = section_filter)
    AND 1 - (bc.embedding <=> query_embedding) > match_threshold
  ORDER BY bc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 4. OpenRouter Client Extension

The existing `OpenRouterClient` in `src/lib/openrouter/client.ts` does NOT have an embeddings method. We need to add:

```typescript
async embeddings(options: {
  model: string;
  input: string | string[];
}): Promise<{
  embeddings: number[][];
  usage: { promptTokens: number; totalTokens: number };
  cost: number;
}> {
  // Implementation using same fetch pattern as chat()
}
```

### 5. Database Schema Dependencies

**Required Tables (in order):**

1. **blueprints** - Parent table for storing blueprint outputs
   - Needed before blueprint_chunks can reference it
   - Currently blueprints are only in localStorage

2. **blueprint_chunks** - RAG chunks with embeddings
   - Foreign key to blueprints(id)
   - 1536-dimension vector column

3. **blueprint_chat_messages** - Chat history persistence
   - Foreign key to blueprints(id)
   - Stores conversation context

## Recommendations

### Database Migration Order

1. Enable pgvector extension
2. Create `blueprints` table (if not exists)
3. Create `blueprint_chunks` table with vector column
4. Create `blueprint_chat_messages` table
5. Create `match_blueprint_chunks` RPC function
6. Add indexes

### Embedding Service Pattern

Extend OpenRouterClient with embeddings support:
```typescript
// Add to MODELS constant
EMBEDDING: 'openai/text-embedding-3-small',

// Add to MODEL_COSTS
[MODELS.EMBEDDING]: { input: 0.02, output: 0 },

// Add embeddings method to OpenRouterClient class
```

### Chunking Strategy (from Spec)

Per the specification, chunk by semantic unit:
- Single pain point per chunk (not all pain points)
- Individual competitor per chunk
- Score fields individually
- Messaging angles as a single array chunk

This enables precise retrieval for Q&A.

## Source URLs

- https://openrouter.ai/docs/api/reference/embeddings
- https://openrouter.ai/openai/text-embedding-3-small
- Supabase pgvector documentation (searched via MCP)

## Impact on Phase 15

1. **Database first** - Need migrations before services
2. **Extend existing client** - Add embeddings to OpenRouterClient, not new client
3. **Blueprints table needed** - Either create it or handle foreign key differently
4. **Index choice** - IVFFlat with 100 lists is appropriate for expected scale

---
*Discovery completed: 2026-01-07*
