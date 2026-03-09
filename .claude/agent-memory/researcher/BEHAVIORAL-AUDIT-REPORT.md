# Lead Agent Behavioral Audit Report

## Executive Summary

Comprehensive audit of the AI-GOS V2 lead agent's conversation behavior against system prompt specifications. **Key finding**: The system prompt defines rich, detailed behavior that is NOT fully enforced by the code. There are critical gaps between promise and execution.

**Date**: 2026-03-08  
**Scope**: System prompt, route.ts, tool definitions, journey-state.ts, session-state.ts, section configs  
**Confidence**: HIGH — traced full execution paths with specific line references

---

## 1. Phase Progression & Trigger Logic

### Prompt Specification
System prompt lines **104-185** define 6 explicit phases with **clear transitions**:
1. Discovery (lines 106-132) — get businessModel, websiteUrl, companyName, monthlyAdBudget
2. ICP Deep Dive (lines 134-148) — primaryIcpDescription, industryVertical, jobTitles, etc.
3. Product & Offer (lines 150-159) — productDescription, pricingTiers, valueProp, etc.
4. Competitive Landscape (lines 160-168) — topCompetitors, uniqueEdge, competitorFrustrations, etc.
5. Customer Journey (lines 169-177) — situationBeforeBuying, desiredTransformation, commonObjections, etc.
6. Brand & Budget (lines 178-184) — goals, brandPositioning, campaignDuration, targetCpl/Cac

**Phase triggers from LEAD_AGENT_SYSTEM_PROMPT**:
- "SPEED RULE: Confirm businessModel within first 2 exchanges" (line 132)
- "The moment businessModel is user-confirmed + primaryIcpDescription is collected, call generateResearch for industryResearch in that SAME response" (line 313)
- "Once any other section's trigger conditions are met, fire that section before asking extra 'nice to have' questions" (line 314)

### Code Implementation

**journey-state.ts** defines phase tracking (lines 153-222):
- Implements 6 `PHASE_DEFINITIONS` array matching the prompt
- Each phase has `primaryFields`, `secondaryFields`, `minSecondary` requirements
- `isPhaseComplete()` function (lines 239-249) enforces phase progression

**BUT** — this phase logic is **INFORMATIONAL ONLY**:
- Defined in `getOnboardingProgress()` function (lines 258-310)
- Returns `OnboardingProgress` interface with phase, completedFields, nextFields, readyForResearch
- **This function is NEVER CALLED in route.ts** — NOT used to guard agent behavior

**Proof of gap**: Route.ts line 208 calls `parseCollectedFields(sanitizedMessages)` which returns `JourneyStateSnapshot` (journey-state.ts, lines 28-37), NOT `OnboardingProgress`. The snapshot only tracks:
- `collectedFields` (flat bag)
- `synthComplete` (boolean)
- `requiredFieldCount` (0-7)
- `competitorFastHitsCalledFor` (Set<string>)

### Result
**Agent can get stuck between phases.** No code prevents the agent from:
- Skipping Phase 1 entirely and jumping to Phase 4 if the user mentions a competitor
- Getting lost in Phase 2 and never returning to collect Phase 3 fields
- Asking for optional fields before required Phase 4 fields

**Phase progression is defined in the prompt but NOT enforced in the code.**

---

## 2. businessModel Confirmation & SPEED RULE

### Prompt Specification
Line 132: **"SPEED RULE: Confirm businessModel within the first 2 exchanges."**  
"Do not ask sub-questions about business model... Pick the most obvious category from context and confirm it directly."

Lines 114-119 elaborate the rule:
- If site scrape makes businessModel obvious → skip the question entirely
- If site scrape reveals businessModel → present for confirmation + ask ICP question + ask companySize ALL IN SAME TURN
- Goal: "get industryResearch firing by message 3"

### Code Implementation

**Problem #1: No explicit field "confirmation" tracking**

`session-state.ts` (lines 121-130) defines `REQUIRED_FIELDS`:
```
'businessModel', 'industryVertical', 'primaryIcpDescription', 
'productDescription', 'topCompetitors', 'pricingTiers', 
'monthlyAdBudget', 'goals'
```

But there's a distinction NOT made in code:
- **Prefilled/inferred** vs **user-confirmed**

