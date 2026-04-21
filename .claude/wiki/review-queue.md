# Review Queue

The pressure valve. When an ingest agent can't cleanly decide `yes` (port to wiki) or `no` (discard), the item lands here instead of forcing a bad call.

## When to route to review

- Mixed: the source has both durable signal and disposable chat. Splitting it cleanly is non-trivial.
- Sensitive: touches people, private conversations, or customer data — needs human eyes before it enters the wiki.
- Thin-but-possibly-important: short conversation on a topic that might matter later, but not enough signal right now to justify a topic page.
- Taxonomy-ambiguous: doesn't fit any of the AIGOS domains in `taxonomy.md` — human should decide whether to add a domain or discard.

## Format

Append one block per item:

```
## <source-id> — <one-line title>
- Date: YYYY-MM-DD
- Source: wiki/sources/<slug>.md (or raw/<slug>.md if not yet normalized)
- Why review: <one sentence>
- Proposed: <yes/no/deferred> — <what to do next>
```

Keep it short. The review queue is NOT a second wiki — it's a holding pen.

## How to drain the queue

Weekly-ish (or when it gets longer than 20 entries):

1. Read each block.
2. Make the call: `yes` (ingest properly), `no` (delete the block), or `deferred` (leave for later, but annotate why).
3. For `yes` items: trigger normal ingest flow per `CLAUDE.md`.
4. For `no` items: just remove the block.

If an item has sat in review for 60+ days without being actioned, it's `no`. If you cared, you'd have processed it.

## Current queue

<!-- Append new items below this line. Keep newest at top. -->
