// Health Check Endpoint
// GET /api/health
// Returns application health status and environment validation

import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/env";

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
  checks: {
    environment: {
      status: "ok" | "error";
      missing?: string[];
    };
  };
}

export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const timestamp = new Date().toISOString();
  const version = "0.1.0"; // From package.json

  // Validate environment variables
  const envValidation = validateEnv();

  const checks = {
    environment: {
      status: envValidation.valid ? ("ok" as const) : ("error" as const),
      ...(envValidation.missing.length > 0 && {
        missing: envValidation.missing,
      }),
    },
  };

  // Determine overall status
  let status: "ok" | "degraded" | "error";
  if (!envValidation.valid) {
    status = "error";
  } else if (envValidation.warnings.length > 0) {
    status = "degraded";
  } else {
    status = "ok";
  }

  // Return 503 for error status, 200 for ok/degraded
  const httpStatus = status === "error" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      timestamp,
      version,
      checks,
    },
    { status: httpStatus }
  );
}
