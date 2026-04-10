# Fathom Sales Call Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users paste Fathom meeting links during onboarding to enrich research with structured sales call insights treated as ground-truth data.

**Architecture:** Hybrid fetch/extract — a Next.js API route fetches the transcript fast (~2s), stores it as a `business_profile_documents` row, then dispatches to the Railway worker for deep AI extraction. Results flow back via Supabase realtime. A dedicated frontend panel shows categorized insights before research runs.

**Tech Stack:** Fathom API (`https://api.fathom.ai/external/v1`), Anthropic SDK (`generateObject`), Supabase (JSONB), Next.js API routes, React components, Zod schemas.

**Spec:** `docs/superpowers/specs/2026-04-10-fathom-sales-call-intelligence-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/fathom/types.ts` | TypeScript types for Fathom API responses + FathomCallMeta + SalesCallInsights |
| `src/lib/fathom/schemas.ts` | Zod schemas for API validation + extraction output |
| `src/lib/fathom/client.ts` | Fathom API client — auth, list meetings, resolve share URL, fetch transcript |
| `src/lib/fathom/transcript-formatter.ts` | Raw transcript JSON → speaker-labeled markdown |
| `src/lib/fathom/context-block.ts` | SalesCallInsights → runner context block string |
| `src/app/api/fathom/fetch/route.ts` | POST endpoint — fetch Fathom call, store, dispatch extraction |
| `research-worker/src/runners/fathom-extract.ts` | Worker runner — Claude extraction of structured insights |
| `src/components/journey/sales-call-panel.tsx` | Main panel with input + call cards |
| `src/components/journey/sales-call-card.tsx` | Individual call card with insight grid |
| `src/components/journey/sales-call-input.tsx` | Link input with validation |
| `src/components/journey/sales-call-insight-grid.tsx` | 2x2 categorized insights view |
| `supabase/migrations/20260410_add_fathom_calls.sql` | Migration: fathom_calls column + merge function |
| `src/lib/fathom/__tests__/client.test.ts` | Client unit tests |
| `src/lib/fathom/__tests__/transcript-formatter.test.ts` | Formatter tests |
| `src/lib/fathom/__tests__/context-block.test.ts` | Context block tests |
| `src/lib/fathom/__tests__/schemas.test.ts` | Schema validation tests |

### Modified Files

| File | Change |
|------|--------|
| `research-worker/src/index.ts` | Register `extractFathomCall` tool in ToolName + TOOL_RUNNERS |
| `research-worker/src/runners/index.ts` | Export new runner |
| `research-worker/src/section-map.ts` | Add fathom extraction mapping |
| `src/app/api/journey/dispatch/route.ts` | Inject Sales Call Intelligence block into enrichedContext |
| `src/app/journey/page.tsx` | Add sales call panel to review phase |
| `.env.example` | Add FATHOM_API_KEY |

---

## Task 1: Types & Schemas

**Files:**
- Create: `src/lib/fathom/types.ts`
- Create: `src/lib/fathom/schemas.ts`
- Test: `src/lib/fathom/__tests__/schemas.test.ts`

- [ ] **Step 1: Create Fathom types**

```typescript
// src/lib/fathom/types.ts

/** Fathom API meeting object (from GET /meetings) */
export interface FathomMeeting {
  title: string;
  meeting_title: string | null;
  recording_id: number;
  url: string;
  share_url: string;
  created_at: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  recording_start_time: string;
  recording_end_time: string;
  calendar_invitees_domains_type: 'only_internal' | 'one_or_more_external';
  transcript_language: string;
  recorded_by: {
    name: string;
    email: string;
    email_domain: string;
    team: string | null;
  };
  calendar_invitees: FathomInvitee[];
  transcript: FathomTranscriptSegment[] | null;
  default_summary: { template_name: string | null; markdown_formatted: string | null } | null;
  action_items: FathomActionItem[] | null;
}

export interface FathomInvitee {
  name: string | null;
  email: string | null;
  email_domain: string | null;
  is_external: boolean;
  matched_speaker_display_name: string | null;
}

export interface FathomActionItem {
  description: string;
  user_generated: boolean;
  completed: boolean;
  recording_timestamp: string;
  recording_playback_url: string;
  assignee: { name: string; email: string; team: string | null } | null;
}

export interface FathomTranscriptSegment {
  speaker: {
    display_name: string;
    matched_calendar_invitee_email: string | null;
  };
  text: string;
  timestamp: string; // HH:MM:SS
}

export interface FathomTranscriptResponse {
  transcript: FathomTranscriptSegment[];
}

export interface FathomMeetingsResponse {
  limit: number;
  next_cursor: string | null;
  items: FathomMeeting[];
}

/** Stored per-call metadata in journey_sessions.fathom_calls */
export interface FathomCallMeta {
  recordingId: number;
  shareUrl: string;
  title: string;
  date: string;
  durationSeconds: number;
  attendees: Array<{
    name: string | null;
    email: string | null;
    isExternal: boolean;
  }>;
  summary: string | null;
  actionItems: Array<{
    description: string;
    assignee?: string;
    completed: boolean;
  }>;
  documentId: string;
  status: 'fetching' | 'extracting' | 'ready' | 'error';
  error?: string;
}

/** Structured insights extracted by the worker */
export interface SalesCallInsights {
  businessHealthSummary: string;
  callType: 'discovery' | 'demo' | 'follow_up' | 'closing' | 'other';

  painPoints: Array<{
    pain: string;
    severity: 'critical' | 'moderate' | 'minor';
    quote?: string;
  }>;

  budgetSignals: {
    mentionedSpend?: string;
    willingnessToPay?: string;
    priceSensitivity: 'low' | 'medium' | 'high';
    quotes: string[];
  };

  competitorMentions: Array<{
    name: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    context: string;
    quote?: string;
  }>;

  buyingTriggers: Array<{
    trigger: string;
    urgency: 'immediate' | 'near_term' | 'exploratory';
    quote?: string;
  }>;

  objections: Array<{
    objection: string;
    resolution?: string;
    quote?: string;
  }>;

  icpSignals: {
    companySize?: string;
    role?: string;
    industry?: string;
    decisionProcess?: string;
    decisionTimeline?: string;
  };

  currentMarketing: {
    channels: string[];
    whatWorks?: string;
    whatFails?: string;
    monthlySpend?: string;
    quotes: string[];
  };

  goalsAndOutcomes: {
    primaryGoal?: string;
    successMetrics?: string;
    desiredTransformation?: string;
    quotes: string[];
  };

  notableQuotes: Array<{
    quote: string;
    context: string;
    relevance: string;
  }>;
}
```

- [ ] **Step 2: Create Zod schemas**

```typescript
// src/lib/fathom/schemas.ts

import { z } from 'zod';

/** Validates a Fathom share URL */
export const fathomShareUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.hostname === 'fathom.video' && parsed.pathname.startsWith('/share/');
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid Fathom share link (https://fathom.video/share/...)' },
  );

/** Request body for POST /api/fathom/fetch */
export const fathomFetchRequestSchema = z.object({
  shareUrl: fathomShareUrlSchema,
  runId: z.string().min(1),
});

/** Zod schema for SalesCallInsights — used by generateObject in the worker.
 *  NOTE: No .min()/.max() on numbers — Anthropic API rejects them.
 *  Use .describe() for range hints instead. */
export const salesCallInsightsSchema = z.object({
  businessHealthSummary: z.string().describe('General summary of how the business is doing based on the call'),
  callType: z.enum(['discovery', 'demo', 'follow_up', 'closing', 'other']),

  painPoints: z.array(z.object({
    pain: z.string(),
    severity: z.enum(['critical', 'moderate', 'minor']),
    quote: z.string().optional(),
  })),

  budgetSignals: z.object({
    mentionedSpend: z.string().optional(),
    willingnessToPay: z.string().optional(),
    priceSensitivity: z.enum(['low', 'medium', 'high']),
    quotes: z.array(z.string()),
  }),

  competitorMentions: z.array(z.object({
    name: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    context: z.string(),
    quote: z.string().optional(),
  })),

  buyingTriggers: z.array(z.object({
    trigger: z.string(),
    urgency: z.enum(['immediate', 'near_term', 'exploratory']),
    quote: z.string().optional(),
  })),

  objections: z.array(z.object({
    objection: z.string(),
    resolution: z.string().optional(),
    quote: z.string().optional(),
  })),

  icpSignals: z.object({
    companySize: z.string().optional(),
    role: z.string().optional(),
    industry: z.string().optional(),
    decisionProcess: z.string().optional(),
    decisionTimeline: z.string().optional(),
  }),

  currentMarketing: z.object({
    channels: z.array(z.string()),
    whatWorks: z.string().optional(),
    whatFails: z.string().optional(),
    monthlySpend: z.string().optional(),
    quotes: z.array(z.string()),
  }),

  goalsAndOutcomes: z.object({
    primaryGoal: z.string().optional(),
    successMetrics: z.string().optional(),
    desiredTransformation: z.string().optional(),
    quotes: z.array(z.string()),
  }),

  notableQuotes: z.array(z.object({
    quote: z.string(),
    context: z.string(),
    relevance: z.string(),
  })),
});
```

