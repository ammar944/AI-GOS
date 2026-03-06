# Agent Intelligence Enforcement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the 3-stage intelligence architecture actually execute as specified — through deterministic field tracking, reliable competitor detection, and an enforced Strategist Mode guard — rather than relying on the model's general reasoning to follow system prompt guidance.

**Architecture:** The existing system prompt in `src/lib/ai/prompts/lead-agent-system.ts` already documents Stage 1 (instant hot-take after businessModel + industry), Stage 2 (competitorFastHits on competitor mention), and Stage 3 (Strategist Mode after synthesizeResearch). The gap is enforcement: none of these transitions are driven by deterministic logic in `route.ts`. This plan adds (1) a pure-function field tracker built on top of the existing `extractAskUserResults` contract, (2) a regex-based competitor detector as middleware, (3) a Strategist Mode guard injected into the system prompt per-request, and (4) sharpened Stage 1/2 system prompt language that eliminates ambiguity about trigger conditions. No new tools, no new API routes.

**Tech Stack:** Next.js App Router, Vercel AI SDK v6 (`streamText`), existing `UIMessage` type from `ai`, Vitest for TDD, existing `extractAskUserResults` from `src/lib/journey/session-state.ts`

---

### Task 1: Journey state tracker — `parseCollectedFields`

**Files:**
- Create: `src/lib/ai/journey-state.ts`
- Create: `src/lib/ai/__tests__/journey-state.test.ts`

**Context:** The route already calls `extractAskUserResults(body.messages)` to get a flat `Record<string, unknown>` of answered fields. `parseCollectedFields` is a pure function layered on top — it accepts the same `UIMessage[]` input, calls `extractAskUserResults` internally, and returns a typed summary: which of the 8 required fields have values, whether Stage 1 should fire, and whether `synthesizeResearch` has completed. This feeds the route's per-request context injection.

The `extractAskUserResults` output stores raw `output` objects from the `askUser` tool result, which are the chip selection payloads. A field is "collected" when its key appears with a non-null, non-empty value.

`synthesizeResearch` completes when an assistant message has a `tool-synthesizeResearch` part with `state === 'output-available'`. This mirrors the exact pattern used in `extractResearchOutputs` in `session-state.ts` (lines 160-179 of that file).

**Step 1: Write the test file first (TDD)**

Create `src/lib/ai/__tests__/journey-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { UIMessage } from 'ai';
import {
  parseCollectedFields,
  type JourneyStateSnapshot,
} from '../journey-state';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAskUserResultMessage(
  fieldName: string,
  value: unknown,
): UIMessage {
  return {
    id: `msg-${fieldName}`,
    role: 'assistant',
    content: '',
    parts: [
      {
        type: 'tool-askUser',
        state: 'output-available',
        toolCallId: `call-${fieldName}`,
        toolName: 'askUser',
        input: { question: 'Q?', fieldName, options: [] },
        output: value,
      } as unknown as UIMessage['parts'][number],
    ],
  };
}

function makeSynthCompleteMessage(): UIMessage {
  return {
    id: 'msg-synth',
    role: 'assistant',
    content: '',
    parts: [
      {
        type: 'tool-synthesizeResearch',
        state: 'output-available',
        toolCallId: 'call-synth',
        toolName: 'synthesizeResearch',
        input: { context: '...' },
        output: { status: 'queued', section: 'crossAnalysis' },
      } as unknown as UIMessage['parts'][number],
    ],
  };
}

// ── parseCollectedFields ──────────────────────────────────────────────────────

describe('parseCollectedFields', () => {
  it('returns empty state for no messages', () => {
    const snap = parseCollectedFields([]);
    expect(snap.collectedFields).toEqual({});
    expect(snap.hasBusinessModel).toBe(false);
    expect(snap.hasIndustry).toBe(false);
    expect(snap.shouldFireStage1).toBe(false);
    expect(snap.synthComplete).toBe(false);
    expect(snap.requiredFieldCount).toBe(0);
  });

  it('detects businessModel collected', () => {
    const messages = [makeAskUserResultMessage('businessModel', 'B2B SaaS')];
    const snap = parseCollectedFields(messages);
    expect(snap.hasBusinessModel).toBe(true);
    expect(snap.hasIndustry).toBe(false);
    expect(snap.shouldFireStage1).toBe(false);
  });

  it('sets shouldFireStage1 when both businessModel and industry are collected', () => {
    const messages = [
      makeAskUserResultMessage('businessModel', 'B2B SaaS'),
      makeAskUserResultMessage('industry', 'Developer Tools'),
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.hasBusinessModel).toBe(true);
    expect(snap.hasIndustry).toBe(true);
    expect(snap.shouldFireStage1).toBe(true);
  });

  it('counts required fields correctly', () => {
    const messages = [
      makeAskUserResultMessage('businessModel', 'B2B SaaS'),
      makeAskUserResultMessage('industry', 'DevOps'),
      makeAskUserResultMessage('icpDescription', 'Mid-market CTOs'),
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.requiredFieldCount).toBe(3);
  });

  it('does not count optional fields in requiredFieldCount', () => {
    const messages = [
      makeAskUserResultMessage('businessModel', 'B2C'),
      makeAskUserResultMessage('companyName', 'Acme Corp'), // optional field
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.requiredFieldCount).toBe(1);
  });

  it('detects synthComplete from synthesizeResearch output-available part', () => {
    const messages = [makeSynthCompleteMessage()];
    const snap = parseCollectedFields(messages);
    expect(snap.synthComplete).toBe(true);
  });

  it('does not set synthComplete for other tool completions', () => {
    const messages = [
      {
        id: 'msg-ind',
        role: 'assistant' as const,
        content: '',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'call-ind',
            toolName: 'researchIndustry',
            input: { context: '...' },
            output: { status: 'queued', section: 'industryMarket' },
          } as unknown as UIMessage['parts'][number],
        ],
      },
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.synthComplete).toBe(false);
  });

  it('handles multiSelect marketingChannels as array', () => {
    const messages = [
      makeAskUserResultMessage('marketingChannels', ['Google Ads', 'LinkedIn Ads']),
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.requiredFieldCount).toBe(1);
  });

  it('ignores empty string values as uncollected', () => {
    const messages = [makeAskUserResultMessage('businessModel', '')];
    const snap = parseCollectedFields(messages);
    expect(snap.hasBusinessModel).toBe(false);
    expect(snap.requiredFieldCount).toBe(0);
  });

  it('ignores null values as uncollected', () => {
    const messages = [makeAskUserResultMessage('businessModel', null)];
    const snap = parseCollectedFields(messages);
    expect(snap.hasBusinessModel).toBe(false);
  });

  it('handles all 8 required fields collected', () => {
    const required = [
      'businessModel', 'industry', 'icpDescription', 'productDescription',
      'competitors', 'offerPricing', 'marketingChannels', 'goals',
    ];
    const messages = required.map((f) =>
      makeAskUserResultMessage(f, f === 'marketingChannels' ? ['Google Ads'] : `value-${f}`)
    );
    const snap = parseCollectedFields(messages);
    expect(snap.requiredFieldCount).toBe(8);
    expect(snap.shouldFireStage1).toBe(true);
  });
});
```

