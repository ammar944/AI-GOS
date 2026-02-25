import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <Loader2
        className="w-7 h-7 animate-spin"
        style={{ color: "var(--accent-blue)" }}
        strokeWidth={1.75}
      />
      <p
        className="text-sm font-medium"
        style={{ color: "var(--text-tertiary)" }}
      >
        Loading...
      </p>
    </div>
  );
}
