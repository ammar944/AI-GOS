import { type IntegrationDefinition } from "./registry";

export interface ProbeResult {
  reachable: boolean;
  latencyMs: number;
  error?: string;
}

export function checkEnvVars(
  def: IntegrationDefinition
): { key: string; set: boolean }[] {
  return def.envVars.map((key) => ({
    key,
    set: !!process.env[key]?.trim(),
  }));
}

export async function probeIntegration(
  def: IntegrationDefinition
): Promise<ProbeResult> {
  if (def.probeType === "env-only") {
    return { reachable: true, latencyMs: 0 };
  }

  const start = Date.now();

  try {
    if (def.probeType === "supabase") {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { error } = await supabase
        .from("journey_sessions")
        .select("id")
        .limit(1);

      if (error) throw new Error(error.message);
      return { reachable: true, latencyMs: Date.now() - start };
    }

    if (def.probeType === "http") {
      let url = def.probeUrl;
      if (def.slug === "railway") {
        const workerUrl = process.env.RAILWAY_WORKER_URL?.trim();
        if (!workerUrl) throw new Error("RAILWAY_WORKER_URL not set");
        url = `${workerUrl.replace(/\/$/, "")}/health`;
      }
      if (!url) throw new Error("No probe URL configured");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { reachable: true, latencyMs: Date.now() - start };
      } finally {
        clearTimeout(timeout);
      }
    }

    return { reachable: false, latencyMs: 0, error: "Unknown probe type" };
  } catch (err) {
    return {
      reachable: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
