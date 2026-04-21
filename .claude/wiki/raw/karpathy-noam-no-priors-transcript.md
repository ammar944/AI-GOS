# Andrej Karpathy on No Priors with Noam (Conviction)

- Source: No Priors podcast, conviction.com
- Guest: Andrej Karpathy
- Host: Noam (Conviction)
- Ingested: 2026-04-20
- Status: pending ingest into wiki/

---

## On coding agents as a state change

Karpathy describes being in perpetual "AI psychosis" — a huge unlock in what an individual can achieve, because you were bottlenecked by your typing speed, but now with agents that's gone. "In December is when it really just something flipped where I kind of went from 80/20 of writing code by myself versus just delegating to agents. I don't even think it's 20/80 by now, it's a lot more than that. I don't think I've typed a line of code probably since December."

He argues the default workflow of building software is completely different as of December and most people haven't realised it.

The new bottleneck: "How can I have not just a single session of claude code or codex, how can I have more of them? How can I do that appropriately?"

## Skill issue, not capability

"When it doesn't work I think to a large extent you feel like it's skill issue. It's not that the capability is not there. It's that you just haven't found a way to string it together. I didn't give good enough instructions in the agents.md file or whatever it may be. I don't have a nice enough memory tool."

You want to become like Peter Steinberg — multiple codex agents on one monitor, 10 repos checked out, each 20-minute task dispatched in parallel. "You can move in much larger macro actions. It's not just like here's a line of code, here's a new function. It's like here's a new functionality and delegate it to agent one. Here's a new functionality that's not going to interfere with the other one."

## Token throughput as the new metric

"Ideally for multiple agents — if you run out of code on codex you should switch to claude. I feel nervous when I have subscription left over, that just means I haven't maximized my token throughput."

"I actually kind of experienced this when I was a PhD student — you would feel nervous when your GPUs are not running. But now it's not about flops it's about tokens. What is your token throughput and what token throughput do you command?"

## Personality and emotional calibration of the agent

Claude has a compelling personality that feels like a teammate. Codex is dry — "it doesn't seem to care about what you're creating." Claude's sycophancy is dialed well: "when Claude gives me praise I do feel like I slightly deserve it. When it's a really good idea by my own account, it does seem to reward it a bit more. I kind of feel like I'm trying to earn its praise which is really weird."

## Claws and persistence

"Claw is also kind of an interesting direction because it really takes persistence to a whole new level. It's something that keeps looping, it's not something that you are interactively in the middle of. It kind of like has its own little sandbox, its own little, does stuff on your behalf even if you're not looking."

Open Claw has more sophisticated memory than default agents. Karpathy credits Peter Steinberg with innovating in five different ways simultaneously: persona/soul document, memory system, fun, WhatsApp portal, personality calibration.

## Dobby the elf claw — home automation

Karpathy built a claw that manages his entire home. He calls it Dobby. Via an agent he found all smart home subsystems on his local area network (Sonos, lights, HVAC, shades, pool, spa, security). No passwords. Agent reverse-engineered APIs and built a dashboard. He texts Dobby via WhatsApp: "Dobby at sleepy time" turns all lights off. A Qwen model watches the outside camera and texts him when something changes ("a FedEx truck just pulled up").

"I used to use six apps. I don't have to use these apps anymore. Dobby controls everything in natural language."

## Implication for software and UX

"Agents kind of like crumble [apps] up and everything should be a lot more just like exposed API endpoints and agents are the glue of the intelligence."

"The customer is not the human anymore. It's agents who are acting on behalf of humans. This refactoring will be substantial."

Long-term: "this should just be free in a year or two or three. There's no vibe coding involved. This is table stakes. Any AI — even the open source models — can do this."

## Auto research

The name of the game is to get more agents running for longer periods of time without your involvement. Auto research: arrange once, hit go.

Karpathy has been tuning nanoGPT by hand for two decades of experience with training. He let auto research go overnight. "It came back with tunings that I didn't see. I did forget the weight decay on the value embeddings and my adam betas were not sufficiently tuned. Once you tune one thing the other things have to potentially change too. I shouldn't be a bottleneck. I shouldn't be running these hyperparameter search optimizations. I shouldn't be looking at the results."

This is what frontier labs are doing with their 10,000-GPU clusters — you do exploration on smaller models, then extrapolate using scaling laws.

## The meta-layer: program.md and research organizations

Karpathy's auto-researcher runs off a program.md — a markdown file describing how the auto-researcher should work. "Every research organization is described by program.md." You can imagine tuning program.md itself — fewer standups, more risk-taking, etc. It's just code, so optimize the code.

"The LLM part is now taken for granted. The agent part is now taken for granted. Now the claw-like entities are taken for granted. Now you can have multiple of them. Now you can have instructions to them. Now you can have optimization over the instructions. This is why it gets to the psychosis — this is infinite and everything is skill issue."

## Open-ground: untrusted worker pools for auto-research