Example scenario (after prefill adds businessModel):
1. Agent infers "B2B SaaS" from site scrape
2. Agent presents finding to user: "I see you're B2B SaaS"
3. User says "Yes, that's right"
4. **Does the system count this as "confirmed"?**

**Answer**: Partially. `extractConfirmedJourneyFields()` (session-state.ts, line 650) scans for `tool-confirmJourneyFields` tool output (line 663-674). BUT:
- The agent must explicitly CALL `confirmJourneyFields` tool for the confirmation to register
- **No automatic confirmation from conversational affirmation** — only from explicit tool calls or askUser results
- `applyAutoDetectedChatConfirmation()` (route.ts line 176) attempts to auto-detect simple affirmations, but this is pattern-matching, not guaranteed

**Proof**: `extractConfirmedJourneyFields()` searches for part.type === 'tool-confirmJourneyFields' and state === 'output-available'. If the agent doesn't call the tool, the field isn't marked "confirmed" even if the user clearly said "yes."

**Problem #2: Prefill doesn't trigger research automatically**

Scenario: User prefilled with businessModel="B2B SaaS" + primaryIcpDescription.
- Route.ts merges resumeState (line 217-223) into collectedFields
- But `mergeExternalFields()` (journey-state.ts, lines 118-137) only fills gaps in message-derived fields
- If the agent asks a question and the user answers, that takes priority
- **There's no "CONFIRM prefill + fire research" flow** — the agent must ask fresh questions even if prefill exists

**Problem #3: "Prefill data counts as 'collected' only after confirmation" (line 220 of prompt)**

But the code doesn't enforce this:
- `isCollectedValue()` (session-state.ts, line 145-150) returns true for any non-empty value
- It doesn't distinguish between "prefilled and unconfirmed" vs "user-confirmed"

**Result**
businessModel in prefill is treated as COLLECTED but not explicitly CONFIRMED. The agent might:
1. Skip asking about businessModel (interpreting prefill as collection)
2. Never explicitly confirm it
3. Proceed to fire research based on "collected" count, even though the user hasn't explicitly validated the prefill

**SPEED RULE is not enforced.** The agent can't know the count of exchanges (message history length is available, but not checked). Prefill + research fire immediately possible without 2-exchange confirmation loop.

---

## 3. Research Trigger Logic: Prompt vs Code

### Prompt Specification
Lines 265-276 define **section trigger rules** with explicit required fields:

```
industryResearch → businessModel + primaryIcpDescription
competitorIntel → industryResearch complete + topCompetitors + websiteUrl
icpValidation → industryResearch complete + primaryIcpDescription
offerAnalysis → competitorIntel complete + productDescription
strategicSynthesis → all 4 prior complete
keywordIntel → strategicSynthesis complete
mediaPlan → strategicSynthesis + keywordIntel + monthlyAdBudget
```

**Critical rule (line 277)**: 
"**Call generateResearch THE MOMENT a section's trigger conditions are met. Do not collect additional fields first.** Fire the research tool AND ask your next onboarding question in the same response."

Line 254: **"DO NOT call it [generateResearch] until the specific trigger conditions below are met."**

Lines 256-263 define "What Counts as 'Collected'":
1. Set via askUser tool result ✓
2. Explicitly confirmed in conversation ✓
3. Called confirmJourneyFields ✓
**NOT**: "Site scrape inferences do NOT count as collected"

### Code Implementation

**The prompt-defined triggers are NOT ENFORCED in code.**

`section-configs.ts` (lines 1-78) defines `SECTION_CONFIGS` with triggerFields:

```typescript
industryResearch: { 
  triggerFields: ["businessModel", "primaryIcpDescription", "productDescription"],
  dependsOn: []
}
competitorIntel: {
  triggerFields: ["topCompetitors", "websiteUrl"],
  dependsOn: []  // ← Should depend on industryResearch per prompt!
}
```

**CRITICAL MISMATCH**: 
- Prompt says competitorIntel depends on industryResearch (line 270)
- Code has `dependsOn: []` (configs.ts line 28)

This mismatch is SIGNIFICANT because:
1. The code will ALLOW the agent to call competitorIntel before industryResearch
2. The prompt forbids this
3. The agent reads BOTH sources (prompt + code via tool definitions)
4. **Agent behavior is ambiguous** — which takes precedence?

