---
prd: landing-page-studio
prd_number: "002"
phase: 2-auto-review
reviewed_at: 2026-05-01T11:10:00Z
reviewer: karimo-brief-reviewer
brief_count: 15
---

# Brief Review — PRD #002 Landing Page Studio

## Summary

- Critical: 10
- Warning: 5
- Observation: 3
- Briefs requiring changes: T1, T2, T3, T4, T5, T8, T9, T10, T12, T13, T14
- Briefs ready as-is: T6 (self-documents its CSP discrepancy), T7 (correct once path fixed), T11 (correct), T15 (correct)

---

## Critical Findings

### C1 — T4/T5/T6/T8/T9 Write to Wrong Skill Path (`skills/landing-page/` vs `skills/landing-page-studio/`)

**Affected Briefs:** T4 (frontmatter `files:`), T5 (frontmatter + Implementation), T6 (frontmatter + Objective), T8 (frontmatter + Objective), T9 (frontmatter + Objective)

**Actual State:** The PRD, tasks.yaml, and execution_plan.yaml all specify `skills/landing-page-studio/` as the target skill folder. `skills/landing-page/` is the existing deprecated skill — it has `scripts/generate.ts` and `prompts/system.md` already.

**Evidence:**
- T4 frontmatter: `files: [skills/landing-page/scripts/plan-directions.ts, skills/landing-page/schemas/directions.ts]`
- T5 frontmatter: `files: [skills/landing-page/scripts/generate-html.ts, ...]`
- T6 frontmatter: `files: [skills/landing-page/scripts/post-process.ts]`
- T8 frontmatter: `files: [skills/landing-page/scripts/patch-text.ts]`
- T9 frontmatter: `files: [skills/landing-page/scripts/regen-section.ts]`
- tasks.yaml T4 files: `skills/landing-page-studio/scripts/plan-directions.ts`
- PRD Folder Layout: `skills/landing-page-studio/scripts/` throughout

**Problem:** Implementers following these briefs will write all pipeline scripts into the old deprecated skill folder, not the new one. T15 would then try to deprecate a folder that was just modified. The new skill would contain only T1 scaffold + T2 schema + T3 taxonomy + T7 gates — no scripts at all.

**Suggested fix:**
- T4: Change all `skills/landing-page/` → `skills/landing-page-studio/` in frontmatter files, Implementation Guidance import paths, Verification Steps, and all path references. Also delete the mention of `skills/landing-page/schemas/directions.ts` — schemas go in `skills/landing-page-studio/` per the PRD layout.
- T5: Same global path replacement. Also update: `skills/landing-page/prompts/html-generator.md` → `skills/landing-page-studio/prompts/html-generator.md`.
- T6: Same. Also `skills/landing-page/package.json` → `skills/landing-page-studio/package.json`.
- T8: Same. Import path for `getGtmSkillLanguageModel` and `node-html-parser` should also reference `skills/landing-page-studio/`.
- T9: Same.

**Blocks tasks:** T4, T5, T6, T8, T9 (entire Wave 3 + Wave 4)

---

### C2 — T1 Scaffold Creates Wrong Directory Layout (`assets/` instead of `contracts/` + `prompts/`)

**Affected Brief:** T1

**Actual State:** PRD "Folder Layout" section specifies:
```
skills/landing-page-studio/
├── prompts/
├── contracts/
├── references/
├── scripts/
└── example/
```
No `assets/` directory appears in the PRD canonical layout. `skill.json` is not listed in the PRD layout either.

**Evidence:**
- T1 frontmatter `files:` lists `assets/.gitkeep` and `skill.json` — neither is in the PRD layout
- T1 Acceptance Criteria checks `test -d skills/landing-page-studio/assets`
- T1 Gotchas say "T2 owns `assets/brand-spec.schema.ts`" — but PRD says `contracts/brand-spec.ts`
- Reference skill `skills/research-competitor/` has no `assets/` — it has `schemas/`
- tasks.yaml T1 acceptance: "Folder exists with all subdirs (prompts, contracts, references, scripts, example)" — lists `contracts`, not `assets`

