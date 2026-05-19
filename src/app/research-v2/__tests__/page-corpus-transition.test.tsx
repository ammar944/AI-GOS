/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  OnboardingPrefillMetadata,
  OnboardingV2Data,
} from '@/lib/research-v2/onboarding-v2-types';

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
}));

const searchParamsMock = vi.hoisted(() => ({
  value: new URLSearchParams('runId=run-corpus'),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock.value,
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isLoaded: true,
    user: { id: 'user_1' },
  }),
}));

vi.mock('@/components/research-v2/welcome-form', () => ({
  WelcomeForm: () => <div data-testid="welcome" />,
}));

vi.mock('@/components/research-v2/corpus-stream', () => ({
  CorpusStream: ({ runId }: { userId: string; runId: string; onComplete: () => void }) => (
    <div data-testid="corpus" data-run-id={runId} />
  ),
}));

vi.mock('@/components/research-v2/error-recovery', () => ({
  ErrorRecovery: () => <div data-testid="error" />,
}));

vi.mock('@/components/research-v2/agent-artifact-surface', () => ({
  AgentArtifactSurface: ({ runId }: { runId: string }) => (
    <div data-testid="sections" data-run-id={runId} />
  ),
}));

vi.mock('@/components/research-v2/onboarding-wizard-v2', () => ({
  OnboardingWizardV2: ({
    initialData,
    initialPrefillMetadata,
  }: {
    initialData: Partial<OnboardingV2Data>;
    initialPrefillMetadata: OnboardingPrefillMetadata;
    onComplete: () => void;
  }) => (
    <div data-testid="onboarding">
      {JSON.stringify({ initialData, initialPrefillMetadata })}
    </div>
  ),
}));

const { default: ResearchV2Page } = await import('../page');

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/research-v2 corpus completion transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    searchParamsMock.value = new URLSearchParams('runId=run-corpus');
  });

  it('advances from corpus to onboarding from persisted researchResults even when jobStatus is missing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          runId: 'run-corpus',
          researchResults: {
            deepResearchProgram: { status: 'running' },
          },
          jobStatus: null,
          onboardingData: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          runId: 'run-corpus',
          researchResults: {
            deepResearchProgram: {
              status: 'complete',
              data: {
                onboardingFields: {
                  companyName: {
                    value: 'Clay',
                    confidence: 0.9,
                    sourceUrl: 'https://www.clay.com',
                    reasoning: 'Homepage identity.',
                  },
                },
              },
            },
          },
          jobStatus: null,
          onboardingData: null,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    const onboarding = await screen.findByTestId('onboarding');
    expect(onboarding.textContent).toContain('"companyName":"Clay"');
    expect(onboarding.textContent).toContain('"sourceUrl":"https://www.clay.com"');
  });

  it('keeps corpus visible when the persisted session fetch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          runId: 'run-corpus',
          researchResults: {
            deepResearchProgram: { status: 'running' },
          },
          jobStatus: null,
          onboardingData: null,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'temporary failure' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('corpus')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding')).toBeNull();
  });
});
