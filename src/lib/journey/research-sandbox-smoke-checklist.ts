import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import {
  type JourneyResearchSandboxBackendStatus,
  type JourneyResearchSandboxSection,
} from '@/lib/journey/research-sandbox';
import { SECTION_META } from '@/lib/journey/section-meta';

export type JourneyResearchSandboxSmokeStatus =
  | 'verified'
  | 'ready'
  | 'pending'
  | 'blocked';

export interface JourneyResearchSandboxAutoCheck {
  key: string;
  title: string;
  detail: string;
  status: JourneyResearchSandboxSmokeStatus;
}

export interface JourneyResearchSandboxManualCheck {
  key: string;
  title: string;
  detail: string;
}

export interface JourneyResearchSandboxSmokeChecklist {
  section: JourneyResearchSandboxSection;
  sectionLabel: string;
  autoChecks: JourneyResearchSandboxAutoCheck[];
  manualChecks: JourneyResearchSandboxManualCheck[];
}

export interface BuildJourneyResearchSandboxSmokeChecklistParams {
  section: JourneyResearchSandboxSection;
  missingPrerequisites: JourneyResearchSandboxSection[];
  backendStatus: JourneyResearchSandboxBackendStatus | null;
  selectedResult: ResearchSectionResult | null;
  selectedActivity?: ResearchJobActivity;
}

interface SectionChecklistMeta {
  previewDetail: string;
  persistedJsonDetail: string;
}

const SECTION_CHECKLIST_META: Record<
  JourneyResearchSandboxSection,
  SectionChecklistMeta
> = {
  industryMarket: {
    previewDetail:
      'artifact panel should render the Market Overview document blocks, not raw JSON only.',
    persistedJsonDetail:
      'Look for categorySnapshot plus at least one of marketDynamics, painPoints, or messagingOpportunities.',
  },
  competitors: {
    previewDetail:
      'artifact panel should render competitor cards and whitespace findings for the completed artifact.',
    persistedJsonDetail:
      'Look for competitors[] plus whiteSpaceGaps or overallLandscape.',
  },
  icpValidation: {
    previewDetail:
      'artifact panel should render the ICP verdict and fit score blocks for the completed artifact.',
    persistedJsonDetail:
      'Look for finalVerdict plus painSolutionFit.fitScore or a comparable scoring block.',
  },
  offerAnalysis: {
    previewDetail:
      'artifact panel should render the offer recommendation and score breakdown for the completed artifact.',
    persistedJsonDetail:
      'Look for offerStrength.overallScore or overallScore, plus recommendationStatus or recommendation.',
  },
  crossAnalysis: {
    previewDetail:
      'inline research cards and subsection reveal should render positioning, hooks, and next-step cues.',
    persistedJsonDetail:
      'Look for positioningStrategy.recommendedAngle, platformRecommendations[], and nextSteps[].',
  },
  keywordIntel: {
    previewDetail:
      'inline research cards and subsection reveal should render keyword totals, opportunities, and gap cues.',
    persistedJsonDetail:
      'Look for totalKeywordsFound or competitorGapCount, plus topOpportunities[] or competitorGaps[].',
  },
  mediaPlan: {
    previewDetail:
      'inline research cards and subsection reveal should render budget bars, launch sequencing, and KPI cues.',
    persistedJsonDetail:
      'Look for channelPlan[] or budgetSummary.byPlatform[], plus launchSequence[] or kpiFramework.northStar.',
  },
};

function getSectionLabel(section: JourneyResearchSandboxSection): string {
  return SECTION_META[section]?.label ?? section;
}

function buildDependencyCheck(
  missingPrerequisites: JourneyResearchSandboxSection[],
): JourneyResearchSandboxAutoCheck {
  if (missingPrerequisites.length > 0) {
    return {
      key: 'dependencies',
      title: 'Dependencies',
      status: 'blocked',
      detail: `Missing persisted prerequisites: ${missingPrerequisites.map(getSectionLabel).join(', ')}.`,
    };
  }

  return {
    key: 'dependencies',
    title: 'Dependencies',
    status: 'ready',
    detail: 'Required upstream artifacts are already persisted for this section.',
  };
}