**Problem:** T1 scaffolds `assets/` but downstream tasks T2, T3, T7 all write into `assets/`. If T1 creates `assets/` (matching its own brief) but the PRD and tasks.yaml expect `contracts/` and `prompts/`, subsequent tasks that read the PRD will target wrong paths. T12 SKILL.md and T13 example fixture also reference paths that depend on T1's layout.

**Suggested fix:**
- T1: Replace `assets/.gitkeep` with `prompts/.gitkeep` and `contracts/.gitkeep` in the files list and verification steps. Remove `skill.json` from the scaffold (it is not in the PRD layout). Keep `references/`, `scripts/`, `example/`. Update the "canonical layout" diagram in the brief body to match PRD exactly.

**Blocks tasks:** T1 (execution), and cascades into T2, T3, T7

---

### C3 — T2 Writes BrandSpec Schema to Wrong Path and Wrong Directory

**Affected Brief:** T2

**Actual State:** PRD specifies `contracts/brand-spec.ts`. tasks.yaml T2 specifies `skills/landing-page-studio/contracts/brand-spec.ts`.

**Evidence:**
- T2 frontmatter: `files: [skills/landing-page-studio/assets/brand-spec.schema.ts]`
- T2 file header in Implementation Notes: `// skills/landing-page-studio/assets/brand-spec.schema.ts`
- tasks.yaml T2: `files: [skills/landing-page-studio/contracts/brand-spec.ts]`
- PRD Folder Layout: `contracts/brand-spec.ts`

**Problem:** T2 creates the file in `assets/` but every downstream task that imports the BrandSpec type will use different paths depending on which source they read. T4, T5, T8, T9, T13 all import `BrandSpec` — they will target `contracts/brand-spec.ts` (per PRD) and find nothing.

**Suggested fix:** T2: Change output file path from `skills/landing-page-studio/assets/brand-spec.schema.ts` to `skills/landing-page-studio/contracts/brand-spec.ts`. Update the file header comment and all path references in Implementation Notes and Verification Steps accordingly. Exported identifiers `BrandSpecSchema` and `BrandSpec` remain the same.

**Blocks tasks:** T2 output path; T4, T5, T8, T9, T13 all import BrandSpec

---

### C4 — T3 Direction Taxonomy: Wrong File Type, Wrong Path, and Misaligned Direction Names

**Affected Brief:** T3

**Actual State (three sub-issues):**

**(a) File path:** T3 creates `skills/landing-page-studio/assets/direction-taxonomy.ts` (TypeScript). PRD specifies `references/directions.json` (JSON) and `references/directions.md` (docs). tasks.yaml T3 specifies `skills/landing-page-studio/references/directions.json`.

**(b) File format:** T3 produces a TypeScript module with `DIRECTION_TAXONOMY`, `DirectionKey`, `isValidDirection`. PRD specifies a JSON data file. These are incompatible output formats.

**(c) Direction names:** T3's 15 directions (`brutalist-grid`, `glass-morphism`, `dark-luxury`, `clean-minimal`, etc.) do not match the 5 locked anchor families from scope-decisions.md item 2 (`Editorial/Linear-Stripe`, `Bento/Notion-Vercel`, `Hero-art/Lovable-Anthropic`, `Brutalist/Are.na`, `Eastern-typographic/Kenya-Hara`). levels-framework.md confirms these vocabulary-teaching anchor names are load-bearing per the meta-insight. T3's directions are generic aesthetic labels, not the vocabulary-teaching paired names the PRD mandates.

**Suggested fix:**
- T3: Change output to `skills/landing-page-studio/references/directions.json` (JSON format, not TypeScript). The TypeScript type exports (`DirectionKey`, `isValidDirection`) should move to a companion `contracts/directions.ts` file or be inlined in `contracts/brand-spec.ts`.
- Direction names must anchor to the 5 locked families from scope-decisions.md. The 15 entries should be variants of those families (e.g. 3 Editorial variants, 3 Bento variants, 3 Hero-art variants, 3 Brutalist variants, 3 Eastern-typographic variants), each with the paired vocabulary-teaching label format (`Editorial / Linear-Stripe`, etc.).

**Blocks tasks:** T3 output shape; T4 imports taxonomy; T5 reads direction data; T14 docs must cross-reference T3 slugs

