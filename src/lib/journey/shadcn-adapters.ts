import type { JourneyArtifactSection, JourneyArtifactState } from "@/lib/journey/research-artifact-state";
import type { JourneyArtifactSectionStatus } from "@/lib/journey/research-artifact-events";
import type { DeepResearchAgentStepView } from "@/lib/journey/research-stream-buffer";
import type { ResearchJobActivity, ResearchJobUpdate } from "@/lib/journey/research-job-activity-core";

// --- Artifact adapter ---

export interface ShadcnArtifactSection {
  id: string;
  title: string;
  content: string;
  status: JourneyArtifactSectionStatus;
  sourceUrls: string[];
  sourceCount: number;
}

export interface ShadcnArtifactProps {
  title: string;
  status: "idle" | "streaming" | "partial" | "complete" | "error";
  activeSection: string | null;
  sections: ShadcnArtifactSection[];
  hasActiveStreaming: boolean;
  completedCount: number;
  totalCount: number;
}

export function journeyArtifactToShadcnProps(
  artifact: JourneyArtifactState,
): ShadcnArtifactProps {
  const sections: ShadcnArtifactSection[] = artifact.sections.map((s) => ({
    id: s.section,
    title: s.title,
    content: s.content,
    status: s.status,
    sourceUrls: s.sourceUrls,
    sourceCount: s.sourceUrls.length,
  }));

  return {
    title: artifact.title,
    status: artifact.status,
    activeSection: artifact.activeSection,
    sections,
    hasActiveStreaming: artifact.sections.some(
      (s) => s.status === "drafting" || s.status === "researching" || s.status === "citing",
    ),
    completedCount: artifact.sections.filter(
      (s) => s.status === "complete" || s.status === "partial",
    ).length,
    totalCount: artifact.sections.length,
  };
}

// --- Reasoning / Chain of Thought adapter ---

export interface ShadcnReasoningStep {
  id: string;
  name: string;
  skill: string;
  status: "idle" | "running" | "complete" | "partial" | "error";
  description: string;
  verdict: string | null;
  toolEvents: ShadcnToolEvent[];
}

export function agentStepsToReasoningProps(
  visibleSteps: DeepResearchAgentStepView[],
): ShadcnReasoningStep[] {
  return visibleSteps.map((step) => {
    const data =
      step.result && typeof step.result === "object" && "data" in step.result
        ? (step.result.data as Record<string, unknown> | null)
        : null;
    const verdict =
      typeof data?.verdict === "string"
        ? data.verdict
        : typeof data?.statusSummary === "string"
          ? data.statusSummary
          : null;

    return {
      id: step.section,
      name: step.name,
      skill: step.skill,
      status: step.status,
      description: step.statusMessage,
      verdict,
      toolEvents: jobUpdatesToToolEvents(step.activity, 8),
    };
  });
}

// --- Tool execution adapter ---

export interface ShadcnToolEvent {
  id: string;
  message: string;
  phase: "runner" | "tool" | "analysis" | "artifact" | "output" | "error";
  toolName: string | null;
  url: string | null;
  pageTitle: string | null;
  resultCount: number | null;
}

export function jobUpdatesToToolEvents(
  activity: Pick<ResearchJobActivity, "updates"> | undefined,
  maxEvents?: number,
): ShadcnToolEvent[] {
  const updates = [...(activity?.updates ?? [])]
    .filter((u) => u.phase !== "artifact")
    .sort((a, b) => a.at.localeCompare(b.at));

  const source = maxEvents ? updates.slice(-maxEvents) : updates;

  return source.map((update) => ({
    id: update.id,
    message: formatToolMessage(update),
    phase: update.phase,
    toolName: update.meta?.toolName ?? null,
    url: update.meta?.url ?? null,
    pageTitle: update.meta?.pageTitle ?? null,
    resultCount: typeof update.meta?.resultCount === "number" ? update.meta.resultCount : null,
  }));
}

function formatToolMessage(update: ResearchJobUpdate): string {
  if (update.meta?.toolName === "web_search") {
    if (update.meta.url) {
      return update.meta.pageTitle
        ? `Opened ${update.meta.pageTitle}`
        : `Opened ${update.meta.url}`;
    }
    if (typeof update.meta.resultCount === "number") {
      return `Search returned ${update.meta.resultCount} results`;
    }
  }
  if (update.meta?.toolName === "code_execution") {
    return "Ran analysis";
  }
  return update.message;
}

// --- Section to Task adapter ---

export interface ShadcnTaskProps {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "done" | "error";
}

export function sectionToTaskProps(
  section: JourneyArtifactSection,
): ShadcnTaskProps {
  let taskStatus: ShadcnTaskProps["status"] = "pending";
  if (section.status === "complete") taskStatus = "done";
  else if (section.status === "error") taskStatus = "error";
  else if (
    section.status === "drafting" ||
    section.status === "researching" ||
    section.status === "citing"
  )
    taskStatus = "in-progress";

  return {
    id: section.section,
    title: section.title,
    status: taskStatus,
  };
}

// --- Sources adapter ---

export interface ShadcnSource {
  url: string;
  title: string | null;
  hostname: string | null;
}

export function urlsToSources(urls: string[]): ShadcnSource[] {
  return urls.map((url) => {
    let hostname: string | null = null;
    try {
      hostname = new URL(url).hostname;
    } catch {
      // non-URL string, leave hostname null
    }
    return { url, title: null, hostname };
  });
}
