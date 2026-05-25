import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import {
  runSection,
  type RunSectionDeps,
  type RunSectionInput,
  type RunSectionResult,
} from '@/lib/lab-engine/agents/run-section';
import type { RunStore } from '@/lib/lab-engine/runs/run-store';
import {
  isSupportedSectionId,
  type SupportedSectionId,
} from '@/lib/lab-engine/sections/section-registry';

export type LabRunSection = (
  input: RunSectionInput,
  deps: RunSectionDeps,
) => Promise<RunSectionResult>;

export interface RunLabSectionJobInput {
  runId: string;
  sectionId: PositioningSectionId;
  store: RunStore;
  runSectionImpl?: LabRunSection;
}

export async function runLabSectionJob(
  input: RunLabSectionJobInput,
): Promise<void> {
  const sectionId = toSupportedSectionId(input.sectionId);
  const runSectionImpl = input.runSectionImpl ?? runSection;

  try {
    await runSectionImpl(
      { runId: input.runId, sectionId },
      {
        store: input.store,
        loadSkill: loadLabSkill,
        allowedTools: getLabEngineAllowedTools(),
      },
    );
  } catch (err) {
    const message = getErrorMessage(err);
    console.error('[lab-section-job] section failed', {
      runId: input.runId,
      sectionId,
      message,
    });
    await input.store.markSectionFailed(input.runId, sectionId, message);
  }
}

function toSupportedSectionId(sectionId: PositioningSectionId): SupportedSectionId {
  if (!isSupportedSectionId(sectionId)) {
    throw new Error(`Unsupported lab section id ${sectionId}`);
  }

  return sectionId;
}

function getLabEngineAllowedTools(): RunSectionDeps['allowedTools'] {
  return process.env.LAB_ENGINE_LIVE_TOOLS === 'true' ? undefined : [];
}

async function loadLabSkill(slug: string): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid lab skill slug ${slug}`);
  }

  const skillPath = join(
    process.cwd(),
    'src',
    'lib',
    'lab-engine',
    'skills',
    slug,
    'SKILL.md',
  );

  return readFile(skillPath, 'utf8');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
