# AI-GOS /journey Live Artifact Streaming Fix Plan

> **For Codex / specialist agents:** This is the next implementation pass after commit `859f0ae9 Verify journey deep research stream`. Do not repeat the log-only patch. Implement the real Vercel AI SDK / ai-chatbot-style artifact stream behavior.

**Goal:** When the user enters `research airtable.com`, `/journey` should show Deep Research Agent first, but the primary visible surface must be a live GTM research artifact/report that starts writing immediately and grows section-by-section while compact logs/tool activity remain secondary.

**Architecture:** Copy the proven Vercel `ai-chatbot` pattern: unified stream carries assistant text, tool/log events, and typed `data-*` artifact deltas. If full AI SDK stream bridging is too large for one pass, implement a compatible interim event contract through persisted worker progress using explicit `artifact-draft` events, not log-string hacks. The UI should maintain artifact state independently from logs and render it above/pinned beside the log rows.

**Grounding references:**

- Vercel AI SDK stream protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- Vercel AI SDK streaming custom data: https://ai-sdk.dev/docs/ai-sdk-ui/streaming-custom-data
- Vercel AI SDK chatbot tool usage: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage
- Vercel ai-chatbot repo: https://github.com/vercel/ai-chatbot
- Strong repo files/patterns:
  - `app/(chat)/api/chat/route.ts` — `createUIMessageStream`, merge `streamText().toUIMessageStream()`
  - `lib/ai/tools/create-document.ts` — tool writes artifact lifecycle data parts
  - `artifacts/text/server.ts` — appends `data-textDelta` while model streams
  - `hooks/use-active-chat.tsx` — `useChat({ onData })` captures transient stream parts
  - `components/chat/data-stream-handler.tsx` — stream events mutate artifact state
  - `artifacts/text/client.tsx` — `content += streamPart.data`

---

## Current failure observed in live QA

User saw:

1. Deep Research Agent started.
2. Logs/tool rows appeared.
3. No obvious live report/artifact was being written.
4. The next section started automatically before the user saw the current section authored in the same sequential narrative.

This means the previous GREEN tests were necessary but insufficient: they proved the UI can render mocked `draft ...` chunks, not that the real worker/UI architecture behaves like ChatGPT/Claude/Cursor/Vercel artifacts.

---

## Root causes to fix

### Root cause 1: artifact rendering depends on log messages starting with `draft `

File:

- `src/lib/journey/research-stream-buffer.ts`

Current extraction logic only turns activity into artifact content if:

```ts
update.phase === 'analysis' && update.message.startsWith('draft ')
```

This is not a real artifact stream. Logs can stream forever while artifact stays empty.

### Root cause 2: Deep Research phase is not treated as first artifact authoring phase

The artifact should start during `deepResearchProgram`, not only after `industryMarket` starts. Deep Research should create the first visible report scaffold/content:

```md
# Airtable GTM Research

## Deep Research Notes
...
```

### Root cause 3: report artifact is below/after log rows

File:

- `src/components/journey/journey-agent-chat.tsx`

Current layout puts the report block after the assistant/log card. It needs to be primary: above logs, pinned in the central thread, or a clear main artifact area with logs secondary/collapsible.

### Root cause 4: section auto-start is product-ambiguous

File:

- `src/app/journey/page.tsx`

The code auto-queues downstream sections. Backend parallelism is okay, but foreground UX must present one section at a time. If next sections auto-start, they must be visually hidden/buffered until the current artifact section has visibly appeared/completed.

---

## Required product behavior

For `research airtable.com`:

```text
User bubble:
research airtable.com

Assistant visible first:
Deep Research Agent

Primary artifact appears immediately:
# Airtable GTM Research

Deep Research Agent is building the source-backed corpus...
[paragraphs/outline begin writing here]

Secondary logs:
Searching Airtable pricing...
Reading product page...
Extracting positioning claims...
```

Then sequentially:

```text
Market Category Agent
→ artifact expands with ## Market Category
→ logs remain secondary

Buyer / ICP Agent
→ artifact expands with ## Buyer / ICP
→ logs remain secondary
```

Do **not** show this as the primary experience:

```text
Opened page...
Read page...
Synthesizing...
Market Agent started...
```

without a report being visibly authored.

---

## Implementation plan

### Task 0: Preserve clean repo state before editing

Run:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git status --short
```

There may be unrelated untracked dirt. Do not clean unrelated files. Only edit files required for this slice.

### Task 1: Add an explicit artifact event contract

**Objective:** Stop deriving artifact content from generic log strings.

Likely files:

- Modify: `src/lib/journey/research-stream-buffer.ts`
- Modify or create: `src/lib/journey/research-artifact-events.ts`
- Modify worker types if needed: `research-worker/src/contracts.ts` or relevant progress types

Add a typed event shape equivalent to AI SDK custom data parts:

```ts
export type JourneyArtifactEvent =
  | {
      type: 'artifact-clear';
      runId: string;
      section: string;
      title?: string;
      at: string;
    }
  | {
      type: 'artifact-delta';
      runId: string;
      section: string;
      delta: string;
      at: string;
    }
  | {
      type: 'artifact-section-state';
      runId: string;
      section: string;
      status: 'queued' | 'researching' | 'drafting' | 'citing' | 'complete' | 'partial' | 'error';
      at: string;
    }
  | {
      type: 'artifact-finish';
      runId: string;
      section: string;
      at: string;
    };
