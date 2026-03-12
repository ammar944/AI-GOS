import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { JourneyResearchSandbox } from '@/components/journey/journey-research-sandbox';
import { isJourneyResearchSandboxEnabled } from '@/lib/journey/research-sandbox';

export default async function JourneyResearchSandboxPage() {
  if (!isJourneyResearchSandboxEnabled()) {
    notFound();
  }

  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=/test/journey-research');
  }

  return <JourneyResearchSandbox liveUserId={userId} />;
}
