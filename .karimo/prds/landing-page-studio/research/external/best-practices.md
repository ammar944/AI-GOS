# huashu-design — Independent Audit for landing-page-studio

Repo: `https://github.com/alchaincyf/huashu-design` (branch `master`). Author: 花叔/花生 (alchaincyf, @AlchainHust). Launched April 2026, ~3 days after Anthropic's Claude Design; 662 stars / 106 forks in 48h. **Not a landing-page generator.** It's a Claude Code "skill" (SKILL.md + assets + scripts) that turns the agent into a designer for prototypes, slide decks, animations, infographics. Stack: HTML 72% / JS 25% / Shell / Python.

## 1. Repo structure

```
huashu-design/
├── SKILL.md                  # Agent-facing playbook
├── README.md / README.en.md
├── LICENSE                   # Personal-use license (see §2)
├── test-prompts.json
├── assets/                   # Starter components + audio
│   ├── animations.jsx        # Stage/Sprite/Easing/interpolate
│   ├── ios_frame.jsx, android_frame.jsx, macos_window.jsx, browser_window.jsx
│   ├── design_canvas.jsx     # Side-by-side variant grid
│   ├── deck_index.html, deck_stage.js   # Slide engines
│   ├── bgm-*.mp3 (5), sfx/ (37 SFX), showcases/ (24 samples = 8 scenes × 3 styles)
├── references/               # 20 deep-dive .md (workflow, design-styles, animation-pitfalls,
│                              # critique-guide, tweaks-system, verification, ...)
├── scripts/                  # render-video.js, convert-formats.sh, add-music.sh,
│                              # html2pptx.js, export_deck_*.mjs, verify.py
└── demos/                    # 9 capability demos
```

All files the user mentioned (`design_canvas.jsx`, `browser_window.jsx`, device frames, `verify.py`, showcases) are **confirmed present**.

## 2. License — verbatim quote

From `LICENSE` ("Huashu Design · Personal Use License", Copyright (c) 2026 alchaincyf):

> **2. 禁止的使用（必须事先授权）**
> - 任何**公司、团队、工作室、机构**将本作品集成到其内部工具链或对外产品
> - 将本作品或其派生物作为**面向付费客户的交付手段**（包括设计外包、品牌咨询、B 端 SaaS 等）
> - 基于本作品做**商业软件产品**、付费模板、付费订阅服务

Plain English: any company integrating the work into internal tooling or external products is prohibited; using it (or derivatives) as a delivery mechanism for paying clients — explicitly including B2B SaaS — is prohibited; building commercial products, paid templates, or paid subscriptions on top is prohibited. All such uses require prior written authorization from 花生.

**Verdict — safe to integrate code/assets in a commercial SaaS: NO.** The license names "B 端 SaaS" by name. User's read is accurate. Learning/research is permitted (§1), so we may study and re-derive **patterns**, but cannot copy code, assets, or directly-derived files into AIGOS without a commercial license.

## 3. Pattern catalog (idea-borrowable, code not)

| Artifact | Pattern | Borrow idea? |
|---|---|---|
| `SKILL.md` single playbook | Progressive-disclosure file routes agent through Phases 0-8. | YES |
| `design_canvas.jsx` | Always render ≥3 variations side-by-side; never one "perfect" answer. | YES |
| Device/window frames (`browser_window.jsx` etc.) | Centralize chrome so screen content can't break the bezel; never hand-code. | YES (only `browser_window` relevant to web LPs) |
| `assets/showcases/` (24 samples) | Pre-built sample gallery shown to ground style choice before generating. | YES |
| `references/design-styles.md` (20 philosophies, 5 schools, named designers) | Direction diversity rule: 3 recommendations from 3 different schools. | YES (taxonomy is uncopyrightable facts) |
| `references/critique-guide.md` (5-dim rubric: philosophy/hierarchy/execution/functionality/innovation + Keep/Fix/Quick Wins) | Self-critique loop after generation. | YES |
| Anti-AI-slop checklist (purple gradients, emoji-icons, rounded-card+left-border, SVG humans, Inter as display) | Concrete tells to avoid. | YES — directly relevant |
| Brand Asset Protocol (Logo→product→UI→color→type, persisted to `brand-spec.md` + `var(--brand-*)`) | A/B 5× lower variance vs. unprotocolized. | YES — load-bearing; aligns with our `ingest-identity` |
| "5-10-2-8" gate (search 5, curate 10, select 2, each ≥8/10) | Quantified asset quality bar. | YES |
| Junior Designer mode (assumptions+placeholders→grayscale early-show→fill→variations→tweaks) | Show-early loop with explicit mid-state checkpoints. | YES |
| `scripts/verify.py` | Playwright screenshot + `pageerror == 0` gate. | YES (already aligned with our verification.md) |
| MP4/GIF/audio toolchain, html2pptx, deck exports | Out of scope. | SKIP |

## 4. Generation model

**Iterative, multi-phase, with a "Direction Advisor" planner — not one-shot.**

- **Phase 0 — Fact verification:** specific products → `WebSearch` first, write `product-facts.md`.
- **Phases 1-3 — Brand Asset Protocol:** ask user → search official `<brand>.com/brand`, `/press` → download SVG/UI/product → grep hex from assets (never guess) → crystallize `brand-spec.md` + CSS variables.
- **Fallback: Design Direction Advisor** (8-phase) when context is thin: 3 directions from 3 different schools (info-architecture / motion-poetry / minimalism / experimental / Eastern), parallel demo generation, user picks/mixes/refines/restarts.
- **Phase 4 — Junior Designer:** placeholders + reasoning comments → grayscale early-show → fill → variations → real-time Tweaks parameter shifts.
- **Phases 5-7 — Validate:** Playwright screenshot + `pageerror==0`.

**Tech stack:** HTML-native, single self-contained file output. React via inline Babel `<script type="text/babel">`. **Tailwind is anti-pattern** in their spec ("rounded-card + left-border-accent — Tailwind/Material overuse"). Default typography: serif display (Newsreader / Source Serif / EB Garamond) + `-apple-system` body. Color via `oklch()`. Component library is starter components in `assets/`, not a full library.

## 5. Recommendation

**Borrow as PATTERN (rebuild, no code copying):**
1. SKILL.md-style single playbook with Phase 0 fact-check.
2. Brand Asset Protocol persisted to `brand-spec.md` (wire into `ingest-identity`).
3. Direction Advisor fallback (3 directions, 3 different schools, parallel demos).
4. `design_canvas`-style side-by-side variants as default UI.
5. 5-dimension self-critique rubric.
6. Anti-AI-slop checklist baked into system prompt + verification.
7. Playwright `verify.py`-style gate (screenshot + console errors).
8. Junior Designer iteration loop with grayscale early-show.

**Build from scratch:** `browser_window`-style chrome, our own showcase gallery, our own style taxonomy.

**Skip:** MP4/GIF/audio toolchain, editable-PPTX, iOS/Android/macOS frames, all `assets/` audio + showcase files.

**Hard rule:** do not copy any file, asset, or string into AIGOS. License blocks B2B-SaaS integration explicitly. Patterns and architectural ideas are fair game; their implementation is not.
