import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedChat } from '@/components/chat/unified-chat';

type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';

const chatMocks = vi.hoisted(() => {
  const sendMessage = vi.fn();
  const setMessages = vi.fn();
  const stop = vi.fn();
  const transportInstances: Array<{ api?: string; body?: object }> = [];
  const workspaceState = {
    sessionId: 'run-1',
    phase: 'workspace',
    currentSection: 'industryMarket',
    sectionStates: {},
    sectionErrors: {},
    cards: {},
  };

  return {
    sendMessage,
    setMessages,
    stop,
    transportInstances,
    workspaceState,
  };
});

vi.mock('ai', () => ({
  DefaultChatTransport: class DefaultChatTransport {
    api?: string;
    body?: object;

    constructor(options?: { api?: string; body?: object }) {
      this.api = options?.api;
      this.body = options?.body;
      chatMocks.transportInstances.push({
        api: options?.api,
        body: options?.body,
      });
    }
  },
}));

vi.mock('@ai-sdk/react', async () => {
  const ReactModule = await import('react');

  return {
    useChat: () => {
      const [messages, setMessagesState] = ReactModule.useState<UIMessage[]>([]);
      const [status] = ReactModule.useState<ChatStatus>('ready');

      const setMessages = ReactModule.useCallback(
        (nextMessages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => {
          chatMocks.setMessages(nextMessages);
          setMessagesState((currentMessages) =>
            typeof nextMessages === 'function'
              ? nextMessages(currentMessages)
              : nextMessages,
          );
        },
        [],
      );

      const sendMessage = ReactModule.useCallback((message: { text: string }) => {
        chatMocks.sendMessage(message);
        const nextMessage: UIMessage = {
          id: 'user-submitted',
          role: 'user',
          parts: [{ type: 'text', text: message.text }],
        };
        setMessagesState((currentMessages) => [...currentMessages, nextMessage]);
      }, []);

      return {
        messages,
        sendMessage,
        status,
        stop: chatMocks.stop,
        setMessages,
      };
    },
  };
});

vi.mock('@/lib/workspace/use-workspace', () => ({
  useWorkspace: () => ({
    state: chatMocks.workspaceState,
    updateCard: vi.fn(),
  }),
}));

vi.mock('@/components/chat/chat-input', () => ({
  ChatInput: ({ onSubmit }: { onSubmit: (message: string) => void }) => (
    <button type="button" onClick={() => onSubmit('Persist this note')}>
      Send prompt
    </button>
  ),
}));

function mockFetch(responses: Response[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce(response);
  });
  global.fetch = fetchMock;
  return fetchMock;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('UnifiedChat workspace message persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatMocks.transportInstances.length = 0;
    chatMocks.workspaceState.cards = {};
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('hydrates persisted section messages from the Journey session route', async () => {
    const persistedMessage: UIMessage = {
      id: 'persisted-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Persisted market question' }],
    };
    const fetchMock = mockFetch([
      jsonResponse({ workspaceMessages: [persistedMessage] }),
    ]);

    render(
      <UnifiedChat
        section="industryMarket"
        activeRunId="run-1"
        userName="Ammar"
        companyName="AI-GOS"
      />,
    );

    await screen.findByText('Persisted market question');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/journey/session?runId=run-1&section=industryMarket',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
    expect(chatMocks.setMessages).toHaveBeenCalledWith([persistedMessage]);
  });

  it('persists ready section messages with the active run id and section', async () => {
    const fetchMock = mockFetch([
      jsonResponse({ workspaceMessages: [] }),
      jsonResponse({ ok: true }),
    ]);

    render(
      <UnifiedChat
        section="industryMarket"
        activeRunId="run-1"
        userName="Ammar"
        companyName="AI-GOS"
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/journey/session?runId=run-1&section=industryMarket',
        expect.objectContaining({ credentials: 'same-origin' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));

    await waitFor(
      () => {
        const patchCall = fetchMock.mock.calls.find((call) => {
          const [url, init] = call;
          return (
            url === '/api/journey/session' &&
            typeof init === 'object' &&
            init !== null &&
            (init as RequestInit).method === 'PATCH'
          );
        });
        expect(patchCall).toBeDefined();

        const init = patchCall?.[1] as RequestInit;
        const body = JSON.parse(String(init.body)) as {
          activeRunId: string;
          workspaceMessages: { section: string; messages: UIMessage[] };
        };
        expect(body.activeRunId).toBe('run-1');
        expect(body.workspaceMessages.section).toBe('industryMarket');
        expect(body.workspaceMessages.messages[0]?.parts).toEqual([
          { type: 'text', text: 'Persist this note' },
        ]);
      },
      { timeout: 1500 },
    );
  });

  it('builds the Journey stream transport body with active run and section card context', async () => {
    chatMocks.workspaceState.cards = {
      'market-card': {
        id: 'market-card',
        sectionKey: 'industryMarket',
        cardType: 'market-overview',
        label: 'Market Overview',
        content: { summary: 'AI GTM market context' },
      },
      'competitor-card': {
        id: 'competitor-card',
        sectionKey: 'competitors',
        cardType: 'competitor',
        label: 'Competitor',
        content: { name: 'OtherCo' },
      },
    };
    mockFetch([jsonResponse({ workspaceMessages: [] })]);

    render(
      <UnifiedChat
        section="industryMarket"
        activeRunId="run-transport-1"
        userName="Ammar"
        companyName="AI-GOS"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /research/i }));

    await waitFor(() => {
      const transport = chatMocks.transportInstances.at(-1);

      expect(transport).toEqual({
        api: '/api/journey/stream',
        body: {
          activeRunId: 'run-transport-1',
          currentSection: 'industryMarket',
          sectionCards: [
            {
              id: 'market-card',
              cardType: 'market-overview',
              label: 'Market Overview',
              content: { summary: 'AI GTM market context' },
            },
          ],
          deepResearch: true,
          workspaceChatMode: 'research',
        },
      });
    });
  });
});
