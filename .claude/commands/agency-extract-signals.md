---
name: agency-extract-signals
description: Offline verbal-risk signal extraction from attributed Fathom transcripts. Fans out LOCAL Claude subagents over the 109 attributed calls, stages verbatim-quote signals as JSON, then runs the deterministic gated uploader into sl_fathom_signals. NO metered API. Use to populate the Account-Health Cockpit Fathom signals.
---

# Agency — Extract Fathom Signals (offline)

You are the offline signal-extraction phase of the Account-Health Cockpit's Fathom channel. You read attributed sales/CS transcripts and surface the handful of verbal risks a human account manager would flag — churn rumbles, ghosting, payment friction, promises made on the call, upsell openings.

**Hard rails — read before doing anything:**
- **NO metered API.** Extraction is done by you and LOCAL Claude subagents (the CLI subscription). Never call the Anthropic API, DeepSeek, or any paid endpoint from this runbook.
- **The ONLY DB write is the deterministic uploader** (`npm run agency:upload-signals`). It re-checks every staged quote against the stored transcript and drops fabrications at the DB boundary. You never write to Supabase directly.
- **Quotes must be VERBATIM.** A quote is a single-turn transcript substring, copied exactly — no paraphrase, no stitching two turns together, no cleanup. The uploader's gate rejects anything that isn't an exact substring of exactly one transcript turn (≥12 chars). Paraphrased quotes are silently dropped; that is wasted work, not a safety net.

## Pipeline

```
agency:sync-fathom --list-attributed   → work-list (109 attributed calls, ~26 client groups)
        ↓
LOCAL Claude subagents (grouped by client_slug)   → read transcript JSON, stage <slug>.json
        ↓
agency:upload-signals   → gate every quote, upsert into sl_fathom_signals + record sl_refresh_runs row
```

## Step 1 — Get the work-list (no DB, no creds)

```bash
npm run agency:sync-fathom -- --list-attributed
```

This prints a deterministic JSON array of the 109 attributed calls, sorted by `client_slug` then `recording_id`:

```json
[
  {
    "recording_id": "146193190",
    "client_slug": "zuppler",
    "call_type": "cs_checkin",
    "source_path": "intake/fathom/meetings/146193190.json"
  }
]
```

`source_path` is relative to the **SaaSLaunch repo root** (it already includes
`intake/fathom/meetings/`), so the absolute path is:
`/Users/ammar/Dev-Projects/saaslaunch/<source_path>`

**First run: narrow to one client and eyeball before the full sweep.**

```bash
npm run agency:sync-fathom -- --list-attributed --client=zuppler
```

Do zuppler end-to-end (Steps 2–3), open the staged `tmp/fathom-extract/zuppler.json`, and confirm by hand that each `quote` is a real verbatim substring of its transcript turn. Only then run the full 109-call sweep.

## Step 2 — Fan out LOCAL subagents (grouped by client_slug)

Group the work-list rows by `client_slug` (~26 groups). Dispatch one LOCAL Claude subagent per client group — a workflow, all local, no API spend.

Each subagent does, for every call in its group:

1. Read the transcript JSON at `/Users/ammar/Dev-Projects/saaslaunch/<source_path>` (source_path is repo-relative and already includes `intake/fathom/meetings/`).
2. Extract **at most 5** high-signal verbal-risk signals for that call. Fewer is fine — most calls have 0–2 genuine signals. Do not pad.
   - `signal_type` ∈ `churn_escalation` | `going_dark` | `payment_risk` | `verbal_promise` | `upsell_intent`
   - `severity` ∈ `low` | `medium` | `high`
   - `quote` — a VERBATIM single-turn substring of the transcript. Copy it exactly, including the speaker's wording. ≥12 chars. No paraphrase, no cross-turn stitching.
   - `rationale` — one line: why this turn is the signal it is.
   - `suggested_action` — optional one line: what the account manager should do.
   - `speaker` — optional: the `display_name` of the turn you quoted (helps the uploader resolve the match).
