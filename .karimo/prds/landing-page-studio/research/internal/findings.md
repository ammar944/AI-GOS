# Landing Page Studio — Codebase Audit Findings

**Audit Date:** 2026-05-01  
**Scope:** Current landing-page skill surface, GTM run pipeline, design system, storage, and provider configuration  
**Conclusion:** User's hypothesis is **correct and evidence-bound**: The repo has a robust prompt-driven landing page generator with hard quality gates, but zero executable design-system infrastructure. Huashu/Impeccable/Taste are inline prompt text only, not loaded modules. The studio must build: (1) a skill dispatcher that plugs into GTM, (2) artifact versioning on Supabase, (3) a canvas preview component, (4) design system as executable (shadcn + dynamic theme builder).

---

## 1. Current landing-page skill — what it actually is

**File Inventory:**
- `skills/landing-page/SKILL.md` (158 lines) — public product description + design philosophy layer descriptions
- `skills/landing-page/README.md` (134 lines) — user-facing CLI/API docs
- `skills/landing-page/prompts/system.md` (202 lines) — the complete system prompt
- `skills/landing-page/references/huashu-design.md` (extracted reference, 20 design philosophies)
- `skills/landing-page/scripts/generate.ts` (178 lines) — local CLI test harness
- `skills/landing-page/templates/starter.html` (282 lines) — blank template reference
- `skills/landing-page/example/brief.json` — example input (DealFlow brief)

**Actual Model Call Sites:**
1. **CLI runner** (`skills/landing-page/scripts/generate.ts:37-45`):
   ```typescript
   const model = options.deep
     ? anthropic(MODELS.CLAUDE_OPUS)
     : anthropic(MODELS.CLAUDE_SONNET);
   ```
   Uses `generateText()` from `ai` SDK v6, injects system prompt, max 32000 output tokens, optional thinking budget 4000 for `--deep`.

2. **API `/api/landing-page/run`** (`src/app/api/landing-page/run/route.ts:30`):
   Calls `runLandingPageAgent()` from `src/lib/ai/landing-page/runner.ts` — validates input against `runLandingPageAgentInputSchema`, returns JSON with hard QA gates applied.

3. **API `/api/landing-page/generate`** (`src/app/api/landing-page/generate/route.ts:52-60`):
   Calls `streamText()` with `generateLandingPage` tool, augments system prompt with style preference, uses Opus or Sonnet based on `deep_research` flag.

**What the Prompt Actually Says:**
The system prompt (`prompts/system.md`) is **2,012 words** of inline guidance. Key sections:

- **Core Principles** (lines 12–80): "real enemy: polished generic SaaS", SaaS product clarity mode, "start from context never from scratch"
- **20 Design Philosophies** (lines 82–92): References `references/huashu-design.md` but does NOT load or parameterize them. Inline: pentagram, stamen, info-architects, fathom, locomotive, active-theory, field-io, resn, experimental-jetset, muller-brockmann, build, kenya-hara, sagmeister, zach-lieberman, ash-thorp, territory, takram, irma-boom, neo-shen
- **Anti-Slop Rules** (lines 94–143): 25 explicit NEVER rules + 12 ALWAYS rules
- **Section Arsenal** (line 183): list of 11 possible sections (nav, hero, problem, solution, features, how-it-works, social-proof, pricing, faq, cta-footer, footer)
- **Quality gates** (offloaded to code, not in prompt)

---

## 2. Phantom modules — Huashu/Impeccable/Taste/UIUXProMax claim

**Search Results:**

Line `README.md:2`:
```
Generate production-ready landing pages with one command. Combines 20 design philosophies (Huashu), 
18 Impeccable audit rules, 8 Taste Skill flavors, and 60+ brand design systems.
```

Line `prompts/system.md:1–3`:
```
This file is the complete system prompt used by the landing page AI agent.
It combines: Huashu Design (20 philosophies), Impeccable (18 audit sub-skills),
Taste Skill (8 flavors), UI UX Pro Max (67 styles, 96 palettes), Awesome Design MD (60+ brands).
```

