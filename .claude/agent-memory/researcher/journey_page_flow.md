---
name: Journey Page Complete User Flow
description: Comprehensive trace of all journeyPhase values and UI transitions from start to finish
type: reference
---

# Journey Page User Flow (src/app/journey/page.tsx)

## Journey Phase Type
```typescript
type JourneyPhaseView = 'welcome' | 'prefilling' | 'review' | 'resume' | 'chat' | 'workspace';
```

**Line 107** in page.tsx

---

## Phase Flow Diagram

```
WELCOME
  ↓ (user enters URL → onAnalyze)
PREFILLING
  ↓ (prefill completes → onComplete)
REVIEW
  ↓ (user accepts fields → handleStartFromUnifiedReview)
WORKSPACE (artifact-first, research running)
  ↓ (parallel: chat agent available)
CHAT (conversational overlay during workspace)
```

Alternative paths:
- WELCOME → RESUME → CHAT (if session exists in localStorage)
- WELCOME → CHAT (file upload path)
- Deep-link with ?session= or ?section= → jumps straight to WORKSPACE

---

## Phase-by-Phase Breakdown

### 1. WELCOME Phase (Initial State)
**When**: Page loads (no deep-link, no saved session)
**Line**: 384-385 (useState initial value)

```typescript
const [journeyPhase, setJourneyPhase] = useState<JourneyPhaseView>(
  deepLinkSession || deepLinkSection ? 'workspace' : 'welcome',
);
```

**UI Rendered** (lines 2141-2157):
- `WelcomeForm` component
- Two input fields:
  - Company Website (required)
  - LinkedIn Company Page (optional)
- File upload button (N&D document)
- CTA button "Analyze {company}"

**User Actions**:
1. **Enter URL + click "Analyze"** → calls `onAnalyze(websiteUrl, linkedinUrl)`
   - Handler at line 2143-2149
   - Sets `prefillWebsiteUrl` state
   - Calls `submitPrefill({ websiteUrl, linkedinUrl })`
   - Transitions: `setJourneyPhase('prefilling')`
   - Logs: "Analyzing {url}"

2. **Upload N&D document** → calls `onFileUpload(file)`
   - Handler at line 1285-1412
   - Extracts fields from PDF/doc
   - Transitions to 'chat' phase (line 1388) **bypassing prefilling**
   - Logs extracted fields or error

---

### 2. PREFILLING Phase
**Triggered By**: User submits URL in welcome form
**Line**: `setJourneyPhase('prefilling')` at line 2147

**What It Does**:
- `useJourneyPrefill` hook (lines 391-398) calls `/api/journey/prefill` endpoint
- Uses Vercel AI SDK's `experimental_useObject` with `companyResearchSchema` Zod schema
- Streams partial structured company data from Claude
- Shows real-time progress as fields are extracted from website

**useJourneyPrefill Hook** (`src/hooks/use-journey-prefill.ts`):
```typescript
export function useJourneyPrefill(): UseJourneyPrefillReturn {
  const { object, submit: submitObject, isLoading, error, stop } = useObject({
    api: '/api/journey/prefill',
    schema: companyResearchSchema,
    fetch: guardedFetch,
  });
  // Returns: { partialResult, submit, isLoading, error, stop, fieldsFound }
}
```

**submitPrefill Arguments** (line 85-92 in hook):
```typescript
submit = useCallback(
  (data: { websiteUrl: string; linkedinUrl?: string }) => {
    const websiteUrl = normalizeOptionalUrl(data.websiteUrl);
    submitObject({
      websiteUrl,
      linkedinUrl: normalizeOptionalUrl(data.linkedinUrl),
    });
  },
  [submitObject],
);
```

**UI Rendered** (lines 2117-2132):
```typescript
const prefillWorkspace = (
  <PrefillStreamView
    partialResult={partialResult}
    fieldsFound={fieldsFound}
    isPrefilling={isPrefilling}
    error={prefillError}
    websiteUrl={prefillWebsiteUrl}
    onRetry={() => {
      stopPrefill();
      setPrefillWebsiteUrl('');
      setJourneyPhase('welcome');  // Back to welcome
    }}
    onComplete={() => setJourneyPhase('review')}  // Forward to review
  />
);
```

Shows `PrefillStreamView` component with:
- Live field extraction progress
- Count of fields found
- Retry button (goes back to welcome)
- Complete button (goes to review)

