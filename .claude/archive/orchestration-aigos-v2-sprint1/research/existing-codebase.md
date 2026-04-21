# Existing Codebase Architecture Research

**Researcher**: Architecture Agent
**Date**: 2026-02-27
**Purpose**: Document exact patterns for AI-GOS v2 Sprint 1 journey page implementation

---

## 1. Chat Implementation Pattern (the pattern to follow)

### 1.1 API Route: `/api/chat/agent/route.ts`

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/app/api/chat/agent/route.ts`

**Key pattern**: Uses Vercel AI SDK v6 `streamText` + `toUIMessageStreamResponse()`.

```typescript
// Imports
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { groq, GROQ_CHAT_MODEL } from '@/lib/ai/groq-provider';

export const maxDuration = 120;

// Request typing
interface AgentChatRequest {
  messages: UIMessage[];
  blueprintId: string;
  blueprint: Record<string, unknown>;
  conversationId?: string;
}

export async function POST(request: Request) {
  // 1. Auth check with Clerk
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Parse body
  const body: AgentChatRequest = await request.json();

  // 3. Validate required fields
  if (!body.messages || !body.blueprint) {
    return new Response(
      JSON.stringify({ error: 'messages and blueprint are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Build system prompt
  const systemPrompt = buildSystemPrompt(body.blueprint);

  // 5. Sanitize messages (strip incomplete tool parts to prevent MissingToolResultsError)
  const INCOMPLETE_TOOL_STATES = new Set([
    'input-streaming',
    'input-available',
    'approval-requested',
  ]);
  const sanitizedMessages = body.messages.map((msg) => ({
    ...msg,
    parts: msg.parts.filter((part) => {
      if (typeof part === 'object' && 'type' in part && typeof part.type === 'string' &&
          part.type.startsWith('tool-') && part.type !== 'tool-invocation') {
        const state = (part as Record<string, unknown>).state as string | undefined;
        if (state && INCOMPLETE_TOOL_STATES.has(state)) {
          return false;
        }
      }
      return true;
    }),
  })) as UIMessage[];

  // 6. streamText call
  const result = streamText({
    model: groq(GROQ_CHAT_MODEL),  // Currently Llama 3.3 70B via Groq
    system: systemPrompt,
    messages: await convertToModelMessages(sanitizedMessages), // ASYNC!
    tools,
    prepareStep: ({ steps }) => { /* ... */ },
    stopWhen: stepCountIs(10),
    temperature: 0.3,
    onFinish: async ({ text, totalUsage, steps }) => { /* persistence */ },
  });

  // 7. Return streaming response
  return result.toUIMessageStreamResponse();
}
```

**Critical patterns for v2**:
- `convertToModelMessages()` is **async** — must `await` it
- `toUIMessageStreamResponse()` is the response format (pairs with `DefaultChatTransport` on frontend)
- Messages are sanitized before conversion to prevent `MissingToolResultsError`
- `maxDuration = 120` for Vercel Pro (PRD says 300 for journey)

### 1.2 Frontend: `agent-chat.tsx`

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/components/chat/agent-chat.tsx`

**Transport setup** — the most critical pattern:

```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';

// Transport is memoized and recreated when deps change
const transport = useMemo(
  () =>
    new DefaultChatTransport({
      api: '/api/chat/agent',
      body: {
        blueprintId: blueprintId || '',
        blueprint,
        conversationId,
      },
    }),
  [blueprint, blueprintId, conversationId]
);

const {
  messages,
  sendMessage,
  addToolApprovalResponse,
  status,
  error,
  stop,
  setMessages,
} = useChat({
  transport,
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  onError: (err) => { /* error handling */ },
});
```

**For v2 /journey**, the transport pattern will be simpler (no blueprint body, no tool approvals initially):

```typescript
// Simplified for Sprint 1:
const transport = useMemo(
  () => new DefaultChatTransport({
    api: '/api/journey/stream',
  }),
  []
);

const { messages, sendMessage, status, error, stop } = useChat({ transport });
```

**Status values** used:
- `status === 'streaming'` — tokens arriving
- `status === 'submitted'` — request sent, waiting for first token
- `status === 'ready'` — idle, ready for input

**Message sending pattern**:
```typescript
const handleSubmit = useCallback(
  (content: string) => {
    if (!content || isLoading) return;
    sendMessage({ text: content });
  },
  [isLoading, sendMessage]
);
```

### 1.3 Chat Input: `chat-input.tsx`

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/components/chat/chat-input.tsx`

**Props interface pattern** (suffix with `Props`):

```typescript
interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}
```

**Named export** (not default):
```typescript
export function ChatInput({ onSubmit, isLoading, ... }: ChatInputProps) {
```

**Auto-resize textarea pattern**:
```typescript
const autoResize = useCallback(() => {
  const el = inputRef.current;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
}, []);

useEffect(() => {
  autoResize();
}, [input, autoResize]);
```

**Submit on Enter** (Shift+Enter for newline):
```typescript
if (e.key === 'Enter' && !e.shiftKey) {
  e.preventDefault();
  handleSubmit();
}
```

**Styling approach** — inline `style` for CSS variables, Tailwind for layout:
```tsx
<form
  style={{
    borderRadius: '12px',
    background: 'var(--bg-input)',
    border: `1px solid ${borderColor}`,
    boxShadow,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  }}
>
  <textarea
    className="w-full px-3 pt-2.5 pb-1 text-[13px] outline-none resize-none overflow-y-auto leading-[1.5] bg-transparent scrollbar-hide"
    style={{
      color: 'var(--text-primary)',
      minHeight: '20px',
      maxHeight: '100px',
    }}
  />
```

---

## 2. AI Provider Setup

### 2.1 Provider Configuration

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/lib/ai/providers.ts`

```typescript
import { createPerplexity } from '@ai-sdk/perplexity';
import { createAnthropic } from '@ai-sdk/anthropic';

export const perplexity = createPerplexity({
  apiKey: process.env.PERPLEXITY_API_KEY,
});

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

**For v2 journey**: Use the existing `anthropic` provider instance from `providers.ts`. The PRD specifies `claude-opus-4-6` model. Usage:

```typescript
import { anthropic } from '@/lib/ai/providers';

// In route handler:
const result = streamText({
  model: anthropic('claude-opus-4-6'),
  // ...
});
```

**No Opus model is currently in MODELS constants** — it will need to be added:
```typescript
export const MODELS = {
  // ...existing...
  CLAUDE_OPUS: 'claude-opus-4-6',  // NEW for v2 journey
} as const;
```

### 2.2 Groq Provider (current chat model)

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/lib/ai/groq-provider.ts`

```typescript
import { createGroq } from '@ai-sdk/groq';

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile';
```

**Pattern**: Provider instances are created at module level with API keys from env. Models are string constants exported alongside.

### 2.3 Existing Models & Costs

Currently configured models:
- `sonar-pro` (Perplexity) — research
- `sonar-reasoning-pro` (Perplexity) — reasoning
- `claude-sonnet-4-20250514` (Anthropic) — synthesis
- `claude-haiku-4-5-20251001` (Anthropic) — extraction
- `llama-3.3-70b-versatile` (Groq) — chat agent
- `moonshotai/kimi-k2-instruct-0905` (Groq) — synthesis
- `openai/gpt-oss-20b` (Groq) — extraction

**`claude-opus-4-6` is NOT in the codebase yet.** Must add to MODELS + MODEL_COSTS.

---

## 3. Layout Patterns

### 3.1 Root Layout

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter, Instrument_Sans, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

// Font loading via next/font/google
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${inter.variable} ${instrumentSans.variable} ${geistMono.variable} font-sans antialiased`}
          suppressHydrationWarning
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Key observations for v2**:
- **Fonts**: Inter (body), Instrument Sans (headings), Geist Mono (code). PRD wants DM Sans, Instrument Sans, JetBrains Mono. **DM Sans and JetBrains Mono are NOT currently loaded.** They need to be added to root layout OR a journey-specific layout.
- **IMPORTANT**: Adding fonts to root layout would affect all v1 pages. **Safest approach**: Add DM Sans and JetBrains Mono to a `/journey/layout.tsx` that only affects the journey route.
- **Dark mode**: `className="dark"` is hardcoded on `<html>`.
- **Auth**: `ClerkProvider` wraps everything at the root level.
- **Error boundary**: Global error boundary wraps all children.

### 3.2 Two-Column Layout

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/components/layout/two-column-layout.tsx`

```typescript
interface TwoColumnLayoutProps {
  chatContent: React.ReactNode;
  blueprintContent: React.ReactNode;
  className?: string;
}

export function TwoColumnLayout({
  chatContent,
  blueprintContent,
  className,
}: TwoColumnLayoutProps) {
```

**Pattern**: Accepts `React.ReactNode` slots for content areas. Uses Framer Motion for animated width transitions.

**Desktop**: Chat panel at 340px (expanded) / 48px (minimized), animated via `motion.div`:
```tsx
<motion.div
  animate={{ width: isMinimized ? 48 : 340 }}
  transition={springs.smooth}
  style={{
    borderRight: "1px solid var(--border-default)",
    background: "var(--bg-chat)",
  }}
>
```

**Mobile**: Blueprint fills screen, floating FAB opens full-screen chat overlay.

**For v2 journey layout**: The PRD wants Phase 1 (centered chat ~720px) and Phase 3 (440px chat left + blueprint right). This is a different layout than TwoColumnLayout — we'll create a new `JourneyLayout` component with CSS transitions between centered and split modes.

### 3.3 Page Structure Pattern

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/app/generate/page.tsx`

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
// ...imports

export default function GeneratePage() {
  // Hooks at the top
  const { pageState, setPageState, headerStage } = useGeneratePageState();
  const blueprint = useBlueprintGeneration();
  // ...

  // Handlers
  const handleOnboardingFinish = useCallback(async (data) => { /* ... */ }, []);

  // Render with switch statement
  switch (pageState) {
    case "onboarding":
      return <OnboardingView ... />;
    case "generating-blueprint":
      return <BlueprintGeneratingView ... />;
    // ...
  }
}
```

**Pattern**: `"use client"` directive at top. Default export for page. State machine via switch. Sub-components imported from `_components/` directory.

**For v2 journey page**: Follow the same pattern:
```typescript
"use client";

export default function JourneyPage() {
  // useChat hook + layout state
  // Render centered chat layout
}
```

---

## 4. CSS and Styling System

### 4.1 Tailwind CSS v4 Configuration

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/app/globals.css`

**No `tailwind.config.ts` exists** — Tailwind v4 uses CSS-first configuration via `@theme inline` in globals.css.

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
  --font-heading: var(--font-instrument-sans), "Instrument Sans", sans-serif;
  --font-display: var(--font-instrument-sans), "Cabinet Grotesk", sans-serif;
  --font-mono: var(--font-geist-mono);
  /* ...shadcn/ui color mappings... */
  /* Brand colors */
  --color-brand-navy: var(--brand-navy);
  --color-brand-blue: var(--brand-blue);
  /* etc. */
}
```

**For v2 tokens**: Add new font families and any missing tokens inside the `@theme inline` block. The v2 design system tokens should be added as new CSS variables in the `.dark` section of `:root`, and mapped via `@theme inline`.

### 4.2 Existing CSS Variables (Dark Theme)

All defined in `.dark { }` block:

**Background hierarchy** (7 levels):
```css
--bg-base: rgb(7, 9, 14);           /* Main page */
--bg-elevated: rgb(10, 13, 20);     /* Elevated surfaces */
--bg-surface: rgb(12, 14, 19);      /* Component backgrounds */
--bg-chat: #090b10;                 /* Chat panel */
--bg-input: #0e1017;               /* Input fields */
--bg-hover: rgb(20, 23, 30);        /* Hover states */
--bg-active: rgb(25, 28, 35);       /* Active/pressed */
--bg-card: rgb(12, 14, 19);         /* Cards */
--bg-card-blue: rgba(51, 136, 255, 0.09); /* Blue-tinted cards */
```

**Text hierarchy** (5 tiers):
```css
--text-primary: rgb(252, 252, 250);    /* Headings (warm white) */
--text-secondary: rgb(205, 208, 213);  /* Body text */
--text-tertiary: rgb(100, 105, 115);   /* Labels, captions */
--text-quaternary: rgb(49, 53, 63);    /* Muted (NEARLY INVISIBLE on dark!) */
--text-muted: rgb(32, 35, 45);         /* Very muted */
```

**Border system**:
```css
--border-subtle: rgba(255, 255, 255, 0.08);
--border-default: rgb(31, 31, 31);
--border-hover: rgb(45, 45, 50);
--border-focus: rgb(54, 94, 255);
```

**Accent colors**:
```css
--accent-blue: rgb(54, 94, 255);
--accent-blue-hover: rgb(0, 111, 255);
--accent-cyan: rgb(80, 248, 228);
--accent-green: rgb(34, 197, 94);
--accent-amber: rgb(245, 158, 11);
--accent-purple: rgb(167, 139, 250);
```

**Shadows**:
```css
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.02);
--shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 20px oklch(0.62 0.19 255 / 0.2);
```

**Gradients**:
```css
--gradient-primary: linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%);
```

### 4.3 Utility Classes

Defined in `@layer utilities`:
- `.gradient-primary`, `.gradient-cloud`, `.gradient-accent`, `.gradient-hero`
- `.text-gradient`, `.text-gradient-heading`, `.text-gradient-primary`
- `.glow-sm`, `.glow-md`, `.glow-lg`, `.glow-primary`
- `.glass`, `.glass-strong`
- `.pattern-grid`, `.pattern-dots`, `.pattern-dashed`
- `.animate-float`, `.animate-pulse-glow`, `.animate-gradient`
- `.scrollbar-hide`

**Unlayered classes** (MUST be outside `@layer` for Tailwind v4 specificity):
- `.show-on-card-hover`, `.accent-on-card-hover`
- `.voice-recording-pulse`, `.chat-input-recording`
- `.blueprint-field-highlight`, `.blueprint-field-pending`, `.blueprint-field-approved`
- `.streaming-cursor` (blinking caret for streaming text)
- `.streaming-bubble` (glow on active generation)

### 4.4 `cn()` Utility

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Standard `clsx` + `tailwind-merge` pattern. Use for all conditional class composition.

### 4.5 Styling Approach Summary

The codebase uses a **hybrid approach**:
1. **Tailwind classes** for layout, spacing, sizing (`flex`, `px-4`, `w-full`, `text-sm`)
2. **Inline `style` prop** for CSS variable references (`style={{ color: 'var(--text-primary)' }}`)
3. **CSS classes in globals.css** for complex animations and specificity-sensitive rules
4. **`cn()` utility** for conditional class merging

**IMPORTANT**: CSS variables are NOT mapped to Tailwind utility classes in most cases. Components reference them via inline styles. This is the established pattern — follow it.

---

## 5. Component Patterns

### 5.1 File Naming

All files use **kebab-case**: `agent-chat.tsx`, `chat-input.tsx`, `message-bubble.tsx`, `typing-indicator.tsx`

### 5.2 Named Exports (NOT default)

```typescript
// CORRECT:
export function AgentChat({ ... }: AgentChatProps) { }
export function ChatInput({ ... }: ChatInputProps) { }
export function MessageBubble({ ... }: MessageBubbleProps) { }

// WRONG (never used):
export default function ChatInput() { }
```

Exception: Page components use `export default function PageName()`.

### 5.3 Props Interface Pattern

Always defined as `interface`, suffixed with `Props`, placed directly above the component:

```typescript
interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSubmit,
  isLoading,
  onStop,
  disabled = false,
  placeholder = 'Ask about your blueprint...',
  className,
}: ChatInputProps) {
```

### 5.4 'use client' Directive

All interactive components have `'use client'` (or `"use client"`) at the very top:

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
// ...
```

### 5.5 Import Organization

Standard ordering observed:
1. React hooks
2. Third-party libraries (framer-motion, lucide-react)
3. AI SDK imports (`@ai-sdk/react`, `ai`)
4. Internal components (`@/components/...`)
5. Internal hooks (`@/hooks/...`)
6. Internal lib (`@/lib/...`)
7. Types (last, sometimes inline)

### 5.6 Component Structure

```
src/components/chat/
  agent-chat.tsx          # Main orchestrator (800+ lines)
  chat-input.tsx          # Input component with voice, slash commands
  chat-panel.tsx          # Sliding panel wrapper
  message-bubble.tsx      # Message rendering with markdown
  typing-indicator.tsx    # 3-dot bouncing animation
  tool-loading-indicator.tsx
  edit-approval-card.tsx
  edit-diff-view.tsx
  research-result-card.tsx
  deep-research-card.tsx
  visualization-card.tsx
  comparison-table-card.tsx
  analysis-score-card.tsx
  generate-section-card.tsx
  quick-suggestions.tsx
  follow-up-suggestions.tsx
  thinking-block.tsx
  export-menu.tsx
  branch-indicator.tsx
  shortcuts-help.tsx
  slash-command-palette.tsx
  voice-input-button.tsx
  voice-transcript-preview.tsx
  view-in-blueprint-button.tsx
  citation-hover-card.tsx
  validation-cascade-card.tsx
```

**Pattern**: One component per file. Orchestrator component (`agent-chat.tsx`) imports all sub-components. Sub-components are small and focused.

### 5.7 UI Primitives Available

From `src/components/ui/`:
- `button.tsx` — shadcn Button with CVA variants
- `card.tsx` — Card, CardContent, CardHeader, etc.
- `input.tsx`, `textarea.tsx`, `label.tsx`
- `tooltip.tsx` — Radix tooltip
- `magnetic-button.tsx` — Framer Motion magnetic hover effect
- `gradient-border.tsx` — Animated gradient border wrapper
- `gradient-text.tsx` — Gradient text component
- `glow-card.tsx` — Card with glow effect
- `badge.tsx`, `progress.tsx`, `separator.tsx`
- `select.tsx`, `checkbox.tsx`, `switch.tsx`, `tabs.tsx`
- `dropdown-menu.tsx`, `alert-dialog.tsx`, `collapsible.tsx`
- `logo.tsx`, `sl-background.tsx`, `blob-background.tsx`
- `floating-label-input.tsx`, `floating-label-textarea.tsx`
- `stat-card.tsx`, `score-display.tsx`, `section-divider.tsx`
- `carousel.tsx` — Embla carousel
- `grain.tsx`, `saaslaunch.tsx`, `api-error-display.tsx`

---

## 6. Animation Library

### 6.1 Framer Motion

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/lib/motion.ts`

```typescript
import type { Transition, Variants } from "framer-motion";

export const springs = {
  snappy: { type: "spring", stiffness: 500, damping: 30 },   // buttons, toggles
  smooth: { type: "spring", stiffness: 400, damping: 30 },   // cards, panels
  gentle: { type: "spring", stiffness: 300, damping: 35 },   // page transitions
  bouncy: { type: "spring", stiffness: 400, damping: 15 },   // attention
};

export const easings = {
  out: [0.21, 0.45, 0.27, 0.9],
  inOut: [0.4, 0, 0.2, 1],
  expo: [0.16, 1, 0.3, 1],
};

// Common variants
export const fadeUp: Variants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
export const fadeDown: Variants = { ... };
export const scaleIn: Variants = { ... };
export const staggerContainer: Variants = { animate: { transition: { staggerChildren: 0.1 } } };
export const staggerItem: Variants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

export const durations = {
  fast: 0.15,    // Hover states
  normal: 0.3,   // Standard transitions
  slow: 0.5,     // Panel slides
  slower: 0.8,   // Page transitions
};
```

**Usage in components**:
```tsx
import { motion } from "framer-motion";
import { springs } from "@/lib/motion";

<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ ...springs.smooth, delay }}
>
```

---

## 7. Auth Pattern

### 7.1 Middleware

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/middleware.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/shared/(.*)",
  "/test/(.*)",
  "/blueprint-preview(.*)",
  "/api/blueprints/(.*)",
  "/api/webhooks/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});
```

**For v2**: `/journey` is NOT in the public routes list, so it will be **automatically protected by Clerk**. No middleware changes needed.

### 7.2 Server-side Auth in API Routes

```typescript
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // ... proceed
}
```

---

## 8. Streaming Patterns

### 8.1 Existing Chat Streaming (Vercel AI SDK)

**Backend**: `streamText()` + `.toUIMessageStreamResponse()`
**Frontend**: `useChat()` + `DefaultChatTransport`

These MUST match:
- `toUIMessageStreamResponse()` requires `DefaultChatTransport` on the client
- `toTextStreamResponse()` requires `TextStreamChatTransport` on the client

### 8.2 Existing SSE Streaming (Blueprint Generation)

A separate pattern exists for blueprint generation using raw SSE:

**Backend** emits typed events: `section-start`, `content`, `section-end`, `error`
**Frontend** consumes via `EventSource` or `fetch` + `ReadableStream`

**For v2 Sprint 1**: Use the Vercel AI SDK pattern (`streamText` + `useChat`), NOT raw SSE. The PRD specifies `useChat` integration.

### 8.3 Streaming Cursor CSS

Already exists in globals.css:
```css
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  margin-left: 1px;
  vertical-align: text-bottom;
  background: var(--accent-blue, rgb(54, 94, 255));
  border-radius: 1px;
  animation: streaming-cursor-blink 0.8s step-end infinite;
}
```

The PRD wants the same pattern but the v2 cursor should be an inline block element appended during streaming.

---

## 9. Message Rendering

### 9.1 MessageBubble Component

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/components/chat/message-bubble.tsx`

**User messages**: Right-aligned, bubble with rounded corners (bottom-right notch):
```tsx
<div style={{
  background: "var(--bg-hover, #161616)",
  border: "1px solid var(--border-default, rgba(255, 255, 255, 0.12))",
  borderRadius: "14px 14px 4px 14px",
  color: "var(--text-primary, #ffffff)",
  fontSize: "13.5px",
}}>
```

**Assistant messages**: Left-aligned, no bubble, avatar + content:
```tsx
{/* Avatar */}
<div style={{ background: "linear-gradient(135deg, var(--accent-blue), #006fff)" }}>
  <Sparkles className="w-3 h-3" style={{ color: "#ffffff" }} />
</div>

{/* Content */}
<div style={{ fontSize: "13.5px", lineHeight: "1.65", color: "var(--text-secondary, #a0a0a0)" }}>
  {renderContent(content)}
  {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
</div>
```

**For v2**: The PRD specifies similar patterns:
- User bubble: right-aligned, max-width 85%, --bg-hover, 14px radius with bottom-right notch (matches exactly)
- AI message: left-aligned with 24px gradient avatar, no bubble, --text-secondary body (matches exactly)

### 9.2 TypingIndicator Component

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/components/chat/typing-indicator.tsx`

3 dots using Framer Motion:
```tsx
{[0, 1, 2].map((i) => (
  <motion.div
    key={i}
    animate={{ opacity: [0.3, 0.7, 0.3] }}
    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
    className="w-1.5 h-1.5 rounded-full"
    style={{ background: "var(--text-tertiary, #666666)" }}
  />
))}
```

PRD wants 5px circles with bouncing (not opacity). The v2 version should be a new component in `src/components/journey/`.

---

## 10. Package Dependencies

**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/package.json`

Key dependencies relevant to v2:
```json
{
  "@ai-sdk/anthropic": "^3.0.36",
  "@ai-sdk/react": "^3.0.75",
  "ai": "^6.0.70",
  "framer-motion": "^12.26.1",
  "lucide-react": "^0.561.0",
  "next": "16.0.10",
  "react": "^19.2.3",
  "tailwindcss": "^4",
  "zod": "^4.2.1"
}
```

**Notable**:
- `@anthropic-ai/claude-agent-sdk` is NOT installed. The PRD mentions it, but Open Question Q1/Q2 question whether it's needed. Given the existing `streamText` + `useChat` pattern works well, the sprint should likely continue with the Vercel AI SDK approach.
- `next/font/google` supports DM Sans and JetBrains Mono — no extra packages needed.

---

## 11. File Structure Conventions

### 11.1 Directory Layout

```
src/
  app/
    layout.tsx              # Root layout (ClerkProvider, fonts, globals.css)
    globals.css             # All CSS tokens and utilities
    page.tsx                # Landing page
    generate/
      page.tsx              # "use client" page with state machine
      _components/          # Page-specific sub-components
    api/
      chat/agent/route.ts   # Chat streaming endpoint
      strategic-blueprint/  # Blueprint generation endpoint
  components/
    chat/                   # Chat-related components
    layout/                 # Layout components
    ui/                     # shadcn/ui primitives
    strategic-blueprint/    # Blueprint display components
  hooks/                    # Custom React hooks
  lib/
    ai/                     # AI providers, tools, prompts
    utils.ts                # cn() utility
    motion.ts               # Framer Motion presets
    storage/                # localStorage helpers
  middleware.ts             # Clerk auth middleware
```

### 11.2 New Files for v2 Sprint 1

Following established conventions, the new files should be:
```
src/
  app/
    journey/
      page.tsx              # "use client" journey page
      layout.tsx            # Journey-specific layout (optional, for fonts)
    api/
      journey/
        stream/route.ts     # SSE streaming endpoint
  components/
    journey/
      chat-message.tsx      # v2 message bubbles
      chat-input.tsx        # v2 glassmorphism input
      streaming-cursor.tsx  # Inline blinking cursor
      typing-indicator.tsx  # 3-dot bounce animation
      journey-header.tsx    # Step indicator header
      journey-layout.tsx    # Adaptive centered/split layout
  lib/
    ai/
      lead-agent.ts         # Lead Agent configuration (system prompt, model)
```

---

## 12. Critical Patterns for v2 Implementation

### 12.1 MUST Follow

1. **Named exports** (not default) for all components except pages
2. **Props interfaces** suffixed with `Props`
3. **`'use client'`** directive for all interactive components
4. **`cn()` utility** from `@/lib/utils` for conditional classes
5. **CSS variables via inline `style`** for theme colors (not Tailwind color classes)
6. **`@/*` import alias** — always absolute imports
7. **kebab-case** for all file and directory names
8. **Framer Motion** for animations, using presets from `@/lib/motion`
9. **`DefaultChatTransport`** paired with `toUIMessageStreamResponse()`
10. **`convertToModelMessages()` is async** — must `await`
11. **Clerk `auth()` check** in all API routes

### 12.2 MUST NOT Do

1. Do NOT modify existing v1 routes (`/onboarding`, `/dashboard`, `/generate`)
2. Do NOT add fonts to root layout if they would affect v1 pages (use journey layout)
3. Do NOT use `toTextStreamResponse()` with `DefaultChatTransport` (transport mismatch)
4. Do NOT use `maxTokens` (use `maxOutputTokens` in AI SDK v6)
5. Do NOT use `parameters` in tool definitions (use `inputSchema`)
6. Do NOT reference `--text-quaternary` for readable text (it's nearly invisible)
7. Do NOT put specificity-sensitive styles in `@layer utilities` (Tailwind v4 loses to unlayered CSS)

### 12.3 Open Architecture Decisions

1. **Agent SDK vs Vercel AI SDK**: The PRD mentions `@anthropic-ai/claude-agent-sdk`, but the entire codebase uses Vercel AI SDK. Recommend staying with `streamText` + `@ai-sdk/anthropic` for consistency. The Agent SDK is designed for CLI usage and has no web transport.

2. **Fonts strategy**: Add DM Sans + JetBrains Mono in a `/journey/layout.tsx` to avoid affecting v1 pages. Keep Inter for v1 via root layout.

3. **Token placement**: Add v2-specific CSS variables (e.g., `--v2-*` prefix) in globals.css `.dark` block, and map them in `@theme inline`. This keeps v1 tokens intact.

4. **Session management**: For Sprint 1 (no persistence scope), use browser `localStorage` via existing `src/lib/storage/local-storage.ts` pattern with a `JOURNEY_` key prefix.

5. **Adaptive thinking**: The AI SDK v6 supports `thinking` parameter:
   ```typescript
   streamText({
     model: anthropic('claude-opus-4-6'),
     thinking: { type: "adaptive" },
     // ...
   });
   ```
   This needs verification that `@ai-sdk/anthropic` v3.0.36 supports it.
