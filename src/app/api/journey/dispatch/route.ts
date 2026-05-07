// Direct research dispatch — frontend-driven pipeline.
// Frontend calls this when a Journey research section or the one-pass Deep
// Research Program needs to start. The route stays thin; all run stamping,
// context enrichment, and worker dispatch live in the shared server service.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  dispatchJourneyResearchForUser,
  getJourneyResearchTool,
} from '@/lib/journey/server/dispatch-research';

export {
  DISPATCH_PIPELINE_ORDER,
  normalizeWikiEntries,
  summarizeForSynthesis,
} from '@/lib/journey/server/dispatch-research';

interface JourneyDispatchRequest {
  section?: unknown;
  runId?: unknown;
  context?: unknown;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as JourneyDispatchRequest;
  const section = readString(body.section);
  const context = readString(body.context);
  const runId = readString(body.runId);

  if (!section || !context) {
    return NextResponse.json(
      { error: 'Missing required fields: section, context' },
      { status: 400 },
    );
  }

  if (!getJourneyResearchTool(section)) {
    return NextResponse.json(
      { error: `Unknown section: ${section}` },
      { status: 400 },
    );
  }

  const result = await dispatchJourneyResearchForUser({
    userId,
    section,
    runId,
    context,
  });

  return NextResponse.json(result);
}
