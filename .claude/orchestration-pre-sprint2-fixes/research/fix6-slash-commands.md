# Fix #6: No Slash Command Infrastructure

## Key Finding: V1 Already Has Full Implementation

The v1 chat system has complete slash command infrastructure:
- **5 commands defined**: `/research`, `/edit`, `/compare`, `/analyze`, `/visualize`
- **Palette UI**: `SlashCommandPalette` component with dropdown, keyboard nav, icons
- **Parsing**: Input detection (`startsWith('/')`), prefix filtering
- **Tool mapping**: System prompt interprets commands as intent signals

## V1 Command Definitions (`src/components/chat/chat-input.tsx`)

```typescript
const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'research', description: 'Research a topic with live data', icon: 'Search', color: 'var(--accent-blue)' },
  { name: 'edit', description: 'Edit a blueprint section', icon: 'Pencil', color: '#f59e0b' },
  { name: 'compare', description: 'Compare competitors or strategies', icon: 'GitCompare', color: '#a855f7' },
  { name: 'analyze', description: 'Deep-dive analysis of metrics', icon: 'BarChart3', color: '#06b6d4' },
  { name: 'visualize', description: 'Generate visual breakdowns', icon: 'Eye', color: '#22c55e' },
];
```

## V1 Palette Component (`src/components/chat/slash-command-palette.tsx`)

- Position: absolute, bottom: 100% (above input)
- Glassmorphic: `--bg-elevated` bg, `--border-default` border, rounded-[12px]
- Animation: Framer Motion fade-in/out
- Items: 28px icon box (color at 10% opacity) + command name (mono font) + description
- Hover/selected: `var(--bg-hover)` background

## Command → Tool Mapping (via system prompt)

| Command | Primary Tool | Secondary Tool |
|---------|-------------|----------------|
| `/research` | `deepResearch` or `webResearch` | `searchBlueprint` |
| `/edit` | `editBlueprint` or `generateSection` | — |
| `/compare` | `compareCompetitors` | `webResearch` |
| `/analyze` | `analyzeMetrics` | — |
| `/visualize` | `createVisualization` | — |

## Implementation for Journey

### Strategy: Import v1 Components

```typescript
import { SlashCommandPalette } from '@/components/chat/slash-command-palette';
import type { SlashCommand } from '@/components/chat/slash-command-palette';
```

### Required Changes to `src/components/journey/chat-input.tsx`

1. Add state: `isSlashPaletteOpen`, `selectedCommandIndex`
2. Add detection: `input.startsWith('/')` → open palette
3. Add filtering: `useMemo` to filter commands by prefix
4. Add keyboard nav: ArrowUp/Down, Enter, Escape
5. Add command selection: Insert `/{name} ` into input
6. Render `SlashCommandPalette` above textarea

### System Prompt Integration

Add `## Slash Commands` section to journey stream route system prompt. Commands are **intent signals** — the AI interprets them and selects appropriate tools.

### Edge Cases
- `/edit` with no args → agent asks what to change (handled in system prompt)
- `/` mid-sentence → not detected (only `startsWith('/')`)
- Empty filter → all commands shown