- [ ] **Step 3: Write schema validation tests**

```typescript
// src/lib/fathom/__tests__/schemas.test.ts

import { describe, it, expect } from 'vitest';
import { fathomShareUrlSchema, fathomFetchRequestSchema, salesCallInsightsSchema } from '../schemas';

describe('fathomShareUrlSchema', () => {
  it('accepts valid Fathom share URLs', () => {
    expect(fathomShareUrlSchema.safeParse('https://fathom.video/share/abc123').success).toBe(true);
    expect(fathomShareUrlSchema.safeParse('https://fathom.video/share/xyz-456-def').success).toBe(true);
  });

  it('rejects non-Fathom URLs', () => {
    expect(fathomShareUrlSchema.safeParse('https://zoom.us/share/abc').success).toBe(false);
    expect(fathomShareUrlSchema.safeParse('https://fathom.video/meetings/abc').success).toBe(false);
    expect(fathomShareUrlSchema.safeParse('not-a-url').success).toBe(false);
    expect(fathomShareUrlSchema.safeParse('').success).toBe(false);
  });
});

describe('fathomFetchRequestSchema', () => {
  it('accepts valid request', () => {
    const result = fathomFetchRequestSchema.safeParse({
      shareUrl: 'https://fathom.video/share/abc123',
      runId: 'run-001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing runId', () => {
    const result = fathomFetchRequestSchema.safeParse({
      shareUrl: 'https://fathom.video/share/abc123',
    });
    expect(result.success).toBe(false);
  });
});

describe('salesCallInsightsSchema', () => {
  it('accepts a minimal valid extraction', () => {
    const result = salesCallInsightsSchema.safeParse({
      businessHealthSummary: 'Company growing steadily',
      callType: 'discovery',
      painPoints: [],
      budgetSignals: { priceSensitivity: 'medium', quotes: [] },
      competitorMentions: [],
      buyingTriggers: [],
      objections: [],
      icpSignals: {},
      currentMarketing: { channels: [], quotes: [] },
      goalsAndOutcomes: { quotes: [] },
      notableQuotes: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated extraction', () => {
    const result = salesCallInsightsSchema.safeParse({
      businessHealthSummary: 'Series A SaaS growing 30% YoY',
      callType: 'discovery',
      painPoints: [
        { pain: 'Cannot track ROAS', severity: 'critical', quote: 'We have no idea what works' },
      ],
      budgetSignals: {
        mentionedSpend: '$15K/mo on Google',
        willingnessToPay: 'Flexible if ROI clear',
        priceSensitivity: 'low',
        quotes: ['Budget is flexible if ROI is there'],
      },
      competitorMentions: [
        { name: 'HubSpot Ads', sentiment: 'negative', context: 'Too expensive', quote: 'HubSpot was way too pricey' },
      ],
      buyingTriggers: [
        { trigger: 'Q2 board pressure', urgency: 'immediate', quote: 'Need results by June' },
      ],
      objections: [
        { objection: 'Burned by last agency', resolution: 'Data transparency promise' },
      ],
      icpSignals: {
        companySize: '50-200 employees',
        role: 'VP Marketing',
        industry: 'B2B SaaS',
        decisionProcess: 'Need CEO sign-off',
        decisionTimeline: '2 weeks',
      },
      currentMarketing: {
        channels: ['Google Ads', 'LinkedIn'],
        whatWorks: 'Google branded',
        whatFails: 'LinkedIn lead gen',
        monthlySpend: '$15K',
        quotes: ['Google branded is our only profitable channel'],
      },
      goalsAndOutcomes: {
        primaryGoal: '50 demos per month',
        successMetrics: 'Demo volume and SQL quality',
        desiredTransformation: 'Predictable pipeline',
        quotes: ['We need 50 demos a month minimum'],
      },
      notableQuotes: [
        { quote: 'Our CEO will cancel everything if Q2 numbers miss', context: 'Discussing urgency', relevance: 'High urgency signal for campaign timeline' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid callType', () => {
    const result = salesCallInsightsSchema.safeParse({
      businessHealthSummary: 'ok',
      callType: 'unknown_type',
      painPoints: [],
      budgetSignals: { priceSensitivity: 'medium', quotes: [] },
      competitorMentions: [],
      buyingTriggers: [],
      objections: [],
      icpSignals: {},
      currentMarketing: { channels: [], quotes: [] },
      goalsAndOutcomes: { quotes: [] },
      notableQuotes: [],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run -- src/lib/fathom/__tests__/schemas.test.ts`
Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/fathom/types.ts src/lib/fathom/schemas.ts src/lib/fathom/__tests__/schemas.test.ts
git commit -m "feat(fathom): add types and Zod schemas for Fathom API integration"
```

---

## Task 2: Fathom API Client

**Files:**
- Create: `src/lib/fathom/client.ts`
- Test: `src/lib/fathom/__tests__/client.test.ts`

- [ ] **Step 1: Write failing tests for the client**

```typescript
// src/lib/fathom/__tests__/client.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveShareUrl, fetchTranscript, createFathomClient } from '../client';
import type { FathomMeetingsResponse, FathomTranscriptResponse } from '../types';

const MOCK_MEETINGS_RESPONSE: FathomMeetingsResponse = {
  limit: 50,
  next_cursor: null,
  items: [
    {
      title: 'Discovery Call — Acme Corp',
      meeting_title: null,
      recording_id: 12345,
      url: 'https://fathom.video/recording/12345',
      share_url: 'https://fathom.video/share/abc123',
      created_at: '2026-04-03T14:00:00Z',
      scheduled_start_time: '2026-04-03T14:00:00Z',
      scheduled_end_time: '2026-04-03T14:42:00Z',
      recording_start_time: '2026-04-03T14:00:30Z',
      recording_end_time: '2026-04-03T14:41:45Z',
      calendar_invitees_domains_type: 'one_or_more_external',
      transcript_language: 'en',
      recorded_by: { name: 'Bob', email: 'bob@agency.com', email_domain: 'agency.com', team: null },
      calendar_invitees: [
        { name: 'Alice', email: 'alice@acme.com', email_domain: 'acme.com', is_external: true, matched_speaker_display_name: 'Alice' },
      ],
      transcript: null,
      default_summary: { template_name: null, markdown_formatted: 'Discussion about paid media strategy...' },
      action_items: [
        { description: 'Send proposal', user_generated: false, completed: false, recording_timestamp: '00:35:00', recording_playback_url: '', assignee: { name: 'Bob', email: 'bob@agency.com', team: null } },
      ],
    },
  ],
};

const MOCK_TRANSCRIPT: FathomTranscriptResponse = {
  transcript: [
    { speaker: { display_name: 'Alice', matched_calendar_invitee_email: 'alice@acme.com' }, text: 'We spend about 15K a month on Google.', timestamp: '00:05:32' },
    { speaker: { display_name: 'Bob', matched_calendar_invitee_email: null }, text: 'What is your biggest challenge?', timestamp: '00:05:38' },
    { speaker: { display_name: 'Alice', matched_calendar_invitee_email: 'alice@acme.com' }, text: 'We cannot track ROAS across channels.', timestamp: '00:05:45' },
  ],
};

