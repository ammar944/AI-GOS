"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 flex flex-col items-center gap-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
        {/* Icon */}
        <div
          className="flex items-center justify-center w-14 h-14 rounded-full"
          style={{ backgroundColor: "rgba(239,68,68,0.10)" }}
        >
          <AlertTriangle
            className="w-7 h-7"
            style={{ color: "var(--error)" }}
            strokeWidth={1.75}
          />
        </div>

        {/* Heading */}
        <div className="text-center flex flex-col gap-2">
          <h1
            className="text-xl font-semibold font-heading tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Something went wrong
          </h1>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            An unexpected error occurred. You can try again or return to the
            dashboard.
          </p>
        </div>

        {/* Collapsible error detail */}
        <details
          className="w-full rounded-lg overflow-hidden group"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
          }}
        >
          <summary
            className={cn(
              "px-4 py-3 text-xs font-medium cursor-pointer select-none list-none",
              "flex items-center justify-between gap-2"
            )}
            style={{ color: "var(--text-tertiary)" }}
          >
            <span>Error details</span>
            <span className="text-[10px] opacity-60">click to expand</span>
          </summary>
          <div
            className="px-4 pb-4 pt-2 font-mono text-xs leading-relaxed break-all"
            style={{ color: "var(--text-secondary)" }}
          >
            {error.message || "An unknown error occurred."}
            {error.digest && (
              <p
                className="mt-3 pt-3 text-[10px]"
                style={{
                  color: "var(--text-tertiary)",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                Digest: {error.digest}
              </p>
            )}
          </div>
        </details>

        {/* Actions */}
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={reset}
            className={cn(
              "flex-1 h-10 rounded-full text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80",
              "text-white"
            )}
            style={{ backgroundColor: "var(--accent-blue)" }}
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className={cn(
              "flex-1 h-10 rounded-full text-sm font-medium transition-colors",
              "flex items-center justify-center"
            )}
            style={{
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