**Transition Out**:
- `onComplete()` callback triggered when extraction finishes
- Transitions: `setJourneyPhase('review')` (line 2130)

---

### 3. REVIEW Phase
**Triggered By**: Prefill completes successfully
**Line**: `setJourneyPhase('review')` at line 2130

**What It Does**:
- Shows `UnifiedFieldReview` component (lines 2134-2139)
- Displays extracted fields in flat Record<string, string> format (lines 400-411)
- User can edit extracted values OR add manual overrides
- Validates required fields before allowing proceed

**Extracted Fields State** (lines 400-411):
```typescript
const extractedFieldsFlat = useMemo(() => {
  const flat: Record<string, string> = {};
  if (prefillWebsiteUrl) flat.websiteUrl = prefillWebsiteUrl;
  // Read fields from partialResult and flatten them
  const record = partialResult as Record<string, unknown> | null | undefined;
  if (!record) return flat;
  for (const key of Object.keys(record)) {
    const value = readJourneyPrefillFieldValue(record, key);
    if (value) flat[key] = value;
  }
  return flat;
}, [partialResult, prefillWebsiteUrl]);
```

**UI Rendered**:
- `UnifiedFieldReview` with editable field rows
- Shows company name, industry, ICP, pricing, etc.
- Buttons: "Back" (retry prefill) → "Start Research" (accept fields)

**User Actions**:
1. **Click "Start Research"** → calls `handleStartFromUnifiedReview(onboardingData)`
   - Handler at lines 1556-1620
   - Validates all required fields are filled (lines 1559-1575):
     - JOURNEY_REQUIRED_FIELD_KEYS (from field-catalog.ts)
     - At least one JOURNEY_PRICING_GROUP_KEYS field
   - If validation fails: logs error, returns early
   - If validation passes:
     - Creates new journey run ID
     - Persists fields to Supabase (PATCH `/api/journey/session`)
     - Transitions: `setJourneyPhase('workspace')` (line 1511)
     - **Dispatches first research section** (`industryMarket`) (line 1537)

2. **Click "Back"** (implicit in UnifiedFieldReview):
   - Transitions back to welcome
   - Clears prefill state

---

### 4. WORKSPACE Phase (Artifact-First)
**Triggered By**: User accepts prefill review fields
**Line**: `setJourneyPhase('workspace')` at line 1511

**What It Does**:
- **Replaces entire chat layout** with `WorkspacePage` component
- Shows artifact panel on right, research cards on left
- Research dispatcher active (fires initial research section)
- User can review artifact results, approve/request changes, move to next section
- When ready, can approve and transition to CHAT phase (implicitly, during workspace use)

**Workspace Rendering** (lines 2174-2234):
```typescript
if (journeyPhase === 'workspace') {
  return (
    <div className="flex h-screen flex-col font-sans">
      <div className="flex flex-1 min-h-0">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-h-0 min-w-0">
          <WorkspaceProvider sessionId={activeRunId ?? 'default'} startInWorkspace ...>
            <WorkspacePage
              userId={user?.id}
              activeRunId={activeRunId}
              onSectionApproved={handleWorkspaceSectionApproved}
            />
          </WorkspaceProvider>
        </div>
      </div>
    </div>
  );
}
```

**Key Differences from Chat Phase**:
- Full-screen artifact-driven layout (not conversational)
- WorkspacePage manages all section research
- No chat message scroll area
- Artifact panel takes prominence
- User explicitly approves sections to advance

**First Dispatch** (lines 1536-1546):
```typescript
addLog('run', `Dispatching ${SECTION_META['industryMarket'] ?? 'Market Overview'}...`);
return dispatchResearchSection('industryMarket', nextRunId, context);
```

Calls `dispatchResearchSection()` from `src/lib/journey/dispatch-client.ts`:
- Sends HTTP POST to `/api/journey/dispatch`
- Passes: section, activeRunId, context (onboarding fields as text)
- Fires-and-forgets (no await in render path)
- Research worker processes asynchronously

**Transition to CHAT** (implicit):
- Does NOT explicitly call `setJourneyPhase('chat')`
- User stays in workspace while research runs
- Chat phase used for conversational refinement **alongside** workspace

---

