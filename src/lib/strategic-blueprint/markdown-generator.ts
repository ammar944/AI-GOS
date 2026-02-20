/**
 * Strategic Blueprint Markdown Generator
 *
 * Converts a StrategicBlueprintOutput to well-formatted markdown
 * for export and display in markdown viewers.
 */

import type {
  StrategicBlueprintOutput,
  IndustryMarketOverview,
  ICPAnalysisValidation,
  OfferAnalysisViability,
  CompetitorAnalysis,
  CrossAnalysisSynthesis,
  KeywordIntelligence,
  StrategicBlueprintMetadata,
  RiskRating,
  OfferRedFlag,
  OfferRecommendation,
} from './output-types';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Returns a check mark or X mark based on boolean value
 */
function checkMark(value: boolean | undefined | null): string {
  return value ? '✓' : '✗';
}

/**
 * Formats an ISO date string to a readable format
 */
function formatDate(isoString: string | undefined | null): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Safely gets a string value or returns a fallback
 */
function safeString(value: string | undefined | null, fallback = 'N/A'): string {
  return value?.trim() || fallback;
}

/**
 * Safely gets an array or returns empty array
 */
function safeArray<T>(value: T[] | undefined | null): T[] {
  return value ?? [];
}

/**
 * Formats a risk rating with visual indicator
 */
function formatRiskRating(rating: RiskRating | undefined | null): string {
  const ratings: Record<RiskRating, string> = {
    low: '🟢 Low',
    medium: '🟡 Medium',
    high: '🟠 High',
    critical: '🔴 Critical',
  };
  return rating ? ratings[rating] : 'N/A';
}

/**
 * Formats offer red flags to readable text
 */
function formatRedFlag(flag: OfferRedFlag): string {
  const labels: Record<OfferRedFlag, string> = {
    offer_too_vague: 'Offer Too Vague',
    overcrowded_market: 'Overcrowded Market',
    price_mismatch: 'Price Mismatch',
    weak_or_no_proof: 'Weak or No Proof',
    no_funnel_built: 'No Funnel Built',
    transformation_unclear: 'Transformation Unclear',
  };
  return labels[flag] || flag;
}

/**
 * Formats offer recommendation status
 */
function formatRecommendation(status: OfferRecommendation): string {
  const labels: Record<OfferRecommendation, string> = {
    proceed: '✅ Proceed',
    adjust_messaging: '🔄 Adjust Messaging',
    adjust_pricing: '💰 Adjust Pricing',
    icp_refinement_needed: '🎯 ICP Refinement Needed',
    major_offer_rebuild: '🔨 Major Offer Rebuild',
  };
  return labels[status] || status;
}

/**
 * Creates a markdown table from rows
 */
function createTable(headers: string[], rows: string[][]): string {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return `${headerRow}\n${separatorRow}\n${dataRows}`;
}

// =============================================================================
// Section Generators
// =============================================================================

function generateHeader(blueprint: StrategicBlueprintOutput): string {
  const { metadata } = blueprint;

  return `# Strategic Blueprint Report

**Generated:** ${formatDate(metadata?.generatedAt)}
**Version:** ${safeString(metadata?.version)}

---

`;
}

function generateIndustryMarketOverview(section: IndustryMarketOverview): string {
  const lines: string[] = [];

  lines.push('## Section 1: Industry & Market Overview\n');

  // Category Snapshot
  const snapshot = section.categorySnapshot;
  lines.push('### Category Snapshot\n');
  lines.push(`- **Category:** ${safeString(snapshot?.category)}`);
  lines.push(`- **Market Maturity:** ${safeString(snapshot?.marketMaturity)}`);
  lines.push(`- **Awareness Level:** ${safeString(snapshot?.awarenessLevel)}`);
  lines.push(`- **Buying Behavior:** ${safeString(snapshot?.buyingBehavior)}`);
  lines.push(`- **Average Sales Cycle:** ${safeString(snapshot?.averageSalesCycle)}`);
  lines.push(`- **Seasonality:** ${safeString(snapshot?.seasonality)}`);
  lines.push('');

  // Market Dynamics
  const dynamics = section.marketDynamics;
  lines.push('### Market Dynamics\n');

  lines.push('**Demand Drivers:**');
  safeArray(dynamics?.demandDrivers).forEach((driver) => {
    lines.push(`- ${driver}`);
  });
  lines.push('');

  lines.push('**Buying Triggers:**');
  safeArray(dynamics?.buyingTriggers).forEach((trigger) => {
    lines.push(`- ${trigger}`);
  });
  lines.push('');

  lines.push('**Barriers to Purchase:**');
  safeArray(dynamics?.barriersToPurchase).forEach((barrier) => {
    lines.push(`- ${barrier}`);
  });
  lines.push('');

  lines.push('**Macro Risks:**');
  lines.push(`- **Regulatory Concerns:** ${safeString(dynamics?.macroRisks?.regulatoryConcerns)}`);
  lines.push(`- **Market Downturn Risks:** ${safeString(dynamics?.macroRisks?.marketDownturnRisks)}`);
  lines.push(`- **Industry Consolidation:** ${safeString(dynamics?.macroRisks?.industryConsolidation)}`);
  lines.push('');

  // Pain Points
  const painPoints = section.painPoints;
  lines.push('### Pain Points\n');

  lines.push('**Primary Pain Points:**');
  safeArray(painPoints?.primary).forEach((pain) => {
    lines.push(`- ${pain}`);
  });
  lines.push('');

  lines.push('**Secondary Pain Points:**');
  safeArray(painPoints?.secondary).forEach((pain) => {
    lines.push(`- ${pain}`);
  });
  lines.push('');

  // Psychological Drivers
  const psych = section.psychologicalDrivers;
  lines.push('### Psychological Drivers\n');
  safeArray(psych?.drivers).forEach((item) => {
    lines.push(`- **${safeString(item.driver)}:** ${safeString(item.description)}`);
  });
  lines.push('');

  // Audience Objections
  const objections = section.audienceObjections;
  lines.push('### Audience Objections\n');
  safeArray(objections?.objections).forEach((item) => {
    lines.push(`- **Objection:** ${safeString(item.objection)}`);
    lines.push(`  - **How to Address:** ${safeString(item.howToAddress)}`);
  });
  lines.push('');

  // Key Recommendations
  const messaging = section.messagingOpportunities;
  lines.push('### Key Recommendations\n');

  safeArray(messaging?.summaryRecommendations).forEach((rec) => {
    lines.push(`- ${rec}`);
  });
  lines.push('');

  return lines.join('\n');
}