**Step 2: Run tests — expect all to fail (red)**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run test:run -- src/lib/ai/__tests__/journey-state.test.ts 2>&1 | tail -20
```

Expected: `Cannot find module '../journey-state'` — all tests fail. This confirms TDD baseline.

**Step 3: Implement `src/lib/ai/journey-state.ts`**

Create `src/lib/ai/journey-state.ts`:

```typescript
// Journey State Tracker
// Pure functions over UIMessage[] to derive which onboarding fields are collected
// and which intelligence stages should fire this request.
//
// Builds on extractAskUserResults() from session-state.ts — same message scanning
// pattern, same output shape. No side effects, no I/O.

import type { UIMessage } from 'ai';
import { extractAskUserResults } from '@/lib/journey/session-state';

// The 8 required onboarding fields in collection order
const REQUIRED_FIELDS = [
  'businessModel',
  'industry',
  'icpDescription',
  'productDescription',
  'competitors',
  'offerPricing',
  'marketingChannels',
  'goals',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

export interface JourneyStateSnapshot {
  /** All collected fields (required + optional), raw values from askUser outputs */
  collectedFields: Record<string, unknown>;
  /** True when businessModel has a non-empty value */
  hasBusinessModel: boolean;
  /** True when industry has a non-empty value */
  hasIndustry: boolean;
  /** True when both businessModel AND industry are collected — Stage 1 trigger */
  shouldFireStage1: boolean;
  /** True when synthesizeResearch has a completed output-available part in messages */
  synthComplete: boolean;
  /** Count of the 8 required fields that have non-empty values (0-8) */
  requiredFieldCount: number;
}

/** Returns true if a value counts as "collected" (non-null, non-empty). */
function isCollected(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Scan messages for a completed synthesizeResearch tool output.
 * Mirrors the pattern in extractResearchOutputs() in session-state.ts:
 * look for assistant parts with type 'tool-synthesizeResearch' and
 * state 'output-available'.
 */
function detectSynthComplete(messages: UIMessage[]): boolean {
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (
        p.type === 'tool-synthesizeResearch' &&
        p.state === 'output-available'
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Derive a typed snapshot of onboarding progress from the full message history.
 *
 * Pure function — no side effects.
 * Call once per POST in route.ts, before streamText.
 */
export function parseCollectedFields(messages: UIMessage[]): JourneyStateSnapshot {
  const collectedFields = extractAskUserResults(messages);

  const hasBusinessModel = isCollected(collectedFields['businessModel']);
  const hasIndustry = isCollected(collectedFields['industry']);
  const shouldFireStage1 = hasBusinessModel && hasIndustry;

  const requiredFieldCount = REQUIRED_FIELDS.filter((f: RequiredField) =>
    isCollected(collectedFields[f])
  ).length;

  const synthComplete = detectSynthComplete(messages);

  return {
    collectedFields,
    hasBusinessModel,
    hasIndustry,
    shouldFireStage1,
    synthComplete,
    requiredFieldCount,
  };
}
```

**Step 4: Run tests — expect all to pass (green)**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run test:run -- src/lib/ai/__tests__/journey-state.test.ts 2>&1 | tail -20
```

Expected: all 12 tests pass.

**Step 5: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && git add src/lib/ai/journey-state.ts src/lib/ai/__tests__/journey-state.test.ts && git commit -m "$(cat <<'EOF'
feat: journey state tracker — parseCollectedFields derives Stage 1/Strategist Mode flags

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Competitor detector — `detectCompetitorMentions`

**Files:**
- Create: `src/lib/ai/competitor-detector.ts`
- Create: `src/lib/ai/__tests__/competitor-detector.test.ts`

**Context:** The `competitorFastHits` tool is built and registered in the route. The gap is reliable trigger: the model must recognise "my competitor is PagerDuty" from conversational text and extract a domain to pass as `competitorUrl`. Rather than relying on the model to always infer this, this module provides a deterministic extraction function that parses the latest user message in route.ts. The result is injected into a system context addendum before each `streamText` call, so the model sees a direct instruction: "The user just mentioned X — call competitorFastHits with domain Y."

Detection scope: this function only parses the last user message (not full history) to avoid re-triggering on old mentions. The route checks the result and skips injection if `competitorFastHits` has already been called for that domain (tracked via message history scan).

**Step 1: Write the test file first (TDD)**

Create `src/lib/ai/__tests__/competitor-detector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  detectCompetitorMentions,
  type CompetitorDetection,
} from '../competitor-detector';

describe('detectCompetitorMentions', () => {
  // ── URL patterns ────────────────────────────────────────────────────────────

  it('extracts bare HTTPS URL', () => {
    const result = detectCompetitorMentions('check out https://www.hubspot.com');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('hubspot.com');
    expect(result!.rawMention).toBe('https://www.hubspot.com');
  });

  it('extracts bare HTTP URL', () => {
    const result = detectCompetitorMentions('our competitor is at http://pagerduty.com');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('pagerduty.com');
  });

  it('extracts domain-only URLs (no protocol) with known TLDs', () => {
    const result = detectCompetitorMentions('We compete with datadog.com and grafana.io');
    expect(result).not.toBeNull();
    expect(result!.domain).toMatch(/datadog\.com|grafana\.io/);
  });

  it('extracts domain from .io TLD', () => {
    const result = detectCompetitorMentions('main competitor is linear.io');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('linear.io');
  });

  it('extracts domain from .ai TLD', () => {
    const result = detectCompetitorMentions('competing with jasper.ai');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('jasper.ai');
  });

  it('extracts domain from .co TLD', () => {
    const result = detectCompetitorMentions('check buffer.co out');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('buffer.co');
  });

  // ── Phrase patterns ──────────────────────────────────────────────────────────

  it('detects "my competitor is X" pattern and infers domain', () => {
    const result = detectCompetitorMentions('My competitor is PagerDuty');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('pagerduty.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "main competitor is X" pattern', () => {
    const result = detectCompetitorMentions('our main competitor is HubSpot');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('hubspot.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "we compete with X" pattern', () => {
    const result = detectCompetitorMentions('we compete with Salesforce');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('salesforce.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "competing against X" pattern', () => {
    const result = detectCompetitorMentions('We are competing against Datadog');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('datadog.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "rival is X" pattern', () => {
    const result = detectCompetitorMentions('our main rival is Intercom');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('intercom.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "competitors are X, Y" and returns first match', () => {
    const result = detectCompetitorMentions('my competitors are HubSpot and Salesforce');
    expect(result).not.toBeNull();
    // Returns the first detected domain
    expect(result!.domain).toMatch(/hubspot\.com|salesforce\.com/);
  });

  // ── Domain normalisation ──────────────────────────────────────────────────────

  it('strips www. prefix from extracted domains', () => {
    const result = detectCompetitorMentions('https://www.stripe.com/pricing');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('stripe.com');
  });

  it('strips path from URL when extracting domain', () => {
    const result = detectCompetitorMentions('see https://linear.app/pricing');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('linear.app');
  });

  it('lowercases the domain', () => {
    const result = detectCompetitorMentions('competitor is HubSpot.COM');
    // Domain inference from company name lowercases it
    if (result) {
      expect(result.domain).toBe(result.domain.toLowerCase());
    }
  });

  // ── Negative cases ──────────────────────────────────────────────────────────

  it('returns null for plain text with no competitor signals', () => {
    const result = detectCompetitorMentions('We are a B2B SaaS company in DevOps');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectCompetitorMentions('')).toBeNull();
  });

  it('returns null for "I don\'t know my competitors"', () => {
    const result = detectCompetitorMentions("I don't know who my competitors are");
    expect(result).toBeNull();
  });

  it('returns null for "no direct competitors"', () => {
    const result = detectCompetitorMentions('we have no direct competitors');
    expect(result).toBeNull();
  });

  it('does not false-positive on generic business words', () => {
    const result = detectCompetitorMentions('We want to compete in the enterprise market');
    expect(result).toBeNull();
  });

  it('does not false-positive on email addresses', () => {
    const result = detectCompetitorMentions('contact us at hello@example.com');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run tests — expect all to fail (red)**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run test:run -- src/lib/ai/__tests__/competitor-detector.test.ts 2>&1 | tail -20
```

Expected: `Cannot find module '../competitor-detector'` — all fail.

**Step 3: Implement `src/lib/ai/competitor-detector.ts`**

Create `src/lib/ai/competitor-detector.ts`:

```typescript
// Competitor Detector
// Deterministic extraction of competitor mentions from user message text.
// Used in route.ts to inject a Stage 2 trigger instruction when a competitor
// is detected — before the competitorFastHits tool call.
//
// Design decisions:
// - URL detection takes priority over phrase detection
// - Phrase detection infers domain by lowercasing the company name + ".com"
//   (covers ~80% of SaaS companies — good enough for a fast-path trigger)
// - Returns first match only — route calls competitorFastHits for one competitor
//   per request to avoid blocking the response with multiple serial sub-agent calls
// - Email addresses are excluded to avoid false positives

export interface CompetitorDetection {
  /** Normalised domain ready to pass to competitorFastHits (e.g., "hubspot.com") */
  domain: string;
  /** The raw string that triggered detection */
  rawMention: string;
  /** True when domain was inferred from a company name rather than an explicit URL */
  inferredDomain: boolean;
}

// Phrases that signal the user is naming a competitor
// Deliberately conservative: only strong explicit signals
const COMPETITOR_PHRASE_PATTERNS = [
  /(?:my|our|main|top|biggest|primary|direct)\s+competitor(?:s)?\s+(?:is|are)\s+([A-Z][a-zA-Z0-9\s]{1,30}?)(?:\s+and\s+|,|\.|$)/gi,
  /(?:we\s+)?compete\s+(?:with|against)\s+([A-Z][a-zA-Z0-9\s]{1,30}?)(?:\s+and\s+|,|\.|$)/gi,
  /(?:my|our)\s+rival(?:s)?\s+(?:is|are)\s+([A-Z][a-zA-Z0-9\s]{1,30}?)(?:\s+and\s+|,|\.|$)/gi,
  /competing\s+against\s+([A-Z][a-zA-Z0-9\s]{1,30}?)(?:\s+and\s+|,|\.|$)/gi,
];

// Patterns that indicate the user does NOT know competitors — skip Stage 2
const NO_COMPETITOR_SIGNALS = [
  /don'?t\s+know/i,
  /no\s+(?:direct\s+)?competitors/i,
  /not\s+sure\s+who/i,
  /no\s+idea/i,
];

// Supported TLDs for bare domain detection (no protocol)
const DOMAIN_TLDS = ['com', 'io', 'ai', 'co', 'app', 'dev', 'net', 'org', 'xyz'];

const BARE_DOMAIN_RE = new RegExp(
  `\\b([a-zA-Z0-9][a-zA-Z0-9-]{1,30})\\.(?:${DOMAIN_TLDS.join('|')})\\b`,
  'gi',
);

const HTTPS_URL_RE = /https?:\/\/(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9.-]{1,60})/gi;

// Email pattern to exclude false positives like "hello@example.com"
const EMAIL_RE = /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi;

/**
 * Infer a .com domain from a company name by lowercasing and removing spaces.
 * e.g. "HubSpot" → "hubspot.com", "Pager Duty" → "pagerduty.com"
 */
function inferDomain(companyName: string): string {
  return companyName.trim().toLowerCase().replace(/\s+/g, '') + '.com';
}

/**
 * Strip email addresses from the text before scanning for domains to
 * prevent "user@hubspot.com" matching as a competitor.
 */
function stripEmails(text: string): string {
  return text.replace(EMAIL_RE, '');
}

/**
 * Extract the first competitor mention from a user message.
 *
 * Priority order:
 * 1. Explicit HTTPS/HTTP URL → highest confidence
 * 2. Bare domain with known TLD (e.g., "hubspot.com")
 * 3. Competitor phrase patterns → lowest confidence, domain inferred
 *
 * Returns null when:
 * - No competitor signal found
 * - "no competitors" / "don't know" signals present
 * - Input is empty
 */
export function detectCompetitorMentions(
  userMessage: string,
): CompetitorDetection | null {
  if (!userMessage.trim()) return null;

  // Bail early if user explicitly says they don't know competitors
  if (NO_COMPETITOR_SIGNALS.some((re) => re.test(userMessage))) {
    return null;
  }

  const cleaned = stripEmails(userMessage);

  // 1. Explicit URL detection (highest confidence)
  HTTPS_URL_RE.lastIndex = 0;
  const urlMatch = HTTPS_URL_RE.exec(cleaned);
  if (urlMatch) {
    const rawDomain = urlMatch[1].toLowerCase();
    // Strip trailing path segments — take only host part
    const host = rawDomain.split('/')[0];
    // Strip www. prefix
    const domain = host.startsWith('www.') ? host.slice(4) : host;
    return {
      domain,
      rawMention: urlMatch[0],
      inferredDomain: false,
    };
  }

  // 2. Bare domain with known TLD (e.g., "datadog.com", "linear.io")
  BARE_DOMAIN_RE.lastIndex = 0;
  const domainMatch = BARE_DOMAIN_RE.exec(cleaned);
  if (domainMatch) {
    const fullMatch = domainMatch[0].toLowerCase();
    return {
      domain: fullMatch,
      rawMention: domainMatch[0],
      inferredDomain: false,
    };
  }

  // 3. Competitor phrase patterns — infer domain from company name
  for (const pattern of COMPETITOR_PHRASE_PATTERNS) {
    pattern.lastIndex = 0;
    const phraseMatch = pattern.exec(userMessage);
    if (phraseMatch?.[1]) {
      const companyName = phraseMatch[1].trim();
      // Sanity check: skip if "captured group" looks like a generic word
      if (companyName.length < 3 || /^(the|a|an|our|my|this|that)$/i.test(companyName)) {
        continue;
      }
      return {
        domain: inferDomain(companyName),
        rawMention: phraseMatch[0].trim(),
        inferredDomain: true,
      };
    }
  }

  return null;
}
```

**Step 4: Run tests — expect all to pass (green)**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run test:run -- src/lib/ai/__tests__/competitor-detector.test.ts 2>&1 | tail -30
```

Expected: all tests pass. If regex edge cases fail, tighten patterns — do NOT loosen the no-competitor signals guard (that's safety-critical).

**Step 5: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && git add src/lib/ai/competitor-detector.ts src/lib/ai/__tests__/competitor-detector.test.ts && git commit -m "$(cat <<'EOF'
feat: competitor detector — deterministic Stage 2 trigger from user message text

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Stage 2 guard — scan history to avoid re-triggering

**Files:**
- Modify: `src/lib/ai/journey-state.ts`
- Modify: `src/lib/ai/__tests__/journey-state.test.ts`

**Context:** Before injecting a Stage 2 competitor instruction, the route must check whether `competitorFastHits` has already been called for this domain in the conversation. Without this guard, every request where the user's message contains a competitor reference would inject a redundant Stage 2 instruction, causing the model to call `competitorFastHits` repeatedly.

Detection: scan assistant message parts for `type === 'tool-competitorFastHits'` with `state === 'output-available'` or `state === 'input-available'`. If found, the domain is already being processed. Extract the called domain from the `input.competitorUrl` field.

**Step 1: Add `competitorFastHitsCalledFor` to `JourneyStateSnapshot` and test it**

Add these tests to `src/lib/ai/__tests__/journey-state.test.ts` (append to the file):

```typescript
// ── competitorFastHitsCalledFor ──────────────────────────────────────────────

describe('competitorFastHitsCalledFor', () => {
  it('returns empty set when no competitorFastHits calls in history', () => {
    const snap = parseCollectedFields([]);
    expect(snap.competitorFastHitsCalledFor.size).toBe(0);
  });

  it('records a domain when competitorFastHits was called with output-available', () => {
    const msg: UIMessage = {
      id: 'msg-cfh',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-competitorFastHits',
          state: 'output-available',
          toolCallId: 'call-cfh',
          toolName: 'competitorFastHits',
          input: { competitorUrl: 'hubspot.com' },
          output: { status: 'complete', data: {} },
        } as unknown as UIMessage['parts'][number],
      ],
    };
    const snap = parseCollectedFields([msg]);
    expect(snap.competitorFastHitsCalledFor.has('hubspot.com')).toBe(true);
  });

  it('records a domain when competitorFastHits is in-flight (input-available)', () => {
    const msg: UIMessage = {
      id: 'msg-cfh2',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-competitorFastHits',
          state: 'input-available',
          toolCallId: 'call-cfh2',
          toolName: 'competitorFastHits',
          input: { competitorUrl: 'pagerduty.com' },
          output: undefined,
        } as unknown as UIMessage['parts'][number],
      ],
    };
    const snap = parseCollectedFields([msg]);
    expect(snap.competitorFastHitsCalledFor.has('pagerduty.com')).toBe(true);
  });

  it('normalises competitorUrl to lowercase when recording', () => {
    const msg: UIMessage = {
      id: 'msg-cfh3',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-competitorFastHits',
          state: 'output-available',
          toolCallId: 'call-cfh3',
          toolName: 'competitorFastHits',
          input: { competitorUrl: 'HubSpot.COM' },
          output: { status: 'complete', data: {} },
        } as unknown as UIMessage['parts'][number],
      ],
    };
    const snap = parseCollectedFields([msg]);
    expect(snap.competitorFastHitsCalledFor.has('hubspot.com')).toBe(true);
  });
});
```

**Step 2: Update `src/lib/ai/journey-state.ts` to add `competitorFastHitsCalledFor`**

Add the following to the `JourneyStateSnapshot` interface:

```typescript
/** Domains for which competitorFastHits has already been called (or is in-flight). */
competitorFastHitsCalledFor: Set<string>;
```

Add a new private function in `journey-state.ts` after `detectSynthComplete`:

```typescript
/** Scan message history for competitorFastHits calls. Returns set of called domains. */
function detectCompetitorFastHitsCalled(messages: UIMessage[]): Set<string> {
  const called = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (p.type !== 'tool-competitorFastHits') continue;
      // Capture both in-flight and completed calls
      if (p.state !== 'output-available' && p.state !== 'input-available') continue;
      const input = p.input as Record<string, unknown> | undefined;
      if (typeof input?.competitorUrl === 'string') {
        called.add(input.competitorUrl.toLowerCase());
      }
    }
  }
  return called;
}
```

Update `parseCollectedFields` to compute and return `competitorFastHitsCalledFor`:

```typescript
export function parseCollectedFields(messages: UIMessage[]): JourneyStateSnapshot {
  const collectedFields = extractAskUserResults(messages);

  const hasBusinessModel = isCollected(collectedFields['businessModel']);
  const hasIndustry = isCollected(collectedFields['industry']);
  const shouldFireStage1 = hasBusinessModel && hasIndustry;

  const requiredFieldCount = REQUIRED_FIELDS.filter((f: RequiredField) =>
    isCollected(collectedFields[f])
  ).length;

  const synthComplete = detectSynthComplete(messages);
  const competitorFastHitsCalledFor = detectCompetitorFastHitsCalled(messages);

  return {
    collectedFields,
    hasBusinessModel,
    hasIndustry,
    shouldFireStage1,
    synthComplete,
    requiredFieldCount,
    competitorFastHitsCalledFor,
  };
}
```

**Step 3: Run all journey-state tests**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run test:run -- src/lib/ai/__tests__/journey-state.test.ts 2>&1 | tail -20
```

