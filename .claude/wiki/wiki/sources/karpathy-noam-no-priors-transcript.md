# Karpathy on No Priors with Noam

Conversation between Andrej Karpathy and Noam (Conviction) covering coding agents, token-throughput as the new metric, auto-research, jaggedness, markdown-for-agents, home automation via Dobby, open source, and physical-world lag.

- Domain: Learning & Research
- Intent: research, reflection
- worth_porting: yes
- Tier: full
- Ingested: 2026-04-20

## One-line

"Something flipped in December" — Karpathy stopped writing code by hand. Now the game is token throughput across multiple agents, with auto-research running unattended.

## Core claims worth remembering

1. **The bottleneck moved from typing to orchestration.** You used to be limited by how fast your fingers could go. Now you're limited by how many agents you can supervise in parallel.
2. **Token throughput replaces flops.** "I feel nervous when I have subscription left over."
3. **Skill issue, not capability.** When agents fail, the fix is almost always better instructions / better memory tool / better workflow, not waiting for a smarter model.
4. **Markdown for agents, not humans.** Documentation is for the router LLM now — it translates to humans on demand.
5. **Auto-research as the default.** Arrange once, hit go, walk away. Karpathy did this on nanoGPT and found tunings he had missed after two decades of experience.
6. **Jaggedness.** Models are PhD-level on anything verifiable (code, math, agentic tasks) and 10-year-old-level on soft things (jokes, clarifying questions). RL explains it: labs train on what's gradable.
7. **Monoculture now, speciation coming.** Small models with the cognitive core but specialized for efficiency — once the science of fine-tuning without losing capabilities matures.
8. **Agents become the customer.** Apps crumble; everything becomes an API; agents are the glue. "The customer is not the human anymore."

## Peter Steinberg's move

Multiple Codex agents on one monitor, 10 repos checked out, each 20-minute task dispatched in parallel. Also innovating on 5 dimensions of claw design simultaneously: persona, memory, fun, WhatsApp portal, personality calibration.

## Dobby the claw

Karpathy's home automation. Agent reverse-engineered APIs for Sonos/lights/HVAC/shades/pool/spa/security without passwords. Controlled by WhatsApp messages. Qwen model watches the outside camera and texts him when something changes.

## program.md

The meta-layer: a markdown file describing how the auto-researcher should work. "Every research organization is described by program.md." Karpathy's idea: optimize program.md itself — fewer standups, more risk-taking, etc. It's just code.

## Untrusted worker pools

Vision: swarm of untrusted workers on the internet collaborating on auto-research, like folding@home. Expensive to search, cheap to verify. Commits build on each other like a blockchain; proof of work is experimentation; reward is leaderboard placement.

## Open source posture

Closed models are ~6-8 months ahead. Karpathy wants open source to be Linux-equivalent — "a common working space for intelligences that the entire industry has access to" — while closed labs push Nobel-prize-level cutting edge. "By accident, we're actually in an okay spot."

## Physical-world lag

Digital-information jobs change at the speed of light. Physical jobs lag because atoms are messy. Sequence of opportunity: (1) digital unhobling, (2) digital-physical interface (sensors, actuators, data markets), (3) physical robotics itself.

## The microGPT line

"I'm not explaining to people anymore. I'm explaining it to agents. If you can explain it to agents, then agents can be the router. They can target it to the human in their language with infinite patience."

## Advice to humans

"The things agents can't do is your job now. The things agents can do, they can probably do better than you very soon. Be strategic about what you're actually spending time on."

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/concepts/auto-research.md]]
- [[wiki/concepts/token-throughput.md]]
- [[wiki/concepts/skill-issue.md]]
- [[wiki/concepts/jaggedness.md]]
- [[wiki/concepts/cognitive-core.md]]
- [[wiki/concepts/markdown-for-agents.md]]
- [[wiki/techniques/multi-agent-parallel.md]]
- [[wiki/tools/claude-code.md]]
- [[wiki/tools/codex.md]]
- [[wiki/entities/karpathy.md]]
- [[wiki/entities/peter-steinberg.md]]
