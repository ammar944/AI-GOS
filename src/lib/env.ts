// Environment Variable Validation Utility
// Provides type-safe access to environment variables and validation

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = {
  // Server-only variables (not prefixed with NEXT_PUBLIC_)
  server: ["OPENROUTER_API_KEY", "SEARCHAPI_KEY"] as const,

  // Public variables (accessible in browser)
  public: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const,
} as const;

/**
 * Optional environment variables
 */
const OPTIONAL_ENV_VARS = {
  // Server-only optional variables
  server: [
    "FOREPLAY_API_KEY",     // Foreplay API key for creative intelligence
    "ENABLE_FOREPLAY",      // Feature flag to enable Foreplay enrichment (true/false)
    "FIRECRAWL_API_KEY",    // Firecrawl API key for pricing page scraping
  ] as const,
  public: ["NEXT_PUBLIC_APP_URL"] as const,
} as const;

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validates that all required environment variables are set
 * @returns Validation result with missing variables and warnings
 */
export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check server-only required variables
  for (const key of REQUIRED_ENV_VARS.server) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    }
  }

  // Check public required variables
  for (const key of REQUIRED_ENV_VARS.public) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    }
  }

  // Check optional public variables and warn if missing
  for (const key of OPTIONAL_ENV_VARS.public) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      warnings.push(`Optional environment variable ${key} is not set`);
    }
  }

  // Check optional server variables (info only, not warnings)
  for (const key of OPTIONAL_ENV_VARS.server) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      // These are truly optional features, just log for info
      if (process.env.NODE_ENV === 'development') {
        console.info(`[ENV] Optional: ${key} is not set (feature disabled)`);
      }
    }
  }

  // Log warnings if any
  if (warnings.length > 0) {
    console.warn("Environment validation warnings:", warnings);
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get an environment variable value with type safety
 * @param key - The environment variable key
 * @returns The value or undefined if not set
 */
export function getEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() !== "" ? value : undefined;
}

/**
 * Get a required environment variable value, throwing if not set
 * @param key - The environment variable key
 * @returns The value
 * @throws Error if the variable is not set or empty
 */
export function getRequiredEnv(key: string): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Check if a specific environment variable is set
 * @param key - The environment variable key
 * @returns true if set and non-empty, false otherwise
 */
export function hasEnv(key: string): boolean {
  return getEnv(key) !== undefined;
}
