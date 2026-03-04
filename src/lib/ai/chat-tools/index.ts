// Chat Tools - barrel export and factory function

export { createSearchBlueprintTool } from './search-blueprint';
export { createEditBlueprintTool } from './edit-blueprint';
export { createExplainBlueprintTool } from './explain-blueprint';
export { createWebResearchTool } from './web-research';
export { createQueryBlueprintTool } from './query-blueprint';
export { createDeepDiveTool } from './deep-dive';
export { buildBlueprintIndex } from './blueprint-index';
export type { BlueprintIndex, SectionSummary } from './blueprint-index';
export {
  getValueAtPath,
  generateDiffPreview,
  calculateConfidence,
  buildSourceQuality,
  summarizeBlueprint,
  applyEdits,
  applySingleEdit,
  SECTION_LABELS,
} from './utils';

import { createSearchBlueprintTool } from './search-blueprint';
import { createEditBlueprintTool } from './edit-blueprint';
import { createExplainBlueprintTool } from './explain-blueprint';
import { createWebResearchTool } from './web-research';
import { createQueryBlueprintTool } from './query-blueprint';
import { createDeepDiveTool } from './deep-dive';

/**
 * Create all chat tools for a given blueprint context.
 * Returns a tools object suitable for streamText().
 *
 * Tool count: 6 (was 4 — added queryBlueprint + deepDive for progressive disclosure)
 */
export function createChatTools(blueprintId: string, blueprint: Record<string, unknown>) {
  return {
    searchBlueprint: createSearchBlueprintTool(blueprint),
    editBlueprint: createEditBlueprintTool(blueprint),
    explainBlueprint: createExplainBlueprintTool(blueprint),
    webResearch: createWebResearchTool(),
    queryBlueprint: createQueryBlueprintTool(blueprint),
    deepDive: createDeepDiveTool(blueprint),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
