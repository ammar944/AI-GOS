---
title: Seven Levels of Front-End Design — Framework Applied to Landing Page Studio
type: external-framework
status: complete
source: Chase ("Chase AI Plus") YouTube — transcript supplied by user 2026-05-01 (38m48s)
url: https://www.youtube.com/watch?v=1PXFAFMgdns
---

# Seven Levels of Front-End Design — Framework Applied to Landing Page Studio

The user supplied this 38-minute YouTube transcript mid-research. It is **not** an internals doc on Lovable / v0 (those live in `references.md`). It is a layperson taxonomy of the **user-facing capability ladder** that any AI front-end tool walks. Maps directly onto the maturity curve we want `landing-page-studio` to travel. Quoted phrases below are verbatim from the transcript.

## The seven levels

| L | Name | Capability | Output quality | Trap |
|---|------|------------|----------------|------|
| 1 | The Prompter | Free-form text only | "Holy AI slop, hideous, generic, purple gradients" | No vocabulary, no examples, no anchors |
| 2 | The Skilled | Loads design skills (Anthropic frontend-design skill, "UIUX Pro Max" skill — speaker claims 52k★ OSS) | "Designed AI template — still AI" | Skills supercharge weak prompts but the ceiling is real |
| 3 | The Visual Director | Upload screenshots from awwwards / godly / Pinterest / Dribbble as inspiration | Closer to source, but lossy translation screenshot→code | "Vibe gap" — never quite nails it |
| 4 | The Cloner | Pull HTML+CSS+JS from a real site (View Source) and feed to Claude as templating reference | "Much closer; teaches you the underlying technique" | Plagiarism trap; still can't create original |
| 5 | The Designer | Custom assets — Midjourney for hero art, Veo3/Kling for video backgrounds, 21st.dev for components | Original character emerges | Component overload, lose coherence |
| 6 | The Iterator | External visual tools — Stitch, Figma, paper.design, pencil.dev — to ideate beyond what fits in a terminal | True creative expression with AI as the tool | Time sink |
| 7 | The Architect | Custom WebGL / shaders / 3D (Igloo, Active Theory, awwwards SOTD) | "Like a video game — straight-up art" | Out of reach for non-specialist + AI today |

## The meta-insight that drives the architecture

> "We have a very tough time articulating our taste because we don't even know the correct words to use. We aren't web designers. We don't know the vocabulary. And so that creates a translation disadvantage between you and Claude code."

Implication for `landing-page-studio`: **direction names must teach vocabulary**. Each of the 3 directions surfaced by the planner should be NAMED with a recognizable design term so the user learns the terms by selecting (e.g. "Editorial / Linear-Stripe", "Bento-grid / Notion-Vercel", "Hero-art / Lovable-Anthropic", "Brutalist / Are.na", "Eastern-typographic / Kenya-Hara"). Cross-reference: huashu-design's reference catalogue lists 5 design schools (info-architecture / motion-poetry / minimalism / experimental / Eastern) — same insight from a different angle.

## Mapping the studio's MVP to the levels