describe('resolveShareUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a share URL to a meeting object', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_MEETINGS_RESPONSE),
    });

    const client = createFathomClient('test-api-key', mockFetch);
    const meeting = await client.resolveShareUrl('https://fathom.video/share/abc123');

    expect(meeting.recording_id).toBe(12345);
    expect(meeting.title).toBe('Discovery Call — Acme Corp');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/meetings'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Key': 'test-api-key' }),
      }),
    );
  });

  it('throws when meeting not found', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ limit: 50, next_cursor: null, items: [] }),
    });

    const client = createFathomClient('test-api-key', mockFetch);
    await expect(client.resolveShareUrl('https://fathom.video/share/nonexistent'))
      .rejects.toThrow('Meeting not found');
  });

  it('paginates through results', async () => {
    const page1: FathomMeetingsResponse = {
      limit: 50, next_cursor: 'cursor-2',
      items: [{ ...MOCK_MEETINGS_RESPONSE.items[0], share_url: 'https://fathom.video/share/other' }],
    };
    const page2: FathomMeetingsResponse = {
      limit: 50, next_cursor: null,
      items: [MOCK_MEETINGS_RESPONSE.items[0]],
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page1) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page2) });

    const client = createFathomClient('test-api-key', mockFetch);
    const meeting = await client.resolveShareUrl('https://fathom.video/share/abc123');

    expect(meeting.recording_id).toBe(12345);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('fetchTranscript', () => {
  it('fetches transcript by recording ID', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_TRANSCRIPT),
    });

    const client = createFathomClient('test-api-key', mockFetch);
    const result = await client.fetchTranscript(12345);

    expect(result.transcript).toHaveLength(3);
    expect(result.transcript[0].speaker.display_name).toBe('Alice');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/recordings/12345/transcript'),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/fathom/__tests__/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the Fathom client**

```typescript
// src/lib/fathom/client.ts

import type { FathomMeeting, FathomMeetingsResponse, FathomTranscriptResponse } from './types';

const FATHOM_API_BASE = 'https://api.fathom.ai/external/v1';

export class FathomResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FathomResolutionError';
  }
}

export interface FathomClient {
  resolveShareUrl(shareUrl: string): Promise<FathomMeeting>;
  fetchTranscript(recordingId: number): Promise<FathomTranscriptResponse>;
}

export function createFathomClient(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): FathomClient {
  const headers = {
    'X-Api-Key': apiKey,
    'Content-Type': 'application/json',
  };

  async function resolveShareUrl(shareUrl: string): Promise<FathomMeeting> {
    // Extract the share ID to match against share_url
    const shareId = new URL(shareUrl).pathname.split('/').pop();
    if (!shareId) throw new FathomResolutionError('Invalid share URL format');

    // Search recent meetings first (90 days), avoids paginating through entire history
    const createdAfter = new Date(Date.now() - 90 * 86400_000).toISOString();
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = 20; // Safety limit

    do {
      const params = new URLSearchParams({ limit: '50', created_after: createdAfter });
      if (cursor) params.set('cursor', cursor);

      const res = await fetchFn(`${FATHOM_API_BASE}/meetings?${params}`, { headers });
      if (!res.ok) {
        if (res.status === 401) throw new FathomResolutionError('Fathom API key is invalid or expired');
        if (res.status === 429) throw new FathomResolutionError('Fathom rate limit exceeded — try again in a minute');
        throw new FathomResolutionError(`Fathom API error: ${res.status}`);
      }

      const data: FathomMeetingsResponse = await res.json();
      const match = data.items.find(
        (m) => m.share_url === shareUrl || m.share_url.includes(shareId),
      );
      if (match) return match;

      cursor = data.next_cursor;
      pageCount++;
    } while (cursor && pageCount < maxPages);

    throw new FathomResolutionError(
      'Meeting not found — make sure the link is shared and your Fathom account has access to it',
    );
  }

  async function fetchTranscript(recordingId: number): Promise<FathomTranscriptResponse> {
    const res = await fetchFn(`${FATHOM_API_BASE}/recordings/${recordingId}/transcript`, { headers });
    if (!res.ok) {
      if (res.status === 404) throw new FathomResolutionError('Transcript not found — the call may still be processing');
      throw new FathomResolutionError(`Failed to fetch transcript: ${res.status}`);
    }
    return res.json();
  }

  return { resolveShareUrl, fetchTranscript };
}

/** Convenience: create client from environment variable */
export function getFathomClient(): FathomClient {
  const apiKey = process.env.FATHOM_API_KEY;
  if (!apiKey) throw new Error('FATHOM_API_KEY is not set');
  return createFathomClient(apiKey);
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run -- src/lib/fathom/__tests__/client.test.ts`
Expected: All 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/fathom/client.ts src/lib/fathom/__tests__/client.test.ts
git commit -m "feat(fathom): API client with share URL resolution and transcript fetch"
```

---

## Task 3: Transcript Formatter

**Files:**
- Create: `src/lib/fathom/transcript-formatter.ts`
- Test: `src/lib/fathom/__tests__/transcript-formatter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/fathom/__tests__/transcript-formatter.test.ts

import { describe, it, expect } from 'vitest';
import { formatTranscriptAsMarkdown, estimateTokenCount } from '../transcript-formatter';
import type { FathomTranscriptSegment } from '../types';

const SEGMENTS: FathomTranscriptSegment[] = [
  { speaker: { display_name: 'Alice', matched_calendar_invitee_email: 'alice@acme.com' }, text: 'We spend about 15K a month.', timestamp: '00:05:32' },
  { speaker: { display_name: 'Bob', matched_calendar_invitee_email: null }, text: 'What is your biggest challenge?', timestamp: '00:05:38' },
  { speaker: { display_name: 'Alice', matched_calendar_invitee_email: 'alice@acme.com' }, text: 'Tracking ROAS across channels.', timestamp: '00:05:45' },
];

describe('formatTranscriptAsMarkdown', () => {
  it('formats segments as speaker-labeled markdown', () => {
    const result = formatTranscriptAsMarkdown(SEGMENTS);
    expect(result).toContain('**Alice** (00:05:32): We spend about 15K a month.');
    expect(result).toContain('**Bob** (00:05:38): What is your biggest challenge?');
    expect(result).toContain('**Alice** (00:05:45): Tracking ROAS across channels.');
  });

  it('handles empty transcript', () => {
    expect(formatTranscriptAsMarkdown([])).toBe('');
  });
});

