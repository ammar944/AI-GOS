/**
 * Section-to-shell mapping — single source of truth.
 * Both artifact-canvas.tsx (workspace) and research-document.tsx (document)
 * import this to route sections to the correct shell layout.
 */

export type ShellType = 'signal-board' | 'entity-compare' | 'synthesis-cockpit' | 'ops-board' | 'keyword-table' | 'default';

/** Maps research section keys to their shell layout type */
export const SECTION_SHELL_MAP: Record<string, ShellType> = {
  industryMarket: 'signal-board',
  icpValidation: 'signal-board',
  offerAnalysis: 'signal-board',
  competitors: 'entity-compare',
  keywordIntel: 'keyword-table',
  crossAnalysis: 'synthesis-cockpit',
  mediaPlan: 'ops-board',
} as const;

/** Get shell type for a section, defaulting to 'default' */
export function getShellType(sectionKey: string): ShellType {
  return SECTION_SHELL_MAP[sectionKey] ?? 'default';
}

/**
 * Card type groupings within signal-board shell.
 * Used to separate cards into zones: stats at top, content in middle, prose at bottom.
 */
export const SIGNAL_BOARD_ZONES = {
  stats: new Set(['stat-grid']),
  tables: new Set(['ice-table', 'keyword-grid']),
  lists: new Set(['bullet-list', 'check-list', 'offer-statement-list']),
  prose: new Set(['prose-card']),
  callouts: new Set(['insight-card', 'strategy-card', 'trend-card', 'verdict-card', 'flag-card', 'pricing-card']),
} as const;

/**
 * Card type groupings within synthesis-cockpit shell.
 */
export const SYNTHESIS_ZONES = {
  insights: new Set(['insight-card']),
  strategy: new Set(['strategy-card']),
  angles: new Set(['angle-card']),
  prose: new Set(['prose-card']),
  lists: new Set(['bullet-list', 'check-list']),
} as const;

/**
 * Card type groupings within ops-board shell.
 */
export const OPS_BOARD_ZONES = {
  hero: new Set(['strategy-snapshot']),
  stats: new Set(['stat-grid', 'budget-summary', 'kpi-grid', 'cac-model']),
  charts: new Set(['pie-chart', 'funnel-split-chart', 'cac-funnel-chart', 'kpi-benchmark-chart', 'phase-budget-chart', 'chart-card']),
  platforms: new Set(['platform-card']),
  campaigns: new Set(['campaign-card', 'segment-card', 'creative-angle']),
  execution: new Set(['phase-card', 'format-spec', 'testing-plan']),
  risks: new Set(['risk-card']),
  lists: new Set(['bullet-list', 'check-list']),
  prose: new Set(['prose-card']),
} as const;
