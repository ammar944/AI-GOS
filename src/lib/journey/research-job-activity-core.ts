import type { ResearchTelemetry } from '@/lib/journey/research-observability';
import {
  RESEARCH_TOOL_TO_SECTION_MAP,
  getBoundaryResearchSectionId,
} from '@/lib/journey/research-sections';

const TOOL_TO_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(RESEARCH_TOOL_TO_SECTION_MAP).map(([tool, section]) => [
    tool,
    getBoundaryResearchSectionId(section) ?? section,
  ]),
);

export interface ResearchUpdateMeta {
  url?: string;
  screenshotUrl?: string;
  favicon?: string;
  pageTitle?: string;
  dataPoints?: Array<{ label: string; value: string }>;
  toolName?: string;
  resultCount?: number;
}

export interface ResearchJobUpdate {
  at: string;
  id: string;
  message: string;
  phase: 'runner' | 'tool' | 'analysis' | 'output' | 'error';
  meta?: ResearchUpdateMeta;
}

export interface ResearchJobStatusRow {
  status: 'running' | 'complete' | 'error';
  tool: string;
  startedAt: string;
  completedAt?: string;
  lastHeartbeat?: string;
  error?: string;
  updates?: ResearchJobUpdate[];
  telemetry?: ResearchTelemetry;
}

export interface ResearchJobActivity extends ResearchJobStatusRow {
  jobId: string;
  section: string;
}

export interface CollapsedResearchJobUpdate extends ResearchJobUpdate {
  count: number;
  meta?: ResearchUpdateMeta;
}

function statusTimestamp(row: ResearchJobStatusRow): number {
  const raw = row.completedAt ?? row.lastHeartbeat ?? row.startedAt;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function extractResearchJobActivity(
  jobStatus: Record<string, ResearchJobStatusRow> | null | undefined,
): Record<string, ResearchJobActivity> {
  const latestBySection: Record<string, ResearchJobActivity> = {};

  for (const [jobId, row] of Object.entries(jobStatus ?? {})) {
    const section = TOOL_TO_SECTION[row.tool];
    if (!section) {
      continue;
    }

    const next: ResearchJobActivity = {
      ...row,
      jobId,
      section,
    };

    const current = latestBySection[section];
    if (!current || statusTimestamp(next) >= statusTimestamp(current)) {
      latestBySection[section] = next;
    }
  }

  return latestBySection;
}

export function collapseResearchJobUpdates(
  updates: ResearchJobUpdate[] | undefined,
): CollapsedResearchJobUpdate[] {
  const collapsed: CollapsedResearchJobUpdate[] = [];

  for (const update of [...(updates ?? [])].sort((left, right) =>
    left.at.localeCompare(right.at),
  )) {
    const last = collapsed.at(-1);
    if (last && last.phase === update.phase && last.message === update.message) {
      last.count += 1;
      last.at = update.at;
      last.id = update.id;
      continue;
    }

    collapsed.push({
      ...update,
      count: 1,
    });
  }

  return collapsed;
}
