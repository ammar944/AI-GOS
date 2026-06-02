# Managed Agents Multi-Platform Ad Creatives Handoff

## Goal Launcher

```text
/goal Execute Managed Agents Multi-Platform Ad Creatives from /Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-19-managed-agents-multiplatform-ad-creatives.md.

Treat that handoff as the source of truth. Complete phases in order, obey all hard rules, run every verification gate, update docs where required, and return the final implementation report requested in the handoff. The goal is complete only when all listed completion criteria pass or an explicit blocker is reported with evidence.
```

## Execution Contract

### Objective

Upgrade the Managed Agents Section 03 prototype from a Google-only ad canary into a visible multi-platform competitor ad evidence proof.

The next execution should prove that a Managed Agent can fetch, preserve, and render raw competitor ad creatives for the audited company plus direct competitors across Google Ads Transparency, LinkedIn Ad Library, and Meta Ad Library, using AI-GOS-owned SearchAPI tooling and existing creative UI patterns.

This is still a prototype/canary slice. Do not replace the production `/research-v2` orchestration path yet.

### Source Of Truth Hierarchy

Use this order when docs, current code, and assumptions disagree:

1. This handoff.
2. `/Users/ammar/Dev-Projects/AI-GOS/AGENTS.md`.
3. `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-05-18-managed-agents-competitor-section-p1-findings.md`.
4. `/Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-18-managed-agents-competitor-section-p1.md`.
5. `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-03-12-journey-competitor-architecture-assessment.md`.
6. Current code and tests in this checkout.

Do not follow older Journey docs that describe `/journey` as the active product surface. `/research-v2` is canonical.

### Cwd And Branch

- Cwd: `/Users/ammar/Dev-Projects/AI-GOS`.
- Branch: inspect with `git status --short --branch`.
- Expected current branch from this handoff: `codex/claude-managed-agents-work`.
- Dirty worktree is expected. Do not revert or modify unrelated files.

### Completion Definition

This goal is complete when:

- The root cause is fixed, not merely explained: Managed Agents ad evidence is no longer Google-only and no longer limited to one competitor by default.
- `fetch_competitor_ads` or its replacement supports `google`, `linkedin`, `meta`, and `all`.
- A Managed Agents canary run on `monday.com` requests ad evidence for the audited company plus at least three direct competitors.
- Tool outputs preserve raw/displayable counts, platform counts, `adCreatives[]`, and `libraryLinks` per competitor.
- The local prototype page at `/research-v2/managed-agents-prototype` visibly renders multi-competitor ad evidence, including image/video/detail-link affordances when returned by SearchAPI.
- The UI honestly reports sparse or missing fields, especially Google transparency rows with no copy/media.
- AI-GOS platform skill wiring is either implemented for the Managed Agent or explicitly blocked with official/API evidence and documented.
- All verification gates pass, or a blocker is reported with exact command output and file evidence.

## Current State And Root Cause

### What The Prototype Shows Today

The current replay page only displays 5 Google Ads rows for one advertiser because the saved Managed Agents transcript only contains one ad tool call:

- Tool: `fetch_competitor_ads`
- Advertiser: `monday.com`
- Platform: `google`
- Limit: `5`

The page is rendering the saved evidence it has. The gap is upstream in the canary tool contract and prompt, not only in the UI.

### Known Code Evidence

Current Managed Agents canary limitation:

- `/Users/ammar/Dev-Projects/AI-GOS/scripts/managed-agents-competitor-section-canary.mjs`
- `buildFetchCompetitorAdsTool()` exposes `platform: { enum: ["google"] }`.
- `fetchCompetitorAds()` returns `P1 canary supports platform="google" only` for any non-Google platform.
- The user prompt says to use ads for "the audited company or one direct competitor only if ad evidence helps."

Existing richer v2/ad-library capability:

- `/Users/ammar/Dev-Projects/AI-GOS/research-worker/src/tools/adlibrary.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/ad-library/service.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/ad-library/types.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/ai/tools/mcp/ad-library-tool.ts`

Existing creative display patterns:

- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research/competitor-ad-evidence.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research/__tests__/competitor-ad-evidence.test.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/strategic-research/ad-carousel/ad-creative-card.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/strategic-research/ad-carousel/constants.ts`

Architecture assessment already identified the product gap:

- `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-03-12-journey-competitor-architecture-assessment.md`
- Missing fields: `adCreatives[]`, `detailsUrl`, `libraryLinks`.
- Missing UI: ad carousel, per-ad cards, Meta/LinkedIn/Google library buttons.
- Important warning: Meta Ads API is not the competitor-intelligence source. Public competitor creatives come from SearchAPI public library engines or equivalent approved sources.

### Live Probe Evidence From 2026-05-19

These were run from `/Users/ammar/Dev-Projects/AI-GOS` with root `.env.local` loaded and `SEARCHAPI_KEY` available.

Command shape:

```bash
set -a
source .env.local
set +a
cd research-worker
npx tsx scripts/test-ads.ts "ClickUp" "clickup.com" --searchapi-only
```

Observed results:

| Company | Raw Google | Raw LinkedIn | Raw Meta | Displayable creatives | Displayable platform mix |
|---|---:|---:|---:|---:|---|
| `monday.com` | 40 | 24 | 30 | 2 | LinkedIn only |
| `ClickUp` | 0 | 24 | 30 | 27 | LinkedIn 14, Meta 13, including Meta videos |
| `Smartsheet` | 40 | 24 | 30 | 30 | LinkedIn 20, Meta 10, including Meta videos |

Interpretation:

- Multi-platform source access works in the existing v2/worker ad path.
- Raw source counts and displayable creative counts are different by design.
- Google often returns transparency metadata without useful copy/media.
- LinkedIn and Meta are currently better sources for displayable creative cards and video/image proof.

## Scope

### In Scope

- Managed Agents canary script changes for multi-platform ad evidence.
- Local SearchAPI-backed custom tool execution in AI-GOS, keeping API keys out of the Managed Agents environment.
- A sidecar ad-evidence artifact under `tmp/` or equivalent local replay source.
- Prototype page rendering for multi-competitor ad creatives and platform library links.
- Focused tests for the ad evidence normalizer/adapter and creative rendering.
- Documentation updates describing what passed and what remains production integration work.
- AI-GOS platform skill wiring attempt or explicit blocker documentation.

### Out Of Scope

- Replacing `/api/research-v2/orchestrate`.
- Deleting or rewriting `research-worker/`.
- Six-section Managed Agents migration.
- Supabase schema migrations unless the executor proves they are necessary for the prototype.
- Production persistence of raw ad creatives.
- Using Meta Ads Manager API for competitor intelligence.
- Inventing ad copy, screenshots, pricing claims, platform coverage, or competitor creative data.
- Public customer exposure.

### Assumptions To Verify Before Editing

- `npm run managed-agents:competitor-canary -- --help` still works.
- Default canary model is still `claude-sonnet-4-6`; start with that model first.
- `SEARCHAPI_KEY` is available in root `.env.local`.
- `ANTHROPIC_API_KEY` is available from the same environment path used by the P1 canary.
- `src/app/research-v2/managed-agents-prototype/page.tsx` is still a local replay route and remains dev-only.
- The existing `CompetitorAdEvidence` component can either be reused directly or adapted with a small wrapper without broad UI refactors.
- The exact Managed Agents API support for attaching platform skills is not yet proven in this repo. Verify before claiming skill wiring is complete.

If any assumption is false, preserve the objective and adapt with the smallest implementation path.

## Architecture References

### Read First

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
sed -n '1,220p' AGENTS.md
sed -n '1,260p' docs/2026-05-18-managed-agents-competitor-section-p1-findings.md
sed -n '1,240p' docs/handoffs/2026-05-18-managed-agents-competitor-section-p1.md
rg -n "fetch_competitor_ads|platform=\\\"google\\\"|adCreatives|libraryLinks|fetchAllPlatforms|CompetitorAdEvidence|AdCreativeCard" scripts src research-worker docs
```

### Current Managed Agents Files

- `/Users/ammar/Dev-Projects/AI-GOS/scripts/managed-agents-competitor-section-canary.mjs`
- `/Users/ammar/Dev-Projects/AI-GOS/src/app/research-v2/managed-agents-prototype/page.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/middleware.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/tmp/managed-agents-competitor-section-canary-success-sesn_01CrNYjjfzSg5CKoHv5Fzmbo-full.json`
- `/Users/ammar/Dev-Projects/AI-GOS/tmp/managed-agents-competitor-section-canary-1779132163305-artifact.json`

### Existing Ad Evidence Sources

