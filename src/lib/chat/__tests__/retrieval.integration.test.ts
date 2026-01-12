/**
 * Retrieval Service Integration Tests
 *
 * Tests for retrieveRelevantChunks() and buildContextFromChunks() verifying:
 * - Vector similarity search via Supabase RPC
 * - Chunk mapping from snake_case to camelCase
 * - Context building for LLM prompts
 * - Error handling for RPC failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BlueprintChunk, BlueprintSection } from "../types";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock Supabase server client
const mockSupabaseClient = {
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock embeddings service
vi.mock("../embeddings", () => ({
  generateEmbedding: vi.fn(() => Promise.resolve(Array(1536).fill(0.1))),
}));

// Import after mocks
import { retrieveRelevantChunks, buildContextFromChunks } from "../retrieval";
import { generateEmbedding } from "../embeddings";

const mockGenerateEmbedding = vi.mocked(generateEmbedding);

// =============================================================================
// Test Data Factories
// =============================================================================

interface MockChunkRow {
  id: string;
  section: BlueprintSection;
  field_path: string;
  content: string;
  content_type: string;
  metadata: {
    sectionTitle: string;
    fieldDescription: string;
    isEditable: boolean;
    originalValue: unknown;
  };
  similarity: number;
}

function createMockChunkRow(overrides?: Partial<MockChunkRow>): MockChunkRow {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    section: overrides?.section ?? "industryMarketOverview",
    field_path: overrides?.field_path ?? "categorySnapshot.category",
    content: overrides?.content ?? "Test chunk content for retrieval",
    content_type: overrides?.content_type ?? "string",
    metadata: overrides?.metadata ?? {
      sectionTitle: "Industry Market Overview",
      fieldDescription: "The market category being analyzed",
      isEditable: true,
      originalValue: "Test category",
    },
    similarity: overrides?.similarity ?? 0.85,
  };
}

function createMockBlueprintChunk(overrides?: Partial<BlueprintChunk>): BlueprintChunk {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    blueprintId: overrides?.blueprintId ?? "test-blueprint-id",
    section: overrides?.section ?? "industryMarketOverview",
    fieldPath: overrides?.fieldPath ?? "categorySnapshot.category",
    content: overrides?.content ?? "Test chunk content",
    contentType: overrides?.contentType ?? "string",
    metadata: overrides?.metadata ?? {
      sectionTitle: "Industry Market Overview",
      fieldDescription: "The market category",
      isEditable: true,
      originalValue: "Test category",
    },
    embedding: overrides?.embedding ?? [],
    similarity: overrides?.similarity,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("retrieveRelevantChunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("happy path", () => {
    it("should return chunks from mocked Supabase RPC", async () => {
      // Arrange
      const mockChunks = [
        createMockChunkRow({ content: "Chunk 1 content", similarity: 0.9 }),
        createMockChunkRow({ content: "Chunk 2 content", similarity: 0.85 }),
      ];
      mockSupabaseClient.rpc.mockResolvedValue({ data: mockChunks, error: null });

      // Act
      const result = await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "What is the market category?",
      });

      // Assert
      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0].content).toBe("Chunk 1 content");
      expect(result.chunks[1].content).toBe("Chunk 2 content");
    });

    it("should map chunks from snake_case to camelCase", async () => {
      // Arrange
      const mockChunk = createMockChunkRow({
        field_path: "categorySnapshot.market",
        content_type: "string",
      });
      mockSupabaseClient.rpc.mockResolvedValue({ data: [mockChunk], error: null });

      // Act
      const result = await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "market info",
      });

      // Assert
      expect(result.chunks[0].fieldPath).toBe("categorySnapshot.market");
      expect(result.chunks[0].contentType).toBe("string");
    });

    it("should include similarity scores in results", async () => {
      // Arrange
      const mockChunks = [
        createMockChunkRow({ similarity: 0.92 }),
        createMockChunkRow({ similarity: 0.78 }),
      ];
      mockSupabaseClient.rpc.mockResolvedValue({ data: mockChunks, error: null });

      // Act
      const result = await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "competitors",
      });

      // Assert
      expect(result.chunks[0].similarity).toBe(0.92);
      expect(result.chunks[1].similarity).toBe(0.78);
    });

    it("should respect matchThreshold parameter", async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "test query",
        matchThreshold: 0.9,
      });

      // Assert
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "match_blueprint_chunks",
        expect.objectContaining({
          match_threshold: 0.9,
        })
      );
    });

    it("should respect matchCount parameter", async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "test query",
        matchCount: 10,
      });

      // Assert
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "match_blueprint_chunks",
        expect.objectContaining({
          match_count: 10,
        })
      );
    });

    it("should filter by section when sectionFilter provided", async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "competitor info",
        sectionFilter: "competitorAnalysis",
      });

      // Assert
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "match_blueprint_chunks",
        expect.objectContaining({
          section_filter: "competitorAnalysis",
        })
      );
    });

    it("should generate embedding for the query", async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "What are the main competitors?",
      });

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalledWith("What are the main competitors?");
    });

    it("should return embedding cost estimate", async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      const result = await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "Short query",
      });

      // Assert
      expect(result.embeddingCost).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("should throw meaningful error when RPC fails", async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      // Act & Assert
      await expect(
        retrieveRelevantChunks({
          blueprintId: "test-blueprint-id",
          query: "test query",
        })
      ).rejects.toThrow("Retrieval failed: Database connection failed");
    });

    it("should handle empty results gracefully", async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      const result = await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "obscure query with no matches",
      });

      // Assert
      expect(result.chunks).toEqual([]);
      expect(result.embeddingCost).toBeGreaterThan(0);
    });

    it("should handle null data from RPC", async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      // Act
      const result = await retrieveRelevantChunks({
        blueprintId: "test-blueprint-id",
        query: "test query",
      });

      // Assert
      expect(result.chunks).toEqual([]);
    });
  });
});

describe("buildContextFromChunks", () => {
  it("should build formatted context string from chunks", () => {
    // Arrange
    const chunks: BlueprintChunk[] = [
      createMockBlueprintChunk({
        content: "The target market is small business owners.",
        similarity: 0.92,
        metadata: {
          sectionTitle: "Industry Market Overview",
          fieldDescription: "Target market definition",
          isEditable: true,
          originalValue: "Small business owners",
        },
      }),
    ];

    // Act
    const context = buildContextFromChunks(chunks);

    // Assert
    expect(context).toContain("[1]");
    expect(context).toContain("Industry Market Overview");
    expect(context).toContain("Target market definition");
    expect(context).toContain("The target market is small business owners.");
  });

  it("should include relevance percentage in context", () => {
    // Arrange
    const chunks: BlueprintChunk[] = [
      createMockBlueprintChunk({
        content: "Test content",
        similarity: 0.85,
      }),
    ];

    // Act
    const context = buildContextFromChunks(chunks);

    // Assert
    expect(context).toContain("(relevance: 85%)");
  });

  it("should return 'No relevant context' for empty chunks", () => {
    // Arrange
    const chunks: BlueprintChunk[] = [];

    // Act
    const context = buildContextFromChunks(chunks);

    // Assert
    expect(context).toBe("No relevant context found in the blueprint.");
  });

  it("should handle chunks without similarity scores", () => {
    // Arrange
    const chunks: BlueprintChunk[] = [
      createMockBlueprintChunk({
        content: "Content without similarity",
        similarity: undefined,
      }),
    ];

    // Act
    const context = buildContextFromChunks(chunks);

    // Assert
    expect(context).toContain("[1]");
    expect(context).toContain("Content without similarity");
    expect(context).not.toContain("relevance:");
  });

  it("should format multiple chunks with correct numbering", () => {
    // Arrange
    const chunks: BlueprintChunk[] = [
      createMockBlueprintChunk({ content: "First chunk", similarity: 0.9 }),
      createMockBlueprintChunk({ content: "Second chunk", similarity: 0.85 }),
      createMockBlueprintChunk({ content: "Third chunk", similarity: 0.8 }),
    ];

    // Act
    const context = buildContextFromChunks(chunks);

    // Assert
    expect(context).toContain("[1]");
    expect(context).toContain("[2]");
    expect(context).toContain("[3]");
    expect(context).toContain("First chunk");
    expect(context).toContain("Second chunk");
    expect(context).toContain("Third chunk");
  });

  it("should separate chunks with double newlines", () => {
    // Arrange
    const chunks: BlueprintChunk[] = [
      createMockBlueprintChunk({ content: "Chunk A" }),
      createMockBlueprintChunk({ content: "Chunk B" }),
    ];

    // Act
    const context = buildContextFromChunks(chunks);

    // Assert
    expect(context).toContain("\n\n");
  });
});