Expected: all tests pass including the new `competitorFastHitsCalledFor` group.

**Step 4: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && git add src/lib/ai/journey-state.ts src/lib/ai/__tests__/journey-state.test.ts && git commit -m "$(cat <<'EOF'
feat: track competitorFastHits call history to prevent Stage 2 re-triggering

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire state tracker + competitor detector into `route.ts`

**Files:**
- Modify: `src/app/api/journey/stream/route.ts:96-135`

**Context:** This is the enforcement layer. After sanitising messages and before calling `streamText`, the route now:
1. Calls `parseCollectedFields` to get a `JourneyStateSnapshot`
2. Calls `detectCompetitorMentions` on the last user message
3. If a competitor is detected AND it hasn't been called before → appends a Stage 2 injection to the system prompt
4. If `synthComplete` → appends the Strategist Mode guard to the system prompt

These are system prompt addenda (string concatenation) — no new tools, no schema changes. The model still decides whether to call `competitorFastHits`, but now it has an explicit, per-request directive to do so with the pre-extracted domain.

**Step 1: Add imports at top of route.ts**

Open `src/app/api/journey/stream/route.ts`. After the existing imports (around line 24), add:

```typescript
import { parseCollectedFields } from '@/lib/ai/journey-state';
import { detectCompetitorMentions } from '@/lib/ai/competitor-detector';
```

