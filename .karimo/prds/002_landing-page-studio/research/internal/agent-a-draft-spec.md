# Landing Page Studio PRD

**Status:** Draft (Research Phase Complete)  
**Created:** 2026-05-01  
**Last Updated:** 2026-05-01

## 1. Vision

Build a **Lovable/v0-tier landing page generator** that integrates with the GTM orchestrator pipeline, persists artifacts to Supabase with versioning, and provides a live preview + edit workflow in the canvas chat interface.

**Goal:** Replace the standalone landing-page skill with a full-featured studio that:
- Generates production-ready HTML landing pages via prompt-driven synthesis
- Stores versioned artifacts in `gtm_artifacts` table
- Provides in-app preview (iframe sandbox)
- Enables agent-assisted editing and style iteration
- Applies hard quality gates (12 semantic checks)

---

## 2. Scope

### In Scope (MVP)
1. **Skill Dispatcher Integration**
   - Add `landing-page-studio` as a dispatchable skill (separate from lighthouse DAG)
   - Create dispatcher input/output schemas
   - Implement `dispatchLandingPageStudio()` function

2. **Artifact Persistence**
   - Store generated HTML in `gtm_artifacts.content_md` (text column)
   - Serialize style/design philosophy to `metadata` jsonb field
   - Support versioning via (run_id, skill, version) unique constraint

3. **Canvas Preview Component**
   - Render HTML artifact in safe `<iframe srcdoc={html} sandbox>` 
   - Display alongside raw markdown copy pane
   - Show metadata (style, philosophy, generated_at)

4. **Agent Tools**
   - `dispatch_landing_page_studio` — kicks off skill with brand/product description
   - `regenerate_landing_page` — re-run with different style/flavor
   - `patch_landing_page_artifact` — textual edits to HTML (Ollama-based)

5. **Design System Integration**
   - Ensure generated HTML uses OKLCH color space
   - Support shadcn/ui components if user provides brand theme
   - No dynamic theme builder yet (Phase 2)

### Out of Scope (Phase 2+)
- Vision model feedback on generated design
- Asset storage (logos, mockups, screenshots) — images as base64 or Supabase Storage refs
- Design reference library (Huashu/Taste as queryable data)
- Diff viewer for HTML artifact versions
- Chat-to-edit for complex structural changes
- Design system theme builder UI

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR1: Skill Input Schema
```typescript
interface LandingPageStudioInput {
  prompt: string;           // "A SaaS CRM for real estate wholesalers called DealFlow"
  run_id: string;
  mode?: "saas-product" | "general";  // default: "saas-product"
  preferred_style?: string; // "soft", "brutalist", "minimalist", etc.
  source_facts?: string[];  // URLs for sourced proof
}
```

#### FR2: Skill Output Schema
```typescript
interface LandingPageStudioOutput {
  run_id: string;
  stage: "generate-landing-page";
  generated_at: string;  // ISO datetime
  html: string;          // Complete, minified HTML
  metadata: {
    style?: string;
    design_philosophy?: string;
    word_count: number;
    sections: string[];  // ["hero", "features", "pricing", ...]
  };
  qa_report: {
    passed: boolean;
    failed_gates: string[];  // Which of 12 gates failed
  };
  source_gaps: Array<{
    field: string;
    severity: "blocker" | "warning";
    message: string;
  }>;
}
```

#### FR3: Hard Quality Gates (12 checks, all must pass)
1. `missing_semantic_html` — requires <header>, <nav>, <main>, <footer>
2. `missing_oklch_colors` — OKLCH color space required
3. `missing_focus_states` — :focus-visible or :focus must exist
4. `missing_reduced_motion` — prefers-reduced-motion if animations present
5. `missing_responsive_css` — @media queries required
6. `missing_touch_targets` — 44px min-height/width on interactive elements
7. `inter_as_display_or_global_font` — Inter guard (prevent global Inter)
8. `mobile_nav_overflow_risk` — .nav-links with overflow-x: auto pattern check
9. `generic_saas_copy` — block 8 filler words ("all-in-one", "seamless", etc.)
10. `placeholder_product_artifact` — block placeholder labels
11. `fake_or_unverified_proof` — block "trusted by" + famous logos without source facts
12. `missing_product_artifact` — require 8+ domain-specific terms + structure

#### FR4: GTM Dispatch Integration
- New route: `POST /api/gtm/runs/[runId]/landing-page` (or via orchestrator tool)
- Input validation against `LandingPageStudioInput` schema
- Dispatches to skill function (local sync or worker)
- Returns JSON with artifact + QA report
- Hard-fails (422) if quality gates not met
- Persists to `gtm_artifacts` with source='skill_output'

#### FR5: Artifact Versioning
- Each generation increments `gtm_artifacts.version`
- Unique constraint: (run_id, skill='landing-page-studio', version)
- Store in `content_md` as HTML text
- Metadata includes style, philosophy, QA pass/fail

#### FR6: Canvas Preview
- `ArtifactCanvas` renders HTML in iframe sandbox
- Display: skill name, version, metadata, QA status
- Copy button for raw HTML
- Link to full artifact detail page

#### FR7: Orchestrator Tools (Chat Integration)
```typescript
// dispatch_landing_page_studio
{
  type: "use_tool",
  toolName: "dispatch_landing_page_studio",
  toolInput: {
    prompt: "A meditation app called Mindful",
    preferred_style: "soft"
  }
}

// regenerate_landing_page_studio
{
  toolName: "regenerate_landing_page_studio",
  toolInput: {
    artifact_id: "uuid",
    preferred_style: "brutalist"  // change from previous
  }
}

// patch_landing_page_artifact (via Ollama)
{
  toolName: "patch_landing_page_artifact",
  toolInput: {
    artifact_id: "uuid",
    instruction: "Add a testimonials section with 3 customer quotes"
  }
}
```

