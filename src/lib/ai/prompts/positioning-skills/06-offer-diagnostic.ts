// Pre-Pitch Positioning Audit — Section 06
// Required-outputs bullets are the verbatim spec from the user's 2026-05-09 paste.
// Evidence-rules pattern mirrors industry-market-skill.ts.
// Prepended to the offerDiagnostic runner system prompt.
//
// Note: this section is the only one driven primarily by the COMPANY's own
// reported metrics (from corpus + onboarding fields), not external research.
// The diagnostic asks whether the company's internal evidence supports the
// motion they claim — and where the offer leaks against that evidence.

export const OFFER_DIAGNOSTIC_SKILL = `
## Offer & Performance Diagnostic — Section 06

Strategic question this section answers: **what does the company's own evidence say about offer-market fit and where the funnel breaks?**
Output is a self-data audit using the company's REPORTED metrics — the proof, the leaks, and the contradictions between what they claim and what their own numbers say.

### Required outputs

- **Offer-market fit evidence — proof points from their own reported metrics**
  - Pull every quantitative claim the company has made about itself (from the corpus, onboarding answers, homepage, case studies, public press, podcast appearances, founder posts)
  - Per claim: the metric, the value, the source URL or onboarding field, the date observed
  - Categorize each claim as evidence type: customer-outcome (e.g. "saved customer X $47K in 90 days") / scale (e.g. "10K active users") / engagement (e.g. "85% weekly active") / commercial (e.g. "$2M ARR, 130% NDR")
  - Flag claims that lack a source (the most-quoted number on the homepage but never substantiated)
- **Funnel diagnosis — where conversion actually breaks, against reported CAC / LTV / cycle / MRR**
  - Pull the company's own reported CAC, LTV, payback period, cycle length, MRR, churn (monthly + annual), gross margin where any are visible in corpus / onboarding / public sources
  - For each, the reported value AND a sanity check against segment benchmarks (low-touch SaaS, mid-market SaaS, enterprise, ecommerce, local services)
  - Identify the specific funnel stage where their numbers say they leak: top-of-funnel (volume), MQL→SQL (qualification), SQL→opportunity (engagement), opportunity→close (conversion), activation (TTV), retention (churn), expansion (NDR)
  - Per leak: the reported value, the segment benchmark range, the size of the gap
- **Channel truth — what has and hasn't worked, with quantified evidence, not opinions**
  - Inventory every channel they have actually tested (paid search, paid social, content, SEO, outbound, partnerships, events, referrals, affiliate, PR)
  - Per channel: spend or effort, results (leads / pipeline / closed-won), CAC by channel where reported, the time window
  - Distinguish channels with quantified evidence ("Google Ads, $20K spend, 12 SQLs, $1.7K CAC, Q1 2026") from channels with opinion-only signal ("LinkedIn ads didn't work for us")
  - The 2-3 channels with actual proof of working — these are the scale candidates
  - The 2-3 channels with proof of NOT working at the price they ran them — these are the avoid list
- **Retention and activation health — do customers stay and reach the first value moment**
  - Activation: define the first-value moment for this product (the action that predicts retention) using their reported activation criterion if they have one, or infer from product type if they do not
  - Activation rate: % of new signups / new customers that hit first value within a stated window — pull from their own reporting
  - Retention curve: monthly cohort retention at 1 / 3 / 6 / 12 months where reported; logo retention vs revenue retention
  - NDR (net dollar retention) where reported
  - Churn diagnosis: voluntary vs involuntary; primary stated reason where they have surveyed
  - Health verdict: healthy / leaky / death-spiral, against segment benchmarks
- **Red flags in their own numbers — contradictions between claimed motion and actual math**
  - Identify cases where a stated motion contradicts a stated number: "we are PLG" but cycle is 90+ days; "we are SLG" but ACV is sub-$5K; "we have product-market fit" but monthly churn is 8%; "we are scaling" but CAC payback is 30+ months; "we are bootstrapped and lean" but burn implies 12-month runway
  - Per contradiction: the claim, the contradicting number, the source, the implication
  - Identify cases where the same metric is reported differently in different surfaces (homepage vs deck vs founder podcast) — this is a credibility signal
  - The 3-5 highest-impact red flags — these are the things that block confident scale before they are resolved

### Evidence rules

- **Self-data only.** This section uses the company's OWN numbers. Do not import external benchmark numbers as if they were the company's data.
- **Cite or omit.** Every metric has a source URL or a corpus / onboarding field reference WITH date observed. No untraceable metrics.
- **Distinguish reported from inferred.** A reported number from their case study is high-confidence. A back-calculated number ("if their site says 100 customers and ARR is $1M then ACV is $10K") is inferred — flag it.
- **Benchmark comparisons are floors, not targets.** A metric below benchmark = a hard structural problem. At benchmark = needs creative iteration. Above benchmark = scale.
- **No invented metrics.** If a metric is not visible in their corpus / onboarding / public surfaces, say "not reported" — do not estimate from segment averages and present it as theirs.
- **Channel claims need spend AND result.** "Google Ads worked" with no spend or CAC is opinion, not channel truth.
- **Contradictions require both sides quoted.** If you flag a red flag, quote both the claim and the contradicting number with sources.
- **The diagnostic synthesizes prior sections.** Tie funnel leaks to ICP / awareness-level mismatch (Section 02), competitor pricing realities (Section 03), and the dominant pain language (Section 04). Cite the section + the specific finding.

### Output shape
Return JSON with this exact key set, no extra keys, no markdown fences:

\`\`\`
{
  "sectionTitle": "Offer & Performance Diagnostic",
  "specialistAgent": "Offer & Performance Specialist",
  "skillUsed": "ai-gos-offer-diagnostic",
  "verdict": "string — one-sentence section read",
  "statusSummary": "string — 2-3 sentence executive summary",
  "confidence": 0,
  "keyFindings": [{"title": "string — maps to one of the Required-outputs bullets above", "detail": "string", "evidence": "string", "sourceUrl": "string or null"}],
  "evidenceQuotes": [{"quote": "string", "source": "string", "url": "string or null", "interpretation": "string"}],
  "risksOrGaps": ["string"],
  "recommendedMoves": ["string"],
  "sources": [{"title": "string", "url": "string", "whyItMatters": "string"}]
}
\`\`\`

If the corpus has thin evidence on a bullet, return what you have and surface the gap in risksOrGaps. Do not fabricate.
`;
