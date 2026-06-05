import type { TelemetrySettings } from 'ai';

import { getSectionRunnerModelId } from '../ai/models';
import type { SectionId } from '../events/activity-event';

export type LabSectionTelemetryOperation =
  | 'answer-tool'
  | 'answer-tool-stream'
  | 'evidence-pass'
  | 'evidence-pass-stream'
  | 'structured-output'
  | 'structured-output-stream';

export interface CreateLabSectionTelemetryInput {
  runId: string;
  sectionId: SectionId;
  operation: LabSectionTelemetryOperation;
  attempt?: number;
  schemaName?: string;
}

export function createLabSectionTelemetry({
  attempt,
  operation,
  runId,
  schemaName,
  sectionId,
}: CreateLabSectionTelemetryInput): TelemetrySettings {
  return {
    isEnabled: true,
    recordInputs: true,
    recordOutputs: true,
    functionId: `lab-section.${operation}`,
    metadata: {
      model: getSectionRunnerModelId(),
      operation,
      runId,
      schemaName: schemaName ?? '',
      sectionId,
      traceId: runId,
      ...(attempt === undefined ? {} : { attempt }),
    },
  };
}
