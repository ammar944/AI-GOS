// Converts a MediaPlanOutput into clean, structured markdown
// optimized for LLM consumption (pasting into Claude, ChatGPT, etc.)

import { FUNNEL_STAGE_LABELS } from './schemas';
import type {
  MediaPlanOutput,
  MediaPlanExecutiveSummary,
  MediaPlanStrategicSynthesis,
  PlatformStrategy,
  ICPTargeting,
  CampaignStructure,
  CreativeStrategy,
  BudgetAllocation,
  CampaignPhase,
  KPITarget,
  PerformanceModel,
  RiskMonitoring,
} from "./types";

function fmt$(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n}%`;
}

// ---------------------------------------------------------------------------
// Section serializers
// ---------------------------------------------------------------------------

function strategicSynthesisMd(d: MediaPlanStrategicSynthesis): string {
  const lines: string[] = [
    `# Page 1 — Strategic Synthesis`,
    ``,
    `**Verdict** *(confidence: ${d.confidence})* — ${d.verdict}`,
    ``,
    `## Positioning Thesis`,
    d.positioningThesis,
    ``,
    `## Strategic Narrative`,
    d.strategicNarrative,
    ``,
    `## Top Actions`,
  ];
  for (const action of d.topActions) {
    lines.push(`- **${action.priority.toUpperCase()}** — ${action.action}`);
    lines.push(`  - Why: ${action.rationale}`);
  }
  if (d.contradictions.length > 0) {
    lines.push(``, `## Cross-Section Contradictions`);
    for (const c of d.contradictions) {
      lines.push(`- **${c.contradiction}**`);
      lines.push(`  - Impact: ${c.impact}`);
      lines.push(`  - Resolve: ${c.resolution}`);
    }
  }
  lines.push(``, `## Cross-Card Readiness`);
  if (d.crossCardReadiness.locked.length > 0) {
    lines.push(`**Locked:**`);
    for (const l of d.crossCardReadiness.locked) lines.push(`- ${l}`);
  }
  if (d.crossCardReadiness.gaps.length > 0) {
    lines.push(`**Gaps:**`);
    for (const g of d.crossCardReadiness.gaps) lines.push(`- ${g}`);
  }
  return lines.join('\n');
}

function executiveSummaryMd(d: MediaPlanExecutiveSummary): string {
  return [
    `## 1. Executive Summary`,
    ``,
    `**Recommended Monthly Budget:** ${fmt$(d.recommendedMonthlyBudget)}`,
    `**Timeline to Results:** ${d.timelineToResults}`,
    `**Primary Objective:** ${d.primaryObjective}`,
    ``,
    d.overview,
    ``,
    `### Top Priorities`,
    ...d.topPriorities.map((p, i) => `${i + 1}. ${p}`),
  ].join("\n");
}

function platformStrategyMd(data: PlatformStrategy[]): string {
  const lines = [`## 2. Platform Strategy`, ``];

  for (const ps of data) {
    lines.push(`### ${ps.platform} (${ps.priority})`);
    lines.push(``);
    lines.push(`- **Monthly Spend:** ${fmt$(ps.monthlySpend)} (${fmtPct(ps.budgetPercentage)})`);
    lines.push(`- **Expected CPL:** ${fmt$(ps.expectedCplRange.min)} – ${fmt$(ps.expectedCplRange.max)}`);
    lines.push(`- **Campaign Types:** ${ps.campaignTypes.join(", ")}`);
    lines.push(`- **Targeting Approach:** ${ps.targetingApproach}`);
    if (ps.adFormats.length > 0) lines.push(`- **Ad Formats:** ${ps.adFormats.join(", ")}`);
    if (ps.placements.length > 0) lines.push(`- **Placements:** ${ps.placements.join(", ")}`);
    if (ps.synergiesWithOtherPlatforms) lines.push(`- **Synergies:** ${ps.synergiesWithOtherPlatforms}`);
    lines.push(``);
    lines.push(`**Rationale:** ${ps.rationale}`);
    lines.push(``);
  }

  return lines.join("\n");
}

