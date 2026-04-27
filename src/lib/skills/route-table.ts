// Single source of truth for v3 skill ↔ production dispatch wiring.
//
// Markdown mirror at .claude/workspaces/v3-migration/workspace-map.md is
// regenerated from this module via `npx tsx scripts/generate-workspace-map.ts`.
// If the doc and this file disagree, the code wins — regenerate the doc.
//
// Production routing today still goes through `src/app/api/journey/dispatch/route.ts`
// using `DISPATCH_PIPELINE_ORDER` + `SECTION_TO_TOOL` in that file, and the worker's
// `TOOL_RUNNERS` map in `research-worker/src/index.ts`. No skill is `Wired` yet, so
// dispatch does not consume this table at runtime — but every entry below names the
// production `workerTool` it will bridge to, so the wiring step is mechanical.

export type RouteKind =
  | 'ingest'      // populates brief / business profile / documents
  | 'research'    // produces a workspace card via dispatch pipeline
  | 'synthesize'  // produces a downstream artifact (positioning / media plan / scripts)
  | 'interaction' // edits existing cards (chat-refine), never dispatches
  | 'presenter';  // renders / maps cards (present-workspace), never dispatches

export type RouteStatus =
  | 'Stub'
  | "Spec'd"
  | 'Implementing'
  | 'Validated'
  | 'Wired'
  | 'Reviewed'
  | 'Merged';

// Production worker tool names. Mirrors `ToolName` in research-worker/src/index.ts.
export type WorkerTool =
  | 'researchIndustry'
  | 'researchCompetitors'
  | 'researchICP'
  | 'researchOffer'
  | 'synthesizeResearch'
  | 'researchKeywords'
  | 'researchMediaPlan'
  | 'resolveIdentity'
  | 'extractMeetingTranscript';

// Dispatch pipeline section keys. Mirrors `DISPATCH_PIPELINE_ORDER` in
// src/app/api/journey/dispatch/route.ts. Order in this union is the pipeline order.
export type DispatchSection =
  | 'identityResolution'
  | 'industryMarket'
  | 'icpValidation'
  | 'competitors'
  | 'offerAnalysis'
  | 'keywordIntel'
  | 'crossAnalysis'
  | 'mediaPlan';

export type RouteRow = {
  task: string;
  command: string;
  skill: string;
  kind: RouteKind;
  dispatchSection: DispatchSection | null;
  workerTool: WorkerTool | null;
  status: RouteStatus;
};