```

If the current persistence layer only supports `phase/message/meta`, encode it safely as:

```ts
{
  phase: 'artifact',
  message: delta,
  meta: {
    eventType: 'artifact-delta',
    section,
    title,
  }
}
```

Keep backward compatibility with existing `draft ` logs temporarily, but new tests should prove the typed event path.

### Task 2: Emit artifact events from the worker, not only logs

**Objective:** Real worker output must produce live report content.

Likely files:

- Modify: `research-worker/src/runner.ts`
- Modify: `research-worker/src/runners/deep-research-program.ts`
- Modify: `research-worker/src/runners/journey-section-synthesis.ts`
- Modify: `research-worker/src/index.ts` if progress writing needs meta support

Minimum viable approach:

1. When Deep Research starts, emit artifact clear/title/scaffold:

```text
# {Company} GTM Research

## Deep Research
```

2. During streamed model text, emit meaningful deltas as `artifact-delta`.

3. Extend extraction beyond `verdict/statusSummary` to section schemas:

- `sectionTitle`
- `verdict`
- `statusSummary`
- `keyFindings[].title/detail/evidence`
- `evidenceQuotes[].quote/interpretation/sourceUrl`
- `recommendedMoves[]`
- `risksOrGaps[]`

Better approach if possible:

- Use AI SDK/Vercel `createUIMessageStream` for `/api/journey/stream` and write `data-journey-artifact-delta` directly, similar to Vercel `ai-chatbot` `data-textDelta`.

Do not call logs artifact content. Logs and artifact deltas are separate event types.

### Task 3: Build artifact state independent from visible log steps

**Objective:** UI artifact should exist even while logs are still streaming.

Likely files:

- Modify: `src/lib/journey/research-stream-buffer.ts`
- Modify or create: `src/lib/journey/research-artifact-state.ts`

Create a reducer-style builder:

```ts
buildJourneyArtifactState({
  activeRunId,
  researchActivity,
  researchResults,
  activeResearchSections,
})
```

It should return:

```ts
{
  title: string;
  status: 'idle' | 'streaming' | 'partial' | 'complete' | 'error';
  activeSection: string | null;
  sections: Array<{
    section: string;
    title: string;
    content: string;
    status: 'queued' | 'researching' | 'drafting' | 'complete' | 'partial' | 'error';
    sourceUrls: string[];
  }>;
}
```

Rules:

- `deepResearchProgram` can and should produce the first artifact section.
- Completed `researchResults[section].data` can hydrate/replace final section content.
- Typed artifact deltas append in timestamp order.
- Generic logs do not become artifact content.
- Backward `draft ` updates may remain as fallback only.

### Task 4: Make artifact primary in `JourneyAgentChat`

**Objective:** Product should look like the thing is being written, not like logs only.

File:

- Modify: `src/components/journey/journey-agent-chat.tsx`

Change render order to:

```tsx
user command
assistant opening / Deep Research Agent identity
<LiveJourneyArtifact />   // primary, immediately visible
<CompactAgentActivity />  // secondary/collapsible logs
chat messages
```

Or two-column responsive layout:

```text
Main: Live artifact
Bottom/side: compact activity trace
```

The artifact should show a skeleton immediately:

```text
Live GTM Research Artifact
# Airtable GTM Research
Deep Research Agent is building the source-backed corpus...
```

Even before first delta, it should not look blank.

### Task 5: Fix one-section-at-a-time foreground presentation

**Objective:** Backend jobs can run, but visible authored sections must appear sequentially.

Likely files:

- Modify: `src/lib/journey/research-stream-buffer.ts`
- Modify: `src/app/journey/page.tsx` if gating is required

Options:

A. Keep backend auto-start but buffer/hide future sections:

```text
Current artifact section: visible/writing
Future section running: hidden or tiny "queued behind current section"
```

B. Add foreground approval gate after each section:

```text
Section complete → user clicks Continue → next section becomes active
```

For now, prefer A unless user explicitly asks for manual approval. The key is: no visual jumping ahead. The artifact should present sections in canonical order.

### Task 6: Add product-level tests that fail on the current bug

**Objective:** Catch the exact QA failure.

Likely files:

- Modify: `src/app/journey/__tests__/page.test.tsx`
- Modify: `src/components/journey/__tests__/journey-manus-welcome.test.tsx`
- Add/modify: `src/lib/journey/__tests__/research-artifact-state.test.ts`
- Add worker test if feasible under `research-worker/src/**/__tests__`

Required tests:

1. Deep Research activity with typed `artifact-delta` renders a visible artifact before any specialist starts.
2. Generic log-only activity does not count as artifact content, but the artifact skeleton still appears.
3. Artifact is rendered before / above compact activity rows in DOM order.
4. `deepResearchProgram` can produce a report block/artifact section.
5. Section job can run in backend but remains hidden from foreground artifact until previous section is visible/complete.
6. Completed section result hydrates final artifact content with sources/citations.
7. No `profile fields`, `fieldCount`, `fields extracted` copy returns.
8. No skipped tests in changed Journey tests.

### Task 7: Verification commands

Run:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS

npm run test:run -- --run \
  src/app/journey/__tests__/page.test.tsx \
  src/components/journey/__tests__/journey-manus-welcome.test.tsx \
  src/components/journey/__tests__/prefill-stream-view.test.tsx \
  src/lib/journey/__tests__/research-command.test.ts \
  src/lib/journey/__tests__/research-stream-buffer.test.ts

npm run lint

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZHVtbXkuY2xlcmsuYWNjb3VudHMuZGV2JA \
CLERK_SECRET_KEY=sk_test_dummy \
RAILWAY_WORKER_URL=http://localhost:3001 \
npm run build
```

