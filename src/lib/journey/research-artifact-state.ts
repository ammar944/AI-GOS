import {
  parseJourneyArtifactEvent,
  type JourneyArtifactEvent,
  type JourneyArtifactSectionStatus,
} from '@/lib/journey/research-artifact-events';

type SourceUrls = Set<string>;

export type JourneyArtifactStatus =
  | 'idle'
  | 'streaming'
  | 'partial'
  | 'complete'
  | 'error';

export interface JourneyArtifactSection {
  section: string;
  title: string;
  content: string;
  status: JourneyArtifactSectionStatus;
  sourceUrls: string[];
}

export interface JourneyArtifactState {
  title: string;
  status: JourneyArtifactStatus;
  activeSection: string | null;
  sections: JourneyArtifactSection[];
}

export interface JourneyArtifactProgressUpdateLike {
  at?: string;
  message: string;
  phase?: string;
  meta?: unknown;
}

export interface JourneyArtifactActivityLike {
  updates?: JourneyArtifactProgressUpdateLike[];
}

export interface JourneyArtifactResultLike {
  status?: string;
  data?: unknown;
  artifact?: unknown;
}

export interface JourneyArtifactStepLike {
  section: string;
  name: string;
  status: 'idle' | 'running' | 'complete' | 'partial' | 'error';
  activity?: JourneyArtifactActivityLike;
  result?: JourneyArtifactResultLike | null;
}

export interface BuildJourneyArtifactStateOptions {
  activeRunId: string | null;
  visibleSteps: readonly JourneyArtifactStepLike[];
}

const DEFAULT_ARTIFACT_TITLE = 'Live GTM Research Artifact';

const SECTION_TITLES: Record<string, string> = {
  deepResearchProgram: 'Company Research',
  industryMarket: 'Market Category',
  icpValidation: 'Buyer / ICP',
  competitors: 'Competitive Positioning',
  offerAnalysis: 'Offer Diagnostic',
  keywordIntel: 'Demand Intent',
  crossAnalysis: 'GTM Synthesis',
  mediaPlan: 'Activation Plan',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => readString(item))
    .filter((item): item is string => Boolean(item));
}

function getResultData(result: JourneyArtifactResultLike | null | undefined): Record<string, unknown> | null {
  const data = isRecord(result?.data) ? result.data : null;
  const artifact = isRecord(result?.artifact) ? result.artifact : null;

  if (data && artifact) {
    return { ...data, artifact };
  }

  if (data) {
    return data;
  }

  if (artifact) {
    return { artifact };
  }

  return null;
}

function defaultSectionTitle(section: string, fallbackName: string): string {
  return SECTION_TITLES[section] ?? fallbackName;
}

function stepStatusToArtifactStatus(
  status: JourneyArtifactStepLike['status'],
): JourneyArtifactSectionStatus {
  if (status === 'running') {
    return 'drafting';
  }

  if (status === 'complete' || status === 'partial' || status === 'error') {
    return status;
  }

  return 'queued';
}

function collectSourceUrls(value: unknown, urls: SourceUrls): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSourceUrls(item, urls);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      (key === 'url' || key === 'sourceUrl') &&
      typeof child === 'string' &&
      /^https?:\/\//iu.test(child)
    ) {
      urls.add(child);
      continue;
    }

    collectSourceUrls(child, urls);
  }
}

function readFindingLines(data: Record<string, unknown>): string[] {
  const findings = Array.isArray(data.keyFindings) ? data.keyFindings : [];

  return findings.flatMap((finding) => {
    if (!isRecord(finding)) {
      return [];
    }

    const title = readString(finding.title);
    const detail =
      readString(finding.detail) ??
      readString(finding.evidence) ??
      readString(finding.claim);

    if (title && detail) {
      return [`- ${title}: ${detail}`];
    }

    if (title || detail) {
      return [`- ${title ?? detail ?? ''}`];
    }

    return [];
  });
}

function readEvidenceQuoteLines(data: Record<string, unknown>): string[] {
  const quotes = Array.isArray(data.evidenceQuotes) ? data.evidenceQuotes : [];

  return quotes.flatMap((quote) => {
    if (!isRecord(quote)) {
      return [];
    }

    const text = readString(quote.quote);
    const interpretation = readString(quote.interpretation);
    const source = readString(quote.source);

    if (!text && !interpretation) {
      return [];
    }

    return [
      `- ${text ?? interpretation}${source ? ` (${source})` : ''}`,
    ];
  });
}

function readSourcesLines(data: Record<string, unknown>): string[] {
  const sources = Array.isArray(data.sources) ? data.sources : [];

  return sources.flatMap((source) => {
    if (!isRecord(source)) {
      return [];
    }

    const title = readString(source.title);
    const url = readString(source.url);
    const whyItMatters = readString(source.whyItMatters);

    if (!title && !url) {
      return [];
    }

    return [
      `- ${title ?? url}${url ? ` (${url})` : ''}${whyItMatters ? `: ${whyItMatters}` : ''}`,
    ];
  });
}