| Studio feature | Lifts the user from | To | How |
|---|---|---|---|
| Skill bodies routed through `generateGtmSkillObject` (already wired per `ai-sdk-patterns.md` 2026-05-01 update) | L1 | L2 | Loaded prompt + system rules; no longer free-form |
| **Inspiration uploader** in BrandSpec — drop awwwards/godly/Pinterest screenshots | L2 | L3 | Vision model reads inspiration as part of input to direction planner |
| **Site teardown ingestion** — paste a competitor URL, we pull HTML/CSS/JS as reference template | L3 | L4 | Use Playwright (already proposed for QA) to also fetch source-of-record HTML; feed to direction planner. Independent of (and complementary to) BrandSpec — BrandSpec = "what is YOUR brand", site-teardown = "what GOOD looks like" for direction inspiration |
| **Hero asset generation hook** — optional Midjourney / Nano Banana / Veo3 call when direction calls for hero art | L4 | L5 | Direction planner identifies pages where a hero illustration would land; user clicks "generate this for me" |
| **Curated component palette** — pre-vetted shadcn / Aceternity / Magic UI / 21st.dev sections the LLM can compose with | L4 | L5 | Constrain solution space (Anton Osika's narrow-stack hypothesis from Lovable). Already aligned with our current shadcn install |
| **Video hero with mobile fallback** — `<video autoplay muted loop>` for desktop, still image for mobile | L4 | L5 | Performance + mobile-first guard. Speaker explicitly recommends 15s subtle-motion loop |
| **Stitch/Figma export** — push the rendered HTML to a Figma file for designer-team handoff | L5 | L6 | Defer to Phase 3; Figma plugin exists; not MVP |
| Custom WebGL / shaders | — | L7 | Out of scope; "this is so far beyond you or me" |

## What this transcript validates that the agent research already said

- **Confirms Anton Osika's "narrow stack" hypothesis** (transcript L2: "skills supercharge our prompts even if we show up with something rather poor"). Reinforces v0's hard-pinned shadcn+Tailwind+lucide stack from `references.md`.
- **Confirms multi-direction is the differentiator** (transcript L3→L4 gap: "kind of close, but it's not going to be perfect"). Reinforces v0's 3-variant generation as the right MVP shape.
- **Confirms the visual-iteration tool ecosystem matters** (transcript L6: paper.design, Stitch, Figma, pencil.dev). Reinforces "this is iterative, not one-shot."

## What this transcript adds that the agent research did NOT cover

1. **Site-teardown ingestion as a first-class input.** Speaker built a custom Claude skill that fetches HTML+CSS+JS of a competitor site as templating reference. This is a NEW pattern. Pulling a competitor's source code (not just a screenshot) gives the model concrete code patterns to learn from. AI-GOS already runs Playwright for QA — same browser instance can fetch competitor source as part of BrandSpec ingest.

2. **AI image generation for hero art.** Speaker uses Midjourney v7 for "concept art" hero backgrounds when the page would otherwise feel flat. Pattern: direction planner flags pages where hero illustration would land; offers "generate this for you" → calls Midjourney/Nano-Banana/Veo3 API → embeds returned URL as `<img src=...>` or `<video src=...>`.

3. **Video hero with mobile fallback.** Veo3 / Kling 3.0 produces ~15s subtle-motion loops. Studio renders `<video autoplay muted loop>` for desktop, swaps for still image on mobile via media query or `<picture>` element. Performance + mobile-first guard.

4. **Vocabulary-as-output.** Per the meta-insight above. Direction names teach the user design vocabulary.

5. **Loading-state weight.** Speaker explicitly mentions adding a brief loading shimmer "to give it weight, makes it feel heavier" — concrete anti-AI-slop tactic worth adding to the QA gates rubric. Currently `quality-gates.ts` has 12 regex checks; this would be #13 ("missing_loading_state" — pages without a perceived-weight load transition feel cheap).

6. **Counter-animation, scroll progress bar, glass-morphism cards, "ticker" section dividers** — listed as premium-feel polish moves the speaker added in his level-6 pass. Each maps to a direction-specific stylistic option, not a universal requirement.

## Recommendations for PRD scope

**Add to MVP** (level 1→3 lift):
- `inspiration_screenshots` field on BrandSpec (file upload, ≤10 images, vision model reads in direction planning)
- Direction names with recognizable design vocabulary (5 named directions sampled from a fixed taxonomy of ~15)

**Add to Phase 2** (level 3→5 lift, after MVP ships):
- `competitor_urls` field on BrandSpec → triggers site-teardown ingestion → feeds direction planner
- `hero_asset_generation` toggle → calls Midjourney/Nano-Banana when direction calls for hero art (gated on env var presence)
- Video-hero option with mobile fallback

**Defer indefinitely**:
- Stitch/Figma round-trip export (level 6 outside-tool integration; nice-to-have, not load-bearing)
- WebGL / 3D direction (level 7; out of reach)

## Skills already loaded in this Claude session that map to the framework

These exist in this Claude Code session and inform the **generator-side prompt design** during studio development. They cannot be called by the AI-GOS runtime — runtime must reproduce relevant guidance inline (or in `skills/landing-page-studio/prompts/`):

- `frontend-design:frontend-design` — Anthropic's official frontend-design skill (the "level 2" reference)
- `oh-my-claudecode:designer` — UI/UX agent
- `oh-my-claudecode:visual-verdict` — visual QA verdict (level 3-4 inspiration loop)
- `chrome-devtools-mcp:take_screenshot` / `lighthouse_audit` — level 4 site teardown analysis
- `design-shotgun`, `design-html`, `design-consultation`, `design-review` — design-system workflow skills

Use these while authoring the studio's system prompt and during prompt-iteration in this Claude session. The runtime cannot call them.

## Source

- `https://www.youtube.com/watch?v=1PXFAFMgdns` — full transcript supplied by user; cited verbatim where load-bearing