### 5. CHAT Phase (Conversational Onboarding + Research)
**Triggered By**: Either:
1. Direct: `setJourneyPhase('chat')` from resume/file-upload path (lines 1388, 1430, 1443)
2. Implicit: User navigates back from workspace (WorkspacePage doesn't transition phase)

**When Chat is Used** (line 1735):
```typescript
const showChatView = journeyPhase === 'chat';
```

**UI Rendered** (lines 1812-2084):
- `JourneyStepper` showing research progress
- Left panel: Chat conversation area
  - Initial welcome message (resuming or fresh)
  - Chat messages + tool calls
  - Research inline cards (non-artifact sections)
  - Terminal logs
  - Chat input at bottom
- Right panel (if `artifactOpen`): Artifact review panel (60% width)

**Conditional Rendering Within Chat**:

```typescript
const standardWorkspace = showChatView
  ? chatWorkspace                    // ← Chat mode renders here
  : showResumeView
    ? resumeWorkspace
    : journeyPhase === 'prefilling'
      ? prefillWorkspace
      : journeyPhase === 'review'
        ? reviewWorkspace
        : welcomeWorkspace;
```

**Research State in Chat** (lines 1836-1888):
- If `isResearchGenerating` (activeResearch.size > 0 && !pendingAskUser):
  - Shows "Research in progress" message
  - Hides chat messages temporarily
  - Shows progress panel, terminal logs, worker status
  - Input disabled until research completes
- Once research results arrive:
  - Shows research inline cards (for non-artifact sections)
  - Shows artifact trigger cards (for artifact sections like industryMarket)
  - User can click to open artifact panel

**Tool Interactions**:
- `askUser` tool: Shows interactive field input within chat (lines 1120-1141)
- Artifact approval: User clicks "Looks Good" → toggles approval state (line 1709)
- Artifact feedback: User clicks "Request Changes" → enters feedback mode (line 1252-1265)

---

### 6. RESUME Phase
**Triggered By**: Page loads with saved session in localStorage
**Line**: `setJourneyPhase('resume')` at line 542

**When It Fires**:
- User returns to `/journey` page
- localStorage contains `JOURNEY_SESSION` key (persisted onboarding state)
- Shows `ResumePrompt` component (lines 2105-2115)

**UI Rendered**:
```typescript
const resumeWorkspace = (
  <ResumePrompt
    session={savedSession!}
    onContinue={handleResumeContinue}
    onStartFresh={handleResumeStartFresh}
  />
);
```

Shows:
- Summary of previous session fields
- Two buttons: "Continue" or "Start Fresh"

**User Actions**:

1. **Click "Continue"** → `handleResumeContinue()` (lines 1428-1444)
   - Loads saved session from localStorage
   - Extracts answered fields via `getAnsweredFields(savedSession)`
   - Sets `resumeTransportState` (passed to chat agent for context)
   - Sets `isResuming = true` (changes welcome message)
   - Transitions: `setJourneyPhase('chat')` (line 1443)
   - Logs: "Resuming previous session"

2. **Click "Start Fresh"** → `handleResumeStartFresh()` (lines 1446-1454)
   - Clears localStorage (line 1447)
   - Starts new journey run
   - Transitions: `setJourneyPhase('welcome')` (line 1452)
   - Logs: "Starting fresh journey"

---

## Deep-Link Behavior

**Lines 340-370** (URL query parameter parsing):
```typescript
const deepLinkSession = searchParams.get('session');
const deepLinkSection = searchParams.get('section');
const deepLinkMediaPlan = searchParams.get('mediaPlan');
```

**Impact on Initial Phase** (line 384-385):
```typescript
const [journeyPhase, setJourneyPhase] = useState<JourneyPhaseView>(
  deepLinkSession || deepLinkSection ? 'workspace' : 'welcome',
);
```

If URL has `?session=X` or `?section=Y`, **skips all onboarding** and goes straight to workspace:
- Assumes previous session exists in Supabase
- Loads artifact for that section
- User never sees welcome/prefill/review phases

---

## Full Reference: All setJourneyPhase Calls

| Line | Trigger | From Phase | To Phase | Handler |
|------|---------|-----------|---------|---------|
| 385 | Initial state (no deep-link) | - | welcome | useState |
| 385 | Deep-link (?session= or ?section=) | - | workspace | useState |
| 542 | Session loaded from localStorage | - | resume | useEffect |
| 1388 | File upload extracts fields | welcome | chat | handleFileUpload |
| 1430 | Resume continue (no saved session) | resume | chat | handleResumeContinue |
| 1443 | Resume continue (with saved session) | resume | chat | handleResumeContinue |
| 1452 | Resume start fresh | resume | welcome | handleResumeStartFresh |
| 1511 | Accept prefill review fields | review | workspace | handleStartFromUnifiedReview |
| 1600 | Start from unified review | review | workspace | handleStartFromUnifiedReview |
| 2128 | Prefill retry | prefilling | welcome | PrefillStreamView.onRetry |
| 2130 | Prefill complete | prefilling | review | PrefillStreamView.onComplete |
| 2147 | User submits URL in welcome | welcome | prefilling | WelcomeForm.onAnalyze |

---

## Chat vs Workspace: Key Difference

| Aspect | CHAT Phase | WORKSPACE Phase |
|--------|-----------|-----------------|
| **Layout** | Left panel (chat) + optional right panel (artifact) | Full-screen artifact-driven |
| **Entry** | From resume/file-upload OR implicit during workspace | From accepted prefill review |
| **Research Flow** | Chat agent manages (tools dispatch, synthesize) | Frontend dispatch (direct to worker) |
| **User Interaction** | Conversational (messages + tools) | Artifact review (approve/request changes) |
| **Artifact Visibility** | Triggered on-demand (click card to open) | Always visible (right panel) |
| **Next Section** | Chat agent decides via system prompt | User approves, handler dispatches next |
| **When Used** | Default interactive mode | Initial artifact-first review |

---

## submitPrefill Contract

**Called From**: WelcomeForm.onAnalyze (line 2146)
**Signature**: `submitPrefill({ websiteUrl: string, linkedinUrl?: string })`
**Implementation**: `useJourneyPrefill` hook

**What It Does**:
1. Normalizes URLs (adds https:// if missing)
2. Calls `submitObject()` from Vercel AI SDK's `experimental_useObject`
3. Sends POST to `/api/journey/prefill` with website/LinkedIn URLs
4. Streams back `CompanyResearchOutput` schema-compliant structured data
5. Updates `partialResult` state as fields arrive (real-time streaming)

**Outputs**:
- `partialResult`: `DeepPartial<CompanyResearchOutput>` (undefined until data arrives)
- `fieldsFound`: Count of successfully extracted fields
- `isPrefilling`: Boolean (true while request in flight)
- `error`: Error | undefined
- `stop()`: Function to abort prefill request

---

## Workspace Onboarding Context

**Line 1505**: Prefill-accepted fields become context:
```typescript
const lines: string[] = ["Here's what I found about the company:"];
for (const key of orderedFieldKeys) {
  const value = acceptedJourneyFields[key]?.trim();
  if (!value) continue;
  lines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
}
lines.push('', 'Please use this context and begin the research journey.');
```

**Context Persisted To**:
- Supabase `journey_sessions.metadata` (lines 1518-1527)
- PATCH `/api/journey/session` with `fields` object
- activeRunId stamped to link session to run

**Context Used By**:
- First research dispatch (industryMarket): context sent as string (line 1537)
- Subsequent dispatches: context re-read from Supabase when user approves section (lines 2183-2213)

---

## showChatView Conditional Logic

**Line 1735**:
```typescript
const showChatView = journeyPhase === 'chat';
```

**When True**: Renders `chatWorkspace` (conversational mode)
**When False**: Renders phase-specific UI (welcome/prefilling/review/resume) or workspace

**Related Conditionals**:
- `showResumeView = journeyPhase === 'resume'` (line 1736)
- `if (journeyPhase === 'workspace')` → early return with full WorkspacePage (line 2174)

---

## Key State Snapshot at Each Phase

| Phase | journeyPhase | activeRunId | researchResults | messages | pendingAskUser |
|-------|--|--|--|--|--|
| welcome | 'welcome' | null | {} | [] | null |
| prefilling | 'prefilling' | null | {} | [] | null |
| review | 'review' | null | {} | [] | null |
| workspace (initial) | 'workspace' | "uuid" | {} | [] | null |
| workspace (researching) | 'workspace' | "uuid" | {industryMarket: {status:'complete'}} | [] | null |
| chat | 'chat' | "uuid" | {sections...} | [user, assistant, ...] | {toolCallId, fieldName} \| null |