**Verification:**
- **Huashu**: Loaded as **reference file** `skills/landing-page/references/huashu-design.md` (extracted, cited as "alchaincyf/huashu-design, 10.4k stars, MIT-licensed"). NOT dynamically loaded; the 20 philosophies are inlined in the system prompt as text descriptions.
- **Impeccable**: Mentioned as "18 audit sub-skills" in the header comment, but **no separate reference file exists**. No grep match outside the header. NOT loaded.
- **Taste Skill**: Referenced as "8 flavors" in the system prompt. Actually implemented as **CLI flag `--style` with 8 options**: taste, minimalist, brutalist, soft, gpt-taste, redesign, stitch, output. These are injected as a prompt augmentation string (`augmentedSystem` in generate.ts:72–75), not a loaded module.
- **UI UX Pro Max**: Mentioned in the system prompt header as "67 styles, 96 palettes" but **not present in the codebase**. No module, no data file, no reference.
- **Awesome Design MD**: Claimed as "60+ brand design systems" — likely refers to examples in the prompt (Stripe, Linear, Vercel, Notion, Claude, Apple, Airbnb, Supabase, Sentry, Raycast, Spotify, etc.) but NOT as a loaded dataset.

**Conclusion:** All "phantom modules" are **claims in prompt text only**. No executable design system, no loaded module, no parameterized stylesheet builder.

---

## 3. QA gates today — what the regex/string gates actually check

**File:** `src/lib/ai/landing-page/quality-gates.ts` (182 lines)

**Architecture:**
Function `runLandingPageQualityGates(html: string, options?: { sourceFacts?: string[] })` returns:
```typescript
{
  passed: boolean,
  failed_gates: string[],
  signals: string[],
  details: Record<string, string[]>
}
```

**Actual Gates (via regex patterns and semantic checks):**

### Semantic HTML (lines 77–86):
Requires: `<header>`, `<nav>`, `<main>`, `<footer>` — fails if any missing.
- **Gate name:** `missing_semantic_html`

### CSS Signals (lines 88–115):
1. **OKLCH colors** (line 90): Regex `/oklch\(/i` — fails if absent → `missing_oklch_colors`
2. **text-wrap: pretty** (lines 93–94): Regex `/text-wrap\s*:\s*pretty/i` — optional, signals if present
3. **Focus states** (lines 96–98): Regex `/:focus-visible|:focus\b/i` — fails if missing → `missing_focus_states`
4. **prefers-reduced-motion** (lines 100–104): Regex `/prefers-reduced-motion/i` — fails if animations exist but no reduced-motion handling → `missing_reduced_motion`
5. **Responsive CSS** (lines 106–109): Regex `/@media/i` — fails if absent → `missing_responsive_css`
6. **Touch targets** (lines 111–113): Regex `/min-(height|width)\s*:\s*44px/i` — fails if absent → `missing_touch_targets`
7. **Inter font guard** (lines 115–116): Regex `/font-family\s*:\s*Inter\b|fonts\.googleapis\.com[^"']*Inter/i` — fails if Inter used globally → `inter_as_display_or_global_font`
8. **Mobile nav overflow** (lines 118–119): Regex `/\.nav-links[\s\S]{0,240}overflow-x\s*:\s*auto/i` — fails if risky pattern found → `mobile_nav_overflow_risk`

### Copy Signals (lines 121–134):
**Generic Copy Patterns** (array, line 13–20):
- `/\ball-in-one\b/i`
- `/\bsingle source of truth\b/i`
- `/\bevery tool you need\b/i`
- `/\bunlock\b/i`
- `/\belevate\b/i`
- `/\bseamless\b/i`
- `/\bsupercharge\b/i`
- `/\brevolutionize\b/i`

If any match → `generic_saas_copy` gate fails.

**Placeholder Patterns** (array, line 22–25):
- `/>[\s\S](Dashboard|Product mockup|Mockup|Placeholder)\s*</i`
- `/\bclean placeholder\b/i`
- `/\blorem ipsum\b/i`
- `/\bimage placeholder\b/i`

If any match → `placeholder_product_artifact` fails.

### Proof Signals (lines 136–154):
**Famous Logo Guard** (line 27):
Regex: `/trusted by[\s\S]{0,300}(Google|Apple|Microsoft|Meta|Stripe|Airbnb|RE\/MAX|Sotheby|CENTURY 21|Coldwell Banker)/i`

