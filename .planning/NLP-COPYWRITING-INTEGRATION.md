# NLP Copywriting Integration Plan

## Source
DT Thomas's "Copywriting AI Prompts & Training" Notion database
- Subconscious Advertising Newsletter author
- Focus: NLP, Hypnosis, Behavioral Psychology, Pattern Interrupts

---

## Key Insights from the Training Doc

### 1. The Expert Persona (System Prompt Pattern)
```
Pretend to be the greatest direct response copywriter ever, with over $1 billion 
in sales. You've mastered Hypnosis, NLP, Behavioral Psychology, and Pattern 
Interrupt Techniques, while studying under Gary Halbert, Eugene Schwartz, 
David Ogilvy, and Joe Sugarman.
```
**Integration:** Add this persona framing to Section 5 (Cross-Analysis) for messaging/positioning generation.

### 2. Persuasion Elements Framework

**Pattern Interrupt Techniques:**
- Controversial statements
- Unexpected revelations
- Status quo challenges
- Industry myth-busting
- Reality checks
- Paradigm shifts

**NLP Language Patterns:**
- Presuppositions
- Embedded commands
- Future pacing
- Time distortion
- Casual linkage
- Double binds
- Tag questions
- Anchoring phrases

**Hypnotic Writing Elements:**
- Pacing statements
- Leading language
- Emotional transitions
- Mental imagery
- Nested loops
- Story weaving
- Time collapse
- Future memories

**Behavioral Triggers:**
- Identity alignment
- Cognitive dissonance
- Value attribution
- Social comparison
- Commitment/consistency
- Authority positioning
- Scarcity response
- Loss aversion

**Attention Holding Devices:**
- Open loops
- Story hooks
- Curiosity gaps
- Revelation promises
- Sequential disclosure
- Mystery elements
- Anticipation building
- Micro-commitments

### 3. Customer Psychographics Framework
Questions to research for each ICP:
- Goals and Dreams
- Fears and Insecurities
- Embarrassing Situations They AVOID
- How does my offer/product help them achieve their goals?
- Why is my product their best option? Why us?
- What alternative solutions have they used and why didn't they work?
- Why would they choose one of our competitors instead of us?
- **Who/what is to blame for their problems? Who/what is the enemy?**

### 4. Statistics for Proof
- Find proof, statistics, quotes, and relevant data
- Build bullet-proof sales arguments based on FACTS
- Include references for everything
- Focus on: ICP pains + power of the solution

### 5. Personal Story / Day-in-the-Life
Generate 1st person journal entries from ICP perspective:
- Day-to-day life
- Pains and insecurities
- Problems
- Dreams
- Make it emotional and dramatic

---

## Where to Integrate in AI-GOS

### Section 2: ICP Analysis (Enhancement)
**Current:** Basic ICP validation
**Add:** Customer Psychographics deep dive

```typescript
// NEW: Add to icp-analysis.ts schema
customerPsychographics: z.object({
  goalsAndDreams: z.array(z.string())
    .min(3).max(5)
    .describe('Top 3-5 aspirational goals and dreams this ICP has related to the problem space'),
  
  fearsAndInsecurities: z.array(z.string())
    .min(3).max(5)
    .describe('Deep-seated fears and insecurities that keep them up at night'),
  
  embarrassingSituations: z.array(z.string())
    .min(2).max(4)
    .describe('Specific embarrassing situations they actively try to avoid'),
  
  perceivedEnemy: z.string()
    .describe('Who or what do they blame for their problems? The "villain" in their story'),
  
  failedSolutions: z.array(z.string())
    .min(2).max(4)
    .describe('Alternative solutions they have tried that did not work, and why'),
    
  dayInTheLife: z.string()
    .describe('A vivid, emotional 1st-person journal entry describing a typical frustrating day for this ICP (2-3 paragraphs)')
})
```

### Section 5: Cross-Analysis (Major Enhancement)
**Current:** Basic positioning and messaging
**Add:** Full messaging framework with copywriting angles

