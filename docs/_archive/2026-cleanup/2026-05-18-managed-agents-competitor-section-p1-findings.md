# Managed Agents Competitor Section P1 Findings

Status: passed after schema-boundary hardening; not production-integrated.
Date: 2026-05-18, updated 2026-05-19.
Scope: one-section Managed Agents proof for `positioningCompetitorLandscape`.

## Verdict

Programmatic Managed Agents setup, custom-tool resume, validation feedback, and final Section 03 artifact acceptance now work for one `positioningCompetitorLandscape` canary.

The first Sonnet 4.6 run failed because the save tool exposed `artifact` as a generic object. After adding an explicit Section 03 artifact schema/skeleton to the tool boundary, system prompt, user message, and repair feedback, Sonnet produced an artifact that passed both `CompetitorLandscapeArtifactSchema.safeParse` and `validateCompetitorLandscapeMinimums`.

This is still a canary result. Do not replace `/api/research-v2/orchestrate` yet; the next step is a separate Managed Agents app adapter behind a feature flag.

## Run

### Initial Failed Run

Command:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 5
```

Model:

- `claude-sonnet-4-6`

Resources created programmatically:

- Environment: `env_01GDZQUdrwB99zQ7ZaTy2QBc`
- Agent: `agent_01GRwUHHYctiJ98pzydHfGbk`
- Agent version: `1`
- Session: `sesn_013aG72HQkAPhxnFg4DmKokh`

Transcript:

- `tmp/managed-agents-competitor-section-canary-failed-sesn_013aG72HQkAPhxnFg4DmKokh-full.json`

No accepted artifact sidecar was written because final validation never passed.

### Schema-Hardened Passing Run

Command:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 5
```

