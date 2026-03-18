import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Compass, FileText, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { getCompletedJourneySessions } from '@/lib/actions/journey-sessions';
import { RESEARCH_SECTIONS } from '@/lib/workspace/pipeline';

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { data: sessions } = await getCompletedJourneySessions();
  const recentSessions = sessions?.slice(0, 5) ?? [];

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl w-full px-8 py-10">
          {/* Welcome header */}
          <div className="mb-10">
            <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-white">
              Command Center
            </h1>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Your strategic marketing intelligence hub
            </p>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            <Link
              href="/journey"
              className="group flex items-center gap-4 rounded-xl border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/[0.04] p-5 transition-all hover:border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/[0.08] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
                <Compass className="size-5 text-[var(--accent-blue)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white group-hover:text-white transition-colors">
                  New Research
                </h3>
                <p className="text-[11px] text-[var(--text-quaternary)] mt-0.5">
                  Start a strategic research session
                </p>
              </div>
              <ArrowRight className="size-4 text-[var(--text-quaternary)] group-hover:text-[var(--accent-blue)] transition-colors shrink-0" />
            </Link>

            <Link
              href="/research"
              className="group flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-all hover:border-white/[0.1] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
                <FileText className="size-5 text-[var(--text-tertiary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                  View Research
                </h3>
                <p className="text-[11px] text-[var(--text-quaternary)] mt-0.5">
                  Browse completed research documents
                </p>
              </div>
              <ArrowRight className="size-4 text-[var(--text-quaternary)] group-hover:text-[var(--text-secondary)] transition-colors shrink-0" />
            </Link>
          </div>

          {/* Recent research sessions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider font-mono">
                Recent Research
              </h2>
              {recentSessions.length > 0 && (
                <Link
                  href="/research"
                  className="text-xs text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 transition-colors"
                >
                  View all
                </Link>
              )}
            </div>

            {recentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-[var(--border-glass)] bg-white/[0.01]">
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center mb-4">
                  <Sparkles className="size-5 text-[var(--text-quaternary)]" />
                </div>
                <h3 className="text-sm font-medium text-[var(--text-tertiary)]">No research yet</h3>
                <p className="mt-1 text-xs text-[var(--text-quaternary)] max-w-xs">
                  Start your first journey to generate a strategic research document.
                </p>
                <Link href="/journey" className="mt-5">
                  <button className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-white text-black text-[13px] font-semibold px-5 h-9 transition-all hover:bg-white/90">
                    <Plus className="size-3.5" />
                    Start Journey
                  </button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-2">
                {recentSessions.map((session) => {
                  const completedCount = session.completedSections.length;
                  const totalCount = RESEARCH_SECTIONS.length;
                  const isComplete = completedCount >= totalCount;

                  return (
                    <Link
                      key={session.id}
                      href={`/research/${session.id}`}
                      className="group flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-all hover:border-white/[0.1] hover:bg-[var(--bg-surface)] cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
                          <FileText className="size-3.5 text-[var(--text-quaternary)]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                            {session.title}
                          </h3>
                          <p className="text-[10px] text-[var(--text-quaternary)] mt-0.5 font-mono">
                            {formatDate(session.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                            isComplete
                              ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                              : 'border border-amber-500/25 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          {completedCount}/{totalCount}
                        </span>
                        <ArrowRight className="size-3.5 text-[var(--text-quaternary)] group-hover:text-[var(--text-tertiary)] transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
