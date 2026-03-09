# Journey Page UI Components Inventory

## Overview

The journey page (`src/app/journey/page.tsx`) is a comprehensive chat-based research interface built with Vercel AI SDK v6 and Framer Motion. It orchestrates a multi-phase strategy research experience with real-time streaming, interactive tools, and visual progress tracking.

---

## 1. Journey Page (`src/app/journey/page.tsx`)

**Path**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/app/journey/page.tsx`

**Entry Point Structure**:
```tsx
export default function JourneyPage() {
  return (
    <ShellProvider>
      <JourneyPageContent />
    </ShellProvider>
  );
}
```

### Main Component: JourneyPageContent (lines 104-1016)

**Purpose**: Core orchestrator for the entire journey experience. Manages:
- Chat state (messages, tool outputs, approvals)
- Research progress tracking
- Onboarding state (company context, ICP, budget, etc.)
- Prefill/website analysis flow
- Session persistence to Supabase

**Key State Variables**:
- `messages` — UIMessage array from Vercel AI SDK useChat hook
- `onboardingState` — Partial<OnboardingState> for collected user data
- `researchStreaming` — Record<sectionId, { text, status, startedAt }>
- `showResumePrompt` — Show "continue from saved session" dialog
- `prefillReviewOpen` — Show website prefill review modal
- `hasStartedJourney` — Tracks when journey phase transitions from 0→1

**Render Structure**:
```tsx
<AppShell sidebar={<AppSidebar />} rightPanel={<ResearchProgress />}>
  <JourneyHeader />
  {journeyPhase === 0 && !showResumePrompt ? (
    <WelcomeState />
  ) : (
    /* Chat content: ResumePrompt | JourneyPrefillReview | ChatMessages */
  )}
