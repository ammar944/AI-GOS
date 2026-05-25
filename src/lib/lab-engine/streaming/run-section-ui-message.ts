import type { UIMessage, UIMessageStreamWriter } from "ai";

import type { SectionId } from "../events/activity-event";

export type RunSectionStreamData = {
  "section-status": {
    runId: string;
    sectionId: SectionId;
    status: "starting" | "running" | "validating" | "repairing" | "completed" | "failed";
    message: string;
  };
  "tool-event": {
    runId: string;
    sectionId: SectionId;
    toolName: string;
    state: "started" | "finished" | "gap" | "error";
    message: string;
  };
  "artifact-partial": {
    runId: string;
    sectionId: SectionId;
    partial: unknown;
  };
  "artifact-final": {
    runId: string;
    sectionId: SectionId;
    artifactId: string;
  };
  "validation-event": {
    runId: string;
    sectionId: SectionId;
    attempt: number;
    state: "started" | "failed" | "passed";
    issues: string[];
  };
};

export type RunSectionUIMessage = UIMessage<
  unknown,
  RunSectionStreamData,
  never
>;

export type RunSectionStreamWriter =
  UIMessageStreamWriter<RunSectionUIMessage>;
