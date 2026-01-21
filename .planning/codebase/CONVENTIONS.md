# Coding Conventions

**Analysis Date:** 2026-01-21

## Naming Patterns

**Files:**
- Components: `kebab-case.tsx` (e.g., `message-bubble.tsx`, `chat-panel.tsx`, `blueprint-chat.tsx`)
- Page routes: `page.tsx` or `route.ts` (e.g., `src/app/api/chat/blueprint/route.ts`)
- Utils/helpers: `kebab-case.ts` (e.g., `intent-router.ts`, `circuit-breaker.ts`, `local-storage.ts`)
- Directories: `kebab-case` for feature directories (e.g., `strategic-blueprint/`, `media-plan/`, `onboarding/`)
- Test files: `[name].test.ts` or `[name].integration.test.ts` (e.g., `route.test.ts`, `pipeline.integration.test.ts`)
- Type definition files: `types.ts`, `output-types.ts`, `schemas.ts`

**Functions:**
- camelCase for all functions (e.g., `signInWithGoogle()`, `generateDiffPreview()`, `extractEdits()`)
- Server actions: lowercase, descriptive (e.g., `login()`, `signup()`, `signOut()`)
- Event handlers: `on` prefix (e.g., `onUndo()`, `onClose()`, `onSubmit()`)
- Helper/utility functions: descriptive camelCase (e.g., `createErrorResponse()`, `calculateBackoff()`, `validateSection()`)
- Render functions: prefix with `render` (e.g., `renderContent()`, `renderCodeBlock()`, `renderInlineFormatting()`)

**Variables:**
- camelCase for all variables and constants (e.g., `isOpen`, `chatHistory`, `blueprintSummary`)
- Configuration objects: camelCase (e.g., `undoRedo`, `bubbleStyles`, `iconBgColor`)
- Booleans: `is` or `can` prefix (e.g., `isEditProposal`, `canUndo`, `hasError`, `isDiff`)
- Loop counters: traditional (e.g., `i`, `index`) only in tight loops; otherwise descriptive (e.g., `lineIndex`)
- Query results: `{ data, error }` pattern from APIs

**Types & Interfaces:**
- Interfaces: PascalCase (e.g., `ChatRequest`, `ErrorBoundaryProps`, `LogContext`)
- Types: PascalCase (e.g., `ChatIntent`, `FailureReason`, `SourceQuality`)
- Enums: PascalCase enum name, values in SCREAMING_SNAKE_CASE (e.g., `ErrorCode.TIMEOUT`, `ErrorCode.RATE_LIMITED`)
- Component Props interfaces: suffix with `Props` (e.g., `ErrorBoundaryProps`, `MessageBubbleProps`, `ChatPanelProps`)
- Union types: descriptive string literals (e.g., `'high' | 'medium' | 'low'`)

## Code Style

**Formatting:**
- Tool: ESLint (Next.js flat config)
- Config file: `eslint.config.mjs` at project root
- Indentation: 2 spaces (enforced by ESLint)
- Line length: no strict limit, reasonable for readability
- Semicolons: required on all statements
- Quotes: double quotes preferred (`"`)

**Linting:**
- Tool: ESLint v9
- Extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- TypeScript strict mode: enabled in `tsconfig.json`
- Run command: `npm run lint`
- No separate Prettier config

**TypeScript Configuration:**
- Target: ES2017
- Module: esnext
- Strict: true
- JSX: react-jsx
- Module resolution: bundler
- Path alias: `@/*` → `./src/*`

## Import Organization

**Order (enforced by convention):**
1. External/built-in (React, Next.js, Node)
2. Third-party packages (@radix-ui, framer-motion, lucide-react, zod, clsx)
3. Internal lib imports (`@/lib/...`)
4. Internal component imports (`@/components/...`)
5. Relative imports (same directory, `./*`)
6. Type imports (when needed, use `import type`)

