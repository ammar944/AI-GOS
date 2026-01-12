/**
 * Test Utilities
 *
 * Common test helpers and utilities for the AI-GOS test suite.
 */

import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { SAMPLE_ONBOARDING_DATA } from "@/lib/onboarding/types";

// =============================================================================
// React Testing Utilities
// =============================================================================

/**
 * Custom render function that wraps components with necessary providers.
 * Currently a simple wrapper, but can be extended to include:
 * - React Query Provider
 * - Theme Provider
 * - Context Providers
 */
function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  function AllProviders({ children }: { children: React.ReactNode }) {
    // Add providers here as needed
    return React.createElement(React.Fragment, null, children);
  }

  return {
    ...render(ui, { wrapper: AllProviders, ...options }),
  };
}

export { renderWithProviders };

// =============================================================================
// Async Test Utilities
// =============================================================================

/**
 * Wait for a specified duration.
 * Useful for testing async operations with timing requirements.
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to become true.
 * @param condition - Function that returns true when ready
 * @param options - Timeout and interval options
 * @throws Error if condition doesn't become true within timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await waitFor(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Collect all chunks from an async generator into an array.
 */
export async function collectAsyncGenerator<T>(
  generator: AsyncGenerator<T, void, unknown>
): Promise<T[]> {
  const results: T[] = [];
  for await (const item of generator) {
    results.push(item);
  }
  return results;
}

// =============================================================================
// Form Data Factories
// =============================================================================

/**
 * Create test OnboardingFormData with optional overrides.
 * Uses the comprehensive sample data from types.ts as the base.
 */
export function createTestFormData(
  overrides?: Partial<{
    businessBasics: Partial<OnboardingFormData["businessBasics"]>;
    icp: Partial<OnboardingFormData["icp"]>;
    productOffer: Partial<OnboardingFormData["productOffer"]>;
    marketCompetition: Partial<OnboardingFormData["marketCompetition"]>;
    customerJourney: Partial<OnboardingFormData["customerJourney"]>;
    brandPositioning: Partial<OnboardingFormData["brandPositioning"]>;
    assetsProof: Partial<OnboardingFormData["assetsProof"]>;
    budgetTargets: Partial<OnboardingFormData["budgetTargets"]>;
    compliance: Partial<OnboardingFormData["compliance"]>;
  }>
): OnboardingFormData {
  return {
    businessBasics: {
      ...SAMPLE_ONBOARDING_DATA.businessBasics,
      ...overrides?.businessBasics,
    },
    icp: {
      ...SAMPLE_ONBOARDING_DATA.icp,
      ...overrides?.icp,
    },
    productOffer: {
      ...SAMPLE_ONBOARDING_DATA.productOffer,
      ...overrides?.productOffer,
    },
    marketCompetition: {
      ...SAMPLE_ONBOARDING_DATA.marketCompetition,
      ...overrides?.marketCompetition,
    },
    customerJourney: {
      ...SAMPLE_ONBOARDING_DATA.customerJourney,
      ...overrides?.customerJourney,
    },
    brandPositioning: {
      ...SAMPLE_ONBOARDING_DATA.brandPositioning,
      ...overrides?.brandPositioning,
    },
    assetsProof: {
      ...SAMPLE_ONBOARDING_DATA.assetsProof,
      ...overrides?.assetsProof,
    },
    budgetTargets: {
      ...SAMPLE_ONBOARDING_DATA.budgetTargets,
      ...overrides?.budgetTargets,
    },
    compliance: {
      ...SAMPLE_ONBOARDING_DATA.compliance,
      ...overrides?.compliance,
    },
  };
}

/**
 * Create minimal valid OnboardingFormData for quick tests.
 * Contains only required fields with minimal values.
 */
export function createMinimalFormData(): OnboardingFormData {
  return {
    businessBasics: {
      businessName: "Test Company",
      websiteUrl: "https://test.com",
    },
    icp: {
      primaryIcpDescription: "Test ICP",
      industryVertical: "Technology",
      jobTitles: "CTO",
      companySize: "11-50",
      geography: "US",
      easiestToClose: "SMBs",
      buyingTriggers: "Growth",
      bestClientSources: ["referrals"],
    },
    productOffer: {
      productDescription: "Test product",
      coreDeliverables: "Core feature",
      offerPrice: 100,
      pricingModel: "monthly",
      valueProp: "Value",
      currentFunnelType: "lead_form",
    },
    marketCompetition: {
      topCompetitors: "Competitor A",
      uniqueEdge: "Our edge",
      marketBottlenecks: "Market issue",
    },
    customerJourney: {
      situationBeforeBuying: "Pain point",
      desiredTransformation: "Success state",
      commonObjections: "Price concern",
      salesCycleLength: "14_to_30_days",
    },
    brandPositioning: {
      brandPositioning: "Market leader",
    },
    assetsProof: {},
    budgetTargets: {
      monthlyAdBudget: 5000,
      campaignDuration: "ongoing",
    },
    compliance: {},
  };
}

// =============================================================================
// Environment Utilities
// =============================================================================

/**
 * Mock environment variables for a test.
 * Returns a cleanup function to restore original values.
 */
export function mockEnv(
  vars: Record<string, string | undefined>
): () => void {
  const originalValues: Record<string, string | undefined> = {};

  // Store original values and set new ones
  for (const [key, value] of Object.entries(vars)) {
    originalValues[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  // Return cleanup function
  return () => {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

/**
 * Set up mock environment variables using beforeEach/afterEach.
 * Use within describe() block.
 */
export function setupMockEnv(vars: Record<string, string | undefined>): void {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    cleanup = mockEnv(vars);
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that a value is defined (not null or undefined).
 * Provides better TypeScript narrowing than expect().toBeDefined()
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || `Expected value to be defined, got ${value}`);
  }
}

/**
 * Assert that an array has at least one element.
 */
export function assertNonEmpty<T>(
  arr: T[],
  message?: string
): asserts arr is [T, ...T[]] {
  if (arr.length === 0) {
    throw new Error(message || "Expected array to have at least one element");
  }
}

// =============================================================================
// Mock Creation Helpers
// =============================================================================

/**
 * Create a spy for console methods that can be used to verify logging.
 * Auto-restores after each test.
 */
export function spyOnConsole(
  methods: Array<"log" | "warn" | "error" | "info"> = ["log", "warn", "error"]
) {
  const spies: Record<string, ReturnType<typeof vi.spyOn>> = {};

  beforeEach(() => {
    for (const method of methods) {
      spies[method] = vi.spyOn(console, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    for (const spy of Object.values(spies)) {
      spy.mockRestore();
    }
  });

  return {
    get log() {
      return spies.log;
    },
    get warn() {
      return spies.warn;
    },
    get error() {
      return spies.error;
    },
    get info() {
      return spies.info;
    },
  };
}

/**
 * Create a mock fetch function with configurable responses.
 */
export function createMockFetch(defaultResponse?: {
  status?: number;
  ok?: boolean;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}) {
  const mockFetch = vi.fn<typeof fetch>();

  // Set default implementation
  mockFetch.mockResolvedValue({
    ok: defaultResponse?.ok ?? true,
    status: defaultResponse?.status ?? 200,
    json: defaultResponse?.json ?? (() => Promise.resolve({})),
    text: defaultResponse?.text ?? (() => Promise.resolve("")),
    headers: new Headers(),
    redirected: false,
    statusText: "OK",
    type: "basic",
    url: "",
    clone: () => ({} as Response),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  });

  return mockFetch;
}
