# AGENTS.md - src/lib/lab-engine/agents/verification

## Purpose

- Owns claim extraction, source attribution checks, evidence support grading, verifier thresholds, and repair inputs for section artifacts.

## Ownership

- This folder owns verifier logic used by lab-engine agents before artifacts are treated as clean.

## Local Contracts

- Deterministic checks are the first line of defense and must not be softened to mask bad artifacts.
- Unsupported load-bearing claims must remain visible to callers and tests.
- Source attribution must preserve the claim, source URL, section/zone context, and support verdict.
- Environment knobs may change thresholds, but must not remove honest reporting.
- Provenance gate (`provenance-gate.ts`, runs with the creative truth gate at the annotate choke point): competitor `publicWeaknesses` quotes may claim verbatim status only with a per-review/per-thread permalink (index pages, subreddit roots, and vendor blogs are downgraded to explicit paraphrased patterns); SKILL.md exemplar motifs (fintech receipts/OCR, SOC 2) are stripped from deployable copy, mined questions, and narrative prose unless the artifact's structured evidence supports the domain (model narrative cannot self-vouch); email addresses are scrubbed from quote-card fields with field+count recorded, never the address.

## Work Guidance

- Add fixtures/tests for new claim kinds, source shapes, or verifier verdicts.
- When changing verifier output shape, update artifact envelopes, section tests, and reader displays that consume it.

## Verification

- Run `npm run test:run -- src/lib/lab-engine/agents/verification src/lib/lab-engine`.

## Child DOX Index

- No child `AGENTS.md` files yet.
