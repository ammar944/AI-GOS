# Landing Page Studio — Tooling Research

Researched 2026-05-01 against `package.json`, `research-worker/package.json`, existing repo paths.

## 1. Tooling decisions

| Area | Choice | Rationale | Installed | Install |
|---|---|---|---|---|
| QA render+screenshot | `playwright` core in Railway worker | No Vercel cap; needs 170MB Chromium. `@playwright/test` is e2e runner overhead we don't need. Worker pattern matches `research-worker/src/runners/`. | N | `cd research-worker && npm i playwright && npx playwright install chromium` |
| Visual verdict | `@ai-sdk/anthropic` `generateObject` with image input | `visual-verdict` and `chrome-devtools-mcp` skills are Claude-harness only. Existing `src/lib/ai/landing-page/quality-gates.ts` is regex-only; vision is the missing layer. | Y (`^3.0.36`) | — |
| Asset upload | `/api/gtm/runs/[runId]/landing-pages/assets` → Supabase Storage `landing-page-assets` bucket | `@vercel/blob` not installed. Mirror `src/app/api/documents/upload/route.ts` (signed-URL fallback >4.5MB Vercel body limit). | Y (`@supabase/supabase-js`) | — |
| Color palette | LLM vision on uploaded logo, no library | `node-vibrant` unmaintained since 2019; `colorthief` adds native bindings. Vision returns palette as part of ingestion. Needs verification if pixel-exact required. | N (skip) | — |
| Existing-site screenshot | Same Playwright instance | Reuses Chromium. Firecrawl `screenshot` is for scraping, not brand pixels. | N | (above) |
| Iframe sandbox | `<iframe srcDoc sandbox="allow-scripts" referrerPolicy="no-referrer">` | Native; no fetch round-trip. NEVER pair `allow-same-origin` with `allow-scripts` — iframe escapes (MDN). | Y | — |
| Tailwind composition | Raw HTML/CSS for the artifact (existing skill pattern); shadcn only for studio chrome | `skills/landing-page/templates/` already raw HTML. Marketing pages need brand flex; shadcn zinc tokens work against that. | Y | — |

## 2. Schema draft — `gtm_landing_pages`

Sibling table to `gtm_artifacts`; HTML is too large for a `text` column and metadata diverges.

```sql
-- Migration: gtm_landing_pages — sibling to gtm_artifacts
-- HTML lives in Supabase Storage; row holds pointer + lineage + QA report.
CREATE TABLE IF NOT EXISTS public.gtm_landing_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          text NOT NULL REFERENCES public.gtm_runs(run_id) ON DELETE CASCADE,
  user_id         text NOT NULL,                 -- denormalized for RLS, mirrors gtm_artifacts
  direction       text NOT NULL,                 -- one of the 3 generated directions
  version         int  NOT NULL DEFAULT 1,
  parent_id       uuid REFERENCES public.gtm_landing_pages(id),
  storage_path    text NOT NULL,                 -- landing-pages/<run_id>/<id>/index.html
  html_size_bytes int  NOT NULL,                 -- audit: alert >1MB
  palette         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ["#0066FF", ...]
  source_assets   jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {logo_url, screenshot_urls, claims[]}
  qa_report       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {passed, failed_gates, signals, vision_score}
  screenshot_urls jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {desktop, mobile} signed URLs
  source          text NOT NULL CHECK (source IN ('llm_generation','tweak_patch')),
  created_by      text NOT NULL,                 -- clerk user_id or 'orchestrator'
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gtm_landing_pages_run_dir_version_unique UNIQUE (run_id, direction, version)
);
CREATE INDEX idx_gtm_landing_pages_run_id  ON public.gtm_landing_pages(run_id);
CREATE INDEX idx_gtm_landing_pages_user_id ON public.gtm_landing_pages(user_id);
ALTER TABLE public.gtm_landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own landing pages" ON public.gtm_landing_pages
  FOR ALL
  USING  (current_setting('request.jwt.claims', true)::json->>'sub' = user_id)
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'sub' = user_id);
```