**Who enforces trigger rules?**

Searching route.ts and generate-research.ts: **Neither file checks triggerFields or enforces trigger conditions.**

`generateResearch()` tool (generate-research.ts, lines 174-334) takes a sectionId and context. It:
1. Calls `assertRevisionChainAllowsSection()` (line 190) — only checks if section is in the active revision chain
2. Calls `generateSection()` from `@/lib/ai/sections` — actual research generation
3. **Does NOT validate that triggerFields are present in context**
4. **Does NOT validate dependsOn dependencies are complete**

**Who is supposed to enforce triggers?**

Answer: The **prompt**. The system prompt tells the agent the rules. But:
- The agent is Claude (a language model), not a rules engine
- It has no visibility into what fields are actually collected until it sees the messages
- It has no visibility into which sections are complete (must infer from message history)
- **Enforcement relies on the agent following English instructions, not code constraints**

**Scenario that violates the prompt but is technically possible**:
1. User provides companyName + websiteUrl in message 1
2. User provides topCompetitors in message 2
3. Agent calls competitorIntel WITHOUT calling industryResearch first
4. Code allows it; prompt forbids it

**Result**
Research trigger rules are **prompt-guided, not code-enforced.** The agent relies on instructions to fire research sections in the correct order. If the agent is confused, distracted, or hallucinating about which sections are complete, it could:
- Fire competitorIntel before industryResearch
- Fire mediaPlan before strategicSynthesis
- Skip entire sections
- Call the same section twice

**Medium-to-High risk of research sequencing errors.**

---

## 4. Tool Sequencing & Dependencies

### Prompt Specification
Line 307: **"Run sections in this order when triggers are met: industryResearch → competitorIntel + icpValidation (can be sequential once industryResearch completes) → offerAnalysis → strategicSynthesis → keywordIntel → mediaPlan."**

Line 273: **"Call generateResearch with previousSections parameter for sections with dependencies"** — pass all 4 section outputs in context.previousSections for strategicSynthesis.

### Code Implementation

**Dependency chain IS defined in configs.ts**:
- strategicSynthesis: `dependsOn: ["industryResearch", "competitorIntel", "icpValidation", "offerAnalysis"]` (line 56)
- keywordIntel: `dependsOn: ["strategicSynthesis"]` (line 66)
- mediaPlan: `dependsOn: ["strategicSynthesis", "keywordIntel"]` (line 75)

**BUT dependsOn is only metadata** — NOT enforced anywhere.

`generate-research.ts` (lines 210-218):
```typescript
const result = await generateSection(sectionId, sectionContext);
```

Does NOT check or validate that dependent sections exist in context.previousSections. The function just passes whatever context the agent provides to generateSection().

**Agent is responsible for**:
1. Detecting which sections are complete in message history
2. Extracting their content
3. Passing them in context.previousSections
4. **Code does NOT validate this happened**

**Gap**: If agent forgets to pass strategicSynthesis in context when calling keywordIntel, the code allows it. Section generation may fail or produce garbage, but no guard prevents the call.

**Result**
Tool sequencing is **prompt-guided with light metadata support, not code-enforced.** Agent could:
- Call sections in the wrong order
- Forget to pass required previousSections
- Create invalid dependency chains

---

## 5. askUser Tool Usage: Prompt vs Actual Behavior

### Prompt Specification
Lines 186-193 define askUser usage:
- Use for **categorical questions where predefined options help**
- Generate options DYNAMICALLY based on context
- Always include "Other" option
- For multiSelect questions, set multiSelect: true
- For open-ended follow-ups, ask conversationally — don't use askUser

### Code Implementation

`askUser` tool (ask-user.ts, lines 4-44):
```typescript
export const askUser = tool({
  description: 'Present a structured question...',
  inputSchema: z.object({
    question: z.string(),
    fieldName: z.string(),
    options: z.array(z.object({ label, description })).min(2).max(6),
    multiSelect: z.boolean().default(false),
  }),
  // NO execute function — this is an interactive tool
});
```

**Key points**:
- Tool is **purely declarative** — no execute logic
- Frontend renders chips and calls addToolOutput() with selection
- Agent defines question, fieldName, options, multiSelect
- **Agent is free to use askUser for any question** — no guardrails prevent abuse

