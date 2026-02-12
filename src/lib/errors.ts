// Structured error types for API responses
// Provides consistent error codes, messages, and retryability flags

/**
 * Error codes for API responses.
 * These codes enable frontend handling and debugging.
 */
export enum ErrorCode {
  TIMEOUT = "TIMEOUT",
  RATE_LIMITED = "RATE_LIMITED",
  CIRCUIT_OPEN = "CIRCUIT_OPEN",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  PARSE_ERROR = "PARSE_ERROR",
  API_ERROR = "API_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Structured error response for API endpoints.
 * Provides consistent format for error handling.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
    retryable: boolean;
    section?: string;
    completedSections?: string[];
  };
}

/**
 * Options for creating an error response.
 */
export interface CreateErrorOptions {
  details?: string;
  section?: string;
  completedSections?: string[];
}

/**
 * Error codes that indicate the request can be retried.
 */
const RETRYABLE_CODES = new Set([
  ErrorCode.TIMEOUT,
  ErrorCode.RATE_LIMITED,
  ErrorCode.CIRCUIT_OPEN,
]);

/**
 * Create a structured error response.
 * Automatically determines retryability based on error code.
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  options: CreateErrorOptions = {}
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      retryable: RETRYABLE_CODES.has(code),
      ...(options.details && { details: options.details }),
      ...(options.section && { section: options.section }),
      ...(options.completedSections && { completedSections: options.completedSections }),
    },
  };
}

/**
 * Failure reason values from the generator.
 */
export type FailureReason = "timeout" | "circuit_open" | "validation" | "api_error" | "unknown";

/**
 * Map internal failure reasons to ErrorCode.
 * Used to convert generator metadata to API response codes.
 */
export function mapFailureReasonToCode(failureReason: FailureReason | undefined): ErrorCode {
  switch (failureReason) {
    case "timeout":
      return ErrorCode.TIMEOUT;
    case "circuit_open":
      return ErrorCode.CIRCUIT_OPEN;
    case "validation":
      return ErrorCode.VALIDATION_FAILED;
    case "api_error":
      return ErrorCode.API_ERROR;
    case "unknown":
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Get the appropriate HTTP status code for an ErrorCode.
 */
export function getHttpStatusForCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.INVALID_INPUT:
      return 400;
    case ErrorCode.TIMEOUT:
    case ErrorCode.RATE_LIMITED:
    case ErrorCode.CIRCUIT_OPEN:
      return 503;
    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.PARSE_ERROR:
    case ErrorCode.API_ERROR:
      return 502;
    case ErrorCode.INTERNAL_ERROR:
    default:
      return 500;
  }
}