## 3. Visual QA loop pseudocode

```
for direction in [minimalist, editorial, bold]:
  html        = generate_html(brand_assets, direction)             // Anthropic, raw HTML
  storagePath = supabase.storage.upload(html)
  page        = playwright.chromium.newPage()
  page.route('**/*', block_external_requests)                      // CSP-by-runtime tripwire
  page.setContent(html, waitUntil='networkidle')
  desktop = page.screenshot({ width:1440, height:900 })
  page.setViewportSize(375, 812); mobile = page.screenshot()
  consoleErrs = page.console_messages.filter(level=='error')
  overflow    = page.evaluate('document.documentElement.scrollWidth > innerWidth')
  regexQa     = runLandingPageQualityGates(html)                   // existing src/lib/ai/landing-page/quality-gates.ts
  vision      = anthropic.generateObject({ images:[desktop,mobile], schema:VerdictSchema })
  pass = !consoleErrs.length && !overflow && regexQa.passed && vision.score >= 7
  persist(gtm_landing_pages, { storagePath, qa_report:{...}, screenshot_urls })
```

## 4. Iframe sandbox config

```html
<!-- srcDoc: HTML in parent React state; no fetch, no cross-origin CSP issues -->
<!-- sandbox=allow-scripts: lets generated JS run; blocks forms/popups/top-nav -->
<!-- (deliberately NO allow-same-origin: pairing with allow-scripts lets the iframe escape) -->
<!-- referrerPolicy=no-referrer: prevents leaking the run URL to any image src the LLM hallucinated -->
<iframe
  srcDoc={generatedHtmlWithCspMetaTag}
  sandbox="allow-scripts"
  referrerPolicy="no-referrer"
  className="h-full w-full border-0"
  title={`Landing — ${direction}`}
/>
```

The runner injects this `<meta>` into the generated `<head>` before persist:
`<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'unsafe-inline'; style-src 'unsafe-inline' 'self'; img-src 'self' data: https:; connect-src 'none'; frame-ancestors 'self'">`. `connect-src 'none'` is the QA tripwire — any `fetch()` the LLM hallucinated throws and surfaces as a console error.

## 5. Five "do not"s

1. Do **not** render generated HTML with `dangerouslySetInnerHTML` — it inherits the app's CSP and can call Clerk/Supabase clients in the same window. Use `<iframe srcDoc>` only.
2. Do **not** combine `sandbox="allow-scripts allow-same-origin"`. MDN explicitly warns the iframe can then null its own sandbox attribute. Pick one.
3. Do **not** store HTML in a Postgres `text` column on `gtm_landing_pages`. 3 directions × ~200KB blows row-payload sweet spot and bloats list queries. Use Storage; keep `storage_path` only.
4. Do **not** run Playwright in a Next.js API route on Vercel. 170MB Chromium download exceeds the 250MB function size; cold-start > 60s. Railway worker only.
5. Do **not** call `oh-my-claudecode:visual-verdict` or `chrome-devtools-mcp:*` from worker code — they're Claude-harness skills, not HTTP APIs. Use them while iterating on prompts in this Claude session; for prod, call `@ai-sdk/anthropic` directly with image inputs.

## 6. Open questions

1. **Worker dispatch**: does `src/lib/gtm/dispatch-skill.ts` already have a Railway hook for non-skill jobs (screenshots), or do we add a new `RAILWAY_LANDING_PAGE_URL`? Needs verification.
2. **Playwright on Railway**: does the current plan/image support pre-installed Chromium, or do we need a custom Docker image? Confirm with infra.
3. **Palette determinism**: LLM-vision palette is fuzzy. If pixel-exact parity with the logo matters, revisit `node-vibrant` despite stale maintenance.
4. **Asset CSP**: if users paste screenshots of their existing site, those `https:` URLs are allowed by `img-src https:` but loosens the model — confirm signed-URL approach is acceptable.
5. **Reuse vs sibling**: alternative to sibling table is one row in `gtm_artifacts` with `skill='landing-page'` and metadata-encoded HTML pointer. PRD owner pick.
