"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { IntegrationStatus } from "./integrations-dashboard";

type IntegrationCardProps = IntegrationStatus;

function StatusDot({
  configured,
  reachable,
}: Pick<IntegrationStatus, "configured" | "reachable">) {
  if (!configured) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
        <span className="inline-block w-2 h-2 rounded-full bg-red-400 shrink-0" />
        Not Configured
      </span>
    );
  }
  if (reachable === true) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        Connected
      </span>
    );
  }
  if (reachable === false) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
        <span className="inline-block w-2 h-2 rounded-full bg-red-400 shrink-0" />
        Unreachable
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
      Configured
    </span>
  );
}

export function IntegrationCard({
  name,
  purpose,
  configured,
  reachable,
  latencyMs,
  envVars,
}: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl backdrop-blur-sm",
        "transition-colors duration-150",
        expanded && "border-[var(--border-default)]"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between p-4 text-left group"
        aria-expanded={expanded}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-white truncate">
            {name}
          </span>
          <span className="text-xs text-[var(--text-tertiary)] truncate">{purpose}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          {latencyMs !== null && (
            <span className="hidden sm:inline-block text-xs font-mono text-[var(--text-quaternary)] bg-[var(--bg-hover)] border border-[var(--border-default)] rounded-full px-2 py-0.5">
              {latencyMs}ms
            </span>
          )}
          <StatusDot configured={configured} reachable={reachable} />
          <svg
            className={cn(
              "w-4 h-4 text-[var(--text-quaternary)] transition-transform duration-200 group-hover:text-[var(--text-secondary)]",
              expanded && "rotate-180"
            )}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4 border-t border-[var(--border-default)] pt-3 space-y-2">
          <p className="text-xs text-[var(--text-quaternary)] uppercase tracking-wider font-medium mb-2">
            Environment Variables
          </p>
          {envVars.length === 0 ? (
            <p className="text-xs text-[var(--text-quaternary)] italic">
              No API key required (public API)
            </p>
          ) : (
            envVars.map((v) => (
              <div key={v.key} className="flex items-center justify-between">
                <span className="text-xs font-mono text-[var(--text-secondary)]">
                  {v.key}
                </span>
                {v.set ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 8l4 4 6-6" />
                    </svg>
                    Set
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                    Missing
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
