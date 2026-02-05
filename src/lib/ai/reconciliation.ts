// Phase 2 Reconciliation - Zero-Risk Parallel ICP + Offer Execution
// Applies deterministic rules to ensure consistency after parallel generation

import type { ICPAnalysisValidation } from './schemas/icp-analysis';
import type { OfferAnalysisViability } from './schemas/offer-analysis';

// =============================================================================
// Types
// =============================================================================

export interface ReconciliationAdjustment {
  /** Which field was adjusted */
  field: string;
  /** Original value before adjustment */
  originalValue: string | number;
  /** New value after adjustment */
  adjustedValue: string | number;
  /** Rule that triggered this adjustment */
  rule: string;
  /** Human-readable explanation */
  reason: string;
}

export interface ReconciliationResult {
  /** Adjusted offer analysis (may be same as input if no conflicts) */
  adjustedOffer: OfferAnalysisViability;
  /** List of adjustments made */
  adjustments: ReconciliationAdjustment[];
  /** Human-readable notes for each adjustment */
  reconciliationNotes: string[];
  /** Number of conflicts detected */
  conflictsDetected: number;
  /** Time taken for reconciliation in ms */
  reconciliationTimeMs: number;
}

// =============================================================================
// Reconciliation Rules
// =============================================================================

/**
 * Rule 1: ICP Invalid Override
 * If ICP is invalid but Offer recommends proceeding, downgrade to icp_refinement_needed
 */
function applyRule1_ICPInvalidOverride(
  icp: ICPAnalysisValidation,
  offer: OfferAnalysisViability,
  adjustments: ReconciliationAdjustment[],
  notes: string[]
): OfferAnalysisViability {
  if (
    icp.finalVerdict.status === 'invalid' &&
    offer.recommendation.status === 'proceed'
  ) {
    adjustments.push({
      field: 'recommendation.status',
      originalValue: offer.recommendation.status,
      adjustedValue: 'icp_refinement_needed',
      rule: 'Rule1_ICPInvalidOverride',
      reason: 'Cannot proceed with ads when ICP is invalid',
    });
    notes.push(
      `Downgraded recommendation from "proceed" to "icp_refinement_needed" because ICP validation status is "invalid".`
    );
    return {
      ...offer,
      recommendation: {
        ...offer.recommendation,
        status: 'icp_refinement_needed',
        reasoning: `${offer.recommendation.reasoning} [Reconciliation: ICP is invalid - must refine target audience before running ads.]`,
      },
    };
  }
  return offer;
}

/**
 * Rule 2: Budget Risk Alignment
 * If ICP budget risk is critical and Offer pricing score > 6, lower pricing score
 */
function applyRule2_BudgetRiskAlignment(
  icp: ICPAnalysisValidation,
  offer: OfferAnalysisViability,
  adjustments: ReconciliationAdjustment[],
  notes: string[]
): OfferAnalysisViability {
  if (
    icp.riskAssessment.budget === 'critical' &&
    offer.offerStrength.pricingLogic > 6
  ) {
    const newPricingLogic = Math.min(10, Math.max(4, offer.offerStrength.pricingLogic - 2));
    const newOverall = calculateNewOverall(offer.offerStrength, 'pricingLogic', newPricingLogic);

    adjustments.push({
      field: 'offerStrength.pricingLogic',
      originalValue: offer.offerStrength.pricingLogic,
      adjustedValue: newPricingLogic,
      rule: 'Rule2_BudgetRiskAlignment',
      reason: 'ICP budget risk is critical - pricing logic cannot be high',
    });
    notes.push(
      `Lowered pricing logic score from ${offer.offerStrength.pricingLogic} to ${newPricingLogic} because ICP budget risk is "critical".`
    );
    return {
      ...offer,
      offerStrength: {
        ...offer.offerStrength,
        pricingLogic: newPricingLogic,
        overallScore: newOverall,
      },
      redFlags: offer.redFlags.includes('price_mismatch')
        ? offer.redFlags
        : [...offer.redFlags, 'price_mismatch'],
    };
  }
  return offer;
}

