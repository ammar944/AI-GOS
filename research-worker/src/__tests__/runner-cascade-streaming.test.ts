import EventEmitter from 'node:events';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK at module level. The default export is a class whose
// instances expose `messages.stream(...)`. We replace it with a vi.fn() so each
// test can swap in a fresh stream + finalMessage envelope.
const mockStream = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { stream: mockStream };
      beta = { messages: { toolRunner: vi.fn() } };
    },
  };
});

import {
  runStreamingAttempt,
  shortInputSummary,
  type CascadeAttemptConfig,
} from '../runner-cascade';
import type { RunnerProgressUpdate } from '../runner';

class MockMessageStream extends EventEmitter {
  finalMessage = vi.fn();
}

function baseConfig(overrides: Partial<CascadeAttemptConfig> = {}): CascadeAttemptConfig {
  return {
    mode: 'unit-test',
    model: 'claude-sonnet-4-6',
    maxTokens: 16_000,
    timeoutMs: 60_000,
    tools: [],
    system: 'You are a test runner.',
    synthesisMessage: 'compiling test results',
    userMessage: 'do the thing',
    ...overrides,
  };
}

function finalMessageEnvelope(text: string) {
  return {
    id: 'msg_test',
    model: 'claude-sonnet-4-6',
    role: 'assistant' as const,
    stop_reason: 'end_turn' as const,
    type: 'message' as const,
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  };
}

describe('shortInputSummary', () => {
  it('returns compact JSON for short inputs', () => {
    expect(shortInputSummary({ query: 'foo' })).toBe('{"query":"foo"}');
  });

  it('truncates with ellipsis past 80 chars', () => {
    const big = { query: 'x'.repeat(200) };
    const out = shortInputSummary(big);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith('…')).toBe(true);
  });

  it('collapses whitespace and newlines', () => {
    const out = shortInputSummary({ a: 'line1\n  line2' });
    expect(out).not.toContain('\n');
    // single space separators only
    expect(out).not.toMatch(/  /);
  });

  it('falls back to String() for non-serializable input', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(shortInputSummary(cyclic)).toContain('object');
  });
});

describe('runStreamingAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits thinking + tool progress updates in order, each with a unique id', async () => {
    const fakeStream = new MockMessageStream();
    fakeStream.finalMessage.mockImplementation(async () => {
      // Push events synchronously before resolving so listeners are invoked.
      fakeStream.emit('contentBlock', {
        type: 'thinking',
        thinking: 'pondering the inputs',
        signature: 'sig-1',
      });
      fakeStream.emit('contentBlock', {
        type: 'tool_use',
        id: 'tool-1',
        name: 'web_search',
        input: { query: 'DHS S968 rubber importers' },
        caller: { type: 'direct' },
      });
      fakeStream.emit('contentBlock', {
        type: 'text',
        text: '{"hello":"world"}',
      });
      return finalMessageEnvelope('{"hello":"world"}');
    });
    mockStream.mockReturnValue(fakeStream);

    const updates: RunnerProgressUpdate[] = [];
    const onProgress = vi.fn(async (u: RunnerProgressUpdate) => {
      updates.push(u);
    });

    const result = await runStreamingAttempt(
      baseConfig({ mode: 'streaming-test' }),
      onProgress,
    );

    expect(result.resultText).toBe('{"hello":"world"}');
    expect(result.telemetry).toBeDefined();

    // emitRunnerProgress assigns each update an id internally; capture them
    // here and confirm at least the thinking + tool events flowed.
    const phases = updates.map((u) => u.phase);
    expect(phases).toContain('thinking');
    expect(phases).toContain('tool');

    const thinkingUpdate = updates.find((u) => u.phase === 'thinking');
    const toolUpdate = updates.find((u) => u.phase === 'tool');
    expect(thinkingUpdate?.message).toMatch(/Thought for \d+s/);
    expect(toolUpdate?.message).toContain('Calling web_search');
    expect(toolUpdate?.message).toContain('DHS S968 rubber importers');

    // Each update must have a distinct id so the emit-progress dedup
    // (phase:message:id signature) lets them through.
    const ids = updates.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('enables extended thinking config for thinking-capable models', async () => {
    const fakeStream = new MockMessageStream();
    fakeStream.finalMessage.mockResolvedValue(finalMessageEnvelope(''));
    mockStream.mockReturnValue(fakeStream);

    await runStreamingAttempt(baseConfig({ model: 'claude-opus-4-7' }));

    const params = mockStream.mock.calls[0][0];
    expect(params.thinking).toBeDefined();
    expect(params.thinking.type).toBe('enabled');
    expect(params.thinking.budget_tokens).toBeGreaterThanOrEqual(1024);
    expect(params.thinking.budget_tokens).toBeLessThan(params.max_tokens);
  });

  it('omits thinking config for models that do not support extended thinking', async () => {
    const fakeStream = new MockMessageStream();
    fakeStream.finalMessage.mockResolvedValue(finalMessageEnvelope(''));
    mockStream.mockReturnValue(fakeStream);

    await runStreamingAttempt(baseConfig({ model: 'claude-haiku-4-5' }));

    const params = mockStream.mock.calls[0][0];
    expect(params.thinking).toBeUndefined();
  });

  it('returns the final text block as resultText', async () => {
    const fakeStream = new MockMessageStream();
    fakeStream.finalMessage.mockResolvedValue(
      finalMessageEnvelope('{"section":"market","confidence":0.9}'),
    );
    mockStream.mockReturnValue(fakeStream);

    const result = await runStreamingAttempt(baseConfig());
    expect(result.resultText).toBe('{"section":"market","confidence":0.9}');
  });

  it('rejects with a timeout error if finalMessage never resolves', async () => {
    const fakeStream = new MockMessageStream();
    // finalMessage returns a forever-pending promise — only the timeout race wins.
    fakeStream.finalMessage.mockImplementation(() => new Promise(() => {}));
    mockStream.mockReturnValue(fakeStream);

    await expect(
      runStreamingAttempt(baseConfig({ timeoutMs: 20 })),
    ).rejects.toThrow(/timed out/);
  });

  it('emits the synthesis analysis message before stream consumption', async () => {
    const fakeStream = new MockMessageStream();
    fakeStream.finalMessage.mockResolvedValue(finalMessageEnvelope(''));
    mockStream.mockReturnValue(fakeStream);

    const updates: RunnerProgressUpdate[] = [];
    await runStreamingAttempt(
      baseConfig({ synthesisMessage: 'preparing brief' }),
      async (u) => {
        updates.push(u);
      },
    );

    const first = updates[0];
    expect(first.phase).toBe('analysis');
    expect(first.message).toBe('preparing brief');
  });
});
