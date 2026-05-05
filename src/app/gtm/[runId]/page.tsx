import type { ReactElement } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  ChatShell,
  type ChatShellRun,
} from "@/components/gtm/ChatShell";
import type {
  GtmRunVisibilityBlocker,
  GtmRunVisibilityPanelData,
} from "@/components/gtm/GtmRunVisibilityPanel";
import { getGtmRunView, type GtmRunView } from "@/lib/gtm/run-view";

export const revalidate = 10;

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function GtmRunPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { runId } = await params;
  const view = await getGtmRunView(runId);

  if (!view) {
    notFound();
  }

  return (
    <ChatShell
      run={toChatShellRun(view)}
      initialEvents={getInitialEvents(view)}
      initialArtifacts={getInitialArtifacts(view)}
      initialMessages={view.messages}
      visibility={toGtmRunVisibility(view)}
    />
  );
}

function toChatShellRun(view: GtmRunView): ChatShellRun {
  const stages: NonNullable<ChatShellRun["stages"]> = {};

  for (const stage of view.stages) {
    if (!stage.persisted_status && Object.keys(stage.state).length === 0) {
      continue;
    }

    stages[stage.stage] = stage.state;
  }

  return {
    run_id: view.run.run_id,
    input_url: view.run.input_url,
    status: view.run.status,
    manifest: view.run.manifest,
    stages,
    created_at: view.run.created_at,
    ...(view.run.updated_at ? { updated_at: view.run.updated_at } : {}),
  };
}

function getInitialEvents(
  view: GtmRunView,
): GtmRunView["events_by_stage"][string] {
  return Object.values(view.events_by_stage)
    .flat()
    .sort(compareCreatedAt);
}

function getInitialArtifacts(
  view: GtmRunView,
): GtmRunView["artifacts_by_skill"][number]["artifacts"] {
  return view.artifacts_by_skill.flatMap((group) => group.artifacts);
}

function toGtmRunVisibility(view: GtmRunView): GtmRunVisibilityPanelData {
  return {
    runStatus: view.run.status,
    eventCount: getEventCount(view),
    blockerCount: view.blockers.length,
    stages: view.stages.map((stage) => {
      return {
        stage: stage.stage,
        label: stage.label,
        status: stage.status,
        latestEvent: stage.latest_event
          ? {
              message: stage.latest_event.message,
              createdAt: stage.latest_event.created_at,
              eventType: stage.latest_event.event_type,
            }
          : null,
        blocker: stage.blocker ? toVisibilityBlocker(stage.blocker) : null,
        pendingDependencyReason: stage.pending_dependency_reason,
        elapsedMs: stage.elapsed_ms,
      };
    }),
  };
}

function toVisibilityBlocker(
  blocker: GtmRunView["blockers"][number],
): GtmRunVisibilityBlocker {
  return {
    title: blocker.title,
    reason: blocker.reason,
    ...(blocker.remediation ? { remediation: blocker.remediation } : {}),
  };
}

function getEventCount(view: GtmRunView): number {
  return Object.values(view.events_by_stage).reduce((count, events) => {
    return count + events.length;
  }, 0);
}

function compareCreatedAt(
  left: { created_at: string },
  right: { created_at: string },
): number {
  const leftMs = Date.parse(left.created_at);
  const rightMs = Date.parse(right.created_at);

  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
    return leftMs - rightMs;
  }

  return left.created_at.localeCompare(right.created_at);
}