```typescript
// NEW: Replace simple messaging with comprehensive framework
messagingFramework: z.object({
  // Core Message
  coreMessage: z.string()
    .describe('The ONE thing you want the audience to remember. Simple, memorable, differentiated.'),
  
  // Positioning
  positioningStatement: z.string()
    .describe('For [ICP] who [pain], [Product] is the [category] that [key benefit] because [reason to believe].'),
  
  // Ad Hooks (Pattern Interrupts)
  adHooks: z.array(z.object({
    hook: z.string(),
    technique: z.enum(['controversial', 'revelation', 'myth-bust', 'status-quo-challenge', 'curiosity-gap', 'story']),
    targetAwareness: z.enum(['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware'])
  })).min(5).max(10)
    .describe('5-10 attention-grabbing hooks using pattern interrupt techniques. Each should stop the scroll.'),
  
  // Angles (Different ways to approach the sale)
  angles: z.array(z.object({
    name: z.string(),
    description: z.string(),
    targetEmotion: z.string(),
    exampleHeadline: z.string()
  })).min(4).max(6)
    .describe('4-6 distinct advertising angles: pain-focused, aspiration-focused, fear-focused, curiosity-focused, social proof, enemy-focused'),
  
  // Proof Points
  proofPoints: z.array(z.object({
    claim: z.string(),
    evidence: z.string(),
    source: z.string().optional()
  })).min(3).max(6)
    .describe('3-6 bullet-proof claims backed by statistics, studies, or testimonials'),
  
  // Objection Handlers
  objectionHandlers: z.array(z.object({
    objection: z.string(),
    response: z.string(),
    reframe: z.string()
  })).min(4).max(8)
    .describe('4-8 common objections with persuasive responses and reframes'),
  
  // Tonal Guidelines
  tonalGuidelines: z.object({
    voice: z.string().describe('How the brand should sound (e.g., "confident but not arrogant, expert but approachable")'),
    avoidWords: z.array(z.string()).describe('Words/phrases to avoid'),
    useWords: z.array(z.string()).describe('Power words to incorporate'),
    emotionalRange: z.string().describe('The emotional journey of the copy')
  })
})
```

### NEW Section: Creative Brief Generator
**Where:** After Section 5, or as a separate "Section 6"
**Purpose:** Generate ready-to-use creative briefs for ads

```typescript
// NEW: creativeBrief schema
creativeBrief: z.object({
  // For each ad type
  coldTrafficVideo: z.object({
    hook: z.string(),
    problem: z.string(),
    agitate: z.string(),
    solution: z.string(),
    cta: z.string(),
    tone: z.string()
  }),
  
  coldTrafficImage: z.object({
    primaryText: z.string(),
    headline: z.string(),
    description: z.string(),
    imageDirection: z.string()
  }),
  
  retargetingAds: z.array(z.object({
    audience: z.string(),
    objectionHandled: z.string(),
    hook: z.string(),
    cta: z.string()
  })).min(3).max(5)
})
```

---

## Implementation Steps

### Step 1: Update ICP Schema (Section 2)
File: `/lib/ai/schemas/icp-analysis.ts`
- Add `customerPsychographics` object
- Add `.describe()` hints with the psychographic questions

### Step 2: Update Cross-Analysis Schema (Section 5)
File: `/lib/ai/schemas/cross-analysis.ts`
- Replace basic `messagingFramework` with comprehensive version
- Add `adHooks` with technique classification
- Add `angles` with emotional targeting
- Add `proofPoints` with evidence
- Add `objectionHandlers`

### Step 3: Update Research Functions
File: `/lib/ai/research.ts`
- Update `researchICPAnalysis()` prompt to include psychographics
- Update `synthesizeCrossAnalysis()` with expert copywriter persona
- Add persuasion framework guidance to system prompts

### Step 4: Add Copywriting Persona to Prompts
For messaging/angles generation, prepend:
```
You are an expert direct response copywriter with deep knowledge of:
- NLP language patterns (presuppositions, embedded commands, future pacing)
- Pattern interrupt techniques (controversial hooks, myth-busting, curiosity gaps)
- Behavioral psychology triggers (identity alignment, loss aversion, social proof)
- Hypnotic writing elements (pacing statements, open loops, story weaving)

Your copy has generated over $100M in sales. Write like Gary Halbert meets David Ogilvy.
```