**Step 2: Extract the last user message for competitor detection**

After the sanitization block (after line 79, before line 81 where `persistToSupabase` is called), add a helper to get the last user message text:

```typescript
// ── Extract last user message for competitor detection ───────────────────────
const lastUserMessage = [...sanitizedMessages]
  .reverse()
  .find((m) => m.role === 'user');
const lastUserText =
  lastUserMessage?.parts
    .filter(
      (p): p is { type: 'text'; text: string } =>
        typeof p === 'object' && p !== null && (p as { type: string }).type === 'text',
    )
    .map((p) => p.text)
    .join(' ') ?? '';
```

**Step 3: Compute state snapshot and build context addenda**

After the system prompt build block (after line 104, before the `streamText` call), add:

```typescript
// ── Derive per-request state snapshot ──────────────────────────────────────
const journeySnap = parseCollectedFields(sanitizedMessages);

// Stage 2: competitor detection — inject instruction if new competitor found
const competitorDetection = lastUserText
  ? detectCompetitorMentions(lastUserText)
  : null;

const competitorAlreadyCalled =
  competitorDetection !== null &&
  journeySnap.competitorFastHitsCalledFor.has(competitorDetection.domain);

if (
  competitorDetection !== null &&
  !competitorAlreadyCalled
) {
  const domainLabel = competitorDetection.inferredDomain
    ? `${competitorDetection.domain} (inferred from "${competitorDetection.rawMention}")`
    : competitorDetection.domain;

  systemPrompt += `\n\n## Stage 2 Directive (this request only)\n\nThe user's latest message contains a competitor reference: **${competitorDetection.rawMention}**. Extracted domain: \`${competitorDetection.domain}\` ${competitorDetection.inferredDomain ? '(inferred — verify if incorrect)' : ''}.\n\nIMPORTANTLY: Call \`competitorFastHits\` with \`competitorUrl: "${competitorDetection.domain}"\` as your FIRST action in this response — before writing any text. After the tool completes, briefly acknowledge the finding (1-2 sentences) then continue with the next onboarding question. Domain used: ${domainLabel}.`;
}

