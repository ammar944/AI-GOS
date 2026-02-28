# Left Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the left sidebar for the AI-GOS v2 battleship layout — navigation, session history, user menu with collapsed state support.

**Architecture:** Four sub-components (`NavItem`, `SessionList`, `UserMenu`, `AppSidebar`) plug into the existing `AppShell` slot. Session history stored as a localStorage array. Radix Tooltip/DropdownMenu for interactions. Collapsed state from `useShell()` context.

**Tech Stack:** React 19, Next.js 15, Framer Motion, Radix UI (Tooltip, DropdownMenu), Clerk (`@clerk/nextjs`), lucide-react icons, CSS custom properties.

---

### Task 1: Session History Storage

**Files:**
- Modify: `src/lib/storage/local-storage.ts`

**Step 1:** Add `SESSION_HISTORY` to `STORAGE_KEYS`:
```typescript
SESSION_HISTORY: "aigos_session_history",
```

**Step 2:** Add `SessionSummary` interface after imports:
```typescript
export interface SessionSummary {
  id: string;
  companyName: string | null;
  status: 'active' | 'complete' | 'draft';
  completionPercent: number;
  lastUpdated: string;
}
```

**Step 3:** Add CRUD functions after `clearJourneySession()`:
```typescript
export function getSessionHistory(): SessionSummary[] {
  return getItem<SessionSummary[]>(STORAGE_KEYS.SESSION_HISTORY) ?? [];
}

export function addSessionToHistory(summary: SessionSummary): boolean {
  const history = getSessionHistory();
  const existing = history.findIndex(s => s.id === summary.id);
  if (existing !== -1) {
    history[existing] = summary;
  } else {
    history.unshift(summary);
  }
  return setItem(STORAGE_KEYS.SESSION_HISTORY, history.slice(0, 20));
}

export function updateSessionInHistory(
  id: string,
  updates: Partial<Omit<SessionSummary, 'id'>>,
): boolean {
  const history = getSessionHistory();
  const index = history.findIndex(s => s.id === id);
  if (index === -1) return false;
  history[index] = { ...history[index], ...updates };
  return setItem(STORAGE_KEYS.SESSION_HISTORY, history);
}
```

**Step 4:** Commit.

---

### Task 2: NavItem Component

**Files:**
- Create: `src/components/shell/nav-item.tsx`

Single navigation link with icon, label, active/locked states, tooltip for collapsed mode. Uses Next.js Link for navigable items, button for locked. Radix Tooltip wraps each item. Active detection via `usePathname().startsWith(href)` — important for future dynamic routes like `/journey/[sessionId]`.

---

### Task 3: SessionList Component

**Files:**
- Create: `src/components/shell/session-list.tsx`

Reads from `getSessionHistory()`. Each row: status dot (green=complete, amber=active, gray=draft), company name or "New Session", relative timestamp. Max height with overflow scroll. Hidden when sidebar collapsed via AnimatePresence.

---

### Task 4: UserMenu Component

**Files:**
- Create: `src/components/shell/user-menu.tsx`

Clerk `useUser()` for avatar/name, `useClerk()` for signOut. Radix DropdownMenu with Profile, Settings, Sign Out items. Collapsed: only avatar circle. Expanded: avatar + name + chevron.

---

### Task 5: AppSidebar Composition

**Files:**
- Create: `src/components/shell/app-sidebar.tsx`
- Modify: `src/components/shell/index.ts` — add AppSidebar export

Composes logo, nav, divider, session list, spacer, user menu. Reads `useShell()` for collapsed state. Passes `collapsed` to children.

---

### Task 6: Wire Into Journey Page

**Files:**
- Modify: `src/app/journey/page.tsx`

Replace `SidebarPlaceholder` with `<AppSidebar />`. Delete the placeholder function.

---

### Task 7: Build & Lint Verification

Run `npm run build` and `npm run lint`. Fix any issues.
