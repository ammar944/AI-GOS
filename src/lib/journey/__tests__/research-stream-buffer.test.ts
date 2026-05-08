import { describe, expect, it } from 'vitest';
import {
  buildDeepResearchAgentStreamState,
  flushBufferedResearchChunks,
} from '../research-stream-buffer';

interface TestArtifactSection {
  section: string;
  title: string;
  content: string;
  status: string;
  sourceUrls: string[];
}

interface TestArtifactState {
  title: string;
  status: string;
  activeSection: string | null;
  sections: TestArtifactSection[];
}

function getArtifactState(state: unknown): TestArtifactState {
  return (state as { artifact: TestArtifactState }).artifact;
}

describe('flushBufferedResearchChunks', () => {
  it('merges buffered chunks and status patches into a single state update', () => {
    const next = flushBufferedResearchChunks(
      {
        industryResearch: {
          text: 'Existing ',
          status: 'running',
          startedAt: 100,
        },
      },
      {
        chunkBuffers: {
          industryResearch: ['delta 1', 'delta 2'],
          keywordIntel: ['new text'],
        },
        statusPatches: {
          keywordIntel: {
            status: 'running',
            startedAt: 200,
          },
          industryResearch: {
            status: 'complete',
          },
        },
      },
    );

    expect(next).toEqual({
      industryResearch: {
        text: 'Existing delta 1delta 2',
        status: 'complete',
        startedAt: 100,
      },
      keywordIntel: {
        text: 'new text',
        status: 'running',
        startedAt: 200,
      },
    });
  });

  it('resets stale text when a fresh run restarts a section', () => {
    const next = flushBufferedResearchChunks(
      {
        industryResearch: {
          text: 'Old completed text',
          status: 'complete',
          startedAt: 100,
        },
      },
      {
        chunkBuffers: {
          industryResearch: ['Fresh delta'],
        },
        statusPatches: {
          industryResearch: {
            status: 'running',
            startedAt: 200,
          },
        },
      },
    );

    expect(next).toEqual({
      industryResearch: {
        text: 'Fresh delta',
        status: 'running',
        startedAt: 200,
      },
    });
  });
});