### 3.2 Non-Functional Requirements

#### NR1: Performance
- HTML generation: <30s (Sonnet), <60s (Opus)
- Artifact save to Supabase: <2s
- Canvas preview render: <1s iframe load

#### NR2: Quality
- 100% of outputs must pass 12 hard QA gates
- No generic AI filler (anti-slop rules enforced)
- OKLCH color space mandatory
- Semantic HTML only

#### NR3: Security
- iframe sandbox: `allow-same-origin` (no scripts)
- CSP headers on artifact preview route
- RLS: user_id scoped read/write to `gtm_artifacts`

#### NR4: UX
- One-click artifact generation from chat
- Live preview updates on re-generation
- Clear fail reasons if QA gates rejected output
- Style/philosophy stored and re-applicable

---

## 4. Implementation Plan

### Phase 1: Skill Dispatcher & Persistence (Weeks 1-2)

**Tasks:**
1. Add `landing-page-studio` to `lighthouseSkillSchema` (or create separate enum)
2. Create `LandingPageStudioOutput` schema in `src/lib/gtm/types.ts`
3. Create `src/lib/gtm/skills/landing-page-studio.ts` dispatcher function
4. Add dispatch handler to `src/lib/gtm/dispatch-skill.ts`
5. Add POST route: `/api/gtm/runs/[runId]/landing-page/dispatch` (or reuse generic dispatch)
6. Wire artifact persistence: test storing HTML to `gtm_artifacts`
7. Test end-to-end: chat → dispatch → skill → artifact saved

**Files to Create/Modify:**
- `src/lib/gtm/types.ts` (+50 lines)
- `src/lib/gtm/skills/landing-page-studio.ts` (+80 lines)
- `src/lib/gtm/dispatch-skill.ts` (+15 lines)
- `src/app/api/gtm/runs/[runId]/landing-page/route.ts` (new, ~100 lines)

### Phase 2: Canvas Preview & Tools (Weeks 2-3)

**Tasks:**
1. Update `ArtifactCanvas.tsx` to detect HTML artifacts and render in iframe
2. Add sandbox policy + CSP headers
3. Create orchestrator tools:
   - `dispatch_landing_page_studio` (tool that calls dispatch endpoint)
   - `regenerate_landing_page_studio` (tool that re-runs with different style)
   - `patch_landing_page_artifact` (tool that calls Ollama for textual edits)
4. Test chat → tool call → dispatch → artifact → preview

**Files to Create/Modify:**
- `src/components/gtm/ArtifactCanvas.tsx` (+40 lines)
- `src/lib/gtm/orchestrator-tools.ts` (+100 lines)

### Phase 3: Quality Gates & Testing (Weeks 3-4)

**Tasks:**
1. Port quality gates from `src/lib/ai/landing-page/quality-gates.ts` to skill output validation
2. Ensure all 12 gates checked before artifact persisted
3. Add e2e test: chat → dispatch → QA rejection flow
4. Manual QA: generate 10 landing pages, verify no AI-ish output

---

## 5. Success Metrics

- [ ] MVP: chat generates landing page → artifact in Supabase → preview in canvas
- [ ] All 12 QA gates pass on 100% of MVP test outputs
- [ ] Artifact versioning works (v1, v2, v3 on re-generation)
- [ ] Orchestrator tools callable from chat
- [ ] Zero generic AI filler in outputs (manual review)

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Quality gates too strict (reject valid designs) | Run 10-design manual audit; adjust gate thresholds if needed |
| Artifact storage limits (text column bloat) | Monitor `gtm_artifacts` table size; plan binary asset storage (Phase 2) |
| HTML rendering sandbox issues (cross-origin styles) | Test iframe with external fonts; embed CSS + fonts in HTML |
| Chat tool orchestration complexity | Start with simple dispatch tool; add regenerate/patch in Phase 2 |
| Huashu/Taste claims unmaintainable (design drift) | Freeze design philosophy text in prompt; update only on manual review |

---

## 7. Dependencies

- ✅ Existing landing-page skill (quality gates, system prompt)
- ✅ GTM artifact table (`gtm_artifacts` schema exists)
- ✅ Orchestrator framework (tools, Ollama provider)
- ✅ Canvas component (ArtifactCanvas.tsx)
- ⚠️ No vision model (Phase 2: for visual QA feedback)
- ⚠️ No binary asset storage (Phase 2: for logo/mockup uploads)

---

## 8. Appendix: File Structure

```
src/lib/gtm/skills/landing-page-studio.ts
  ├─ LandingPageStudioInput interface
  ├─ LandingPageStudioOutput schema
  ├─ dispatchLandingPageStudio() function
  └─ input validation + schema parsing

src/lib/gtm/types.ts (additions)
  ├─ landingPageStudioInputSchema
  ├─ landingPageStudioOutputSchema
  └─ type LandingPageStudioOutput

src/lib/gtm/dispatch-skill.ts (additions)
  └─ if (skill === "landing-page-studio") { ... }

src/app/api/gtm/runs/[runId]/landing-page/route.ts
  └─ POST handler, dispatch to skill, persist artifact

src/lib/gtm/orchestrator-tools.ts (additions)
  ├─ dispatch_landing_page_studio tool
  ├─ regenerate_landing_page_studio tool
  └─ patch_landing_page_artifact tool

src/components/gtm/ArtifactCanvas.tsx (modification)
  └─ Add iframe renderer for HTML artifacts
```

---

**Next Steps:**
1. Await background research completion (Huashu license, competitive analysis)
2. Finalize Phase 1 task breakdown
3. Begin implementation of skill dispatcher & types