function icpTargetingMd(d: ICPTargeting): string {
  const lines = [`## 3. ICP Targeting`, ``];

  // Audience Segments
  lines.push(`### Audience Segments`);
  for (const seg of d.segments) {
    lines.push(``);
    lines.push(`**${seg.name}** (${FUNNEL_STAGE_LABELS[seg.funnelPosition] ?? seg.funnelPosition})`);
    lines.push(`${seg.description}`);
    lines.push(`- Targeting: ${seg.targetingParameters.join(", ")}`);
    lines.push(`- Est. Reach: ${seg.estimatedReach}`);
  }
  lines.push(``);

  // Platform Targeting
  lines.push(`### Platform Targeting`);
  for (const pt of d.platformTargeting) {
    lines.push(``);
    lines.push(`**${pt.platform}**`);
    if (pt.interests.length > 0) lines.push(`- Interests: ${pt.interests.join(", ")}`);
    if (pt.jobTitles.length > 0) lines.push(`- Job Titles: ${pt.jobTitles.join(", ")}`);
    if (pt.customAudiences.length > 0) lines.push(`- Custom Audiences: ${pt.customAudiences.join(", ")}`);
    if (pt.lookalikeAudiences.length > 0) lines.push(`- Lookalike Audiences: ${pt.lookalikeAudiences.join(", ")}`);
    if (pt.exclusions.length > 0) lines.push(`- Exclusions: ${pt.exclusions.join(", ")}`);
  }
  lines.push(``);

  // Profile
  lines.push(`### Profile`);
  if (d.demographics) lines.push(`- **Demographics:** ${d.demographics}`);
  if (d.psychographics) lines.push(`- **Psychographics:** ${d.psychographics}`);
  if (d.geographicTargeting) lines.push(`- **Geographic Targeting:** ${d.geographicTargeting}`);
  if (d.reachabilityAssessment) {
    lines.push(``);
    lines.push(`**Reachability Assessment:** ${d.reachabilityAssessment}`);
  }

  return lines.join("\n");
}

function campaignStructureMd(d: CampaignStructure): string {
  const lines = [`## 4. Campaign Structure`, ``];

  // Campaigns
  lines.push(`### Campaigns`);
  for (const c of d.campaigns) {
    lines.push(``);
    lines.push(`**${c.name}** — ${c.platform} | ${FUNNEL_STAGE_LABELS[c.funnelStage] ?? c.funnelStage} | ${c.objective}`);
    lines.push(`- Daily Budget: ${fmt$(c.dailyBudget)}`);
    if (c.adSets.length > 0) {
      lines.push(`- Ad Sets:`);
      for (const as of c.adSets) {
        lines.push(`  - **${as.name}**: ${as.targeting} | ${as.adsToTest} ads | ${as.bidStrategy}`);
      }
    }
  }
  lines.push(``);

  // Naming Conventions
  lines.push(`### Naming Conventions`);
  lines.push(`- Campaign: \`${d.namingConvention.campaignPattern}\``);
  lines.push(`- Ad Set: \`${d.namingConvention.adSetPattern}\``);
  lines.push(`- Ad: \`${d.namingConvention.adPattern}\``);
  lines.push(`- UTM: source=\`${d.namingConvention.utmStructure.source}\` medium=\`${d.namingConvention.utmStructure.medium}\` campaign=\`${d.namingConvention.utmStructure.campaign}\` content=\`${d.namingConvention.utmStructure.content}\``);
  lines.push(``);

  // Retargeting
  if (d.retargetingSegments.length > 0) {
    lines.push(`### Retargeting Segments`);
    for (const rs of d.retargetingSegments) {
      lines.push(`- **${rs.name}** (${rs.lookbackDays}d lookback): ${rs.source} — ${rs.messagingApproach}`);
    }
    lines.push(``);
  }

  // Negative Keywords
  if (d.negativeKeywords.length > 0) {
    lines.push(`### Negative Keywords`);
    lines.push(``);
    lines.push(`| Keyword | Match Type | Reason |`);
    lines.push(`|---------|-----------|--------|`);
    for (const nk of d.negativeKeywords) {
      lines.push(`| ${nk.keyword} | ${nk.matchType} | ${nk.reason} |`);
    }
  }

  return lines.join("\n");
}