function formatGenericSectionResult(data: Record<string, unknown>): string {
  const parts = [
    readString(data.statusSummary),
    readString(data.verdict),
  ].filter((part): part is string => Boolean(part));
  const findings = readFindingLines(data);
  const quotes = readEvidenceQuoteLines(data);
  const moves = readStringArray(data.recommendedMoves).map((move) => `- ${move}`);
  const gaps = readStringArray(data.risksOrGaps).map((gap) => `- ${gap}`);
  const sources = readSourcesLines(data);
  const sections = [
    ...parts,
    findings.length > 0 ? `### Key Findings\n${findings.join('\n')}` : null,
    quotes.length > 0 ? `### Evidence\n${quotes.join('\n')}` : null,
    moves.length > 0 ? `### Recommended Moves\n${moves.join('\n')}` : null,
    gaps.length > 0 ? `### Risks / Gaps\n${gaps.join('\n')}` : null,
    sources.length > 0 ? `### Sources\n${sources.join('\n')}` : null,
  ].filter((part): part is string => Boolean(part));

  return sections.join('\n\n');
}

function formatDeepResearchResult(data: Record<string, unknown>): string {
  const artifact = isRecord(data.artifact) ? data.artifact : null;
  const artifactMarkdown = readString(artifact?.markdown);
  if (artifactMarkdown) {
    return artifactMarkdown;
  }

  const corpus = isRecord(data.corpus) ? data.corpus : data;
  const summary = readString(corpus.researchSummary);
  const evidence = Array.isArray(corpus.evidence) ? corpus.evidence : [];
  const evidenceLines = evidence.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const claim = readString(item.claim);
    const quote = readString(item.quote);
    const source = readString(item.source);

    if (!claim && !quote) {
      return [];
    }

    return [
      `- ${claim ?? quote}${source ? ` (${source})` : ''}`,
    ];
  });
  const sources = readSourcesLines(corpus);
  const sections = [
    summary,
    evidenceLines.length > 0
      ? `### Evidence Highlights\n${evidenceLines.join('\n')}`
      : null,
    sources.length > 0 ? `### Sources\n${sources.join('\n')}` : null,
  ].filter((part): part is string => Boolean(part));

  return sections.join('\n\n');
}

function formatResultContent(
  section: string,
  data: Record<string, unknown> | null,
): string {
  if (!data) {
    return '';
  }

  if (section === 'deepResearchProgram') {
    return formatDeepResearchResult(data);
  }

  return formatGenericSectionResult(data);
}

function defaultSectionContent(section: string, name: string): string {
  if (section === 'deepResearchProgram') {
    return 'Research Agent is building the source-backed corpus...';
  }

  return `${name} is preparing this report section from the saved corpus...`;
}

function sortUpdates(
  updates: readonly JourneyArtifactProgressUpdateLike[] | undefined,
): JourneyArtifactProgressUpdateLike[] {
  return [...(updates ?? [])].sort((left, right) =>
    (left.at ?? '').localeCompare(right.at ?? ''),
  );
}

function getArtifactEvents(step: JourneyArtifactStepLike) {
  return sortUpdates(step.activity?.updates)
    .map((update) => parseJourneyArtifactEvent(update, step.section))
    .filter((event): event is JourneyArtifactEvent => event !== null);
}

function readProgressMeta(
  update: JourneyArtifactProgressUpdateLike,
): Record<string, unknown> | null {
  return isRecord(update.meta) ? update.meta : null;
}

function formatLiveActivityUpdate(
  update: JourneyArtifactProgressUpdateLike,
): string | null {
  if (update.phase === 'artifact') {
    return null;
  }

  const meta = readProgressMeta(update);
  const url = readString(meta?.url);
  const pageTitle = readString(meta?.pageTitle);
  const toolName = readString(meta?.toolName);
  const message = update.message.trim();
  if (message.length === 0) {
    return null;
  }

  if (url) {
    return `- Source found: [${pageTitle ?? url}](${url})`;
  }

  if (toolName === 'web_search' && typeof meta?.resultCount === 'number') {
    return `- Source search returned ${meta.resultCount} results.`;
  }

  if (update.phase === 'tool') {
    return `- ${message}`;
  }

  if (update.phase === 'analysis') {
    return `- ${message}`;
  }

  if (update.phase === 'output') {
    return `- ${message}`;
  }

  if (update.phase === 'error') {
    return `- ${message}`;
  }

  return null;
}

