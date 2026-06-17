# Research Quality Fixes Report - 2026-06-16

## Source

- Handoff: `docs/handoffs/2026-06-16-research-quality-fixes-handoff.md`
- Live regression run: `c9bc2056-627c-471d-b98b-98ed224085c2`
- Goal: make the reader output useful and honest for client work, not merely validator-passing.

## Kinks Found

- Voice of Customer reused the same sparse extracts across pain, objections, switching stories, and decision criteria. A run could look full while carrying only two distinct customer signals.
- BuyerICP could fail the whole section when the model found too few grounded personas, triggers, or firmographic cuts, instead of committing an honest gap.
- BuyerICP repair needed several passes because live sparse outputs can miss multiple independent floors at once.
- PaidMediaPlan had previously conflated a cost per qualified trial with customer CAC. That made the spend model read more confident than the evidence allowed.
- Quote source labeling overpromised `Permalink` even when the URL was only a source page.
- Reader text could still surface operator words such as `source-liveness`, `blockGap`, and `evidenceGap`.
- Live evidence-pool reads emitted non-fatal warnings while reading parent artifacts. The run continued, but the warning is still a product kink.

## Bloat Found

- Confidence chips, coverage notes, trust-tier dots, and `N of 6 strongly evidenced` counters made the UI optimize for validator posture instead of reading quality.
- Paid media opened on a deck view by default, hiding the working plan that operators actually need first.
- Research sections were not ordered in the actual pipeline sequence, so the reader path did not match how the research was produced.
- BuyerICP showed a hardcoded exclusion example instead of the artifact's real tension or an honest gap.
- Section coverage components duplicated schema/status information without making the research easier to use.

## Fixes Made

- Sparse VoC now keeps the real captured extracts in `painLanguage` only and leaves secondary blocks empty with explicit block gaps. It no longer fans out two quotes into eight rows.
- VoC candidate tests now assert quote text is not duplicated across quote-bearing blocks.
- BuyerICP normalization now converts sparse live output into honest degraded artifacts with block gaps instead of throwing validation errors.
- BuyerICP repair now loops through multiple missing evidence floors in one rerun.
- Paid media reader copy now distinguishes cost per qualified trial from modeled customer CAC bands.
- Removed reader-facing confidence chips, coverage notes, trust-tier dots, and strong-evidence rollup copy.
- Changed paid media to open on the working view by default.
- Reordered the reader sections to pipeline order: Market, Buyer, Competitor, VoC, Demand, Offer, PaidMedia.
- Replaced the hardcoded BuyerICP exclusion with artifact data or a gap note.
- Changed quote-card labeling from `Permalink` to `Source`.
- Expanded reader scrubber coverage for internal vocabulary.

## Live Result

After the fixes, rerunning `c9bc2056-627c-471d-b98b-98ed224085c2` produced honest degraded output instead of fabricated fullness.

- `positioningBuyerICP`: `status=complete`, `tier=insufficient`, no error. The latest artifact has zero personas, zero firmographic cuts, zero triggers, and zero venues, all with block gaps instead of fabricated names or hard failure.
- `positioningVoiceOfCustomer`: `status=complete`, `tier=insufficient`. It carries two pain extracts from one Gartner source, with objections, switching stories, decision criteria, and success language empty and gapped. There is no 8x reuse.
- `positioningPaidMediaPlan`: `status=complete`, `tier=needs_review`. The plan labels `$3,000` as cost per qualified trial/signup, not customer CAC, and shows modeled customer CAC as `$12,000-$30,000`.

## Remaining Product Gaps

- The app still needs better acquisition for client-grade VoC. Two quotes from one Gartner source is honest but not enough for a strong customer-language section.
- BuyerICP needs better source discovery for grounded personas, buying triggers, firmographic cuts, and venue evidence. The current result is correct to degrade, but not yet valuable research.
- Paid media math now reads correctly, but the plan is only as good as the degraded upstream sections.
- Perplexity/Sonar should be used as a bounded source-discovery/acquisition path, not as a prose authority. DeepSeek can remain a writer/repair provider after tool results are validated.
- Repo-wide lint is still blocked by unrelated script/tmp issues in this dirty tree. The touched surface is covered by focused tests, full tests, typecheck, and build.

## Verification

- `npm run test:run -- src/lib/lab-engine/agents/verification/__tests__/quote-admission.test.ts src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts src/components/research-v2/__tests__/audit-reader-shell.test.tsx src/components/research-v2/section-renderers/__tests__/market-category.test.tsx src/components/research-v2/section-renderers/__tests__/buyer-icp.test.tsx src/components/research-v2/section-renderers/__tests__/paid-media-plan.test.tsx src/components/research-v2/primitives/__tests__/verdict-hero.test.tsx src/components/research-v2/primitives/__tests__/reader-text.test.ts src/components/research-v2/primitives/__tests__/quote-card.test.tsx src/components/research-v3/__tests__/reader-sections.test.ts`
- `npm run test:run -- src/app/api/research-v2/chat/__tests__/side-effects.test.ts`
- `npm run test:run -- src/components/research-v2/__tests__/audit-chat-panel.test.tsx`
- `npx tsc --noEmit`
- `npm run test:run`
- `npm run build`
- `git diff --check`
- `npm run lint` failed on unrelated script/tmp lint debt, including `scripts/zz-claim-source-verifier.ts` `no-explicit-any` errors and generated Chrome profile files under `tmp/e2e-chrome-profile`.
- Read-only Supabase snapshot of `c9bc2056-627c-471d-b98b-98ed224085c2`: artifact `status=complete children=6/6`; BuyerICP `complete/insufficient`; VoC `complete/insufficient`; PaidMediaPlan `complete/needs_review`.
- `npx tsx scripts/zz-rerun-section-cli.ts c9bc2056-627c-471d-b98b-98ed224085c2 positioningBuyerICP positioningVoiceOfCustomer`
- `npx tsx scripts/zz-rerun-section-cli.ts c9bc2056-627c-471d-b98b-98ed224085c2 positioningBuyerICP`
- `npx tsx scripts/zz-rerun-section-cli.ts c9bc2056-627c-471d-b98b-98ed224085c2 positioningPaidMediaPlan`
