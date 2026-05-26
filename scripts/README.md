# V3 Soak Scripts

These scripts prepare the 48h v3 soak gate. They do not make Phase F/G safe by
themselves; teardown still waits for a green human-operated soak.

## Harness

Dry-run the bounded plan without spending API calls:

```bash
npm run soak:harness -- --dry-run --max-runs 2 --max-cost-usd 0.25
```

Run against a stable authenticated preview:

```bash
npm run soak:harness -- \
  --base-url https://your-preview.vercel.app \
  --user-data-dir .playwright-v3-soak-user \
  --urls https://ramp.com,https://vanta.com,https://webflow.com \
  --interval-ms 1800000 \
  --max-runs 96 \
  --max-cost-usd 10 \
  --estimated-cost-usd 0.1 \
  --run-timeout-ms 1800000 \
  --out /tmp/aigos-v3-soak/v3-soak.ndjson \
  --headful
```

The first headful run should be used to sign in through Clerk in the persistent
browser profile. Later runs reuse that profile. If Chromium is not already
installed in the Playwright cache, run `npx playwright install chromium` once.
The harness stops on the first hard failure and writes one NDJSON record per
run.

## Monitor

Check one run from DB-resident observability:

```bash
npm run soak:monitor -- --run-id <run_id>
```

Watch until complete or failed:

```bash
npm run soak:monitor -- --run-id <run_id> --watch --interval-ms 30000
```

Verify the failure path without mutating Supabase:

```bash
npm run soak:monitor -- --run-id <run_id> --simulate-error
```

The monitor flags `research_artifacts.status = error`,
`research_section_runs.status = error`, `research_section_events.event_type =
error`, and stale queued/running section rows with no children progress.