// Strategist Mode guard: prevent askUser calls after synthesis completes
if (journeySnap.synthComplete) {
  systemPrompt += `\n\n## Strategist Mode (enforced)\n\nSynthesis is complete. You are now in Strategist Mode. ABSOLUTE RULES:\n- Do NOT call \`askUser\` to collect more onboarding fields. The onboarding phase is over.\n- Do NOT call any research tools again — all research has been dispatched.\n- Respond to the user's strategic questions with specific, opinionated recommendations.\n- If the user asks a question that requires data you don't have, acknowledge the gap and give your best take based on what was collected.`;
}
```

**Step 4: Verify the full route.ts structure is correct**

Read the file back to confirm no syntax errors around the injection points:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npx tsc --noEmit 2>&1 | grep "route.ts" | head -10
```

Expected: no TypeScript errors in route.ts.

**Step 5: Full build check**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run build 2>&1 | tail -20
```

Expected: build exits 0.

**Step 6: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && git add src/app/api/journey/stream/route.ts && git commit -m "$(cat <<'EOF'
feat: wire journey state + competitor detection into streaming route

Injects Stage 2 competitor directive and Strategist Mode guard into system
prompt per-request based on deterministic message history analysis.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: System prompt precision — sharpen Stage 1 and Stage 2 trigger language

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts:95-127`

