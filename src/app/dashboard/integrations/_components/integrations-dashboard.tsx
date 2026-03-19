"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { IntegrationCard } from "./integration-card";

export interface IntegrationStatus {
  name: string;
  slug: string;
  tier: "required" | "research" | "paid-media" | "enrichment";
  purpose: string;
  configured: boolean;
  reachable: boolean | null;
  latencyMs: number | null;
  envVars: { key: string; set: boolean }[];
}

export interface IntegrationsHealthResponse {
  status: "all-healthy" | "degraded" | "critical";
  timestamp: string;
  integrations: IntegrationStatus[];
}

const TIER_LABELS: Record<IntegrationStatus["tier"], string> = {
  required: "Core Infrastructure",
  research: "Research Pipeline",
  "paid-media": "Paid Media Data",
  enrichment: "Enrichment & Utilities",
};

const TIER_ORDER: IntegrationStatus["tier"][] = [
  "required",
  "research",
  "paid-media",
  "enrichment",
];

const STATUS_CONFIG = {
  "all-healthy": {
    label: "All systems operational",
    color: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400",
    dot: "bg-emerald-400",
  },
  degraded: {
    label: "Some integrations not configured",
    color: "bg-amber-500/15 border-amber-500/20 text-amber-400",
    dot: "bg-amber-400",
  },
  critical: {
    label: "Critical integrations unavailable",
    color: "bg-red-500/15 border-red-500/20 text-red-400",
    dot: "bg-red-400",
  },
} as const;

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3, 4].map((group) => (
        <div key={group}>
          <div className="h-4 w-40 bg-[var(--bg-hover)] rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((card) => (
              <div
                key={card}
                className="h-20 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IntegrationsDashboard() {
  const [data, setData] = useState<IntegrationsHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/health");
      if (!res.ok) {
        throw new Error(`Health check failed: ${res.status}`);
      }
      const json: IntegrationsHealthResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load health data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const grouped = data
    ? TIER_ORDER.reduce<Record<string, IntegrationStatus[]>>((acc, tier) => {
        const items = data.integrations.filter((i) => i.tier === tier);
        if (items.length > 0) acc[tier] = items;
        return acc;
      }, {})
    : {};

  const statusCfg = data ? STATUS_CONFIG[data.status] : null;

  return (
    <div className="space-y-6">
      {/* Top bar: status banner + refresh */}
      <div className="flex items-center justify-between gap-4">
        {data && statusCfg && (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium",
              statusCfg.color
            )}
          >
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full shrink-0",
                statusCfg.dot,
                data.status === "all-healthy" && "animate-pulse"
              )}
            />
            {statusCfg.label}
          </div>
        )}

        {!data && !loading && <div />}

        <div className="flex items-center gap-3 ml-auto">
          {data?.timestamp && (
            <span className="text-xs text-[var(--text-quaternary)] font-mono hidden sm:block">
              Last check:{" "}
              {new Date(data.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
              "bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-secondary)]",
              "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <svg
              className={cn("w-3.5 h-3.5", loading && "animate-spin")}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M14 8A6 6 0 1 1 8 2" />
              <path d="M8 0l2 2-2 2" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-red-400 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : data ? (
        <div className="space-y-8">
          {TIER_ORDER.filter((tier) => grouped[tier]).map((tier) => (
            <section key={tier}>
              <h2 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
                {TIER_LABELS[tier]}
              </h2>
              <div className="space-y-3">
                {grouped[tier].map((integration) => (
                  <IntegrationCard key={integration.slug} {...integration} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
