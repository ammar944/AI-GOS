import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  artifactEnvelopeSchema,
  migrateRunRecordInput,
  researchInputSchema,
  runRecordSchema,
  type ArtifactEnvelope,
  type ResearchInput,
  type RunRecord,
  type RunRecordStatus,
  type SectionRunRecord,
} from "../artifacts/artifact-envelope";
import {
  activityEventSchema,
  type ActivityEvent,
  type SectionId,
} from "../events/activity-event";

const safeRunIdPattern = /^[A-Za-z0-9_-]+$/;

export interface CreateRunStoreOptions {
  rootDir?: string;
  recordingsDir?: string;
  defaultSectionIds?: SectionId[];
  now?: () => Date;
}

export interface RunStore {
  createRun: (input: ResearchInput) => Promise<RunRecord>;
  readRun: (runId: string) => Promise<RunRecord>;
  appendEvent: (runId: string, event: ActivityEvent) => Promise<RunRecord>;
  saveArtifact: (
    runId: string,
    artifact: ArtifactEnvelope,
  ) => Promise<RunRecord>;
  markSectionRunning: (
    runId: string,
    sectionId: SectionId,
  ) => Promise<RunRecord>;
  markSectionFailed: (
    runId: string,
    sectionId: SectionId,
    error: string,
  ) => Promise<RunRecord>;
}

export interface RunStoreErrorOptions {
  action: string;
  runId: string;
  filePath: string;
  cause: unknown;
}

export class RunStoreError extends Error {
  public readonly action: string;
  public readonly runId: string;
  public readonly filePath: string;

