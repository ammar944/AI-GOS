# Write-Back Contract

`present-workspace` owns the v3 Wave 4 write contract shape, but local verification never contacts Supabase.

## Target

- Table: `journey_sessions`
- Lookup keys: `user_id`, `run_id`
- JSONB field: `research_results`
- Section key: `research_results[section_key]`

## Envelope Shape

```json
{
  "status": "complete",
  "section": "icpValidation",
  "data": {
    "cards": []
  },
  "__cardEdits": {
    "card-id": {
      "field": "approved value"
    }
  },
  "durationMs": 0
}
```

`__cardEdits` is a section-level sibling of `data`. It must never be nested under `data`.

## Transport

The code defines a transport interface:

```ts
interface SupabaseWriteTransport {
  kind: "dry-run" | "mock-write";
  writeResearchResult(input: SupabaseWriteInput): Promise<SupabaseWriteReceipt>;
}
```

Only dry-run and mock transports are present in this skill folder. A future runtime may inject a live transport outside this portable package.

## Idempotency

The idempotency key is deterministic:

```text
present-workspace:<run_id>:<section_key>:<brief_snapshot_id or no-brief>:<sorted card ids>
```

Any receipt that claims a write happened must carry this key plus `run_id` and `card_kind` for every card result.
