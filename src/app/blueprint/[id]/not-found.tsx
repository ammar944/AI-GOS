import Link from "next/link"
import { Search } from "lucide-react"

export default function BlueprintNotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 flex flex-col items-center gap-6 text-center">
        <div className="h-16 w-16 rounded-full bg-[var(--accent-blue)]/10 flex items-center justify-center">
          <Search className="h-8 w-8 text-[var(--accent-blue)]" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold font-heading text-[var(--text-primary)]">
            Blueprint Not Found
          </h1>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            This blueprint doesn&apos;t exist or has been removed.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="bg-[var(--accent-blue)] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-90 transition"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