  public constructor({
    action,
    runId,
    filePath,
    cause,
  }: RunStoreErrorOptions) {
    super(
      `${action} failed for runId ${runId} at ${filePath}: ${getErrorMessage(cause)}`,
      { cause },
    );

    this.name = "RunStoreError";
    this.action = action;
    this.runId = runId;
    this.filePath = filePath;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

function getRunRootDir(options: CreateRunStoreOptions): string {
  return (
    options.rootDir ??
    join(/* turbopackIgnore: true */ process.cwd(), ".data", "runs")
  );
}

function getRecordingsDir(rootDir: string, options: CreateRunStoreOptions): string {
  return options.recordingsDir ?? join(dirname(rootDir), "recordings");
}

function getNowIsoString(now: () => Date): string {
  return now().toISOString();
}

function getRunFilePath(rootDir: string, runId: string): string {
  return join(rootDir, `${runId}.json`);
}

function getRecordingFilePath(recordingsDir: string, runId: string): string {
  return join(recordingsDir, `${runId}.json`);
}

function isRecordingRunId(runId: string): boolean {
  return runId.startsWith("recording_");
}

function createRunStoreError(
  action: string,
  runId: string,
  filePath: string,
  cause: unknown,
): RunStoreError {
  return new RunStoreError({ action, runId, filePath, cause });
}

function assertSafeRunId(
  action: string,
  rootDir: string,
  runId: string,
): void {
  if (!safeRunIdPattern.test(runId)) {
    throw createRunStoreError(
      action,
      runId,
      getRunFilePath(rootDir, runId),
      new Error("runId must contain only letters, numbers, underscores, or dashes"),
    );
  }
}

function assertLiveWritableRunId(
  action: string,
  rootDir: string,
  runId: string,
): void {
  if (!isRecordingRunId(runId)) {
    return;
  }

  throw createRunStoreError(
    action,
    runId,
    getRunFilePath(rootDir, runId),
    new Error("recording runs are read-only and cannot be mutated as live runs"),
  );
}

function createInitialSections(
  selectedSectionIds: SectionId[],
): RunRecord["sections"] {
  const sectionEntries = selectedSectionIds.map(
    (sectionId): [SectionId, SectionRunRecord] => [
      sectionId,
      {
        sectionId,
        status: "idle",
        artifact: null,
        startedAt: null,
        completedAt: null,
        error: null,
      },
    ],
  );

  return Object.fromEntries(sectionEntries);
}

function createInitialRunRecord({
  input,
  selectedSectionIds,
  now,
}: {
  input: ResearchInput;
  selectedSectionIds: SectionId[];
  now: () => Date;
}): RunRecord {
  const createdAt = getNowIsoString(now);

  return runRecordSchema.parse({
    id: input.runId,
    fixtureId: input.fixtureId,
    source: "live",
    status: "idle",
    selectedSectionIds,
    createdAt,
    updatedAt: createdAt,
    input,
    sections: createInitialSections(selectedSectionIds),
    events: [],
  });
}

function assertEventBelongsToRun({
  action,
  event,
  filePath,
  runId,
}: {
  action: string;
  event: ActivityEvent;
  filePath: string;
  runId: string;
}): void {
  if (event.runId !== runId) {
    throw createRunStoreError(
      action,
      runId,
      filePath,
      new Error(`event runId ${event.runId} does not match requested runId`),
    );
  }
}

function assertArtifactBelongsToRun({
  action,
  artifact,
  filePath,
  runId,
}: {
  action: string;
  artifact: ArtifactEnvelope;
  filePath: string;
  runId: string;
}): void {
  if (artifact.runId !== runId) {
    throw createRunStoreError(
      action,
      runId,
      filePath,
      new Error(`artifact runId ${artifact.runId} does not match requested runId`),
    );
  }
}

function assertArtifactSectionIsSelected({
  action,
  artifact,
  filePath,
  record,
}: {
  action: string;
  artifact: ArtifactEnvelope;
  filePath: string;
  record: RunRecord;
}): void {
  if (!record.selectedSectionIds.includes(artifact.sectionId)) {
    throw createRunStoreError(
      action,
      record.id,
      filePath,
      new Error(
        `artifact sectionId ${artifact.sectionId} is not selected for this run`,
      ),
    );
  }
}

function assertReadRecordMatchesRunId({
  action,
  filePath,
  record,
  runId,
}: {
  action: string;
  filePath: string;
  record: RunRecord;
  runId: string;
}): void {
  if (record.id !== runId) {
    throw createRunStoreError(
      action,
      runId,
      filePath,
      new Error(`persisted record id ${record.id} does not match requested runId`),
    );
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function persistRunRecord(
  rootDir: string,
  filePath: string,
  record: RunRecord,
): Promise<void> {
  await mkdir(rootDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

async function readRunRecordFromPath({
  action,
  filePath,
  runId,
}: {
  action: string;
  filePath: string;
  runId: string;
}): Promise<RunRecord> {
  const fileContents = await readFile(filePath, "utf8");
  const parsedJson = JSON.parse(fileContents) as unknown;
  const record = runRecordSchema.parse(
    migrateRunRecordInput(parsedJson, runId),
  );
  assertReadRecordMatchesRunId({ action, filePath, record, runId });

  return record;
}

async function readRunRecordFromFile(
  action: string,
  rootDir: string,
  recordingsDir: string,
  runId: string,
): Promise<RunRecord> {
  const liveFilePath = getRunFilePath(rootDir, runId);
  const recordingFilePath = getRecordingFilePath(recordingsDir, runId);
  const filePath =
    isRecordingRunId(runId) && (await fileExists(recordingFilePath))
      ? recordingFilePath
      : liveFilePath;

  try {
    return await readRunRecordFromPath({ action, filePath, runId });
  } catch (error) {
    if (error instanceof RunStoreError) {
      throw error;
    }

    throw createRunStoreError(action, runId, filePath, error);
  }
}

const serializedRunWrites = new Map<string, Promise<void>>();

async function withSerializedRunWrite<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = serializedRunWrites.get(filePath) ?? Promise.resolve();
  const next = previous.then(operation, operation);
  const cleanup = next.then(
    () => undefined,
    () => undefined,
  );

  serializedRunWrites.set(filePath, cleanup);
  cleanup.finally(() => {
    if (serializedRunWrites.get(filePath) === cleanup) {
      serializedRunWrites.delete(filePath);
    }
  });

  return next;
}

function deriveRunStatus(record: RunRecord): RunRecordStatus {
  const anySelectedSectionFailed = record.selectedSectionIds.some(
    (sectionId) => record.sections[sectionId]?.status === "failed",
  );

  if (anySelectedSectionFailed) {
    return "failed";
  }

  const allSelectedSectionsCompleted = record.selectedSectionIds.every(
    (sectionId) => record.sections[sectionId]?.status === "completed",
  );

  return allSelectedSectionsCompleted ? "completed" : "running";
}

function withUpdatedRunTimestamp(
  record: RunRecord,
  now: () => Date,
): RunRecord {
  return runRecordSchema.parse({
    ...record,
    updatedAt: getNowIsoString(now),
  });
}

export function createRunStore(
  options: CreateRunStoreOptions = {},
): RunStore {
  const rootDir = getRunRootDir(options);
  const recordingsDir = getRecordingsDir(rootDir, options);
  const defaultSectionIds = options.defaultSectionIds ?? [
    "positioningMarketCategory",
  ];
  const now = options.now ?? (() => new Date());

  return {
    createRun: async (input: ResearchInput): Promise<RunRecord> => {
      const parsedInput = researchInputSchema.parse(input);
      const action = "create run";
      const runId = parsedInput.runId;
      assertSafeRunId(action, rootDir, runId);
      assertLiveWritableRunId(action, rootDir, runId);

      const filePath = getRunFilePath(rootDir, runId);
      const initialRunRecord = createInitialRunRecord({
        input: parsedInput,
        selectedSectionIds: defaultSectionIds,
        now,
      });

      try {
        return await withSerializedRunWrite(filePath, async (): Promise<RunRecord> => {
          if (await fileExists(filePath)) {
            throw new Error("run file already exists");
          }

          await persistRunRecord(rootDir, filePath, initialRunRecord);

          return initialRunRecord;
        });
      } catch (error) {
        throw createRunStoreError(action, runId, filePath, error);
      }
    },

    readRun: async (runId: string): Promise<RunRecord> => {
      const action = "read run";
      assertSafeRunId(action, rootDir, runId);

      return readRunRecordFromFile(action, rootDir, recordingsDir, runId);
    },

    appendEvent: async (
      runId: string,
      event: ActivityEvent,
    ): Promise<RunRecord> => {
      const action = "append event";
      assertSafeRunId(action, rootDir, runId);
      assertLiveWritableRunId(action, rootDir, runId);

      const filePath = getRunFilePath(rootDir, runId);
      const parsedEvent = activityEventSchema.parse(event);
      assertEventBelongsToRun({ action, event: parsedEvent, filePath, runId });

      try {
        return await withSerializedRunWrite(filePath, async (): Promise<RunRecord> => {
          const record = await readRunRecordFromFile(
            action,
            rootDir,
            recordingsDir,
            runId,
          );
          const nextRecord = withUpdatedRunTimestamp(
            {
              ...record,
              events: [...record.events, parsedEvent],
            },
            now,
          );

          await persistRunRecord(rootDir, filePath, nextRecord);

          return nextRecord;
        });
      } catch (error) {
        throw createRunStoreError(action, runId, filePath, error);
      }
    },

    saveArtifact: async (
      runId: string,
      artifact: ArtifactEnvelope,
    ): Promise<RunRecord> => {
      const action = "save artifact";
      assertSafeRunId(action, rootDir, runId);
      assertLiveWritableRunId(action, rootDir, runId);

      const filePath = getRunFilePath(rootDir, runId);
      const parsedArtifact = artifactEnvelopeSchema.parse(artifact);
      assertArtifactBelongsToRun({
        action,
        artifact: parsedArtifact,
        filePath,
        runId,
      });

      try {
        return await withSerializedRunWrite(filePath, async (): Promise<RunRecord> => {
          const record = await readRunRecordFromFile(
            action,
            rootDir,
            recordingsDir,
            runId,
          );
          assertArtifactSectionIsSelected({
            action,
            artifact: parsedArtifact,
            filePath,
            record,
          });

          const existingSection = record.sections[parsedArtifact.sectionId];
          const nextSectionRecord = sectionRunRecordFromArtifact({
            artifact: parsedArtifact,
            existingSection,
            now,
          });
          const sections = {
            ...record.sections,
            [parsedArtifact.sectionId]: nextSectionRecord,
          };
          const nextRecord = withUpdatedRunTimestamp(
            {
              ...record,
              sections,
              status: deriveRunStatus({ ...record, sections }),
            },
            now,
          );

          await persistRunRecord(rootDir, filePath, nextRecord);

          return nextRecord;
        });
      } catch (error) {
        throw createRunStoreError(action, runId, filePath, error);
      }
    },

    markSectionRunning: async (
      runId: string,
      sectionId: SectionId,
    ): Promise<RunRecord> => {
      const action = "mark section running";
      assertSafeRunId(action, rootDir, runId);
      assertLiveWritableRunId(action, rootDir, runId);

      const filePath = getRunFilePath(rootDir, runId);

      try {
        return await withSerializedRunWrite(filePath, async (): Promise<RunRecord> => {
          const record = await readRunRecordFromFile(
            action,
            rootDir,
            recordingsDir,
            runId,
          );
          const existingSection = record.sections[sectionId];

          if (!record.selectedSectionIds.includes(sectionId)) {
            throw createRunStoreError(
              action,
              runId,
              filePath,
              new Error(`sectionId ${sectionId} is not selected for this run`),
            );
          }

          const startedAt = existingSection?.startedAt ?? getNowIsoString(now);
          const nextSectionRecord: SectionRunRecord = {
            sectionId,
            status: "running",
            artifact: existingSection?.artifact ?? null,
            startedAt,
            completedAt: null,
            error: null,
          };
          const sections = {
            ...record.sections,
            [sectionId]: nextSectionRecord,
          };
          const nextRecord = withUpdatedRunTimestamp(
            {
              ...record,
              sections,
              status: deriveRunStatus({ ...record, sections }),
            },
            now,
          );

          await persistRunRecord(rootDir, filePath, nextRecord);

          return nextRecord;
        });
      } catch (error) {
        throw createRunStoreError(action, runId, filePath, error);
      }
    },

    markSectionFailed: async (
      runId: string,
      sectionId: SectionId,
      errorMessage: string,
    ): Promise<RunRecord> => {
      const action = "mark section failed";
      assertSafeRunId(action, rootDir, runId);
      assertLiveWritableRunId(action, rootDir, runId);

      const filePath = getRunFilePath(rootDir, runId);

      try {
        return await withSerializedRunWrite(filePath, async (): Promise<RunRecord> => {
          const record = await readRunRecordFromFile(
            action,
            rootDir,
            recordingsDir,
            runId,
          );
          const existingSection = record.sections[sectionId];

          if (!record.selectedSectionIds.includes(sectionId)) {
            throw createRunStoreError(
              action,
              runId,
              filePath,
              new Error(`sectionId ${sectionId} is not selected for this run`),
            );
          }

          const failedAt = getNowIsoString(now);
          const nextSectionRecord: SectionRunRecord = {
            sectionId,
            status: "failed",
            artifact: existingSection?.artifact ?? null,
            startedAt: existingSection?.startedAt ?? failedAt,
            completedAt: failedAt,
            error: errorMessage,
          };
          const sections = {
            ...record.sections,
            [sectionId]: nextSectionRecord,
          };
          const nextRecord = withUpdatedRunTimestamp(
            {
              ...record,
              sections,
              status: deriveRunStatus({ ...record, sections }),
            },
            now,
          );

          await persistRunRecord(rootDir, filePath, nextRecord);

          return nextRecord;
        });
      } catch (error) {
        throw createRunStoreError(action, runId, filePath, error);
      }
    },
  };
}

function sectionRunRecordFromArtifact({
  artifact,
  existingSection,
  now,
}: {
  artifact: ArtifactEnvelope;
  existingSection: SectionRunRecord | undefined;
  now: () => Date;
}): SectionRunRecord {
  return {
    sectionId: artifact.sectionId,
    status: "completed",
    artifact,
    startedAt: existingSection?.startedAt ?? null,
    completedAt: getNowIsoString(now),
    error: null,
  };
}
