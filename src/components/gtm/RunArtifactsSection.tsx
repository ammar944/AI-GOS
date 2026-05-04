"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactElement } from "react";
import { ArtifactCard } from "@/components/gtm/ArtifactCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getGtmStageLabel,
  GTM_LIGHTHOUSE_STAGE_KEYS,
  normalizeGtmLighthouseStage,
  type GtmLighthouseStage,
} from "@/lib/gtm/stage-mapping";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import type { GtmArtifact, GtmArtifactSource } from "@/lib/types/gtm-artifact";

interface RunArtifactsSectionProps {
  artifacts: GtmArtifact[];
  runId: string;
  stageEvents?: GtmStageEvent[];
}

interface ArtifactGroup {
  skill: string;
  stage: GtmLighthouseStage | null;
  label: string;
  latest: GtmArtifact;
  versions: GtmArtifact[];
}

interface RecordedOutputFile {
  stage: GtmLighthouseStage | null;
  stageLabel: string;
  outputKind: string;
  path: string;
  createdAt: string;
}

interface RecordedOutputFileGroup {
  stage: GtmLighthouseStage | null;
  stageLabel: string;
  files: RecordedOutputFile[];
}

const MAX_PREVIEW_LENGTH = 180;
const EMPTY_STAGE_EVENTS: GtmStageEvent[] = [];

export function RunArtifactsSection({
  artifacts,
  runId,
  stageEvents = EMPTY_STAGE_EVENTS,
}: RunArtifactsSectionProps): ReactElement {
  const groups = useMemo(() => {
    return sortArtifactGroups(groupArtifactsBySkill(artifacts));
  }, [artifacts]);
  const recordedOutputGroups = useMemo(() => {
    return groupRecordedOutputFiles(stageEvents);
  }, [stageEvents]);

  return (
    <section className="rounded-lg border border-border bg-card/40 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Run artifacts</h2>
        {groups.length > 0 ? (
          <span className="font-mono text-xs text-muted-foreground">
            {formatArtifactGroupCount(groups.length)}
          </span>
        ) : null}
      </div>

      {groups.length === 0 ? (
        recordedOutputGroups.length > 0 ? (
          <RecordedOutputFilesFallback groups={recordedOutputGroups} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No artifacts produced yet.
          </p>
        )
      ) : (
        <ol className="flex flex-col gap-3">
          {groups.map((group) => (
            <ArtifactGroupItem key={group.skill} group={group} runId={runId} />
          ))}
        </ol>
      )}
    </section>
  );
}

