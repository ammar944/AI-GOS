---
name: Journey Session Hooks & Research Renderers Architecture
description: Complete mapping of research hooks (useResearchRealtime, useResearchJobActivity), component renderers (ResearchInlineCard, ArtifactPanel), API endpoints, Supabase patterns, and how data flows from Journey session to UI
type: reference
---

# Journey Research Hooks & Renderers Architecture

Complete findings from codebase audit for research result display, polling/subscription patterns, and runId-scoped data filtering.

## 1. Run-Scoped Session Hooks

### Hook: `useResearchRealtime`
**File**: `src/lib/journey/research-realtime.ts` (lines 86-216)

**Signature**:
```typescript
function useResearchRealtime({
  userId: string | null | undefined;
  activeRunId?: string | null;
  onSectionComplete: (section: string, result: ResearchSectionResult) => void;
  onTimeout?: (pendingSections: string[]) => void;
  timeoutMs?: number;
  resetSignal?: number;  // Increment to reset internal seen-sections state
  ignoreUpdatedBefore?: string | null;
}): void
```

**Behavior**:
- Polls `buildJourneySessionUrl(activeRunId)` every 2 seconds
- Calls `onSectionComplete()` when new research sections appear in `research_results`
- Uses `seenResults` Map to dedupe via `getResearchResultSignature()` (compares status/section/data/error/durationMs/telemetry)
- Filters results by `doesJourneyRunMatchActiveRun()` to ensure runId matches
- Applies `isJourneySessionRowFresh()` check against `ignoreUpdatedBefore` to ignore stale pre-reset snapshots
- Applies sandbox section resets via `applyJourneySandboxSectionResets()`
- **Timeout**: 5 minutes (configurable) on pending sections

---

### Hook: `useResearchJobActivity`
**File**: `src/lib/journey/research-job-activity.ts` (lines 187-273)

**Signature**:
```typescript
function useResearchJobActivity({
  userId: string | null | undefined;
  activeRunId?: string | null;
  resetSignal?: number;
  ignoreUpdatedBefore?: string | null;
}): Record<string, ResearchJobActivity>
```

**ResearchJobActivity interface** (lines 46-49):
```typescript
interface ResearchJobActivity extends ResearchJobStatusRow {
  jobId: string;
  section: string;
}
```

**Behavior**:
- Polls `buildJourneySessionUrl(activeRunId)` every 2 seconds
- Extracts `job_status` field from response
- Returns latest job per section (by timestamp: completedAt > lastHeartbeat > startedAt)
- Applies same run-matching and freshness checks as useResearchRealtime

---

## 2. API Endpoint: Journey Session Snapshot

**File**: `src/app/api/journey/session/route.ts`

### GET `/api/journey/session?runId=<activeRunId>`

**Response Format** (lines 87-102):
```typescript
{
  metadata: Record<string, unknown> | null;
  researchResults: Record<string, unknown> | null;  // Only if runId matches
  jobStatus: Record<string, unknown> | null;        // Only if runId matches
  runId: string | null;
  updatedAt: string | null;
}
```

**Run Filtering Logic** (lines 82-94):
```typescript
const requestedRunId = new URL(request.url).searchParams.get('runId');
const storedRunId = getJourneyRunIdFromMetadata(metadata);
const runMatches = !requestedRunId || requestedRunId === storedRunId;

return {
  researchResults: runMatches ? data?.research_results : null,
  jobStatus: runMatches ? data?.job_status : null,
  runId: storedRunId,
}
```

---

## 3. Research Result Data Contracts

**File**: `src/lib/journey/research-result-contract.ts` (lines 33-47)

```typescript
interface StoredResearchResult<
  TData = unknown,
  TSection extends string = CanonicalResearchSectionId,
> {
  status: 'complete' | 'partial' | 'error';
  section: TSection;
  data?: TData;
  error?: string;
  durationMs: number;
  rawText?: string;
  citations?: ResearchCitation[];
  provenance?: ResearchProvenance;
  validation?: ResearchValidationMetadata;
  telemetry?: ResearchTelemetry;
}
```

---

## 4. Component: ResearchInlineCard
**File**: `src/components/journey/research-inline-card.tsx`

**Props**:
```typescript
interface ResearchInlineCardProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  data?: Record<string, unknown>;
  activity?: ResearchJobActivity;
  error?: string;
  durationMs?: number;
  sourceCount?: number;
  onViewFull?: () => void;
  className?: string;
}
```

**Renders**:
- **Loading**: Shows module number, live worker activity, started time, heartbeat
- **Complete**: Shows metrics (section-specific), expandable details
- **Error**: Shows error message

