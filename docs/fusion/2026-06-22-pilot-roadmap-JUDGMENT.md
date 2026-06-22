# Fusion Judgment — Pilot Roadmap Pressure-Test (opus4.8-gpt5.5-glm5.2)

**Date:** 2026-06-22 · **Panel:** Opus 4.8 (subagent) + GPT-5.5 (codex exec xhigh) + GLM-5.2 (ollama cloud), parallel/blind · **Judge:** Opus 4.8.
**Final deliverable:** `docs/plans/2026-06-22-supervised-pilot-master-plan.md` (§2 folds these in). Raw: `2026-06-22-pilot-roadmap-{opus48.jsonl,gpt55.txt,glm52.txt}`.

## Consensus (all 3, independently)
1. **Sequencing is backwards** — prove the agentic writer on all 7 sections × 3 diverse non-Ramp subjects BEFORE the run-section strangle. n=1 (Ramp, easiest subject); the 8/8 may be a corpus-richness artifact. → strangle moves LAST.
2. **The parallel-diff strangler is over-engineered** for 2 operators — diffing against a known-bad 1/8 path is signal-free. Sidecar + manual paired-deck read instead.
3. **A pure deterministic strip-or-gap floor cannot hold 8/8** — the proven-8 *recomputed* a ratio (generation). Split: **writer/repair corrects** (by construction, source-cited) → **deterministic floor verifies-and-strips**. Do NOT make the floor an LLM (laundering).
4. **Right-size for 2 operators** — drop the SHA byte-freeze of actively-refactored verifiers; freeze the SCORER + fixtures instead. Trust *tiers* are product-grade → ship binary grounded/inferred.

## Contradiction resolved (vs the codebase panel)
- Codebase panel: byte-freeze the 12 verifiers FIRST. Fusion panel: theater for a 2-person team. **Resolution:** freeze the acceptance ORACLE (`zz-value-read.mjs` bands + fabrication fixtures asserting post-strip deltas) + keep the per-guard regression-SNAPSHOT suite (edit-a-guard→case-red = Chesterton's fence without the byte-freeze). This also dissolves the critic's fatal P0/P2 circular dependency (strip extraction happens WITH the floor in Phase B, not as a Phase-0 gate).

## Unique insights (distinct per model)
- **Opus 4.8 — the qualitative-trust gap (highest-value).** All gates guard checkable atoms; operator trust lives in the strategic assertion, which is ungated. `value-read` = quality, not truth. → grounded-vs-inferred signal per claim. Also: frozen **corpus is a silent SPOF** (garbage-in invisible to the floor); the plan optimizes the RAIL when GENERATION is the proven lever.
- **GPT-5.5 — operator/client INTAKE + deck-level COHERENCE.** Operators know budget/CAC/geo/compliance the web doesn't → a sourced deck can be unusable. The 7 sections must agree, not just each score 8. "Would use in client work" ≠ rubric 8/8. Richer states: approved/needs-review/source-thin/blocked.
- **GLM-5.2 — the "Empty-Payload Pipeline" (sharpest pilot-specific risk).** Real client URLs return paywalls/anti-bot/zero-data; GLM fills the schema with plausible data; a floor checking contradictions vs the *returned* payload has nothing to strip → fully-fabricated section. Plus LATENCY (10–15 min/deck → mid-run regenerate → state loss).

## Blind spots in the framing
- `value-read` measures quality not truth — no accuracy/groundedness axis (Opus, GPT-5.5).
- "Absent only on schema death" is naive if a stripped key metric leaves a broken fragment → needs-review state (GPT-5.5, GLM).
- Writer holds too much power (discover+interpret+structure+defend in one pass) — alternative: acquisition agents → normalized fact pack → writers → deterministic compiler (Opus, GPT-5.5). *Pilot decision: keep "writer + thin floor"; revisit only if Phase A generation is unreliable.*
- Model lock-in on n=1 with no quality fallback (DeepSeek = the broken path).

## Judge's pick
The three tracks are complementary, not competing — each named a distinct, real failure the others missed (qualitative-trust / operator-context+coherence / empty-payload). The master plan adopts **all three** plus the consensus re-sequencing. Strongest single reframe: **R2 (writer corrects / floor verifies)** — it resolves the deepest architectural contradiction and simultaneously closes the leaf-numeric + empty-payload holes.