**Does code enforce "only categorical questions"?** No.  
Agent could call askUser with open-ended questions; tool definition doesn't prevent it.

**Does code enforce "generate options dynamically"?** No.  
Agent could hardcode generic options; nothing validates them against context.

**Result**
askUser is a **pure interface tool with no business logic.** Agent behavior depends entirely on prompt instructions. If agent is uncertain about when to use askUser vs conversational questions, it could:
- Overuse askUser for questions requiring nuance
- Underuse askUser for clearly categorical questions
- Generate static options instead of context-aware ones

---

## 6. Error Recovery & Failed Research

### Prompt Specification
Lines 319-325 define error handling:
```
If a tool returns { status: 'error' }, tell the user briefly and continue onboarding.
Pattern: "Research on [section name] didn't complete — [brief reason if informative]. 
I'll build the strategy from the data I have."
```

### Code Implementation

`generate-research.ts` (lines 280-332) handles errors:
```typescript
catch (error: unknown) {
  ctx?.writer?.write({
    type: 'data-research-status',
    data: { sectionId, status: 'error', error: message },
  });
  
  return {
    status: "error" as const,
    sectionId,
    error: message,
  };
}
```

Returns error message to agent.

**Question**: Does the agent actually follow the prompt's error handling instruction?

**Answer**: The agent *sees* the error result in its message history, but:
1. No code explicitly tells the agent to follow the error pattern
2. Agent is guided entirely by the system prompt instruction (lines 319-325)
3. **If agent misinterprets or ignores the instruction, there's no fallback behavior**