- `/Users/ammar/Dev-Projects/AI-GOS/research-worker/src/tools/adlibrary.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/research-worker/src/scripts/test-ads.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/research-worker/src/__tests__/adlibrary.test.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/ad-library/service.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/ad-library/types.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/ad-library/__tests__/false-positive-prevention.test.ts`
- `/Users/ammar/Dev-Projects/AI-GOS/src/lib/ai/tools/mcp/ad-library-tool.ts`

### Existing UI Sources

- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research/competitor-ad-evidence.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/research/__tests__/competitor-ad-evidence.test.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/workspace/cards/competitor-card.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/strategic-research/ad-carousel/ad-creative-card.tsx`
- `/Users/ammar/Dev-Projects/AI-GOS/src/components/strategic-research/ad-carousel/ad-creative-carousel.tsx`

### Platform Skill Source

- `/Users/ammar/Dev-Projects/AI-GOS/research-worker/platform-skills/ai-gos-competitive-positioning/SKILL.md`

## Hard Rules

- Keep SearchAPI and Anthropic keys in the local AI-GOS process. Do not put third-party API keys inside Managed Agents environments.
- Do not invent ad copy when a platform returns IDs/timestamps only.
- Do not count raw Google transparency rows as displayable creatives unless they have useful text, image, video, or detail-link evidence.
- Preserve raw source counts separately from displayable creative counts.
- Do not regress Section 03 schema validation from the P1 canary.
- Do not force `adCreatives[]` into `CompetitorLandscapeArtifactSchema` unless the schema is intentionally extended and tests are updated. For this slice, a sidecar ad-evidence payload is acceptable and preferred for the prototype.
- Avoid creating a third long-term ad-library implementation. If the canary needs a short script adapter, document it as temporary and keep it thin.
- Reuse existing UI components where practical; do not rebuild the strategic-research carousel from scratch.
- Keep the prototype route dev-only.
- Do not modify unrelated dirty files or revert user changes.
- Use `rg`, non-interactive commands, and minimal diffs.

## Execution Order

1. Preflight and root-cause confirmation.
2. Decide the ad-library reuse boundary.
3. Build a deterministic multi-platform ad evidence adapter/probe.
4. Extend Managed Agents custom tool contract and prompt.
5. Render multi-competitor creative evidence in the prototype.
6. Verify with tests, canary run, and browser proof.
7. Update findings docs and return the final report.

## Per-Phase Checklist

### Phase 1: Preflight And Root-Cause Confirmation

Deliverables:

- Confirm branch, dirty state, current canary script behavior, and current prototype route.
- Confirm that the saved replay contains only one `fetch_competitor_ads` call.
- Confirm that the older/v2 ad path can still fetch multi-platform data.

Commands:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git status --short --branch
npm run managed-agents:competitor-canary -- --help
rg -n "function buildFetchCompetitorAdsTool|P1 canary supports platform|Use fetch_competitor_ads" scripts/managed-agents-competitor-section-canary.mjs
rg -n "fetchAllPlatforms|normalizeSearchApiToCreatives|buildAdInsight|adCreatives|libraryLinks" src/lib/ad-library research-worker/src/tools/adlibrary.ts
```

Optional replay inspection:

```bash
node -e "const t=require('./tmp/managed-agents-competitor-section-canary-success-sesn_01CrNYjjfzSg5CKoHv5Fzmbo-full.json'); const events=Array.isArray(t.events)?t.events:t; console.log(JSON.stringify(events).match(/fetch_competitor_ads/g)?.length ?? 0)"
```

Pass condition:

- The executor can state exactly why the current prototype only shows 5 Google rows for one advertiser.

### Phase 2: Decide The Ad-Library Reuse Boundary

Deliverables:

- Decide whether the Managed Agents script should call:
  - the app-layer `src/lib/ad-library/service.ts`,
  - the worker `research-worker/src/tools/adlibrary.ts`,
  - or a thin temporary script adapter copied from the current SearchAPI patterns.
- Document the decision in the final report.

Decision criteria:

- Prefer existing code with tests.
- Do not make Next production code import from `research-worker/`.
- Do not add a large duplicate ad-library implementation if a small shared module can work.
- If `tsx` or a package change is required to reuse TypeScript from the canary, justify it and add it to `package.json`; do not rely on one-off global installs.
- If the safe path is a temporary `.mjs` adapter inside `scripts/`, keep it bounded and make the future consolidation explicit.

