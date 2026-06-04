# T13 Corpus Depth Evidence

Date: 2026-06-04
Branch: feat/research-quality-truthgate

## What changed

- Raised the worker deep-research corpus floor from 6 cited sources / 8 evidence items to 10 cited sources / 16 grounded evidence items.
- Added three bounded supplemental Perplexity topic fan-out calls after the primary corpus pass: company/market/buyers, competitors/pricing/offer, and VoC/demand/recent events.
- Added `corpus.intelligenceTopics` to the worker structured output contract, with typed topic buckets for company truth, market/category, buyers, competitors, VoC, demand, offer, pricing, and recent events.
- Updated corpus validation so source lineage covers both `corpus.evidence` and `intelligenceTopics[].evidence`; uncited topic evidence fails validation before persistence, and exact duplicate claim/quote/url triples do not inflate the evidence floor.
- Updated repair instructions and repair execution so repair calls preserve topic buckets, only use captured Perplexity citation URLs, and still receive the bounded topic fan-out pass after successful JSON repair.
- Added an Intelligence Topics section to the worker markdown artifact preview.
- Updated the app-side corpus adapter so topic evidence is flattened into global `corpus.excerpts` and routed into section-scoped `sectionExcerpts`.
- Topic summaries without a source URL are not converted into dropped excerpts; only sourced topic evidence enters the excerpt pipeline.
- Unmapped topics such as `recent_events` are treated as shared section context instead of being hidden by incidental keyword matches.

## Gates

- `pnpm vitest run src/lib/research-v2/__tests__/corpus-to-research-input.test.ts`
  - 1 file passed
  - 10 tests passed
- `pnpm exec vitest run --root research-worker src/__tests__/deep-research-program.test.ts --reporter=verbose`
  - 1 file passed
  - 7 tests passed
- `pnpm exec tsc --noEmit`
  - exit 0
- `pnpm run test:run`
  - 174 files passed
  - 1478 tests passed
  - 1 skipped
- `pnpm run build`
  - compiled successfully
  - TypeScript clean
- `pnpm run lint`
  - exit 0
  - 0 errors
  - 32 existing warnings
- `npm run build` from `research-worker/`
  - TypeScript build clean

## Worker Vitest Note

- `npm run test:run -- src/__tests__/deep-research-program.test.ts` from `research-worker/` hung inside the worker-local Vitest CLI, including on `./node_modules/.bin/vitest --help`.
- The same test file passed through the root Vitest binary with `--root research-worker`, so the code/test assertion gate is green but the worker-local CLI hang remains a tooling caveat.

## Pending

- Live corpus-depth gate is still pending.
- T13 should not be treated as fully accepted until a paid live run shows sections and the future T7/T9 thinker drawing on the richer source-cited corpus.
