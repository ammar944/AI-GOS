import { commitChatPatchAuto } from '@/lib/research-v2/chat-write-through';
import { seedOrchestration } from '@/lib/research-v2/orchestrate-db';
import { STRATEGY_BRIEF_SECTION_ID, type StrategyBriefArtifact } from './schema';

export interface CommitStrategyBriefInput {
  supabase: Parameters<typeof commitChatPatchAuto>[0];
  userId: string;
  runId: string;
  artifact: StrategyBriefArtifact;
}

export async function commitStrategyBrief(
  input: CommitStrategyBriefInput,
): Promise<Awaited<ReturnType<typeof commitChatPatchAuto>>> {
  await seedOrchestration({
    userId: input.userId,
    runId: input.runId,
    zones: [STRATEGY_BRIEF_SECTION_ID],
  });

  return commitChatPatchAuto(input.supabase, {
    userId: input.userId,
    runId: input.runId,
    zone: STRATEGY_BRIEF_SECTION_ID,
    patchedSection: {
      title: input.artifact.sectionTitle,
      markdown: `${input.artifact.verdict}\n\n${input.artifact.statusSummary}`,
      data: input.artifact,
      claims: [],
      sources: input.artifact.sources,
    },
  });
}
