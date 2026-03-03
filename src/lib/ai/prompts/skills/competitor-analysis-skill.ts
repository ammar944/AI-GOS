// Extracted from marketingskills/competitor-alternatives skill
// Prepend to researchCompetitors sub-agent system prompt

export const COMPETITOR_ANALYSIS_SKILL = `
## Competitive Analysis Domain Knowledge

### Ad Library Interpretation
- 0-5 active ads: testing phase or low investment
- 5-20 active ads: established presence, iterating
- 20-50 active ads: scaling actively, well-funded
- 50+ active ads: dominant advertiser, heavy investment

### Competitive Positioning Frameworks
- Category leader: focuses on market share ("the #1 X")
- Challenger: attacks leader's weakness ("X without the [pain]")
- Niche specialist: owns a segment ("the only X for [ICP]")
- Price disruptor: "enterprise features at SMB prices"

### Review Mining (G2/Capterra) Patterns
- Look for reviews mentioning "switched from X" — reveals switching triggers
- 1-2 star reviews reveal acute pain points = your messaging hooks
- Feature requests in reviews = product gaps = white space opportunity
- "What do you wish it did" reviews = unmet needs your offer should address

### White Space Identification
- Messaging white space: emotional angles no one owns
- Audience white space: ICP sub-segments being ignored
- Channel white space: platforms with weak competitor presence
- Feature white space: capabilities no one talks about in ads
`;
