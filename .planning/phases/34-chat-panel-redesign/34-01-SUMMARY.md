---
phase: 34-chat-panel-redesign
plan: 01
subsystem: ui-layout
tags: [react-resizable-panels, split-layout, chat-ui]

dependency_graph:
  requires: []
  provides:
    - SplitChatLayout component
    - Resizable panel infrastructure
  affects:
    - 34-02 (Chat sidebar integration)

tech_stack:
  added:
    - react-resizable-panels@4.4.1
  patterns:
    - Group/Panel/Separator for resizable layouts
    - Mobile-first responsive layout

key_files:
  created:
    - src/components/layout/split-chat-layout.tsx
    - src/components/layout/index.ts
  modified:
    - package.json

decisions:
  - id: "34-01-01"
    title: "v4 API for react-resizable-panels"
    choice: "Group/Panel/Separator over PanelGroup/PanelResizeHandle"
    rationale: "v4 API is current standard, matches library exports"

metrics:
  duration: "~5 minutes"
  completed: "2026-01-20"
---

# Phase 34 Plan 01: Split Chat Layout Foundation Summary

Resizable split layout using react-resizable-panels v4 with 30/70 desktop split (20-40% chat range) and mobile vertical stack.

## What Was Built

### SplitChatLayout Component
Created `src/components/layout/split-chat-layout.tsx` providing:

**Desktop Layout (lg+):**
- 30% default chat panel width
- Resizable between 20% and 40%
- Blueprint content fills remaining 60-80%
- Visual resize handle with hover feedback (blue accent)
- Touch-friendly 16px hit area for resize

**Mobile Layout (<lg):**
- Vertical stack (blueprint above, chat below)
- Blueprint fills available space with scroll
- Chat panel fixed at 45vh height
- Border separator between panels

### Barrel Export
Created `src/components/layout/index.ts` for clean imports:
```typescript
import { SplitChatLayout } from '@/components/layout';
```

## Key Implementation Details

1. **react-resizable-panels v4 API**: Uses `Group`, `Panel`, `Separator` components (not the deprecated `PanelGroup`/`PanelResizeHandle` from v2/v3)

2. **Orientation prop**: Uses `orientation="horizontal"` (v4), not `direction` (v3)

3. **Numeric sizes**: Uses numbers (30, 20, 40, 60) not strings for size props

4. **Responsive strategy**: Separate DOM trees for desktop vs mobile using Tailwind breakpoints, not CSS-only responsive Group

5. **Hover feedback**: Inline style handlers for resize handle color change to `var(--accent-blue)`

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4da18f8 | chore | Install react-resizable-panels v4.4.1 |
| f83bd6c | feat | Create SplitChatLayout component |
| de068c2 | chore | Create layout barrel export |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] `npm ls react-resizable-panels` shows version 4.4.1
- [x] `npx tsc --noEmit` passes without errors in layout files
- [x] `npm run build` completes successfully
- [x] Files exist:
  - src/components/layout/split-chat-layout.tsx (86 lines)
  - src/components/layout/index.ts (1 line)

## Next Phase Readiness

**Ready for 34-02:** Chat sidebar integration can now use the SplitChatLayout component to wrap chat content and blueprint content.

**Usage pattern:**
```tsx
<SplitChatLayout
  chatContent={<ChatSidebar />}
  blueprintContent={<BlueprintViewer />}
/>
```