---

### C5 — T7 QA Gates Written to Wrong Directory

**Affected Brief:** T7

**Actual State:** T7 creates `skills/landing-page-studio/assets/quality-gates.ts`. tasks.yaml T7 specifies `skills/landing-page-studio/scripts/quality-gates.ts`. PRD Folder Layout places quality-gates.ts under `scripts/`.

**Evidence:**
- T7 frontmatter: `files: [skills/landing-page-studio/assets/quality-gates.ts]`
- T7 acceptance criteria: "File `skills/landing-page-studio/assets/quality-gates.ts` exists"
- tasks.yaml T7 files: `skills/landing-page-studio/scripts/quality-gates.ts`

**Problem:** T8, T9, and T10 all import quality-gates to re-validate HTML after tweaks. They will import from `scripts/quality-gates.ts` (per PRD) and find nothing.

**Suggested fix:** T7: Change file path from `assets/quality-gates.ts` to `scripts/quality-gates.ts` in frontmatter, acceptance criteria, verification steps, and all path references. No other change needed — vendoring logic is correct.

**Blocks tasks:** T7 output path; T8, T9 import quality-gates after patching

---

### C6 — T4 "Upstream Tasks" Table Has Completely Wrong Task Numbering

**Affected Brief:** T4

**Actual State:** T4's Dependencies section lists upstream tasks as:
- T1 = "BrandSpec Zod schema at `skills/landing-page/schemas/brand-spec.ts`"
- T2 = "CLI entrypoint scaffolding"
- T3 = "BrandSpec validator that writes `output/<run>/brand-spec.json`"

**Evidence (from PRD task table):**
- T1 = Scaffold skill folder
- T2 = BrandSpec Zod schema
- T3 = Direction-vocabulary taxonomy
- T4 = Direction Planner (the task itself)

**Problem:** T4's brief describes a completely different pipeline model where T1=schema, T2=CLI, T3=validator. The real T1 is scaffold, T2 is schema, T3 is taxonomy. This suggests T4 was generated against a different task numbering scheme. The implementation guidance references `output/<run>/brand-spec.json` (from "T3") which does not exist in the actual pipeline — BrandSpec is a user-supplied input file, not a generated intermediate.

**Suggested fix:** T4: Rewrite the Dependencies section. Upstream tasks are:
- T2: provides `BrandSpecSchema` type at `contracts/brand-spec.ts`
- T3: provides `directions.json` taxonomy at `references/directions.json`
Also remove all references to `output/<run>/brand-spec.json` as an intermediate — BrandSpec is read directly from user-supplied path (the CLI `--brand` flag). The `--run` flag approach described in T4 should change to `--brand <path> --out <dir>` to match T10's CLI interface.

**Blocks tasks:** T4 implementation will build wrong interface that T10 cannot wire

---

### C7 — T10 Output File Name Differs from tasks.yaml

**Affected Brief:** T10

**Actual State:** tasks.yaml T10 `files:` specifies `skills/landing-page-studio/scripts/generate.ts`. T10 brief specifies `skills/landing-page-studio/scripts/cli.ts` throughout (frontmatter, Objective, acceptance criteria, verification steps).

**Evidence:**
- tasks.yaml: `files: [skills/landing-page-studio/scripts/generate.ts]`
- T10 brief frontmatter: `files: [skills/landing-page-studio/scripts/cli.ts, ...]`
- T10 acceptance criteria: "`npx tsx skills/landing-page-studio/scripts/cli.ts --help` exits 0"
- PRD acceptance criterion 1: "`npx tsx skills/landing-page-studio/scripts/generate.ts plan example/brief.json`"

**Problem:** The PRD's acceptance criteria (line "npx tsx skills/landing-page-studio/scripts/generate.ts plan...") reference `generate.ts` as the CLI entry point. tasks.yaml agrees. T10 brief uses `cli.ts`. These are different filenames. T11 (slash command) and T12 (SKILL.md) both document the CLI path — they need a single authoritative name.

**Suggested fix:** T10: Rename the output file from `cli.ts` to `generate.ts` throughout the brief to match tasks.yaml and the PRD's acceptance criteria. The shebang, TypeScript pattern, and all verification commands use `generate.ts`. Update T11 and T12 accordingly (both currently reference `cli.ts`).

