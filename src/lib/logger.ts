// Lightweight structured logging utility
// Provides JSON-formatted logs with request context for debugging

import { ErrorCode } from "./errors";

/**
 * Context included with all log entries.
 */
export interface LogContext {
  requestId?: string;
  route: string;
  method: string;
  timestamp: string;
  duration?: number;
  errorCode?: ErrorCode;
  section?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generate a unique request ID.
 * Uses crypto.randomUUID if available, falls back to timestamp + random.
 */
export function createRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Log an error with full context.
 * Outputs JSON-formatted log to console.error.
 */
export function logError(context: LogContext, error: Error | string): void {
  const errorInfo =
    error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : { message: error };

  console.error(
    `[ERROR] ${JSON.stringify({
      ...context,
      error: errorInfo,
    })}`
  );
}

/**
 * Log an info message with context.
 * Outputs JSON-formatted log to console.log.
 */
export function logInfo(
  context: Omit<LogContext, "errorCode">,
  message: string
): void {
  console.log(
    `[INFO] ${JSON.stringify({
      ...context,
      message,
    })}`
  );
}

/**
 * Log a warning with context.
 * Used for slow sections, retries, and other non-critical issues.
 */
export function logWarn(context: LogContext, message: string): void {
  console.warn(
    `[WARN] ${JSON.stringify({
      ...context,
      message,
    })}`
  );
}

/**
 * Create a base log context for an API request.
 * Call at the start of request handling.
 */
export function createLogContext(route: string, method: string): LogContext {
  return {
    requestId: createRequestId(),
    route,
    method,
    timestamp: new Date().toISOString(),
  };
}
