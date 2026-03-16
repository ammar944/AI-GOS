import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { parseResearchToCards, resetCardIdCounter } from '@/lib/workspace/card-taxonomy';
import { SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { ResearchDocument } from '@/components/research/research-document';
import type { SectionKey, CardState } from '@/lib/workspace/types';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ResearchPage({ params }: PageProps) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id, research_results, created_at, collected_fields')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) notFound();

  const researchResults = data.research_results as Record<
    string,
    { status?: string; data?: Record<string, unknown> }
  > | null;

  if (!researchResults) redirect('/dashboard');

  // Parse research results into cards per section
  resetCardIdCounter();
  const cardsBySection: Record<string, CardState[]> = {};
  const availableSections: SectionKey[] = [];

  for (const section of SECTION_PIPELINE) {
    const sectionResult = researchResults[section];
    if (sectionResult?.status === 'complete' && sectionResult.data) {
      const cards = parseResearchToCards(section, sectionResult.data);
      cardsBySection[section] = cards;
      availableSections.push(section);
    }
  }

  if (availableSections.length === 0) redirect('/dashboard');

  const fields = data.collected_fields as Record<string, unknown> | null;
  const title =
    (fields?.companyName as string) ??
    (fields?.url as string) ??
    'Research Document';

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="no-print">
        <AppSidebar />
      </div>
      <main className="flex-1 min-h-0">
        <ResearchDocument
          cardsBySection={cardsBySection}
          availableSections={availableSections}
          title={title}
          createdAt={data.created_at}
        />
      </main>
    </div>
  );
}
