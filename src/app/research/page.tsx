import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileText, ArrowRight, Plus } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { UserButton } from '@clerk/nextjs';
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

export default async function ResearchListPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { data: sessions } = await getCompletedJourneySessions();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      {/* Header */}
      <header className="border-b border-white/[0.06] backdrop-blur-xl bg-[var(--bg-base)]/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Link href="/dashboard" className="transition-opacity hover:opacity-80">
            <Logo size="sm" />
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-4xl w-full px-6 py-10">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-white">
              Research
            </h1>
            <p className="mt-1 text-sm text-white/35">
              Your completed research sessions
            </p>
          </div>
          <Link href="/journey">
            <button className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-white text-black text-[13px] font-semibold px-5 h-9 transition-all hover:bg-white/90">
              <Plus className="size-3.5" />
              New Research
            </button>
          </Link>
        </div>

        {/* Session list */}
        {(!sessions || sessions.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
              <FileText className="size-6 text-white/20" />
            </div>
            <h3 className="text-lg font-medium text-white/60">No research yet</h3>
            <p className="mt-1 text-sm text-white/30 max-w-xs">
              Start a journey to generate your first research document.
            </p>
            <Link href="/journey" className="mt-6">
              <button className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-white text-black text-[13px] font-semibold px-5 h-9 transition-all hover:bg-white/90">
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
                <Link
                  key={session.id}
                  href={`/research/${session.id}`}
                  className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/[0.1] hover:bg-white/[0.03] cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                      <FileText className="size-4 text-white/30" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                        {session.title}
                      </h3>
                      <p className="text-[11px] text-white/25 mt-0.5 font-mono">
                        {formatDate(session.created_at)}
                      </p>
                    </div>
                  </div>
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
                    <ArrowRight className="size-4 text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
