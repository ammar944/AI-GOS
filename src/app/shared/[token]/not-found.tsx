import Link from 'next/link';

export default function SharedSessionNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
          <svg
            className="w-6 h-6 text-[var(--text-quaternary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.505a4.5 4.5 0 00-6.364-6.364L4.26 8.066"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Shared session not found
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            This link may have been removed or is invalid.
          </p>
        </div>
        <Link
          href="/research-v2"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-opacity hover:opacity-90 cursor-pointer bg-[var(--accent-green)] text-white"
        >
          Create Your Own
        </Link>
      </div>
    </div>
  );
}