function creativeStrategyMd(d: CreativeStrategy): string {
  const lines = [`## 5. Creative Strategy`, ``];

  // Angles
  lines.push(`### Creative Angles`);
  for (const a of d.angles) {
    lines.push(``);
    lines.push(`**${a.name}** (${a.bestForFunnelStages.map((s) => FUNNEL_STAGE_LABELS[s] ?? s).join(", ")} | ${a.platforms.join(", ")})`);
    lines.push(`${a.description}`);
    lines.push(`> "${a.exampleHook}"`);
  }
  lines.push(``);

  // Format Specs
  lines.push(`### Format Specifications`);
  lines.push(``);
  lines.push(`| Format | Dimensions | Platform | Copy Guideline |`);
  lines.push(`|--------|-----------|----------|---------------|`);
  for (const fs of d.formatSpecs) {
    lines.push(`| ${fs.format} | ${fs.dimensions} | ${fs.platform} | ${fs.copyGuideline} |`);
  }
  lines.push(``);

  // Testing Plan
  lines.push(`### Testing Plan`);
  for (const tp of d.testingPlan) {
    lines.push(`- **${tp.phase}**: ${tp.variantsToTest} variants over ${tp.durationDays}d (${fmt$(tp.testingBudget)}) — ${tp.methodology}. Success: ${tp.successCriteria}`);
  }
  lines.push(``);

  // Refresh Cadence
  lines.push(`### Refresh Cadence`);
  for (const rc of d.refreshCadence) {
    lines.push(`- **${rc.platform}**: Every ${rc.refreshIntervalDays} days. Fatigue signals: ${rc.fatigueSignals.join("; ")}`);
  }
  lines.push(``);

  // Brand Guidelines
  if (d.brandGuidelines.length > 0) {
    lines.push(`### Brand Guidelines`);
    for (const bg of d.brandGuidelines) {
      lines.push(`- **${bg.category}**: ${bg.guideline}`);
    }
  }

  return lines.join("\n");
}

function budgetAllocationMd(d: BudgetAllocation): string {
  const lines = [`## 6. Budget Allocation`, ``];

  lines.push(`**Total Monthly Budget:** ${fmt$(d.totalMonthlyBudget)}`);
  lines.push(`**Daily Ceiling:** ${fmt$(d.dailyCeiling)}`);
  lines.push(``);

  // Platform Breakdown
  lines.push(`### Platform Breakdown`);
  lines.push(``);
  lines.push(`| Platform | Monthly Budget | % |`);
  lines.push(`|----------|---------------|---|`);
  for (const pb of d.platformBreakdown) {
    lines.push(`| ${pb.platform} | ${fmt$(pb.monthlyBudget)} | ${fmtPct(pb.percentage)} |`);
  }
  lines.push(``);

  // Funnel Split
  lines.push(`### Funnel Split`);
  for (const fs of d.funnelSplit) {
    const stageLabel = FUNNEL_STAGE_LABELS[fs.stage] ?? fs.stage;
    lines.push(`- **${stageLabel}** (${fmtPct(fs.percentage)}): ${fs.rationale}`);
  }
  lines.push(``);

  // Monthly Roadmap
  lines.push(`### Monthly Roadmap`);
  for (const mr of d.monthlyRoadmap) {
    lines.push(`- **Month ${mr.month}** — ${fmt$(mr.budget)}: ${mr.focus}${mr.scalingTriggers.length > 0 ? `. Scaling triggers: ${mr.scalingTriggers.join("; ")}` : ""}`);
  }
  lines.push(``);

  // Ramp-Up
  if (d.rampUpStrategy) {
    lines.push(`### Ramp-Up Strategy`);
    lines.push(d.rampUpStrategy);
  }

  return lines.join("\n");
}

function campaignPhasesMd(data: CampaignPhase[]): string {
  const lines = [`## 7. Campaign Phases`, ``];

  for (const p of data) {
    lines.push(`### Phase ${p.phase}: ${p.name} (${p.durationWeeks} weeks, ${fmt$(p.estimatedBudget)})`);
    lines.push(``);
    lines.push(`**Objective:** ${p.objective}`);
    lines.push(``);
    lines.push(`**Activities:**`);
    for (const a of p.activities) lines.push(`- ${a}`);
    lines.push(``);
    lines.push(`**Success Criteria:**`);
    for (const sc of p.successCriteria) lines.push(`- ${sc}`);
    lines.push(``);
  }

  return lines.join("\n");
}

