/**
 * Integration Tests for POST /api/chat/blueprint
 *
 * Tests the blueprint chat API route handler including:
 * - Request validation (message, blueprint required)
 * - Q&A responses with confidence and metadata
 * - Edit request handling with pendingEdit
 * - Explanation request handling with isExplanation
 * - Error handling for OpenRouter client errors
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

/**
 * Helper to call the POST route handler
 */
async function callRoute(body: unknown) {
  const request = new Request('http://test/api/chat/blueprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(request);
}

/**
 * Create valid request body factory
 */
function createValidRequest(
  overrides?: Partial<{ message: string; blueprint: Record<string, unknown>; chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> }>
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

describe('POST /api/chat/blueprint', () => {
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

    it('returns 400 for empty message string', async () => {
      const response = await callRoute({
        message: '',
        blueprint: { test: 'data' },
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Message is required');
    });

    it('returns 400 for whitespace-only message', async () => {
      const response = await callRoute({
        message: '   ',
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

    it('returns 400 for non-object blueprint', async () => {
      const response = await callRoute({
        message: 'What is the positioning?',
        blueprint: 'not an object',
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Blueprint context is required');
    });

    it('returns 400 for null blueprint', async () => {
      const response = await callRoute({
        message: 'What is the positioning?',
        blueprint: null,
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Blueprint context is required');
    });
  });

  describe('Successful Q&A Responses', () => {
    it('returns 200 with response for valid Q&A request', async () => {
      mockClient.queueChatResponse(
        createMockChatResponse('The recommended positioning is focused on B2B SaaS automation.')
      );

      const response = await callRoute(createValidRequest());

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.response).toBeDefined();
      expect(json.response).toContain('positioning');
    });

    it('response includes confidence field', async () => {
      mockClient.queueChatResponse(
        createMockChatResponse('Here is the answer based on the blueprint data.')
      );

      const response = await callRoute(createValidRequest());

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.confidence).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(json.confidence);
    });

    it('response includes metadata with tokensUsed, cost, processingTime', async () => {
      mockClient.queueChatResponse(
        createMockChatResponse('Test response', {
          usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
          cost: 0.002,
        })
      );

      const response = await callRoute(createValidRequest());

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.metadata).toBeDefined();
      expect(json.metadata.tokensUsed).toBe(300);
      expect(json.metadata.cost).toBe(0.002);
      expect(typeof json.metadata.processingTime).toBe('number');
      expect(json.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edit Request Handling', () => {
    it('edit request returns pendingEdit when AI responds with edit JSON', async () => {
      const editResponse = `I'll update the positioning for you.

\`\`\`json
{
  "isEdit": true,
  "edits": [
    {
      "section": "crossAnalysisSynthesis",
      "fieldPath": "recommendedPositioning",
      "oldValue": "Test positioning for B2B SaaS",
      "newValue": "New improved positioning for enterprise clients",
      "explanation": "Updated to focus on enterprise market"
    }
  ]
}
\`\`\``;

      mockClient.queueChatResponse(createMockChatResponse(editResponse));

      const response = await callRoute(
        createValidRequest({ message: 'Change the positioning to focus on enterprise clients' })
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.pendingEdit).toBeDefined();
      expect(json.pendingEdit.section).toBe('crossAnalysisSynthesis');
      expect(json.pendingEdit.fieldPath).toBe('recommendedPositioning');
      expect(json.pendingEdit.newValue).toContain('enterprise');
      expect(json.pendingEdits).toBeDefined();
      expect(json.pendingEdits.length).toBe(1);
      expect(json.confidence).toBe('high'); // Edits have high confidence
    });

    it('edit request returns multiple pendingEdits for batch operations', async () => {
      const editResponse = `I'll update multiple fields for the rebrand.

\`\`\`json
{
  "isEdit": true,
  "edits": [
    {
      "section": "crossAnalysisSynthesis",
      "fieldPath": "recommendedPositioning",
      "oldValue": "Old positioning",
      "newValue": "New positioning",
      "explanation": "Primary positioning change"
    },
    {
      "section": "crossAnalysisSynthesis",
      "fieldPath": "primaryMessagingAngles",
      "oldValue": ["Old angle 1"],
      "newValue": ["New angle 1", "New angle 2"],
      "explanation": "Updated messaging angles"
    }
  ]
}
\`\`\``;

      mockClient.queueChatResponse(createMockChatResponse(editResponse));

      const response = await callRoute(
        createValidRequest({ message: 'Rebrand to focus on AI automation' })
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.pendingEdits).toBeDefined();
      expect(json.pendingEdits.length).toBe(2);
      // pendingEdit should be undefined when there are multiple edits
      expect(json.pendingEdit).toBeUndefined();
    });
  });

  describe('Explanation Request Handling', () => {
    it('explanation request returns isExplanation true when AI responds with explain JSON', async () => {
      const explainResponse = `Let me explain the reasoning.

\`\`\`json
{
  "isExplanation": true,
  "explanation": "The positioning was chosen based on market analysis showing strong demand for B2B automation solutions.",
  "relatedFactors": [
    {"section": "industryMarketOverview", "factor": "Market trends", "relevance": "Growing demand for automation"},
    {"section": "competitorAnalysis", "factor": "Competitor gaps", "relevance": "No competitor focuses on this angle"}
  ],
  "confidence": "high"
}
\`\`\``;

      mockClient.queueChatResponse(createMockChatResponse(explainResponse));

      const response = await callRoute(
        createValidRequest({ message: 'Why is this positioning recommended?' })
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.isExplanation).toBe(true);
      expect(json.relatedFactors).toBeDefined();
      expect(json.relatedFactors.length).toBe(2);
      expect(json.confidence).toBe('high');
    });
  });

  describe('Error Handling', () => {
    it('returns 500 when OpenRouter client throws error', async () => {
      mockClient.queueChatResponse(new Error('OpenRouter API error'));

      const response = await callRoute(createValidRequest());

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });

    it('error response includes error message', async () => {
      mockClient.queueChatResponse(new Error('Rate limit exceeded'));

      const response = await callRoute(createValidRequest());

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Failed to process chat message');
      expect(json.details).toBe('Rate limit exceeded');
    });
  });

  describe('Chat History Handling', () => {
    it('chat history is passed to the AI correctly', async () => {
      mockClient.queueChatResponse(createMockChatResponse('Follow-up response'));

      const chatHistory = [
        { role: 'user' as const, content: 'What is the positioning?' },
        { role: 'assistant' as const, content: 'The positioning is X.' },
      ];

      const response = await callRoute(createValidRequest({ chatHistory }));

      expect(response.status).toBe(200);

      // Verify the mock was called with chat history
      const lastCall = mockClient.getLastCall('chat');
      expect(lastCall).toBeDefined();
      expect(lastCall?.args.messages).toBeDefined();

      // The messages should include: system prompt, blueprint context, chat history, current message
      const messages = lastCall?.args.messages;
      expect(messages?.length).toBeGreaterThan(3);

      // Check that chat history is included (should be after system and context messages)
      const userMessages = messages?.filter(
        (m: { role: string; content: string }) => m.role === 'user' && m.content === 'What is the positioning?'
      );
      expect(userMessages?.length).toBe(1);

      const assistantMessages = messages?.filter(
        (m: { role: string; content: string }) => m.role === 'assistant' && m.content === 'The positioning is X.'
      );
      expect(assistantMessages?.length).toBe(1);
    });
  });
});
