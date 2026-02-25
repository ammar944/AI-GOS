import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        {/* Icon */}
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full"
          style={{ backgroundColor: "rgba(54,94,255,0.10)" }}
        >
          <Compass
            className="w-8 h-8"
            style={{ color: "var(--accent-blue)" }}
            strokeWidth={1.5}
          />
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-3">
          <h1
            className="text-2xl font-semibold font-heading tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Lost in space?
          </h1>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center h-10 px-6 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: "var(--accent-blue)" }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