function generateICPAnalysis(section: ICPAnalysisValidation): string {
  const lines: string[] = [];

  lines.push('## Section 2: ICP Analysis & Validation\n');

  // Coherence Check
  const coherence = section.coherenceCheck;
  lines.push('### ICP Coherence Check\n');
  lines.push(
    createTable(
      ['Criteria', 'Status'],
      [
        ['Clearly Defined', checkMark(coherence?.clearlyDefined)],
        ['Reachable Through Paid Channels', checkMark(coherence?.reachableThroughPaidChannels)],
        ['Adequate Scale', checkMark(coherence?.adequateScale)],
        ['Has Pain Offer Solves', checkMark(coherence?.hasPainOfferSolves)],
        ['Has Budget and Authority', checkMark(coherence?.hasBudgetAndAuthority)],
      ]
    )
  );
  lines.push('');

  // Pain-Solution Fit
  const fit = section.painSolutionFit;
  lines.push('### Pain-Solution Fit\n');
  lines.push(`- **Primary Pain:** ${safeString(fit?.primaryPain)}`);
  lines.push(`- **Offer Component Solving It:** ${safeString(fit?.offerComponentSolvingIt)}`);
  lines.push(`- **Fit Assessment:** ${safeString(fit?.fitAssessment)}`);
  lines.push(`- **Notes:** ${safeString(fit?.notes)}`);
  lines.push('');

  // Market Reachability
  const reach = section.marketReachability;
  lines.push('### Market Reachability\n');
  lines.push(
    createTable(
      ['Platform', 'Available'],
      [
        ['Meta Volume', checkMark(reach?.metaVolume)],
        ['LinkedIn Volume', checkMark(reach?.linkedInVolume)],
        ['Google Search Demand', checkMark(reach?.googleSearchDemand)],
      ]
    )
  );
  lines.push('');

  if (safeArray(reach?.contradictingSignals).length > 0) {
    lines.push('**Contradicting Signals:**');
    safeArray(reach?.contradictingSignals).forEach((signal) => {
      lines.push(`- ${signal}`);
    });
    lines.push('');
  }

  // Economic Feasibility
  const econ = section.economicFeasibility;
  lines.push('### Economic Feasibility\n');
  lines.push(`- **Has Budget:** ${checkMark(econ?.hasBudget)}`);
  lines.push(`- **Purchases Similar:** ${checkMark(econ?.purchasesSimilar)}`);
  lines.push(`- **TAM Aligned with CAC:** ${checkMark(econ?.tamAlignedWithCac)}`);
  lines.push(`- **Notes:** ${safeString(econ?.notes)}`);
  lines.push('');

  // Risk Assessment
  lines.push('### Risk Assessment\n');
  if (section.riskScores?.length) {
    lines.push(
      createTable(
        ['Category', 'Risk', 'Probability', 'Impact', 'Score', 'Classification'],
        section.riskScores.map((rs) => {
          const score = rs.score ?? rs.probability * rs.impact;
          const classification = rs.classification ?? (score >= 16 ? 'critical' : score >= 9 ? 'high' : score >= 4 ? 'medium' : 'low');
          return [
            rs.category.replace(/_/g, ' '),
            rs.risk,
            String(rs.probability),
            String(rs.impact),
            String(score),
            classification.toUpperCase(),
          ];
        })
      )
    );
  } else {
    const risk = (section as any).riskAssessment;
    lines.push(
      createTable(
        ['Risk Category', 'Rating'],
        [
          ['Reachability', formatRiskRating(risk?.reachability)],
          ['Budget', formatRiskRating(risk?.budget)],
          ['Pain Strength', formatRiskRating(risk?.painStrength)],
          ['Competitiveness', formatRiskRating(risk?.competitiveness)],
        ]
      )
    );
  }
  lines.push('');

  // Customer Psychographics
  const psych = section.customerPsychographics;
  if (psych) {
    lines.push('### Customer Psychographics\n');

    if (safeArray(psych.goalsAndDreams).length > 0) {
      lines.push('**Goals & Dreams:**');
      safeArray(psych.goalsAndDreams).forEach((g) => lines.push(`- ${g}`));
      lines.push('');
    }

    if (safeArray(psych.fearsAndInsecurities).length > 0) {
      lines.push('**Fears & Insecurities:**');
      safeArray(psych.fearsAndInsecurities).forEach((f) => lines.push(`- ${f}`));
      lines.push('');
    }

    if (safeArray(psych.embarrassingSituations).length > 0) {
      lines.push('**Embarrassing Situations:**');
      safeArray(psych.embarrassingSituations).forEach((s) => lines.push(`- ${s}`));
      lines.push('');
    }

    if (psych.perceivedEnemy) {
      lines.push(`**Perceived Enemy:** ${psych.perceivedEnemy}`);
      lines.push('');
    }

    if (safeArray(psych.failedSolutions).length > 0) {
      lines.push('**Failed Solutions:**');
      safeArray(psych.failedSolutions).forEach((s) => lines.push(`- ${s}`));
      lines.push('');
    }

    if (psych.dayInTheLife) {
      lines.push('**Day in the Life:**');
      lines.push(`> ${psych.dayInTheLife}`);
      lines.push('');
    }
  }

  // Trigger Events
  if (safeArray(section.triggerEvents).length > 0) {
    lines.push('### Trigger Events\n');
    lines.push(
      createTable(
        ['Event', 'Frequency', 'Urgency', 'Detection Method', 'Recommended Hook'],
        section.triggerEvents.map((te) => [
          te.event,
          te.annualFrequencyEstimate,
          te.urgencyLevel,
          te.detectionMethod,
          te.recommendedHook,
        ])
      )
    );
    lines.push('');
  }

  // Segment Sizing
  if (safeArray(section.segmentSizing).length > 0) {
    lines.push('### Segment Sizing\n');
    lines.push(
      createTable(
        ['Priority', 'Accounts', 'Contacts', 'Share %', 'Budget Weight %'],
        section.segmentSizing.map((seg) => [
          `Tier ${seg.priorityTier}`,
          seg.totalAddressableAccounts?.toLocaleString(),
          seg.totalAddressableContacts?.toLocaleString(),
          `${seg.segmentSharePercent}%`,
          `${seg.recommendedBudgetWeight}%`,
        ])
      )
    );
    lines.push('');
  }

  // SAM Estimate
  const sam = section.samEstimate;
  if (sam) {
    lines.push('### SAM Estimate\n');
    lines.push(`- **Total Matching Companies:** ${sam.totalMatchingCompanies?.toLocaleString()}`);
    if (safeArray(sam.filteringFunnel).length > 0) {
      lines.push('');
      lines.push('**Filtering Funnel:**');
      lines.push(
        createTable(
          ['Stage', 'Count', 'Drop-Off Reason'],
          sam.filteringFunnel.map((s) => [
            s.stage,
            s.count?.toLocaleString(),
            s.dropOffReason,
          ])
        )
      );
    }
    lines.push('');
    lines.push(`- **Estimated SAM Companies:** ${sam.estimatedSAMCompanies?.toLocaleString()}`);
    lines.push(`- **Estimated ACV:** $${sam.estimatedAnnualContractValue?.toLocaleString()}`);
    lines.push(`- **Confidence:** ${sam.confidence}`);
    lines.push(`- **Data Sources:** ${safeArray(sam.dataSources).join(', ')}`);
    lines.push('');
  }

  // Sensitivity Analysis
  const sens = section.sensitivityAnalysis;
  if (sens) {
    lines.push('### Sensitivity Analysis\n');

    const formatScenario = (label: string, s: typeof sens.bestCase) => {
      lines.push(`**${label}:**`);
      lines.push(`- CPL: $${s.assumedCPL}`);
      lines.push(`- Lead→SQL: ${s.assumedLeadToSqlRate}%`);
      lines.push(`- SQL→Customer: ${s.assumedSqlToCustomerRate}%`);
      if (s.resultingCAC != null) lines.push(`- Resulting CAC: $${s.resultingCAC.toLocaleString()}`);
      if (s.monthlyCustomers != null) lines.push(`- Monthly Customers: ${s.monthlyCustomers}`);
      if (s.ltvCacRatio != null) lines.push(`- LTV:CAC Ratio: ${s.ltvCacRatio}`);
      lines.push(`- Conditions: ${s.conditions}`);
      lines.push('');
    };

    formatScenario('Best Case', sens.bestCase);
    formatScenario('Base Case', sens.baseCase);
    formatScenario('Worst Case', sens.worstCase);

    if (sens.breakEven) {
      lines.push('**Break-Even Thresholds:**');
      lines.push(`- Max CPL for 3x LTV: $${sens.breakEven.maxCPLFor3xLTV}`);
      lines.push(`- Max CAC: $${sens.breakEven.maxCAC}`);
      lines.push(`- Min Lead→SQL Rate: ${sens.breakEven.minLeadToSqlRate}%`);
      lines.push(`- Budget Floor for Testing: $${sens.breakEven.budgetFloorForTesting?.toLocaleString()}`);
      lines.push('');
    }
  }

  // Final Verdict
  const verdict = section.finalVerdict;
  lines.push('### Final Verdict\n');
  lines.push(`**Status:** ${safeString(verdict?.status)?.toUpperCase()}`);
  lines.push('');
  lines.push(`**Reasoning:** ${safeString(verdict?.reasoning)}`);
  lines.push('');

  if (safeArray(verdict?.recommendations).length > 0) {
    lines.push('**Recommendations:**');
    safeArray(verdict?.recommendations).forEach((rec) => {
      lines.push(`- ${rec}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

function generateOfferAnalysis(section: OfferAnalysisViability): string {
  const lines: string[] = [];

  lines.push('## Section 3: Offer Analysis & Viability\n');

  // Offer Clarity
  const clarity = section.offerClarity;
  lines.push('### Offer Clarity\n');
  lines.push(
    createTable(
      ['Criteria', 'Status'],
      [
        ['Clearly Articulated', checkMark(clarity?.clearlyArticulated)],
        ['Solves Real Pain', checkMark(clarity?.solvesRealPain)],
        ['Benefits Easy to Understand', checkMark(clarity?.benefitsEasyToUnderstand)],
        ['Transformation Measurable', checkMark(clarity?.transformationMeasurable)],
        ['Value Proposition Obvious', checkMark(clarity?.valuePropositionObvious)],
      ]
    )
  );
  lines.push('');

  // Offer Strength Scores
  const strength = section.offerStrength;
  lines.push('### Offer Strength Scores\n');
  lines.push(
    createTable(
      ['Metric', 'Score (1-10)'],
      [
        ['Pain Relevance', String(strength?.painRelevance ?? 'N/A')],
        ['Urgency', String(strength?.urgency ?? 'N/A')],
        ['Differentiation', String(strength?.differentiation ?? 'N/A')],
        ['Tangibility', String(strength?.tangibility ?? 'N/A')],
        ['Proof', String(strength?.proof ?? 'N/A')],
        ['Pricing Logic', String(strength?.pricingLogic ?? 'N/A')],
        ['**Overall Score**', `**${strength?.overallScore ?? 'N/A'}**`],
      ]
    )
  );
  lines.push('');

  // Market-Offer Fit
  const fit = section.marketOfferFit;
  lines.push('### Market-Offer Fit\n');
  lines.push(
    createTable(
      ['Criteria', 'Status'],
      [
        ['Market Wants Now', checkMark(fit?.marketWantsNow)],
        ['Competitors Offer Similar', checkMark(fit?.competitorsOfferSimilar)],
        ['Price Matches Expectations', checkMark(fit?.priceMatchesExpectations)],
        ['Proof Strong for Cold Traffic', checkMark(fit?.proofStrongForColdTraffic)],
        ['Transformation Believable', checkMark(fit?.transformationBelievable)],
      ]
    )
  );
  lines.push('');

  // Red Flags
  const redFlags = safeArray(section.redFlags);
  lines.push('### Red Flags\n');
  if (redFlags.length > 0) {
    redFlags.forEach((flag) => {
      lines.push(`- ⚠️ ${formatRedFlag(flag)}`);
    });
  } else {
    lines.push('- ✅ No red flags identified');
  }
  lines.push('');

  // Recommendation
  const rec = section.recommendation;
  lines.push('### Recommendation\n');
  lines.push(`**Status:** ${formatRecommendation(rec?.status as OfferRecommendation)}`);
  lines.push('');
  lines.push(`**Reasoning:** ${safeString(rec?.reasoning)}`);
  lines.push('');

  if (safeArray(rec?.actionItems).length > 0) {
    lines.push('**Action Items:**');
    safeArray(rec?.actionItems).forEach((item) => {
      lines.push(`- ${item}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

function generateCompetitorAnalysis(section: CompetitorAnalysis): string {
  const lines: string[] = [];

  lines.push('## Section 4: Competitor Analysis\n');

  // Competitor Snapshots
  const competitors = safeArray(section.competitors);
  lines.push('### Competitor Snapshots\n');

  competitors.forEach((comp, index) => {
    lines.push(`#### ${index + 1}. ${safeString(comp.name)}\n`);
    if (comp.website) {
      lines.push(`**Website:** ${comp.website}`);
    }
    lines.push(`**Positioning:** ${safeString(comp.positioning)}`);
    // Only show simple Offer if no detailed mainOffer exists
    if (!comp.mainOffer) {
      lines.push(`**Offer:** ${safeString(comp.offer)}`);
    }
    // Only show simple Price if no detailed pricingTiers exist
    if (!safeArray(comp.pricingTiers).length) {
      lines.push(`**Price:** ${safeString(comp.price)}`);
    }
    lines.push(`**Funnels:** ${safeString(comp.funnels)}`);
    if (safeArray(comp.adPlatforms).length > 0) {
      lines.push(`**Ad Platforms:** ${safeArray(comp.adPlatforms).join(', ')}`);
    } else {
      lines.push('**Ad Platforms:** No active paid campaigns detected');
    }
    lines.push('');

    if (safeArray(comp.strengths).length > 0) {
      lines.push('**Strengths:**');
      safeArray(comp.strengths).forEach((s) => lines.push(`- ${s}`));
      lines.push('');
    }

    if (safeArray(comp.weaknesses).length > 0) {
      lines.push('**Weaknesses:**');
      safeArray(comp.weaknesses).forEach((w) => lines.push(`- ${w}`));
      lines.push('');
    }

    if (safeArray(comp.adMessagingThemes).length > 0) {
      lines.push('**Ad Messaging Themes:**');
      safeArray(comp.adMessagingThemes).forEach((theme) => lines.push(`- ${theme}`));
      lines.push('');
    }

    if (safeArray(comp.pricingTiers).length > 0) {
      lines.push('**Pricing Tiers:** *(prices may vary by region)*');
      safeArray(comp.pricingTiers).forEach((tier) => {
        lines.push(`- **${tier.tier}:** ${tier.price}`);
        if (tier.targetAudience) {
          lines.push(`  - *For:* ${tier.targetAudience}`);
        }
        if (tier.description) {
          lines.push(`  - ${tier.description}`);
        }
        if (safeArray(tier.features).length > 0) {
          lines.push(`  - **Key Features:**`);
          safeArray(tier.features).forEach((f) => lines.push(`    - ${f}`));
        }
        if (tier.limitations) {
          lines.push(`  - *Limits:* ${tier.limitations}`);
        }
      });
      lines.push('');
    }

    if (comp.mainOffer) {
      lines.push('**Main Offer:**');
      lines.push(`- Headline: ${safeString(comp.mainOffer.headline)}`);
      lines.push(`- Value Proposition: ${safeString(comp.mainOffer.valueProposition)}`);
      lines.push(`- CTA: ${safeString(comp.mainOffer.cta)}`);
      lines.push('');
    }

    // Threat Assessment
    const threat = comp.threatAssessment;
    if (threat) {
      const classification = threat.classification ?? 'secondary';
      const score = threat.weightedThreatScore != null ? ` (Score: ${threat.weightedThreatScore.toFixed(1)})` : '';
      lines.push(`**Threat Assessment:** ${classification.toUpperCase()}${score}`);
      if (threat.threatFactors) {
        const tf = threat.threatFactors;
        lines.push(`- Market Share/Recognition: ${tf.marketShareRecognition}/10`);
        lines.push(`- Ad Spend Intensity: ${tf.adSpendIntensity}/10`);
        lines.push(`- Product Overlap: ${tf.productOverlap}/10`);
        lines.push(`- Price Competitiveness: ${tf.priceCompetitiveness}/10`);
        lines.push(`- Growth Trajectory: ${tf.growthTrajectory}/10`);
      }
      if (safeArray(threat.topAdHooks).length > 0) {
        lines.push('- **Top Ad Hooks:**');
        safeArray(threat.topAdHooks).forEach((h) => lines.push(`  - "${h}"`));
      }
      if (threat.likelyResponse) {
        lines.push(`- **Likely Response:** ${threat.likelyResponse}`);
      }
      if (threat.counterPositioning) {
        lines.push(`- **Counter-Positioning:** ${threat.counterPositioning}`);
      }
      lines.push('');
    }

    // Customer Reviews — only render header if at least one source has actual data
    const rd = (comp as any)?.reviewData;
    const hasG2Data = rd?.g2 && (rd.g2.rating > 0 || rd.g2.reviewCount > 0);
    const hasTrustpilotData = rd?.trustpilot && (rd.trustpilot.trustScore > 0 || rd.trustpilot.totalReviews > 0);
    if (hasG2Data || hasTrustpilotData) {
      lines.push('**Customer Reviews:**');
      if (hasG2Data) {
        const g2Link = rd.g2.url ? `[G2](${rd.g2.url})` : 'G2';
        lines.push(`- ${g2Link}: ${rd.g2.rating}/5 (${rd.g2.reviewCount} reviews)${rd.g2.productCategory ? ` — ${rd.g2.productCategory}` : ''}`);
      }
      if (hasTrustpilotData) {
        const tpLink = rd.trustpilot.url ? `[Trustpilot](${rd.trustpilot.url})` : 'Trustpilot';
        lines.push(`- ${tpLink}: ${rd.trustpilot.trustScore}/5 (${rd.trustpilot.totalReviews} reviews)`);
        if (rd.trustpilot.aiSummary) {
          lines.push(`  - *${rd.trustpilot.aiSummary.slice(0, 200)}${rd.trustpilot.aiSummary.length > 200 ? '...' : ''}*`);
        }
        const complaints = rd.trustpilot.reviews?.filter((r: any) => r.rating <= 2).slice(0, 2);
        if (complaints?.length > 0) {
          lines.push('  - **Complaints:**');
          for (const r of complaints) {
            lines.push(`    - ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.text.slice(0, 150)}${r.text.length > 150 ? '...' : ''}`);
          }
        }
        const praise = rd.trustpilot.reviews?.filter((r: any) => r.rating >= 4).slice(0, 2);
        if (praise?.length > 0) {
          lines.push('  - **Praised For:**');
          for (const r of praise) {
            lines.push(`    - ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.text.slice(0, 150)}${r.text.length > 150 ? '...' : ''}`);
          }
        }
      }
      lines.push('');
    }
  });

  // Creative Library
  const creative = section.creativeLibrary;
  lines.push('### Creative Library Insights\n');

  lines.push('**Creative Formats:**');
  const formats = creative?.creativeFormats;
  lines.push(
    createTable(
      ['Format', 'Used'],
      [
        ['UGC', checkMark(formats?.ugc)],
        ['Carousels', checkMark(formats?.carousels)],
        ['Statics', checkMark(formats?.statics)],
        ['Testimonial', checkMark(formats?.testimonial)],
        ['Product Demo', checkMark(formats?.productDemo)],
      ]
    )
  );
  lines.push('');

  // Funnel Breakdown
  const funnel = section.funnelBreakdown;
  lines.push('### Funnel Breakdown\n');

  lines.push(`**Form Friction:** ${safeString(funnel?.formFriction)}`);
  lines.push('');

  if (safeArray(funnel?.headlineStructure).length > 0) {
    lines.push('**Headline Structure Patterns:**');
    safeArray(funnel?.headlineStructure).forEach((pattern) => {
      lines.push(`- ${pattern}`);
    });
    lines.push('');
  }

  if (safeArray(funnel?.ctaHierarchy).length > 0) {
    lines.push('**CTA Hierarchy Patterns:**');
    safeArray(funnel?.ctaHierarchy).forEach((pattern) => {
      lines.push(`- ${pattern}`);
    });
    lines.push('');
  }

  if (safeArray(funnel?.socialProofPatterns).length > 0) {
    lines.push('**Social Proof Patterns:**');
    safeArray(funnel?.socialProofPatterns).forEach((pattern) => {
      lines.push(`- ${pattern}`);
    });
    lines.push('');
  }

  if (safeArray(funnel?.leadCaptureMethods).length > 0) {
    lines.push('**Lead Capture Methods:**');
    safeArray(funnel?.leadCaptureMethods).forEach((method) => {
      lines.push(`- ${method}`);
    });
    lines.push('');
  }

  // Opportunities
  lines.push('### Gaps & Opportunities\n');

  if (section.whiteSpaceGaps?.length) {
    lines.push(
      createTable(
        ['Type', 'Gap', 'Evidence', 'Exploitability', 'Impact', 'Action'],
        section.whiteSpaceGaps.map((wsg) => [
          wsg.type,
          wsg.gap,
          wsg.evidence,
          String(wsg.exploitability),
          String(wsg.impact),
          wsg.recommendedAction,
        ])
      )
    );
    lines.push('');
  } else {
    const gaps = section.gapsAndOpportunities;
    if (safeArray(gaps?.messagingOpportunities).length > 0) {
      lines.push('**Messaging Opportunities:**');
      safeArray(gaps?.messagingOpportunities).forEach((opp) => {
        lines.push(`- ${opp}`);
      });
      lines.push('');
    }

    if (safeArray(gaps?.creativeOpportunities).length > 0) {
      lines.push('**Creative Opportunities:**');
      safeArray(gaps?.creativeOpportunities).forEach((opp) => {
        lines.push(`- ${opp}`);
      });
      lines.push('');
    }

    if (safeArray(gaps?.funnelOpportunities).length > 0) {
      lines.push('**Funnel Opportunities:**');
      safeArray(gaps?.funnelOpportunities).forEach((opp) => {
        lines.push(`- ${opp}`);
      });
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateCrossAnalysis(section: CrossAnalysisSynthesis): string {
  const lines: string[] = [];

  lines.push('## Section 5: Cross-Analysis Synthesis\n');

  // Key Insights
  const insights = safeArray(section.keyInsights);
  lines.push('### Key Strategic Insights\n');

  if (insights.length > 0) {
    insights.forEach((insight, index) => {
      const priorityIcon =
        insight.priority === 'high' ? '🔴' : insight.priority === 'medium' ? '🟡' : '🟢';
      lines.push(`#### ${index + 1}. ${safeString(insight.insight)} ${priorityIcon}\n`);
      lines.push(`- **Source:** ${safeString(insight.source)}`);
      lines.push(`- **Implication:** ${safeString(insight.implication)}`);
      lines.push(`- **Priority:** ${safeString(insight.priority)}`);
      lines.push('');
    });
  }

  // Positioning
  lines.push('### Recommended Positioning\n');
  lines.push(safeString(section.recommendedPositioning));
  lines.push('');

  // Positioning Strategy
  const ps = section.positioningStrategy;
  if (ps) {
    lines.push('### Positioning Strategy\n');
    lines.push(`**Primary:** ${safeString(ps.primary)}`);
    lines.push('');

    if (safeArray(ps.alternatives).length > 0) {
      lines.push('**Alternative Positions:**');
      safeArray(ps.alternatives).forEach((a) => lines.push(`- ${a}`));
      lines.push('');
    }

    if (safeArray(ps.differentiators).length > 0) {
      lines.push('**Key Differentiators:**');
      safeArray(ps.differentiators).forEach((d) => lines.push(`- ${d}`));
      lines.push('');
    }

    if (safeArray(ps.avoidPositions).length > 0) {
      lines.push('**Positions to Avoid:**');
      safeArray(ps.avoidPositions).forEach((a) => lines.push(`- ${a}`));
      lines.push('');
    }
  }

  // Messaging Framework
  const mf = section.messagingFramework;
  if (mf) {
    lines.push('### Messaging Framework\n');
    lines.push(`**Core Message:** ${safeString(mf.coreMessage)}`);
    lines.push('');

    if (safeArray(mf.supportingMessages).length > 0) {
      lines.push('**Supporting Messages:**');
      safeArray(mf.supportingMessages).forEach((m) => lines.push(`- ${m}`));
      lines.push('');
    }

    if (safeArray(mf.proofPoints).length > 0) {
      lines.push('**Proof Points:**');
      safeArray(mf.proofPoints).forEach((p) => lines.push(`- ${p}`));
      lines.push('');
    }

    if (safeArray(mf.tonalGuidelines).length > 0) {
      lines.push('**Tonal Guidelines:**');
      safeArray(mf.tonalGuidelines).forEach((t) => lines.push(`- ${t}`));
      lines.push('');
    }

    // Ad Hooks
    if (safeArray(mf.adHooks).length > 0) {
      lines.push('#### Ad Hooks\n');
      lines.push(
        createTable(
          ['Hook', 'Technique', 'Target Awareness', 'Source'],
          mf.adHooks.map((h) => [
            `"${h.hook}"`,
            h.technique.replace(/-/g, ' '),
            h.targetAwareness.replace(/-/g, ' '),
            h.source ? `${h.source.type}${h.source.competitors?.length ? ` (${h.source.competitors.join(', ')})` : ''}` : 'N/A',
          ])
        )
      );
      lines.push('');
    }

    // Angles
    if (safeArray(mf.angles).length > 0) {
      lines.push('#### Creative Angles\n');
      mf.angles.forEach((a) => {
        lines.push(`**${safeString(a.name)}** — Target Emotion: ${safeString(a.targetEmotion)}`);
        lines.push(`${safeString(a.description)}`);
        lines.push(`> Example: "${safeString(a.exampleHeadline)}"`);
        lines.push('');
      });
    }

    // Detailed Proof Points
    if (safeArray(mf.proofPointsDetailed).length > 0) {
      lines.push('#### Detailed Proof Points\n');
      lines.push(
        createTable(
          ['Claim', 'Evidence', 'Source'],
          mf.proofPointsDetailed.map((p) => [
            p.claim,
            p.evidence,
            safeString(p.source),
          ])
        )
      );
      lines.push('');
    }

    // Objection Handlers
    if (safeArray(mf.objectionHandlers).length > 0) {
      lines.push('#### Objection Handlers\n');
      lines.push(
        createTable(
          ['Objection', 'Response', 'Reframe'],
          mf.objectionHandlers.map((o) => [
            o.objection,
            o.response,
            o.reframe,
          ])
        )
      );
      lines.push('');
    }
  }

  // Recommended Platforms
  const platforms = safeArray(section.recommendedPlatforms);
  lines.push('### Recommended Platforms\n');
  lines.push(
    createTable(
      ['Platform', 'Priority', 'Reasoning'],
      platforms.map((p) => [
        safeString(p.platform),
        safeString(p.priority),
        safeString(p.reasoning),
      ])
    )
  );
  lines.push('');

  // Success Factors
  const successFactors = safeArray(section.criticalSuccessFactors);
  lines.push('### Critical Success Factors\n');
  successFactors.forEach((factor) => {
    lines.push(`- ${factor}`);
  });
  lines.push('');

  // Potential Blockers
  const blockers = safeArray(section.potentialBlockers);
  lines.push('### Potential Blockers\n');
  blockers.forEach((blocker) => {
    lines.push(`- ⚠️ ${blocker}`);
  });
  lines.push('');

  // Next Steps
  const nextSteps = safeArray(section.nextSteps);
  lines.push('### Next Steps\n');
  nextSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });
  lines.push('');

  return lines.join('\n');
}

function generateKeywordIntelligence(section: KeywordIntelligence): string {
  const lines: string[] = [];

  lines.push('## Section 6: Keyword Intelligence\n');

  // Domain Overview
  lines.push('### Domain Overview\n');
  if (section.clientDomain) {
    const cd = section.clientDomain;
    lines.push(`**Client Domain:** ${cd.domain}\n`);
    lines.push(
      createTable(
        ['Metric', 'Value'],
        [
          ['Organic Keywords', String(cd.organicKeywords?.toLocaleString() ?? 'N/A')],
          ['Paid Keywords', String(cd.paidKeywords?.toLocaleString() ?? 'N/A')],
          ['Monthly Organic Clicks', String(cd.monthlyOrganicClicks?.toLocaleString() ?? 'N/A')],
          ['Monthly Paid Clicks', String(cd.monthlyPaidClicks?.toLocaleString() ?? 'N/A')],
          ['Organic Traffic Value', cd.organicClicksValue ? `$${cd.organicClicksValue.toLocaleString()}/mo` : 'N/A'],
          ['Estimated Ad Spend', cd.paidClicksValue ? `$${cd.paidClicksValue.toLocaleString()}/mo` : 'N/A'],
        ]
      )
    );
    lines.push('');
  }

  if (safeArray(section.competitorDomains).length > 0) {
    lines.push('**Competitor Domains:**\n');
    lines.push(
      createTable(
        ['Domain', 'Organic KWs', 'Paid KWs', 'Organic Clicks/mo', 'Paid Clicks/mo', 'Traffic Value/mo', 'Ad Spend/mo'],
        safeArray(section.competitorDomains).map((c) => [
          c.domain,
          String(c.organicKeywords?.toLocaleString() ?? 'N/A'),
          String(c.paidKeywords?.toLocaleString() ?? 'N/A'),
          String(c.monthlyOrganicClicks?.toLocaleString() ?? 'N/A'),
          String(c.monthlyPaidClicks?.toLocaleString() ?? 'N/A'),
          c.organicClicksValue ? `$${c.organicClicksValue.toLocaleString()}` : 'N/A',
          c.paidClicksValue ? `$${c.paidClicksValue.toLocaleString()}` : 'N/A',
        ])
      )
    );
    lines.push('');
  }

  // Keyword Gaps
  const formatKwTable = (keywords: typeof section.organicGaps, title: string) => {
    if (!safeArray(keywords).length) return;
    lines.push(`### ${title}\n`);
    lines.push(
      createTable(
        ['Keyword', 'Volume', 'CPC', 'Difficulty', 'Source'],
        safeArray(keywords).slice(0, 20).map((kw) => [
          kw.keyword,
          String(kw.searchVolume?.toLocaleString() ?? 'N/A'),
          `$${kw.cpc?.toFixed(2) ?? 'N/A'}`,
          String(kw.difficulty ?? 'N/A'),
          kw.source?.replace(/_/g, ' ') ?? 'N/A',
        ])
      )
    );
    if (safeArray(keywords).length > 20) {
      lines.push(`\n*Showing 20 of ${safeArray(keywords).length} keywords*`);
    }
    lines.push('');
  };

  formatKwTable(section.organicGaps, 'Organic Keyword Gaps');
  formatKwTable(section.paidGaps, 'Paid Keyword Gaps');
  formatKwTable(section.sharedKeywords, 'Shared Keywords (Competitive Battlegrounds)');
  formatKwTable(section.clientStrengths, 'Your Keyword Strengths');
  formatKwTable(section.quickWins, 'Quick Win Opportunities');
  formatKwTable(section.longTermPlays, 'Long-Term Plays');
  formatKwTable(section.highIntentKeywords, 'High-Intent Keywords');
  formatKwTable(section.relatedExpansions, 'Related Keyword Expansions');

  // Competitor Top Keywords — only render competitors that have keyword data
  const compsWithKeywords = safeArray(section.competitorTopKeywords).filter(
    (comp) => safeArray(comp.keywords).length > 0
  );
  if (compsWithKeywords.length > 0) {
    lines.push('### Competitor Top Keywords\n');
    compsWithKeywords.forEach((comp) => {
      lines.push(`#### ${comp.competitorName} (${comp.domain})\n`);
      lines.push(
        createTable(
          ['Keyword', 'Volume', 'CPC', 'Difficulty'],
          comp.keywords.slice(0, 10).map((kw) => [
            kw.keyword,
            String(kw.searchVolume?.toLocaleString() ?? 'N/A'),
            `$${kw.cpc?.toFixed(2) ?? 'N/A'}`,
            String(kw.difficulty ?? 'N/A'),
          ])
        )
      );
      if (comp.keywords.length > 10) {
        lines.push(`\n*Showing 10 of ${comp.keywords.length} keywords*`);
      }
      lines.push('');
    });
  }

  // Content Topic Clusters
  if (safeArray(section.contentTopicClusters).length > 0) {
    lines.push('### Content Topic Clusters\n');
    safeArray(section.contentTopicClusters).forEach((cluster) => {
      lines.push(`#### ${cluster.theme}\n`);
      lines.push(`- **Total Volume:** ${cluster.searchVolumeTotal?.toLocaleString()}`);
      lines.push(`- **Recommended Format:** ${cluster.recommendedFormat}`);
      lines.push(`- **Keywords:** ${cluster.keywords.join(', ')}`);
      lines.push('');
    });
  }

  // Strategic Recommendations
  if (section.strategicRecommendations) {
    const recs = section.strategicRecommendations;
    lines.push('### Strategic Recommendations\n');

    if (safeArray(recs.organicStrategy).length > 0) {
      lines.push('**Organic Strategy:**');
      safeArray(recs.organicStrategy).forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }
    if (safeArray(recs.paidSearchStrategy).length > 0) {
      lines.push('**Paid Search Strategy:**');
      safeArray(recs.paidSearchStrategy).forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }
    if (safeArray(recs.competitivePositioning).length > 0) {
      lines.push('**Competitive Positioning:**');
      safeArray(recs.competitivePositioning).forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }
    if (safeArray(recs.quickWinActions).length > 0) {
      lines.push('**Quick Win Actions:**');
      safeArray(recs.quickWinActions).forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }
  }

  // SEO Audit
  const seo = section.seoAudit;
  if (seo) {
    lines.push('### SEO Audit\n');

    // Technical
    if (seo.technical) {
      const tech = seo.technical;
      lines.push('#### Technical SEO\n');
      lines.push(`- **Overall Score:** ${tech.overallScore}/100`);
      lines.push(`- **Sitemap Found:** ${tech.sitemapFound ? '✓' : '✗'}`);
      lines.push(`- **Robots.txt Found:** ${tech.robotsTxtFound ? '✓' : '✗'}`);
      lines.push(`- **Issues:** ${tech.issueCount.critical} critical, ${tech.issueCount.warning} warnings, ${tech.issueCount.pass} passed`);
      lines.push('');

      if (safeArray(tech.pages).length > 0) {
        lines.push(
          createTable(
            ['URL', 'Title', 'Meta Desc', 'H1', 'HTTPS', 'Images w/ Alt'],
            tech.pages.map((p) => [
              p.url,
              p.title.pass ? '✓' : '✗',
              p.metaDescription.pass ? '✓' : '✗',
              p.h1.pass ? '✓' : '✗',
              p.isHttps ? '✓' : '✗',
              `${p.images.coveragePercent}%`,
            ])
          )
        );
        lines.push('');
      }
    }

    // Performance
    if (seo.performance) {
      const perf = seo.performance;
      lines.push('#### Performance (PageSpeed)\n');

      const formatMetrics = (label: string, m: typeof perf.mobile) => {
        if (!m) return;
        lines.push(`**${label}:**`);
        lines.push(`- Performance Score: ${m.performanceScore}/100`);
        lines.push(`- LCP: ${(m.lcp / 1000).toFixed(2)}s`);
        lines.push(`- FCP: ${(m.fcp / 1000).toFixed(2)}s`);
        lines.push(`- CLS: ${m.cls.toFixed(3)}`);
        lines.push(`- TTI: ${(m.tti / 1000).toFixed(2)}s`);
        lines.push(`- Speed Index: ${(m.speedIndex / 1000).toFixed(2)}s`);
        lines.push('');
      };

      formatMetrics('Mobile', perf.mobile);
      formatMetrics('Desktop', perf.desktop);
    }

    lines.push(`**Overall SEO Score:** ${seo.overallScore}/100`);
    lines.push('');
  }

  // Metadata
  if (section.metadata) {
    lines.push('### Collection Metadata\n');
    lines.push(`- **Client Domain:** ${section.metadata.clientDomain}`);
    lines.push(`- **Competitors Analyzed:** ${safeArray(section.metadata.competitorDomainsAnalyzed).join(', ')}`);
    lines.push(`- **Total Keywords Analyzed:** ${section.metadata.totalKeywordsAnalyzed?.toLocaleString()}`);
    lines.push(`- **SpyFu Cost:** $${section.metadata.spyfuCost?.toFixed(4)}`);
    lines.push(`- **Collected At:** ${section.metadata.collectedAt}`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateFooter(metadata: StrategicBlueprintMetadata): string {
  const lines: string[] = [];

  lines.push('---\n');
  lines.push('## Report Metadata\n');

  const processingTimeSec = metadata?.processingTime
    ? (metadata.processingTime / 1000).toFixed(1)
    : 'N/A';
  const totalCost = metadata?.totalCost ? `$${metadata.totalCost.toFixed(4)}` : 'N/A';

  lines.push(`- **Generated At:** ${formatDate(metadata?.generatedAt)}`);
  lines.push(`- **Version:** ${safeString(metadata?.version)}`);
  lines.push(`- **Processing Time:** ${processingTimeSec}s`);
  lines.push(`- **Total Cost:** ${totalCost}`);
  lines.push(`- **Models Used:** ${safeArray(metadata?.modelsUsed).join(', ') || 'N/A'}`);
  lines.push('');

  lines.push('---\n');
  lines.push('*Generated by AI-GOS Strategic Blueprint Engine*');

  return lines.join('\n');
}

// =============================================================================
// Main Export Function
// =============================================================================

/**
 * Generates a well-formatted markdown document from a Strategic Blueprint output.
 *
 * @param blueprint - The complete strategic blueprint output
 * @returns Formatted markdown string
 */
export function generateBlueprintMarkdown(blueprint: StrategicBlueprintOutput): string {
  const sections: string[] = [];

  // Header
  sections.push(generateHeader(blueprint));

  // Section 1: Industry & Market Overview
  if (blueprint.industryMarketOverview) {
    sections.push(generateIndustryMarketOverview(blueprint.industryMarketOverview));
  }

  // Section 2: ICP Analysis & Validation
  if (blueprint.icpAnalysisValidation) {
    sections.push(generateICPAnalysis(blueprint.icpAnalysisValidation));
  }

  // Section 3: Offer Analysis & Viability
  if (blueprint.offerAnalysisViability) {
    sections.push(generateOfferAnalysis(blueprint.offerAnalysisViability));
  }

  // Section 4: Competitor Analysis
  if (blueprint.competitorAnalysis) {
    sections.push(generateCompetitorAnalysis(blueprint.competitorAnalysis));
  }

  // Section 5: Cross-Analysis Synthesis
  if (blueprint.crossAnalysisSynthesis) {
    sections.push(generateCrossAnalysis(blueprint.crossAnalysisSynthesis));
  }

  // Section 6: Keyword Intelligence (optional)
  if (blueprint.keywordIntelligence) {
    sections.push(generateKeywordIntelligence(blueprint.keywordIntelligence));
  }

  // Footer with metadata
  if (blueprint.metadata) {
    sections.push(generateFooter(blueprint.metadata));
  }

  return sections.join('\n');
}
