import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  transportOptions: vi.fn(),
  useChat: vi.fn(),
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: (options: unknown) => mocks.useChat(options),
}));

vi.mock('ai', () => ({
  DefaultChatTransport: class DefaultChatTransport {
    public constructor(options: unknown) {
      mocks.transportOptions(options);
    }
  },
  isToolUIPart: (part: { type?: string }) =>
    typeof part?.type === 'string' && part.type.startsWith('tool-'),
  getToolName: (part: { type?: string }) =>
    typeof part?.type === 'string' ? part.type.replace(/^tool-/, '') : '',
}));

const { AuditChatPanel } = await import('../chat/audit-chat-panel');

describe('AuditChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends trimmed operator text through useChat', () => {
    mocks.useChat.mockReturnValue({
      error: undefined,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'I can revise the brief.' }],
        },
      ],
      sendMessage: mocks.sendMessage,
      status: 'ready',
    });

    render(
      <AuditChatPanel
        runId="00000000-0000-4000-8000-0000000000aa"
        focusedZone="positioningVoiceOfCustomer"
      />,
    );

    expect(screen.getByText('Strategist')).toBeInTheDocument();
    expect(screen.getByText('I can revise the brief.')).toBeInTheDocument();
    expect(mocks.transportOptions).toHaveBeenCalledWith({
      api: '/api/research-v2/chat',
      body: expect.any(Function),
    });
    const body = mocks.transportOptions.mock.calls[0]?.[0] as {
      body: () => Record<string, unknown>;
    };
    expect(body.body()).toEqual({
      runId: '00000000-0000-4000-8000-0000000000aa',
      focusedZone: 'positioningVoiceOfCustomer',
    });

    fireEvent.change(
      screen.getByPlaceholderText('Ask the strategist - reframe, fix, or rerun...'),
      {
        target: { value: '  Draft the offer brief  ' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(mocks.sendMessage).toHaveBeenCalledWith({
      text: 'Draft the offer brief',
    });
  });

  it('renders professional status rows for tool calls and clean failure rows', () => {
    mocks.useChat.mockReturnValue({
      error: undefined,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-rerunSection',
              toolCallId: 'call-1',
              state: 'output-available',
              output: { message: 'Queued rerun for Voice of Customer.' },
            },
            {
              type: 'tool-editClaim',
              toolCallId: 'call-2',
              state: 'output-error',
              errorText: 'TypeError: cannot read properties of undefined',
            },
          ],
        },
      ],
      sendMessage: mocks.sendMessage,
      status: 'ready',
    });

    render(<AuditChatPanel runId="00000000-0000-4000-8000-0000000000aa" />);

    // Friendly labels + the tool's own clean message, never raw tool ids.
    expect(screen.getByText('Rerunning section')).toBeInTheDocument();
    expect(
      screen.getByText('Queued rerun for Voice of Customer.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/rerunSection\.\.\./)).not.toBeInTheDocument();

    // Failures render as a clean status row, never the raw error text.
    expect(screen.getByText('Editing claim')).toBeInTheDocument();
    expect(
      screen.queryByText(/TypeError: cannot read properties/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "This action didn't complete. Try again or rephrase the request.",
      ),
    ).toBeInTheDocument();
  });
});
