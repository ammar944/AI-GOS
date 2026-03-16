import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { INTEGRATIONS } from "@/lib/integrations/registry";
import { checkEnvVars, probeIntegration } from "@/lib/integrations/probes";

export const dynamic = "force-dynamic";

interface IntegrationStatus {
  name: string;
  slug: string;
  tier: "required" | "research" | "paid-media" | "enrichment";
  purpose: string;
  configured: boolean;
  reachable: boolean | null;
  latencyMs: number | null;
  envVars: { key: string; set: boolean }[];
}

interface IntegrationsHealthResponse {
  status: "all-healthy" | "degraded" | "critical";
  timestamp: string;
  integrations: IntegrationStatus[];
}

export async function GET(): Promise<
  NextResponse<IntegrationsHealthResponse | { error: string }>
> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled(
    INTEGRATIONS.map(async (def) => {
      const envVars = checkEnvVars(def);
      const configured =
        def.envVars.length === 0 || envVars.every((v) => v.set);

      let reachable: boolean | null = null;
      let latencyMs: number | null = null;

      if (configured && def.probeType !== "env-only") {
        const probe = await probeIntegration(def);
        reachable = probe.reachable;
        latencyMs = probe.latencyMs;
      }

      return {
        name: def.name,
        slug: def.slug,
        tier: def.tier,
        purpose: def.purpose,
        configured,
        reachable,
        latencyMs,
        envVars,
      } satisfies IntegrationStatus;
    })
  );

  const integrations = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          name: "Unknown",
          slug: "unknown",
          tier: "enrichment" as const,
          purpose: "",
          configured: false,
          reachable: null,
          latencyMs: null,
          envVars: [],
        }
  );

  const requiredMissing = integrations.some(
    (i) => i.tier === "required" && !i.configured
  );
  const anyMissing = integrations.some((i) => !i.configured);

  let status: "all-healthy" | "degraded" | "critical";
  if (requiredMissing) {
    status = "critical";
  } else if (anyMissing) {
    status = "degraded";
  } else {
    status = "all-healthy";
  }

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    integrations,
  });
}
