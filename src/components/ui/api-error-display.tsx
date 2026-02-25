"use client";

import { XCircle, RotateCcw, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorCode } from "@/lib/errors";

/**
 * Parsed API error structure for display.
 */
export interface ParsedApiError {
  code?: string;
  message: string;
  details?: string;
  retryable?: boolean;
  section?: string;
  completedSections?: string[];
}

/**
 * Props for the ApiErrorDisplay component.
 */
export interface ApiErrorDisplayProps {
  error: ParsedApiError | string;
  onRetry?: () => void;
  onRetryFromSection?: (section: string) => void;
  onGoBack?: () => void;
}

/**
 * Human-readable messages for each error code.
 */
const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCode.TIMEOUT]: "The request took too long. Try again.",
  [ErrorCode.RATE_LIMITED]: "Service is busy. Please wait a moment and retry.",
  [ErrorCode.CIRCUIT_OPEN]: "Service temporarily unavailable. Retry in a minute.",
  [ErrorCode.VALIDATION_FAILED]: "AI response was malformed. Retrying may help.",
  [ErrorCode.PARSE_ERROR]: "Failed to parse AI response. Try again.",
  [ErrorCode.API_ERROR]: "External service error. Please retry.",
  [ErrorCode.INVALID_INPUT]: "Invalid input provided. Please check your data.",
  [ErrorCode.INTERNAL_ERROR]: "An unexpected error occurred.",
};

/**
 * Get human-readable message for an error code.
 */
function getErrorMessage(code: string | undefined, fallbackMessage: string): string {
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }
  return fallbackMessage;
}

/**
 * Parse an API response into a structured error object.
 * Handles both string errors and structured error responses.
 */
export function parseApiError(
  response: { error?: ParsedApiError | string } | string | null | undefined
): ParsedApiError {
  // Handle null/undefined
  if (!response) {
    return { message: "An unknown error occurred" };
  }

  // Handle string response
  if (typeof response === "string") {
    return { message: response };
  }

  // Handle response object with error property
  if (response.error) {
    if (typeof response.error === "string") {
      return { message: response.error };
    }
    return response.error;
  }

  return { message: "An unknown error occurred" };
}

/**
 * Reusable API error display component with code-aware messaging.
 * Shows error badges, human-readable messages, and action buttons.
 */
export function ApiErrorDisplay({
  error,
  onRetry,
  onRetryFromSection,
  onGoBack,
}: ApiErrorDisplayProps) {
  // Normalize error to ParsedApiError
  const errorObj: ParsedApiError = typeof error === "string" ? { message: error } : error;

  const displayMessage = getErrorMessage(errorObj.code, errorObj.message);
  const showRetry = errorObj.retryable !== false && onRetry;
  const showRetryFromSection = errorObj.section && onRetryFromSection;

  return (
    <Card className="border-2 border-destructive/20">
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>

          {/* Title and Error Code Badge */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">Generation Failed</h2>
            {errorObj.code && (
              <Badge variant="destructive" className="font-mono text-xs">
                {errorObj.code}
              </Badge>
            )}
          </div>

          {/* Human-readable message */}
          <p className="text-muted-foreground">{displayMessage}</p>

          {/* Additional details */}
          {errorObj.details && (
            <div className="w-full rounded-lg bg-muted/50 p-4 text-left">
              <p className="text-sm text-muted-foreground">{errorObj.details}</p>
            </div>
          )}

          {/* Failed at section indicator */}
          {errorObj.section && (
            <div className="w-full rounded-lg bg-destructive/5 p-3 text-left">
              <p className="text-sm">
                <span className="text-muted-foreground">Failed at: </span>
                <Badge variant="outline" className="ml-1 font-mono">
                  {errorObj.section}
                </Badge>
              </p>
            </div>
          )}

          {/* Completed sections */}
          {errorObj.completedSections && errorObj.completedSections.length > 0 && (
            <div className="w-full text-left">
              <p className="text-sm font-medium mb-2">Completed before failure:</p>
              <div className="flex flex-wrap gap-2">
                {errorObj.completedSections.map((section) => (
                  <Badge key={section} variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {section}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 w-full flex-wrap justify-center">
            {onGoBack && (
              <Button variant="outline" onClick={onGoBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            )}

            {showRetryFromSection && (
              <Button variant="secondary" onClick={() => onRetryFromSection(errorObj.section!)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry from {errorObj.section}
              </Button>
            )}

            {showRetry && (
              <Button onClick={onRetry}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
          </div>

          {/* Retryable hint */}
          {errorObj.retryable && (
            <p className="text-xs text-muted-foreground">
              This error is temporary. Retrying may succeed.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
