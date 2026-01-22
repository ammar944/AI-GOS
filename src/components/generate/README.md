# GenerateHeader Component

A persistent navigation header for the `/generate` page workflow that provides progress tracking, exit confirmation, and user account access.

## Features

- **Progress Tracking**: Visual stage indicator (Onboarding → Generate → Review → Complete)
- **Exit Confirmation**: Alerts users when they have unsaved progress
- **Collapsible**: Optional compact mode during generation to minimize distraction
- **Responsive**: Adapts layout for mobile devices
- **Dark Theme**: Matches SaaSLaunch design system with backdrop blur and semi-transparency
- **Accessibility**: Keyboard navigable with ARIA labels

## Usage

### Basic Example

```tsx
import { GenerateHeader } from "@/components/generate";

export default function GeneratePage() {
  return (
    <div className="min-h-screen">
      <GenerateHeader
        currentStage="generate"
        hasUnsavedProgress={true}
        onExit={() => console.log("User confirmed exit")}
      />
      {/* Your page content */}
    </div>
  );
}
```

### Integration with Existing Generate Page

The header should be placed at the top of the page, outside of state-conditional rendering:

```tsx
"use client";

import { useState } from "react";
import { GenerateHeader, type GenerateStage } from "@/components/generate";

export default function GeneratePage() {
  const [pageState, setPageState] = useState<PageState>("onboarding");

  // Map pageState to GenerateStage
  const currentStage: GenerateStage =
    pageState === "onboarding" ? "onboarding" :
    pageState === "generating-blueprint" ? "generate" :
    pageState === "review-blueprint" ? "review" : "complete";

  // Determine if there's unsaved progress
  const hasUnsavedProgress =
    pageState === "generating-blueprint" ||
    (pageState === "review-blueprint" && strategicBlueprint !== null);

  // Enable collapsing during generation to reduce distraction
  const isCollapsible = pageState === "generating-blueprint";

  return (
    <div className="min-h-screen">
      <GenerateHeader
        currentStage={currentStage}
        hasUnsavedProgress={hasUnsavedProgress}
        collapsible={isCollapsible}
        defaultCollapsed={false}
        exitUrl="/dashboard"
        onExit={() => {
          // Optional: Clear local storage or perform cleanup
          clearAllSavedData();
        }}
      />

      {/* Existing page content */}
      {pageState === "onboarding" && <OnboardingWizard />}
      {pageState === "generating-blueprint" && <GenerationView />}
      {/* ... */}
    </div>
  );
}
```

## Props

### GenerateHeaderProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentStage` | `GenerateStage` | Required | Current workflow stage |
| `hasUnsavedProgress` | `boolean` | `false` | Whether user has unsaved work |
| `onExit` | `() => void` | `undefined` | Callback before navigation |
| `exitUrl` | `string` | `"/dashboard"` | URL to navigate on exit |
| `collapsible` | `boolean` | `false` | Enable collapse toggle |
| `defaultCollapsed` | `boolean` | `false` | Initial collapsed state |
| `className` | `string` | `undefined` | Additional CSS classes |

### GenerateStage Type

```typescript
type GenerateStage = "onboarding" | "generate" | "review" | "complete";
```

## Stage Configuration

Each stage displays:
- **Number**: Visual indicator (1-4)
- **Label**: Full text (desktop)
- **Short Label**: Compact text (mobile)
- **Status**: Completed (green checkmark), Active (blue), or Upcoming (gray)

| Stage | Number | Label | Short Label |
|-------|--------|-------|-------------|
| `onboarding` | 1 | Onboarding | Setup |
| `generate` | 2 | Generate Blueprint | Generate |
| `review` | 3 | Review & Refine | Review |
| `complete` | 4 | Complete | Done |

## Layout Behavior

### Desktop (md breakpoint and above)
- Logo on left
- Horizontal progress indicator in center
- Collapse button (if collapsible) + Exit button + UserButton on right
- Full stage labels shown

### Mobile
- Logo on left
- Exit + UserButton on right
- Progress indicator moves below header in a scrollable row
- Compact stage labels

### Collapsed State (when enabled)
- Header height reduces to 48px
- Progress indicator hidden
- Logo and action buttons remain visible
- Chevron icon rotates to indicate expand

## Exit Confirmation Dialog

When `hasUnsavedProgress` is true, clicking Exit shows an alert dialog:

**During Generation:**
> "Your blueprint is currently being generated. If you exit now, you'll lose this progress and will need to start over."

**Other Stages:**
> "You have unsaved progress. If you exit now, your changes will be lost."

Users can choose:
- **Stay**: Dismisses dialog
- **Exit Anyway**: Triggers `onExit` callback and navigates to `exitUrl`

## Styling

The component uses:
- **Background**: `backdrop-blur-sm bg-background/80` (semi-transparent)
- **Border**: `border-b border-border/50`
- **Colors**: CSS variables from SaaSLaunch theme
  - Active: `rgb(54, 94, 255)` (--accent-blue)
  - Completed: `rgb(34, 197, 94)` (green-500)
  - Text: `--text-foreground`, `--text-muted-foreground`

## Animation

- Stage transitions animate with Framer Motion
- Collapse/expand animates height smoothly
- Chevron icon rotates 180° on toggle
- Mobile progress slides in/out

## Accessibility

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **ARIA Labels**: Logo link has descriptive label
- **Focus Management**: Alert dialog traps focus when open
- **Screen Readers**: Status changes announced via semantic HTML

## Performance

- **Client Component**: Uses React hooks for state management
- **Conditional Rendering**: AnimatePresence for smooth mount/unmount
- **No Hydration Issues**: UserButton from Clerk handled properly
- **Sticky Positioning**: Uses CSS `position: sticky` for performance

## Example: Mapping Page State

```typescript
// Your existing state
type PageState = "onboarding" | "generating-blueprint" | "review-blueprint" | "complete" | "error";

// Map to GenerateStage
function getGenerateStage(pageState: PageState): GenerateStage {
  switch (pageState) {
    case "onboarding":
      return "onboarding";
    case "generating-blueprint":
      return "generate";
    case "review-blueprint":
      return "review";
    case "complete":
    case "error":
      return "complete";
    default:
      return "onboarding";
  }
}

// Determine unsaved progress
function hasUnsaved(pageState: PageState, data: any): boolean {
  return (
    pageState === "generating-blueprint" ||
    (pageState === "review-blueprint" && data !== null) ||
    (pageState === "onboarding" && data !== null)
  );
}
```

## Testing Checklist

- [ ] Progress indicator updates as stages change
- [ ] Exit confirmation shows only when `hasUnsavedProgress` is true
- [ ] Collapse toggle works (when enabled)
- [ ] Logo links to dashboard
- [ ] UserButton displays and functions correctly
- [ ] Mobile layout stacks properly
- [ ] Dialog dismisses on "Stay"
- [ ] Navigation happens on "Exit Anyway"
- [ ] Keyboard navigation works
- [ ] Animations are smooth

## Dependencies

- `@clerk/nextjs` - UserButton component
- `framer-motion` - Animations
- `lucide-react` - Icons
- `@radix-ui/react-alert-dialog` - Exit confirmation dialog

## Related Components

- `/src/components/ui/logo.tsx` - Logo component
- `/src/components/ui/button.tsx` - Button variants
- `/src/components/ui/alert-dialog.tsx` - Alert dialog primitives
- `/src/lib/utils.ts` - cn() utility for class merging