3. Append the call's signals to the client's staging file as flat array entries — one object per signal. Write to:
   `/Users/ammar/.config/superpowers/worktrees/AI-GOS/agency-cockpit/tmp/fathom-extract/<client_slug>.json`

### Staging JSON shape

One file per client slug, and it is a **FLAT JSON array of signal objects** — NOT
a nested `calls`/`signals` structure. The uploader reads a top-level array and
fails closed on anything else (an object wrapper aborts the whole upload). Each
object carries its own `recording_id` and `client_slug`. The uploader derives
`call_date`, `quote_sha256`, and `quote_match` deterministically from the stored
transcript, and re-resolves `client_slug` from the transcript (your value is a
fallback), so always include it.

```json
[
  {
    "recording_id": "123456789",
    "client_slug": "zuppler",
    "signal_type": "churn_escalation",
    "severity": "high",
    "quote": "we're seriously evaluating whether to renew at all this quarter",
    "speaker": "Maria Lopez",
    "rationale": "Client owner openly questioning renewal — direct churn risk.",
    "suggested_action": "Escalate to CS lead; book a save call before renewal date."
  },
  {
    "recording_id": "123456789",
    "client_slug": "zuppler",
    "signal_type": "verbal_promise",
    "severity": "medium",
    "quote": "I'll get you the updated logo files by end of week",
    "speaker": "Sam (SaaSLaunch)",
    "rationale": "Our team committed to a dated deliverable on the call.",
    "suggested_action": "Add to delivery tracker; confirm by Friday."
  }
]
```

`signal_type` ∈ `churn_escalation` | `going_dark` | `payment_risk` | `verbal_promise` | `upsell_intent`; `severity` ∈ `low` | `medium` | `high`. The uploader **rejects** (does not coerce) any signal outside these sets, so a typo silently drops that row.

Rules for subagents:
- Skip calls with no genuine signal — just add no entries for that `recording_id`. Never invent a signal to fill the slot. (An empty file is `[]`.)
- Never edit any file outside `tmp/fathom-extract/`. Read transcripts read-only.
- If a transcript file is missing at `source_path`, record nothing for that call and note it; do not guess.

## Step 3 — Upload (the only DB write, gated)

```bash
npm run agency:upload-signals
```

This deterministic uploader:
- Loads creds from `REPO_ROOT/.env.local` (never logs secret values).
- Reads every `tmp/fathom-extract/<slug>.json`.
- For each staged signal: re-fetches the stored transcript, re-runs the verbatim anti-fabrication gate (exact substring of exactly one turn, ≥12 chars), computes `quote_sha256`, and resolves `quote_match` (transcript index / timestamp / speaker).
- **Drops any quote that fails the gate** — fabrications and paraphrases die here.
- Upserts survivors into `sl_fathom_signals` (idempotent on `recording_id, signal_type, quote_sha256`).
- Records a `sl_refresh_runs` provenance row for the run.

Scope the first upload to zuppler if you staged only zuppler:

```bash
npm run agency:upload-signals -- --client=zuppler
```

A `--dry-run` is available and needs no creds — but with no creds it can't fetch the stored transcripts, so it reports the staged candidates and parse/shape validity only; it does NOT prove quotes are verbatim. The real verbatim gate runs only on a credentialed (non-dry-run) upload against `sl_fathom_transcripts`. Use `--dry-run` to sanity-check your staging files, then run for real to gate + write.

## Done criteria

- zuppler eyeballed: staged quotes verified verbatim by hand before the full sweep.
- Full sweep staged: one `tmp/fathom-extract/<slug>.json` per client, ≤5 signals/call, every quote a verbatim single-turn substring.
- `agency:upload-signals` run clean: report shows accepted/dropped counts and an `sl_refresh_runs` row was recorded. A nonzero drop count is expected and healthy — it is the gate doing its job, not an error to fight.