**Metric Extraction** (lines 40-93):
- `industryMarket`: Market Size, Maturity, Category
- `competitors`: Competitor count
- `icpValidation`: Final verdict status
- `offerAnalysis`: Overall score (0-10)
- `crossAnalysis`: Insights + platforms count
- `keywordIntel`: Total keywords + gaps
- `mediaPlan`: Channel count + monthly budget

---

## 5. Component: ArtifactPanel
**File**: `src/components/journey/artifact-panel.tsx`

**Props**:
```typescript
interface ArtifactPanelProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  data?: Record<string, unknown>;
  activity?: ResearchJobActivity;
  approved: boolean;
  onApprove: () => void;
  feedbackMode?: boolean;
  onRequestChanges: () => void;
  onClose: () => void;
  showCloseButton?: boolean;
  showReviewControls?: boolean;
}
```

**Main Export** (lines 1124-1135):
Renders section-specific document components:
- `industryMarket` → `IndustryMarketDocument`
- `competitors` → `CompetitorIntelDocument`
- `icpValidation` → `ICPValidationDocument`
- `offerAnalysis` → `OfferAnalysisDocument`
- `crossAnalysis` → `CrossAnalysisDocument`
- `keywordIntel` → `KeywordIntelDocument`
- `mediaPlan` → `MediaPlanDocument`

**Progressive Reveal**: Blocks render 200ms apart on complete status

---

## 6. Supabase Client Patterns

**File**: `src/lib/supabase/server.ts`

### Anon Client (with Clerk JWT)
```typescript
export async function createClient() {
  const { getToken } = await auth();
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await getToken({ template: "supabase" })) ?? null;
      },
    }
  );
}
```

### Admin Client (Service Role)
```typescript
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

**Used in `/api/journey/session`** (line 30):
```typescript
const supabase = createAdminClient();
return supabase
  .from('journey_sessions')
  .select('metadata, research_results, job_status, updated_at')
  .eq('user_id', userId)
  .maybeSingle();
```

---

## 7. Journey Run ID Management

**File**: `src/lib/journey/journey-run.ts`

### Storage
- **Session Storage Key**: `aigos_journey_active_run_id` (sessionStorage)
- **Metadata Key**: `activeJourneyRunId` (in journey_sessions.metadata JSONB)

### Core Functions
```typescript
export function createJourneyRunId(): string  // crypto.randomUUID()
export function getStoredJourneyRunId(): string | null  // from sessionStorage
export function setStoredJourneyRunId(activeRunId: string | null): void
export function getJourneyRunIdFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null
export function doesJourneyRunMatchActiveRun(activeRunId: string | null | undefined, candidateRunId: string | null | undefined): boolean
export function buildJourneySessionUrl(activeRunId: string | null | undefined): string  // /api/journey/session?runId=...
```

---

## 8. Section Metadata

**File**: `src/lib/journey/section-meta.ts`

```typescript
export const SECTION_META: Record<string, SectionMeta> = {
  industryMarket:    { label: 'Market Overview', moduleNumber: '01' },
  competitors:       { label: 'Competitor Intel', moduleNumber: '02' },
  icpValidation:     { label: 'ICP Validation', moduleNumber: '03' },
  offerAnalysis:     { label: 'Offer Analysis', moduleNumber: '04' },
  crossAnalysis:     { label: 'Strategic Synthesis', moduleNumber: '05' },
  keywordIntel:      { label: 'Keywords', moduleNumber: '06' },
  mediaPlan:         { label: 'Media Plan', moduleNumber: '07' },
};
```

---

## 9. Data Flow

```
User Action → create activeRunId = createJourneyRunId()
    ↓
setStoredJourneyRunId(activeRunId) → sessionStorage
PATCH /api/journey/session { activeRunId }
    ↓
Supabase: metadata.activeJourneyRunId = UUID
    ↓
Lead agent dispatches research → Railway worker
    ↓
Railway writes:
  - research_results.industryMarket = { status: 'complete', data: {...} }
  - job_status.job-1 = { status: 'complete', tool: 'industryResearch' }
    ↓
Frontend hooks poll GET /api/journey/session?runId=<activeRunId>
    ↓
API filters: IF runId === metadata.activeJourneyRunId THEN return results
    ↓
useResearchRealtime() → onSectionComplete(section, result)
useResearchJobActivity() → returns Record<section, ResearchJobActivity>
    ↓
Components render:
  - ResearchInlineCard (preview)
  - ArtifactPanel (full detail)
```

---

## 10. Confidence & Gotchas

**Confidence: HIGH** — traced all hooks, API endpoints, and component signatures with exact line numbers.

**Key Gotchas**:
1. Run ID matching is **two-layered**: sessionStorage + server-side metadata check in API
2. Result normalization happens in both useResearchRealtime and components
3. Polling is **every 2s, not true Realtime** — no websocket currently
4. Job status deduped by section (latest timestamp wins across retries)
5. Progressive reveal in ArtifactPanel is 200ms per block

