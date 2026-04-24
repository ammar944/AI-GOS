import { GTM_STAGE_KEYS, type GtmStageKey } from '@/lib/gtm/schemas/gtm-run';

export function firstStage(): GtmStageKey {
  return GTM_STAGE_KEYS[0];
}

export function stageIndex(stage: GtmStageKey): number {
  return GTM_STAGE_KEYS.indexOf(stage);
}

export function nextStage(stage: GtmStageKey): GtmStageKey | null {
  const idx = stageIndex(stage);
  if (idx < 0 || idx >= GTM_STAGE_KEYS.length - 1) return null;
  return GTM_STAGE_KEYS[idx + 1];
}

export function previousStage(stage: GtmStageKey): GtmStageKey | null {
  const idx = stageIndex(stage);
  if (idx <= 0) return null;
  return GTM_STAGE_KEYS[idx - 1];
}

export function isTerminalStage(stage: GtmStageKey): boolean {
  return stageIndex(stage) === GTM_STAGE_KEYS.length - 1;
}