</AppShell>
```

**Key Handlers**:
- `handleSubmit` — Send message or askUser response
- `handleAskUserResponse` — Process user selections from AskUserCard
- `handleResearchReview` — Handle research section approve/revise
- `handleSeedSubmit` — Process website URL + LinkedIn URL
- `handleNewJourney` — Create fresh session
- `handlePrefillReview` — Apply/reject prefill proposals

---

## 2. Shell Components (`src/components/shell/`)

### 2.1 AppShell (`app-shell.tsx`)

**Props**:
```tsx
interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  rightPanel?: ReactNode;
  className?: string;
}
```

**Layout Structure** (lines 25-77):
- Left sidebar: 220px expanded, 48px collapsed (hidden <lg)
- Center workspace: flex-1, max-width 720px
- Right panel: 320px wide (hidden <lg), Framer Motion slide-in/out

**Features**:
- Smooth sidebar collapse/expand with spring animation
- Right panel reveals on research progress
- Glass morphism backdrop blur (16px)
- Border styling: `var(--border-glass)`

### 2.2 AppSidebar (`app-sidebar.tsx`)

**Components**:
1. **Logo** (collapsed/expanded modes)
   - Expanded: "AI-GOS" + "v2" badge
   - Collapsed: "AI" centered

2. **Navigation** (NavItem × 6)
   - Home, Journey, Blueprints, Ad Launcher (locked), Creatives (locked), Settings

3. **Divider** — 1px border

4. **SessionList** — Recent journey sessions with status dots

5. **Spacer** — flex-1

6. **UserMenu** — Profile, logout

### 2.3 ShellProvider (`shell-provider.tsx`)

**Purpose**: Context for sidebar/right-panel collapse state
**Storage**: `localStorage[STORAGE_KEYS.SHELL_STATE]`
**Methods**:
- `toggleSidebar()`, `toggleRightPanel()`
- `setSidebarCollapsed(bool)`, `setRightPanelCollapsed(bool)`

---

## 3. Main Content Components

### 3.1 JourneyHeader (`journey-header.tsx`)

**Props**:
```tsx
interface JourneyHeaderProps {
  className?: string;
  completionPercentage?: number;
  journeyProgress?: JourneyProgress | null;
  onNewJourney?: () => void;
  statusLabel?: string;
  statusDetail?: string;
}
```

**Renders**:
- **Left side**: "EGOS" logo + divider + status label + status detail
- **Center**: Minimal spacing
- **Right side**: JourneyProgressIndicator (compact mode, hidden <xl) + NewJourneyDialog
- **Below**: Thin progress bar (2px) with blue fill representing `completionPercentage`

**Styling**: `--bg-elevated` background, `--border-default` underline

### 3.2 WelcomeState (`welcome-state.tsx`)

**Props**:
```tsx
interface WelcomeStateProps {
  onSubmit: (payload: { websiteUrl: string; linkedinUrl?: string; manualStart?: boolean }) => void;
  isLoading: boolean;
  isPrefilling?: boolean;
  fieldsFound?: number;
  errorMessage?: string | null;
  onStopPrefill?: () => void;
}
```

**Renders** (centered, max-width 640px):
1. **Badge**: "AI-GOS" label
2. **Headline**: "Build your paid media strategy." (44px, -0.03em tracking)
3. **Subheading**: Descriptive text + "~10 min to complete strategy"
4. **3-Step Grid**:
   - "1. Seed context" — website analysis
   - "2. Verify findings" — review AI discoveries
   - "3. Watch research stream" — 6 sections live
5. **Form Card**:
   - Input: "Company website" (Globe icon)
   - Input: "LinkedIn company page" (Linkedin icon)
   - Status: Prefilling indicator with field count
   - Error display (red background)
   - Buttons:
     - Primary: "Analyze website first" (blue, Sparkles icon)
     - Secondary: "Start without website analysis"
     - Tertiary: "Stop website analysis" (text-only, appears during prefill)

**Colors**:
- Step badges: accent-blue, accent-cyan, accent-green
- Primary button: `--accent-blue`
- Form bg: `--bg-hover`

### 3.3 ResumePrompt (`resume-prompt.tsx`)

**Props**:
```tsx
interface ResumePromptProps {
  session: OnboardingState;
  onContinue: () => void;
  onStartFresh: () => void;
}
```

**Renders** (Framer Motion fade-in):
- **Avatar**: Blue gradient circle (24px) with star icon
- **Badge**: "Saved journey"
- **Text**: "Welcome back. I saved your previous intake..."
  - Shows: `requiredFieldsCompleted` key answers
  - Shows: `completionPercent`% journey completion
- **Buttons**:
  - Primary: "Continue where you left off"
  - Secondary: "Start fresh"

### 3.4 JourneyPrefillReview (`journey-prefill-review.tsx`)

**Purpose**: Modal to review and approve/reject website prefill proposals

**Props**:
```tsx
interface JourneyPrefillReviewProps {
  proposals: JourneyPrefillProposal[];
  onApplyReview: (decisions: JourneyPrefillReviewDecision[]) => void;
  onSkipForNow: () => void;
}
```

**Behavior**:
- Each proposal shows: field name, original value, proposed value
- User can: accept, reject, or edit each field
- "Apply", "Skip for now" buttons
- Only shown if proposals.length > 0

### 3.5 ProfileCard (`profile-card.tsx`)

**Props**:
```tsx
interface ProfileCardProps {
  state: Partial<OnboardingState> | null;
  className?: string;
}
```

**Renders** (if answeredFields.length > 0):
- **Header**: "What I know so far" + description
  - Badge: "N/8 essentials confirmed" (e.g., "7/8")
- **Grid**: 2-column layout showing up to 8 fields with values
  - Fields: Company, Website, Model, Industry, ICP, Product, Competitors, Pricing
  - Truncated at 40 chars with ellipsis
- **Progress bar**: Animated width to show `progress` ratio
- **Next step text**: Conditional guidance

**Styling**:
- Background: `--bg-glass-panel` with blur
- Border-left: 3px `--accent-blue`
- Margins: mb-6

---

## 4. Chat Components

### 4.1 JourneyChatInput (`chat-input.tsx`)

**Props**:
```tsx
interface JourneyChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}
```

**Features**:
1. **Textarea** (auto-resizing, min 1 row, max 120px)
   - Placeholder: context-aware (varies by state)
   - Color: `--text-primary`
   - Focus ring: blue glow
2. **Slash Command Palette**
   - Triggered by "/" prefix
   - Commands: research, edit, compare, analyze, visualize
   - Navigation: arrow keys, enter to select
3. **Send Button** (36px circle)
   - Active: `--accent-blue` with glow
   - Inactive: transparent, muted color
   - Icon: Send (lucide-react, 15px)
4. **Gradient fade above**: Linear gradient top→transparent

**Focus Effects**:
- Border changes to `--border-focus`
- Box-shadow: inset glow + 2px blue ring

### 4.2 ChatMessage (`chat-message.tsx`)

**Props**:
```tsx
interface ChatMessageProps {
  role: 'user' | 'assistant';
  content?: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
  messageId?: string;
  isStreaming?: boolean;
  onToolApproval?: (approvalId: string, approved: boolean) => void;
  onToolOutput?: (toolCallId: string, result: AskUserResult) => void;
  onResearchReview?: (sectionId: string, decision: 'approved' | 'needs-revision', note?: string) => void;
  researchStreaming?: Record<string, { text: string; status: 'running' | 'complete' | 'error'; startedAt?: number }>;
  sectionReviewStates?: Record<string, string>;
  className?: string;
}
```

**Renders**:
1. **User Message**: Right-aligned bubble (border-radius 20px 20px 6px 20px)
2. **Assistant Message**:
   - Avatar: Blue gradient circle (24px) with star icon
   - Content flex container
   - Renders parts or markdown content

**Part Types Handled**:

| Part Type | Behavior |
|-----------|----------|
| `text` | Markdown rendered (headers, lists, inline formatting, code blocks) |
| `reasoning` | Wrapped in ThinkingBlock (auto-toggleable) |
| `tool-askUser` | AskUserCard (chips/pills interface) |
| `tool-scrapeClientSite` | ScrapeLoadingCard during streaming |
| `tool-competitorFastHits` | ScrapeLoadingCard during streaming |
| `tool-generateResearch` | Maps to section-specific card (MarketOverviewCard, CompetitorIntelCard, etc.) |
| Other tools | ToolLoadingIndicator or error states |

**Markdown Features**:
- Headers (H1-H3): `font-semibold`, size-based
- Bold: `**text**` → `<strong>`
- Italic: `*text*` → `<em>`
- Inline code: `` `code` `` → styled `<code>`
- Links: `[text](url)` → `<a>` with underline
- Bullet lists: `- item` → `<ul>`
- Numbered lists: `1. item` → `<ol>`
- Code blocks: ` ```lang\ncode\n``` ` with diff highlighting support

**Streaming Cursor**: `.streaming-cursor` animation when `isStreaming=true`

### 4.3 TypingIndicator (`typing-indicator.tsx`)

**Purpose**: Shows three animated dots during message submission

**Renders**:
- 3 dots (5px circles)
- Y-axis animation: [0, -6, 0]px
- Opacity: [0.4, 1, 0.4]
- Duration: 500ms, staggered 120ms apart
- Color: `--accent-blue`

---

## 5. Ask User Card (`ask-user-card.tsx`)

**Props**:
```tsx
interface AskUserCardProps {
  toolCallId: string;
  question: string;
  fieldName: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  isSubmitted: boolean;
  selectedIndices: number[];
  onSubmit: (result: AskUserResult) => void;
}
```

**Renders**:
1. **Question text** (larger font, primary color)
2. **Chip/Pill Grid** (Framer Motion staggered entry)
   - Radio chips (single select): pill-style rounded
   - Checkbox chips (multi-select): rounded with checkmark indicator
   - "Other" option: dashed border, text input on select
3. **Submit Button** (appears when selections made, disabled when submitted)
4. **State Transitions**:
   - `idle` → `selecting` → `other-input` (if other chosen) → `submitted`

**Styling**:
- Chip selected: `--bg-chip-selected`, `--accent-blue` border + glow
- Chip hover: slight scale (1.03x), shadow
- Chip active: scale 0.97x
- Button: same color as selected chips when enabled

---

## 6. Research Cards (`src/components/journey/research-cards/`)

**Common Structure**:
All research cards use `ResearchCardShell` wrapper providing:
- Header with section name + status indicator
- Content area (streaming text, rendered data, or error)
- Optional citation list
- Optional review buttons (approve/revise)

### 6.1 Card Types

| Card | File | Section ID | Data Type |
|------|------|-----------|-----------|
| Market Overview | `market-overview-card.tsx` | `industryResearch` | Market trends, TAM, seasonality, macro risks |
| Competitor Intel | `competitor-card.tsx` | `competitorIntel` | Competitor positioning, pricing, ad spend, white-space gaps |
| ICP Card | `icp-card.tsx` | `icpValidation` | ICP profiles, psychological drivers, objection handling |
| Offer Analysis | `offer-analysis-card.tsx` | `offerAnalysis` | Pricing structure, positioning, unique value |
| Strategy Summary | `strategy-summary-card.tsx` | `strategicSynthesis` | Unified strategy narrative, key recommendations |
| Keyword Intel | `keyword-intel-card.tsx` | `keywordIntel` | High-intent keywords, search volume, cost |
| Media Plan | `media-plan-card.tsx` | `mediaPlan` | Channel recommendations, budget allocation, creative themes |

### 6.2 ResearchCardCommonProps

```tsx
interface ResearchCardCommonProps<TData = Record<string, unknown>> {
  status: 'streaming' | 'complete' | 'error';
  streamingText?: string;              // Live research text as it arrives
  data?: ResearchCardData<TData>;       // Structured typed data
  citations?: Array<{ number: number; url: string; title?: string }>;
  error?: string;
  reviewStatus?: 'pending' | 'approved' | 'needs-revision';
  onApprove?: () => void;
  onRequestRevision?: (note: string) => void;
}
```

**Status Rendering**:
- `streaming`: Show streaming text + spinner
- `complete`: Show final structured data + citations
- `error`: Show error message in red box

---

## 7. Research Progress (`research-progress.tsx`)

**Props**:
```tsx
interface ResearchProgressProps {
  sectionStatuses: Record<string, SectionStatus>;
  elapsedTimes?: Record<string, number>;
  className?: string;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}
