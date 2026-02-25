import { Loader2 } from "lucide-react"

export default function GenerateLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-blue)]" />
        <p className="text-[var(--text-tertiary)] text-sm">Preparing generation...</p>
      </div>
    </div>
  )
}
