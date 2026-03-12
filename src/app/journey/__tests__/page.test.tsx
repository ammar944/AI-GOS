import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import JourneyPage from '../page';

type MockChatStatus = 'ready' | 'streaming' | 'submitted';

const {
  addToolApprovalResponseMock,
  addToolOutputMock,
  chatControls,
  guardedFetchMock,
  prefillControls,
  researchJobActivityValue,
  realtimeControls,
  sendMessageMock,
  setJourneySessionMock,
  transportBodyCalls,
} = vi.hoisted(() => {
  const messageListeners = new Set<(messages: UIMessage[]) => void>();
  const statusListeners = new Set<(status: MockChatStatus) => void>();
  let messages: UIMessage[] = [];
  let status: MockChatStatus = 'ready';
  let onSectionComplete:
    | ((section: string, result: ResearchSectionResult) => void)
    | null = null;
  let activeRunId: string | null = null;

  const sendMessageMock = vi.fn(
    (message: { text: string; metadata?: Record<string, unknown> }) => {
      const nextMessage: UIMessage = {
        id: `user-${messages.length + 1}`,
        role: 'user',
        metadata: message.metadata,
        parts: [
          {
            type: 'text',
            text: message.text,
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage;

      messages = [...messages, nextMessage];
      messageListeners.forEach((listener) => listener(messages));
    },
  );

  return {
    sendMessageMock,
    addToolOutputMock: vi.fn(),
    addToolApprovalResponseMock: vi.fn(),
    setJourneySessionMock: vi.fn(),
    transportBodyCalls: {
      values: [] as Array<Record<string, unknown> | undefined>,
      reset(): void {
        this.values = [];
      },
    },
    prefillControls: {
      state: {
        partialResult: undefined as Record<string, unknown> | undefined,
        isLoading: false,
        error: undefined as Error | undefined,
        fieldsFound: 0,
      },
      reset(): void {
        this.state.partialResult = undefined;
        this.state.isLoading = false;
        this.state.error = undefined;
        this.state.fieldsFound = 0;
      },
    },
    researchJobActivityValue: {
      current: {} as Record<
        string,
        {
          jobId: string;
          lastHeartbeat?: string;
          section: string;
          startedAt: string;
          status: 'running' | 'complete' | 'error';
          tool: string;
        }
      >,
    },
    guardedFetchMock: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }),
    chatControls: {
      addMessageListener(listener: (nextMessages: UIMessage[]) => void): () => void {
        messageListeners.add(listener);
        return () => {
          messageListeners.delete(listener);
        };
      },
      addStatusListener(listener: (nextStatus: MockChatStatus) => void): () => void {
        statusListeners.add(listener);
        return () => {
          statusListeners.delete(listener);
        };
      },
      getMessages(): UIMessage[] {
        return messages;
      },
      getStatus(): MockChatStatus {
        return status;
      },
      setMessages(
        nextMessages: UIMessage[] | ((currentMessages: UIMessage[]) => UIMessage[]),
      ): void {
        messages =
          typeof nextMessages === 'function' ? nextMessages(messages) : nextMessages;
        messageListeners.forEach((listener) => listener(messages));
      },
      setStatus(nextStatus: MockChatStatus): void {
        status = nextStatus;
        statusListeners.forEach((listener) => listener(status));
      },
      appendMessage(nextMessage: UIMessage): void {
        messages = [...messages, nextMessage];
        messageListeners.forEach((listener) => listener(messages));
      },
      reset(): void {
        messages = [];
        status = 'ready';
      },
    },
    realtimeControls: {
      setHandler(
        nextHandler: ((section: string, result: ResearchSectionResult) => void) | null,
        nextActiveRunId: string | null,
      ): void {
        activeRunId = nextActiveRunId;
        onSectionComplete = nextActiveRunId ? nextHandler : null;
      },
      emit(section: string, result: ResearchSectionResult): void {
        onSectionComplete?.(section, result);
      },
      getActiveRunId(): string | null {
        return activeRunId;
      },
      reset(): void {
        onSectionComplete = null;
        activeRunId = null;
      },
    },
  };
});

vi.mock('ai', () => ({
  DefaultChatTransport: class DefaultChatTransport {
    body?: object | (() => object | undefined);

    constructor(options?: { body?: object | (() => object | undefined) }) {
      this.body = options?.body;
    }
  },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock('@ai-sdk/react', async () => {
  const React = await import('react');

  return {
    useChat: (options?: { transport?: { body?: object | (() => object | undefined) } }) => {
      const [messages, setMessagesState] = React.useState<UIMessage[]>(
        chatControls.getMessages(),
      );
      const [status, setStatusState] = React.useState<MockChatStatus>(
        chatControls.getStatus(),
      );

      const sendMessage = async (
        message: { text: string; metadata?: Record<string, unknown> },
        requestOptions?: { body?: object },
      ) => {
        const transportBody =
          typeof options?.transport?.body === 'function'
            ? options.transport.body()
            : options?.transport?.body;
        transportBodyCalls.values.push(
          transportBody && typeof transportBody === 'object'
            ? (transportBody as Record<string, unknown>)
            : undefined,
        );
        return sendMessageMock(message, requestOptions);
      };

      React.useEffect(() => chatControls.addMessageListener(setMessagesState), []);
      React.useEffect(() => chatControls.addStatusListener(setStatusState), []);

      return {
        messages,
        status,
        error: undefined,
        sendMessage,
        addToolOutput: addToolOutputMock,
        addToolApprovalResponse: addToolApprovalResponseMock,
        setMessages: (
          nextMessages:
            | UIMessage[]
            | ((currentMessages: UIMessage[]) => UIMessage[]),
        ) => {
          chatControls.setMessages(nextMessages);
        },
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
}));

vi.mock('@/components/shell/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock('@/components/journey/chat-message', () => ({
  ChatMessage: ({
    content,
    parts,
  }: {
    content?: string;
    parts?: Array<Record<string, unknown>>;
  }) => (
    <div data-testid="chat-message">
      {content ? <span>{content}</span> : null}
      {parts?.map((part, index) => {
        if (part.type === 'text' && typeof part.text === 'string') {
          return <span key={`${part.text}-${index}`}>{part.text}</span>;
        }

        if (typeof part.type === 'string') {
          return <span key={`${part.type}-${index}`}>{part.type}</span>;
        }

        return null;
      })}
    </div>
  ),
}));

vi.mock('@/components/journey/chat-input', () => ({
  JourneyChatInput: () => <div data-testid="chat-input" />,
}));

vi.mock('@/components/journey/typing-indicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}));

vi.mock('@/components/journey/resume-prompt', () => ({
  ResumePrompt: () => <div data-testid="resume-prompt" />,
}));

vi.mock('@/hooks/use-journey-prefill', () => ({
  useJourneyPrefill: () => ({
    partialResult: prefillControls.state.partialResult,
    submit: vi.fn(),
    isLoading: prefillControls.state.isLoading,
    error: prefillControls.state.error,
    stop: vi.fn(),
    fieldsFound: prefillControls.state.fieldsFound,
  }),
}));

vi.mock('@/lib/journey/research-realtime', async () => {
  const React = await import('react');

  return {
    useResearchRealtime: ({
      activeRunId,
      onSectionComplete,
    }: {
      activeRunId?: string | null;
      onSectionComplete: (section: string, result: ResearchSectionResult) => void;
    }) => {
      React.useEffect(() => {
        realtimeControls.setHandler(onSectionComplete, activeRunId ?? null);
        return () => {
          realtimeControls.setHandler(null, null);
        };
      }, [activeRunId, onSectionComplete]);
    },
  };
});

vi.mock('@/lib/journey/research-job-activity', () => ({
  useResearchJobActivity: () => researchJobActivityValue.current,
}));

vi.mock('@/lib/journey/http', () => ({
  createJourneyGuardedFetch: () => guardedFetchMock,
  formatJourneyErrorMessage: () => 'Journey failed',
}));

vi.mock('@/components/journey/journey-stepper', () => ({
  JourneyStepper: () => <div data-testid="journey-stepper" />,
}));

vi.mock('@/components/journey/terminal-stream', () => ({
  TerminalStream: () => <div data-testid="terminal-stream" />,
}));

vi.mock('@/components/journey/journey-progress-panel', () => ({
  JourneyProgressPanel: () => <div data-testid="journey-progress-panel" />,
}));

vi.mock('@/components/journey/research-inline-card', () => ({
  ResearchInlineCard: ({ section }: { section: string }) => (
    <div data-testid={`research-inline-${section}`}>{section}</div>
  ),
}));

vi.mock('@/components/journey/artifact-trigger-card', () => ({
  ArtifactTriggerCard: ({
    approved,
    onClick,
    section,
  }: {
    approved: boolean;
    onClick: () => void;
    section: string;
  }) => (
    <button type="button" data-testid={`artifact-trigger-${section}`} onClick={onClick}>
      reopen {section} {approved ? 'approved' : 'pending'}
    </button>
  ),
}));

vi.mock('@/components/journey/artifact-panel', () => ({
  ArtifactPanel: ({
    approved,
    section,
    onApprove,
    onClose,
  }: {
    approved: boolean;
    section: string;
    onApprove: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="artifact-panel">
      <span>{section}</span>
      <span>{approved ? 'approved' : 'pending'}</span>
      <button type="button" onClick={onApprove}>
        approve artifact
      </button>
      <button type="button" onClick={onClose}>
        close artifact
      </button>
    </div>
  ),
}));

vi.mock('@/components/journey/studio-preview-dock', () => ({
  JourneyStudioPreviewDock: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="studio-preview-dock">{children}</div>
  ),
}));

vi.mock('@/components/journey/studio-preview-shell', () => ({
  JourneyStudioPreviewShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="studio-preview-shell">{children}</div>
  ),
}));

vi.mock('@/lib/storage/local-storage', () => ({
  getJourneySession: () => null,
  setJourneySession: setJourneySessionMock,
  clearJourneySession: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

function makeResearchResult(
  section: string,
  data: Record<string, unknown>,
): ResearchSectionResult {
  return {
    status: 'complete',
    section,
    data,
    durationMs: 1200,
  };
}

async function renderJourneyChat(): Promise<void> {
  render(<JourneyPage />);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start without website analysis' }));
  });

  await waitFor(() => {
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  sendMessageMock.mockClear();
}

async function emitResearchResult(
  section: string,
  data: Record<string, unknown>,
): Promise<void> {
  await act(async () => {
    realtimeControls.emit(section, makeResearchResult(section, data));
  });
}

async function emitQueuedResearchDispatch(
  toolName: 'researchIndustry' | 'researchCompetitors' | 'researchKeywords',
): Promise<void> {
  const message: UIMessage = {
    id: `queued-${toolName}`,
    role: 'assistant',
    parts: [
      {
        type: 'tool-invocation',
        toolName,
      } as unknown as UIMessage['parts'][number],
    ],
  };

  await act(async () => {
    chatControls.setMessages((currentMessages) => [...currentMessages, message]);
  });
}

async function emitResearchDispatchError(
  toolName: 'researchIndustry' | 'researchCompetitors' | 'researchKeywords',
  errorText: string,
): Promise<void> {
  const message: UIMessage = {
    id: `dispatch-error-${toolName}-${chatControls.getMessages().length + 1}`,
    role: 'assistant',
    parts: [
      {
        type: `tool-${toolName}`,
        state: 'output-error',
        toolName,
        errorText,
      } as unknown as UIMessage['parts'][number],
    ],
  };

  await act(async () => {
    chatControls.setMessages((currentMessages) => [...currentMessages, message]);
  });
}

describe('JourneyPage artifact orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    window.sessionStorage.clear();
    chatControls.reset();
    transportBodyCalls.reset();
    prefillControls.reset();
    realtimeControls.reset();
    researchJobActivityValue.current = {};
    guardedFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('starts a clean run when website analysis is skipped', async () => {
    render(<JourneyPage />);

    expect(realtimeControls.getActiveRunId()).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start without website analysis' }));
    });

    await waitFor(() => {
      expect(guardedFetchMock).toHaveBeenCalledWith(
        '/api/journey/session',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const [, requestInit] = guardedFetchMock.mock.calls[0] as [
      string,
      { body?: string },
    ];
    const payload = JSON.parse(requestInit.body ?? '{}') as {
      activeRunId?: unknown;
      clearResearch?: unknown;
    };

    expect(payload.clearResearch).toBe(true);
    expect(typeof payload.activeRunId).toBe('string');
    expect(String(payload.activeRunId)).not.toHaveLength(0);
    expect(realtimeControls.getActiveRunId()).toBe(String(payload.activeRunId));
    expect(transportBodyCalls.values.at(-1)).toEqual(
      expect.objectContaining({
        activeRunId: String(payload.activeRunId),
      }),
    );
    expect(sendMessageMock).toHaveBeenCalledWith(
      {
        text: 'Start without website analysis',
        metadata: { activeRunId: String(payload.activeRunId) },
      },
      {
        body: {
          activeRunId: String(payload.activeRunId),
        },
      },
    );
  });

  it('sends accepted prefill kickoff with the newly created run id in the request body', async () => {
    prefillControls.state.partialResult = {
      companyName: { value: 'SaaSLaunch', confidence: 0.9 },
      businessModel: { value: 'B2B SaaS growth agency', confidence: 0.9 },
      productDescription: {
        value: 'We build and run pipeline systems for B2B SaaS teams.',
        confidence: 0.9,
      },
      topCompetitors: {
        value: 'Hey Digital, Sales Captain, Growth Marketing Pro',
        confidence: 0.9,
      },
      primaryIcpDescription: {
        value: 'Seed to Series B B2B SaaS teams that need predictable pipeline growth.',
        confidence: 0.9,
      },
      pricingTiers: {
        value: 'Retainer-based. Starter $4k/mo, Growth $8k/mo.',
        confidence: 0.9,
      },
      goals: {
        value: 'Generate more qualified demos and reduce CAC.',
        confidence: 0.9,
      },
      uniqueEdge: {
        value: 'We tie campaigns directly to pipeline attribution.',
        confidence: 0.9,
      },
    };
    prefillControls.state.fieldsFound = 8;

    render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('https://example.com'), {
        target: { value: 'https://saaslaunch.net' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Analyze website first' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('prefill-review')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Market Overview' }));
    });

    await waitFor(() => {
      expect(guardedFetchMock).toHaveBeenCalledWith(
        '/api/journey/session',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const [, requestInit] = guardedFetchMock.mock.calls[0] as [
      string,
      { body?: string },
    ];
    const payload = JSON.parse(requestInit.body ?? '{}') as {
      activeRunId?: unknown;
      clearResearch?: unknown;
    };

    expect(payload.clearResearch).toBe(true);
    expect(typeof payload.activeRunId).toBe('string');
    expect(transportBodyCalls.values.at(-1)).toEqual(
      expect.objectContaining({
        activeRunId: String(payload.activeRunId),
      }),
    );
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          activeRunId: String(payload.activeRunId),
        }),
      }),
      {
        body: {
          activeRunId: String(payload.activeRunId),
        },
      },
    );
  });

  it('opens a newly completed review artifact when it first becomes ready', async () => {
    await renderJourneyChat();

    await emitResearchResult('industryMarket', { summary: 'Market overview ready' });

    await waitFor(() => {
      expect(screen.getByTestId('artifact-panel')).toHaveTextContent('industryMarket');
    });

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('keeps an approved artifact closed when unrelated research results update later', async () => {
    await renderJourneyChat();
    await emitResearchResult('industryMarket', { summary: 'Market overview ready' });

    await waitFor(() => {
      expect(screen.getByTestId('artifact-panel')).toHaveTextContent('industryMarket');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'approve artifact' }));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument();
    });

    sendMessageMock.mockClear();

    await emitResearchResult('keywordIntel', {
      campaignGroups: [{ name: 'Competitor Alternatives' }],
    });

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument();
    expect(sendMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        metadata: { hidden: true },
      }),
    );
  });

  it('does not resurface the same approved review section without a new invalidation cycle', async () => {
    await renderJourneyChat();
    await emitResearchResult('industryMarket', { summary: 'Market overview ready' });

    await waitFor(() => {
      expect(screen.getByTestId('artifact-panel')).toHaveTextContent('industryMarket');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'approve artifact' }));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument();
    });

    sendMessageMock.mockClear();

    await emitResearchResult('industryMarket', { summary: 'Market overview ready' });

    expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('keeps approval UI aligned with the backend approval history on hydration', async () => {
    await renderJourneyChat();

    await act(async () => {
      chatControls.appendMessage({
        id: 'approval-industry',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '[SECTION_APPROVED:industryMarket] Looks good',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage);
    });

    await emitResearchResult('industryMarket', { summary: 'Market overview ready' });

    expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('artifact-trigger-industryMarket')).toHaveTextContent(
      'approved',
    );
  });

  it('reopens an approved review section when a real rerun is queued', async () => {
    await renderJourneyChat();
    await emitResearchResult('industryMarket', { summary: 'Market overview ready' });

    await waitFor(() => {
      expect(screen.getByTestId('artifact-panel')).toHaveTextContent('industryMarket');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'approve artifact' }));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument();
    });

    await emitQueuedResearchDispatch('researchIndustry');

    await waitFor(() => {
      expect(screen.getByTestId('artifact-panel')).toHaveTextContent('industryMarket');
    });
  });

  it('sends one hidden wake-up when the same non-review section completes more than once', async () => {
    await renderJourneyChat();

    await emitResearchResult('keywordIntel', {
      campaignGroups: [{ name: 'Competitor Alternatives' }],
    });
    await emitResearchResult('keywordIntel', {
      campaignGroups: [{ name: 'Competitor Alternatives' }],
    });

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });

    expect(sendMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        metadata: { hidden: true },
      }),
    );
    expect(console.debug).toHaveBeenCalledWith(
      '[journey][debug]',
      expect.objectContaining({
        event: 'hidden-wake-up-dispatched',
        section: 'keywordIntel',
      }),
    );
    expect(console.debug).toHaveBeenCalledWith(
      '[journey][debug]',
      expect.objectContaining({
        event: 'hidden-wake-up-suppressed',
        section: 'keywordIntel',
      }),
    );
  });

  it('uses the latest active run id for implicit follow-up sends after onboarding starts', async () => {
    render(<JourneyPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start without website analysis' }));
    });

    await waitFor(() => {
      expect(guardedFetchMock).toHaveBeenCalled();
    });

    const [, requestInit] = guardedFetchMock.mock.calls[0] as [
      string,
      { body?: string },
    ];
    const payload = JSON.parse(requestInit.body ?? '{}') as {
      activeRunId?: unknown;
    };
    const nextRunId = String(payload.activeRunId);

    sendMessageMock.mockClear();
    transportBodyCalls.reset();

    await emitResearchResult('keywordIntel', {
      campaignGroups: [{ name: 'Competitor Alternatives' }],
    });

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });

    expect(transportBodyCalls.values.at(-1)).toEqual(
      expect.objectContaining({
        activeRunId: nextRunId,
      }),
    );
  });

  it('shows a worker-unavailable banner when dispatch fails before pickup', async () => {
    await renderJourneyChat();

    await emitResearchDispatchError('researchIndustry', 'fetch failed');

    await waitFor(() => {
      expect(screen.getByTestId('journey-worker-status-banner')).toHaveTextContent(
        'Worker unavailable',
      );
    });

    expect(screen.getByTestId('journey-worker-status-banner')).toHaveTextContent(
      'Start the research worker on :3001',
    );
  });

  it('shows a timeout banner when the chat request times out but the worker keeps running', async () => {
    researchJobActivityValue.current = {
      industryMarket: {
        jobId: 'job-1',
        section: 'industryMarket',
        startedAt: '2026-03-12T09:00:00.000Z',
        status: 'running',
        tool: 'researchIndustry',
      },
    };

    await renderJourneyChat();
    await emitQueuedResearchDispatch('researchIndustry');
    await emitResearchDispatchError('researchIndustry', 'Request timed out.');

    await waitFor(() => {
      expect(screen.getByTestId('journey-worker-status-banner')).toHaveTextContent(
        'Chat timed out',
      );
    });

    expect(screen.getByTestId('journey-worker-status-banner')).toHaveTextContent(
      'worker is still running in the background',
    );
  });
});