function buildBackendCheck(
  backendStatus: JourneyResearchSandboxBackendStatus | null,
): JourneyResearchSandboxAutoCheck {
  if (!backendStatus?.workerUrlConfigured) {
    return {
      key: 'backend',
      title: 'Backend readiness',
      status: 'blocked',
      detail: 'RAILWAY_WORKER_URL is missing, so the sandbox cannot dispatch a real worker run.',
    };
  }

  if (!backendStatus.workerReachable) {
    return {
      key: 'backend',
      title: 'Backend readiness',
      status: 'blocked',
      detail: 'Research worker is unreachable. Resolve readiness warnings before trusting a run.',
    };
  }

  if (backendStatus.warnings.length > 0) {
    return {
      key: 'backend',
      title: 'Backend readiness',
      status: 'ready',
      detail: `Research worker is reachable, but warnings remain: ${backendStatus.warnings[0]}`,
    };
  }

  return {
    key: 'backend',
    title: 'Backend readiness',
    status: 'ready',
    detail: 'Research worker is reachable and sandbox parity checks are clear.',
  };
}

function buildActivityCheck(
  selectedActivity: ResearchJobActivity | undefined,
  selectedResult: ResearchSectionResult | null,
): JourneyResearchSandboxAutoCheck {
  if (selectedResult?.status === 'complete' && selectedActivity?.status === 'complete') {
    return {
      key: 'activity',
      title: 'Worker activity',
      status: 'verified',
      detail: 'Worker activity completed and the final write finished cleanly.',
    };
  }

  if (selectedResult?.status === 'complete') {
    return {
      key: 'activity',
      title: 'Worker activity',
      status: 'verified',
      detail: 'A completed artifact exists for this section; inspect job activity for the latest run details.',
    };
  }

  if (selectedActivity?.status === 'running') {
    return {
      key: 'activity',
      title: 'Worker activity',
      status: 'verified',
      detail: 'Worker job is running and streaming updates into job_status.',
    };
  }

  if (selectedActivity?.status === 'error' || selectedResult?.status === 'error') {
    return {
      key: 'activity',
      title: 'Worker activity',
      status: 'blocked',
      detail: 'Latest run ended in error. Inspect the activity feed and persisted error payload before rerunning.',
    };
  }

  return {
    key: 'activity',
    title: 'Worker activity',
    status: 'pending',
    detail: 'No worker activity recorded for this section yet.',
  };
}

function buildPersistenceCheck(
  selectedResult: ResearchSectionResult | null,
): JourneyResearchSandboxAutoCheck {
  if (selectedResult?.status === 'complete') {
    return {
      key: 'persistence',
      title: 'Persisted result',
      status: 'verified',
      detail: 'Completed artifact is persisted in the sandbox row and ready for side-by-side inspection.',
    };
  }

  if (selectedResult?.status === 'error') {
    return {
      key: 'persistence',
      title: 'Persisted result',
      status: 'blocked',
      detail: 'An error payload is persisted for this section. Verify the failure state before clearing or rerunning.',
    };
  }

  return {
    key: 'persistence',
    title: 'Persisted result',
    status: 'pending',
    detail: 'No persisted sandbox artifact yet. Run the section to create a fresh payload.',
  };
}

export function buildJourneyResearchSandboxSmokeChecklist({
  section,
  missingPrerequisites,
  backendStatus,
  selectedResult,
  selectedActivity,
}: BuildJourneyResearchSandboxSmokeChecklistParams): JourneyResearchSandboxSmokeChecklist {
  const meta = SECTION_CHECKLIST_META[section];
  const sectionLabel = getSectionLabel(section);

  return {
    section,
    sectionLabel,
    autoChecks: [
      buildDependencyCheck(missingPrerequisites),
      buildBackendCheck(backendStatus),
      buildActivityCheck(selectedActivity, selectedResult),
      buildPersistenceCheck(selectedResult),
    ],
    manualChecks: [
      {
        key: 'preview',
        title: 'Preview surface',
        detail: meta.previewDetail,
      },
      {
        key: 'json',
        title: 'Persisted JSON cues',
        detail: meta.persistedJsonDetail,
      },
      {
        key: 'rerun',
        title: 'Repeatability',
        detail:
          'Clear the selected section, rerun the same context, then confirm the sandbox row updates without mutating the live Journey row.',
      },
    ],
  };
}
