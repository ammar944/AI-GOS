import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import JourneyPage from '../page';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
  dispatchResearchSectionMock,
  fetchMock,
  transportBodyCalls,
} = vi.hoisted(() => {
  const messageListeners = new Set<(messages: UIMessage[]) => void>();
  const statusListeners = new Set<(status: MockChatStatus) => void>();
  let messages: UIMessage[] = [];
  let status: MockChatStatus = 'ready';
  let initialRealtimeResults: Array<[string, ResearchSectionResult]> = [];
  const hydratedRunIds = new Set<string>();
  let onSectionComplete:
    | ((section: string, result: ResearchSectionResult) => void)
    | null = null;
  let activeRunId: string | null = null;

  const sendMessageMock = vi.fn(
    (
      message: { text: string; metadata?: Record<string, unknown> },
      _requestOptions?: { body?: object },
    ) => {
      void _requestOptions;

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
    dispatchResearchSectionMock: vi.fn().mockResolvedValue({
      status: 'queued',
      section: 'industryMarket',
      jobId: 'job-industry-market',
    }),
    fetchMock: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ complete: true, status: 'complete' }),
    }),
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
      hydrate(
        nextHandler: ((section: string, result: ResearchSectionResult) => void) | null,
        nextActiveRunId: string | null,
      ): void {
        if (!nextHandler || !nextActiveRunId || hydratedRunIds.has(nextActiveRunId)) {
          return;
        }

        hydratedRunIds.add(nextActiveRunId);
        for (const [section, result] of initialRealtimeResults) {
          nextHandler(section, result);
        }
      },
      emit(section: string, result: ResearchSectionResult): void {
        onSectionComplete?.(section, result);
      },
      setInitialResults(nextResults: Record<string, ResearchSectionResult>): void {
        initialRealtimeResults = Object.entries(nextResults);
        hydratedRunIds.clear();
      },
      getActiveRunId(): string | null {
        return activeRunId;
      },
      reset(): void {
        onSectionComplete = null;
        activeRunId = null;
        initialRealtimeResults = [];
        hydratedRunIds.clear();
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
    isLoaded: true,
    isSignedIn: true,
    user: { id: 'user_123' },
  }),
}));

