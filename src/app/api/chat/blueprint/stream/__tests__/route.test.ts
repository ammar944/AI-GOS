/**
 * Integration Tests for POST /api/chat/blueprint/stream
 *
 * Tests the streaming chat API route handler including:
 * - Request validation (message, blueprint required)
 * - SSE streaming responses for Q&A intent
 * - JSON responses for edit/explain intents
 * - Content-Type headers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { MockOpenRouterClient, createMockChatResponse } from '@/test/mocks/openrouter';

// Create a shared mock client instance
const mockClient = new MockOpenRouterClient();

// Mock the openrouter module
vi.mock('@/lib/openrouter/client', () => ({
  createOpenRouterClient: () => mockClient,
  MODELS: { CLAUDE_SONNET: 'claude-3-sonnet' },
}));

// Mock the explain agent - must be defined inline for hoisting
vi.mock('@/lib/chat/agents/explain-agent', () => ({
  handleExplain: vi.fn().mockResolvedValue({
    explanation: 'The recommendation is based on market research and competitor gaps.',
    relatedFactors: [
      { section: 'competitorAnalysis', factor: 'Market gaps', relevance: 'Untapped opportunity' },
    ],
    confidence: 'high',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cost: 0.001,
  }),
}));

// Reference for test assertions (matching the mock above)
const mockExplainResponse = {
  explanation: 'The recommendation is based on market research and competitor gaps.',
  relatedFactors: [
    { section: 'competitorAnalysis', factor: 'Market gaps', relevance: 'Untapped opportunity' },
  ],
  confidence: 'high' as const,
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  cost: 0.001,
};

/**
 * Helper to call the POST route handler
 */
async function callRoute(body: unknown) {
  const request = new Request('http://test/api/chat/blueprint/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Use POST with proper NextRequest
  const { NextRequest } = await import('next/server');
  const nextRequest = new NextRequest('http://test/api/chat/blueprint/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(nextRequest);
}

/**
 * Create valid request body factory
 */
function createValidRequest(
  overrides?: Partial<{ message: string; blueprint: Record<string, unknown> }>
) {
  return {
    message: 'What is the recommended positioning?',
    blueprint: {
      crossAnalysisSynthesis: {
        recommendedPositioning: 'Test positioning for B2B SaaS',
        primaryMessagingAngles: ['Time savings', 'Cost reduction', 'Scale'],
      },
      industryMarketOverview: {
        categorySnapshot: { category: 'E-commerce SaaS' },
        painPoints: { primary: ['Manual tasks', 'Scaling issues'] },
      },
    },
    ...overrides,
  };
}

describe('POST /api/chat/blueprint/stream', () => {
  beforeEach(() => {
    mockClient.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Request Validation', () => {
    it('returns 400 for missing message', async () => {
      const response = await callRoute({
        blueprint: { test: 'data' },
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Message is required');
    });

    it('returns 400 for missing blueprint', async () => {
      const response = await callRoute({
        message: 'What is the positioning?',
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Blueprint context is required');
    });

    it('returns 400 for empty message', async () => {
      const response = await callRoute({
        message: '',
        blueprint: { test: 'data' },
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Message is required');
    });
  });

  describe('Content-Type Headers Based on Intent', () => {
    it('returns correct Content-Type header (text/event-stream) for Q&A', async () => {
      // Queue stream chunks for Q&A response
      mockClient.queueStreamChunks(['The ', 'recommended ', 'positioning ', 'is...']);

      const response = await callRoute(
        createValidRequest({ message: 'What is the recommended positioning?' })
      );

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('returns application/json Content-Type for edit intent', async () => {
      // Queue non-streaming response for edit
      mockClient.queueChatResponse(
        createMockChatResponse(`I'll update the positioning.

\`\`\`json
{
  "isEdit": true,
  "edits": [
    {
      "section": "crossAnalysisSynthesis",
      "fieldPath": "recommendedPositioning",
      "oldValue": "Old value",
      "newValue": "New value",
      "explanation": "Updated positioning"
    }
  ]
}
\`\`\``)
      );

      const response = await callRoute(
        createValidRequest({ message: 'Change the positioning to focus on AI' })
      );

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('returns application/json Content-Type for explain intent', async () => {
      // The explain agent is mocked, so no need to queue a chat response
      const response = await callRoute(
        createValidRequest({ message: 'Why is this positioning recommended?' })
      );

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Streaming Response Body', () => {
    it('streams SSE events for Q&A messages', async () => {
      // Queue stream chunks
      mockClient.queueStreamChunks(['Hello', ' ', 'World', '!']);

      const response = await callRoute(
        createValidRequest({ message: 'Tell me about the blueprint' })
      );

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();

      // Read the stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
      }

      // Verify SSE format - should contain data: prefixed lines
      expect(fullContent).toContain('data:');

      // Parse the SSE events
      const events = fullContent
        .split('\n\n')
        .filter((e) => e.startsWith('data:'))
        .map((e) => {
          try {
            return JSON.parse(e.replace('data: ', ''));
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Should have content events and a done event
      const contentEvents = events.filter((e) => e.content !== undefined);
      const doneEvent = events.find((e) => e.done === true);

      expect(contentEvents.length).toBeGreaterThan(0);
      expect(doneEvent).toBeDefined();
      expect(doneEvent.metadata).toBeDefined();
      expect(doneEvent.metadata.processingTime).toBeDefined();
    });
  });

  describe('Non-Streaming Responses', () => {
    it('returns JSON response with pendingEdit for edit requests', async () => {
      mockClient.queueChatResponse(
        createMockChatResponse(`I'll make this change.

\`\`\`json
{
  "isEdit": true,
  "edits": [
    {
      "section": "crossAnalysisSynthesis",
      "fieldPath": "recommendedPositioning",
      "oldValue": "Old",
      "newValue": "New",
      "explanation": "Better positioning"
    }
  ]
}
\`\`\``)
      );

      const response = await callRoute(
        createValidRequest({ message: 'Update the positioning' })
      );

      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json.pendingEdit).toBeDefined();
      expect(json.pendingEdits).toBeDefined();
      expect(json.pendingEdits.length).toBe(1);
      expect(json.confidence).toBe('high');
    });

    it('returns JSON response with isExplanation for explain requests', async () => {
      // The explain agent is mocked with mockExplainResponse
      const response = await callRoute(
        createValidRequest({ message: 'Explain why this was recommended' })
      );

      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json.isExplanation).toBe(true);
      expect(json.response).toBe(mockExplainResponse.explanation);
      expect(json.relatedFactors).toBeDefined();
      expect(json.relatedFactors.length).toBe(1);
      expect(json.relatedFactors[0].section).toBe('competitorAnalysis');
      expect(json.confidence).toBe('high');
      expect(json.metadata.tokensUsed).toBe(150);
    });
  });
});