function RecordedOutputFilesFallback({
  groups,
}: {
  groups: RecordedOutputFileGroup[];
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border bg-background/50 px-3 py-3">
        <p className="text-sm font-medium text-foreground">
          No canvas artifacts persisted yet.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Stage output files were recorded during this run.
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {groups.map((group) => (
          <li
            key={group.stageLabel}
            className="rounded-md border border-border bg-background/50 px-3 py-3"
          >
            <h3 className="font-mono text-sm font-medium text-foreground">
              {group.stageLabel}
            </h3>
            <ol className="mt-2 flex flex-col gap-2">
              {group.files.map((file) => (
                <li key={`${file.outputKind}-${file.path}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {file.outputKind}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatArtifactTime(file.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {file.path}
                  </p>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ArtifactGroupItem({
  group,
  runId,
}: {
  group: ArtifactGroup;
  runId: string;
}): ReactElement {
  const preview = getArtifactPreview(group.latest.content_md);

  return (
    <li
      data-testid="run-artifact-group"
      className="rounded-md border border-border bg-background/50 px-3 py-3"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                data-testid="run-artifact-group-label"
                className="font-mono text-sm font-medium text-foreground"
              >
                {group.label}
              </h3>
              <Badge
                variant="outline"
                className="font-mono text-xs tabular-nums"
              >
                Latest v{group.latest.version}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {formatVersionCount(group.versions.length)}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatArtifactOwner(group)}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <span className="font-mono text-xs text-muted-foreground">
              {formatArtifactTime(group.latest.created_at)}
            </span>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
            >
              <Link href={`/gtm/${runId}/artifacts/${group.latest.id}`}>
                Open latest in canvas
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatLatestSource(group.latest.source)}</span>
        </div>

        <p
          data-testid="run-artifact-preview"
          className="line-clamp-3 text-sm text-foreground"
        >
          {preview}
        </p>

        <ArtifactCard
          versions={group.versions}
          runId={runId}
          defaultExpanded={false}
          className="border-border/80 bg-card/40 shadow-none"
        />
      </div>
    </li>
  );
}

function groupRecordedOutputFiles(
  events: readonly GtmStageEvent[],
): RecordedOutputFileGroup[] {
  const files = getRecordedOutputFiles(events);
  const groups = new Map<string, RecordedOutputFile[]>();

  for (const file of files) {
    groups.set(file.stageLabel, [...(groups.get(file.stageLabel) ?? []), file]);
  }

  return [...groups.entries()]
    .map(([stageLabel, groupFiles]) => {
      const firstFile = groupFiles[0];

      return {
        stage: firstFile?.stage ?? null,
        stageLabel,
        files: groupFiles,
      };
    })
    .sort(compareRecordedOutputGroups);
}

function getRecordedOutputFiles(
  events: readonly GtmStageEvent[],
): RecordedOutputFile[] {
  const filesByKey = new Map<string, RecordedOutputFile>();

  for (const event of events) {
    if (!event.artifact_path) {
      continue;
    }

    const stage = normalizeGtmLighthouseStage(event.stage);
    const stageLabel = stage ? getGtmStageLabel(stage) : event.stage;
    const outputKind = getRecordedOutputKind(event);
    const file = {
      stage,
      stageLabel,
      outputKind,
      path: event.artifact_path,
      createdAt: event.created_at,
    };

    filesByKey.set(`${stageLabel}:${outputKind}:${event.artifact_path}`, file);
  }

  return [...filesByKey.values()].sort(compareRecordedOutputFiles);
}

function groupArtifactsBySkill(artifacts: GtmArtifact[]): ArtifactGroup[] {
  const groups = new Map<string, GtmArtifact[]>();

  for (const artifact of artifacts) {
    groups.set(artifact.skill, [...(groups.get(artifact.skill) ?? []), artifact]);
  }

  return [...groups.entries()].flatMap(([skill, versions]) => {
    const sortedVersions = sortArtifactVersions(versions);
    const latest = sortedVersions[0];

    if (!latest) {
      return [];
    }

    const stage = getArtifactStage(latest);

    return [
      {
        skill,
        stage,
        label: stage ? getGtmStageLabel(stage) : skill,
        latest,
        versions: sortedVersions,
      },
    ];
  });
}

function sortArtifactGroups(groups: ArtifactGroup[]): ArtifactGroup[] {
  return [...groups].sort((left, right) => {
    const leftStageIndex = getStageSortIndex(left.stage);
    const rightStageIndex = getStageSortIndex(right.stage);

    if (leftStageIndex !== rightStageIndex) {
      return leftStageIndex - rightStageIndex;
    }

    return left.label.localeCompare(right.label) || left.skill.localeCompare(right.skill);
  });
}

function compareRecordedOutputGroups(
  left: RecordedOutputFileGroup,
  right: RecordedOutputFileGroup,
): number {
  const leftStageIndex = getStageSortIndex(left.stage);
  const rightStageIndex = getStageSortIndex(right.stage);

  if (leftStageIndex !== rightStageIndex) {
    return leftStageIndex - rightStageIndex;
  }

  return left.stageLabel.localeCompare(right.stageLabel);
}

function compareRecordedOutputFiles(
  left: RecordedOutputFile,
  right: RecordedOutputFile,
): number {
  const leftStageIndex = getStageSortIndex(left.stage);
  const rightStageIndex = getStageSortIndex(right.stage);

  if (leftStageIndex !== rightStageIndex) {
    return leftStageIndex - rightStageIndex;
  }

  return (
    compareCreatedAt(left.createdAt, right.createdAt) ||
    left.outputKind.localeCompare(right.outputKind) ||
    left.path.localeCompare(right.path)
  );
}

function sortArtifactVersions(artifacts: GtmArtifact[]): GtmArtifact[] {
  return [...artifacts].sort((left, right) => {
    if (left.version !== right.version) {
      return right.version - left.version;
    }

    return compareCreatedAt(right.created_at, left.created_at);
  });
}

function getArtifactPreview(contentMd: string): string {
  const lines = contentMd
    .split("\n")
    .map((line) => cleanMarkdownLine(line))
    .filter((line) => line.length > 0);
  const preview = truncatePreview(lines.join(" ").replace(/\s+/g, " ").trim());

  if (!preview || looksLikeRawJson(preview)) {
    return "Structured artifact content is available in the expanded view.";
  }

  return preview;
}

function cleanMarkdownLine(line: string): string {
  return line
    .trim()
    .replace(/^```.*$/, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function truncatePreview(preview: string): string {
  if (preview.length <= MAX_PREVIEW_LENGTH) {
    return preview;
  }

  return `${preview.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}...`;
}

function looksLikeRawJson(preview: string): boolean {
  return (
    (preview.startsWith("{") || preview.startsWith("[")) &&
    preview.includes(":") &&
    preview.includes('"')
  );
}

function getArtifactStage(artifact: GtmArtifact): GtmLighthouseStage | null {
  const skillStage = normalizeGtmLighthouseStage(artifact.skill);
  if (skillStage) {
    return skillStage;
  }

  const metadataStage = getStringField(artifact.metadata, "stage");
  return metadataStage ? normalizeGtmLighthouseStage(metadataStage) : null;
}

function getRecordedOutputKind(event: GtmStageEvent): string {
  const metadataKind = event.metadata
    ? getStringField(event.metadata, "artifact")
    : null;
  if (metadataKind) {
    return metadataKind;
  }

  const recordedKind = event.message.match(/^([\w.-]+)\s+artifact recorded\.$/i);
  if (recordedKind?.[1]) {
    return recordedKind[1];
  }

  return event.tool_name ?? event.event_type;
}

function getStageSortIndex(stage: GtmLighthouseStage | null): number {
  if (!stage) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = GTM_LIGHTHOUSE_STAGE_KEYS.findIndex((candidate) => {
    return candidate === stage;
  });

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function formatArtifactOwner(group: ArtifactGroup): string {
  if (!group.stage) {
    return `Skill: ${group.skill}`;
  }

  return `Stage: ${group.stage} · Skill: ${group.skill}`;
}

function formatLatestSource(source: GtmArtifactSource): string {
  return `Latest source: ${source === "skill_output" ? "Skill output" : "Agent patch"}`;
}

function formatVersionCount(count: number): string {
  return `${count} ${count === 1 ? "version" : "versions"}`;
}

function formatArtifactGroupCount(count: number): string {
  return `${count} ${count === 1 ? "group" : "groups"}`;
}

function formatArtifactTime(iso: string): string {
  const time = new Date(iso);

  if (Number.isNaN(time.getTime())) {
    return iso;
  }

  return time.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compareCreatedAt(left: string, right: string): number {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
    return leftMs - rightMs;
  }

  return left.localeCompare(right);
}

function getStringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
