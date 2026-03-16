import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Research not found</h2>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          This research session doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-[var(--accent-blue)] hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