```

**Right Panel Component**:
1. **Title**: "Journey progress"
2. **Live status**: "Building [section name]"
3. **Counter**: "N of 7 complete"
4. **Timeline** (vertical):
   - Vertical line on left (border-left)
   - Dots at each section:
     - Queued: small gray dot
     - Running: blue circle with inner dot
     - Complete: green circle with checkmark
     - Error: red circle with alert icon
   - Labels + elapsed time display
5. **Refresh button** (appears when all complete)
   - Shows "Refresh all research" or "Refreshing... (5-15 min, 50% cost)"
   - Disabled state when refreshing

**Colors**:
- Queued: `--text-quaternary`
- Running: `--accent-blue`
- Complete: `--accent-green`
- Error: `--accent-red`

---

## 8. Hooks

### 8.1 useJourneyPrefill (`use-journey-prefill.ts`)

**Returns**:
```tsx
interface UseJourneyPrefillReturn {
  partialResult: DeepPartial<CompanyResearchOutput> | undefined;
  submit: (data: { websiteUrl: string; linkedinUrl?: string }) => void;
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
  fieldsFound: number;
}
```

**Behavior**:
- Calls `/api/journey/prefill` with streamObject (Vercel AI SDK)
- Normalizes URLs (adds https:// if missing)
- Counts found fields from CompanyResearchOutput
- Allows stopping mid-stream

### 8.2 useResearchData (`use-research-data.ts`)

**Returns**:
```tsx
interface UseResearchDataReturn {
  sections: Record<CanonicalResearchSectionId, ResearchSection>;
  completedSections: CanonicalResearchSectionId[];
  runningSections: CanonicalResearchSectionId[];
  allComplete: boolean;
  anyRunning: boolean;
}
```

**Purpose**: Extracts research status from messages array (tool-generateResearch parts)

---

## 9. Data Flow Summary

### 9.1 Message Flow

```
User Input
  ↓
