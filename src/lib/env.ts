// Environment Variable Validation Utility
// Provides type-safe access to environment variables and validation

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = {
  // Server-only variables (not prefixed with NEXT_PUBLIC_)
  server: ["ANTHROPIC_API_KEY", "SEARCHAPI_KEY"] as const,

  // Public variables (accessible in browser)
  public: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const,
} as const;

// Phase 2 optional vars (add to .env.local when ready):
// GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
// GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
// GOOGLE_ADS_CLIENT_SECRET=your-client-secret
// GOOGLE_ADS_REFRESH_TOKEN=1//your-refresh-token
// GOOGLE_ADS_CUSTOMER_ID=1234567890
// META_ACCESS_TOKEN=EAAxxxxx...
// META_BUSINESS_ACCOUNT_ID=123456789
// GA4_PROPERTY_ID=123456789
// GA4_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":...}

/**
 * Optional environment variables
 */
const OPTIONAL_ENV_VARS = {
  // Server-only optional variables
  server: [
    "PERPLEXITY_API_KEY",   // Perplexity API key for research queries
    "FOREPLAY_API_KEY",     // Foreplay API key for creative intelligence
    "ENABLE_FOREPLAY",      // Feature flag to enable Foreplay enrichment (true/false)
    "FIRECRAWL_API_KEY",    // Firecrawl API key for pricing page scraping
    "GROQ_API_KEY",         // Groq API key for Whisper voice transcription
    // Phase 2: Google Ads API (OAuth2 service account flow)
    "GOOGLE_ADS_DEVELOPER_TOKEN",   // Required by every Google Ads API request
    "GOOGLE_ADS_CLIENT_ID",         // OAuth2 client ID
    "GOOGLE_ADS_CLIENT_SECRET",     // OAuth2 client secret
    "GOOGLE_ADS_REFRESH_TOKEN",     // Long-lived refresh token from OAuth2 consent
    "GOOGLE_ADS_CUSTOMER_ID",       // Default customer ID (10-digit, no dashes)
    // Phase 2: Meta Marketing API (long-lived access token)
    "META_ACCESS_TOKEN",            // System user access token (never expires)
    "META_BUSINESS_ACCOUNT_ID",     // Meta Business Manager account ID
    // Phase 2: Google Analytics 4 Data API (service account JSON)
    "GA4_PROPERTY_ID",              // GA4 property ID (numeric, e.g. "123456789")
    "GA4_SERVICE_ACCOUNT_JSON",     // Full JSON string of service account credentials
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

export interface WorkerUrlValidationResult {
  configured: boolean;
  message?: string;
}

/**
 * Validates that RAILWAY_WORKER_URL is configured.
 * Call this at route cold-start to surface the missing var in deployment logs
 * before a user request hits the dispatch layer and fails silently.
 *
 * @returns { configured: true } if set and non-empty
 * @returns { configured: false, message } with actionable instructions if missing
 */
export function validateWorkerUrl(): WorkerUrlValidationResult {
  const url = process.env.RAILWAY_WORKER_URL?.trim();
  if (url) {
    return { configured: true };
  }
  return {
    configured: false,
    message:
      'RAILWAY_WORKER_URL is not set — all research dispatches will fail silently. ' +
      'Local dev: cd research-worker && npm run dev, then set RAILWAY_WORKER_URL=http://localhost:3001 in .env.local. ' +
      'Production: set RAILWAY_WORKER_URL to your deployed Railway service URL.',
  };
}