If `trusted by` text appears AND matches famous logos AND no `sourceFacts` provided → `fake_or_unverified_proof` fails.

If `sourceFacts` provided → signals `sourced_proof`.

### Product Artifact Signals (lines 156–180):
**Product Detail Terms** (array, line 29–45): Domain-specific vocabulary:
- "aps", "bra", "fintrac", "trust ledger", "commission split", "broker-of-record", "conveyancing", "mls", "audit", "trade file", "trade-file", "deposit receipt", "payout", "approval", "document status"

**Checks:**
- Container regex: `/product-artifact|product-card|trade-file|command center|review queue/i`
- Structure regex: `/<table\b|<article\b|role="table"|aria-label="[^"]*(product|trade|queue)/i`
- Requires: >=8 matched product terms + has container + has structure
- If all conditions met → signals `product_artifact`, else fails with `missing_product_artifact`

**Gate Summary (Hard Fails):**
1. `missing_semantic_html` — no header/nav/main/footer
2. `missing_oklch_colors` — no OKLCH color space used
3. `missing_focus_states` — no visible focus handling
4. `missing_reduced_motion` — animations exist but no prefers-reduced-motion
5. `missing_responsive_css` — no @media queries
6. `missing_touch_targets` — no 44px min-height/width
7. `inter_as_display_or_global_font` — Inter used as primary/global font
8. `mobile_nav_overflow_risk` — nav-links with overflow-x: auto pattern
9. `generic_saas_copy` — matched one of 8 filler phrases
10. `placeholder_product_artifact` — matched placeholder labels
11. `fake_or_unverified_proof` — trusted by + famous logos without source facts
12. `missing_product_artifact` — product artifact missing, too few domain terms, or bad structure

**Status:** CLI and `/api/landing-page/run` both hard-fail on any gate violation (exit code 2, rejected output). `/api/landing-page/generate` does NOT apply gates (returns streamed text, user responsibility).

---

## 4. GTM run pipeline integration points

**How a New "Studio" Feature Would Slot In:**

### Entry Point: Dispatch Route
**File:** `src/app/api/gtm/runs/[runId]/dispatch/route.ts` (lines 30–100+)

```typescript
POST /api/gtm/runs/[runId]/dispatch
Body: { stage: "ingest-identity" | "research-market" | ... } // 5 lighthouse skills
```

Currently handles: ingest-url, ingest-identity, research-market, research-competitor, research-icp.

**For landing-page-studio:** Would need to add dispatch handler for a new skill like `"landing-page-studio"` alongside the existing lighthouse skills.

### Skill Dispatcher
**File:** `src/lib/gtm/dispatch-skill.ts` (lines 1–90+)

Current dispatcher imports 5 lighthouse skills and routes via:
```typescript
if (skill === "ingest-url") { return dispatchIngestUrl(...); }
if (skill === "research-market") { return dispatchResearchMarket(...); }
// etc.
```

**Integration shape:** Would add:
```typescript
import { dispatchLandingPageStudio } from "@/lib/gtm/skills/landing-page-studio";
if (skill === "landing-page-studio") {
  return dispatchLandingPageStudio(parseInput(input));
}
```

### Artifact Persistence
**Schema:** `supabase/migrations/20260501_create_gtm_artifacts.sql`

```sql
CREATE TABLE gtm_artifacts (
  id uuid PRIMARY KEY,
  run_id text NOT NULL REFERENCES gtm_runs(run_id),
  user_id text NOT NULL,
  skill text NOT NULL,                    -- "landing-page-studio"
  version int NOT NULL DEFAULT 1,
  content_md text NOT NULL,               -- rendered artifact (HTML or markdown)
  source text NOT NULL,                   -- 'skill_output' | 'agent_patch'
  created_by text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gtm_artifacts_run_skill_version_unique UNIQUE (run_id, skill, version)
);
```

**For landing-page-studio:** Each generated landing page becomes one artifact row. HTML stored as text in `content_md` (despite the column name). On re-run or agent patch, version increments.