**Blocks tasks:** T10 delivery name; T11 slash command bridge; T12 SKILL.md invocation docs; PRD acceptance criteria check

---

### C8 — T10 Depends on T8/T9 (`should`) Blocking T10 (`must`)

**Affected Brief:** T10

**Actual State:** tasks.yaml T10 `depends_on: [T4, T5, T6, T7]`. T8 and T9 are `should`-priority. T10 brief frontmatter says `depends_on: [T4, T5, T6, T7, T8, T9]` and the Implementation Notes treat T8/T9 as upstream blockers.

**Problem:** A `must`-priority task (T10) must not have undeclared blocking dependencies on `should`-priority tasks. If T8 or T9 are skipped (valid, they are `should`), T10's brief says to import them — the CLI would fail. tasks.yaml correctly models T10 as not depending on T8/T9 (tweak subcommands are optional wiring).

**Suggested fix:** T10: Remove T8 and T9 from `depends_on` in frontmatter. In the subcommand → pipeline step mapping, mark `tweak-text` and `tweak-regen` subcommands as "available only if T8/T9 implemented — exits with 'not implemented' otherwise." The `runTweakText()` and `runTweakRegen()` functions should check for file existence and degrade gracefully.

**Blocks tasks:** T10 wave ordering; if T8/T9 skipped, T10 breaks

---

### C9 — T13 BrandSpec Example Fields Inconsistent with T2 Schema

**Affected Brief:** T13

**Actual State:** T2 defines `BrandSpecSchema` with fields: `brandName`, `primaryColor`, `accentColor`, `voice`, `direction`, `industry`, `targetAudience`, `keyBenefit`, `cta`, `logoUrl?`, `customInstructions?`.

T13 example `brand-spec.json` uses: `companyName`, `tagline`, `description`, `targetAudience`, `tone`, `colors.primary/accent/background/text`, `fonts.heading/body`, `features[]`, `socialProof{}`.

**Evidence:** T2 Implementation Notes schema vs T13 Implementation Notes JSON example — zero field names match except `targetAudience`.