function kpiTargetsMd(data: KPITarget[]): string {
  const lines = [`## 8. KPI Targets`, ``];

  const primary = data.filter((k) => k.type === "primary");
  const secondary = data.filter((k) => k.type === "secondary");

  if (primary.length > 0) {
    lines.push(`### Primary KPIs`);
    lines.push(``);
    lines.push(`| Metric | Target | Timeframe | Benchmark | Measurement |`);
    lines.push(`|--------|--------|-----------|-----------|-------------|`);
    for (const k of primary) {
      lines.push(`| ${k.metric} | ${k.target} | ${k.timeframe} | ${k.benchmark} | ${k.measurementMethod} |`);
    }
    lines.push(``);
  }

  if (secondary.length > 0) {
    lines.push(`### Secondary KPIs`);
    lines.push(``);
    lines.push(`| Metric | Target | Timeframe | Benchmark | Measurement |`);
    lines.push(`|--------|--------|-----------|-----------|-------------|`);
    for (const k of secondary) {
      lines.push(`| ${k.metric} | ${k.target} | ${k.timeframe} | ${k.benchmark} | ${k.measurementMethod} |`);
    }
  }

  return lines.join("\n");
}

function performanceModelMd(d: PerformanceModel): string {
  const m = d.cacModel;
  const lines = [`## 9. Performance Model`, ``];
  const nullable = (n: number | null): string =>
    n !== null ? n.toLocaleString() : '—';

  lines.push(`### Customer Acquisition Cost (CAC) Funnel Model`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Target Cost Per Lead (CPL) | ${fmt$(m.targetCPL)} |`);
  lines.push(`| Expected Leads/mo | ${nullable(m.expectedMonthlyLeads)} |`);
  lines.push(`| Lead → Sales-Qualified Lead (SQL) Rate | ${fmtPct(m.leadToSqlRate)} |`);
  lines.push(`| Expected Sales-Qualified Leads (SQLs)/mo | ${nullable(m.expectedMonthlySQLs)} |`);
  lines.push(`| SQL → Customer Close Rate | ${fmtPct(m.sqlToCustomerRate)} |`);
  lines.push(`| Expected New Customers/mo | ${nullable(m.expectedMonthlyCustomers)} |`);
  lines.push(`| Target Customer Acquisition Cost (CAC) | ${fmt$(m.targetCAC)} |`);
  lines.push(`| Estimated Lifetime Value (LTV) | ${fmt$(m.estimatedLTV)} |`);
  lines.push(`| **Lifetime Value : CAC Ratio (LTV:CAC)** | **${m.ltvToCacRatio ?? 'Insufficient data'}** |`);
  lines.push(``);

  lines.push(`### Monitoring Schedule`);
  lines.push(``);
  lines.push(`**Daily:**`);
  for (const item of d.monitoringSchedule.daily) lines.push(`- ${item}`);
  lines.push(``);
  lines.push(`**Weekly:**`);
  for (const item of d.monitoringSchedule.weekly) lines.push(`- ${item}`);
  lines.push(``);
  lines.push(`**Monthly:**`);
  for (const item of d.monitoringSchedule.monthly) lines.push(`- ${item}`);

  return lines.join("\n");
}

function riskMonitoringMd(d: RiskMonitoring): string {
  const lines = [`## 10. Risk & Monitoring`, ``];

  lines.push(`### Identified Risks`);
  for (const r of d.risks) {
    lines.push(``);
    lines.push(`**${r.risk}**`);
    lines.push(`- Category: ${r.category} | Severity: ${r.severity} | Likelihood: ${r.likelihood}`);
    lines.push(`- Mitigation: ${r.mitigation}`);
    lines.push(`- Contingency: ${r.contingency}`);
  }
  lines.push(``);

  if (d.assumptions.length > 0) {
    lines.push(`### Key Assumptions`);
    for (const a of d.assumptions) lines.push(`- ${a}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function mediaPlanToMarkdown(plan: MediaPlanOutput): string {
  const sections = [
    `# Media Plan`,
    ``,
    `> Generated ${plan.metadata?.generatedAt ? new Date(plan.metadata.generatedAt).toLocaleDateString() : "—"}`,
    ``,
    ...(plan.strategicSynthesis
      ? [strategicSynthesisMd(plan.strategicSynthesis), ``, `---`, ``]
      : []),
    executiveSummaryMd(plan.executiveSummary),
    ``,
    platformStrategyMd(plan.platformStrategy),
    ``,
    icpTargetingMd(plan.icpTargeting),
    ``,
    campaignStructureMd(plan.campaignStructure),
    ``,
    creativeStrategyMd(plan.creativeStrategy),
    ``,
    budgetAllocationMd(plan.budgetAllocation),
    ``,
    campaignPhasesMd(plan.campaignPhases),
    ``,
    kpiTargetsMd(plan.kpiTargets),
    ``,
    performanceModelMd(plan.performanceModel),
    ``,
    riskMonitoringMd(plan.riskMonitoring),
  ];

  return sections.join("\n");
}