**Path Aliases:**
- `@/lib/` for utilities, services, business logic, schemas
- `@/components/` for React components
- `@/types/` for type definitions (if used)
- Always use absolute imports via `@/` instead of relative `../../../`

**Example Import Block:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import type { ChatIntent } from '@/lib/chat/types';
import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import { cn } from '@/lib/utils';
import { MessageBubble } from '@/components/chat/message-bubble';
import { springs } from '@/lib/motion';
```

## Error Handling

**Structure:**
- Errors use `ErrorCode` enum and `ApiErrorResponse` interface (see `src/lib/errors.ts`)
- Custom error classes: `TimeoutError`, `APIError` (see `src/lib/openrouter/client.ts`)
- Errors include: `code`, `message`, `details`, `retryable` boolean, optional `section` and `completedSections`

**Pattern - Try/Catch:**
```typescript
try {
  const body: ChatRequest = await request.json();
  // operation
} catch (error) {
  console.error('Error context:', error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { error: 'Failed to process', details: message },
    { status: 500 }
  );
}
```

**Error Response Interface:**
```typescript
interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
    retryable: boolean;
    section?: string;
    completedSections?: string[];
  };
}
```

**Retryable Errors:**
- Timeout, rate limiting, circuit open → retryable
- Validation/parse errors → retryable (AI might fix)
- 4xx client errors → not retryable
- 5xx server errors → retryable

## Logging

**Framework:** Structured JSON logging via `src/lib/logger.ts`

**Functions:**
- `logError(context: LogContext, error: Error | string): void` - to console.error
- `logInfo(context: LogContext, message: string): void` - to console.log
- `logWarn(context: LogContext, message: string): void` - to console.warn
- `createLogContext(route: string, method: string): LogContext` - initializer
- `createRequestId(): string` - generates unique ID for tracing

**LogContext Interface:**
```typescript
interface LogContext {
  requestId?: string;           // Unique request ID
  route: string;                // API endpoint
  method: string;               // HTTP method
  timestamp: string;            // ISO timestamp
  duration?: number;            // Processing time ms
  errorCode?: ErrorCode;        // Error classification
  section?: string;             // Blueprint section
  metadata?: Record<string, unknown>;  // Extra data
}
```

**Usage Pattern:**
```typescript
import { createLogContext, logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const context = createLogContext('/api/endpoint', 'POST');

  try {
    // operation
  } catch (error) {
    logError(context, error);
  }
}
```

## Comments

**When to Comment:**
- Complex JSON parsing or regex patterns
- Business logic decisions (why a field is validated certain way)
- Integration with external services (API quirks)
- Known workarounds or temporary solutions
- Section headers in large functions

**JSDoc/TSDoc Usage:**
- Document all exported functions
- Document complex interfaces and types
- Include `@param`, `@returns`, `@example` when useful
- Document side effects (mutations, cache invalidation)

**Example:**
```typescript
/**
 * Extract edits from AI response if present (supports single or multiple edits)
 * @param response - The raw AI response text
 * @returns Object with cleaned text and extracted edits array
 */
function extractEdits(response: string): { text: string; edits: PendingEdit[] } {
  // Implementation
}
```

## Function Design

**Size:**
- Target: functions under 50 lines
- Extract helpers when complex
- Name helpers descriptively (e.g., `formatValue()`, `flushList()`, `validateSection()`)
- Exception: large generator/pipeline functions (100+ lines acceptable if well-structured)

**Parameters:**
- Max 3-4 parameters; use objects for more
- Always provide explicit types
- Use optional chaining (`?.`) and nullish coalescing (`??`) extensively
- Destructure in function signature when possible

**Return Values:**
- Multiple values: return object with named properties (e.g., `{ text, edits }`)
- "Not found": return null/undefined (don't throw)
- Tuples only for closely related pairs
- Always type return values explicitly

**Example:**
```typescript
function extractExplanation(response: string): {
  text: string;
  explanation: string | null;
  relatedFactors: RelatedFactor[];
  confidence: 'high' | 'medium' | 'low' | null;
} {
  // Implementation
}
```

## Module Design

**Exports:**
- Named exports preferred (easier to refactor, search, track)
- Default exports only for pages/entry points
- Group related exports together
- Export types alongside implementations

**Module Structure Pattern:**
```typescript
// Types and interfaces first
export interface ApiResponse {
  success: boolean;
}

