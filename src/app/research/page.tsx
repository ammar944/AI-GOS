import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileText, ArrowRight, Plus } from 'lucide-react';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { getCompletedJourneySessions } from '@/lib/actions/journey-sessions';
import { RESEARCH_SECTIONS } from '@/lib/workspace/pipeline';
import { DeleteSessionButton } from '@/components/research/delete-session-button';

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

export default async function ResearchListPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { data: sessions } = await getCompletedJourneySessions();

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl w-full px-8 py-10">
          {/* Page header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
                Research
              </h1>
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                Your completed research sessions
              </p>
            </div>
            <Link href="/journey">
              <button className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-foreground text-background text-[13px] font-semibold px-5 h-9 transition-all hover:bg-foreground/90">
                <Plus className="size-3.5" />
                New Research
              </button>
            </Link>
          </div>

          {/* Session list */}
          {(!sessions || sessions.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center mb-4">
                <FileText className="size-6 text-[var(--text-quaternary)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-secondary)]">No research yet</h3>
              <p className="mt-1 text-sm text-[var(--text-quaternary)] max-w-xs">
                Start a journey to generate your first research document.
              </p>
              <Link href="/journey" className="mt-6">
                <button className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-foreground text-background text-[13px] font-semibold px-5 h-9 transition-all hover:bg-foreground/90">
                  Start Journey
                  <ArrowRight className="size-3.5" />
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {sessions.map((session) => {
                const completedCount = session.completedSections.length;
                const totalCount = RESEARCH_SECTIONS.length;
                const isComplete = completedCount >= totalCount;

                return (
                  <div
                    key={session.id}
                    className="group flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-all hover:border-[var(--border-default)] hover:bg-[var(--bg-surface)]"
                  >
                    <Link
                      href={`/research/${session.id}`}
                      className="flex flex-1 items-center gap-4 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
                        <FileText className="size-4 text-[var(--text-quaternary)]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                          {session.title}
                        </h3>
                        <p className="text-[11px] text-[var(--text-quaternary)] mt-0.5 font-mono">
                          {formatDate(session.created_at)}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono ${
                          isComplete
                            ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                            : 'border border-amber-500/25 bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {completedCount}/{totalCount} sections
                      </span>
                      <DeleteSessionButton sessionId={session.id} sessionTitle={session.title} />
                      <Link href={`/research/${session.id}`}>
                        <ArrowRight className="size-4 text-[var(--text-quaternary)] group-hover:text-[var(--text-secondary)] transition-colors" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
