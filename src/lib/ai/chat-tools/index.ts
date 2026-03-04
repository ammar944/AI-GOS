// Chat Tools - barrel export and factory function

export { createSearchBlueprintTool } from './search-blueprint';
export { createEditBlueprintTool } from './edit-blueprint';
export { createExplainBlueprintTool } from './explain-blueprint';
export { createWebResearchTool } from './web-research';
export { createDeepResearchTool } from './deep-research';
export { createGenerateSectionTool } from './generate-section';
export { createCompareCompetitorsTool } from './compare-competitors';
export { createAnalyzeMetricsTool } from './analyze-metrics';
export { createVisualizationTool } from './create-visualization';
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
import { createDeepResearchTool } from './deep-research';
import { createGenerateSectionTool } from './generate-section';
import { createCompareCompetitorsTool } from './compare-competitors';
import { createAnalyzeMetricsTool } from './analyze-metrics';
import { createVisualizationTool } from './create-visualization';
import { createQueryBlueprintTool } from './query-blueprint';
import { createDeepDiveTool } from './deep-dive';

/**
 * Create all chat tools for a given blueprint context.
 * Returns a tools object suitable for streamText().
 *
 * Tool count: 11 (was 9 — added queryBlueprint + deepDive for progressive disclosure)
 */
export function createChatTools(blueprintId: string, blueprint: Record<string, unknown>) {
  return {
    searchBlueprint: createSearchBlueprintTool(blueprint),
    editBlueprint: createEditBlueprintTool(blueprint),
    explainBlueprint: createExplainBlueprintTool(blueprint),
    webResearch: createWebResearchTool(),
    deepResearch: createDeepResearchTool(),
    generateSection: createGenerateSectionTool(blueprint),
    compareCompetitors: createCompareCompetitorsTool(blueprint),
    analyzeMetrics: createAnalyzeMetricsTool(blueprint),
    createVisualization: createVisualizationTool(blueprint),
    queryBlueprint: createQueryBlueprintTool(blueprint),
    deepDive: createDeepDiveTool(blueprint),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