Anti-fake gates:

```bash
! grep -R "describe.skip\|it.skip\|test.skip\|\.only" -n \
  src/app/journey/__tests__/page.test.tsx \
  src/components/journey/__tests__/journey-manus-welcome.test.tsx \
  src/lib/journey/__tests__ || exit 1

! grep -R "profile fields\|fieldCount\|fields extracted" -n \
  src/app/journey src/components/journey || exit 1
```

Manual QA:

```text
1. Open /journey.
2. Submit: research airtable.com.
3. First assistant-visible output is Deep Research Agent.
4. A visible Live GTM Research Artifact appears immediately.
5. Logs/tool rows are visible but secondary/collapsible.
6. Artifact starts with title/scaffold, then grows with real text.
7. Next sections do not visually overtake the current section.
8. Refresh mid-run reconstructs artifact + active section + logs.
```

---

## Codex prompt

Use this exact prompt for the next Codex implementation pass:

```text
You are Codex working in /Users/ammar/Dev-Projects/AI-GOS on branch rescue/deep-research-six-cards.

Read first:
- AGENTS.md and CLAUDE.md if present
- docs/journey-live-artifact-streaming-fix-plan-2026-05-07.md
- docs/journey-deep-research-agent-streaming-handoff-2026-05-07.html

Context:
Commit 859f0ae9 made /journey tests green for Deep Research first, hidden specialists, buffering, and profile-field copy removal. Live QA still failed the intended product behavior: the user saw Deep Research logs but no primary live artifact/report being authored, then the next section auto-started. This means the previous implementation is log/status-row green but not artifact-product green.

Mission:
Implement Vercel ai-chatbot-style live artifact streaming for /journey. Logs/tool events must be secondary. The GTM research artifact/report must be primary and visibly start writing during Deep Research, then expand section-by-section.

Grounding:
Follow the Vercel AI SDK / ai-chatbot pattern:
- unified stream or compatible typed persisted events
- assistant text/tool/log events separate from artifact deltas
- artifact state appends deltas like ai-chatbot `data-textDelta`
- render artifact as first-class surface, not buried below logs

Non-goals:
- Do not turn /journey into a dashboard/canvas/workspace-heavy interface.
- Do not add external research APIs.
- Do not expose profile field counts.
- Do not merely add more tests around mocked `draft ...` log strings.
- Do not make generic logs count as artifact content.

Acceptance gates:
1. `research airtable.com` first visible assistant output remains Deep Research Agent.
2. A Live GTM Research Artifact appears immediately after the Deep Research opening, before/above compact logs.
3. Deep Research itself can write the first artifact section.
4. Real/typed artifact delta events append to artifact state independently from logs.
5. Generic source/tool logs remain visible but secondary/collapsible and do not become report prose.
6. GTM specialist sections append to the same artifact sequentially in canonical order.
7. Backend can queue/run future jobs, but foreground artifact does not visually jump ahead.
8. Refresh reconstructs artifact content, active section, visible completed sections, buffered future sections, and logs.
9. Tests fail on the current log-only artifact bug and pass after implementation.
10. No skipped/only tests and no profile-field/count copy.

Workflow:
- First inspect the relevant files and write a short implementation plan.
- Use TDD: add failing tests for the exact live QA failure.
- Implement the smallest end-to-end slice.
- Run targeted tests, lint, and build with dummy Clerk env.
- Return changed files, commands, exit codes, and unresolved risks.
```

---

## Expected final commit shape

Suggested commit title:

```text
Implement journey live artifact stream surface
```

Changed files will likely include:

```text
src/lib/journey/research-artifact-state.ts          # maybe new
src/lib/journey/research-stream-buffer.ts
src/components/journey/journey-agent-chat.tsx
src/app/journey/page.tsx
src/app/journey/__tests__/page.test.tsx
src/components/journey/__tests__/journey-manus-welcome.test.tsx
research-worker/src/runner.ts
research-worker/src/runners/deep-research-program.ts
research-worker/src/runners/journey-section-synthesis.ts
research-worker/src/**/__tests__/*                  # if worker tests exist/needed
```

Do not overbroaden. The key is one visible artifact stream path from worker event → state builder → Journey UI.
