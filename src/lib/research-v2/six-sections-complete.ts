import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';

/**
 * Client-side "are all six positioning sections complete?" predicate. Prefers
 * the SQL-backed rollup count (`children_complete`, capstone-excluded); falls
 * back to an OR of worker-row-complete | artifact-body-present per zone so an
 * open-tab client can trigger paid-media even if a worker row lags behind its
 * committed artifact during the projection race (the claimSectionRun CAS dedups
 * against the server trigger). Extracted from use-audit-state.ts and
 * audit-reader-shell.tsx, which carried byte-identical copies.
 *
 * NOT a substitute for the server dispatch gate or deriveParentStatus, whose
 * semantics are intentionally stricter — see Phase 6 handoff.
 */
export function hasSixPositioningSectionsComplete(
  state: AuditStateResponse,
): boolean {
  if (state.children_complete >= POSITIONING_SECTION_IDS.length) {
    return true;
  }

  return POSITIONING_SECTION_IDS.every((sectionId) => {
    const worker = state.workerStates.find(
      (workerState) => workerState.section_id === sectionId,
    );
    return (
      worker?.status === 'complete' ||
      state.sectionsByZone[sectionId] !== undefined
    );
  });
}