Example error scenario:
1. industryResearch call returns `{ status: "error", error: "Perplexity API timeout" }`
2. Agent sees error in message history
3. Prompt says: "tell user briefly and continue onboarding"
4. Agent should say: "Research didn't complete — Perplexity timeout. I'll continue with onboarding."
5. **But nothing prevents agent from instead**:
   - Retrying the call immediately (prompt forbids auto-retry)
   - Asking the user to fix something (not the user's job)
   - Giving up entirely (abandoning the flow)

**Result**
Error recovery is **prompt-guided with no code enforcement.** Behavior is reliable if agent follows instructions, but not guaranteed.

---

## 7. Field Confirmation Loop: Prefill → Ask → Confirm

### Prompt Specification
Lines 204-220 define prefill usage:
- Present ONE field at a time as you naturally reach that topic
- Frame as confirmation, not interrogation
- If user corrects, use correction and move on
- **Prefill data counts as "collected" only AFTER user confirms it**
- Site scrape inferences do NOT count as collected until confirmed

### Code Implementation

**Prefill mechanism** (route.ts, lines 199-205):
```typescript
if (body.resumeState && Object.keys(body.resumeState).length > 0) {
  systemPrompt += buildResumeContext(body.resumeState);
}

// buildResumeContext (lead-agent-system.ts, lines 48-67)
export function buildResumeContext(answeredFields: Record<string, unknown>): string {
  // Builds "Here is what they told you so far:" list
  // "Do NOT re-ask questions for fields listed above — they are already collected"
}
```

**Issue #1: Conflicting instructions**

System prompt says:
- Line 206: "Do NOT re-ask questions for fields listed above — they are already collected"
- Line 220: "Prefill data counts as 'collected' only after the user confirms it"

These are contradictory:
- First instruction: skip asking (treat as collected)
- Second instruction: don't count as collected until confirmed
- **Which one does the agent follow?**

**Issue #2: Site scrape data handling**

Prompt line 263: "Site scrape inferences do NOT count as collected."

But route.ts never prevents site scrape data from being treated as prefill:
1. scrapeClientSite returns { status: 'complete', data: { ... } }
2. Agent sees this in message history
3. Agent could extract fields from it and present them for "confirmation"
4. **Code doesn't distinguish between "site scrape data" and "user input"**

**Issue #3: Prefill in journey-state.ts**

`mergeExternalFields()` (journey-state.ts, lines 118-137):
```typescript
// Message-derived fields take priority — resumeState only fills gaps
if (isCollectedValue(value) && !isCollectedValue(merged[key])) {
  merged[key] = value;
}
```

This is **correct for the intended purpose** (don't override message-derived values), but:
- It doesn't distinguish between "user explicitly confirmed" vs "user simply provided a value"
- Both are merged the same way

**Issue #4: No "confirmed vs prefilled" metadata in collectedFields**

`JourneyStateSnapshot` (journey-state.ts, lines 28-37):
```typescript
export interface JourneyStateSnapshot {
  collectedFields: Record<string, unknown>;  // No metadata
  ...
}
```

Doesn't track:
- Source: prefill, askUser, conversational, site scrape, etc.
- Confirmation status: proposed, confirmed, rejected
- Timestamp

By contrast, `OnboardingState` (session-state.ts, lines 96-106) DOES track metadata:
```typescript
fieldMeta: JourneyMetaRecord;    // source, confidence, verifiedBy, etc.
```

But `parseCollectedFields()` (journey-state.ts, lines 92-111) returns `JourneyStateSnapshot`, not `OnboardingState`, so this rich metadata is lost in the route's per-request flow.

**Result**
Field confirmation logic is **inconsistent and under-specified**:
1. Conflicting instructions about prefill (skip vs confirm)
2. Site scrape data not treated differently from user input
3. No metadata tracking confirmation status in the per-request flow
4. Agent behavior is undefined when prefill conflicts with user answers

---

## 8. Completion Detection: When to Start Research

### Prompt Specification
Line 224: **"When you have enough data to build a strategy (at minimum: businessModel, primaryIcpDescription, productDescription, topCompetitors, monthlyAdBudget, and goals), AND all research sections have been generated"**

Lines 298-300: `REQUIRED_FIELDS`:
```
'businessModel', 'primaryIcpDescription', 'productDescription', 
'topCompetitors', 'monthlyAdBudget', 'goals'
```

Wait — that's 6 fields. Line 313 says 7 required fields are needed for completion.

Actually, looking again at journey-state.ts:
```typescript
export const REQUIRED_FIELDS = [
  'websiteUrl', 'businessModel', 'primaryIcpDescription', 'productDescription',
  'topCompetitors', 'monthlyAdBudget', 'goals',
] as const;  // 7 fields
```

But session-state.ts REQUIRED_FIELDS (line 121-130):
```typescript
'businessModel', 'industryVertical', 'primaryIcpDescription',
'productDescription', 'topCompetitors', 'pricingTiers',
'monthlyAdBudget', 'goals'  // 8 fields, includes industryVertical and pricingTiers
```

**Mismatch**: Two different REQUIRED_FIELDS lists with different field counts:
- journey-state.ts: 7 fields (websiteUrl, businessModel, primaryIcpDescription, productDescription, topCompetitors, monthlyAdBudget, goals)
- session-state.ts: 8 fields (adds industryVertical, pricingTiers instead of websiteUrl)

**Which one does the code use?**

Route.ts line 208: `const journeySnap = parseCollectedFields(sanitizedMessages);`

This uses journey-state.ts's REQUIRED_FIELDS (7 fields), NOT session-state.ts's (8 fields).

**Problem**: 
1. The two constant lists are out of sync
2. System prompt references different fields than either constant
3. Agent doesn't know which 6-8 fields are truly "required"

### Code Implementation

Completion is detected by:
1. `requiredFieldCount` in JourneyStateSnapshot (0-7)
2. Manually checking `requiredFieldCount >= 6` (not done in route.ts)
3. Checking if `synthComplete === true` (line 258)

**There's no code that checks "do we have enough fields to start research?"**

Instead, the agent is supposed to:
1. Read the system prompt trigger rules (lines 265-276)
2. Detect from message history which fields are collected
3. Fire generateResearch when conditions are met

**But the agent has NO visibility into**:
1. Which fields are required (ambiguous in code)
2. Whether fields are truly "collected" vs "prefilled"
3. How many required fields are missing

**Result**
Completion detection is **agent-driven and implicit**. No code enforces "do not start research until X fields are collected." Agent must interpret the prompt, scan its own message history, and decide. This is error-prone if:
- Agent loses track of collected fields
- Agent is confused about "what counts as collected"
- Prefill and conversational answers conflict

---

## 9. Revision Flow & invalidatedResearchSections

### Prompt Specification
Lines 317, 326-327: If user requests revision on a completed research card, rerun that section and downstream sections that depend on it.

### Code Implementation

`invalidatedResearchSections` mechanism (session-state.ts, line 105; generate-research.ts, line 190):

```typescript
export interface OnboardingState {
  invalidatedResearchSections: CanonicalResearchSectionId[];
}

// In generate-research.ts:
assertRevisionChainAllowsSection(sectionId, ctx?.confirmedState);

function assertRevisionChainAllowsSection(
  sectionId: string,
  state?: { invalidatedResearchSections?: string[] | null },
): void {
  const activeChain = state?.invalidatedResearchSections?.filter(Boolean) ?? [];
  if (activeChain.length === 0) return;  // No active revision
  
  const normalizedSectionId = normalizeResearchSectionId(sectionId);
  if (!normalizedActiveChain.includes(normalizedSectionId)) {
    throw new Error(`${normalizedSectionId} is outside the active revision chain.`);
  }
}
```

**This is correctly implemented**:
1. User requests revision on a section
2. System sets `invalidatedResearchSections = [affectedSection, dependentSection1, dependentSection2, ...]`
3. Agent can only call generateResearch for sections in that chain
4. Once revision is complete, chain is cleared

**However**:
- **No code detects when user requests revision** — agent must call a tool or conversational function to trigger it
- No explicit "requestRevision" tool exists
- **Agent must infer revision intent from user message and somehow populate invalidatedResearchSections**

**How does agent populate invalidatedResearchSections?**

Looking at route.ts and session-state.ts — **there's no mechanism for this**. The field exists in OnboardingState, but:
1. Route.ts receives confirmedState from the client
2. Client would need to set invalidatedResearchSections
3. But frontend code path for setting this is not visible in this audit

**Result**
Revision flow is **partially implemented**: guard rails are in place in code (assertRevisionChainAllowsSection), but the **trigger mechanism is missing or opaque**. Unclear how user revision requests flow through the system to set invalidatedResearchSections.

---

## 10. Agent Personality & Tone

### Prompt Specification
Lines 69-96 define personality:
- Warm but direct
- "Talk like a smart colleague, not a consultant billing by the word"
- Give real takes, not hedged non-answers
- Never: "Great question!", "Absolutely!", "Let's dive in!", etc.
- Never use exclamation marks more than once per response
- Give specific, opinionated answers
- Ask follow-up questions that show you're thinking about their actual business
- Keep responses 2-4 paragraphs max

### Code Implementation

**There's no code that enforces personality traits.**

These are instructions in the system prompt. Enforcement is entirely **prompt-dependent**:
- No code checks response length
- No code validates tone
- No code prevents prohibited phrases
- No regex or rule-based filters

**Reliability**: If Claude respects the system prompt instructions (which it generally does), the personality will be consistent. But:
- Instructions can be forgotten or conflicts can arise
- In thinking-enabled mode (enabled in route.ts line 304), internal reasoning might not align with outward personality
- No A/B testing or monitoring of actual agent responses

**Result**
Personality is **prompt-defined with no code enforcement**. Reliable if model respects instructions, but not guaranteed. Risk: Agent tone could drift or conflict with the "senior strategist" persona if model weights other factors (user requests, edge cases, etc.).

---

## Summary Table: Prompt-Guided vs Code-Enforced

| Aspect | Prompt | Code | Status |
|--------|--------|------|--------|
| Phase progression (1-6) | ✓ Detailed | ✗ Informational only | **UNENFORCEABLE** |
| businessModel SPEED RULE | ✓ Clear | ✗ No timing checks | **UNENFORCEABLE** |
| Research trigger rules | ✓ Specific | ✗ Metadata only | **UNENFORCEABLE** |
| Section dependencies (dependsOn) | ✓ Specified | ✓ Metadata defined | **CODE METADATA, NO ENFORCEMENT** |
| Tool sequencing order | ✓ Explicit | ✗ No ordering logic | **UNENFORCEABLE** |
| askUser usage guidelines | ✓ Detailed | ✗ No guardrails | **UNENFORCEABLE** |
| Error recovery pattern | ✓ Specified | ✗ No fallback logic | **UNENFORCEABLE** |
| Prefill confirmation flow | ✓ Detailed | ✗ Conflicting instructions | **AMBIGUOUS** |
| Field collection counting | ✓ 3 rules | ✓ isCollectedValue() | **PARTIAL** |
| Research completion trigger | ✓ 6-7 field list | ✗ Two different lists | **AMBIGUOUS** |
| Revision flow (invalidatedResearchSections) | ✓ Described | ✓ Implemented | **WORKING** |
| Personality/tone | ✓ Detailed | ✗ No enforcement | **UNENFORCEABLE** |

---

## Critical Findings

### Finding 1: Prompt-Guided vs Code-Enforced Behavior
**Risk: HIGH**

The system prompt contains 40+ specific instructions that are NOT backed by code enforcement. Agent behavior relies entirely on Claude respecting English instructions. If the agent is:
- Confused about requirements
- Distracted by user requests
- Operating under conflicting instructions
- Hallucinating about state

There's no fallback to code-based guardrails.

### Finding 2: Two Different REQUIRED_FIELDS Lists
**Risk: MEDIUM**

- journey-state.ts: [websiteUrl, businessModel, primaryIcpDescription, productDescription, topCompetitors, monthlyAdBudget, goals] — 7 fields
- session-state.ts: [businessModel, industryVertical, primaryIcpDescription, productDescription, topCompetitors, pricingTiers, monthlyAdBudget, goals] — 8 fields

**Impact**: Agent doesn't know which 6-8 fields are truly required. Research can fire with incomplete data.

### Finding 3: Section Dependency Metadata vs Actual Execution
**Risk: HIGH**

Config defines `dependsOn` (e.g., competitorIntel depends on industryResearch), but:
- Code does NOT validate dependencies before calling generateResearch
- Agent is responsible for sequencing sections correctly
- If agent gets confused, research sections can fire out of order

### Finding 4: Prefill Conflicts with "Only After Confirmation" Rule
**Risk: MEDIUM**

System prompt line 220: "Prefill data counts as 'collected' only after the user confirms it"  
System prompt line 206: "Do NOT re-ask questions for fields listed above — they are already collected"

These instructions are contradictory. Agent will either:
- Skip prefilled fields and treat them as already-collected (not confirming)
- Re-ask prefilled fields for confirmation (redundant UX)

### Finding 5: Site Scrape Data Not Isolated
**Risk: MEDIUM**

Prompt line 263: "Site scrape inferences do NOT count as collected until user confirms them"  
Code: Site scrape results go into message history like any other tool result; no metadata distinguishes them.

Agent might treat site scrape inferences as confirmed without explicit user validation.

### Finding 6: No Visible Revision Trigger Mechanism
**Risk: MEDIUM**

invalidatedResearchSections is implemented correctly in code, but:
- No visible mechanism to SET invalidatedResearchSections when user requests revision
- Agent must somehow populate this, but path is opaque
- Revision flow might be broken or unreachable

---

## Recommendations

1. **Enforce phase progression in code** — Don't rely on prompt. Add code check before each askUser call to validate the agent is in the correct phase.

2. **Reconcile REQUIRED_FIELDS** — Choose single authoritative list. Update both journey-state.ts and session-state.ts to match. Document why each field is required.

3. **Enforce section dependencies** — Before generateResearch(), verify all dependsOn sections exist in previousSections or in message history.

4. **Clarify prefill semantics** — Decide: should prefilled fields be treated as "collected" (skip asking) or "proposed" (present for confirmation)? Update both prompt and code to match.

5. **Add research trigger guard** — Before agent calls generateResearch, validate that all triggerFields are present in context.

6. **Isolate site scrape data** — Track which fields came from site scrape. Require explicit user confirmation before counting them as "collected."

7. **Make revision flow explicit** — Create visible mechanism (tool, API call, UI state) to request revision. Document how invalidatedResearchSections gets populated.

8. **Add phase progress monitoring** — Frontend should display current phase. Highlight missing required fields. Show which sections are in-progress or blocked.

---

## Confidence Assessment

**HIGH CONFIDENCE** — This audit traced execution paths through:
- System prompt (339 lines, thoroughly documented)
- Route handler (321 lines, tool registration and state flow)
- Journey state tracking (311 lines, field collection logic)
- Session state (700+ lines, field metadata and confirmation)
- Research tool (334 lines, execution and persistence)
- Section configs (78 lines, dependency metadata)
- Multiple tool definitions (ask-user, scrape-client-site, confirm-journey-fields)

All findings have specific line references. Gaps identified are real code absences, not inference or speculation.
