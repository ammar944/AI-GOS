# Landing-Page-Studio — External References

URLs in `sources.yaml`.

## 1. Cross-product matrix

| Product | a. Directions | b. Asset ingest | c. Iteration | d. Sandbox | e. Persist | f. Components | g. QA | h. Pricing |
|---|---|---|---|---|---|---|---|---|
| **Lovable** | 1; chat or visual edit | Logo upload [not built](https://feedback.lovable.dev/p/brand-integration-support); design-system via GitHub URL | **AST diff** — Vite plugin tags JSX, Babel/SWC mutation, server diffs changed lines, HMR ([blog](https://lovable.dev/blog/visual-edits)) | Dev server + HMR | Cloud + GitHub sync | React+TS+Tailwind+shadcn-style | Self-unsticking | Credits |
| **v0** | **Multi** (3 variants) ([LogRocket](https://blog.logrocket.com/vercel-v0-ai-powered-ui-generation/)); fork | Figma frames, screenshot, Tailwind config | Full regen + **post-gen AST** rewrites imports/inlines lucide ([dev.to](https://dev.to/yuyz0112/how-i-reverse-engineered-vercels-v0dev-prompt-and-code-optimization-logic-2cli)) | Hosted iframe | CodeProject blocks; forkable | **shadcn + Tailwind + lucide** ([Willison](https://simonwillison.net/2024/Nov/25/leaked-system-prompts-from-vercel-v0/)) | Trust + AST | Per-gen |
| **Bolt** | 1 | Prompt + file | Full file rewrite | **WebContainer** Node-in-WASM | In-browser FS | LLM-picked (Vite+React) | Trust | Token caps |
| **Claude Artifacts** | 1 | Inline paste only | Full regen, reuses artifact ID ([Barber](https://www.reidbarber.com/blog/reverse-engineering-claude-artifacts)) | iframe `src=claudeusercontent.com` + postMessage + **React Runner** | Stateless; no fork | Tailwind+React+lucide; cdnjs only | None | Sub messages |
| **Replit Agent** | 1; **multi-agent** Manager/Editor/Verifier ([LangChain](https://www.langchain.com/breakoutagents/replit)) | Image, Figma, prompt | File edits + **auto-commit per step → time-travel** | Linux container | Git auto-commits | Agent-picked | **Verifier** asks user | Compute |
| **Framer AI** | Wireframer → 1 layout | CMS + AI colors/fonts | Canvas mutations | Framer canvas | Project DB + versions | Framer + Workshop | Trust | Subscription |
| **tldraw makereal** | 1 HTML | **Canvas screenshot to GPT-4V**; red = annotations | Re-screenshot + prev HTML in "white box" | iframe as tldraw shape | Tldraw doc | Tailwind via cdnjs | Trust | OSS |

## 2. Patterns that consistently win

- Sandboxed iframe for preview is universal (Claude, tldraw, v0, Bolt). Never inject into host DOM.
- Constrain the stack hard. Lovable/v0/tldraw all hard-pin React+Tailwind (+shadcn or Tailwind CDN). Anton Osika: LLMs perform far better when solution space is narrow.
- Stable IDs for diff target. Lovable's Vite plugin tags every JSX node; Replit auto-commits each step. Both sidestep regenerate-the-world tax.
- Post-generation AST pass beats prompt engineering. v0 rewrites imports + inlines icons after the model writes.
- Forkable artifacts. v0 forks variants, Replit forks repls. Users want a permanent ID per direction.

## 3. Patterns that diverge (and the right bet for AI-GOS)

- One vs many directions. v0 alone goes multi (3 variants). **Bet:** multi at first turn, single on tweak. Validates the user's hypothesis.
- iframe-srcdoc vs dev server. srcdoc = zero infra; dev server = HMR + real npm. **Bet for internal-90-day:** start srcdoc — no per-tenant container, free.
- Edit model. Full regen (v0/Bolt/Claude) is simpler. AST diff (Lovable) is faster but needs ID-tag plugin. **Bet:** ship full regen + `patch_text` (Ollama, free) per existing `.claude/rules/ai-sdk-patterns.md` split. Defer AST plugin.
- Component library. v0 hard-pins shadcn. **Bet:** shadcn + Tailwind, output as raw HTML+inline-Tailwind for srcdoc (skip React build).
- Brand ingestion. Lovable users *requesting* logo/color upload — gap. **Bet:** explicit BrandSpec form — leapfrog Lovable.

## 4. Anti-patterns to avoid

- Don't stuff whole project into context. Lovable explicitly stopped — quality dropped.
- Don't trust the model on output validity. Every winner adds verifier (Replit), post-gen AST (v0/Lovable), or CSP-locked sandbox (Claude).
- Don't run per-tenant container for an internal-only tool. Bolt's WebContainer is brilliant but wasted spend for a 5-skill audit tool.

## 5. Recommendations

1. **3-direction planner first turn, single on tweak** (v0). One BrandSpec → 3 directions; user forks one.
2. **shadcn HTML in `<iframe srcdoc>` + strict CSP** (Claude). Tailwind cdnjs, lucide inlined. No React build, no dev server.
3. **Explicit BrandSpec form** — logo URL, hex pair, font pair, hero copy, proof — leapfrogs Lovable's open gap. Persist per run.
4. **Two-tool tweak contract:** `patch_text` (Ollama, free) + `regen_section` (Anthropic, paid). Mirrors v0's regen + post-gen split.
5. **Fork + persistent direction IDs in Supabase** (Replit time-travel). Stable ID per direction; tweaks → child versions; tree UI for revert. Fits `gtm_runs`/artifacts schema.