The local SSE connection terminated after evidence collection while Anthropic still showed the session as `running`, so the canary was reattached with:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 5 --reuse-environment-id env_01D2xYn7quu8MYkQNPT12zay --reuse-agent-id agent_017c8hUXCFD9fQWAXC1gzfPX --reuse-session-id sesn_01CrNYjjfzSg5CKoHv5Fzmbo
```

Resources:

- Environment: `env_01D2xYn7quu8MYkQNPT12zay`
- Agent: `agent_017c8hUXCFD9fQWAXC1gzfPX`
- Agent version: `1`
- Session: `sesn_01CrNYjjfzSg5CKoHv5Fzmbo`

Artifacts:

- Transcript: `tmp/managed-agents-competitor-section-canary-success-sesn_01CrNYjjfzSg5CKoHv5Fzmbo-full.json`
- Accepted artifact: `tmp/managed-agents-competitor-section-canary-1779132163305-artifact.json`

## Custom Tools

Configured:

- `fetch_competitor_ads`
- `fetch_homepage_positioning`
- `fetch_pricing_evidence`
- `fetch_review_evidence`
- `fetch_share_of_voice`
- `save_competitor_landscape_artifact`

Observed tool calls:

| Tool | Count |
|---|---:|
| `save_competitor_landscape_artifact` | 3 |
| `fetch_share_of_voice` | 3 |
| `fetch_homepage_positioning` | 6 |
| `fetch_pricing_evidence` | 5 |
| `fetch_review_evidence` | 3 |
| `fetch_competitor_ads` | 1 |

All SearchAPI-facing tools used the local AI-GOS process and root `.env.local` `SEARCHAPI_KEY`; no paid API key was placed in the Managed Agents environment. Tool calls were bounded by `--limit 5` plus fixed request timeouts.

Schema-hardened run observed tool calls:

| Tool | Count |
|---|---:|
| `save_competitor_landscape_artifact` | 2 |
| `fetch_share_of_voice` | 3 |
| `fetch_homepage_positioning` | 5 |
| `fetch_pricing_evidence` | 5 |
| `fetch_review_evidence` | 2 |
| `fetch_competitor_ads` | 1 |

## Validation Result

Validation used the real worker-side Section 03 module:

- `CompetitorLandscapeArtifactSchema.safeParse`
- `validateCompetitorLandscapeMinimums`

Save attempts:

| Attempt | Result | Notes |
|---|---|---|
| 1 | `ok:false`, `schema_ok:false` | Deliberate invalid first-save probe returned field-addressable schema feedback. |
| 2 | `ok:false`, `schema_ok:false` | Full artifact attempt used wrong nested field names and missed required fields. |
| 3 | `ok:false`, `schema_ok:false` | Repair attempt still missed required fields including `competitorSet.competitors[*].sourceUrl`, `positioningTaxonomy.prose`, and axis fields. |

The repair feedback was returned as a normal `user.custom_tool_result` with `ok:false`, not as a transport-level `is_error`. The session resumed after each failed save, proving the repair loop transport.

Schema-hardened save attempts across the session:

| Attempt | Result | Notes |
|---|---|---|
| Initial probe | `ok:false`, `schema_ok:false` | Deliberate invalid first-save probe returned field-addressable schema feedback plus canonical skeleton. |
| Real save | `ok:true`, `schema_ok:true`, `minimums_ok:true` | Accepted artifact written to `tmp/managed-agents-competitor-section-canary-1779132163305-artifact.json`. |

Accepted artifact summary:

- `sources`: 16
- `competitorSet.competitors`: 6
- competitor types present: `direct`, `indirect`, `status-quo`, `diy`
- `positioningTaxonomy.axes`: 3
- `pricingReality.dataPoints`: 6 across 4 competitors
- `shareOfVoice.slices`: 4
- `publicWeaknesses.items`: 4 across 2 competitors
- `narrativeArcs.arcs`: 4
- `confidence`: 7

## Surprises

- In the first run, Sonnet 4.6 followed the deliberate invalid-save instruction and handled the custom tool loop, but did not reliably map the final artifact to the exact Section 03 schema after repair.
- The first failure was schema adherence, not Managed Agents programmatic setup, SSE parsing, SearchAPI execution, or custom-tool resume.
- A generic `artifact: object` save tool left too much nested shape inference to the agent. The explicit schema/skeleton fixed that.
- Google Ads Transparency evidence remained sparse for copy fields, matching the P0 spike: useful IDs/timing/detail links, weak headline/body/landing copy.
- Managed Agents custom tool schemas rejected `additionalProperties`; the canary now strips that keyword from the API-facing schema while preserving strict local Zod validation.
- Local SSE can terminate while the Managed Agents session continues running. The canary now supports `--reuse-session-id` so an operator can reconnect to the same session and continue handling tool calls.

## Recommendation

Proceed to a separate Managed Agents adapter, but keep it behind a feature flag and do not replace the current worker path.

Recommended next phase:

1. Extract the Managed Agents event loop into `src/lib/managed-agents/` without touching production orchestration behavior.
2. Move Section artifact schemas/minimum validators into a shared server module before Next routes import them.
3. Add a feature flag such as `ENABLE_MANAGED_AGENTS_SECTION_CANARY`.
4. Run only `positioningCompetitorLandscape` through the adapter first.
5. Persist accepted artifacts to the same Supabase projection tables only after standalone adapter tests pass.

The app adapter gate should require:

- first save rejected by validation,
- second or later save accepted,
- final `CompetitorLandscapeArtifactSchema.safeParse` success,
- `validateCompetitorLandscapeMinimums` success,
- accepted artifact JSON written under `tmp/`.

## Frontend Replay

A local inspection route now renders the successful saved session at:

- `src/app/research-v2/managed-agents-prototype/page.tsx`
- `http://localhost:3002/research-v2/managed-agents-prototype` when the current AI-GOS dev server is running on port 3002

This route is a replay/debug surface only. It reads the saved transcript and accepted artifact from `tmp/`, shows the Managed Agents event stream, tool-call counts, Google Ads Transparency rows, validation status, and the typed Section 03 artifact. It does not start a new Managed Agents session and is not part of the production `/research-v2` workflow.

Skill wiring status: the AI-GOS platform skill exists at `research-worker/platform-skills/ai-gos-competitive-positioning/SKILL.md`, but the passing Managed Agents canary did not attach that skill bundle to the Managed Agent. It used a hardcoded Section 03 prompt, explicit artifact skeleton, local custom tools, and real worker-side schema/minimum validation. Skill attachment remains a P2 integration gap before production adoption.

## P2 Multi-Platform Ad Evidence Proof

Date: 2026-05-19.
Status: passed as a local canary/prototype proof; not production-integrated.

Command:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 12 --model claude-sonnet-4-6 --ad-platform all --ad-competitor-count 3
```

The local SSE connection again terminated after ad evidence collection while the Managed Agents session kept running, so the same session was reattached with:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 12 --model claude-sonnet-4-6 --ad-platform all --ad-competitor-count 3 --reuse-environment-id env_017LKZVLLvLnANvBJTCQzEjk --reuse-agent-id agent_015zwaNpUXqxkU63t8NanZsM --reuse-session-id sesn_01Fjrz7FW76tBdGEhGWxCb6L
```

