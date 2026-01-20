# Phase 34: Chat Panel Redesign - Research

**Researched:** 2026-01-20
**Domain:** React resizable panel layouts, chat sidebar UI patterns
**Confidence:** HIGH

## Summary

This phase transforms the existing slide-in overlay chat panel into a permanent 30/70 resizable split layout on the review page. The chat sidebar occupies the left portion (20-40% resizable range) while the blueprint content fills the right side with independent scrolling.

The research confirms **react-resizable-panels v4** as the standard library for implementing resizable split layouts in React. This library is widely adopted (2.7M+ weekly npm downloads), actively maintained, and provides built-in keyboard accessibility, touch support, and constraint handling. The existing codebase already uses Framer Motion for animations, which complements but should not replace react-resizable-panels for the actual resize mechanics.

**Primary recommendation:** Install react-resizable-panels v4 and create a new `SplitChatLayout` wrapper component that composes the existing `BlueprintChat` content within a resizable left panel, keeping the current chat functionality intact while adding the split layout behavior.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-resizable-panels | ^4.4.1 | Resizable split panel layout | Industry standard, 2.7M+ weekly downloads, WAI-ARIA compliant |
| framer-motion | ^12.26.1 | Animation (already in project) | Entrance/exit animations, spring physics |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | ^4 | Styling (already in project) | All component styling |
| lucide-react | ^0.561.0 | Icons (already in project) | Drag handle grip icon |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-resizable-panels | Custom Framer Motion drag | FM drag has known constraint bugs on resize; more maintenance |
| react-resizable-panels | allotment | Less flexible, larger bundle, less customization |
| react-resizable-panels | react-split-pane | Unmaintained, last update 2020 |

**Installation:**
```bash
npm install react-resizable-panels@^4.4.1
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── chat/
│   │   ├── chat-panel.tsx         # MODIFY: Remove overlay behavior
│   │   ├── blueprint-chat.tsx     # MODIFY: Extract content, remove trigger
│   │   ├── chat-sidebar.tsx       # NEW: Sidebar layout wrapper
│   │   ├── quick-suggestions.tsx  # KEEP: Move above input
│   │   └── ...existing files
│   └── layout/
│       └── split-chat-layout.tsx  # NEW: Resizable split container
```

### Pattern 1: Resizable Split Layout with react-resizable-panels v4
**What:** Use Group/Panel/Separator components for the split layout
**When to use:** Review page layout
**Example:**
```tsx
// Source: https://github.com/bvaughn/react-resizable-panels
import { Group, Panel, Separator } from "react-resizable-panels";

function SplitChatLayout({ children, chatContent }) {
  return (
    <Group orientation="horizontal" className="h-full">
      {/* Chat sidebar: 30% default, 20-40% range */}
      <Panel
        defaultSize="30%"
        minSize="20%"
        maxSize="40%"
        className="flex flex-col"
      >
        {chatContent}
      </Panel>

      {/* Resize handle */}
      <Separator className="w-1 bg-[var(--border-default)] hover:bg-[var(--accent-blue)] transition-colors cursor-col-resize" />

      {/* Blueprint content: fills remaining space */}
      <Panel minSize="60%" className="overflow-y-auto">
        {children}
      </Panel>
    </Group>
  );
}
```

### Pattern 2: Mobile Responsive Stacking
**What:** Vertical stack on mobile using CSS-only approach
**When to use:** Below lg breakpoint (1024px)
**Example:**
```tsx
// Source: https://github.com/shadcn-ui/ui/discussions/2345
<Group
  orientation="horizontal"
  className="flex-col lg:flex-row h-full"
>
  <Panel
    defaultSize="30%"
    minSize="20%"
    maxSize="40%"
    className="lg:max-w-[40%] h-[50vh] lg:h-full"
  >
    {/* Chat */}
  </Panel>
  <Separator className="hidden lg:flex w-1 cursor-col-resize" />
  <Panel className="flex-1 overflow-y-auto">
    {/* Blueprint */}
  </Panel>
</Group>
```

### Pattern 3: Touch-Friendly Resize Handle
**What:** Larger hit area for touch devices
**When to use:** Resize separator styling
**Example:**
```tsx
// Source: https://blog.theodo.com/2020/11/react-resizeable-split-panels/
<Separator className="group relative">
  {/* Visual indicator */}
  <div className="absolute inset-y-0 -left-1 -right-1 w-3 flex items-center justify-center">
    <div className="w-1 h-8 rounded-full bg-[var(--border-default)] group-hover:bg-[var(--accent-blue)] transition-colors" />
  </div>
  {/* Larger touch target */}
  <div className="absolute inset-y-0 -left-2 -right-2 w-5 cursor-col-resize" />
</Separator>
```