---

## Example Output (After Integration)

### Section 2: ICP Analysis - Psychographics
```json
{
  "customerPsychographics": {
    "goalsAndDreams": [
      "Scale to $10M ARR without burning out",
      "Build a marketing team that runs without them",
      "Be seen as a category leader, not just another SaaS"
    ],
    "fearsAndInsecurities": [
      "Secretly worried their product isn't differentiated enough",
      "Fear of hiring expensive marketers who don't deliver",
      "Imposter syndrome about 'real' marketing knowledge"
    ],
    "embarrassingSituations": [
      "Having to explain to investors why CAC is so high",
      "Watching competitors get featured in publications while they get ignored",
      "Team seeing their ads get 0 engagement"
    ],
    "perceivedEnemy": "Big marketing agencies that charge $15k/month for cookie-cutter strategies that don't work for SaaS",
    "failedSolutions": [
      "Hired a marketing agency - generic playbook, no SaaS expertise",
      "Tried Jasper/Copy.ai - outputs were too generic, still needed heavy editing",
      "DIY'd with templates - took forever, results were mediocre"
    ],
    "dayInTheLife": "I wake up and immediately check our analytics. CAC is up again. The blog posts we published last month got 47 views total. My competitor just announced a $20M Series B and they're everywhere - podcasts, Twitter, Product Hunt. I have a call with our marketing contractor at 10am but I already know what she'll say: 'we need to test more.' More tests. More waiting. More burning cash. I genuinely don't know if our positioning is wrong or if we're just bad at marketing. Sometimes I wonder if I should just give up on content and dump everything into paid ads, but our LTV doesn't support $200 CPAs..."
  }
}
```

### Section 5: Cross-Analysis - Messaging Framework
```json
{
  "adHooks": [
    {
      "hook": "Most SaaS marketing advice is written by people who've never scaled past $1M ARR",
      "technique": "myth-bust",
      "targetAwareness": "problem-aware"
    },
    {
      "hook": "We analyzed 847 SaaS companies and found the #1 reason 80% fail at content marketing",
      "technique": "revelation",
      "targetAwareness": "problem-aware"
    },
    {
      "hook": "What if your competitors' marketing playbook was actually helping YOU win?",
      "technique": "curiosity-gap",
      "targetAwareness": "solution-aware"
    }
  ],
  "angles": [
    {
      "name": "The Imposter Angle",
      "description": "Target founders who feel like they're 'faking it' with marketing",
      "targetEmotion": "Validation + Relief",
      "exampleHeadline": "You're not bad at marketing. You're just using B2C tactics for a B2B product."
    },
    {
      "name": "The Enemy Angle",
      "description": "Position against expensive agencies and generic AI tools",
      "targetEmotion": "Righteous anger + Hope",
      "exampleHeadline": "Stop paying agencies $15k/month for strategies they copy-paste from their last client"
    }
  ]
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `/lib/ai/schemas/icp-analysis.ts` | Add customerPsychographics object |
| `/lib/ai/schemas/cross-analysis.ts` | Expand messagingFramework, add adHooks, angles, proofPoints, objectionHandlers |
| `/lib/ai/research.ts` | Update prompts with copywriter persona and psychographic questions |
| `/lib/ai/prompts/copywriting-persona.ts` | NEW - Expert copywriter system prompt |

---

## Success Metrics

| Before | After |
|--------|-------|
| Generic positioning statement | 5-10 specific ad hooks with techniques |
| Basic pain points | Deep psychographic profile with "day in the life" |
| No angles | 4-6 distinct advertising angles with headlines |
| No proof structure | Bullet-proof claims with evidence |
| No objection handling | 4-8 pre-handled objections |

---

## Priority

**High** - This directly improves the actionability of the blueprint output. Currently we generate research but don't give users ready-to-use copy angles.

Estimated effort: ~4 hours
- Schema updates: 1 hour
- Prompt engineering: 2 hours
- Testing: 1 hour