### Artifact Retrieval
**Route:** `src/app/api/gtm/runs/[runId]/artifacts/route.ts` (GET)

```typescript
GET /api/gtm/runs/[runId]/artifacts
Returns: { artifacts: [ { id, run_id, skill, version, content_md, source, created_at }, ... ] }
```

Returns all artifacts for a run, sorted by skill then version. ChatShell refetches after orchestrator patches land.

### Canvas Preview Component
**File:** `src/components/gtm/ArtifactCanvas.tsx` (lines 1–80+)

```typescript
<ArtifactCanvas artifact={artifact} runId={runId} />
```

Currently reads-only, displays:
- Back-to-chat link
- Skill name + version badge
- Rendered markdown pane (ReactMarkdown)
- Raw MD textarea (copy-only)

**For landing-page-studio:** Would render HTML artifact in an iframe (`<iframe srcdoc={html} />`) or two-pane split (rendered HTML + raw markdown for copy/edit).

### Chat Tool Integration
**File:** `src/lib/gtm/orchestrator-tools.ts` (lines 1–100+)

Three orchestrator tools for the chat brain:
1. `dispatch_skill` — kicks off lighthouse skill dispatch
2. `patch_artifact` — free Ollama-only textual edit of markdown
3. `classify_intent` — routes user message to one of 4 intents

**For landing-page-studio:** A new tool might be added, e.g., `regenerate_landing_page_with_style` that calls dispatch again with style preference, or a direct `edit_landing_page_html` tool that patches the artifact without re-running the skill.

### Chat Endpoint
**Route:** `src/app/api/gtm/runs/[runId]/chat/route.ts` (POST)

```typescript
POST /api/gtm/runs/[runId]/chat
Body: { message: string, artifact_id?: string }
```

Orchestrator model (Ollama) runs the three tools above, refetches artifacts after tool calls.

---

## 5. Storage reality — does Blob/Storage exist? where does HTML go today?

**Blob/Vercel Integration:** NOT present in repo.
- No `@vercel/blob` in `package.json`
- No `blob.ts` or blob-related client in `src/lib/`

**Supabase Storage Usage:**
- Found in `src/app/api/documents/upload/route.ts` and `src/app/api/onboarding/extract-document/route.ts`
- Pattern: `supabase.storage.from(BUCKET).remove([storagePath])`
- **Not used for landing page assets today**

**Current Landing Page Storage:**
1. **CLI output:** Saved as `.html` files to disk at `skills/landing-page/output/` (local test only, no persistence)
2. **API `/api/landing-page/run`:** Returns JSON object with `html` key embedded — no storage to Supabase or Blob
3. **GTM artifact storage:** HTML stored directly as **text in `gtm_artifacts.content_md` column** (Postgres text column, no size limit in practice)

**What Would Need to Be Added for Binary Assets:**
- A new `gtm_artifacts_files` table or separate S3-like bucket for screenshot PNGs, logo uploads, mockup images
- OR: Embed images as base64 data URIs in the HTML (simple but bloats the artifact)
- OR: Use Supabase Storage bucket `gtm-landing-page-assets/[run_id]/[artifact_id]/logo.png` + reference URLs in HTML

---

## 6. Design system inventory — shadcn components count, preview shell primitives

**Component Library:**
- **shadcn/ui** version 4.0.5 + Radix UI primitives + Tailwind CSS v4
- **Radix UI packages installed:**
  - @radix-ui/react-alert-dialog
  - @radix-ui/react-checkbox
  - @radix-ui/react-collapsible
  - @radix-ui/react-label
  - @radix-ui/react-progress
  - @radix-ui/react-select
  - @radix-ui/react-separator
  - @radix-ui/react-slot
  - @radix-ui/react-switch
  - @radix-ui/react-tabs
  - @radix-ui/react-tooltip
  - (+ more, see package.json)

**shadcn/ui Components in `src/components/ui/`:** 34 components
- alert-dialog, api-error-display, aurora-streaks, badge, blob-background, button, card, carousel, checkbox, collapsible, drawer, dropdown-menu, **floating-label-input**, **floating-label-textarea**, **glow-card**, gradient-border, gradient-text, grain, input, label, logo, magnetic-button, progress, saaslaunch, **score-display**, section-divider, select, [+26 more in ls output]

