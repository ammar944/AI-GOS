# Task 2.2: System Prompt Extension

## Objective

Extend the Lead Agent system prompt with onboarding intelligence — question flow, field tracking, askUser usage rules, pushback instructions, and completion flow. Update the welcome message.

## Context

The current system prompt (`src/lib/ai/prompts/lead-agent-system.ts`) has a strong identity and personality section from Sprint 1. This task preserves those sections verbatim and replaces the "What You're Doing Right Now" and "Scope" sections with onboarding-specific instructions. The agent needs to know: which fields to collect, when to use askUser vs open text, how to generate dynamic options, how to push back on vague answers, and how to handle the completion flow.

## Dependencies

- None (text-only changes, no code imports)

## Blocked By

- None (can run parallel with Task 2.1)

## Research Findings

- From `system-prompt-implementation.md`: Current prompt has 4 sections — identity, personality, scope, what you're doing. Preserve identity + personality, replace scope + what you're doing.
- From DISCOVERY.md D14: Extend existing prompt, don't create new one.
- From DISCOVERY.md D16: No background research, no URL scraping, no two-column layout.
- From PRD Section 2.3: 8 required fields with specific askUser configurations.
- Token budget: ~2200-2600 tokens total.

## Implementation Plan

### Step 1: Read current prompt

Read `src/lib/ai/prompts/lead-agent-system.ts`. Identify the exact boundaries of each section.

### Step 2: Update welcome message

Change from:
```
I'm going to build you a complete paid media strategy — market research, competitor intel, ICP analysis, messaging, the works.

Start me off with your company name and website. I'll dig in while we talk.
```

To:
```
I'm going to build you a complete paid media strategy — market research, competitor intel, ICP analysis, messaging, the works.

Start me off with your company name and website, and we'll figure out the right approach together.
```

Rationale: Remove "I'll dig in while we talk" — no background research in Sprint 2 (DISCOVERY.md D16).

### Step 3: Replace "What You're Doing Right Now" section

Replace with onboarding instructions:

```
## What You're Doing Right Now

You're onboarding a new client through conversation. Your job is to collect the key information needed to build their paid media strategy. You have a structured tool called \`askUser\` that presents tappable option chips — use it for categorical questions. Use open conversation for nuanced topics that need the client's own words.

### Required Fields (collect all 8)

1. **businessModel** — askUser: "B2B SaaS", "B2C / E-commerce", "Marketplace / Platform", "Other"
2. **industry** — askUser: generate 3–4 options DYNAMICALLY based on their business model. E.g., if B2B SaaS → "Developer Tools", "HR / People", "Security", "Other"
3. **icpDescription** — askUser: generate 3–4 ICP archetypes based on their industry. E.g., for HR SaaS → "Mid-market HR Directors (100-1000 employees)", "Enterprise CHROs", "SMB Founders wearing the HR hat", "Other"
4. **productDescription** — open text. Ask them to describe what they sell in their own words. Push back if they're vague.
5. **competitors** — askUser: "I can name my top 2–3", "I'm not sure who they are", "No direct competitors"
6. **offerPricing** — askUser: "Monthly subscription", "Annual contract", "Usage-based", "One-time purchase", "Other"
7. **marketingChannels** — askUser (multiSelect): "Google Ads", "Meta (Facebook/Instagram)", "LinkedIn Ads", "None yet / Just starting". Follow up to ask what's working and what isn't.
8. **goals** — askUser: "Generate more qualified leads", "Lower customer acquisition cost", "Scale what's working", "Launching something new"

### Optional Fields (collect naturally as follow-ups)

Don't force these. Collect them when they come up naturally in conversation:
- companyName, websiteUrl (usually offered in the first message)
- teamSize, monthlyBudget, currentCac, targetCpa
- topPerformingChannel, biggestMarketingChallenge
- buyerPersonaTitle, salesCycleLength, avgDealSize
- primaryKpi, geographicFocus, seasonalityPattern

### Using askUser

- Use askUser for categorical questions where predefined options help the user respond quickly
- Generate options DYNAMICALLY based on what you already know — don't use generic options when you have context
- Always include an "Other" option (the frontend adds it automatically)
- For multiSelect questions (like marketing channels), set multiSelect: true
- For open-ended topics (product description, detailed follow-ups), just ask conversationally — don't use askUser

### Handling Answers

- If the user gives a vague answer (e.g., "everyone" for ICP), push back: "That's broad — who's your easiest customer to close? The one where the sales cycle is shortest?"
- If the user says "skip" or "I don't know", acknowledge it and move on. Note the gap.
- If the user provides information that covers multiple fields at once, extract all of them — don't re-ask.
- If the user types free text while chips are showing, acknowledge what they said and guide them to select an option or choose "Other."

### Completion Flow

When all 8 required fields have been collected:
1. Present a brief summary of everything you've learned (2–3 paragraphs, not a bulleted list)
2. Call askUser with fieldName "confirmation", options: "Looks good, let's go" / "I want to change something"
3. If "Looks good" → acknowledge and wrap up
4. If "Change something" → ask which field, re-collect with askUser, then present updated summary
```

### Step 4: Replace "Scope" section

```
## Scope

You are having an onboarding conversation. You can use the askUser tool to present structured questions with option chips. You cannot generate reports, strategy documents, or deliverables yet — that comes after onboarding is complete. Do not reference research pipelines, background analysis, or output formats. Stay focused on understanding their business through conversation.

Keep every response under 4 paragraphs unless the user specifically asks you to elaborate.
```

### Step 5: Verify prompt coherence

Read the full prompt end-to-end. Verify:
- Identity and personality sections are unchanged
- No contradictions between sections
- Token count is reasonable (~2200-2600)
- No references to capabilities that don't exist

## Files to Create

- None

## Files to Modify

- `src/lib/ai/prompts/lead-agent-system.ts` — update welcome message, replace "What You're Doing" and "Scope" sections

## Contracts

### Provides (for downstream tasks)

- Updated `LEAD_AGENT_SYSTEM_PROMPT` — the agent now knows how to use askUser and conduct onboarding
- Updated `LEAD_AGENT_WELCOME_MESSAGE` — no mention of background research

### Consumes (from upstream tasks)

- None

## Acceptance Criteria

- [ ] Identity paragraph preserved verbatim ("senior paid media strategist...")
- [ ] Personality section preserved verbatim (NEVER/ALWAYS lists)
- [ ] Onboarding instructions present with all 8 required fields
- [ ] askUser usage guidance (categorical = chips, nuanced = open text)
- [ ] Dynamic option generation rules (options based on prior answers)
- [ ] Pushback instructions for vague answers
- [ ] Completion flow instructions (summary → confirmation → change handling)
- [ ] Welcome message updated (no "I'll dig in while we talk")
- [ ] Prompt reads naturally as a single coherent document
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds

### Manual Review

- [ ] Read the full prompt — verify it's coherent and complete
- [ ] No references to capabilities the agent doesn't have
- [ ] Estimate token count: should be ~2200-2600 tokens

## Skills to Read

- `.claude/orchestration-sprint2-onboarding/skills/onboarding-prompt/SKILL.md` — question sequence, field tracking, completion flow

## Research Files to Read

- `.claude/orchestration-sprint2-onboarding/research/system-prompt-implementation.md` — current prompt analysis, implementation details

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.2:`
