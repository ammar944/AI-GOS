// Authentication error handling utilities

import { NextResponse } from "next/server";

/**
 * Standard error response for unauthorized requests
 */
export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json(
    {
      error: "UNAUTHORIZED",
      message,
    },
    { status: 401 }
  );
}

/**
 * Standard error response for forbidden requests
 */
export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json(
    {
      error: "FORBIDDEN",
      message,
    },
    { status: 403 }
  );
}

/**
 * Check if an error is a Supabase RLS policy violation
 */
export function isRLSError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    // Supabase RLS violations typically return these codes
    return code === "42501" || code === "PGRST301";
  }
  return false;
}

/**
 * Handle Supabase errors with appropriate HTTP responses
 */
export function handleSupabaseError(error: unknown) {
  console.error("[Supabase Error]", error);

  if (isRLSError(error)) {
    return forbiddenResponse("Access denied by security policy");
  }

  // Generic database error
  return NextResponse.json(
    {
      error: "DATABASE_ERROR",
      message: "A database error occurred",
    },
    { status: 500 }
  );
}

/**
 * Type guard to check if auth result has a userId
 */
export function requireAuth(auth: { userId: string | null }): auth is { userId: string } {
  return auth.userId !== null;
}