describe('buildDeepResearchAgentStreamState', () => {
  it('shows Research Agent as the first visible assistant step and hides inactive specialists', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-1',
      deepResearchStatus: 'starting',
      phase: 'prefilling',
      researchActivity: {},
      researchResults: {},
    });

    expect(state.visibleSteps.map((step) => step.section)).toEqual([
      'deepResearchProgram',
    ]);
    expect(state.visibleSteps[0]).toMatchObject({
      name: 'Research Agent',
      status: 'running',
    });
    expect(state.hiddenSections).toContain('industryMarket');
    expect(state.hiddenSections).toContain('competitors');
    expect(state.assistantOpening).toContain('Research Agent');
  });

  it('does not fabricate a streaming artifact from a restored run id alone', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-restored',
      deepResearchStatus: 'idle',
      phase: 'workspace',
      researchActivity: {},
      researchResults: {},
    });

    const artifact = getArtifactState(state);

    expect(state.hasRunStarted).toBe(false);
    expect(state.visibleSteps).toEqual([]);
    expect(artifact.status).toBe('idle');
    expect(artifact.sections).toEqual([]);
    expect(state.assistantOpening).toContain('ready');
  });

  it('reveals persisted downstream sections even when the deep research result is absent', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-restored',
      deepResearchStatus: 'idle',
      phase: 'workspace',
      researchActivity: {},
      researchResults: {
        industryMarket: {
          status: 'complete',
          section: 'industryMarket',
          data: {
            sectionTitle: 'Market Category',
            statusSummary: 'Market section is persisted.',
          },
          durationMs: 1000,
        },
      },
    });

    const artifact = getArtifactState(state);

    expect(state.visibleSteps.map((step) => step.section)).toEqual([
      'industryMarket',
    ]);
    expect(state.bufferedSteps).toEqual([]);
    expect(artifact.sections.map((section) => section.section)).toEqual([
      'industryMarket',
    ]);
    expect(artifact.sections[0]?.content).toContain('Market section is persisted.');
  });

  it('builds the first live artifact section from typed Deep Research artifact events', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-1',
      deepResearchStatus: 'starting',
      phase: 'prefilling',
      researchActivity: {
        deepResearchProgram: {
          jobId: 'job-deep',
          section: 'deepResearchProgram',
          status: 'running',
          tool: 'runDeepResearchProgram',
          startedAt: '2026-05-07T09:00:00.000Z',
          updates: [
            {
              at: '2026-05-07T09:00:01.000Z',
              id: 'artifact-clear',
              message: 'Airtable GTM Research',
              phase: 'artifact',
              meta: {
                eventType: 'artifact-clear',
                section: 'deepResearchProgram',
                title: 'Airtable GTM Research',
              },
            },
            {
              at: '2026-05-07T09:00:02.000Z',
              id: 'artifact-delta',
              message: '# Airtable GTM Research\n\n## Deep Research\n\nAirtable is positioned as an app platform for teams.',
              phase: 'artifact',
              meta: {
                eventType: 'artifact-delta',
                section: 'deepResearchProgram',
              },
            },
          ],
        },
      },
      researchResults: {},
    });

    const artifact = getArtifactState(state);
    expect(artifact.title).toBe('Airtable GTM Research');
    expect(artifact.activeSection).toBe('deepResearchProgram');
    expect(artifact.sections).toHaveLength(1);
    expect(artifact.sections[0]).toMatchObject({
      section: 'deepResearchProgram',
      status: 'drafting',
    });
    expect(artifact.sections[0]?.content).toContain(
      'Airtable is positioned as an app platform for teams.',
    );
  });

  it('adds live tool and analysis updates to the streaming artifact body', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-1',
      deepResearchStatus: 'starting',
      phase: 'prefilling',
      researchActivity: {
        deepResearchProgram: {
          jobId: 'job-deep',
          section: 'deepResearchProgram',
          status: 'running',
          tool: 'runDeepResearchProgram',
          startedAt: '2026-05-07T09:00:00.000Z',
          updates: [
            {
              at: '2026-05-07T09:00:01.000Z',
              id: 'log-1',
              message: 'Opened Airtable pricing page.',
              phase: 'tool',
            },
            {
              at: '2026-05-07T09:00:02.000Z',
              id: 'legacy-draft-log',
              message: 'draft This generic log must not become report prose.',
              phase: 'analysis',
            },
          ],
        },
      },
      researchResults: {},
    });

    const artifact = getArtifactState(state);
    expect(artifact.sections).toHaveLength(1);
    expect(artifact.sections[0]?.section).toBe('deepResearchProgram');
    expect(artifact.sections[0]?.content).toContain(
      'Research Agent is building the source-backed corpus',
    );
    expect(artifact.sections[0]?.content).toContain(
      '### Live Research Activity',
    );
    expect(artifact.sections[0]?.content).toContain(
      'Opened Airtable pricing page',
    );
    expect(artifact.sections[0]?.content).toContain(
      'draft This generic log must not become report prose',
    );
  });

  it('hydrates completed artifact content and sources from persisted section results', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-1',
      deepResearchStatus: 'complete',
      phase: 'workspace',
      researchActivity: {},
      researchResults: {
        deepResearchProgram: {
          status: 'complete',
          section: 'deepResearchProgram',
          artifact: {
            title: 'Airtable GTM Research',
            markdown: '## Deep Research\n\nDurable Deep Research artifact from persisted result.',
          },
          data: {
            corpus: {
              company: 'Airtable',
              researchSummary: 'Airtable sells a connected app platform for operational teams.',
              sources: [
                {
                  title: 'Airtable product',
                  url: 'https://www.airtable.com/product',
                  whyItMatters: 'Primary product positioning.',
                },
              ],
            },
          },
          durationMs: 1000,
        },
        industryMarket: {
          status: 'complete',
          section: 'industryMarket',
          data: {
            sectionTitle: 'Market Category',
            statusSummary: 'Airtable competes in connected app platform and workflow database categories.',
            keyFindings: [
              {
                title: 'Category ownership',
                detail: 'The company frames the market around apps, workflows, data, and AI.',
                sourceUrl: 'https://www.airtable.com/product',
              },
            ],
            sources: [
              {
                title: 'Airtable product',
                url: 'https://www.airtable.com/product',
                whyItMatters: 'Primary product positioning.',
              },
            ],
          },
          durationMs: 1000,
        },
      },
    });

    const artifact = getArtifactState(state);
    const deepSection = artifact.sections.find(
      (section) => section.section === 'deepResearchProgram',
    );
    const marketSection = artifact.sections.find(
      (section) => section.section === 'industryMarket',
    );

    expect(deepSection?.title).toBe('Airtable GTM Research');
    expect(deepSection?.content).toContain('Durable Deep Research artifact');
    expect(marketSection?.content).toContain('Category ownership');
    expect(marketSection?.content).toContain('connected app platform');
    expect(marketSection?.sourceUrls).toEqual(['https://www.airtable.com/product']);
  });

  it('buffers out-of-order completed specialists until earlier sections reveal', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-1',
      deepResearchStatus: 'complete',
      phase: 'workspace',
      researchActivity: {
        icpValidation: {
          jobId: 'job-icp',
          section: 'icpValidation',
          status: 'running',
          tool: 'researchICP',
          startedAt: '2026-05-07T09:02:00.000Z',
        },
      },
      researchResults: {
        deepResearchProgram: {
          status: 'complete',
          section: 'deepResearchProgram',
          data: {},
          durationMs: 1000,
        },
        industryMarket: {
          status: 'complete',
          section: 'industryMarket',
          data: { sectionTitle: 'Market', statusSummary: 'Market ready.' },
          durationMs: 1000,
        },
        competitors: {
          status: 'complete',
          section: 'competitors',
          data: { sectionTitle: 'Competitors', statusSummary: 'Competitors ready.' },
          durationMs: 1000,
        },
      },
    });

    expect(state.visibleSteps.map((step) => step.section)).toEqual([
      'deepResearchProgram',
      'industryMarket',
      'icpValidation',
    ]);
    expect(state.bufferedSteps.map((step) => step.section)).toEqual([
      'competitors',
    ]);
  });

  it('reconstructs completed, active, partial, and buffered run state after refresh', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-refresh',
      deepResearchStatus: 'idle',
      phase: 'workspace',
      researchActivity: {
        offerAnalysis: {
          jobId: 'job-offer',
          section: 'offerAnalysis',
          status: 'running',
          tool: 'researchOffer',
          startedAt: '2026-05-07T09:04:00.000Z',
          updates: [
            {
              at: '2026-05-07T09:04:01.000Z',
              id: 'offer-draft',
              message: 'draft Offer analysis is being written from the corpus.',
              phase: 'analysis',
            },
          ],
        },
      },
      researchResults: {
        deepResearchProgram: {
          status: 'complete',
          section: 'deepResearchProgram',
          data: {},
          durationMs: 1000,
        },
        industryMarket: {
          status: 'complete',
          section: 'industryMarket',
          data: { statusSummary: 'Market complete.' },
          durationMs: 1000,
        },
        icpValidation: {
          status: 'complete',
          section: 'icpValidation',
          data: { statusSummary: 'ICP complete.' },
          durationMs: 1000,
        },
        competitors: {
          status: 'partial',
          section: 'competitors',
          data: { statusSummary: 'Competitor draft needs review.' },
          durationMs: 1000,
        },
        keywordIntel: {
          status: 'complete',
          section: 'keywordIntel',
          data: { statusSummary: 'Keyword output finished early.' },
          durationMs: 1000,
        },
      },
    });

    expect(state.statusSummary).toEqual({
      activeSection: 'offerAnalysis',
      bufferedSections: ['keywordIntel'],
      completedSections: ['deepResearchProgram', 'industryMarket', 'icpValidation'],
      partialSections: ['competitors'],
    });
    expect(state.visibleSteps.map((step) => step.section)).toEqual([
      'deepResearchProgram',
      'industryMarket',
      'icpValidation',
      'competitors',
      'offerAnalysis',
    ]);
  });
});