handleSubmit()
  ↓
sendMessage({ text: content }) [Vercel AI SDK useChat]
  ↓
POST /api/journey/stream (DefaultChatTransport)
  ↓
Assistant response streams back (SSE)
  ↓
messages array updates
  ↓
ChatMessage components re-render
  ↓
Tool parts handled by renderToolPart()
```

### 9.2 Research Flow

```
Lead agent calls generateResearch tool
  ↓
Tool dispatches to Railway worker
  ↓
Worker emits SSE events: data-research-chunk, data-research-status
  ↓
onData() handler updates researchStreaming state
  ↓
ChatMessage renders section-specific card
  ↓
Card shows streaming text → completes with data
```

### 9.3 Onboarding State Persistence

```
User selects option in AskUserCard
  ↓
handleAskUserResponse() → setConfirmedField()
  ↓
setOnboardingState(updated)
  ↓
persistConfirmedState() [PATCH /api/journey/session]
  ↓
Supabase journey_sessions.onboarding_state updated
```

---

## 10. Styling Strategy

### CSS Variables Used

| Variable | Purpose | Example |
|----------|---------|---------|
| `--bg-base` | Main background | Body, scrollable areas |
| `--bg-elevated` | Header background | JourneyHeader |
| `--bg-hover` | Card hover state | Chip chips, card backgrounds |
| `--bg-glass-panel` | Glass morphism panels | Sidebar, right panel |
| `--bg-chip-selected` | Selected chip background | AskUserCard |
| `--text-primary` | Main text | Headings, primary copy |
| `--text-secondary` | Secondary text | Body copy |
| `--text-tertiary` | Tertiary text | Help text, captions |
| `--accent-blue` | Primary CTA | Buttons, active states |
| `--accent-blue-glow` | Blue shadow | Focus states |
| `--border-default` | Standard borders | Cards, inputs |
| `--border-glass` | Glass panel borders | Sidebar dividers |
| `--border-subtle` | Subtle borders | Separators |
| `--logo-gradient` | Gradient text | "AI-GOS", "EGOS" |
| `--font-heading` | Heading font | DM Sans or Instrument Sans |
| `--font-mono` | Monospace font | JetBrains Mono |

### Glassmorphism Pattern

```tsx
style={{
  background: 'var(--bg-glass-panel)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--border-glass)',
}}
```

---

## 11. Key Interaction Patterns

### Slash Command Palette (JourneyChatInput)

1. User types `/`
2. Palette opens with filtered commands
3. Arrow keys to navigate, Enter to select
4. Selected command inserted: `/research `
5. Textarea focus automatically restored

### Chip Selection (AskUserCard)

**Single Select**:
1. Click chip → selectedIndices becomes [index]
2. Submit button enables
3. Click submit → onSubmit with { fieldName, selectedLabel, selectedIndex }

**Multi-Select**:
1. Click chips → selectedIndices accumulates
2. Submit button enables
3. Click submit → onSubmit with { fieldName, selectedLabels, selectedIndices }

**Other Option**:
1. Click "Other" chip → text input appears
2. Type custom response
3. Submit → onSubmit with { fieldName, otherText }

### Research Review (ChatMessage → journey-page)

1. User opens research card (auto-expanded on complete)
2. Clicks "Approve" → onResearchReview called with decision='approved'
3. Or clicks "Revise" + enters note → onResearchReview with decision='needs-revision'
4. Handler invalidates related sections, clears streaming state, sends revision message

---

## 12. Component Hierarchy Tree

```
JourneyPage
└── ShellProvider
    └── JourneyPageContent
        └── AppShell
            ├── AppSidebar
            │   ├── Logo
            │   ├── nav (NavItem × 6)
            │   ├── Divider
            │   ├── SessionList
            │   ├── Spacer
            │   └── UserMenu
            ├── main (center workspace)
            │   ├── JourneyHeader
            │   │   ├── Status label/detail
            │   │   ├── JourneyProgressIndicator
            │   │   └── NewJourneyDialog
            │   └── [Phase Content]
            │       ├── WelcomeState (phase 0)
            │       │   └── Form inputs + buttons
            │       └── Chat Section (phase 1+)
            │           ├── ResumePrompt | JourneyPrefillReview | ChatMessages
            │           ├── ProfileCard
            │           ├── ChatMessage[] (map over messages)
            │           │   ├── UserMessage (right-aligned bubble)
            │           │   └── AssistantMessage
            │           │       ├── Avatar
            │           │       └── Rendered parts
            │           │           ├── Text (markdown)
            │           │           ├── Reasoning (ThinkingBlock)
            │           │           ├── Tool parts
            │           │           │   ├── AskUserCard
            │           │           │   ├── ScrapeLoadingCard
            │           │           │   ├── JourneyResearchCard
            │           │           │   │   └── Section-specific card
            │           │           │   │       (MarketOverviewCard, etc.)
            │           │           │   └── EditApprovalCard
            │           │           └── Streaming cursor
            │           ├── TypingIndicator
            │           ├── Error display
            │           └── JourneyChatInput
            │               ├── SlashCommandPalette
            │               ├── textarea
            │               └── Send button
            └── Right Panel
                └── ResearchProgress
                    └── Timeline (StatusDot × 7)
