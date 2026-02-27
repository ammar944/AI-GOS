# Fix #2: No Tool Result Card Components

## Problem Summary

`src/components/journey/chat-message.tsx` only renders markdown text. Sprint 2 tools will produce results that are invisible to users without card components.

## Key Finding: All 5 Cards Already Exist in V1

The v1 agent system already has production-ready card components:

| Card | Component | File | Icon | Tint Color |
|------|-----------|------|------|------------|
| Deep Research | `DeepResearchCard` | `src/components/chat/deep-research-card.tsx` | Search | `rgba(54,94,255,0.04)` blue |
| Edit Proposal | `EditApprovalCard` | `src/components/chat/edit-approval-card.tsx` | — | GradientBorder + amber |
| Comparison | `ComparisonTableCard` | `src/components/chat/comparison-table-card.tsx` | BarChart3 | `rgba(167,139,250,0.04)` purple |
| Score | `AnalysisScoreCard` | `src/components/chat/analysis-score-card.tsx` | Activity | `rgba(80,248,228,0.03)` cyan |
| Visualization | `VisualizationCard` | `src/components/chat/visualization-card.tsx` | — | `rgba(52,210,123,0.04)` green |

Supporting components:
- `ToolLoadingIndicator` — `src/components/chat/tool-loading-indicator.tsx`
- `ResearchProgressCard` — `src/components/chat/research-progress-card.tsx`
- `EditDiffView` — `src/components/chat/edit-diff-view.tsx`
- `ViewInBlueprintButton` — `src/components/chat/view-in-blueprint-button.tsx`

## Tool Output Schemas

### deepResearch
```typescript
DeepResearchResult {
  query: string;
  phases: { name: string; status: 'done'|'in-progress'|'pending'; duration: number }[];
  findings: { title: string; content: string; citations: { label: string; url: string }[] }[];
  sources: { domain: string; url: string }[];
  totalDuration: number;
}
```

### compareCompetitors
```typescript
ComparisonResult {
  competitors: string[];
  dimensions: string[];
  headers: string[];
  rows: Record<string, string>[];
  winnerPerColumn?: Record<string, string>;
}
```

### analyzeMetrics
```typescript
AnalysisResult {
  section: string;
  overallScore: number;
  dimensions: { name: string; score: number; reasoning?: string }[];
  recommendations: string[];
  summary?: string;
}
```

### createVisualization
```typescript
VisualizationResult {
  type: 'bar' | 'radar' | 'timeline';
  title: string;
  data: Array<Record<string, string | number>>;
  config: { colors: string[]; dataKey: string; categoryKey: string; labels?: string[] };
}
```

## How V1 Renders Tool Results (agent-chat.tsx lines 534-829)

The `renderMessageParts` function handles each tool by state:

1. **input-streaming / input-available** → `ToolLoadingIndicator` (or `ResearchProgressCard` for deepResearch)
2. **approval-requested** → `EditApprovalCard` (for editBlueprint)
3. **output-available** → Specific card per tool name
4. **output-error** → Red error badge with `toolPart.errorText`

## Design Patterns

- **Motion wrapper**: `motion.div` with `scaleIn` variant + `springs.smooth`
- **Header**: Icon + uppercase label (11px, tracking-wider), colored tint bg
- **Borders**: `1px solid var(--border-default)`, `rounded-xl`
- **Colors**: `var(--bg-surface)`, `var(--text-primary/secondary/tertiary)`, accent colors
- **Animations**: Entry scale 0.95→1, content expand via AnimatePresence, staggered delays

## Solution

The fix is NOT creating new components — they already exist. The fix is:
1. Update `chat-message.tsx` to accept `parts: UIMessage['parts']` instead of `content: string`
2. Add a part iterator that renders text → markdown, tool → appropriate card
3. Import all existing card components
4. Match tool part states to render correct UI per state

## Required Imports
```typescript
import { DeepResearchCard } from '@/components/chat/deep-research-card';
import { EditApprovalCard } from '@/components/chat/edit-approval-card';
import { ComparisonTableCard } from '@/components/chat/comparison-table-card';
import { AnalysisScoreCard } from '@/components/chat/analysis-score-card';
import { VisualizationCard } from '@/components/chat/visualization-card';
import { ToolLoadingIndicator } from '@/components/chat/tool-loading-indicator';
import { ResearchProgressCard } from '@/components/chat/research-progress-card';
```
