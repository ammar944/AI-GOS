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
  realtimeControls,
  sendMessageMock,
  setJourneySessionMock,
} = vi.hoisted(() => {
  const messageListeners = new Set<(messages: UIMessage[]) => void>();
  const statusListeners = new Set<(status: MockChatStatus) => void>();
  let messages: UIMessage[] = [];
  let status: MockChatStatus = 'ready';
  let onSectionComplete:
    | ((section: string, result: ResearchSectionResult) => void)
    | null = null;

  return {
    sendMessageMock: vi.fn(),
    addToolOutputMock: vi.fn(),
    addToolApprovalResponseMock: vi.fn(),
    setJourneySessionMock: vi.fn(),
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
      reset(): void {
        messages = [];
        status = 'ready';
      },
    },
    realtimeControls: {
      setHandler(
        nextHandler: ((section: string, result: ResearchSectionResult) => void) | null,
      ): void {
        onSectionComplete = nextHandler;
      },
      emit(section: string, result: ResearchSectionResult): void {
        onSectionComplete?.(section, result);
      },
      reset(): void {
        onSectionComplete = null;
      },
    },
  };
});

vi.mock('ai', () => ({
  DefaultChatTransport: class DefaultChatTransport {},
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock('@ai-sdk/react', async () => {
  const React = await import('react');

  return {
    useChat: () => {
      const [messages, setMessagesState] = React.useState<UIMessage[]>(
        chatControls.getMessages(),
      );
      const [status, setStatusState] = React.useState<MockChatStatus>(
        chatControls.getStatus(),
      );

      React.useEffect(() => chatControls.addMessageListener(setMessagesState), []);
      React.useEffect(() => chatControls.addStatusListener(setStatusState), []);

      return {
        messages,
        status,
        error: undefined,
        sendMessage: sendMessageMock,
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
    partialResult: undefined,
    submit: vi.fn(),
    isLoading: false,
    error: undefined,
    stop: vi.fn(),
    fieldsFound: 0,
  }),
}));

vi.mock('@/lib/journey/research-realtime', async () => {
  const React = await import('react');

  return {
    useResearchRealtime: ({
      onSectionComplete,
    }: {
      onSectionComplete: (section: string, result: ResearchSectionResult) => void;
    }) => {
      React.useEffect(() => {
        realtimeControls.setHandler(onSectionComplete);
        return () => {
          realtimeControls.setHandler(null);
        };
      }, [onSectionComplete]);
    },
  };
});

vi.mock('@/lib/journey/research-job-activity', () => ({
  useResearchJobActivity: () => ({}),
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
    onClick,
    section,
  }: {
    onClick: () => void;
    section: string;
  }) => (
    <button type="button" data-testid={`artifact-trigger-${section}`} onClick={onClick}>
      reopen {section}
    </button>
  ),
}));

vi.mock('@/components/journey/artifact-panel', () => ({
  ArtifactPanel: ({
    section,
    onApprove,
    onClose,
  }: {
    section: string;
    onApprove: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="artifact-panel">
      <span>{section}</span>
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

describe('JourneyPage artifact orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatControls.reset();
    realtimeControls.reset();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
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
    expect(sendMessageMock).toHaveBeenCalledWith(
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

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { hidden: true },
      }),
    );
  });
});