Pass condition:

- There is one clear ad-evidence execution boundary before implementation begins.

### Phase 3: Build Multi-Platform Ad Evidence Adapter/Probe

Deliverables:

- A deterministic local function or script that accepts:

```json
{
  "advertiser_name": "ClickUp",
  "domain": "clickup.com",
  "platform": "all",
  "region": "US",
  "limit": 12
}
```

- Output shape must include:

```json
{
  "ok": true,
  "advertiser_name": "ClickUp",
  "domain": "clickup.com",
  "requested_platform": "all",
  "raw_counts": {
    "google": 0,
    "linkedin": 24,
    "meta": 30
  },
  "displayable_counts": {
    "google": 0,
    "linkedin": 14,
    "meta": 13
  },
  "adCreatives": [
    {
      "platform": "linkedin",
      "id": "string",
      "advertiser": "string",
      "headline": "string|null",
      "body": "string|null",
      "imageUrl": "string|null",
      "videoUrl": "string|null",
      "format": "video|image|carousel|text|message|unknown",
      "isActive": true,
      "firstSeen": "string|null",
      "lastSeen": "string|null",
      "detailsUrl": "string|null"
    }
  ],
  "libraryLinks": {
    "metaLibraryUrl": "string",
    "linkedInLibraryUrl": "string",
    "googleAdvertiserUrl": "string"
  },
  "data_gaps": ["string"]
}
```

Implementation notes:

- Preserve platform-specific source counts even when creative normalization filters records out.
- Limit returned creatives per competitor so the transcript stays readable.
- Include data gaps for sparse Google fields, rejected ambiguous advertiser matches, missing media, rate limits, and platform errors.
- Keep timeouts and limits bounded.

Probe commands:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
set -a
source .env.local
set +a
cd research-worker
npx tsx scripts/test-ads.ts "monday.com" "monday.com" --searchapi-only
npx tsx scripts/test-ads.ts "ClickUp" "clickup.com" --searchapi-only
npx tsx scripts/test-ads.ts "Smartsheet" "smartsheet.com" --searchapi-only
```

Pass condition:

- At least two competitors return displayable LinkedIn or Meta creatives.
- Sparse Google rows are preserved as source evidence but not misrepresented as visible creative proof.

### Phase 4: Extend Managed Agents Tool Contract And Prompt

Deliverables:

- Update `fetch_competitor_ads` or introduce a clearer replacement such as `fetch_competitor_ad_evidence`.
- Tool input supports:

```json
{
  "advertiser_name": "string",
  "domain": "string|null",
  "platform": "all|google|linkedin|meta",
  "region": "US|CA|UK|AU|ALL",
  "limit": 12
}
```

- Managed Agents user prompt requires ad evidence for:
  - the audited company, and
  - at least three direct competitors when direct competitors are discovered.
- The prompt must tell the agent:
  - use `all` first unless a targeted platform check is needed,
  - report raw/displayable counts separately,
  - cite sparse/missing fields honestly,
  - do not invent competitor ad copy,
  - call the save artifact tool only after ad evidence has been gathered or explicitly returned empty.

Skill wiring:

- Attempt to attach or otherwise use the AI-GOS competitive positioning skill bundle from `research-worker/platform-skills/ai-gos-competitive-positioning/SKILL.md`.
- If Managed Agents API does not support the expected skill attachment path, stop claiming skill wiring and document:
  - exact API/docs checked,
  - exact response/error,
  - fallback used for the prototype.

Pass condition:

- A new canary transcript shows multiple ad tool calls across multiple competitors and at least one `platform: "all"` request.

### Phase 5: Render Multi-Competitor Creative Evidence In Prototype

Deliverables:

- Update `/Users/ammar/Dev-Projects/AI-GOS/src/app/research-v2/managed-agents-prototype/page.tsx` and/or a focused child component.
- Render ad evidence per competitor with:
  - competitor tabs or grouped sections,
  - raw source counts,
  - displayable creative counts,
  - platform chips,
  - image previews where available,
  - video affordances where available,
  - details links,
  - Meta Library / LinkedIn Ads / Google Ads links,
  - explicit empty/sparse states.
- Prefer reusing `CompetitorAdEvidence` or strategic ad carousel components. If direct reuse is blocked by component assumptions, add a small adapter rather than duplicating the full UI.

Pass condition:

- The prototype visibly shows more than one competitor and more than Google-only evidence when the sidecar/transcript contains it.
- Empty states explain source gaps without making fake claims.

### Phase 6: Verification

Run targeted tests first:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
npm run test:run -- research-worker/src/__tests__/adlibrary.test.ts src/lib/ad-library/__tests__/false-positive-prevention.test.ts src/components/research/__tests__/competitor-ad-evidence.test.tsx
```

