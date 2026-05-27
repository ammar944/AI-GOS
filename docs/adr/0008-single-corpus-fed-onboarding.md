---
status: accepted
date: 2026-05-27
---

# Single corpus-fed Onboarding: the rich wizard shell renders OnboardingV2Data and asks exactly the canonical GTM questions

v3 inherited **two** onboarding implementations. This records the decision to collapse them into one corpus-fed front door — the rich multi-step wizard's UI rendering the V2 data contract, asking exactly the canonical GTM question set — so the next executor does not rebuild either one or re-derive which data shape wins.

## Context — two wizards, two data shapes, one of them lossy

- The **rich wizard** (`src/components/onboarding/onboarding-wizard.tsx` + `step-*.tsx`) has the better UX — step nav, progress, motion, cards, `AutoFillPanel`, `DocumentUploadPanel` — but renders `OnboardingFormData`, a nested 9-section shape that covers only **22/43** of the canonical GTM questions.
- **`OnboardingWizardV2`** (`src/components/research-v2/onboarding-wizard-v2.tsx`) renders `OnboardingV2Data`, a flat 7-section shape that matches the canonical question doc **43/43** and is what the live v3 backend already consumes (`POST /api/research-v2/onboarding` → `orchestrate` freezes it as `gtmBriefReview`). Its UI is plainer.
- The canonical question set is `AIGOS Onboarding Flow (2).md` (7 GTM sections). The data the backend, corpus prefill, and Subagents speak is `OnboardingV2Data`.

Keeping both is duplication; picking the rich wizard's *own* data shape would drop half the canonical questions and break the backend contract.

## Decision — rich wizard LOOK + V2 DATA + canonical GTM questions

One Onboarding. The rich wizard **shell** is re-fielded to render `OnboardingV2Data` (not its own `OnboardingFormData`). It asks exactly the canonical doc's **7 GTM question sections**, plus one separate **Media Plan Setup** step. The V2 data contract is preserved end to end so the backend needs no change:

- in: `initialData: Partial<OnboardingV2Data>` + `initialPrefillMetadata: OnboardingPrefillMetadata`
- builds: `OnboardingReviewMetadata` (AI-filled / User-edited / Missing / Needs-review badges)
- out: `onComplete(OnboardingV2Data, OnboardingReviewMetadata)` → onboarding POST → `orchestrate {executionMode:'lab'}`

Locked sub-decisions:
- **Two de-dupes:** Target CAC asked once (keep `targetCac`, drop `goalTargetCac`); Avg LTV asked once (keep `avgLtv`, drop `ltv`). Update all consumers of the dropped keys.
- **`gtmMotion` is derived** from the §1 sales-motion answer — never asked separately.
- **Media Plan Setup is its own step** (`salesProcessDocs`, `salesLoomUrl`, `creativeCapacity`, `leadListAvailable`) feeding the 7th paid-media Section (ADR-0005), kept out of the 7 GTM sections.
- **Uploads collected at entry** feed both the Corpus and the lab Sections.
- `/research-v3` stays the entry route; final route renaming deferred.

## Considered alternatives

- **Keep `OnboardingWizardV2` as-is, delete the rich wizard.** Rejected: throws away the better UX the product wants for its front door; the V2 wizard was a scaffold, not the intended finish.
- **Re-field the rich wizard to its own `OnboardingFormData` and extend that shape to 43.** Rejected: re-widens a second data contract the backend doesn't speak, forces a parallel prefill/freeze path, and re-introduces the divergence this ADR closes. `OnboardingV2Data` is already the 43/43 canonical match and the live backend contract.
- **Two onboarding surfaces (one per route).** Rejected: `/research-v2` and `/research-v3` both mounting a wizard is exactly the duplication being removed (see consequences).

## Consequences

- **Live data bug surfaces and must be fixed in the same arc:** `src/lib/research-v2/corpus-to-research-input.ts` reads stale keys (`industryVertical`, `primaryIcpDescription`, `coreDeliverables`, `primaryGoal`) that no longer exist on `OnboardingV2Data`. They silently default today, so the user's reviewed Brief never reaches the 6 Sections. Switching to V2 keys (`industry`, `idealCustomer`, `coreFeatures`, `primaryGoal90Days`) + the de-duped CAC/LTV keys recovers it.
- **Both mount points handled before deletion:** `/research-v2/page.tsx` also mounts `OnboardingWizardV2`. Migrate /research-v2 to the unified wizard (or delete /research-v2) BEFORE removing `onboarding-wizard-v2.tsx` + its test — else a live surface breaks.
- `/onboarding/edit` is retired; no separate account onboarding; no post-research re-edit flow for now.
- The `OnboardingReviewMetadata` shape is contract-critical: `orchestrate` 422s / freezes null if `reviewMetadata` is malformed. Preserve it exactly.

## References
- Plan: `docs/2026-05-27-v3-onboarding-integration-plan.md`
- Canonical questions: `AIGOS Onboarding Flow (2).md`
- Backend contract: `POST /api/research-v2/onboarding`, `src/lib/research-v2/orchestration-session.ts:getOnboardingReviewMetadata`
- Related: ADR-0005 (paid media plan Section — fed by Media Plan Setup), ADR-0009 (ad-scripts removal — same integration arc)
