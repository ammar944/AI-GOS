/**
 * Test Utilities Barrel Export
 *
 * Central export point for all test utilities, mocks, and helpers.
 *
 * Usage:
 *   import { createMockOpenRouterClient, createTestFormData } from "@/test";
 */

// =============================================================================
// Test Utilities
// =============================================================================

export {
  renderWithProviders,
  waitFor,
  waitForCondition,
  collectAsyncGenerator,
  createTestFormData,
  createMinimalFormData,
  mockEnv,
  setupMockEnv,
  assertDefined,
  assertNonEmpty,
  spyOnConsole,
  createMockFetch,
} from "./utils";

// =============================================================================
// OpenRouter Mocks
// =============================================================================

export {
  // Mock client and factory
  MockOpenRouterClient,
  createMockOpenRouterClient,
  createOpenRouterClientMock,
  // Response factories
  createMockChatResponse,
  createMockJSONResponse,
  createMockEmbeddings,
  createMockCitations,
  createMockSearchResults,
  createMockPerplexityResponse,
  // Error classes (re-exported for convenience)
  TimeoutError,
  APIError,
  // Types
  type MockCallRecord,
  type ChatCallRecord,
  type EmbeddingCallRecord,
  type MockOpenRouterConfig,
} from "./mocks/openrouter";

// =============================================================================
// Supabase Mocks
// =============================================================================

export {
  // Mock client and factory
  MockSupabaseClient,
  createMockSupabaseClient,
  createSupabaseClientMock,
  // Data factories
  createMockUser,
  createMockSession,
  createMockBlueprint,
  createMockBlueprintChunk,
  createMockSharedBlueprint,
  // Error helpers
  mockSupabaseError,
  SUPABASE_ERRORS,
  // Types
  type MockSupabaseConfig,
  type MockQueryResult,
  type MockRpcCall,
  type MockQueryCall,
} from "./mocks/supabase";

// =============================================================================
// Media Plan Pipeline Factories
// =============================================================================

export {
  // Form data factories
  createMockNicheFormData,
  createMockBriefingFormData,
  // Stage output factories
  createMockExtractedData,
  createMockResearchData,
  createMockLogicData,
  createMockMediaPlanBlueprint,
  // Composite helpers
  createMockPipelineInput,
  createMockPipelineStageResults,
} from "./factories/media-plan";