export type ChatIntent = 'question' | 'edit' | 'explain' | 'regenerate';

// Constants
export const MODELS = {
  CLAUDE_SONNET: 'claude-3-5-sonnet',
  CLAUDE_OPUS: 'claude-3-opus',
};

// Main functions
export function processData(input: string): ApiResponse {
  // Implementation
}

// Helper functions
function validateInput(input: unknown): boolean {
  // Implementation
}

// Custom errors
export class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomError';
  }
}
```

**Barrel Files (index.ts):**
- Export main types and functions only
- Don't re-export everything from subdirectories
- Example: `src/lib/chat/index.ts` exports main service functions

## React Component Patterns

**Functional Components:**
- Always use `"use client"` at top for client components
- Use `interface ComponentProps` for props (don't use `React.FC`)
- Destructure props in signature
- Export component at end of file

**Example Structure:**
```typescript
"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

export function Button({
  variant = 'default',
  size = 'md',
  asChild = false,
  ...props
}: ButtonProps) {
  return <button {...props} />;
}
```

**Props Interface Pattern:**
```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isEditProposal?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  isLoading?: boolean;
  delay?: number;
}

export function MessageBubble({
  role,
  content,
  isEditProposal,
  confidence,
  isLoading = false,
  delay = 0,
}: MessageBubbleProps) {
  // Implementation
}
```

**Server Components:**
- No `"use client"` directive
- Can use async/await directly
- Use for data fetching, auth checks
- Location: `src/app/page.tsx`, layout files

**Server Actions:**
- `"use server"` directive at top of file
- Colocated with pages: `src/app/login/actions.ts`
- Handle form submissions, mutations
- Use `redirect()`, `revalidatePath()` for cache invalidation

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  // operation
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
```

## Validation

**Framework:** Zod for runtime validation
- Schemas defined in `src/lib/*/schemas.ts`
- Match TypeScript interfaces one-to-one
- Use `.parse()` for strict validation
- Use `.safeParse()` for error handling

**Schema Examples:**
```typescript
import { z } from 'zod';

export const businessGoalSchema = z.enum([
  'revenue_growth',
  'lead_generation',
  'brand_awareness',
  'market_expansion',
]);

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  blueprint: z.record(z.unknown()),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

// Usage
const validated = chatRequestSchema.parse(body);
```

## Special Conventions

**API Routes (`src/app/api/*/route.ts`):**
- Always validate request body
- Check required fields before processing
- Use NextResponse for all responses
- Include request timing in metadata
- Add error details for debugging
- Return appropriate HTTP status codes

**Client Components:**
- `"use client"` at top
- Use React hooks for state
- Separate complex state into custom hooks
- Use Framer Motion for animations (via `@/lib/motion`)

**Styling:**
- Tailwind CSS for utility classes
- CSS custom properties for theme: `var(--bg-base)`, `var(--text-primary)`, `var(--border-subtle)`
- Use `cn()` utility from `@/lib/utils` for conditional class merging
- Component variants via CVA: `class-variance-authority`
- Inline styles for dynamic theme colors only

**Markdown Rendering:**
- Headers: `# ## ###`
- Bold: `**text**`
- Inline code: `` `code` ``
- Code blocks: ``` ``` with optional language
- Lists: `- item` or `1. item`
- Links: `[text](url)`

## API Response Patterns

**Success Response:**
```typescript
interface ChatResponse {
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
  };
}
```

**Error Response:**
```typescript
interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
    retryable: boolean;
  };
}
```

---

*Convention analysis: 2026-01-21*