/**
 * Rule 3: Reachability Critical Override
 * If ICP reachability is critical, force icp_refinement_needed
 */
function applyRule3_ReachabilityCriticalOverride(
  icp: ICPAnalysisValidation,
  offer: OfferAnalysisViability,
  adjustments: ReconciliationAdjustment[],
  notes: string[]
): OfferAnalysisViability {
  if (
    icp.riskAssessment.reachability === 'critical' &&
    offer.recommendation.status !== 'icp_refinement_needed' &&
    offer.recommendation.status !== 'major_offer_rebuild'
  ) {
    adjustments.push({
      field: 'recommendation.status',
      originalValue: offer.recommendation.status,
      adjustedValue: 'icp_refinement_needed',
      rule: 'Rule3_ReachabilityCriticalOverride',
      reason: 'ICP is unreachable through paid channels',
    });
    notes.push(
      `Changed recommendation to "icp_refinement_needed" because ICP reachability risk is "critical" - audience cannot be effectively targeted.`
    );
    return {
      ...offer,
      recommendation: {
        ...offer.recommendation,
        status: 'icp_refinement_needed',
        reasoning: `${offer.recommendation.reasoning} [Reconciliation: ICP reachability is critical - cannot target this audience effectively.]`,
      },
    };
  }
  return offer;
}

/**
 * Rule 4: Pain Strength vs Urgency Alignment
 * If ICP pain strength is critical (nice-to-have) and Offer urgency > 7, cap urgency
 */
function applyRule4_PainStrengthUrgencyAlignment(
  icp: ICPAnalysisValidation,
  offer: OfferAnalysisViability,
  adjustments: ReconciliationAdjustment[],
  notes: string[]
): OfferAnalysisViability {
  if (
    icp.riskAssessment.painStrength === 'critical' &&
    offer.offerStrength.urgency > 7
  ) {
    const newUrgency = 6;
    const newOverall = calculateNewOverall(offer.offerStrength, 'urgency', newUrgency);

    adjustments.push({
      field: 'offerStrength.urgency',
      originalValue: offer.offerStrength.urgency,
      adjustedValue: newUrgency,
      rule: 'Rule4_PainStrengthUrgencyAlignment',
      reason: 'ICP pain is nice-to-have (critical risk) - urgency cannot be high',
    });
    notes.push(
      `Capped urgency score from ${offer.offerStrength.urgency} to ${newUrgency} because ICP pain strength risk is "critical" (pain is nice-to-have, not must-have).`
    );
    return {
      ...offer,
      offerStrength: {
        ...offer.offerStrength,
        urgency: newUrgency,
        overallScore: newOverall,
      },
    };
  }
  return offer;
}

/**
 * Rule 5: Fit Assessment vs Pain Relevance
 * If ICP fit is weak and Offer pain relevance > 7, lower pain relevance
 */
function applyRule5_FitAssessmentPainRelevance(
  icp: ICPAnalysisValidation,
  offer: OfferAnalysisViability,
  adjustments: ReconciliationAdjustment[],
  notes: string[]
): OfferAnalysisViability {
  if (
    icp.painSolutionFit.fitAssessment === 'weak' &&
    offer.offerStrength.painRelevance > 7
  ) {
    const newPainRelevance = 5;
    const newOverall = calculateNewOverall(offer.offerStrength, 'painRelevance', newPainRelevance);

    adjustments.push({
      field: 'offerStrength.painRelevance',
      originalValue: offer.offerStrength.painRelevance,
      adjustedValue: newPainRelevance,
      rule: 'Rule5_FitAssessmentPainRelevance',
      reason: 'ICP pain-solution fit is weak - pain relevance score is inflated',
    });
    notes.push(
      `Lowered pain relevance score from ${offer.offerStrength.painRelevance} to ${newPainRelevance} because ICP pain-solution fit is "weak".`
    );
    return {
      ...offer,
      offerStrength: {
        ...offer.offerStrength,
        painRelevance: newPainRelevance,
        overallScore: newOverall,
      },
    };
  }
  return offer;
}