**Design System Locked (DESIGN.md, dated 2026-04-17):**
- **Typography:** Geist (body), Instrument Serif (display), Geist Mono (code) — replaced DM Sans/Instrument Sans/JetBrains Mono in Phase 1
- **Radius:** `--radius-module` tightened to 6px (anti-AI-slop move)
- **Palette:** OKLCH-based, dark-first (primary theme), restrained 1 accent blue + 3 status colors
- **Spacing:** 8px base unit, scale 2–48px

**Theme Configuration:**
- CSS custom properties in `:root` — OKLCH color values, typography scale, spacing tokens
- No shadcn theme.json or dynamic theme builder found
- Dark mode primary, light mode fallback via `@media (prefers-color-scheme: light)` (implied, not grep-confirmed in snippet)

**Preview Shell for Studio:**
- `src/components/gtm/ArtifactCanvas.tsx` provides read-only markdown rendering + raw MD textarea
- Would need iframe with sandbox for HTML preview: `<iframe srcdoc={html} sandbox="allow-same-origin" />`
- Tailwind + Radix available for the shell UI itself, but **no dynamic CSS injection tool** for theming the generated landing page HTML

---

## 7. Provider model menu

**File:** `src/lib/ai/providers.ts`

**Provider Instances:**
1. **Anthropic** — CLAUDE_HAIKU, CLAUDE_SONNET, CLAUDE_OPUS
2. **Perplexity** — SONAR_PRO, SONAR_REASONING_PRO
3. **Ollama** (OpenAI-compatible) — local or cloud endpoint, for orchestrator tool-calling only

**Available Models & Allocations:**

| Model | Provider | Use Case | Cost (1M tokens) |
|-------|----------|----------|------------------|
| claude-sonnet-4-20250514 | Anthropic | Landing page generation (standard) | $3/$15 in/out |
| claude-opus-4-6 | Anthropic | Landing page generation (deep research mode) | $5/$25 |
| claude-haiku-4-5-20251001 | Anthropic | Fast extraction tasks | $0.8/$4 |
| sonar-pro | Perplexity | Research aggregation | $3/$15 + $0.01 req fee |
| sonar-reasoning-pro | Perplexity | Analytical tasks | $2/$8 + $0.01 req fee |
| deepseek-v4-flash:cloud (Ollama) | Ollama Cloud | Orchestrator tool-calling, patch_artifact | Inferred low-cost |
| gemma4:31b-cloud | Ollama | Orchestrator alternative | |
| qwen2.5-coder:32b | Ollama | Code synthesis (unused in landing-page context) | |
| llama3.1:latest | Ollama | Local orchestrator fallback | Free (local) |

**Landing Page Today:**
- **Standard:** Claude Sonnet (default in CLI and `/api/landing-page/generate`)
- **Deep:** Claude Opus with thinking enabled (via `--deep` flag in CLI or `deep_research: true` in API)

**For Studio:**
- **Direction planning** (3-direction recommendation): Claude Haiku or Sonnet
- **HTML generation**: Sonnet (default) or Opus (deep edit mode)
- **Visual QA / screenshot analysis**: Would need vision model — **not currently in the lineup**. No Claude Vision or GPT-4V configured.

---

## 8. Concrete gaps — what does NOT exist today

1. **Design system as executable product**
   - No dynamic CSS/theme builder for the generated landing page
   - No parameterized component library for in-preview theming
   - OKLCH tokens exist in workspace, but not in landing-page artifact generation

2. **Binary asset storage**
   - No Supabase Storage bucket for landing-page logos, mockups, screenshots
   - HTML embedded as text in `gtm_artifacts.content_md` — no separate file refs
   - Would need: `gtm-landing-page-assets/` bucket or Vercel Blob integration

3. **Visual QA capability**
   - Quality gates check HTML structure, copy, CSS patterns — NOT visual output
   - No Lighthouse/screenshot validation
   - No vision-model feedback on whether the generated page "looks AI-made"
   - Would need: Claude Vision or similar to validate rendered design

