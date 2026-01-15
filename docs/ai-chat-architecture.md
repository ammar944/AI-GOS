# AI Chat Architecture

This document provides a comprehensive overview of the AI chat functionality, including multi-agent architecture, intent routing, RAG infrastructure, and the edit/explain workflow.

---

## Table of Contents

1. [Overview](#overview)
2. [Chat Architecture](#chat-architecture)
3. [Intent Routing](#intent-routing)
4. [Specialized Agents](#specialized-agents)
5. [RAG Infrastructure](#rag-infrastructure)
6. [Edit Workflow](#edit-workflow)
7. [UI Components](#ui-components)
8. [API Reference](#api-reference)

---

## Overview

The Blueprint Chat implements a **multi-agent chat system** with three architectural patterns:

| Pattern | Endpoint | Storage | Use Case |
|---------|----------|---------|----------|
| Session-based | `/api/chat/blueprint` | Client-side | Lightweight, immediate |
| DB-backed | `/api/blueprint/[id]/chat` | Supabase | Persistent, RAG-enabled |
| Session UI | `BlueprintChat.tsx` | React state | Floating widget |

### Key Features

- **Intent Classification** - Routes messages to appropriate agents
- **Multi-Agent Routing** - Q&A, Edit, Explain, General handlers
- **RAG Retrieval** - Semantic search over embedded blueprint chunks
- **Edit Proposals** - Diff preview with approve/reject workflow
- **Cross-Section Explanations** - Shows related factors from other sections

---

## Chat Architecture

### Message Flow

```
User Types Message
       ↓
handleSubmit() [blueprint-chat.tsx]
       ↓
POST /api/chat/blueprint
├─ message: string
├─ blueprint: full object
└─ chatHistory: last 6-8 messages
       ↓
Intent Classification (Claude Sonnet, temp=0)
       ↓
Route to Agent
├─ question → QA Agent
├─ edit → Edit Agent
├─ explain → Explain Agent
└─ general → Direct response
       ↓
AI Response + Optional Actions
├─ response text
├─ pendingEdits (if applicable)
├─ relatedFactors (if explanation)
└─ confidence level
       ↓
ChatMessage Component Renders
├─ avatar + role
├─ styled content
├─ sources (Q&A)
├─ related factors (explain)
└─ edit confirmation UI
```

### Message Structure

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  confidence?: 'high' | 'medium' | 'low';
  isEditProposal?: boolean;
}

interface PendingEdit {
  section: BlueprintSection;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
}

interface RelatedFactor {
  section: string;
  factor: string;
  relevance: string;
}
```

---

## Intent Routing

### Intent Types

**File:** `src/lib/chat/intent-router.ts`

```typescript
type ChatIntent =
  | QuestionIntent    // "What are competitors?"
  | EditIntent        // "Change positioning to X"
  | ExplainIntent     // "Why was X scored low?"
  | RegenerateIntent  // "Regenerate section with focus on Y"
  | GeneralIntent     // "Hello", unclear requests
```

### Classification

- **Model:** Claude Sonnet at temperature 0
- **Output:** JSON with intent type + relevant fields
- **Validation:** Converts snake_case to camelCase

### Recognition Patterns

| Intent | Trigger Phrases |
|--------|-----------------|
| Question | "What, who, how many, describe" |
| Edit | "Change, update, modify, fix" |
| Explain | "Why, explain, reasoning, how come" |
| Regenerate | "Redo, regenerate, rewrite" |

---

## Specialized Agents

### QA Agent

**File:** `src/lib/chat/agents/qa-agent.ts`

**Purpose:** Answer questions using RAG-retrieved context

```typescript
interface QAAgentInput {
  query: string;
  chunks: BlueprintChunk[];
  chatHistory: Message[];
}

interface QAAgentOutput {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources: ChunkReference[];
}
```

**Process:**
1. Build context string from chunks with similarity scores
2. Send to Claude Sonnet (temp=0.3, max 1024 tokens)
3. Calculate confidence from average similarity

**Confidence Calculation:**
```typescript
avgSimilarity > 0.85 ? 'high' :
avgSimilarity > 0.70 ? 'medium' : 'low'
```

### Edit Agent

**File:** `src/lib/chat/agents/edit-agent.ts`

**Purpose:** Interpret edit requests and generate proposed changes

```typescript
interface EditAgentInput {
  fullSection: unknown;
  intent: EditIntent;
  chatHistory: Message[];
}

interface EditAgentOutput {
  edits: PendingEdit[];
  requiresConfirmation: true;
}
```

**Process:**
1. Send full section data + edit request
2. AI returns fieldPath, oldValue, newValue, explanation
3. Validate oldValue against actual data
4. Generate diff preview

**Field Path Examples:**
```
"recommendedPositioning"           → Top-level string
"painPoints.primary[0]"            → Array element
"competitors[0].positioning"       → Nested in array
"offerStrength.differentiation"    → Dot notation
```

### Explain Agent

**File:** `src/lib/chat/agents/explain-agent.ts`

**Purpose:** Explain WHY with cross-section reasoning

```typescript
interface ExplainAgentInput {
  fullBlueprint: StrategicBlueprintOutput;
  intent: ExplainIntent;
  chatHistory: Message[];
}

interface ExplainAgentOutput {
  explanation: string;
  relatedFactors: RelatedFactor[];
  confidence: 'high' | 'medium' | 'low';
}
```

**Cross-Section Connections:**
- Industry pain points → ICP pain-solution fit → Messaging angles
- Competitor weaknesses → Competitive gaps → Positioning
- Psychological drivers → Messaging opportunities → Messaging angles

---

## RAG Infrastructure

### Chunking Strategy

**File:** `src/lib/chat/chunking.ts`

**Semantic Chunking by Section:**

| Section | Chunk Strategy | ~Count |
|---------|---------------|--------|
| Industry & Market | Individual pain points, drivers, objections | 12-15 |
| ICP Analysis | One chunk per subsection | 6 |
| Offer Analysis | Individual scores + sections | 10 |
| Competitor Analysis | Each competitor as unit + patterns | 10+ |
| Cross-Analysis | Individual insights, platforms | 10 |

**Total:** ~60-80 chunks per blueprint

### Embedding Service

**File:** `src/lib/chat/embeddings.ts`

```typescript
// Model: openai/text-embedding-3-small via OpenRouter
// Batch: Up to 128 texts per call
// Storage: Supabase blueprint_chunks table

interface ChunkInput {
  blueprintId: string;
  section: BlueprintSection;
  fieldPath: string;
  content: string;
  contentType: 'text' | 'array' | 'object';
  metadata?: Record<string, unknown>;
}
```

### Retrieval

**File:** `src/lib/chat/retrieval.ts`

```typescript
// Vector similarity search via Supabase RPC
// Threshold: 0.7 (default)
// Limit: 5 chunks (default)

const chunks = await matchBluprintChunks(query, {
  blueprintId,
  threshold: 0.7,
  limit: 5
});
```

**Context Format:**
```
[1] {sectionTitle} - {field} (relevance: 92%):
{chunk content}

[2] {sectionTitle} - {field} (relevance: 87%):
{chunk content}
```

---

## Edit Workflow

### State Management

```typescript
// In BlueprintChat component
const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
const [isConfirming, setIsConfirming] = useState(false);
```

### UI Flow

```
Edit Response Received
       ↓
Show Edit Confirmation Panel
├─ Section / Field Path
├─ Diff Preview (old vs new)
├─ Approve / Reject buttons
└─ Bulk actions (if multiple)
       ↓
User Approves
       ↓
applyEdits()
├─ Deep clone blueprint
├─ Navigate field path
├─ Set new value
├─ Call onBlueprintUpdate()
       ↓
(Optional) Persist to DB
├─ POST /api/blueprint/[id]/confirm-edit
├─ Re-chunk affected section
├─ Generate new embeddings
└─ Update version history
```

### Edit Application Logic

```typescript
function applyEdits(blueprint, edits) {
  // Deep clone for immutability
  const result = JSON.parse(JSON.stringify(blueprint));

  for (const edit of edits) {
    // Parse path with array support
    const pathParts = edit.fieldPath.split('.')
      .flatMap(part => {
        const match = part.match(/^(.+)\[(\d+)\]$/);
        return match ? [match[1], parseInt(match[2])] : [part];
      });

    // Navigate and set
    let current = result[edit.section];
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }
    current[pathParts[pathParts.length - 1]] = edit.newValue;
  }

  return result;
}
```

### Multi-Edit Scenarios

Common patterns that propose multiple edits together:

| Request | Affected Fields |
|---------|-----------------|
| "Rebrand to focus on X" | positioning + messaging angles + pain points |
| "Change target audience" | ICP fields + messaging + competitive gaps |
| "Emphasize feature Y" | positioning + messaging + offer analysis |
| "Add competitor Z" | competitors array + gaps analysis |

---

## UI Components

### BlueprintChat

**File:** `src/components/chat/blueprint-chat.tsx`

**State:**
```typescript
messages[]        // Chat history
input             // Current input
isLoading         // API call state
isOpen            // Widget visibility
pendingEdits[]    // Proposed changes
isConfirming      // Bulk action lock
```

**Key Methods:**
- `handleSubmit()` - Send message to API
- `handleConfirmAll()` - Apply all pending edits
- `handleCancelAll()` - Discard all pending edits
- `handleApproveSingle()` - Apply individual edit
- `handleRejectSingle()` - Discard individual edit

### ChatMessage

**File:** `src/components/chat/chat-message.tsx`

**Features:**
- Role-based avatars (User/Assistant/Edit/Explain)
- Markdown rendering
- Subscript references ([1], [2]) in blue
- Sources display with similarity %
- Related factors for explanations
- Confidence badges (high/medium/low)

**Styling by Type:**
```
User messages     → Light gray background
Assist messages   → Default background
Edit proposals    → Amber border + pencil icon
Explanations      → Blue border + lightbulb icon
Loading           → Animated dots
```

---

## API Reference

### POST `/api/chat/blueprint`

**Session-based chat (main endpoint)**

```typescript
// Request
{
  message: string;
  blueprint: Record<string, unknown>;
  chatHistory?: Message[];
}

// Response
{
  response: string;
  confidence: 'high' | 'medium' | 'low';
  pendingEdit?: PendingEdit;
  pendingEdits?: PendingEdit[];
  relatedFactors?: RelatedFactor[];
  isExplanation?: boolean;
  metadata: {
    tokensUsed: number;
    cost: number;
    processingTime: number;
  }
}
```

### POST `/api/blueprint/[id]/chat`

**DB-backed chat with intent routing**

```typescript
// Request
{
  message: string;
  chatHistory?: Message[];
}

// Response
{
  response: string;
  intent: ChatIntent;
  sources?: ChunkReference[];
  pendingEdits?: PendingEdit[];
  metadata: { ... }
}
```

### POST `/api/blueprint/[id]/confirm-edit`

**Persist confirmed edits to database**

```typescript
// Request
{
  edits: PendingEdit[];
}

// Response
{
  success: boolean;
  newVersion: number;
  updatedBlueprint: StrategicBlueprintOutput;
}
```

---

## Configuration

### Temperature Settings

| Agent | Temperature | Rationale |
|-------|-------------|-----------|
| Intent classification | 0.0 | Deterministic |
| Edit agent | 0.2 | Precise edits |
| Q&A agent | 0.3 | Consistent, factual |
| Explain agent | 0.3 | Informative |
| General chat | 0.7 | Natural |

### Token Limits

| Context | Limit |
|---------|-------|
| Chat history | 6-8 messages |
| Q&A response | 1024 tokens |
| Edit response | 2048 tokens |

### Error Handling

- JSON extraction: 8-strategy fallback
- Retry: Exponential backoff for 429/5xx
- Validation: oldValue verification before apply

---

## File Reference

| Component | Location |
|-----------|----------|
| Chat widget | `src/components/chat/blueprint-chat.tsx` |
| Message renderer | `src/components/chat/chat-message.tsx` |
| Session API | `src/app/api/chat/blueprint/route.ts` |
| DB API | `src/app/api/blueprint/[id]/chat/route.ts` |
| Confirm API | `src/app/api/blueprint/[id]/confirm-edit/route.ts` |
| Intent router | `src/lib/chat/intent-router.ts` |
| QA agent | `src/lib/chat/agents/qa-agent.ts` |
| Edit agent | `src/lib/chat/agents/edit-agent.ts` |
| Explain agent | `src/lib/chat/agents/explain-agent.ts` |
| Chunking | `src/lib/chat/chunking.ts` |
| Embeddings | `src/lib/chat/embeddings.ts` |
| Retrieval | `src/lib/chat/retrieval.ts` |
| Types | `src/lib/chat/types.ts` |
