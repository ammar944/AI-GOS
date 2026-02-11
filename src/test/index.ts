/**
 * Test Utilities Barrel Export
 *
 * Central export point for all test utilities, mocks, and helpers.
 *
 * Usage:
 *   import { createTestFormData, createMockSupabaseClient } from "@/test";
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
// Supabase Mocks
// =============================================================================

export {
  // Mock client and factory
  MockSupabaseClient,
  createMockSupabaseClient,
  createSupabaseClientMock,
  // Data factories
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
