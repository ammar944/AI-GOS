# NLP Copywriting Integration - Task Breakdown

## Reference Doc
`.planning/NLP-COPYWRITING-INTEGRATION.md`

---

## Task 1: Update ICP Analysis Schema
**Status:** ✅ Complete
**File:** `/src/lib/ai/schemas/icp-analysis.ts`

**Changes:**
1. Add `customerPsychographics` object to the schema with:
   - `goalsAndDreams: z.array(z.string()).min(3).max(5)`
   - `fearsAndInsecurities: z.array(z.string()).min(3).max(5)`
   - `embarrassingSituations: z.array(z.string()).min(2).max(4)`
   - `perceivedEnemy: z.string()`
   - `failedSolutions: z.array(z.string()).min(2).max(4)`
   - `dayInTheLife: z.string()` (1st person journal, 2-3 paragraphs)

2. Add detailed `.describe()` hints for each field based on the training doc

**Acceptance:**
- Schema compiles without errors
- TypeScript types are exported correctly

---

## Task 2: Update Cross-Analysis Schema  
**Status:** ✅ Complete
**File:** `/src/lib/ai/schemas/cross-analysis.ts`

**Changes:**
1. Expand `messagingFramework` to include:
   - `coreMessage: z.string()`
   - `positioningStatement: z.string()`

2. Add new `adHooks` array:
   ```typescript
   adHooks: z.array(z.object({
     hook: z.string(),
     technique: z.enum(['controversial', 'revelation', 'myth-bust', 'status-quo-challenge', 'curiosity-gap', 'story']),
     targetAwareness: z.enum(['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware'])
   })).min(5).max(10)
   ```

3. Add new `angles` array:
   ```typescript
   angles: z.array(z.object({
     name: z.string(),
     description: z.string(),
     targetEmotion: z.string(),
     exampleHeadline: z.string()
   })).min(4).max(6)
   ```

4. Add `proofPoints` array:
   ```typescript
   proofPoints: z.array(z.object({
     claim: z.string(),
     evidence: z.string(),
     source: z.string().optional()
   })).min(3).max(6)
   ```

5. Add `objectionHandlers` array:
   ```typescript
   objectionHandlers: z.array(z.object({
     objection: z.string(),
     response: z.string(),
     reframe: z.string()
   })).min(4).max(8)
   ```

6. Add detailed `.describe()` hints with copywriting guidance

**Acceptance:**
- Schema compiles without errors
- TypeScript types are exported correctly

---

## Task 3: Create Copywriter Persona Prompt
**Status:** ✅ Complete
**File:** `/src/lib/ai/prompts/copywriting-persona.ts` (NEW)

**Changes:**
1. Create new file with expert copywriter system prompt
2. Include:
   - Expert persona (Gary Halbert, Eugene Schwartz, David Ogilvy, Joe Sugarman)
   - NLP language patterns list
   - Pattern interrupt techniques list
   - Behavioral triggers list
   - Hypnotic writing elements list
3. Export as `COPYWRITING_EXPERT_PERSONA`

**Acceptance:**
- File exports the persona string
- Can be imported in research.ts

---

## Task 4: Update ICP Research Function
**Status:** ✅ Complete
**File:** `/src/lib/ai/research.ts`

**Changes:**
1. Update `researchICPAnalysis()` function
2. Add psychographic questions to the prompt:
   - What are their deepest goals and dreams?
   - What fears and insecurities keep them up at night?
   - What embarrassing situations do they avoid?
   - Who/what do they blame for their problems?
   - What solutions have they tried that failed?
3. Request a "day in the life" emotional journal entry
4. Keep existing functionality intact

**Acceptance:**
- Function compiles
- Prompt includes psychographic guidance
- Output matches new schema

---

## Task 5: Update Cross-Analysis Research Function
**Status:** ✅ Complete
**File:** `/src/lib/ai/research.ts`

**Changes:**
1. Update `synthesizeCrossAnalysis()` function
2. Import and use `COPYWRITING_EXPERT_PERSONA` from Task 3
3. Add guidance for:
   - Generating 5-10 ad hooks with technique classification
   - Generating 4-6 advertising angles with target emotions
   - Generating proof points backed by research from earlier sections
   - Generating objection handlers with persuasive reframes
4. Request specific copywriting frameworks (PAS, AIDA elements)

**Acceptance:**
- Function compiles
- Uses expert persona
- Output matches new schema

---

## Execution Order

```
Task 1 (ICP Schema) ─────┐
                         ├──→ Task 4 (ICP Research)
Task 2 (Cross Schema) ───┤
                         │
Task 3 (Persona) ────────┼──→ Task 5 (Cross Research)
```

Tasks 1, 2, 3 can run in parallel.
Task 4 depends on Task 1.
Task 5 depends on Tasks 2 and 3.

---

## Notes
- All changes in `/src/lib/ai/` directory
- Use existing patterns from current schema files
- Keep `.describe()` hints actionable and specific
- Don't break existing functionality