describe('estimateTokenCount', () => {
  it('estimates ~4 chars per token', () => {
    const text = 'a'.repeat(400);
    expect(estimateTokenCount(text)).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/fathom/__tests__/transcript-formatter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// src/lib/fathom/transcript-formatter.ts

import type { FathomTranscriptSegment } from './types';

/** Convert Fathom transcript segments to speaker-labeled markdown. */
export function formatTranscriptAsMarkdown(segments: FathomTranscriptSegment[]): string {
  if (segments.length === 0) return '';
  return segments
    .map((s) => `**${s.speaker.display_name}** (${s.timestamp}): ${s.text}`)
    .join('\n\n');
}

/** Rough token estimate (~4 chars per token). */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run -- src/lib/fathom/__tests__/transcript-formatter.test.ts`
Expected: All 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/fathom/transcript-formatter.ts src/lib/fathom/__tests__/transcript-formatter.test.ts
git commit -m "feat(fathom): transcript-to-markdown formatter"
```

---

## Task 4: Context Block Builder

**Files:**
- Create: `src/lib/fathom/context-block.ts`
- Test: `src/lib/fathom/__tests__/context-block.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/fathom/__tests__/context-block.test.ts

import { describe, it, expect } from 'vitest';
import { buildSalesCallIntelligenceBlock } from '../context-block';
import type { SalesCallInsights, FathomCallMeta } from '../types';

const MOCK_META: FathomCallMeta = {
  recordingId: 12345,
  shareUrl: 'https://fathom.video/share/abc123',
  title: 'Discovery Call — Acme Corp',
  date: '2026-04-03T14:00:00Z',
  durationSeconds: 2520,
  attendees: [{ name: 'Alice', email: 'alice@acme.com', isExternal: true }],
  summary: null,
  actionItems: [],
  documentId: 'doc-1',
  status: 'ready',
};

const MOCK_INSIGHTS: SalesCallInsights = {
  businessHealthSummary: 'Growing 30% YoY but CAC doubled',
  callType: 'discovery',
  painPoints: [{ pain: 'Cannot track ROAS', severity: 'critical', quote: 'We have no idea what works' }],
  budgetSignals: { mentionedSpend: '$15K/mo', priceSensitivity: 'low', quotes: [] },
  competitorMentions: [{ name: 'HubSpot', sentiment: 'negative', context: 'Too expensive' }],
  buyingTriggers: [{ trigger: 'Q2 board pressure', urgency: 'immediate' }],
  objections: [],
  icpSignals: { role: 'VP Marketing', industry: 'B2B SaaS' },
  currentMarketing: { channels: ['Google Ads', 'LinkedIn'], monthlySpend: '$15K', quotes: [] },
  goalsAndOutcomes: { primaryGoal: '50 demos/month', quotes: [] },
  notableQuotes: [],
};

describe('buildSalesCallIntelligenceBlock', () => {
  it('renders a structured context block', () => {
    const block = buildSalesCallIntelligenceBlock(MOCK_META, MOCK_INSIGHTS);
    expect(block).toContain('SALES CALL INTELLIGENCE');
    expect(block).toContain('Discovery Call — Acme Corp');
    expect(block).toContain('Cannot track ROAS');
    expect(block).toContain('$15K/mo');
    expect(block).toContain('HubSpot');
    expect(block).toContain('Q2 board pressure');
    expect(block).toContain('Google Ads');
    expect(block).toContain('50 demos/month');
    expect(block).toContain('Growing 30% YoY');
    expect(block).toContain('END SALES CALL INTELLIGENCE');
  });

  it('handles empty categories gracefully', () => {
    const emptyInsights: SalesCallInsights = {
      businessHealthSummary: 'No details shared',
      callType: 'other',
      painPoints: [],
      budgetSignals: { priceSensitivity: 'medium', quotes: [] },
      competitorMentions: [],
      buyingTriggers: [],
      objections: [],
      icpSignals: {},
      currentMarketing: { channels: [], quotes: [] },
      goalsAndOutcomes: { quotes: [] },
      notableQuotes: [],
    };
    const block = buildSalesCallIntelligenceBlock(MOCK_META, emptyInsights);
    expect(block).toContain('SALES CALL INTELLIGENCE');
    expect(block).toContain('No details shared');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/fathom/__tests__/context-block.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// src/lib/fathom/context-block.ts

import type { FathomCallMeta, SalesCallInsights } from './types';

/** Format duration in seconds to "Xmin" string */
function formatDuration(seconds: number): string {
  return `${Math.round(seconds / 60)}min`;
}

/** Build a runner-injectable context block from structured insights. */
export function buildSalesCallIntelligenceBlock(
  meta: FathomCallMeta,
  insights: SalesCallInsights,
): string {
  const lines: string[] = [];

  lines.push('══ SALES CALL INTELLIGENCE ══');
  lines.push(`Source: ${meta.title} (${new Date(meta.date).toLocaleDateString('en-US')}, ${formatDuration(meta.durationSeconds)})`);

  const attendeeNames = meta.attendees.map((a) => a.name ?? a.email ?? 'Unknown').join(', ');
  if (attendeeNames) lines.push(`Attendees: ${attendeeNames}`);

  lines.push('');
  lines.push(`Business Health: ${insights.businessHealthSummary}`);

  if (insights.painPoints.length > 0) {
    lines.push('');
    lines.push('Pain Points:');
    for (const p of insights.painPoints) {
      const quotePart = p.quote ? ` — "${p.quote}"` : '';
      lines.push(`- ${p.pain} (severity: ${p.severity})${quotePart}`);
    }
  }

  if (insights.budgetSignals.mentionedSpend || insights.budgetSignals.willingnessToPay) {
    lines.push('');
    const parts = [
      insights.budgetSignals.mentionedSpend,
      `sensitivity: ${insights.budgetSignals.priceSensitivity}`,
    ].filter(Boolean);
    lines.push(`Budget: ${parts.join(', ')}`);
    if (insights.budgetSignals.willingnessToPay) {
      lines.push(`  Willingness: ${insights.budgetSignals.willingnessToPay}`);
    }
  }

  if (insights.competitorMentions.length > 0) {
    lines.push('');
    lines.push('Competitors Mentioned:');
    for (const c of insights.competitorMentions) {
      lines.push(`- ${c.name} (${c.sentiment}): ${c.context}`);
    }
  }

  if (insights.buyingTriggers.length > 0) {
    lines.push('');
    lines.push('Buying Triggers:');
    for (const t of insights.buyingTriggers) {
      const quotePart = t.quote ? ` — "${t.quote}"` : '';
      lines.push(`- ${t.trigger} (urgency: ${t.urgency})${quotePart}`);
    }
  }

  if (insights.objections.length > 0) {
    lines.push('');
    lines.push('Objections:');
    for (const o of insights.objections) {
      const resPart = o.resolution ? ` → Resolution: ${o.resolution}` : '';
      lines.push(`- ${o.objection}${resPart}`);
    }
  }

  if (insights.currentMarketing.channels.length > 0) {
    lines.push('');
    const spend = insights.currentMarketing.monthlySpend ? `, spending ${insights.currentMarketing.monthlySpend}` : '';
    lines.push(`Current Marketing: ${insights.currentMarketing.channels.join(', ')}${spend}`);
    if (insights.currentMarketing.whatWorks) lines.push(`  Working: ${insights.currentMarketing.whatWorks}`);
    if (insights.currentMarketing.whatFails) lines.push(`  Failing: ${insights.currentMarketing.whatFails}`);
  }

  if (insights.goalsAndOutcomes.primaryGoal) {
    lines.push('');
    const metrics = insights.goalsAndOutcomes.successMetrics ? `, success = ${insights.goalsAndOutcomes.successMetrics}` : '';
    lines.push(`Goals: ${insights.goalsAndOutcomes.primaryGoal}${metrics}`);
  }

  if (insights.notableQuotes.length > 0) {
    lines.push('');
    lines.push('Notable Quotes:');
    for (const q of insights.notableQuotes) {
      lines.push(`- "${q.quote}" — ${q.relevance}`);
    }
  }

  lines.push('══ END SALES CALL INTELLIGENCE ══');

  return lines.join('\n');
}

/** Build blocks for all ready calls in a session. */
export function buildAllSalesCallBlocks(
  calls: FathomCallMeta[],
  extractedFieldsMap: Record<string, SalesCallInsights>,
): string {
  const readyCalls = calls.filter((c) => c.status === 'ready' && extractedFieldsMap[c.documentId]);
  if (readyCalls.length === 0) return '';

  const blocks = readyCalls
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((call) => buildSalesCallIntelligenceBlock(call, extractedFieldsMap[call.documentId]));

  return blocks.join('\n\n');
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run -- src/lib/fathom/__tests__/context-block.test.ts`
Expected: All 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/fathom/context-block.ts src/lib/fathom/__tests__/context-block.test.ts
git commit -m "feat(fathom): context block builder for runner injection"
```

---

## Task 5: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260410_add_fathom_calls.sql`
- Modify: `.env.example`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260410_add_fathom_calls.sql
-- Adds fathom_calls JSONB column to journey_sessions for tracking linked Fathom calls.

ALTER TABLE journey_sessions
ADD COLUMN IF NOT EXISTS fathom_calls JSONB DEFAULT '[]'::jsonb;

-- Atomic merge function: upsert a single call entry by recording_id.
-- If a call with this recording_id exists, replace it; otherwise append.
CREATE OR REPLACE FUNCTION merge_journey_session_fathom_call(
  p_user_id TEXT,
  p_run_id TEXT,
  p_recording_id INTEGER,
  p_call_data JSONB
) RETURNS VOID AS $$
DECLARE
  v_existing JSONB;
  v_idx INTEGER;
BEGIN
  SELECT fathom_calls INTO v_existing
  FROM journey_sessions
  WHERE user_id = p_user_id
  AND (metadata->>'activeJourneyRunId') = p_run_id;

  IF v_existing IS NULL THEN
    -- No session found or null column
    UPDATE journey_sessions
    SET fathom_calls = jsonb_build_array(p_call_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
    RETURN;
  END IF;

  -- Find index of existing call with this recording_id
  SELECT (ordinality - 1) INTO v_idx
  FROM jsonb_array_elements(v_existing) WITH ORDINALITY AS t(elem, ordinality)
  WHERE (elem->>'recordingId')::integer = p_recording_id
  LIMIT 1;

  IF v_idx IS NOT NULL THEN
    -- Update existing
    UPDATE journey_sessions
    SET fathom_calls = jsonb_set(fathom_calls, ARRAY[v_idx::text], p_call_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
  ELSE
    -- Append new
    UPDATE journey_sessions
    SET fathom_calls = fathom_calls || jsonb_build_array(p_call_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Add FATHOM_API_KEY to .env.example**

Add this line to the Optional section of `.env.example`:

```
FATHOM_API_KEY=           # Fathom AI API key for sales call transcript enrichment
```

- [ ] **Step 3: Apply migration locally**

Run: `npx supabase db push` (or apply via Supabase dashboard)
Expected: Migration applied, `fathom_calls` column exists

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260410_add_fathom_calls.sql .env.example
git commit -m "feat(fathom): Supabase migration — fathom_calls column + merge function"
```

---

## Task 6: Fetch API Route

**Files:**
- Create: `src/app/api/fathom/fetch/route.ts`

- [ ] **Step 1: Implement the fetch route**

```typescript
// src/app/api/fathom/fetch/route.ts

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { fathomFetchRequestSchema } from '@/lib/fathom/schemas';
import { getFathomClient, FathomResolutionError } from '@/lib/fathom/client';
import { formatTranscriptAsMarkdown, estimateTokenCount } from '@/lib/fathom/transcript-formatter';
import { createAdminClient } from '@/lib/supabase/server';
import type { FathomCallMeta } from '@/lib/fathom/types';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = fathomFetchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const { shareUrl, runId } = parsed.data;

  try {
    const fathom = getFathomClient();

    // Step 1: Resolve share URL → meeting metadata
    const meeting = await fathom.resolveShareUrl(shareUrl);

    // Step 2: Check for duplicate
    const supabase = createAdminClient();
    const { data: session } = await supabase
      .from('journey_sessions')
      .select('fathom_calls')
      .eq('user_id', userId)
      .eq('run_id', runId)
      .maybeSingle();

    const existingCalls = (session?.fathom_calls ?? []) as FathomCallMeta[];
    if (existingCalls.some((c) => c.recordingId === meeting.recording_id)) {
      return NextResponse.json(
        { error: 'This call is already linked to this session' },
        { status: 409 },
      );
    }

    // Step 3: Fetch transcript
    const transcriptData = await fathom.fetchTranscript(meeting.recording_id);
    const markdown = formatTranscriptAsMarkdown(transcriptData.transcript);

    // Step 4: Compute metadata
    const durationSeconds = meeting.scheduled_end_time && meeting.scheduled_start_time
      ? Math.round((new Date(meeting.scheduled_end_time).getTime() - new Date(meeting.scheduled_start_time).getTime()) / 1000)
      : 0;

    const attendees = (meeting.calendar_invitees ?? []).map((inv) => ({
      name: inv.name,
      email: inv.email,
      isExternal: inv.is_external,
    }));

    const actionItems = (meeting.action_items ?? []).map((ai) => ({
      description: ai.description,
      assignee: ai.assignee?.name,
      completed: ai.completed,
    }));

    // Step 5: Get or create business_profile for FK
    const { data: profile } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    // Step 6: Store transcript as business_profile_document
    const { data: doc, error: docError } = await supabase
      .from('business_profile_documents')
      .insert({
        user_id: userId,
        business_profile_id: profile?.id ?? null,
        file_name: `Fathom: ${meeting.title} — ${new Date(meeting.scheduled_start_time).toLocaleDateString('en-US')}`,
        mime_type: 'application/json',
        file_size_bytes: new TextEncoder().encode(markdown).length,
        parsed_markdown: markdown,
        extracted_fields: {}, // Worker will populate
        section_tags: ['industryMarket', 'icpValidation', 'competitors', 'offerAnalysis', 'crossAnalysis'],
        doc_kind: 'sales_call_transcript',
        token_count: estimateTokenCount(markdown),
      })
      .select('id')
      .single();

    if (docError || !doc) {
      console.error('[fathom/fetch] Failed to store document:', docError);
      return NextResponse.json({ error: 'Failed to store transcript' }, { status: 500 });
    }

    // Step 7: Build call metadata and store in journey_sessions
    const callMeta: FathomCallMeta = {
      recordingId: meeting.recording_id,
      shareUrl,
      title: meeting.title,
      date: meeting.scheduled_start_time,
      durationSeconds,
      attendees,
      summary: meeting.default_summary?.markdown_formatted ?? null,
      actionItems,
      documentId: doc.id,
      status: 'extracting',
    };

    await supabase.rpc('merge_journey_session_fathom_call', {
      p_user_id: userId,
      p_run_id: runId,
      p_recording_id: meeting.recording_id,
      p_call_data: callMeta,
    });

    // Step 8: Dispatch extraction to worker (fire-and-forget)
    // NOTE: We POST directly to the worker instead of using dispatchResearchForUser
    // because we need to pass documentId for the runner to write extracted_fields
    // back to business_profile_documents.
    const workerUrl = process.env.RAILWAY_WORKER_URL;
    const workerKey = process.env.RAILWAY_API_KEY;
    if (workerUrl) {
      void fetch(`${workerUrl}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(workerKey ? { Authorization: `Bearer ${workerKey}` } : {}),
        },
        body: JSON.stringify({
          tool: 'extractFathomCall',
          context: markdown,
          userId,
          jobId: crypto.randomUUID(),
          runId,
          documentId: doc.id,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.error('[fathom/fetch] Dispatch extraction failed:', err);
      });
    }

    return NextResponse.json({
      documentId: doc.id,
      recordingId: meeting.recording_id,
      title: meeting.title,
      date: meeting.scheduled_start_time,
      durationSeconds,
      attendees,
      summary: meeting.default_summary?.markdown_formatted ?? null,
      actionItems,
      status: 'extracting',
    });
  } catch (err) {
    if (err instanceof FathomResolutionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[fathom/fetch] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes (route may show type warnings until worker is updated — that's OK)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fathom/fetch/route.ts
git commit -m "feat(fathom): POST /api/fathom/fetch route — resolve, fetch, store, dispatch"
```

---

## Task 7: Worker Extraction Runner

**Files:**
- Create: `research-worker/src/runners/fathom-extract.ts`
- Modify: `research-worker/src/runners/index.ts`
- Modify: `research-worker/src/index.ts`
- Modify: `research-worker/src/section-map.ts`

**IMPORTANT:** Unlike other runners, the Fathom extraction runner writes its result directly to `business_profile_documents.extracted_fields` (not just `research_results`). The fetch route passes `documentId` in the request body so the worker knows which document to update. The standard `research_results` write still happens (harmless) but the real target is the document row.

- [ ] **Step 1: Create the extraction runner**

```typescript
// research-worker/src/runners/fathom-extract.ts

import { createClient, type RunnerProgressReporter } from '../runner';
import { finalizeRunnerResult } from '../contracts';
import type { ResearchResult } from '../supabase';

const EXTRACTION_MODEL = process.env.FATHOM_EXTRACT_MODEL ?? 'claude-haiku-4-5-20251001';
const EXTRACTION_MAX_TOKENS = 4000;
const EXTRACTION_TIMEOUT_MS = 60_000;

const EXTRACTION_SYSTEM_PROMPT = `You are a sales intelligence analyst extracting actionable insights from a sales call transcript for a paid media strategy team.

RULES:
- Only extract what is EXPLICITLY stated in the transcript. Never infer or fabricate.
- Every insight MUST include the source quote from the transcript when available.
- If a category has no relevant data in the call, return an empty array — do NOT fill with guesses.
- Speaker attribution matters: note WHO said what (prospect vs salesperson).
- Budget figures must be exact quotes, not rounded or estimated.
- Competitor mentions must use the exact name the prospect used.

CONTEXT: This data feeds into an AI research pipeline that produces paid media strategies. The sales call insights are treated as GROUND TRUTH — higher priority than web-scraped data. Accuracy is critical because fabricated insights will contaminate downstream recommendations.

Extract the following categories from the transcript and return them as a JSON object:

1. businessHealthSummary (string): General summary of how the business is going based on the conversation
2. callType (enum: discovery | demo | follow_up | closing | other)
3. painPoints (array): Each has pain, severity (critical|moderate|minor), and optional quote
4. budgetSignals (object): mentionedSpend, willingnessToPay, priceSensitivity (low|medium|high), quotes array
5. competitorMentions (array): Each has name, sentiment (positive|negative|neutral), context, optional quote
6. buyingTriggers (array): Each has trigger, urgency (immediate|near_term|exploratory), optional quote
7. objections (array): Each has objection, optional resolution, optional quote
8. icpSignals (object): companySize, role, industry, decisionProcess, decisionTimeline — all optional strings
9. currentMarketing (object): channels array, whatWorks, whatFails, monthlySpend, quotes array
10. goalsAndOutcomes (object): primaryGoal, successMetrics, desiredTransformation, quotes array
11. notableQuotes (array): Each has quote (verbatim), context, relevance

Return ONLY valid JSON matching this schema. No markdown, no explanation, just the JSON object.`;

export async function runFathomExtraction(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startMs = Date.now();
  const client = createClient();

  if (onProgress) {
    await onProgress({ message: 'Analyzing sales call transcript', phase: 'analysis' });
  }

  try {
    const response = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: EXTRACTION_MAX_TOKENS,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract structured sales intelligence from this transcript:\n\n${context}`,
        },
      ],
    });

    if (onProgress) {
      await onProgress({ message: 'Parsing extraction results', phase: 'output' });
    }

    // Extract text content from response
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return finalizeRunnerResult({
        status: 'error',
        section: 'fathomExtraction',
        error: 'No text content in extraction response',
        durationMs: Date.now() - startMs,
      });
    }

    // Parse JSON from response
    let parsed: Record<string, unknown>;
    try {
      // Strip markdown code fences if present
      const rawText = textBlock.text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
      parsed = JSON.parse(rawText);
    } catch {
      return finalizeRunnerResult({
        status: 'error',
        section: 'fathomExtraction',
        error: 'Failed to parse extraction JSON',
        rawText: textBlock.text,
        durationMs: Date.now() - startMs,
      });
    }

    return finalizeRunnerResult({
      status: 'complete',
      section: 'fathomExtraction',
      data: parsed,
      durationMs: Date.now() - startMs,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return finalizeRunnerResult({
      status: 'error',
      section: 'fathomExtraction',
      error: errorMsg,
      durationMs: Date.now() - startMs,
    });
  }
}
```

- [ ] **Step 2: Register the runner in index exports**

In `research-worker/src/runners/index.ts`, add this line at the end:

```typescript
export { runFathomExtraction } from './fathom-extract';
```

- [ ] **Step 3: Register in worker server**

In `research-worker/src/index.ts`, make these changes:

1. Add to the import at line 1-12:
```typescript
import {
  runResearchIndustry,
  runResearchCompetitors,
  runResearchICP,
  runResearchOffer,
  runSynthesizeResearch,
  runResearchKeywords,
  runMediaPlan,
  resolveProductIdentity,
  runFathomExtraction,
} from './runners';
```

2. Add `'extractFathomCall'` to the `ToolName` union type (line 56-64):
```typescript
type ToolName =
  | 'researchIndustry'
  | 'researchCompetitors'
  | 'researchICP'
  | 'researchOffer'
  | 'synthesizeResearch'
  | 'researchKeywords'
  | 'researchMediaPlan'
  | 'resolveIdentity'
  | 'extractFathomCall';
```

3. Add `documentId` as an optional field to `RunJobRequest` (line 68-82):
```typescript
interface RunJobRequest {
  tool: ToolName;
  context: string;
  userId: string;
  jobId: string;
  runId?: string;
  baselineMetrics?: BaselineMetrics;
  /** For extractFathomCall: the business_profile_documents.id to write extracted_fields back to */
  documentId?: string;
}
```

4. Add to `TOOL_RUNNERS` (line 84-93):
```typescript
const TOOL_RUNNERS: Record<ToolName, (context: string, onProgress?: RunnerProgressReporter) => Promise<ResearchResult>> = {
  researchIndustry: runResearchIndustry,
  researchCompetitors: runResearchCompetitors,
  researchICP: runResearchICP,
  researchOffer: runResearchOffer,
  synthesizeResearch: runSynthesizeResearch,
  researchKeywords: runResearchKeywords,
  researchMediaPlan: runMediaPlan,
  resolveIdentity: resolveProductIdentity,
  extractFathomCall: runFathomExtraction,
};
```

5. In the async job handler (after `writeResearchResult` succeeds, ~line 288), add a post-write hook for Fathom extraction that writes extracted_fields back to business_profile_documents and updates the fathom_calls status:
```typescript
      // --- Fathom extraction post-write: update business_profile_documents ---
      if (tool === 'extractFathomCall' && documentId && result.status === 'complete' && result.data) {
        try {
          const { createClient: createSupabaseClient } = await import('./supabase');
          // Note: use the admin supabase client from supabase.ts
          const supabase = createSupabaseClient();
          await supabase
            .from('business_profile_documents')
            .update({ extracted_fields: result.data })
            .eq('id', documentId);

          // Update fathom_calls[].status to 'ready'
          // Use raw SQL via RPC since we need to find the call by documentId
          await supabase.rpc('merge_journey_session_fathom_call', {
            p_user_id: userId,
            p_run_id: runId ?? '',
            p_recording_id: 0, // Placeholder — the function matches on recording_id, 
            // so we need an alternative approach: update via documentId match.
            // IMPLEMENTATION NOTE: The implementer should add a simpler update query
            // that finds the call by documentId in the JSONB array and sets status='ready'.
            // A direct JSONB path update is cleaner than the merge function for this case:
            //
            // UPDATE journey_sessions
            // SET fathom_calls = (
            //   SELECT jsonb_agg(
            //     CASE WHEN elem->>'documentId' = documentId
            //          THEN jsonb_set(elem, '{status}', '"ready"')
            //          ELSE elem END
            //   ) FROM jsonb_array_elements(fathom_calls) AS elem
            // ) WHERE user_id = userId AND (metadata->>'activeJourneyRunId') = runId;
            p_call_data: {},
          });
          console.log(`[worker] Updated business_profile_documents.extracted_fields for doc ${documentId}`);
        } catch (writeBackErr) {
          console.error(`[worker] Failed to write back Fathom extraction for doc ${documentId}:`, writeBackErr);
        }
      }
```
```

- [ ] **Step 4: Add to section map**

In `research-worker/src/section-map.ts`, add to `TOOL_SECTION_MAP`:

```typescript
export const TOOL_SECTION_MAP = {
  researchIndustry: 'industryResearch',
  researchCompetitors: 'competitorIntel',
  researchICP: 'icpValidation',
  researchOffer: 'offerAnalysis',
  synthesizeResearch: 'strategicSynthesis',
  researchKeywords: 'keywordIntel',
  researchMediaPlan: 'mediaPlan',
  resolveIdentity: 'identityResolution',
  extractFathomCall: 'fathomExtraction',
} as const;
```

- [ ] **Step 5: Verify worker builds**

Run: `cd research-worker && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add research-worker/src/runners/fathom-extract.ts research-worker/src/runners/index.ts research-worker/src/index.ts research-worker/src/section-map.ts
git commit -m "feat(fathom): worker extraction runner + tool registration"
```

---

## Task 8: Dispatch Integration — Sales Call Context Injection

**Files:**
- Modify: `src/app/api/journey/dispatch/route.ts`

- [ ] **Step 1: Add sales call intelligence block injection**

After the document injection block (line ~245, before the `dispatchResearchForUser` call), add:

```typescript
  // --- Sales Call Intelligence injection ---
  // When the session has Fathom calls with extracted insights, inject a
  // structured "Sales Call Intelligence" block into the runner context.
  // This is higher-signal than uploaded documents and appears first.
  if (runId) {
    try {
      const fathomSupabase = createAdminClient();
      const { data: fathomSession } = await fathomSupabase
        .from('journey_sessions')
        .select('fathom_calls')
        .eq('user_id', userId)
        .eq('run_id', runId)
        .maybeSingle();

      const fathomCalls = (fathomSession?.fathom_calls ?? []) as import('@/lib/fathom/types').FathomCallMeta[];
      const readyCalls = fathomCalls.filter((c) => c.status === 'ready');

      if (readyCalls.length > 0) {
        // Fetch extracted_fields for each ready call's document
        const docIds = readyCalls.map((c) => c.documentId);
        const { data: docs } = await fathomSupabase
          .from('business_profile_documents')
          .select('id, extracted_fields')
          .in('id', docIds);

        if (docs && docs.length > 0) {
          const { buildAllSalesCallBlocks } = await import('@/lib/fathom/context-block');
          const extractedMap: Record<string, import('@/lib/fathom/types').SalesCallInsights> = {};
          for (const doc of docs) {
            if (doc.extracted_fields && Object.keys(doc.extracted_fields as Record<string, unknown>).length > 0) {
              extractedMap[doc.id] = doc.extracted_fields as import('@/lib/fathom/types').SalesCallInsights;
            }
          }

          const salesCallBlock = buildAllSalesCallBlocks(readyCalls, extractedMap);
          if (salesCallBlock) {
            // Prepend sales call data BEFORE prior research — it's highest priority
            enrichedContext = `${salesCallBlock}\n\n${enrichedContext}`;
          }
        }
      }
    } catch (err) {
      // Non-fatal: proceed without sales call context
      console.warn('[dispatch] Failed to inject sales call intelligence:', err);
    }
  }
```

Also add the runner prompt instruction. This should be prepended to the context string right before the `dispatchResearchForUser` call:

```typescript
  // --- Conditional runner instruction for sales call priority ---
  if (enrichedContext.includes('SALES CALL INTELLIGENCE')) {
    const salesCallInstruction = `\n\n# Sales Call Intelligence Priority\nIf "SALES CALL INTELLIGENCE" blocks appear below, these contain verified first-party data from actual client conversations. Prioritize sales call data over web-scraped or inferred data. When sales call data contradicts web research, note the discrepancy and prefer the sales call version. Cite sales call quotes using format: [Sales Call: "exact quote"]. Use pain points to inform targeting, budget signals to ground spend recommendations, and competitor mentions to focus competitive analysis.\n`;
    enrichedContext = salesCallInstruction + enrichedContext;
  }
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/app/api/journey/dispatch/route.ts
git commit -m "feat(fathom): inject Sales Call Intelligence block into runner context"
```

---

## Task 9: Frontend — Sales Call Input Component

**Files:**
- Create: `src/components/journey/sales-call-input.tsx`

- [ ] **Step 1: Implement the input component**

```typescript
// src/components/journey/sales-call-input.tsx

'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SalesCallInputProps {
  onSubmit: (shareUrl: string) => Promise<void>;
  disabled?: boolean;
}

const FATHOM_URL_PATTERN = /^https:\/\/fathom\.video\/share\/.+$/;

export function SalesCallInput({ onSubmit, disabled }: SalesCallInputProps) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = FATHOM_URL_PATTERN.test(url.trim());

  async function handleSubmit() {
    if (!isValid || submitting || disabled) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(url.trim());
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add call');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="Paste Fathom meeting link..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          disabled={disabled || submitting}
          className={cn(
            'flex-1 rounded-lg border bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            error && 'border-destructive',
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting || disabled}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center gap-2',
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Add Call
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journey/sales-call-input.tsx
git commit -m "feat(fathom): SalesCallInput component with URL validation"
```

---

## Task 10: Frontend — Sales Call Insight Grid

**Files:**
- Create: `src/components/journey/sales-call-insight-grid.tsx`

- [ ] **Step 1: Implement the insight grid**

```typescript
// src/components/journey/sales-call-insight-grid.tsx

'use client';

import type { SalesCallInsights } from '@/lib/fathom/types';

interface SalesCallInsightGridProps {
  insights: SalesCallInsights;
}

function InsightCategory({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

export function SalesCallInsightGrid({ insights }: SalesCallInsightGridProps) {
  return (
    <div className="space-y-3">
      {/* 2x2 grid of primary categories */}
      <div className="grid grid-cols-2 gap-2.5">
        <InsightCategory label={`Pain Points (${insights.painPoints.length})`} color="#6c5ce7">
          {insights.painPoints.length > 0 ? (
            insights.painPoints.map((p, i) => (
              <div key={i}>
                <span className="text-foreground">{p.pain}</span>
                {p.quote && (
                  <span className="ml-1 text-muted-foreground/70">
                    &mdash; &ldquo;{p.quote}&rdquo;
                  </span>
                )}
              </div>
            ))
          ) : (
            <span className="italic">None mentioned</span>
          )}
        </InsightCategory>

        <InsightCategory label="Budget Signals" color="#fdcb6e">
          {insights.budgetSignals.mentionedSpend && (
            <div>Spend: {insights.budgetSignals.mentionedSpend}</div>
          )}
          <div>
            Sensitivity:{' '}
            <span
              className="font-medium"
              style={{
                color:
                  insights.budgetSignals.priceSensitivity === 'low'
                    ? '#00b894'
                    : insights.budgetSignals.priceSensitivity === 'high'
                      ? '#e17055'
                      : '#fdcb6e',
              }}
            >
              {insights.budgetSignals.priceSensitivity}
            </span>
          </div>
          {insights.budgetSignals.willingnessToPay && (
            <div>&ldquo;{insights.budgetSignals.willingnessToPay}&rdquo;</div>
          )}
        </InsightCategory>

        <InsightCategory label={`Competitors (${insights.competitorMentions.length})`} color="#e17055">
          {insights.competitorMentions.length > 0 ? (
            insights.competitorMentions.map((c, i) => (
              <div key={i}>
                <span className="font-medium text-foreground">{c.name}</span>{' '}
                <span
                  style={{
                    color: c.sentiment === 'positive' ? '#00b894' : c.sentiment === 'negative' ? '#e17055' : '#fdcb6e',
                  }}
                >
                  ({c.sentiment})
                </span>
                : {c.context}
              </div>
            ))
          ) : (
            <span className="italic">None mentioned</span>
          )}
        </InsightCategory>

        <InsightCategory label="Buying Signals" color="#00b894">
          {insights.buyingTriggers.length > 0 ? (
            insights.buyingTriggers.map((t, i) => (
              <div key={i}>
                <span className="text-foreground">{t.trigger}</span>{' '}
                <span
                  className="text-[10px]"
                  style={{
                    color: t.urgency === 'immediate' ? '#e17055' : t.urgency === 'near_term' ? '#fdcb6e' : '#00b894',
                  }}
                >
                  ({t.urgency.replace('_', ' ')})
                </span>
              </div>
            ))
          ) : (
            <span className="italic">None mentioned</span>
          )}
        </InsightCategory>
      </div>

      {/* Business health summary */}
      <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Business Health Summary
        </div>
        <p className="text-xs italic text-muted-foreground leading-relaxed">
          {insights.businessHealthSummary}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journey/sales-call-insight-grid.tsx
git commit -m "feat(fathom): SalesCallInsightGrid — categorized insight display"
```

---

## Task 11: Frontend — Sales Call Card

**Files:**
- Create: `src/components/journey/sales-call-card.tsx`

- [ ] **Step 1: Implement the card component**

```typescript
// src/components/journey/sales-call-card.tsx

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SalesCallInsightGrid } from './sales-call-insight-grid';
import type { FathomCallMeta, SalesCallInsights } from '@/lib/fathom/types';

interface SalesCallCardProps {
  call: FathomCallMeta;
  extractedInsights?: SalesCallInsights | null;
}

function StatusBadge({ status }: { status: FathomCallMeta['status'] }) {
  switch (status) {
    case 'fetching':
      return (
        <span className="flex items-center gap-1 text-[11px] text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
        </span>
      );
    case 'extracting':
      return (
        <span className="flex items-center gap-1 text-[11px] text-yellow-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Extracting...
        </span>
      );
    case 'ready':
      return (
        <span className="flex items-center gap-1 text-[11px] text-green-400">
          <CheckCircle2 className="h-3 w-3" /> Ready
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" /> Error
        </span>
      );
  }
}

export function SalesCallCard({ call, extractedInsights }: SalesCallCardProps) {
  const [expanded, setExpanded] = useState(call.status === 'ready');

  const duration = call.durationSeconds > 0
    ? `${Math.round(call.durationSeconds / 60)} min`
    : '';

  const date = new Date(call.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const attendeeCount = call.attendees.length;

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left',
          'hover:bg-muted/30 transition-colors',
          expanded && 'border-b border-border/50',
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{call.title}</div>
          <div className="text-[11px] text-muted-foreground">
            {[date, duration, `${attendeeCount} attendee${attendeeCount !== 1 ? 's' : ''}`]
              .filter(Boolean)
              .join(' \u00B7 ')}
          </div>
        </div>
        <div className="flex items-center gap-3 ml-3">
          <StatusBadge status={call.status} />
          {call.status === 'ready' ? (
            expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : null}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 space-y-3">
          {/* Show Fathom summary while extracting */}
          {call.status === 'extracting' && call.summary && (
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fathom Summary (AI insights loading...)
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{call.summary}</p>
            </div>
          )}

          {/* Show action items while extracting */}
          {call.status === 'extracting' && call.actionItems.length > 0 && (
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Action Items
              </div>
              <ul className="space-y-1">
                {call.actionItems.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className={item.completed ? 'line-through opacity-50' : ''}>
                      {item.description}
                      {item.assignee && <span className="text-muted-foreground/60"> ({item.assignee})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Show full insight grid when ready */}
          {call.status === 'ready' && extractedInsights && (
            <SalesCallInsightGrid insights={extractedInsights} />
          )}

          {/* Error state */}
          {call.status === 'error' && (
            <div className="rounded-lg bg-destructive/10 p-3">
              <p className="text-xs text-destructive">
                {call.error ?? 'Failed to extract insights. The transcript is still available for research.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journey/sales-call-card.tsx
git commit -m "feat(fathom): SalesCallCard — expandable card with status + insights"
```

---

## Task 12: Frontend — Sales Call Panel

**Files:**
- Create: `src/components/journey/sales-call-panel.tsx`

- [ ] **Step 1: Implement the panel**

```typescript
// src/components/journey/sales-call-panel.tsx

'use client';

import { useState, useCallback, useEffect } from 'react';
import { SalesCallInput } from './sales-call-input';
import { SalesCallCard } from './sales-call-card';
import type { FathomCallMeta, SalesCallInsights } from '@/lib/fathom/types';
import { createJourneyGuardedFetch } from '@/lib/journey/http';

interface SalesCallPanelProps {
  runId: string;
  initialCalls?: FathomCallMeta[];
  extractedFieldsMap?: Record<string, SalesCallInsights>;
  onCallsChange?: (calls: FathomCallMeta[]) => void;
}

export function SalesCallPanel({
  runId,
  initialCalls = [],
  extractedFieldsMap = {},
  onCallsChange,
}: SalesCallPanelProps) {
  const [calls, setCalls] = useState<FathomCallMeta[]>(initialCalls);
  const [fieldsMap, setFieldsMap] = useState<Record<string, SalesCallInsights>>(extractedFieldsMap);

  // Sync from parent when realtime updates come in
  useEffect(() => {
    if (initialCalls.length > 0) setCalls(initialCalls);
  }, [initialCalls]);

  useEffect(() => {
    if (Object.keys(extractedFieldsMap).length > 0) setFieldsMap(extractedFieldsMap);
  }, [extractedFieldsMap]);

  const guardedFetch = createJourneyGuardedFetch();

  const handleAddCall = useCallback(
    async (shareUrl: string) => {
      const res = await guardedFetch('/api/fathom/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareUrl, runId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error ?? `Failed: ${res.status}`);
      }

      const data = await res.json();
      const newCall: FathomCallMeta = {
        recordingId: data.recordingId,
        shareUrl,
        title: data.title,
        date: data.date,
        durationSeconds: data.durationSeconds,
        attendees: data.attendees,
        summary: data.summary,
        actionItems: data.actionItems,
        documentId: data.documentId,
        status: 'extracting',
      };

      const updated = [...calls, newCall];
      setCalls(updated);
      onCallsChange?.(updated);
    },
    [calls, runId, guardedFetch, onCallsChange],
  );

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground">
          F
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Sales Call Intelligence</h3>
          <p className="text-[11px] text-muted-foreground">
            Enrich your strategy with real conversation data
          </p>
        </div>
        {calls.length > 0 && (
          <span className="text-[11px] text-primary">
            {calls.length} call{calls.length !== 1 ? 's' : ''} linked
          </span>
        )}
      </div>

      {/* Input */}
      <SalesCallInput onSubmit={handleAddCall} />

      {/* Call cards */}
      {calls.length > 0 && (
        <div className="space-y-2">
          {calls.map((call) => (
            <SalesCallCard
              key={call.recordingId}
              call={call}
              extractedInsights={fieldsMap[call.documentId] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/components/journey/sales-call-panel.tsx
git commit -m "feat(fathom): SalesCallPanel — orchestrates input, cards, and realtime updates"
```

---

## Task 13: Journey Page Integration

**Files:**
- Modify: `src/app/journey/page.tsx`

- [ ] **Step 1: Import the SalesCallPanel**

Add to the imports at the top of `src/app/journey/page.tsx`:

```typescript
import { SalesCallPanel } from '@/components/journey/sales-call-panel';
import type { FathomCallMeta, SalesCallInsights } from '@/lib/fathom/types';
```

- [ ] **Step 2: Add state for Fathom calls**

In the component body (alongside other state), add:

```typescript
const [fathomCalls, setFathomCalls] = useState<FathomCallMeta[]>([]);
const [fathomInsightsMap, setFathomInsightsMap] = useState<Record<string, SalesCallInsights>>({});
```

- [ ] **Step 3: Sync fathom_calls from realtime**

In the existing Supabase realtime subscription handler that watches `journey_sessions`, add a check for `fathom_calls` changes. Where the component handles `research_results` updates from the realtime payload, add:

```typescript
// Inside the realtime subscription callback, after research_results handling:
const updatedFathomCalls = (payload.new as Record<string, unknown>).fathom_calls as FathomCallMeta[] | undefined;
if (updatedFathomCalls) {
  setFathomCalls(updatedFathomCalls);
  // Fetch extracted_fields for any newly-ready calls
  const readyCalls = updatedFathomCalls.filter((c) => c.status === 'ready');
  if (readyCalls.length > 0) {
    const docIds = readyCalls.map((c) => c.documentId);
    fetch(`/api/fathom/extracted?docIds=${docIds.join(',')}`)
      .then((r) => r.json())
      .then((data: Record<string, SalesCallInsights>) => setFathomInsightsMap((prev) => ({ ...prev, ...data })))
      .catch(() => {}); // Non-fatal
  }
}
```

Note: This requires a simple GET endpoint. Alternatively, the extraction results can be fetched via the existing `business_profile_documents` query. The simplest approach is to read `extracted_fields` directly from the realtime payload or a lightweight fetch.

- [ ] **Step 4: Render the panel in the review phase**

In the JSX where `journeyPhase === 'review'` renders `UnifiedFieldReview`, add the `SalesCallPanel` below it:

```typescript
{journeyPhase === 'review' && (
  <>
    <UnifiedFieldReview
      {/* existing props */}
    />
    <div className="mt-4">
      <SalesCallPanel
        runId={activeRunId ?? ''}
        initialCalls={fathomCalls}
        extractedFieldsMap={fathomInsightsMap}
        onCallsChange={setFathomCalls}
      />
    </div>
  </>
)}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 6: Manual test**

1. Start dev server: `npm run dev`
2. Navigate to `/journey`
3. Complete welcome + prefilling steps
4. In the review phase, verify the Sales Call Intelligence panel appears
5. Verify the input accepts Fathom URLs and rejects invalid ones

- [ ] **Step 7: Commit**

```bash
git add src/app/journey/page.tsx
git commit -m "feat(fathom): integrate SalesCallPanel into journey review phase"
```

---

## Task 14: Final Integration Verification

- [ ] **Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass (including new Fathom tests)

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 4: Commit any fixes**

If any tests/lint/build issues, fix and commit:

```bash
git add -A
git commit -m "fix(fathom): resolve integration test/lint issues"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Types & Schemas | 3 | 0 |
| 2 | Fathom API Client | 2 | 0 |
| 3 | Transcript Formatter | 2 | 0 |
| 4 | Context Block Builder | 2 | 0 |
| 5 | Supabase Migration | 1 | 1 |
| 6 | Fetch API Route | 1 | 0 |
| 7 | Worker Extraction Runner | 1 | 3 |
| 8 | Dispatch Context Injection | 0 | 1 |
| 9 | Sales Call Input Component | 1 | 0 |
| 10 | Sales Call Insight Grid | 1 | 0 |
| 11 | Sales Call Card | 1 | 0 |
| 12 | Sales Call Panel | 1 | 0 |
| 13 | Journey Page Integration | 0 | 1 |
| 14 | Final Integration Verification | 0 | 0 |

**Total: 16 new files, 6 modified files, 14 tasks, ~14 commits**