export const ROUTES_BY_SKILL = {
  'ingest-url': {
    task: 'URL intake',
    command: '/ingest-url',
    skill: 'ingest-url',
    kind: 'ingest',
    dispatchSection: null,
    workerTool: null,
    status: 'Validated',
  },
  'ingest-fathom': {
    task: 'Fathom call intake',
    command: '/ingest-fathom',
    skill: 'ingest-fathom',
    kind: 'ingest',
    dispatchSection: null,
    workerTool: 'extractMeetingTranscript',
    status: 'Validated',
  },
  'ingest-docs': {
    task: 'Document intake',
    command: '/ingest-docs',
    skill: 'ingest-docs',
    kind: 'ingest',
    dispatchSection: null,
    workerTool: null,
    status: 'Validated',
  },
  'ingest-identity': {
    task: 'Identity resolution',
    command: '/ingest-identity',
    skill: 'ingest-identity',
    kind: 'ingest',
    dispatchSection: 'identityResolution',
    workerTool: 'resolveIdentity',
    status: 'Validated',
  },
  'research-market': {
    task: 'Market research',
    command: '/research-market',
    skill: 'research-market',
    kind: 'research',
    dispatchSection: 'industryMarket',
    workerTool: 'researchIndustry',
    status: 'Validated',
  },
  'research-icp': {
    task: 'ICP research',
    command: '/research-icp',
    skill: 'research-icp',
    kind: 'research',
    dispatchSection: 'icpValidation',
    workerTool: 'researchICP',
    status: 'Validated',
  },
  'research-competitor': {
    task: 'Competitor research',
    command: '/research-competitor',
    skill: 'research-competitor',
    kind: 'research',
    dispatchSection: 'competitors',
    workerTool: 'researchCompetitors',
    status: 'Validated',
  },
  'research-offer': {
    task: 'Offer diagnostic',
    command: '/research-offer',
    skill: 'research-offer',
    kind: 'research',
    dispatchSection: 'offerAnalysis',
    workerTool: 'researchOffer',
    status: 'Validated',
  },
  'research-keywords': {
    task: 'Keyword intelligence',
    command: '/research-keywords',
    skill: 'research-keywords',
    kind: 'research',
    dispatchSection: 'keywordIntel',
    workerTool: 'researchKeywords',
    status: 'Validated',
  },
  'research-voc': {
    task: 'Voice of customer',
    command: '/research-voc',
    skill: 'research-voc',
    kind: 'research',
    dispatchSection: null,
    workerTool: null,
    status: 'Validated',
  },
  'research-cross': {
    task: 'Cross-section synthesis',
    command: '/research-cross',
    skill: 'research-cross',
    kind: 'research',
    dispatchSection: 'crossAnalysis',
    workerTool: 'synthesizeResearch',
    status: 'Validated',
  },
  'synthesize-positioning': {
    task: 'Positioning synthesis',
    command: '/synthesize-positioning',
    skill: 'synthesize-positioning',
    kind: 'synthesize',
    dispatchSection: null,
    workerTool: null,
    status: 'Validated',
  },
  'synthesize-media-plan': {
    task: 'Media plan synthesis',
    command: '/synthesize-media-plan',
    skill: 'synthesize-media-plan',
    kind: 'synthesize',
    dispatchSection: 'mediaPlan',
    workerTool: 'researchMediaPlan',
    status: 'Validated',
  },
  'synthesize-scripts': {
    task: 'Script synthesis',
    command: '/synthesize-scripts',
    skill: 'synthesize-scripts',
    kind: 'synthesize',
    dispatchSection: null,
    workerTool: null,
    status: 'Validated',
  },
  'chat-refine': {
    task: 'Card refinement chat',
    command: '/chat-refine',
    skill: 'chat-refine',
    kind: 'interaction',
    dispatchSection: null,
    workerTool: null,
    status: "Spec'd",
  },
  'present-workspace': {
    task: 'Workspace presentation',
    command: '/present-workspace',
    skill: 'present-workspace',
    kind: 'presenter',
    dispatchSection: null,
    workerTool: null,
    status: 'Validated',
  },
} as const satisfies Record<string, RouteRow>;

export type SkillName = keyof typeof ROUTES_BY_SKILL;

export const ROUTE_TABLE: readonly RouteRow[] = Object.values(ROUTES_BY_SKILL);

export const ROUTES_BY_DISPATCH_SECTION: Readonly<Partial<Record<DispatchSection, RouteRow>>> =
  Object.freeze(
    ROUTE_TABLE.reduce<Partial<Record<DispatchSection, RouteRow>>>((acc, row) => {
      if (row.dispatchSection) acc[row.dispatchSection] = row;
      return acc;
    }, {}),
  );

export const ROUTES_BY_WORKER_TOOL: Readonly<Partial<Record<WorkerTool, RouteRow>>> =
  Object.freeze(
    ROUTE_TABLE.reduce<Partial<Record<WorkerTool, RouteRow>>>((acc, row) => {
      if (row.workerTool) acc[row.workerTool] = row;
      return acc;
    }, {}),
  );

// Only `Wired` rows are safe to call from production dispatch. Everything else is
// still going through legacy `dispatch/route.ts` → worker `TOOL_RUNNERS` directly.
export function isDispatchable(row: RouteRow): boolean {
  return row.status === 'Wired';
}
