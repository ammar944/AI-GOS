# Coding Conventions

**Analysis Date:** 2025-12-24

## Naming Patterns

**Files:**
- Components: kebab-case.tsx (`form-wizard.tsx`, `step-business-basics.tsx`)
- Utilities: kebab-case.ts (`local-storage.ts`, `media-plan-generator.ts`)
- Types: kebab-case.ts (`output-types.ts`, `types.ts`)
- Routes: `route.ts` (Next.js convention)
- Pages: `page.tsx` (Next.js convention)

**Functions:**
- camelCase for all functions (`handleSubmit`, `generateMediaPlan`)
- Async functions: no special prefix (`async function fetchData()`)
- Callbacks: `on` prefix (`onSubmit`, `onProgress`, `onBack`)
- Validation: `validate` prefix (`validateNicheForm`, `validateBriefingForm`)

**Variables:**
- camelCase for variables (`const step`, `let isLoading`)
- UPPER_SNAKE_CASE for constants (`MAX_INPUT_LENGTH`, `STORAGE_KEYS`)
- No underscore prefix for private (TypeScript handles access)

**Types:**
- PascalCase for interfaces and types (`NicheFormData`, `MediaPlanOutput`)
- Suffixes by purpose:
  - `*Data` for input types (`OnboardingFormData`)
  - `*Output` for response types (`StrategicBlueprintOutput`)
  - `*Props` for component props (`NicheFormProps`)
  - `*Progress` for progress tracking (`MediaPlanProgress`)

## Code Style

**Formatting:**
- 2-space indentation
- Double quotes for strings (`"`)
- Semicolons required
- No trailing commas in single-line
- Trailing commas in multi-line

**Linting:**
- ESLint 9 with flat config (`eslint.config.mjs`)
- Extends: `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`
- Run: `npm run lint`

## Import Organization

**Order:**
1. React and Next.js (`"react"`, `"next/*"`)
2. External packages (`@radix-ui/*`, `lucide-react`)
3. Internal modules (`@/lib/*`, `@/components/*`)
4. Relative imports (`./`, `../`)
5. Type imports (`import type { }`)

**Grouping:**
- Blank line between groups (when files follow convention)
- No strict sorting within groups

**Path Aliases:**
- `@/*` maps to `src/*` (configured in `tsconfig.json`)
- Example: `import { cn } from "@/lib/utils"`

## Error Handling

**Patterns:**
- Try/catch at API route boundaries
- Throw errors in service layer, catch in routes
- Return JSON error responses with status codes

**Error Types:**
- Generic Error with descriptive messages
- No custom error classes detected

**Async:**
- Use try/catch for async functions
- No .catch() chains observed

## Logging

**Framework:**
- Console.log for general output
- Console.error for errors
- No structured logging library

**Patterns:**
- Log at API entry/exit points
- Log errors with context when available
- Development-style logging (console statements)

## Comments

**When to Comment:**
- Complex algorithms (JSON extraction strategies)
- Security-sensitive code (sanitization)
- Non-obvious business logic

**JSDoc/TSDoc:**
- Minimal usage
- Self-documenting code preferred via TypeScript types

**TODO Comments:**
- Format: `// TODO: description`
- No username convention observed

## Function Design

**Size:**
- Most functions under 50 lines
- Complex generators are larger (100+ lines)
- Extract helpers when logic is reusable

**Parameters:**
- Destructure props in React components
- Use options objects for 3+ parameters
- Example: `function generate(data: FormData, options?: GenerateOptions)`

**Return Values:**
- Explicit returns
- Return early for guard clauses
- Use union types for success/error

## Module Design

**Exports:**
- Named exports preferred
- Default exports for React pages/components
- Barrel exports via index.ts for feature modules

**Barrel Files:**
- `src/components/onboarding/index.ts` - Exports all step components
- `src/lib/media-plan/pipeline/index.ts` - Exports pipeline functions

## React Patterns

**Component Structure:**
```typescript
"use client"

import { ... } from "..."

interface ComponentProps { ... }

export function Component({ prop1, prop2 }: ComponentProps) {
  // hooks
  // handlers
  // render
}
```

**Server vs Client:**
- `"use client"` directive for interactive components
- `"use server"` directive for server actions
- Pages are Server Components by default

**State Management:**
- React useState for local state
- Props drilling for simple cases
- localStorage for persistence across sessions

**Component Variants:**
- CVA (class-variance-authority) for variant styling
- Example from `src/components/ui/button.tsx`:
```typescript
const buttonVariants = cva("...", {
  variants: {
    variant: { default: "...", destructive: "..." },
    size: { default: "...", sm: "...", lg: "..." },
  },
})
```

---

*Convention analysis: 2025-12-24*
*Update when patterns change*
