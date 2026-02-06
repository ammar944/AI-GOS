// Chat Tools - barrel export and factory function

export { createSearchBlueprintTool } from './search-blueprint';
export { createEditBlueprintTool } from './edit-blueprint';
export { createExplainBlueprintTool } from './explain-blueprint';
export { createWebResearchTool } from './web-research';
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

/**
 * Create all chat tools for a given blueprint context.
 * Returns a tools object suitable for streamText().
 */
export function createChatTools(blueprintId: string, blueprint: Record<string, unknown>) {
  return {
    searchBlueprint: createSearchBlueprintTool(blueprint),
    editBlueprint: createEditBlueprintTool(blueprint),
    explainBlueprint: createExplainBlueprintTool(blueprint),
    webResearch: createWebResearchTool(),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
