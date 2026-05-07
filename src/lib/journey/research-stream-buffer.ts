import {
  buildJourneyArtifactState,
  type JourneyArtifactSection,
  type JourneyArtifactState,
} from '@/lib/journey/research-artifact-state';

export type ResearchStreamingEntry = {
  text: string;
  status: 'running' | 'complete' | 'error';
  startedAt?: number;
};

export type DeepResearchAgentStepStatus =
  | 'idle'
  | 'running'
  | 'complete'
  | 'partial'
  | 'error';

export type DeepResearchAgentPhase =
  | 'welcome'
  | 'prefilling'
  | 'resume'
  | 'workspace';

export type LinkDeepResearchStatus =
  | 'idle'
  | 'starting'
  | 'queued'
  | 'complete'
  | 'error';

export interface DeepResearchAgentStepDefinition {
  section: string;
  name: string;
  skill: string;
  description: string;
}

export interface DeepResearchProgressUpdate {
  at?: string;
  id?: string;
  message: string;
  phase?: string;
  meta?: unknown;
}

export interface DeepResearchActivityLike {
  jobId?: string;
  section?: string;
  status?: 'running' | 'complete' | 'error';
  tool?: string;
  startedAt?: string;
  completedAt?: string;
  lastHeartbeat?: string;
  error?: string;
  updates?: DeepResearchProgressUpdate[];
}

export interface DeepResearchResultLike {
  status?: 'complete' | 'partial' | 'error' | string;
  section?: string;
  data?: unknown;
  error?: string;
  durationMs?: number;
}

export interface DeepResearchAgentStepView extends DeepResearchAgentStepDefinition {
  status: DeepResearchAgentStepStatus;
  statusMessage: string;
  activity?: DeepResearchActivityLike;
  result?: DeepResearchResultLike | null;
}

export interface DeepResearchReportBlock {
  section: string;
  title: string;
  status: JourneyArtifactSection['status'];
  content: string;
  sourceUrls: string[];
  groundingLabel: string;
}

export interface DeepResearchAgentStreamState {
  hasRunStarted: boolean;
  assistantOpening: string;
  visibleSteps: DeepResearchAgentStepView[];
  bufferedSteps: DeepResearchAgentStepView[];
  hiddenSections: string[];
  artifact: JourneyArtifactState;
  reportBlocks: DeepResearchReportBlock[];
  statusSummary: {
    activeSection: string | null;
    bufferedSections: string[];
    completedSections: string[];
    partialSections: string[];
  };
}

export interface BuildDeepResearchAgentStreamStateOptions {
  activeRunId: string | null;
  deepResearchStatus: LinkDeepResearchStatus;
  phase: DeepResearchAgentPhase;
  researchActivity: Record<string, DeepResearchActivityLike | undefined>;
  researchResults: Record<string, DeepResearchResultLike | null | undefined>;
  activeResearchSections?: ReadonlySet<string>;
}

export const DEEP_RESEARCH_AGENT_STEPS: readonly DeepResearchAgentStepDefinition[] = [
  {
    section: 'deepResearchProgram',
    name: 'Deep Research Agent',
    skill: 'web_search + code_execution',
    description: 'Builds company corpus and usable profile context.',
  },
  {
    section: 'industryMarket',
    name: 'Market Category Agent',
    skill: 'ai-gos-market-category-intelligence',
    description: 'Category, urgency, market motion.',
  },
  {
    section: 'icpValidation',
    name: 'Buyer / ICP Agent',
    skill: 'ai-gos-buyer-icp-validation',
    description: 'Buyer segments, triggers, objections.',
  },
  {
    section: 'competitors',
    name: 'Competitive Positioning Agent',
    skill: 'ai-gos-competitive-positioning',
    description: 'Alternatives, claims, weak spots.',
  },
  {
    section: 'offerAnalysis',
    name: 'Offer Diagnostic Agent',
    skill: 'ai-gos-offer-performance-diagnostic',
    description: 'Promise, friction, conversion gaps.',
  },
  {
    section: 'keywordIntel',
    name: 'Demand Intent Agent',
    skill: 'ai-gos-demand-intent-signals',
    description: 'Search demand and intent clusters.',
  },
  {
    section: 'crossAnalysis',
    name: 'GTM Synthesis Agent',
    skill: 'ai-gos-gtm-synthesis',
    description: 'Converts evidence into strategy.',
  },
  {
    section: 'mediaPlan',
    name: 'Activation Plan Agent',
    skill: 'ai-gos-activation-plan',
    description: 'Turns strategy into execution moves.',
  },
] as const;

export interface BufferedResearchStreamPatch {
  chunkBuffers: Record<string, string[]>;
  statusPatches: Record<
    string,
    {
      status?: 'running' | 'complete' | 'error';
      startedAt?: number;
    }
  >;
}

export function flushBufferedResearchChunks(
  current: Record<string, ResearchStreamingEntry>,
  patch: BufferedResearchStreamPatch,
): Record<string, ResearchStreamingEntry> {
  const next = { ...current };
  const sectionIds = new Set([
    ...Object.keys(patch.chunkBuffers),
    ...Object.keys(patch.statusPatches),
  ]);

  for (const sectionId of sectionIds) {
    const chunks = patch.chunkBuffers[sectionId] ?? [];
    const statusPatch = patch.statusPatches[sectionId];
    const prev = next[sectionId];
    const isFreshRun =
      statusPatch?.status === 'running' &&
      statusPatch.startedAt != null &&
      statusPatch.startedAt !== prev?.startedAt;
    const baseText = isFreshRun ? '' : prev?.text ?? '';

    next[sectionId] = {
      text: `${baseText}${chunks.join('')}`,
      status: statusPatch?.status ?? prev?.status ?? 'running',
      startedAt: statusPatch?.startedAt ?? prev?.startedAt,
    };
  }

  return next;
}