```

---

## 13. State Management Overview

### Journey Page State

| State | Type | Purpose | Storage |
|-------|------|---------|---------|
| `messages` | UIMessage[] | Chat history | Memory |
| `onboardingState` | Partial<OnboardingState> | Collected user data | localStorage + Supabase |
| `researchStreaming` | Record<sectionId, stream> | Live research text | Memory |
| `showResumePrompt` | boolean | Show resume dialog | Memory |
| `prefillReviewOpen` | boolean | Show prefill review | Memory |
| `hasStartedJourney` | boolean | Phase transition flag | Memory |
| `sessionId` | string \| null | Active session UUID | localStorage + Memory |
| `transportBody` | Record<string, any> | Chat transport payload | Memory |

### Shell State (ShellProvider)

| State | Type | Storage |
|-------|------|---------|
| `sidebarCollapsed` | boolean | localStorage[SHELL_STATE] |
| `rightPanelCollapsed` | boolean | localStorage[SHELL_STATE] |

---

## 14. Animation & Motion

**Library**: Framer Motion

**Patterns Used**:
- Spring animations (sidebar, right panel): `stiffness: 300-350, damping: 30-35`
- Fade-in: `initial: { opacity: 0 }, animate: { opacity: 1 }`
- Scale entrance: `initial: { scale: 0.92 }, animate: { scale: 1 }`
- Staggered children: `staggerChildren` on container
- Custom springs: Defined in `src/lib/motion` (e.g., `springs.smooth`, `springs.snappy`)

**Components Using Motion**:
- AskUserCard: Chip staggered entry
- ResumePrompt: Fade in + y slide
- ResearchProgress: StatusDot scale in
- Sidebar: Spring collapse/expand
- Right panel: Slide in/out

---

