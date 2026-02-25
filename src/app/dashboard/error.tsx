"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div
      className={cn(
        "min-h-[60vh] flex items-center justify-center",
        "bg-[var(--bg-base)]"
      )}
    >
      <div className="flex flex-col items-center gap-6 text-center max-w-md px-6">
        {/* Icon */}
        <div className="flex size-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
          <AlertTriangle className="size-6 text-red-400" strokeWidth={1.5} />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h2 className="text-xl font-medium tracking-tight text-[var(--text-primary)]">
            Dashboard Error
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            We couldn&apos;t load your dashboard. This might be a temporary issue.
          </p>
        </div>

        {/* Collapsible error detail */}
        {error.message && (
          <details className="w-full text-left">
            <summary className="cursor-pointer select-none text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
              Show error detail
            </summary>
            <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
              <p className="break-words font-mono text-xs leading-relaxed text-[var(--text-tertiary)]">
                {error.message}
              </p>
              {error.digest && (
                <p className="mt-1.5 font-mono text-xs text-[var(--text-tertiary)]/60">
                  digest: {error.digest}
                </p>
              )}
            </div>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-[var(--accent-blue)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-[var(--border-default)] px-6 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-white/20 hover:text-[var(--text-primary)]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