function hasAnyRunEvidence(
  options: BuildDeepResearchAgentStreamStateOptions,
): boolean {
  return (
    Boolean(options.activeRunId) ||
    options.phase === 'prefilling' ||
    options.phase === 'workspace' ||
    options.deepResearchStatus !== 'idle' ||
    Object.values(options.researchActivity).some(Boolean) ||
    Object.values(options.researchResults).some(Boolean)
  );
}

function getStepStatus(
  step: DeepResearchAgentStepDefinition,
  options: BuildDeepResearchAgentStreamStateOptions,
  hasRunStarted: boolean,
): DeepResearchAgentStepStatus {
  const result = options.researchResults[step.section];
  const activity = options.researchActivity[step.section];

  if (result?.status === 'error' || activity?.status === 'error') {
    return 'error';
  }

  if (result?.status === 'partial') {
    return 'partial';
  }

  if (result?.status === 'complete' || activity?.status === 'complete') {
    return 'complete';
  }

  if (step.section === 'deepResearchProgram' && options.deepResearchStatus === 'complete') {
    return 'complete';
  }

  if (step.section === 'deepResearchProgram' && options.deepResearchStatus === 'error') {
    return 'error';
  }

  if (activity?.status === 'running' || options.activeResearchSections?.has(step.section)) {
    return 'running';
  }

  if (
    step.section === 'deepResearchProgram' &&
    hasRunStarted &&
    options.deepResearchStatus !== 'complete'
  ) {
    return 'running';
  }

  return 'idle';
}

function getStatusMessage(
  step: DeepResearchAgentStepDefinition,
  status: DeepResearchAgentStepStatus,
): string {
  if (step.section === 'deepResearchProgram' && status === 'running') {
    return 'Starting source-backed company research.';
  }

  if (status === 'running') {
    return `${step.name} is writing the next report section.`;
  }

  if (status === 'complete') {
    return `${step.name} completed its section.`;
  }

  if (status === 'partial') {
    return `${step.name} produced a draft that needs review.`;
  }

  if (status === 'error') {
    return `${step.name} needs recovery before this run can continue.`;
  }

  return step.description;
}

function createStepView(
  step: DeepResearchAgentStepDefinition,
  status: DeepResearchAgentStepStatus,
  options: BuildDeepResearchAgentStreamStateOptions,
): DeepResearchAgentStepView {
  return {
    ...step,
    status,
    statusMessage: getStatusMessage(step, status),
    activity: options.researchActivity[step.section],
    result: options.researchResults[step.section],
  };
}

function canRevealNext(status: DeepResearchAgentStepStatus): boolean {
  return status === 'complete' || status === 'partial';
}

export function buildDeepResearchAgentStreamState(
  options: BuildDeepResearchAgentStreamStateOptions,
): DeepResearchAgentStreamState {
  const hasRunStarted = hasAnyRunEvidence(options);
  const visibleSteps: DeepResearchAgentStepView[] = [];
  const bufferedSteps: DeepResearchAgentStepView[] = [];
  const hiddenSections: string[] = [];
  let revealUnlocked = hasRunStarted;

  for (const step of DEEP_RESEARCH_AGENT_STEPS) {
    const status = getStepStatus(step, options, hasRunStarted);
    const stepView = createStepView(step, status, options);

    if (step.section === 'deepResearchProgram') {
      if (hasRunStarted) {
        visibleSteps.push(stepView);
        revealUnlocked = canRevealNext(status);
      } else {
        hiddenSections.push(step.section);
      }
      continue;
    }

    if (!revealUnlocked) {
      if (status === 'idle') {
        hiddenSections.push(step.section);
      } else {
        bufferedSteps.push(stepView);
      }
      continue;
    }

    if (status === 'idle') {
      hiddenSections.push(step.section);
      revealUnlocked = false;
      continue;
    }

    visibleSteps.push(stepView);
    revealUnlocked = canRevealNext(status);
  }

  const artifact = buildJourneyArtifactState({
    activeRunId: options.activeRunId,
    visibleSteps,
  });
  const reportBlocks = artifact.sections.map((section) => ({
    ...section,
    groundingLabel:
      section.sourceUrls.length > 0
        ? `${section.sourceUrls.length} source${section.sourceUrls.length === 1 ? '' : 's'} attached`
        : 'Draft inference pending source review',
  }));
  const activeStep = visibleSteps.find((step) => step.status === 'running') ?? null;

  return {
    hasRunStarted,
    assistantOpening:
      'Deep Research Agent starting. I’m checking source-backed company context before writing the first GTM section.',
    visibleSteps,
    bufferedSteps,
    hiddenSections,
    artifact,
    reportBlocks,
    statusSummary: {
      activeSection: activeStep?.section ?? null,
      bufferedSections: bufferedSteps.map((step) => step.section),
      completedSections: visibleSteps
        .filter((step) => step.status === 'complete')
        .map((step) => step.section),
      partialSections: visibleSteps
        .filter((step) => step.status === 'partial')
        .map((step) => step.section),
    },
  };
}