4. **Landing-page skill registered in GTM dispatch**
   - Dispatcher currently handles only 5 lighthouse skills (ingest-url, ingest-identity, research-market, research-competitor, research-icp)
   - No landing-page-studio entry in `dispatch-skill.ts`
   - Would need: New skill folder, input/output schema, dispatch handler

5. **Artifact versioning UI for landing pages**
   - ArtifactCanvas is read-only, no edit UI
   - No diff view between versions
   - Would need: HTML diff viewer (tricky for generated markup)

6. **In-app landing page preview shell**
   - No iframe sandbox or live preview component
   - ArtifactCanvas renders markdown via ReactMarkdown, not HTML
   - Would need: Safe HTML preview component (iframe with srcdoc, CSP headers)

7. **Chat-to-edit workflow for landing pages**
   - No `patch_artifact` tool for HTML (only markdown patches via Ollama)
   - Would need: Tool that accepts "add testimonials section" → re-renders HTML artifact

8. **Style/flavor persistence**
   - `--style` flag works in CLI but not serialized to artifact metadata
   - Would need: `metadata.style`, `metadata.design_philosophy` stored in gtm_artifacts row

9. **Design reference library as data**
   - Huashu/Impeccable/Taste are prompt text, not queryable data
   - Would need: `landing_page_design_philosophies` table with examples, palettes, precedents

10. **Vision model integration for style recommendation**
    - Currently: Agent recommends 3 directions as text
    - Would benefit from: Vision model analyzing brand colors, competitor sites, user-provided screenshots
    - Not configured in providers.ts

---

## Appendix: File Citations

### Landing Page Skill
- `skills/landing-page/SKILL.md:1–158`
- `skills/landing-page/prompts/system.md:1–202` (Huashu/Impeccable/Taste claims, anti-slop rules)
- `skills/landing-page/scripts/generate.ts:37–45` (model instantiation), line 72–75 (style augmentation)
- `skills/landing-page/references/huashu-design.md:1–50` (header, philosophy list)

### API Routes
- `src/app/api/landing-page/run/route.ts:1–43` (POST /run, full file)
- `src/app/api/landing-page/generate/route.ts:1–77` (POST /generate, full file)
- `src/app/api/landing-page/run/route.test.ts` — (exists, not read in detail)

### Quality Gates
- `src/lib/ai/landing-page/quality-gates.ts:1–182` (all gate logic)

### GTM Integration
- `src/lib/gtm/dispatch-skill.ts:1–90` (dispatcher, skill imports)
- `src/lib/gtm/orchestrator-tools.ts:1–100` (tool definitions)
- `src/app/api/gtm/runs/[runId]/dispatch/route.ts:30–100` (POST dispatch endpoint)
- `src/app/api/gtm/runs/[runId]/artifacts/route.ts:1–80` (GET artifacts)
- `supabase/migrations/20260501_create_gtm_artifacts.sql` (artifact table schema)

### Storage & Providers
- `src/lib/ai/providers.ts` (all models, cost table, ORCHESTRATOR_MODEL)
- `package.json` (Radix UI + shadcn + Tailwind deps)

### Design System
- `DESIGN.md` (typography, color, spacing, 2026-04-17 Phase 1 update)
- `src/components/ui/` (34 shadcn components)

### GTM Canvas & Routes
- `src/components/gtm/ArtifactCanvas.tsx:1–80` (artifact read-only preview)
- `src/app/gtm/[runId]/artifacts/[artifactId]/page.tsx` (artifact detail page)
- `src/app/gtm/[runId]/page.tsx` (GTM run chat page)

---

## Summary

The landing-page skill is a **fully functional, prompt-driven generator with hard quality gates and two API surfaces** (/run for agents, /generate for chat). The prompt text claims to combine Huashu, Impeccable, Taste, and UIUXProMax, but all of these are **inline guidance text, not loaded modules**. No executable design system, no asset storage, no visual QA.

The **GTM pipeline is ready to accept landing-page-studio as a new skill** via the dispatch-skill router and artifact versioning system. The infrastructure exists. What's missing is the skill itself, the theme builder, the visual preview component, and the integration plumbing.

**User's conclusion is correct**: The repo is missing not design assets, but design system as executable product workflow.

