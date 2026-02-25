"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

interface BlueprintErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function BlueprintError({ error, reset }: BlueprintErrorProps) {
  useEffect(() => {
    console.error("[BlueprintError]", error)
  }, [error])

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 flex flex-col items-center gap-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold font-heading text-[var(--text-primary)]">
            Error Loading Blueprint
          </h1>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            We couldn&apos;t load this blueprint. It may have been deleted or you may not have access.
          </p>
        </div>

        <details className="w-full text-left">
          <summary className="cursor-pointer text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition select-none">
            Error details
          </summary>
          <div className="mt-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-tertiary)] font-mono break-all">
              {error.message || "An unexpected error occurred"}
            </p>
          </div>
        </details>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            onClick={reset}
            className="w-full sm:w-auto bg-[var(--accent-blue)] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-90 transition"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto text-center border border-[var(--border-default)] text-[var(--text-secondary)] rounded-full px-6 py-2.5 text-sm font-medium hover:border-[var(--accent-blue)] transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