vi.mock('@/components/shell', () => ({
  ShellProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AppShell: ({ children, sidebar }: { children: React.ReactNode; sidebar?: React.ReactNode }) => (
    <div data-testid="app-shell">
      {sidebar}
      {children}
    </div>
  ),
  AppSidebar: () => <aside data-testid="app-sidebar" />,
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
        realtimeControls.hydrate(onSectionComplete, activeRunId ?? null);
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

vi.mock('@/lib/journey/dispatch-client', () => ({
  dispatchResearchSection: dispatchResearchSectionMock,
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

// Mock framer-motion so jsdom can render every motion.* element
// (motion.div, motion.button, motion.section, etc.) without animation
// internals. WelcomeForm and many other journey components use motion
// components — we forward to plain DOM elements and strip motion-only
// props so React doesn't warn about unknown HTML attributes.
vi.mock('framer-motion', async () => {
  const ReactImport = await import('react');

  const MOTION_ONLY_PROPS = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'whileHover',
    'whileTap',
    'whileFocus',
    'whileInView',
    'whileDrag',
    'layout',
    'layoutId',
    'layoutDependency',
    'layoutScroll',
    'drag',
    'dragConstraints',
    'dragElastic',
    'dragMomentum',
    'onAnimationStart',
    'onAnimationComplete',
    'onUpdate',
    'transformTemplate',
    'custom',
    'inherit',
    'viewport',
  ]);

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const Component = ReactImport.forwardRef<HTMLElement, Record<string, unknown>>(
          (props, ref) => {
            const cleanProps: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(props)) {
              if (!MOTION_ONLY_PROPS.has(k)) cleanProps[k] = v;
            }
            return ReactImport.createElement(
              typeof key === 'string' ? key : 'div',
              { ...cleanProps, ref },
            );
          },
        );
        Component.displayName = `motion.${String(key)}`;
        return Component;
      },
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      ReactImport.createElement(ReactImport.Fragment, null, children),
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
    useMotionValue: () => ({ get: () => 0, set: () => {} }),
    useTransform: () => 0,
    useScroll: () => ({ scrollY: { get: () => 0 } }),
    useInView: () => false,
    useReducedMotion: () => false,
  };
});

// Components added to page.tsx after the original test was written.
// These need to be mocked or jsdom blows up on undefined elements.
vi.mock('@/components/journey/profile-dropdown', () => ({
  ProfileDropdown: () => <div data-testid="profile-dropdown" />,
}));

vi.mock('@/components/workspace/workspace-provider', () => ({
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/workspace/workspace-page', () => ({
  WorkspacePage: () => <div data-testid="workspace-page" />,
}));

vi.mock('@/components/journey/journey-worker-status-banner', () => ({
  JourneyWorkerStatusBanner: () => <div data-testid="worker-status-banner" />,
}));

vi.mock('@/components/journey/prefill-stream-view', () => ({
  PrefillStreamView: ({
    deepResearchFields = {},
  }: {
    deepResearchFields?: Record<string, string>;
  }) => (
    <div data-testid="prefill-stream-view">
      <span data-testid="prefill-deep-company">{deepResearchFields.companyName}</span>
    </div>
  ),
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

async function emitResearchResult(
  section: string,
  data: Record<string, unknown>,
): Promise<void> {
  await act(async () => {
    realtimeControls.emit(section, makeResearchResult(section, data));
  });
}

describe('JourneyPage Manus launch wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    chatControls.reset();
    transportBodyCalls.reset();
    prefillControls.reset();
    realtimeControls.reset();
    researchJobActivityValue.current = {};
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes('/api/journey/session')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            researchResults: {
              deepResearchProgram: {
                status: 'complete',
                data: {
                  onboardingFields: {
                    companyName: {
                      value: 'Deep SaaSLaunch',
                      confidence: 92,
                    },
                    businessModel: {
                      value: 'Deep B2B SaaS growth agency',
                      confidence: 90,
                    },
                    productDescription: {
                      value: 'Deep pipeline growth operating system for SaaS teams.',
                      confidence: 88,
                    },
                    primaryIcpDescription: {
                      value: 'Deep Seed to Series B SaaS GTM teams.',
                      confidence: 86,
                    },
                  },
                },
              },
            },
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ complete: true, status: 'complete' }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    guardedFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    dispatchResearchSectionMock.mockImplementation(async (section: string) => ({
      status: 'queued',
      section,
      jobId: `job-${section}`,
    }));
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('parses research airtable.com as a research command before dispatching deep research', async () => {
    render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Research command or company URL'), {
        target: { value: 'research airtable.com' },
      });
      fireEvent.click(screen.getByLabelText('Start research'));
    });

    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'deepResearchProgram',
        expect.any(String),
        expect.stringContaining('Website: https://airtable.com'),
      );
    });
    expect(dispatchResearchSectionMock).not.toHaveBeenCalledWith(
      'deepResearchProgram',
      expect.any(String),
      expect.stringContaining('Website: https://research airtable.com'),
    );
    expect(screen.getByTestId('journey-user-command')).toHaveTextContent(
      'research airtable.com',
    );
    expect(screen.getAllByText('Research Agent').length).toBeGreaterThan(0);
  });

  it('rejects an invalid pasted research target without creating a failed artifact', async () => {
    render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Research command or company URL'), {
        target: { value: 'research aritable' },
      });
      fireEvent.click(screen.getByLabelText('Start research'));
    });

    expect(dispatchResearchSectionMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('journey-user-command')).toHaveTextContent(
      'research aritable',
    );
    expect(screen.getByText(/valid company domain/u)).toBeInTheDocument();
    expect(screen.queryByText(/Research Agent — failed/u)).not.toBeInTheDocument();
    expect(screen.queryByTestId('deep-research-report-artifact')).not.toBeInTheDocument();
  });

  it('routes the link-first CTA through company research and waits for Run section before dispatching the first report section', async () => {
    render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Research command or company URL'), {
        target: { value: 'https://saaslaunch.net' },
      });
      fireEvent.click(screen.getByLabelText('Start research'));
    });

    // URL-form deep research dispatches automatically (the only auto-dispatch
    // surviving the rescue plan).
    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'deepResearchProgram',
        expect.any(String),
        expect.stringContaining('Website: https://saaslaunch.net'),
      );
    });
    expect(guardedFetchMock).toHaveBeenCalledWith(
      '/api/journey/session',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"clearResearch":true'),
      }),
    );

    // Workspace opens after deep research completes; the Run section operator
    // control surfaces with the next pending section labeled. The first report
    // section MUST NOT auto-dispatch — supervised progression is the contract.
    await waitFor(() => {
      expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent(
        'Market Overview',
      );
    });
    expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent('ready');
    expect(dispatchResearchSectionMock).not.toHaveBeenCalledWith(
      'industryMarket',
      expect.any(String),
      expect.any(String),
    );

    // User clicks Run section → industryMarket dispatches with deep corpus context.
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId('journey-next-section-control')).getByRole('button', {
          name: /Run next research section: Market Overview/u,
        }),
      );
    });
    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'industryMarket',
        expect.any(String),
        expect.stringContaining('Company Name: Deep SaaSLaunch'),
      );
    });
    expect(screen.queryByText('start section synthesis')).not.toBeInTheDocument();
  });

  it('opens the workspace from realtime company research results when polling fails — Run section gates the first dispatch', async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes('/api/journey/research-status')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true }),
      });
    });

    render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Research command or company URL'), {
        target: { value: 'https://saaslaunch.net' },
      });
      fireEvent.click(screen.getByLabelText('Start research'));
    });

    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'deepResearchProgram',
        expect.any(String),
        expect.stringContaining('Website: https://saaslaunch.net'),
      );
    });

    await emitResearchResult('deepResearchProgram', {
      onboardingFields: {
        companyName: {
          value: 'Realtime SaaSLaunch',
          confidence: 92,
        },
        businessModel: {
          value: 'Realtime B2B SaaS growth agency',
          confidence: 90,
        },
        productDescription: {
          value: 'Realtime pipeline growth operating system.',
          confidence: 88,
        },
      },
    });

    // Workspace opens via realtime result; Run section control surfaces with the
    // first pending section. industryMarket MUST NOT auto-dispatch.
    await waitFor(() => {
      expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent(
        'Market Overview',
      );
    });
    expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent('ready');
    expect(dispatchResearchSectionMock).not.toHaveBeenCalledWith(
      'industryMarket',
      expect.any(String),
      expect.any(String),
    );

    // User clicks Run section → industryMarket dispatches against the realtime corpus.
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId('journey-next-section-control')).getByRole('button', {
          name: /Run next research section: Market Overview/u,
        }),
      );
    });
    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'industryMarket',
        expect.any(String),
        expect.stringContaining('Company Name: Realtime SaaSLaunch'),
      );
    });
  });

  it('does not auto-chain after a section completes — Run section must be clicked again to advance', async () => {
    render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Research command or company URL'), {
        target: { value: 'https://saaslaunch.net' },
      });
      fireEvent.click(screen.getByLabelText('Start research'));
    });

    // Wait for workspace to open with Run section ready for the first section.
    await waitFor(() => {
      expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent(
        'Market Overview',
      );
    });

    // First click — industryMarket dispatches.
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId('journey-next-section-control')).getByRole('button', {
          name: /Run next research section: Market Overview/u,
        }),
      );
    });
    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'industryMarket',
        expect.any(String),
        expect.stringContaining('Company Name: Deep SaaSLaunch'),
      );
    });

    // Section completes via realtime → must NOT auto-chain to icpValidation.
    await emitResearchResult('industryMarket', {
      sectionTitle: 'Market Category',
      statusSummary: 'Market category finished first.',
    });
    expect(dispatchResearchSectionMock).not.toHaveBeenCalledWith(
      'icpValidation',
      expect.any(String),
      expect.any(String),
    );

    // Operator control rotates to the next pending section, back in 'ready' state.
    await waitFor(() => {
      expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent(
        'ICP Validation',
      );
    });
    expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent('ready');

    // Second click — icpValidation now dispatches.
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId('journey-next-section-control')).getByRole('button', {
          name: /Run next research section: ICP Validation/u,
        }),
      );
    });
    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'icpValidation',
        expect.any(String),
        expect.stringContaining('Company Name: Deep SaaSLaunch'),
      );
    });
  });

  it('does not expose manual onboarding from the URL-first launch screen', () => {
    render(<JourneyPage />);

    expect(screen.getByLabelText('Research command or company URL')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open onboarding manually' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('start section synthesis')).not.toBeInTheDocument();
    expect(guardedFetchMock).not.toHaveBeenCalled();
    expect(dispatchResearchSectionMock).not.toHaveBeenCalled();
  });

  it('persists deep fields and dispatches the first section only after Run section click', async () => {
    render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Research command or company URL'), {
        target: { value: 'https://saaslaunch.net' },
      });
      fireEvent.click(screen.getByLabelText('Start research'));
    });

    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'deepResearchProgram',
        expect.any(String),
        expect.stringContaining('Website: https://saaslaunch.net'),
      );
    });

    // Wait for workspace to open and the next-section control to surface.
    await waitFor(() => {
      expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent(
        'Market Overview',
      );
    });

    // industryMarket MUST NOT auto-dispatch — supervised progression.
    expect(dispatchResearchSectionMock).not.toHaveBeenCalledWith(
      'industryMarket',
      expect.any(String),
      expect.any(String),
    );

    // Verify the deep-corpus fields were persisted to the session before any
    // section dispatched. This is the test's primary assertion.
    const sessionPatchCalls = guardedFetchMock.mock.calls.filter(
      ([url]) => url === '/api/journey/session',
    );
    const [, requestInit] = sessionPatchCalls.at(-1) as [
      string,
      { body?: string },
    ];
    const payload = JSON.parse(requestInit.body ?? '{}') as {
      activeRunId?: string;
      clearResearch?: boolean;
      fields?: Record<string, string>;
    };

    expect(payload.clearResearch).toBe(false);
    expect(typeof payload.activeRunId).toBe('string');
    expect(payload.fields).toMatchObject({
      websiteUrl: 'https://saaslaunch.net',
      companyName: 'Deep SaaSLaunch',
      businessModel: 'Deep B2B SaaS growth agency',
      productDescription: 'Deep pipeline growth operating system for SaaS teams.',
      primaryIcpDescription: 'Deep Seed to Series B SaaS GTM teams.',
    });

    // Click Run section → industryMarket dispatches with the persisted runId
    // and the deep-corpus context. This proves persistence happens BEFORE the
    // first section, not as a side-effect of auto-dispatch.
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId('journey-next-section-control')).getByRole('button', {
          name: /Run next research section: Market Overview/u,
        }),
      );
    });
    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'industryMarket',
        payload.activeRunId,
        expect.stringContaining('Website: https://saaslaunch.net'),
      );
    });
    expect(screen.queryByText('start section synthesis')).not.toBeInTheDocument();
  });

  it('does not dispatch any report section automatically when the workspace opens', async () => {
    render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Research command or company URL'), {
        target: { value: 'https://saaslaunch.net' },
      });
      fireEvent.click(screen.getByLabelText('Start research'));
    });

    // URL-form deep research is the only auto-dispatch surviving the rescue plan.
    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'deepResearchProgram',
        expect.any(String),
        expect.any(String),
      );
    });

    // Wait for workspace + Run section control.
    await waitFor(() => {
      expect(screen.getByTestId('journey-next-section-control')).toBeInTheDocument();
    });
    expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent(
      'Market Overview',
    );
    expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent('ready');

    // No report section may dispatch without a click. Only deepResearchProgram is exempt.
    const reportSections = [
      'industryMarket',
      'icpValidation',
      'competitors',
      'offerAnalysis',
      'keywordIntel',
      'crossAnalysis',
      'mediaPlan',
    ];
    for (const section of reportSections) {
      expect(dispatchResearchSectionMock).not.toHaveBeenCalledWith(
        section,
        expect.any(String),
        expect.any(String),
      );
    }
  });

  it('restores an active run from session storage on refresh', async () => {
    window.sessionStorage.setItem('aigos_journey_active_run_id', 'run-refresh');
    window.sessionStorage.setItem('aigos_journey_phase', 'prefilling');
    researchJobActivityValue.current = {
      deepResearchProgram: {
        jobId: 'job-deep',
        section: 'deepResearchProgram',
        status: 'running',
        tool: 'runDeepResearchProgram',
        startedAt: '2026-05-07T09:00:00.000Z',
      },
    };

    render(<JourneyPage />);

    await waitFor(() => {
      expect(realtimeControls.getActiveRunId()).toBe('run-refresh');
    });
    expect(screen.getAllByText('Research Agent').length).toBeGreaterThan(0);
    expect(screen.getByTestId('deep-research-report-artifact')).not.toHaveTextContent(
      'Market Category',
    );
  });
});

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
    dispatchResearchSectionMock.mockImplementation(async (section: string) => ({
      status: 'queued',
      section,
      jobId: `job-${section}`,
    }));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: { companyName: 'Airtable' },
        researchResults: null,
        jobStatus: null,
        updatedAt: '2026-05-07T09:00:00.000Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders Research Agent as the first assistant-visible output after a research command', async () => {
    const { container } = render(<JourneyPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Research command or company URL'), {
        target: { value: 'research airtable.com' },
      });
      fireEvent.click(screen.getByLabelText('Start research'));
    });

    await waitFor(() => {
      expect(dispatchResearchSectionMock).toHaveBeenCalledWith(
        'deepResearchProgram',
        expect.any(String),
        expect.stringContaining('Website: https://airtable.com'),
      );
    });

    const command = screen.getByTestId('journey-user-command');
    const firstAssistantOutput = container.querySelector(
      '[data-testid="journey-assistant-output"], [data-testid="journey-chat-assistant-message"]',
    );

    expect(firstAssistantOutput).not.toBeNull();
    expect(firstAssistantOutput).toHaveTextContent('Research Agent');
    expect(firstAssistantOutput).toHaveTextContent(
      'checking source-backed company context',
    );
    expect(
      command.compareDocumentPosition(firstAssistantOutput as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText('Buyer / ICP Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Competitive Positioning Agent')).not.toBeInTheDocument();
    expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
      'Research Agent is building the source-backed corpus',
    );
    expect(screen.getByTestId('deep-research-report-artifact')).not.toHaveTextContent(
      'Market Category',
    );
    expect(screen.getByTestId('deep-research-report-artifact')).not.toHaveTextContent(
      'Offer Diagnostic',
    );
  });

  it('buffers out-of-order backend completions and reveals specialists in canonical UI order', async () => {
    window.sessionStorage.setItem('aigos_journey_active_run_id', 'run-buffered');
    window.sessionStorage.setItem('aigos_journey_phase', 'workspace');

    render(<JourneyPage />);

    await waitFor(() => {
      expect(realtimeControls.getActiveRunId()).toBe('run-buffered');
    });

    await emitResearchResult('deepResearchProgram', {});
    await emitResearchResult('competitors', {
      sectionTitle: 'Competitive Positioning',
      statusSummary: 'Competitors finished before ICP.',
    });

    expect(screen.queryByText('Competitive Positioning Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Competitors finished before ICP.')).not.toBeInTheDocument();

    await emitResearchResult('industryMarket', {
      sectionTitle: 'Market Category',
      statusSummary: 'Market category finished first.',
    });

    await waitFor(() => {
      expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
        'Market category finished first.',
      );
    });
    expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
      'Market Category',
    );
    expect(screen.getByTestId('deep-research-report-artifact')).not.toHaveTextContent(
      'Competitors finished before ICP.',
    );

    await emitResearchResult('icpValidation', {
      sectionTitle: 'Buyer ICP',
      statusSummary: 'ICP validation now finished.',
    });

    await waitFor(() => {
      expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
        'Competitors finished before ICP.',
      );
    });

    const artifactText =
      screen.getByTestId('deep-research-report-artifact').textContent ?? '';
    const marketIndex = artifactText.indexOf('Market category finished first.');
    const icpIndex = artifactText.indexOf('ICP validation now finished.');
    const competitorIndex = artifactText.indexOf('Competitors finished before ICP.');

    expect(marketIndex).toBeGreaterThan(-1);
    expect(icpIndex).toBeGreaterThan(marketIndex);
    expect(competitorIndex).toBeGreaterThan(icpIndex);
  });

  it('shows the central report artifact growing from typed worker artifact events', async () => {
    window.sessionStorage.setItem('aigos_journey_active_run_id', 'run-draft-growth');
    window.sessionStorage.setItem('aigos_journey_phase', 'workspace');
    researchJobActivityValue.current = {
      deepResearchProgram: {
        jobId: 'job-deep',
        section: 'deepResearchProgram',
        status: 'complete',
        tool: 'runDeepResearchProgram',
        startedAt: '2026-05-07T09:00:00.000Z',
        completedAt: '2026-05-07T09:01:00.000Z',
      },
      industryMarket: {
        jobId: 'job-market',
        section: 'industryMarket',
        status: 'running',
        tool: 'researchIndustry',
        startedAt: '2026-05-07T09:02:00.000Z',
        updates: [
          {
            at: '2026-05-07T09:02:01.000Z',
            id: 'search-1',
            message: 'Opened Airtable product and pricing pages.',
            phase: 'tool',
            meta: {
              toolName: 'web_search',
              url: 'https://www.airtable.com/product',
              pageTitle: 'Airtable product',
            },
          },
          {
            at: '2026-05-07T09:02:02.000Z',
            id: 'artifact-delta-1',
            message: '## Market Category\n\nAirtable is positioned as an app platform for teams that need connected data, workflows, interfaces, and AI-assisted operations.',
            phase: 'artifact',
            meta: {
              eventType: 'artifact-delta',
              section: 'industryMarket',
              title: 'Market Category',
            },
          },
        ],
      },
    };

    const { rerender } = render(<JourneyPage />);

    await waitFor(() => {
      expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
        'connected data, workflows, interfaces',
      );
    });
    expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
      'Airtable is positioned',
    );
    const firstDraftText =
      screen.getByTestId('deep-research-report-artifact').textContent ?? '';
    expect(firstDraftText).not.toContain('Buyers compare Airtable');

    researchJobActivityValue.current = {
      ...researchJobActivityValue.current,
      industryMarket: {
        ...researchJobActivityValue.current.industryMarket,
        updates: [
          ...(researchJobActivityValue.current.industryMarket?.updates ?? []),
          {
            at: '2026-05-07T09:02:03.000Z',
            id: 'artifact-delta-2',
            message: '\n\nBuyers compare Airtable against spreadsheets, workflow tools, and lightweight databases when evaluating operational systems.',
            phase: 'artifact',
            meta: {
              eventType: 'artifact-delta',
              section: 'industryMarket',
              title: 'Market Category',
            },
          },
        ],
      },
    };

    rerender(<JourneyPage />);

    await waitFor(() => {
      expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
        'Buyers compare Airtable against spreadsheets',
      );
    });
    expect(
      screen.getByTestId('deep-research-report-artifact').textContent?.length ?? 0,
    ).toBeGreaterThan(firstDraftText.length);
  });

  it('reconstructs active, partial, completed, and buffered run state after refresh', async () => {
    window.sessionStorage.setItem('aigos_journey_active_run_id', 'run-refresh-rich');
    window.sessionStorage.setItem('aigos_journey_phase', 'workspace');
    researchJobActivityValue.current = {
      offerAnalysis: {
        jobId: 'job-offer',
        section: 'offerAnalysis',
        status: 'running',
        tool: 'researchOffer',
        startedAt: '2026-05-07T09:04:00.000Z',
        updates: [
            {
              at: '2026-05-07T09:04:01.000Z',
              id: 'offer-artifact-delta',
              message: '## Offer Diagnostic\n\nOffer analysis is being written from the saved corpus.',
              phase: 'artifact',
              meta: {
                eventType: 'artifact-delta',
                section: 'offerAnalysis',
                title: 'Offer Diagnostic',
              },
            },
          ],
        },
    };
    realtimeControls.setInitialResults({
      deepResearchProgram: makeResearchResult('deepResearchProgram', {}),
      industryMarket: makeResearchResult('industryMarket', {
        sectionTitle: 'Market Category',
        statusSummary: 'Market complete from persisted snapshot.',
      }),
      icpValidation: {
        ...makeResearchResult('icpValidation', {
          sectionTitle: 'Buyer ICP',
          statusSummary: 'ICP draft needs source review.',
        }),
        status: 'partial',
        error: 'Needs source review.',
      },
      competitors: makeResearchResult('competitors', {
        sectionTitle: 'Competitive Positioning',
        statusSummary: 'Competitor section complete from persisted snapshot.',
      }),
      keywordIntel: makeResearchResult('keywordIntel', {
        sectionTitle: 'Demand Intent',
        statusSummary: 'Keyword output finished early.',
      }),
    });

    render(<JourneyPage />);

    await waitFor(() => {
      expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
        'Offer analysis is being written from the saved corpus.',
      );
    });

    const artifact = screen.getByTestId('deep-research-report-artifact');

    expect(artifact).toHaveTextContent('Offer Diagnostic');
    expect(artifact).not.toHaveTextContent('Market complete from persisted snapshot.');

    fireEvent.click(within(artifact).getByRole('button', { name: /Market Category/u }));
    expect(artifact).toHaveTextContent('Market complete from persisted snapshot.');

    fireEvent.click(within(artifact).getByRole('button', { name: /Buyer ICP/u }));
    expect(artifact).toHaveTextContent('Buyer ICP');
    expect(artifact).toHaveTextContent('ICP draft needs source review.');

    fireEvent.click(
      within(artifact).getByRole('button', { name: /Competitive Positioning/u }),
    );
    expect(artifact).toHaveTextContent('Competitive Positioning');
    expect(artifact).toHaveTextContent('Competitor section complete from persisted snapshot.');

    fireEvent.click(within(artifact).getByRole('button', { name: /Offer Diagnostic/u }));
    expect(artifact).toHaveTextContent('Offer analysis is being written from the saved corpus.');
    expect(artifact).not.toHaveTextContent('Demand Intent');
    expect(artifact).not.toHaveTextContent('Keyword output finished early.');
  });
});
