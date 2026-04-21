# Cognitive core

The irreducible reasoning capability of a model, independent of the long tail of specific knowledge. Karpathy expects specialization once the science of fine-tuning-without-forgetting matures.

## The speciation argument

"The animal kingdom is extremely diverse in the brains that exist. We should be able to see more speciation. Much smaller models that still have the cognitive core but specialize for efficiency on specific tasks."

Right now: monoculture. All frontier labs train general-purpose Opus/GPT/Gemini-class models. Because:

- Fine-tuning without losing capabilities is not solved.
- Continual learning is not solved.
- Context windows just work and are cheap.

"Touching weights is tricky. Context windows just work."

## What "cognitive core" probably includes

- Language understanding.
- Multi-step reasoning.
- Instruction following.
- Basic tool use.
- Theory of mind (shakily).

## What it doesn't

- Every API surface, every domain, every recent fact. Those belong in context (RAG, wiki, tool output) — not baked in.

## Why this matters for AIGOS

If you believe Karpathy, the right long-term bet is:

- **Specialization via context, not fine-tuning.** Build better context pipelines (the wiki, the context-string builder, the identity resolver) rather than training a bespoke model.
- **Smaller models for runners.** Once open-weight models with the cognitive core ship (Qwen, Llama lineage), some runners (keyword, competitor, even the humanize pass) might move off Anthropic without losing quality.
- **Monoculture is temporary.** Don't architect assuming Claude is the only provider forever.

## Contrast

Jaggedness ([[wiki/concepts/jaggedness.md]]) is about uneven CURRENT skill within the cognitive core. Cognitive-core-vs-tails is about which capabilities will specialize vs stay shared.

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/sources/karpathy-noam-no-priors-transcript.md]]
- [[wiki/concepts/jaggedness.md]]
- [[wiki/entities/karpathy.md]]