### Anti-Patterns to Avoid
- **Using Framer Motion drag for resize:** Known bugs with constraint recalculation on window resize. Use react-resizable-panels instead.
- **Nesting scroll containers incorrectly:** Blueprint panel needs `overflow-y-auto` while parent Group needs `overflow: hidden`.
- **Persisting resize state:** Context says "no persistence" - don't use localStorage for panel sizes.
- **Custom pointer event handling:** react-resizable-panels handles all pointer/touch events internally.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable panels | Custom mouse/touch drag handlers | react-resizable-panels | Edge cases: min/max constraints, keyboard access, touch, RTL |
| Resize cursor | Custom cursor management | Library's built-in cursor handling | Handles hover, active, disabled states |
| Constraint enforcement | Manual boundary checking | Panel minSize/maxSize props | Handles elastic resistance, snap-back |
| Keyboard resize | Custom keydown handlers | Built-in arrow key support | WAI-ARIA compliant, respects min/max |
| Mobile touch | Custom touch event handling | Library's native support | Handles multi-touch, velocity, inertia |

**Key insight:** Resize interactions appear simple (just track mouse position) but have dozens of edge cases: browser focus loss, window resize during drag, touch cancel events, accessibility requirements, RTL layout support. react-resizable-panels handles all of these.

## Common Pitfalls

### Pitfall 1: v4 API Breaking Changes
**What goes wrong:** Importing old component names (`PanelGroup`, `PanelResizeHandle`, `direction`)
**Why it happens:** Most online examples use v2/v3 API
**How to avoid:** Use v4 API: `Group`, `Panel`, `Separator`, `orientation`
**Warning signs:** TypeScript error "PanelGroup does not exist on module"

### Pitfall 2: Overflow Handling
**What goes wrong:** Entire page scrolls instead of just blueprint panel
**Why it happens:** Missing overflow constraints on parent containers
**How to avoid:**
- Group container: `h-full overflow-hidden`
- Chat panel: `flex flex-col` with scrollable message area
- Blueprint panel: `overflow-y-auto`
**Warning signs:** Double scrollbars, content overflows container

### Pitfall 3: Mobile Layout Complexity
**What goes wrong:** Resize handle appears on mobile, breaks touch scrolling
**Why it happens:** Not conditionally hiding Separator on mobile
**How to avoid:** Use `className="hidden lg:flex"` on Separator
**Warning signs:** Users can't scroll chat on mobile

### Pitfall 4: Chat Content Extraction
**What goes wrong:** Duplicating BlueprintChat logic in new component
**Why it happens:** BlueprintChat currently includes both trigger button and panel
**How to avoid:** Extract chat content as composable children, keep trigger button separate
**Warning signs:** Multiple instances of chat state, duplicated API calls

### Pitfall 5: Fixed Height Issues
**What goes wrong:** Split layout doesn't fill viewport
**Why it happens:** Missing height constraints from body to Group
**How to avoid:** Ensure full height chain: `html/body: h-full` -> container -> Group
**Warning signs:** Content cut off, extra whitespace at bottom

## Code Examples

Verified patterns for implementation:

### Complete Split Layout Component
```tsx
// Source: https://github.com/bvaughn/react-resizable-panels
"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SplitChatLayoutProps {
  chatContent: React.ReactNode;
  blueprintContent: React.ReactNode;
  className?: string;
}

export function SplitChatLayout({
  chatContent,
  blueprintContent,
  className,
}: SplitChatLayoutProps) {
  return (
    <div className={cn("h-full", className)}>
      {/* Desktop: side-by-side with resize */}
      <div className="hidden lg:block h-full">
        <Group orientation="horizontal" className="h-full">
          <Panel
            defaultSize="30%"
            minSize="20%"
            maxSize="40%"
          >
            <div className="h-full flex flex-col" style={{ background: 'var(--bg-surface)' }}>
              {chatContent}
            </div>
          </Panel>

          <Separator className="w-px relative group">
            <div
              className="absolute inset-y-0 -left-1 -right-1 w-3 flex items-center justify-center cursor-col-resize"
              style={{ background: 'transparent' }}
            >
              <div
                className="w-1 h-12 rounded-full transition-colors"
                style={{
                  background: 'var(--border-default)',
                }}
              />
            </div>
          </Separator>

          <Panel minSize="60%">
            <div className="h-full overflow-y-auto">
              {blueprintContent}
            </div>
          </Panel>
        </Group>
      </div>

      {/* Mobile: vertical stack */}
      <div className="lg:hidden h-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {blueprintContent}
        </div>
        <div
          className="h-[40vh] border-t flex flex-col"
          style={{
            borderColor: 'var(--border-default)',
            background: 'var(--bg-surface)',
          }}
        >
          {chatContent}
        </div>
      </div>
    </div>
  );
}
```