Resources:

- Environment: `env_017LKZVLLvLnANvBJTCQzEjk`
- Agent: `agent_015zwaNpUXqxkU63t8NanZsM`
- Session: `sesn_01Fjrz7FW76tBdGEhGWxCb6L`
- Transcript: `tmp/managed-agents-competitor-section-canary-1779137764782.json`
- Accepted artifact: `tmp/managed-agents-competitor-section-canary-1779137764782-artifact.json`
- Ad evidence sidecar: `tmp/managed-agents-competitor-section-canary-1779137764782-ad-evidence.json`

Observed tool calls:

| Tool | Count |
|---|---:|
| `fetch_competitor_ads` | 4 |
| `fetch_homepage_positioning` | 6 |
| `fetch_pricing_evidence` | 5 |
| `fetch_review_evidence` | 3 |
| `fetch_share_of_voice` | 3 |
| `save_competitor_landscape_artifact` | 2 |

Ad evidence results:

| Competitor | Raw Google | Raw LinkedIn | Raw Meta | Displayable creatives | Notes |
|---|---:|---:|---:|---:|---|
| `monday.com` | 40 | 24 | 30 | 2 | Displayable LinkedIn creatives only; Google and Meta rows were preserved as sparse raw evidence. |
| `Asana` | 0 | 24 | 0 | 24 | LinkedIn creatives returned; Google and Meta returned no raw rows for this advertiser. |
| `ClickUp` | 0 | 24 | 30 | 27 | LinkedIn and Meta creatives returned; sidecar stores 12 transcript-bounded creatives. |
| `Smartsheet` | 40 | 24 | 30 | 30 | LinkedIn and Meta creatives returned; Google raw rows preserved but not counted as displayable. |

Platforms proven:

- `fetch_competitor_ads` now accepts `all`, `google`, `linkedin`, and `meta`.
- The accepted run used `platform: "all"` for the audited company plus three direct competitors.
- Sidecar output preserves `raw_counts`, `displayable_counts`, `displayable_total`, bounded `adCreatives[]`, `libraryLinks`, `raw_source_samples`, `data_gaps`, and `source_errors`.
- Google transparency rows with IDs/detail links but no useful copy/media are recorded as raw source samples and sparse-field notes, not displayable creatives.

Skill wiring status:

- The canary attempted to attach `skill_012yUuFMRGtjKTeNXNxhPAvh` from the AI-GOS competitive-positioning platform skill.
- Initial session creation failed until the Managed Agent included the read-capable `agent_toolset_20260401`; the API error was: `Missing required tool: skills require the read tool to be usable (enabled and not always_deny) on the session's agent_toolset`.
- After enabling read, `GET /v1/agents/agent_015zwaNpUXqxkU63t8NanZsM` returned the custom skill attachment and read-only agent toolset config. The P2 sidecar records this as `skillWiring.status: "attached"`.

UI route evidence:

- Route: `http://localhost:3002/research-v2/managed-agents-prototype`
- Curl smoke: `200 text/html; charset=utf-8`
- DOM evidence contained `Multi-Platform Ad Evidence`, `monday.com`, `Asana`, `ClickUp`, `Smartsheet`, `LinkedIn`, `Meta`, `Google`, `returned creatives`, `Google raw transparency samples`, and `View ad`.
- Screenshot: `/tmp/managed-agents-prototype-p2-tall.png`

Verification notes:

- Root targeted Vitest passed for `src/lib/ad-library/__tests__/false-positive-prevention.test.ts` and `src/components/research/__tests__/competitor-ad-evidence.test.tsx`.
- Worker targeted Vitest passed for `research-worker/src/__tests__/adlibrary.test.ts`.
- Targeted lint passed for root-owned files; ESLint reported ignored-file warnings for `research-worker/` because the root lint config ignores that subtree.
- `npm run build` compiled and type-checked, then failed while prerendering `/_not-found` because Clerk publishable key was missing in the production build environment. This is an environment/config blocker outside the P2 ad-evidence changes.

Remaining production integration work:

1. Move the thin Managed Agents ad-evidence adapter behind an explicit production feature flag before wiring it into `/research-v2`.
2. Decide where raw ad evidence and sparse platform samples should persist instead of reading replay sidecars from `tmp/`.
3. Integrate the renderer into the production artifact surface only after persistence and redaction rules are settled.
4. Keep monitoring Managed Agents skill API behavior; the P2 canary proves skill attachment for this agent, but production code still needs a stable create/reuse policy for custom skill IDs and read-tool requirements.
