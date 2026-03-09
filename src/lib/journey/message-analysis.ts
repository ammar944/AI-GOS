import type { UIMessage } from 'ai';
import { normalizeResearchSectionId } from '@/lib/journey/research-sections';

export type ResearchStreamingEntry = {
  text: string;
  status: 'running' | 'complete' | 'error';
  startedAt?: number;
};

export interface PendingAskUserPrompt {
  toolCallId: string;
  fieldName: string;
}

export interface AnalyzeJourneyMessagesOptions {
  researchStreaming?: Record<string, ResearchStreamingEntry>;
  invalidatedResearchSections?: string[];
}

export interface JourneyMessageAnalysis {
  sectionStatuses: Record<string, 'queued' | 'running' | 'complete' | 'error'>;
  completedResearchOutputCounts: Record<string, number>;
  pendingAskUser: PendingAskUserPrompt | null;
  hasPendingApproval: boolean;
}

export function analyzeJourneyMessages(
  messages: UIMessage[],
  options: AnalyzeJourneyMessagesOptions = {},
): JourneyMessageAnalysis {
  const sectionStatuses: Record<string, 'queued' | 'running' | 'complete' | 'error'> = {};
  const completedResearchOutputCounts: Record<string, number> = {};
  let pendingAskUser: PendingAskUserPrompt | null = null;
  let hasPendingApproval = false;

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;

    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const record = part as Record<string, unknown>;
      const type = typeof record.type === 'string' ? record.type : '';
      const state = typeof record.state === 'string' ? record.state : '';

      if (
        pendingAskUser == null &&
        type === 'tool-askUser' &&
        state === 'input-available'
      ) {
        const input = record.input as { fieldName?: string } | undefined;
        pendingAskUser = {
          toolCallId: typeof record.toolCallId === 'string' ? record.toolCallId : '',
          fieldName: input?.fieldName ?? 'unknown',
        };
      }

      if (
        !hasPendingApproval &&
        type.startsWith('tool-') &&
        type !== 'tool-askUser' &&
        (state === 'approval-requested' || state === 'input-available')
      ) {
        hasPendingApproval = true;
      }

      if (type !== 'tool-generateResearch') continue;

      let outputStatus: string | undefined;
      let outputSectionId: string | undefined;
      if (typeof record.output === 'string') {
        try {
          const parsed = JSON.parse(record.output) as { status?: string; sectionId?: string };
          outputStatus = parsed.status;
          outputSectionId = parsed.sectionId;
        } catch {
          outputStatus = undefined;
        }
      } else if (typeof record.output === 'object' && record.output != null) {
        outputStatus = (record.output as { status?: string }).status;
        outputSectionId = (record.output as { sectionId?: string }).sectionId;
      }

      const sectionId = normalizeResearchSectionId(
        outputSectionId ??
          (record.input as { sectionId?: string } | undefined)?.sectionId,
      );

      if (!sectionId) continue;

      if (state === 'output-available' && outputStatus === 'error') {
        sectionStatuses[sectionId] = 'error';
      } else if (state === 'output-available') {
        sectionStatuses[sectionId] = 'complete';
        completedResearchOutputCounts[sectionId] =
          (completedResearchOutputCounts[sectionId] ?? 0) + 1;
      } else if (state === 'output-error') {
        sectionStatuses[sectionId] = 'error';
      } else if (sectionStatuses[sectionId] !== 'complete') {
        sectionStatuses[sectionId] = 'running';
      }
    }
  }

  for (const [sectionId, streaming] of Object.entries(options.researchStreaming ?? {})) {
    if (streaming.status === 'complete') {
      sectionStatuses[sectionId] = 'complete';
    } else if (streaming.status === 'error') {
      sectionStatuses[sectionId] = 'error';
    } else if (sectionStatuses[sectionId] !== 'complete') {
      sectionStatuses[sectionId] = 'running';
    }
  }

  for (const sectionId of options.invalidatedResearchSections ?? []) {
    if (sectionStatuses[sectionId] !== 'running') {
      sectionStatuses[sectionId] = 'queued';
    }
  }

  return {
    sectionStatuses,
    completedResearchOutputCounts,
    pendingAskUser,
    hasPendingApproval,
  };
}