**Problem:** T13 instructs the implementer to run `cli.ts full --brand example/brand-spec.json` — this will immediately fail schema validation because `companyName` is not in the schema (it's `brandName`), `tone` is not in the schema (it's `voice`), `colors` is not in the schema (it's `primaryColor` + `accentColor` flat), etc.

**Suggested fix:** T13: Rewrite the example JSON to use T2's actual field names: `brandName`, `primaryColor`, `accentColor`, `voice` (one of: professional/playful/bold/minimal/warm), `direction` (a taxonomy key from T3), `industry`, `targetAudience`, `keyBenefit`, `cta`, optional `logoUrl`, optional `customInstructions`. Also note: T13 references `skills/landing-page-studio/schemas/brand-spec.schema.json` and `cli.ts validate` — neither the `schemas/` directory nor the `validate` subcommand exist in the task plan. Fix references to `contracts/brand-spec.ts` and use the T10 CLI's actual subcommand set.

**Blocks tasks:** T13 will fail at schema validation step; golden fixture cannot be produced

---

### C10 — T14 Puts Files in Directories Not Scaffolded by T1 (`data/`, `docs/`)

**Affected Brief:** T14

**Actual State:** T14 creates `data/google-fonts.json` and `docs/directions.md`. T1 scaffolds `prompts/`, `contracts/`, `references/`, `scripts/`, `example/`. PRD specifies `references/google-fonts.json` and `references/directions.md`.

**Evidence:**
- T14 frontmatter: `files: [skills/landing-page-studio/data/google-fonts.json, skills/landing-page-studio/docs/directions.md]`
- PRD Folder Layout: `references/google-fonts.json`, `references/directions.md`
- tasks.yaml T14 files: `skills/landing-page-studio/references/google-fonts.json`, `skills/landing-page-studio/references/directions.md` (matches PRD)
- T1 scaffold: no `data/` or `docs/` directory created

**Problem:** An implementer following T14 creates new directories not in the skill layout. T1 must scaffold them or T14 must use the correct paths. The PRD layout is unambiguous: both files go under `references/`.

**Suggested fix:** T14: Change all `data/` references to `references/` and all `docs/` references to `references/` in frontmatter, file paths, verification steps, and body text. The `data/google-fonts.json` → `references/google-fonts.json`; `docs/directions.md` → `references/directions.md`. Also update references from T3's `data/directions.json` → `references/directions.json` (C4 fix cascades here).

**Blocks tasks:** T14 creates orphaned files; T5 looks for `references/google-fonts.json`

---

## Warning Findings

### W1 — T4/T5/T8/T9 Import Across Skill Boundary (`src/lib/`)

**Affected Briefs:** T4, T5, T8, T9

**Issue:** All four briefs instruct importing from `src/lib/gtm/skill-model.ts` and `src/lib/ai/providers.ts` via relative paths like `../../../src/lib/gtm/skill-model`. CLAUDE.md skill portability rule: "No skill may import from outside its own folder." The PRD acknowledges this ("portability first") but does not resolve it for v1.

**Actual State:** The PRD's "Files Touched → Not touched: `src/`" section confirms no `src/` changes. Yet the scripts need those imports to call the LLM.

**Suggested fix:** Add a note to T4, T5, T8, T9 explicitly acknowledging this is a portability exception for v1 and must be tracked. Add `// PORTABILITY-EXCEPTION(v1): imports from src/ — will be extracted to skill-local copy for standalone publish. Tracked in PRD #003.` comment. Do not attempt to resolve the import in v1 — that's PRD #003 scope. The briefs should stop calling this a path alias issue and call it what it is: a known portability exception.

---

### W2 — T5 Wave Dependency Note Is Wrong (T4 is not a prerequisite)

**Affected Brief:** T5

**Issue:** T5 brief states "T4 (Direction Planner) must be complete and `output/<run>/directions.json` must exist before this runs." tasks.yaml T5 `depends_on: [T2, T3]` — no T4 dependency. T5 and T4 run in parallel in Wave 3.

**Actual State:** T5 reads `directions.json` at runtime (it generates HTML per direction), but T5 the script does not import T4 the script. They share the output directory but T5 is independently implementable.

**Suggested fix:** T5: Remove the statement "T4 must be complete." Change the context note to "T5 runs in parallel with T4 in Wave 3. At runtime, T5 requires a `directions.json` file written by T4 — but T5's implementation does not depend on T4's code."

---

### W3 — T8/T9 Priority Listed as `must` in Brief Frontmatter, `should` in tasks.yaml

**Affected Briefs:** T8, T9

**Issue:** T8 frontmatter: `priority: must`. T9 frontmatter: `priority: must`. tasks.yaml: both `priority: should`.

**Suggested fix:** T8, T9: Change frontmatter `priority: must` to `priority: should` to match tasks.yaml. This matters because orchestrators read the brief frontmatter to determine wave blocking behavior.

---

### W4 — T2 Zod Version Pin is Stale

**Affected Brief:** T2

**Issue:** T2 instructs adding `"zod": "^3.22.0"` to the skill's package.json. Root package.json has `"zod": "^4.2.1"`. Reference skill `research-competitor/package.json` has `"zod": "^3.24.3"`. Using v3 is correct for skill portability (separate from root), but the version should match research-competitor's `^3.24.3` not the stale `^3.22.0`.

**Suggested fix:** T2: Change `"zod": "^3.22.0"` to `"zod": "^3.24.3"` to match the reference skill.

---

### W5 — T12 SKILL.md Description Length Acceptance Criterion Contradicts Its Own Reference

**Affected Brief:** T12

**Issue:** T12 acceptance criterion: "YAML frontmatter `description` field is 120–170 characters." T12 also cites `skills/research-competitor/SKILL.md` as the canonical reference — and notes that its description is ~310 characters, then says "the rule of thumb is trigger-rich, not strictly capped." The 120–170 criterion will cause a false failure against any implementation that follows the reference pattern.

**Suggested fix:** T12: Remove the character count from the acceptance criterion. Replace with: "Description field is trigger-rich (includes keywords: 'landing page', 'HTML', 'SaaS', 'BrandSpec', 'design direction') and is concise enough to be scannable in the Claude Code command picker."

---

## Observations

### O1 — CSP String Discrepancy Is Already Self-Documented (No Action Needed)

Both T5 and T6 briefs contain the same detailed analysis of the CSP discrepancy between scope-decisions.md and tasks.yaml, and both recommend the same merged string. No correction needed — the implementer has clear guidance. Just verify T5 and T6 implementers use the same string at runtime.

---

### O2 — T7 Vendored Function Signature Note

T7 acceptance criteria say to export `runQualityGates(html: string): QualityGateResult[]` but the actual source function signature is `runLandingPageQualityGates(html: string, options: LandingPageQualityGateOptions = {}): LandingPageQaReport`. T7's own brief says "verbatim copy" — which is correct. The brief's proposed alternative signature in Implementation Notes Step 4 is illustrative, not prescriptive. Implementer should follow the verbatim copy instruction (which produces `runLandingPageQualityGates`) and ignore the simplified wrapper shown in the notes. Consider adding a brief clarification note that the verbatim copy wins over the illustrative snippet.

---

### O3 — T15 Target File Confirmed to Exist

`skills/landing-page/README.md` confirmed to exist at first line `# Landing Page Skill — README`. T15's verification pre-check will pass. No action needed.

---

## Inter-task Issues

### Path coherence failure (cascades through entire pipeline)

The core issue is that T4/T5/T6/T8/T9 target `skills/landing-page/` while T1/T2/T3/T7/T10-T15 correctly target `skills/landing-page-studio/`. This creates a split-brain where Wave 4 scripts land in the wrong folder and T10's orchestrator (in the right folder) cannot find them. The entire Wave 3–4 must be re-pathed before execution.

### Directory layout incoherence (T1 → T2, T3, T7, T14)

T1 scaffolds `assets/` but PRD/tasks.yaml expect `contracts/` + `prompts/`. T2 targets `assets/`, T3 targets `assets/`, T7 targets `assets/`. T14 targets `data/` and `docs/`. After C2 fix lands on T1 (create `contracts/` + `prompts/` instead of `assets/`), all four downstream briefs need path corrections. Fix T1 first, then T2, T3, T7, T14 in sequence.

### T4 internal model describes wrong pipeline architecture

T4 was generated against a different task numbering where T1=schema, T2=CLI, T3=validator. The real pipeline has T2=schema, T3=taxonomy, and no "BrandSpec validator that writes output JSON" step. T4's implementation will build an interface incompatible with T10's `--brand <path>` CLI model. T4 needs a partial rewrite of its Dependencies section, Requirements (remove `--run` flag, add `--brand` + `--out`), and any references to `output/<run>/brand-spec.json`.

### T13 example cannot validate against T2 schema (field name mismatch)

T13's example BrandSpec has zero overlapping field names with T2's schema (except `targetAudience`). This is a guaranteed validation failure on first run. T13 must be updated after C3 (T2 path) and C9 (T13 fields) are both resolved.

### T10 subcommand name drift vs PRD acceptance criteria

PRD acceptance criterion 1 uses `generate.ts plan`. T10 brief uses `cli.ts`. T11 references `cli.ts`. T12 documents `cli.ts`. If T10 ships as `cli.ts`, 3 of the 9 PRD acceptance criteria reference the wrong filename. Resolving C7 (rename to `generate.ts`) cascades fixes into T11 and T12.

---

## Verdict

- Recommend: **APPLY-FIXES**
- Rationale: 10 critical findings, all fixable without scope changes. The most impactful are: (1) C1 — five briefs write to the wrong skill folder, which would corrupt the existing deprecated skill and leave the new skill empty; (2) C4 — direction taxonomy uses wrong format (TypeScript vs JSON), wrong path, and wrong direction names that contradict the locked scope-decisions; (3) C6 — T4's internal task-numbering model is completely inverted relative to the actual PRD task list, producing an incompatible CLI interface. These three findings alone would cause total pipeline failure. Fixes are mechanical path corrections and field-name alignments — no architectural rethinking required. The PRD, execution plan, and scope-decisions.md are internally consistent and correct; only the briefs drifted.