**Context:** The existing Stage 1 and Stage 2 sections in `LEAD_AGENT_SYSTEM_PROMPT` (lines 95-127) use vague trigger conditions: "as soon as businessModel AND industry are both confirmed" and "when the user names a competitor". The route now injects explicit per-request directives, but the base system prompt still guides the model's behaviour when those injections don't apply (e.g., when the model wants to proactively generate a hot-take mid-response). Sharper language eliminates ambiguity and aligns the model's general behaviour with what the enforcement layer expects.

Changes:
- Stage 1: Replace "as soon as" with "immediately after you receive the askUser tool result for `industry`" — this pins the trigger to a specific event, not general "confirmation"
- Stage 2: Add explicit failure mode — what to do if `competitorFastHits` has already been called for that competitor
- Add a "Do not re-trigger" rule to Stage 2 so the model doesn't call the same tool twice

**Step 1: Read lines 95-127 of lead-agent-system.ts**

Confirm the exact current text before editing. The section begins with `### Stage 1 — Instant Hot-Take` at line 95.

**Step 2: Replace Stage 1 and Stage 2 content**

In `src/lib/ai/prompts/lead-agent-system.ts`, find and replace the Stage 1 block (lines 95-106):

Old text:
```
### Stage 1 — Instant Hot-Take (your own knowledge, no tools)

As soon as **businessModel** AND **industry** are both confirmed, include a 2-3 sentence market hot-take in your response — before asking the next question. This uses your training knowledge only. No tool calls needed.

Rules for the hot-take:
- Reference their specific combination (e.g., "B2B SaaS in Developer Tools", not generic)
- Give a real, opinionated take: typical CAC range, key buying behavior, competitive intensity, or seasonal pattern
- Frame it as "while I pull live data, here's what I already know": shows the AI is working even while talking
- Keep it to 2-3 sentences max, then immediately continue with the next question

Example:
"B2B SaaS in DevTools — you're in a crowded auction. LinkedIn CPL typically runs $200-400 for engineers, but Google Search (problem-aware keywords like 'CI/CD tools', 'monorepo tooling') often converts better. Q1 and Q4 are your buying windows as teams get new headcount approved. Let me run live market data while we keep going."
```

