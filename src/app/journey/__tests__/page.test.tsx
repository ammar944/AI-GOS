import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JourneyPage from '../page';

const {
  setJourneySessionMock,
  setJourneySessionIdMock,
  clearJourneySessionMock,
  clearJourneySessionIdMock,
  submitJourneyPrefillMock,
  stopJourneyPrefillMock,
  initialMessagesRef,
} = vi.hoisted(() => ({
  setJourneySessionMock: vi.fn(),
  setJourneySessionIdMock: vi.fn(),
  clearJourneySessionMock: vi.fn(),
  clearJourneySessionIdMock: vi.fn(),
  submitJourneyPrefillMock: vi.fn(),
  stopJourneyPrefillMock: vi.fn(),
  initialMessagesRef: {
    current: [] as Array<Record<string, unknown>>,
  },
}));

const fromMock = vi.fn();
const maybeSingleMock = vi.fn();
const sendMessageMock = vi.fn();
const addToolOutputMock = vi.fn();
const addToolApprovalResponseMock = vi.fn();

let mockStoredSession: unknown = null;
let mockStoredSessionId: string | null = null;
let mockPrefillState = {
  partialResult: undefined,
  submit: submitJourneyPrefillMock,
  isLoading: false,
  error: undefined,
  stop: stopJourneyPrefillMock,
  fieldsFound: 0,
};

vi.mock('ai', () => ({
  DefaultChatTransport: class DefaultChatTransport {},
  lastAssistantMessageIsCompleteWithToolCalls: () => false,
  lastAssistantMessageIsCompleteWithApprovalResponses: () => false,
}));

vi.mock('@ai-sdk/react', async () => {
  const React = await import('react');

  return {
    useChat: () => {
      const [messages, setMessages] = React.useState<unknown[]>(initialMessagesRef.current);

      return {
        messages,
        sendMessage: sendMessageMock,
        addToolOutput: addToolOutputMock,
        addToolApprovalResponse: addToolApprovalResponseMock,
        status: 'ready',
        error: undefined,
        setMessages,
      };
    },
  };
});

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: { id: 'user_123' },
  }),
}));