/**
 * Rule 6: Validated but Critical Competition Contradiction
 * If ICP is validated but competitiveness is critical, flag the contradiction
 */
function applyRule6_ValidatedCriticalCompetition(
  icp: ICPAnalysisValidation,
  offer: OfferAnalysisViability,
  adjustments: ReconciliationAdjustment[],
  notes: string[]
): OfferAnalysisViability {
  if (
    icp.finalVerdict.status === 'validated' &&
    icp.riskAssessment.competitiveness === 'critical'
  ) {
    // Don't change values, just flag the contradiction
    adjustments.push({
      field: 'metadata.contradiction',
      originalValue: 'none',
      adjustedValue: 'icp_validated_but_competition_critical',
      rule: 'Rule6_ValidatedCriticalCompetition',
      reason: 'Internal contradiction: ICP validated despite critical competition risk',
    });
    notes.push(
      `Warning: ICP is marked as "validated" but competitiveness risk is "critical". This is a potential contradiction - verify the ICP validation is accurate given the competitive landscape.`
    );

    // Add overcrowded_market flag if not present
    if (!offer.redFlags.includes('overcrowded_market')) {
      return {
        ...offer,
        redFlags: [...offer.redFlags, 'overcrowded_market'],
      };
    }
  }
  return offer;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Recalculate overall score when one dimension changes
 */
function calculateNewOverall(
  strength: OfferAnalysisViability['offerStrength'],
  changedField: keyof Omit<OfferAnalysisViability['offerStrength'], 'overallScore'>,
  newValue: number
): number {
  const scores = {
    painRelevance: strength.painRelevance,
    urgency: strength.urgency,
    differentiation: strength.differentiation,
    tangibility: strength.tangibility,
    proof: strength.proof,
    pricingLogic: strength.pricingLogic,
  };
  scores[changedField] = newValue;

  const sum = Object.values(scores).reduce((a, b) => a + b, 0);
  return Math.round((sum / 6) * 10) / 10; // Round to 1 decimal
}

// =============================================================================
// Main Reconciliation Function
// =============================================================================

/**
 * Reconcile ICP and Offer analysis results after parallel execution.
 * Applies 6 deterministic rules to catch logical inconsistencies.
 *
 * @param icpResult - ICP Analysis result
 * @param offerResult - Offer Analysis result
 * @returns Reconciled offer with adjustments documented
 */
export function reconcileICPAndOffer(
  icpResult: ICPAnalysisValidation,
  offerResult: OfferAnalysisViability
): ReconciliationResult {
  const startTime = Date.now();
  const adjustments: ReconciliationAdjustment[] = [];
  const notes: string[] = [];

  // Apply rules in sequence (each may modify the offer)
  let offer = offerResult;

  offer = applyRule1_ICPInvalidOverride(icpResult, offer, adjustments, notes);
  offer = applyRule2_BudgetRiskAlignment(icpResult, offer, adjustments, notes);
  offer = applyRule3_ReachabilityCriticalOverride(icpResult, offer, adjustments, notes);
  offer = applyRule4_PainStrengthUrgencyAlignment(icpResult, offer, adjustments, notes);
  offer = applyRule5_FitAssessmentPainRelevance(icpResult, offer, adjustments, notes);
  offer = applyRule6_ValidatedCriticalCompetition(icpResult, offer, adjustments, notes);

  const reconciliationTimeMs = Date.now() - startTime;

  if (adjustments.length > 0) {
    console.log(`[Reconciliation] Applied ${adjustments.length} adjustments in ${reconciliationTimeMs}ms`);
    adjustments.forEach(adj => {
      console.log(`[Reconciliation] - ${adj.rule}: ${adj.field} ${adj.originalValue} → ${adj.adjustedValue}`);
    });
  } else {
    console.log(`[Reconciliation] No conflicts detected (${reconciliationTimeMs}ms)`);
  }

  return {
    adjustedOffer: offer,
    adjustments,
    reconciliationNotes: notes,
    conflictsDetected: adjustments.length,
    reconciliationTimeMs,
  };
}