New text:
```
### Stage 1 — Instant Hot-Take (your own knowledge, no tools)

**Trigger**: Immediately after you receive the `askUser` tool result for the `industry` field — meaning you now have BOTH `businessModel` AND `industry` answered. Do not wait for the user to "confirm" — the tool result IS the confirmation.

Include a 2-3 sentence market hot-take in your response text — before asking the next question. This uses your training knowledge only. No tool calls needed for this.

Rules for the hot-take:
- Reference their specific combination (e.g., "B2B SaaS in Developer Tools", not generic "SaaS")
- Give a real, opinionated take on one of: typical CAC range, key buying behaviour, competitive intensity, or seasonal pattern
- Frame it as "while I pull live data, here's what I already know" — signals the AI is actively working
- Keep it to 2-3 sentences max, then immediately continue with the next question

**Failure mode to avoid**: Do NOT deliver the hot-take on the same turn you receive `businessModel` — wait until you also have `industry`. Do NOT skip the hot-take if both fields are answered but you haven't delivered it yet.

Example:
"B2B SaaS in DevTools — you're in a crowded auction. LinkedIn CPL typically runs $200-400 for engineers, but Google Search (problem-aware keywords like 'CI/CD tools', 'monorepo tooling') often converts better. Q1 and Q4 are your buying windows as teams get new headcount approved. Let me pull live market data while we keep going."
```

Find and replace the Stage 2 block (lines 108-119):

Old text:
```
### Stage 2 — Fast Competitor Hit (Firecrawl + Ad Library)

When the user **names a competitor** OR **provides a website URL** (their own or a competitor's), immediately call `competitorFastHits` before your next question.

Trigger conditions:
- User says "my competitors are X, Y" — infer the domain from the company name (e.g., "HubSpot" → "hubspot.com") and call with that domain
- User provides a URL in their message — call with that URL directly
- User says "I don't know my competitors" — skip Stage 2, continue onboarding

After calling competitorFastHits:
- Briefly acknowledge what you found (1-2 sentences)
- Continue with the next onboarding question
```