vi.mock('@/components/shell', () => ({
  ShellProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AppShell: ({
    children,
    rightPanel,
    sidebar,
  }: {
    children: React.ReactNode;
    rightPanel?: React.ReactNode;
    sidebar?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="sidebar">{sidebar}</div>
      <div>{children}</div>
      {rightPanel ? <div data-testid="right-panel">{rightPanel}</div> : null}
    </div>
  ),
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock('@/components/journey/chat-message', () => ({
  ChatMessage: ({
    content,
    parts,
    onResearchReview,
    sectionReviewStates,
  }: {
    content?: string;
    parts?: Array<Record<string, unknown>>;
    onResearchReview?: (
      sectionId: string,
      decision: 'approved' | 'needs-revision',
      note?: string,
    ) => void;
    sectionReviewStates?: Record<string, string>;
  }) => {
    const sectionId = parts?.find((part) => part.type === 'tool-generateResearch')?.input?.sectionId;

    return (
      <div data-testid="chat-message">
        {content ? <span>{content}</span> : null}
        {sectionId ? <span>{String(sectionId)}</span> : null}
        {sectionReviewStates?.[String(sectionId)] ? (
          <span data-testid={`review-state-${String(sectionId)}`}>
            {sectionReviewStates[String(sectionId)]}
          </span>
        ) : null}
        {sectionId && onResearchReview ? (
          <>
            <button
              type="button"
              onClick={() => onResearchReview(String(sectionId), 'approved')}
            >
              approve {String(sectionId)}
            </button>
            <button
              type="button"
              onClick={() =>
                onResearchReview(
                  String(sectionId),
                  'needs-revision',
                  'Tighten the segment and update downstream recommendations.',
                )
              }
            >
              revise {String(sectionId)}
            </button>
          </>
        ) : null}
      </div>
    );
  },
}));

vi.mock('@/components/journey/chat-input', () => ({
  JourneyChatInput: () => <div data-testid="chat-input" />,
}));

vi.mock('@/components/journey/typing-indicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}));

vi.mock('@/components/journey/resume-prompt', () => ({
  ResumePrompt: ({
    onContinue,
    onStartFresh,
  }: {
    onContinue: () => void;
    onStartFresh: () => void;
  }) => (
    <div data-testid="resume-prompt">
      <button type="button" onClick={onContinue}>
        continue resume
      </button>
      <button type="button" onClick={onStartFresh}>
        start fresh
      </button>
    </div>
  ),
}));

vi.mock('@/components/journey/welcome-state', () => ({
  WelcomeState: ({
    onSubmit,
  }: {
    onSubmit: (payload: { websiteUrl: string; linkedinUrl?: string; manualStart?: boolean }) => void;
  }) => (
    <div data-testid="welcome-state">
      <button
        type="button"
        onClick={() =>
          void onSubmit({
            websiteUrl: 'https://acme.com',
            linkedinUrl: 'https://linkedin.com/company/acme',
          })
        }
      >
        submit welcome
      </button>
      <button
        type="button"
        onClick={() =>
          void onSubmit({
            websiteUrl: '',
            manualStart: true,
          })
        }
      >
        manual start
      </button>
    </div>
  ),
}));

vi.mock('@/components/journey/profile-card', () => ({
  ProfileCard: () => null,
}));

vi.mock('@/components/journey/research-progress', () => ({
  ResearchProgress: () => <div data-testid="research-progress" />,
}));

vi.mock('@/components/journey/journey-header', () => ({
  JourneyHeader: ({
    onNewJourney,
    statusLabel,
    statusDetail,
  }: {
    onNewJourney: () => void;
    statusLabel?: string;
    statusDetail?: string;
  }) => (
    <div data-testid="journey-header">
      <span>{statusLabel}</span>
      <span>{statusDetail}</span>
      <button type="button" onClick={() => void onNewJourney()}>
        new journey
      </button>
    </div>
  ),
}));

vi.mock('@/components/journey/journey-prefill-review', () => ({
  JourneyPrefillReview: ({
    onApplyReview,
    onSkipForNow,
  }: {
    onApplyReview: (
      decisions: Array<{ fieldName: string; action: 'accept' | 'edit' | 'reject'; value?: string }>,
    ) => void;
    onSkipForNow: () => void;
  }) => (
    <div data-testid="prefill-review">
      <button
        type="button"
        onClick={() =>
          onApplyReview([{ fieldName: 'companyName', action: 'accept', value: 'Accepted Company' }])
        }
      >
        accept prefill
      </button>
      <button
        type="button"
        onClick={() =>
          onApplyReview([
            { fieldName: 'companyName', action: 'edit', value: 'Edited Company' },
            { fieldName: 'pricingTiers', action: 'reject' },
          ])
        }
      >
        review prefill
      </button>
      <button type="button" onClick={onSkipForNow}>
        skip prefill
      </button>
    </div>
  ),
}));

vi.mock('@/lib/storage/local-storage', () => ({
  getJourneySession: () => mockStoredSession,
  getJourneySessionId: () => mockStoredSessionId,
  setJourneySession: setJourneySessionMock,
  setJourneySessionId: setJourneySessionIdMock,
  clearJourneySession: clearJourneySessionMock,
  clearJourneySessionId: clearJourneySessionIdMock,
}));

vi.mock('@/lib/journey/research-realtime', async () => {
  const React = await import('react');

  return {
    useResearchRealtime: ({
      sessionId,
      onSectionComplete,
    }: {
      sessionId?: string | null;
      onSectionComplete: (section: string, result: unknown) => void;
    }) => {
      React.useEffect(() => {
        if (!sessionId) return;

        onSectionComplete('industryMarket', {
          status: 'complete',
          section: 'industryMarket',
          data: { summary: 'stale result' },
          durationMs: 1200,
        });
      }, [sessionId, onSectionComplete]);
    },
  };
});

vi.mock('@/hooks/use-journey-prefill', () => ({
  useJourneyPrefill: () => mockPrefillState,
}));

vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({
    from: fromMock,
  }),
}));

describe('JourneyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialMessagesRef.current = [];
    mockStoredSession = null;
    mockStoredSessionId = null;
    mockPrefillState = {
      partialResult: undefined,
      submit: submitJourneyPrefillMock,
      isLoading: false,
      error: undefined,
      stop: stopJourneyPrefillMock,
      fieldsFound: 0,
    };
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    }) as Response));

    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: { id: 'stale-session-id' } });

    fromMock.mockReset();
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    });
  });

  it('stays on the welcome state when there is no saved local journey session', async () => {
    render(<JourneyPage />);

    expect(screen.getByTestId('welcome-state')).toBeInTheDocument();
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(fromMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('welcome-state')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-message')).not.toBeInTheDocument();
  });

  it('forces a fresh scoped session when starting a new journey with an orphaned stored session id', async () => {
    mockStoredSessionId = 'orphaned-session-id';
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'session-manual' }),
    } as Response);

    render(<JourneyPage />);

    await act(async () => {
      screen.getByRole('button', { name: 'manual start' }).click();
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/journey/new-session', { method: 'POST' });
      expect(setJourneySessionIdMock).toHaveBeenCalledWith('session-manual');
    });
  });

  it('does not send a chat message when session creation fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'session create failed' }),
    } as Response);

    render(<JourneyPage />);

    await act(async () => {
      screen.getByRole('button', { name: 'submit welcome' }).click();
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/journey/new-session', { method: 'POST' });
      expect(sendMessageMock).not.toHaveBeenCalled();
      expect(submitJourneyPrefillMock).not.toHaveBeenCalled();
    });
  });

  it('enters manual chat mode without forcing prefill', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'session-manual' }),
    } as Response);

    render(<JourneyPage />);

    screen.getByRole('button', { name: 'manual start' }).click();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/journey/new-session', { method: 'POST' });
      expect(submitJourneyPrefillMock).not.toHaveBeenCalled();
      expect(screen.queryByTestId('welcome-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-message')).toBeInTheDocument();
    });
  });

  it('restores saved prefill proposals into the review step', async () => {
    const { createEmptyState, setProposedField } = await import('@/lib/journey/session-state');
    mockStoredSession = setProposedField(createEmptyState(), 'companyName', 'Acme AI', {
      source: 'prefill',
      confidence: 92,
      sourceUrl: 'https://acme.com',
      reasoning: 'Found on the homepage hero section.',
    });

    render(<JourneyPage />);

    expect(screen.queryByTestId('welcome-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('prefill-review')).toBeInTheDocument();
  });

  it('accepts prefill proposals and moves into chat mode', async () => {
    const { createEmptyState, setProposedField } = await import('@/lib/journey/session-state');
    mockStoredSession = setProposedField(createEmptyState(), 'companyName', 'Acme AI', {
      source: 'prefill',
      confidence: 92,
      sourceUrl: 'https://acme.com',
      reasoning: 'Found on the homepage hero section.',
    });

    render(<JourneyPage />);

    await act(async () => {
      screen.getByRole('button', { name: 'accept prefill' }).click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('prefill-review')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-message')).toBeInTheDocument();
      expect(setJourneySessionMock).toHaveBeenCalled();
    });

    expect(
      screen.getByText(/i saved 1 confirmed detail from your website and review/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Website context saved')).toBeInTheDocument();
    expect(
      screen.getAllByText(/next, answer the guided questions so i can sharpen the research/i),
    ).toHaveLength(2);
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument();
  });

  it('applies edited and rejected prefill decisions before entering chat', async () => {
    const { createEmptyState, setProposedField } = await import('@/lib/journey/session-state');
    mockStoredSessionId = 'session-reviewed';
    mockStoredSession = setProposedField(createEmptyState(), 'companyName', 'Acme AI', {
      source: 'prefill',
      confidence: 92,
      sourceUrl: 'https://acme.com',
      reasoning: 'Found on the homepage hero section.',
    });
    mockStoredSession = setProposedField(mockStoredSession, 'pricingTiers', '$499/mo', {
      source: 'prefill',
      confidence: 81,
      sourceUrl: 'https://acme.com/pricing',
      reasoning: 'Found on the pricing page.',
    });

    render(<JourneyPage />);

    await act(async () => {
      screen.getByRole('button', { name: 'review prefill' }).click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('prefill-review')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-message')).toBeInTheDocument();
    });

    const reviewedState = setJourneySessionMock.mock.calls.at(-1)?.[0];
    expect(reviewedState.companyName).toBe('Edited Company');
    expect(reviewedState.fieldMeta.companyName?.verifiedBy).toBe('manual-edit');
    expect(reviewedState.proposals.pricingTiers).toBeUndefined();
    expect(reviewedState.fieldMeta.pricingTiers?.status).toBe('rejected');
    expect(fetch).toHaveBeenCalledWith(
      '/api/journey/session',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('skips prefill review and moves into chat mode', async () => {
    const { createEmptyState, setProposedField } = await import('@/lib/journey/session-state');
    mockStoredSession = setProposedField(createEmptyState(), 'companyName', 'Acme AI', {
      source: 'prefill',
      confidence: 92,
      sourceUrl: 'https://acme.com',
      reasoning: 'Found on the homepage hero section.',
    });

    render(<JourneyPage />);

    await act(async () => {
      screen.getByRole('button', { name: 'skip prefill' }).click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('prefill-review')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-message')).toBeInTheDocument();
    });
  });

  it('continues directly into chat when prefill finishes without any provenance-backed proposals', async () => {
    mockPrefillState = {
      partialResult: {
        confidenceNotes: 'The site did not expose structured business details.',
      },
      submit: submitJourneyPrefillMock,
      isLoading: false,
      error: undefined,
      stop: stopJourneyPrefillMock,
      fieldsFound: 0,
    };

    render(<JourneyPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('prefill-review')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-message')).toBeInTheDocument();
    });
  });

  it('returns to the seed-card flow after starting a new journey', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'session-manual' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'session-fresh' }),
      } as Response);

    render(<JourneyPage />);

    screen.getByRole('button', { name: 'manual start' }).click();

    await waitFor(() => {
      expect(screen.getByTestId('chat-message')).toBeInTheDocument();
    });

    screen.getByRole('button', { name: 'new journey' }).click();

    await waitFor(() => {
      expect(screen.getByTestId('welcome-state')).toBeInTheDocument();
      expect(screen.queryByTestId('prefill-review')).not.toBeInTheDocument();
    });
  });

  it('enters chat when resuming a saved journey session', async () => {
    const { createEmptyState, setConfirmedField } = await import('@/lib/journey/session-state');
    mockStoredSessionId = 'session-resume';
    mockStoredSession = setConfirmedField(createEmptyState(), 'businessModel', 'B2B SaaS', {
      source: 'manual',
      verifiedBy: 'manual-edit',
    });

    render(<JourneyPage />);

    expect(screen.getByTestId('resume-prompt')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'continue resume' }).click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('welcome-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-message')).toBeInTheDocument();
    });
  });

  it('does not leak stale prefill results into a fresh journey', async () => {
    mockPrefillState = {
      partialResult: {
        companyName: {
          value: 'Stale Company',
          confidence: 91,
          sourceUrl: 'https://stale.example',
          reasoning: 'Stale prefill result',
        },
      },
      submit: submitJourneyPrefillMock,
      isLoading: false,
      error: undefined,
      stop: stopJourneyPrefillMock,
      fieldsFound: 1,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'session-fresh' }),
    } as Response);

    render(<JourneyPage />);

    await waitFor(() => {
      expect(screen.getByTestId('prefill-review')).toBeInTheDocument();
    });

    screen.getByRole('button', { name: 'new journey' }).click();

    await waitFor(() => {
      expect(screen.getByTestId('welcome-state')).toBeInTheDocument();
      expect(screen.queryByTestId('prefill-review')).not.toBeInTheDocument();
    });
  });

  it('syncs explicit conversational confirmations from tool output into journey state', async () => {
    mockStoredSessionId = 'session-confirm';
    const { createEmptyState, setProposedField } = await import('@/lib/journey/session-state');
    mockStoredSession = setProposedField(createEmptyState(), 'businessModel', 'B2B SaaS', {
      source: 'prefill',
      confidence: 90,
      sourceUrl: 'https://acme.com',
      reasoning: 'Found in the homepage hero copy.',
    });

    initialMessagesRef.current = [
      {
        id: 'assistant-confirm',
        role: 'assistant',
        parts: [
          {
            type: 'tool-confirmJourneyFields',
            state: 'output-available',
            toolCallId: 'confirm-call',
            output: {
              status: 'confirmed',
              fields: [
                {
                  fieldName: 'businessModel',
                  value: 'B2B SaaS',
                },
              ],
            },
          },
        ],
      },
    ];

    render(<JourneyPage />);

    await waitFor(() => {
      const persistedState = setJourneySessionMock.mock.calls.at(-1)?.[0];
      expect(persistedState.businessModel).toBe('B2B SaaS');
      expect(persistedState.fieldMeta.businessModel?.verifiedBy).toBe('chat-confirmation');
    });
  });

  it('marks approved research checkpoints without triggering a rerun', async () => {
    mockStoredSessionId = 'session-approved';
    initialMessagesRef.current = [
      {
        id: 'assistant-approved',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-approved',
            input: { sectionId: 'industryResearch' },
            output: {
              status: 'complete',
              sectionId: 'industryResearch',
              content: 'Industry research',
              fileIds: [],
            },
          },
        ],
      },
    ];

    render(<JourneyPage />);

    await act(async () => {
      screen.getByRole('button', { name: 'approve industryResearch' }).click();
    });

    await waitFor(() => {
      const persistedState = setJourneySessionMock.mock.calls.at(-1)?.[0];
      expect(persistedState.sectionReviewStates.industryResearch).toBe('approved');
      expect(sendMessageMock).not.toHaveBeenCalled();
    });
  });

  it('re-runs only the affected downstream sections after a revision request', async () => {
    mockStoredSessionId = 'session-revise';
    initialMessagesRef.current = [
      {
        id: 'assistant-revise',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-revise',
            input: { sectionId: 'icpValidation' },
            output: {
              status: 'complete',
              sectionId: 'icpValidation',
              content: 'ICP research',
              fileIds: [],
            },
          },
        ],
      },
    ];

    render(<JourneyPage />);

    await act(async () => {
      screen.getByRole('button', { name: 'revise icpValidation' }).click();
    });

    await waitFor(() => {
      const persistedState = setJourneySessionMock.mock.calls.at(-1)?.[0];
      expect(persistedState.sectionReviewStates.icpValidation).toBe('needs-revision');
      expect(persistedState.invalidatedResearchSections).toEqual([
        'icpValidation',
        'strategicSynthesis',
        'keywordIntel',
        'mediaPlan',
      ]);
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Revise the ICP Validation section'),
        }),
      );
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'Only re-run these affected sections: icpValidation, strategicSynthesis, keywordIntel, mediaPlan.',
          ),
        }),
      );
    });
  });

  it('recovers by creating a fresh scoped session when persisted local session id is stale', async () => {
    const { createEmptyState, setProposedField } = await import('@/lib/journey/session-state');
    mockStoredSessionId = 'stale-session-id';
    mockStoredSession = setProposedField(createEmptyState(), 'companyName', 'Acme AI', {
      source: 'prefill',
      confidence: 92,
      sourceUrl: 'https://acme.com',
      reasoning: 'Found on the homepage hero section.',
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'No journey session found for stale-session-id' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'session-recovered' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

    render(<JourneyPage />);

    await act(async () => {
      screen.getByRole('button', { name: 'accept prefill' }).click();
    });

    await waitFor(() => {
      expect(clearJourneySessionIdMock).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith('/api/journey/new-session', { method: 'POST' });
      expect(setJourneySessionIdMock).toHaveBeenCalledWith('session-recovered');
      expect(fetch).toHaveBeenCalledWith(
        '/api/journey/session',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"sessionId":"session-recovered"'),
        }),
      );
    });
  });
});
