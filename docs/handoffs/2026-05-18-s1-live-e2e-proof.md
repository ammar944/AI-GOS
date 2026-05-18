# S1 Live E2E Proof - 2026-05-18

## Run

- URL: `https://fellow.app`
- Run ID: `1d4db1e3-9494-463c-98b2-7094a335751b`
- Artifact ID: `db1615bf-8343-4a14-a36e-e34819323951`
- Screenshot: `docs/research-v2-e2e-2026-05-18.png`
- Browser console check: zero `[artifact-surface]` warnings observed.

## Preflight

- Cleaned stale listeners before boot:
  - `:3001` was an old AI-GOS worker process.
  - `:3000` was a different repo's Next dev server.
- Booted fresh:
  - Next.js: `http://localhost:3000`
  - Research worker: `http://localhost:3001`
- Worker health: `{"status":"ok"}`
- App health returned `status:error` because root `.env.local` was missing `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- The run still proceeded because Clerk keyless development mode created a user and the worker had `ANTHROPIC_API_KEY` from `research-worker/.env`.

## Runtime Notes

- Corpus finished successfully and wrote `deepResearchProgram` in `197.8s`.
- Section run durations:
  - `positioningVoiceOfCustomer`: `105s`
  - `positioningCompetitorLandscape`: `118s`
  - `positioningDemandIntent`: `122s`
  - `positioningBuyerICP`: `125s`
  - `positioningMarketCategory`: `140s`
  - `positioningOfferDiagnostic`: `140s`
- The app did not open the section operator immediately. It stopped at `GTM Brief Review`.
- The Fellow corpus left required review fields empty, so conservative QA values were entered manually. Unknown metrics were entered as `Not available in public corpus for this QA run.`
- Clerk's keyless widget covered the fixed `Run audit` button at the default viewport. A wider viewport was required to click the button.
- Current build auto-dispatched all six sections after onboarding save via `/api/research-v2/orchestrate`; there was no need to click a per-section button six times.

## Section Render Result

| Zone | Status | Render path observed | Markdown fallback |
| --- | --- | --- | --- |
| `positioningMarketCategory` | Draft ready | Typed cards | No |
| `positioningBuyerICP` | Draft ready | Buyer ICP typed renderer | No |
| `positioningCompetitorLandscape` | Draft ready | Typed cards | No |
| `positioningVoiceOfCustomer` | Draft ready | Typed cards | No |
| `positioningDemandIntent` | Draft ready | Typed cards | No |
| `positioningOfferDiagnostic` | Draft ready | Typed cards | No |

## Verdict

S1 is verified in this live run. The final reader reached `Audit ready`, `6/6`, `Wave 1 of 1 - 0 running, 0 queued`. A DOM inspection found no raw `**Verdict:**` markdown and no raw bold markdown markers in any section.

All six committed `research_artifact_sections` rows have non-null `data`, including the bottom-four zones that previously fell through to markdown.

The header showed `33` sources, not `0`, so the R3 source-count bug did not reproduce on this run.
