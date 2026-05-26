import {
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import type { SeedOrchestrationResult } from '@/lib/research-v2/orchestrate-db';

export function buildSectionRunIdByZone<
  TSectionId extends AllPositioningSectionId,
>(
  seeded: SeedOrchestrationResult,
  expectedZones: readonly TSectionId[] = POSITIONING_SECTION_IDS as unknown as readonly TSectionId[],
): Record<TSectionId, string> {
  const sectionRunIdByZone: Partial<Record<TSectionId, string>> = {};
  const expectedZoneSet: ReadonlySet<string> = new Set(expectedZones);

  for (const row of seeded.section_run_ids) {
    if (expectedZoneSet.has(row.section_id)) {
      sectionRunIdByZone[row.section_id as TSectionId] = row.section_run_id;
    }
  }

  for (const sectionId of expectedZones) {
    if (!sectionRunIdByZone[sectionId]) {
      throw new Error(`seed_orchestration did not return ${sectionId}`);
    }
  }

  return sectionRunIdByZone as Record<TSectionId, string>;
}
