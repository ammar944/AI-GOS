# Left Sidebar (Component 2) — Design

## Component Tree

```
<AppSidebar>
  ├─ Logo ("AI-GOS" + "v2" badge)
  ├─ <nav> (6 NavItems)
  │    ├─ Home (/)
  │    ├─ Journey (/journey) — active on current page
  │    ├─ Blueprints (/blueprints)
  │    ├─ Ad Launcher (/ads) — locked
  │    ├─ Creatives (/creatives) — locked
  │    └─ Settings (/settings)
  ├─ Divider
  ├─ "Recent Sessions" label
  ├─ <SessionList /> — scrollable, from session history array
  ├─ flex-1 spacer
  └─ <UserMenu /> — Clerk avatar + dropdown
```

## Files

| File | Action |
|------|--------|
| `src/components/shell/nav-item.tsx` | Create — single nav link with icon, label, active/locked states |
| `src/components/shell/session-list.tsx` | Create — recent sessions from localStorage history array |
| `src/components/shell/user-menu.tsx` | Create — Clerk user avatar + DropdownMenu |
| `src/components/shell/app-sidebar.tsx` | Create — main container composing all sections |
| `src/lib/storage/local-storage.ts` | Modify — add SESSION_HISTORY key + SessionSummary type + CRUD functions |
| `src/components/shell/index.ts` | Modify — re-export AppSidebar |
| `src/app/journey/page.tsx` | Modify — replace SidebarPlaceholder with AppSidebar |

## Session History Storage

```typescript
STORAGE_KEYS.SESSION_HISTORY = "aigog_session_history"

interface SessionSummary {
  id: string;
  companyName: string | null;
  status: 'active' | 'complete' | 'draft';
  completionPercent: number;
  lastUpdated: string;
}
```

Functions: `getSessionHistory()`, `addSessionToHistory(summary)`, `updateSessionInHistory(id, partial)`.

## NavItem

- Next.js `Link` for navigable items, `button` for locked
- Radix `Tooltip` wrapping each item (side="right")
- Active: `usePathname()` match
- Locked: dimmed + Lock icon overlay + "Coming soon" tooltip
- Icons: lucide-react 18px, strokeWidth 1.5

## UserMenu

- `useUser()` / `useClerk()` from `@clerk/nextjs`
- Radix `DropdownMenu` (existing component)
- Items: Profile (placeholder), Settings, separator, Sign Out (destructive)
- Avatar: 28px circle, gradient fallback with initials

## Collapsed State (48px)

- Labels hidden via parent overflow
- Tooltips essential (always side="right")
- Session list hidden (AnimatePresence)
- User menu shows only avatar

## Styling

All inline styles using CSS custom properties from globals.css:
- Background: `var(--bg-elevated)`
- Borders: `var(--border-subtle)`, `var(--border-default)`
- Text: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`, `var(--text-quaternary)`
- Active nav: `var(--bg-surface)` bg + `var(--text-primary)` text
- Hover: `var(--bg-hover)` bg, 150ms transition
