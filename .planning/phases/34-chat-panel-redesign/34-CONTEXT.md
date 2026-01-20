# Phase 34: Chat Panel Redesign - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace slide-in overlay chat with permanent 30/70 split sidebar layout on review page. Chat visible during blueprint review, hidden on complete page. Layout stacks vertically on mobile.

</domain>

<decisions>
## Implementation Decisions

### Split Layout Behavior
- Resizable with drag handle — user can adjust split ratio
- Fixed range: 20% to 40% — chat stays compact, blueprint always dominant
- Always visible on desktop — no collapse/hide option
- No persistence — resets to 30% default on page load

### Chat Sidebar Design
- Title only header — simple "Chat" or equivalent, minimal chrome
- Suggestion pills above input — quick actions always visible
- Input position: Claude's discretion
- Visual separation: Claude's discretion (border, background, or both)

### Responsive Stacking
- Mobile layout arrangement: Claude's discretion (chat above/below or tabbed)
- Breakpoint: Claude's discretion based on content needs
- Mobile collapse behavior: Claude's discretion
- Resize works on mobile — touch drag handle supported

### Transition from Current
- Code approach: Claude's discretion (replace vs refactor existing ChatPanel)
- Trigger button: Claude's discretion (remove or keep on complete page)
- Preserve existing chat message history in localStorage
- Animations: Claude's discretion for entrance/transition effects

### Claude's Discretion
- Input position (top vs bottom)
- Visual separation style between panels
- Mobile layout arrangement and breakpoint
- Mobile collapse/expand behavior
- Whether to replace or refactor ChatPanel component
- Fate of floating trigger button
- Framer Motion animation choices

</decisions>

<specifics>
## Specific Ideas

- 20-40% resize range keeps chat compact while allowing some flexibility
- Always visible sidebar means no trigger button needed on review page
- Suggestion pills should remain accessible (above input, not just empty state)
- Touch-friendly resize on mobile devices

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-chat-panel-redesign*
*Context gathered: 2026-01-20*