### Chat Sidebar Header (Minimal)
```tsx
// Source: Context decisions - "Title only header"
function ChatSidebarHeader() {
  return (
    <div
      className="flex-shrink-0 px-4 py-3 border-b"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--bg-elevated)',
      }}
    >
      <h2
        className="text-sm font-medium"
        style={{ color: 'var(--text-primary)' }}
      >
        Chat
      </h2>
    </div>
  );
}
```

### Suggestion Pills Above Input
```tsx
// Source: Context decisions - "Suggestion pills above input"
function ChatInputArea({ suggestions, onSuggestionSelect, onSubmit }) {
  return (
    <div
      className="flex-shrink-0 p-4 border-t"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {/* Suggestions above input */}
      <div className="mb-3">
        <QuickSuggestions
          onSelect={onSuggestionSelect}
          disabled={isLoading}
        />
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="flex gap-2">
        {/* ... input and send button ... */}
      </form>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PanelGroup/PanelResizeHandle | Group/Panel/Separator | Dec 2025 (v4) | Must use new API names |
| direction prop | orientation prop | Dec 2025 (v4) | Aligns with WAI-ARIA |
| Numeric sizes (30) | String sizes ("30%") | Dec 2025 (v4) | More flexible units |
| autoSaveId prop | useDefaultLayout hook | Dec 2025 (v4) | N/A - not using persistence |
| onCollapse/onExpand | onResize with prevSize | Dec 2025 (v4) | N/A - not using collapse |

**Deprecated/outdated:**
- `PanelGroup`: Use `Group` in v4
- `PanelResizeHandle`: Use `Separator` in v4
- `direction="horizontal"`: Use `orientation="horizontal"` in v4
- `data-panel-*` attributes: Changed to `aria-*` attributes in v4

## Open Questions

Things that couldn't be fully resolved:

1. **Mobile chat position (above vs below blueprint)**
   - What we know: Context says "Claude's discretion"
   - What's unclear: User preference for reading flow
   - Recommendation: Place chat below blueprint on mobile (bottom sheet pattern is familiar)

2. **Resize handle visual feedback during drag**
   - What we know: react-resizable-panels adds `aria-valuetext` during drag
   - What's unclear: Best visual style for drag state
   - Recommendation: Change handle background to `var(--accent-blue)` on active drag

3. **Input position (top vs bottom of chat)**
   - What we know: Context says "Claude's discretion"
   - What's unclear: User scanning pattern
   - Recommendation: Bottom position (standard chat UX, matches Slack/Discord/etc.)

## Sources

### Primary (HIGH confidence)
- [GitHub - bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) - Official documentation, v4 API, CHANGELOG
- [react-resizable-panels CHANGELOG.md](https://github.com/bvaughn/react-resizable-panels/blob/main/CHANGELOG.md) - v4 breaking changes

### Secondary (MEDIUM confidence)
- [shadcn/ui Resizable Component](https://ui.shadcn.com/docs/components/resizable) - Integration patterns, verified implementation
- [shadcn-ui/ui Issue #9136](https://github.com/shadcn-ui/ui/issues/9136) - v4 compatibility issues and workarounds
- [Theodo Blog: React Resizable Split Panels](https://blog.theodo.com/2020/11/react-resizeable-split-panels/) - Touch event handling patterns

### Tertiary (LOW confidence)
- [v0.dev/Lovable design patterns](https://rogerwong.me/2025/04/beyond-the-prompt/) - General AI tool UI patterns (chat left, content right)
- [Motion.dev drag docs](https://motion.dev/docs/react-drag) - Framer Motion drag constraints (not recommended for resize)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-resizable-panels is clearly the standard solution
- Architecture: HIGH - Patterns directly from official docs and verified implementations
- Pitfalls: HIGH - Based on documented issues in GitHub and breaking changes

**Research date:** 2026-01-20
**Valid until:** 2026-04-20 (3 months - library is stable, v4 recently released)