New text:
```
### Stage 2 — Fast Competitor Hit (Firecrawl + Ad Library)

**Trigger**: When the user names a competitor company OR provides a website URL (their own or a competitor's) in their message. Call `competitorFastHits` as your FIRST action in that response — before writing any text.

Trigger conditions (in priority order):
- User provides a URL (http/https) — pass that URL directly as `competitorUrl`
- User provides a bare domain (e.g., "hubspot.com", "linear.io") — pass that domain
- User says "my competitors are X, Y" — infer the domain: lowercase + remove spaces + ".com" (e.g., "PagerDuty" → "pagerduty.com"). Pass the first named competitor only.
- User says "I don't know my competitors" or "no direct competitors" — skip Stage 2, continue onboarding

**Do NOT re-trigger**: If you have already called `competitorFastHits` for a given domain in this conversation, do not call it again for the same domain. A per-request instruction will tell you when to call it — follow that instruction.

After `competitorFastHits` returns:
- Briefly acknowledge what you found (1-2 sentences referencing a specific finding, e.g., "They're running 30+ Meta ads focused on [theme] — that tells me [implication]")
- Continue with the next onboarding question
```

**Step 3: TypeScript check**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npx tsc --noEmit 2>&1 | grep "lead-agent-system" | head -5
```

Expected: no errors (this file has no types — just string constants).

**Step 4: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && git add src/lib/ai/prompts/lead-agent-system.ts && git commit -m "$(cat <<'EOF'
fix: sharpen Stage 1 and Stage 2 trigger language in system prompt

Changes 'as soon as confirmed' to 'immediately after askUser tool result
for industry field'. Adds explicit failure modes and re-trigger guard.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Full test suite + build verification

**Files:** None — verification only.

**Step 1: Run the full test suite**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run test:run 2>&1 | tail -30
```

Expected: all tests pass. Pre-existing failures in openrouter tests and chat blueprint tests are known — do not fix them.

The new tests that must pass:
- `src/lib/ai/__tests__/journey-state.test.ts` — 15+ tests
- `src/lib/ai/__tests__/competitor-detector.test.ts` — 20+ tests

**Step 2: Full build**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run build 2>&1 | tail -20
```

Expected: exits 0 with no TypeScript errors.

**Step 3: Manual smoke test — Stage 2 injection**

With the dev server running (`npm run dev`), navigate to `http://localhost:3000/journey`. Answer the first two chip questions (businessModel, industry) so Stage 1 context is established. Then type into the chat:

> "My main competitor is PagerDuty"

In the browser network tab, inspect the POST to `/api/journey/stream`. The request body's reconstructed system prompt (visible in server logs) should contain the Stage 2 Directive addendum. The model's response should call `competitorFastHits` as its first action.

**Step 4: Manual smoke test — Strategist Mode guard**

To test the Strategist Mode guard without running the full pipeline, temporarily add a fake `synthesizeResearch` output-available part to the messages in `journey/page.tsx` (or test via a direct POST with crafted messages). Confirm that `synthComplete: true` causes the Strategist Mode addendum to appear in the system prompt and the model does not call `askUser`.

**Step 5: Final commit if any loose files**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && git status
```

If clean, no commit needed. If any stray changes, commit them:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main && git add -A && git commit -m "$(cat <<'EOF'
chore: agent intelligence enforcement complete — state tracker, competitor detector, route guards

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Implementation Order Summary

| Task | What | New Files | Key Acceptance Criterion |
|------|------|-----------|--------------------------|
| 1 | Journey state tracker | `journey-state.ts`, `journey-state.test.ts` | 12 tests green; `shouldFireStage1` is true iff both businessModel + industry collected |
| 2 | Competitor detector | `competitor-detector.ts`, `competitor-detector.test.ts` | 20 tests green; null for "I don't know competitors"; domain extracted from URLs and phrases |
| 3 | History guard (re-trigger prevention) | Modify above two files | `competitorFastHitsCalledFor` tracks in-flight and completed calls |
| 4 | Wire into route.ts | Modify `route.ts` | Stage 2 directive injected for new competitor mentions; Strategist Mode guard injected after synthesis |
| 5 | System prompt precision | Modify `lead-agent-system.ts` | Stage 1 trigger tied to `askUser` result for `industry`; Stage 2 includes explicit re-trigger guard |
| 6 | Full verification | None | All tests pass; build exits 0; manual smoke tests confirm Stage 2 call and Strategist Mode suppression |

## What This Does NOT Cover

These are intentionally out of scope for this sprint:

- **Thinking block exposure in UI** — `thinking` provider option is already enabled with 5000-token budget, but the streaming UI does not render thinking blocks. That is a separate frontend sprint.
- **Reliability of research tool triggers** — the route does not yet inject explicit directives for `researchIndustry` triggering (Stage 3 entry). The system prompt guides this but there is no deterministic enforcement. Covered by a future reliability sprint.
- **Stage 1 hot-take tracking** — the plan does not persist a `hotTakeDelivered` flag because the system prompt instructs the model to deliver it exactly once (after receiving the `industry` tool result). Adding a Supabase flag for this is premature optimisation — address if the model over-delivers hot-takes in production testing.
- **Multiple competitor handling** — `detectCompetitorMentions` returns the first match only. Handling "my competitors are HubSpot, Salesforce, and Marketo" with three sequential `competitorFastHits` calls requires a loop in route.ts and is a follow-on task.