Run targeted lint:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
npm run lint -- scripts/managed-agents-competitor-section-canary.mjs src/app/research-v2/managed-agents-prototype/page.tsx src/components/research/competitor-ad-evidence.tsx src/lib/ad-library/service.ts src/lib/ad-library/types.ts
```

Run the canary:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
set -a
source .env.local
set +a
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 12 --model claude-sonnet-4-6
```

If the script adds new flags for ad platforms/competitor counts, use them explicitly and record the exact command in the final report.

Verify the local route:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
curl -s -o /tmp/managed-agents-prototype.html -w "%{http_code} %{content_type}\n" http://localhost:3002/research-v2/managed-agents-prototype
rg -n "LinkedIn|Meta|Google|Ad creatives|Displayable|Library" /tmp/managed-agents-prototype.html
```

Browser proof:

- Use the in-app browser or an available browser automation tool to open `http://localhost:3002/research-v2/managed-agents-prototype`.
- Capture a screenshot or provide equivalent DOM evidence.
- Confirm that at least one LinkedIn or Meta creative group is visible when available.

Build gate:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
npm run build
```

If full build fails because of unrelated dirty files or pre-existing issues, capture the failure, identify the unrelated file/path, and still run the targeted gates above.

### Phase 7: Documentation Update

Update:

- `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-05-18-managed-agents-competitor-section-p1-findings.md`

Add a dated section covering:

- new canary command,
- transcript path,
- ad sidecar path if created,
- raw/displayable counts per competitor,
- platforms proven,
- skill wiring status,
- UI route evidence,
- known gaps before production integration.

Pass condition:

- The doc clearly distinguishes:
  - P1 Section 03 schema proof,
  - this P2 multi-platform ad evidence proof,
  - remaining production integration work.

## Verification Matrix

| Gate | Command | Expected Pass Condition |
|---|---|---|
| Preflight | `git status --short --branch` | Branch and dirty state recorded; unrelated changes preserved. |
| Canary help | `npm run managed-agents:competitor-canary -- --help` | Script starts and documents relevant flags. |
| Existing ad tests | `npm run test:run -- research-worker/src/__tests__/adlibrary.test.ts src/lib/ad-library/__tests__/false-positive-prevention.test.ts src/components/research/__tests__/competitor-ad-evidence.test.tsx` | Tests pass or failures are explained as unrelated/pre-existing with evidence. |
| Lint | `npm run lint -- <changed files>` | Changed files pass lint. |
| Managed Agents run | `npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 12 --model claude-sonnet-4-6` | Transcript contains multiple ad calls and at least one non-Google platform result if source APIs return data. |
| Route smoke | `curl -s -o /tmp/managed-agents-prototype.html -w "%{http_code} %{content_type}\n" http://localhost:3002/research-v2/managed-agents-prototype` | `200 text/html; charset=utf-8`. |
| UI evidence | Browser screenshot or DOM evidence | Multi-competitor ad evidence visible; non-Google evidence visible when present. |
| Build | `npm run build` | Passes, or blocker is documented with exact unrelated failure evidence. |

## Final Report Format

Return this structure:

```markdown
## Result
- Status: passed | blocked
- Branch:
- Summary:

## Files Changed
- path: change summary

## Managed Agents Run Evidence
- Command:
- Model:
- Environment:
- Agent:
- Session:
- Transcript:
- Accepted artifact:
- Ad evidence sidecar:

## Ad Evidence Results
| Competitor | Raw Google | Raw LinkedIn | Raw Meta | Displayable creatives | Notes |
|---|---:|---:|---:|---:|---|

## UI Evidence
- URL:
- Screenshot/DOM evidence:
- What is visible:

## Verification
| Gate | Result | Evidence |
|---|---|---|

## Deviations Or Blockers
- None, or exact blocker with command output and file/API evidence.

## Remaining Production Work
- Adapter behind feature flag.
- Persistence decision for raw ad evidence.
- Production `/research-v2` renderer integration.
- Any remaining skill attachment work.
```

