import {
  POSITIONING_SECTION_IDS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import type { SeedOrchestrationResult } from '@/lib/research-v2/orchestrate-db';

export function buildSectionRunIdByZone(
  seeded: SeedOrchestrationResult,
): Record<PositioningSectionId, string> {
  const sectionRunIdByZone: Partial<Record<PositioningSectionId, string>> = {};

  for (const row of seeded.section_run_ids) {
    sectionRunIdByZone[row.section_id] = row.section_run_id;
  }

  for (const sectionId of POSITIONING_SECTION_IDS) {
    if (!sectionRunIdByZone[sectionId]) {
      throw new Error(`seed_orchestration did not return ${sectionId}`);
    }
  }

  return sectionRunIdByZone as Record<PositioningSectionId, string>;
}