function formatLiveActivityContent(
  step: JourneyArtifactStepLike,
): string {
  const lines = sortUpdates(step.activity?.updates)
    .map(formatLiveActivityUpdate)
    .filter((line): line is string => Boolean(line));

  if (lines.length === 0) {
    return '';
  }

  return `### Live Research Activity\n${lines.slice(-18).join('\n')}`;
}

function collectActivitySourceUrls(
  step: JourneyArtifactStepLike,
  urls: SourceUrls,
): void {
  for (const update of step.activity?.updates ?? []) {
    const meta = readProgressMeta(update);
    const url = readString(meta?.url);
    if (url && /^https?:\/\//iu.test(url)) {
      urls.add(url);
    }
  }
}

function applyArtifactEvents(
  step: JourneyArtifactStepLike,
  fallbackTitle: string,
): {
  content: string;
  title: string;
  status: JourneyArtifactSectionStatus;
  artifactTitle: string | null;
} {
  let content = '';
  let title = fallbackTitle;
  let status = stepStatusToArtifactStatus(step.status);
  let artifactTitle: string | null = null;

  for (const event of getArtifactEvents(step)) {
    if (event.title) {
      if (event.section === 'deepResearchProgram') {
        artifactTitle = event.title;
      }
      title = event.section === step.section ? event.title : title;
    }

    if (event.type === 'artifact-clear') {
      content = '';
      continue;
    }

    if (event.type === 'artifact-delta') {
      content += event.delta;
      continue;
    }

    if (event.type === 'artifact-section-state') {
      status = event.status;
      continue;
    }

    if (event.type === 'artifact-finish') {
      status = 'complete';
    }
  }

  return {
    content,
    title,
    status,
    artifactTitle,
  };
}

function buildArtifactSection(step: JourneyArtifactStepLike): {
  section: JourneyArtifactSection;
  artifactTitle: string | null;
} | null {
  if (step.status === 'idle') {
    return null;
  }

  const data = getResultData(step.result);
  const resultArtifact = isRecord(data?.artifact) ? data.artifact : null;
  const fallbackTitle =
    readString(resultArtifact?.title) ??
    readString(data?.sectionTitle) ??
    defaultSectionTitle(step.section, step.name);
  const eventState = applyArtifactEvents(step, fallbackTitle);
  const resultContent =
    step.status === 'complete' || step.status === 'partial'
      ? formatResultContent(step.section, data)
      : '';
  const liveActivityContent =
    step.status === 'running' ? formatLiveActivityContent(step) : '';
  const eventContent = eventState.content.trim();
  const runningBaseContent =
    step.status === 'running' && eventContent.length === 0
      ? defaultSectionContent(step.section, step.name)
      : eventContent;
  const streamingContent = [
    runningBaseContent,
    liveActivityContent,
  ].filter((part) => part.length > 0).join('\n\n');
  const content =
    resultContent.trim().length > 0
      ? resultContent
      : streamingContent.length > 0
        ? streamingContent
        : defaultSectionContent(step.section, step.name);
  const sourceUrls = new Set<string>();
  collectSourceUrls(data, sourceUrls);
  collectActivitySourceUrls(step, sourceUrls);

  return {
    artifactTitle: eventState.artifactTitle,
    section: {
      section: step.section,
      title: eventState.title,
      status: eventState.status,
      content,
      sourceUrls: [...sourceUrls],
    },
  };
}

function computeArtifactStatus(
  sections: readonly JourneyArtifactSection[],
): JourneyArtifactStatus {
  if (sections.length === 0) {
    return 'idle';
  }

  if (sections.some((section) => section.status === 'error')) {
    return 'error';
  }

  if (
    sections.some((section) =>
      section.status === 'drafting' ||
      section.status === 'researching' ||
      section.status === 'citing' ||
      section.status === 'queued',
    )
  ) {
    return 'streaming';
  }

  if (sections.some((section) => section.status === 'partial')) {
    return 'partial';
  }

  return 'complete';
}

function getActiveArtifactSection(
  sections: readonly JourneyArtifactSection[],
): string | null {
  const active = sections.find((section) =>
    section.status === 'drafting' ||
    section.status === 'researching' ||
    section.status === 'citing' ||
    section.status === 'queued',
  );

  return active?.section ?? null;
}

export function buildJourneyArtifactState({
  visibleSteps,
}: BuildJourneyArtifactStateOptions): JourneyArtifactState {
  const sections: JourneyArtifactSection[] = [];
  let title = DEFAULT_ARTIFACT_TITLE;

  for (const step of visibleSteps) {
    const built = buildArtifactSection(step);
    if (!built) {
      continue;
    }

    sections.push(built.section);
    if (built.artifactTitle) {
      title = built.artifactTitle;
    }
  }

  return {
    title,
    status: computeArtifactStatus(sections),
    activeSection: getActiveArtifactSection(sections),
    sections,
  };
}