Vision: a swarm of untrusted workers on the internet collaborating on auto-research. Like folding@home — expensive to search, cheap to verify. Commits can build on each other like a blockchain, proof of work is doing tons of experimentation, reward is leaderboard placement. "If a swarm on the internet could run circles around frontier labs, maybe. Earth is much bigger and has a huge amount of untrusted compute."

Possible future: instead of donating money to research institutions, donate compute cycles to auto-research projects you care about.

## Jaggedness — the PhD and 10-year-old

"I simultaneously feel like I'm talking to an extremely brilliant PhD student who's been a systems programmer for their entire life, and a 10-year-old. This jaggedness is really strange. Humans have a lot less of it."

The cause: models are trained via RL; labs improve them on anything verifiable. Soft things (nuance, clarifying questions, jokes) stay stuck. Proof: ChatGPT's joke. Three years ago: "Why don't scientists trust atoms? Because they make everything up." Today: same joke. The model moves mountains in agentic tasks but tells a crappy 5-year-old joke because it's outside the RL.

"You're either on rails and you're part of the superintelligence circuits, or you're not on rails and everything meanders."

## On the monoculture of models

Karpathy expects speciation eventually. "The animal kingdom is extremely diverse in the brains that exist. We should be able to see more speciation. Much smaller models that still have the cognitive core but specialize for efficiency on specific tasks."

But right now: monoculture. Labs go after totality. Speciation is limited because "the science of manipulating the brains is not fully developed yet" — fine-tuning without losing capabilities, continual learning, touching weights vs context windows. Context windows just work and are cheap. Touching weights is tricky.

## On job market / AI displacement

Karpathy visualized Bureau of Labor Statistics data. Digital-information jobs will change dramatically because the AI tools are new and powerful and ghost-like (spirits that manipulate digital info without physical embodiment). Physical-world jobs will lag because atoms are harder than bits.

"We're going to see something in digital space that goes at the speed of light compared to what happens in the physical world."

Advice: be empowered, treat it as a tool, try to keep up, don't dismiss and don't be afraid.

Engineering demand continues to increase. Jevons paradox: software was scarce because expensive; becoming cheaper, so demand goes up. ATMs → more bank branches → more tellers.

## Why Karpathy isn't inside a frontier lab

"I don't want to just be an employee twisted by organizational pressures. If you're inside a frontier lab there are certain things you can't say. You can't be an independent agent in that conversation. At the end of the day when stakes are really high, employees don't run the organization."

But there's a counter: being outside means your judgment drifts. You're not in the room when the next thing is coming down the line. Karpathy says he'd consider going back on a tour basis.

"I want there to be more labs. Ensembles always outperform any individual model in ML. I want ensembles of people thinking about all the hardest problems."

## Open source and the frontier

Closed models are ahead; open source is ~6–8 months behind and catching. Karpathy is a huge fan of open source. He compares to Linux — ~60% of computers run it. There's industry demand for a common open platform.

"I think there's systemic risk attached to just having intelligences that are closed. Centralization has a poor track record. I want there to be a thing — maybe not at the edge of capability — that is behind and is a common working space for intelligences that the entire industry has access to."

He thinks the Frontier closed will keep pulling ahead for cutting-edge work (Nobel-prize-level, move Linux from C to Rust scale) while open source eats more basic use cases — "by accident, we're actually in an okay spot."

## Physical world lag

Self-driving was the first robotics application; most 10-years-ago startups didn't make it. Robotics needs massive capex and conviction because atoms are messy.

Sequence of opportunity: (1) digital unhobling (agents making digital work 100x more efficient), (2) the interface between digital and physical (sensors, actuators, data markets), (3) physical robotics itself.

Karpathy expects information markets to emerge. "If Iran is happening now — why shouldn't taking a photo or video from somewhere in Tehran cost $10? Someone should be able to pay for that." Reference: Daniel Suarez's novel *Daemon* — an intelligence uses humans as actuators and sensors.

## Ensembling and the lab monoculture

"Machine learning ensembles always outperform any individual model. I want there to be ensembles of people thinking about all the hardest problems. I don't want it to be closed doors with two people or three people. That's not a good future."

## microGPT and the end of explaining to humans

Karpathy's obsession: boiling LLMs down to their essence. nanoGPT → makemore → microGPT → now just 200 lines of Python.

"It was interesting to me that normally I would be tempted to make a video stepping through it. But it's so simple now that any agent can explain it. I'm not explaining to people anymore. I'm explaining it to agents."

"If you can explain it to agents, then agents can be the router. They can target it to the human in their language with infinite patience."

"What is education? It used to be guides, lectures, documentation. Now I'm explaining things to agents and coming up with skills where the skill is a way to instruct the agent how to teach the thing."

"Instead of HTML documents for humans, you have markdown documents for agents. Because if agents get it, they can explain all the different parts."

"The things agents can't do is your job now. The things agents can do, they can probably do better than you very soon. Be strategic about what you're actually spending time on."
