"use client";

import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { Download, Loader2, Clock, Coins, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { DocumentEditor } from "@/components/editor/document-editor";
import { highlightLine } from "@/lib/syntax";
import { generateBlueprintMarkdown } from "@/lib/strategic-blueprint/markdown-generator";
import PdfMarkdownContent from "./pdf-markdown-content";
import type {
  StrategicBlueprintOutput,
  IndustryMarketOverview,
  ICPAnalysisValidation,
  OfferAnalysisViability,
  CompetitorAnalysis,
  CrossAnalysisSynthesis,
} from "@/lib/strategic-blueprint/output-types";

interface BlueprintViewerProps {
  strategicBlueprint: StrategicBlueprintOutput;
  isStreaming?: boolean;
}

// =============================================================================
// Text Formatting Utilities
// =============================================================================

const DIVIDER_DOUBLE = "═".repeat(60);
const DIVIDER_SINGLE = "─".repeat(60);

/**
 * Safely extracts a string value from unknown data
 */
function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * Safely extracts an array of strings from unknown data
 */
function safeArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        // Handle objects with common string fields
        const obj = item as Record<string, unknown>;
        return safeString(obj.name || obj.title || obj.value || obj.text || "");
      }
      return String(item);
    });
  }
  return [];
}

/**
 * Format a boolean as Yes/No
 */
function formatBool(value: unknown): string {
  return value ? "Yes" : "No";
}

// =============================================================================
// Section Formatters
// =============================================================================

function formatIndustryMarketOverview(section: IndustryMarketOverview): string[] {
  const lines: string[] = [];

  lines.push(DIVIDER_DOUBLE);
  lines.push("SECTION 1: INDUSTRY & MARKET OVERVIEW");
  lines.push(DIVIDER_DOUBLE);
  lines.push("");

  // Category Snapshot
  lines.push(DIVIDER_SINGLE);
  lines.push("CATEGORY SNAPSHOT");
  lines.push(DIVIDER_SINGLE);
  if (section.categorySnapshot) {
    lines.push(`Category:         ${safeString(section.categorySnapshot.category)}`);
    lines.push(`Market Maturity:  ${safeString(section.categorySnapshot.marketMaturity)}`);
    lines.push(`Awareness Level:  ${safeString(section.categorySnapshot.awarenessLevel)}`);
    lines.push(`Buying Behavior:  ${safeString(section.categorySnapshot.buyingBehavior)?.replace("_", " ")}`);
    lines.push(`Sales Cycle:      ${safeString(section.categorySnapshot.averageSalesCycle)}`);
    lines.push(`Seasonality:      ${safeString(section.categorySnapshot.seasonality)}`);
  }
  lines.push("");

  // Market Dynamics
  lines.push(DIVIDER_SINGLE);
  lines.push("MARKET DYNAMICS");
  lines.push(DIVIDER_SINGLE);
  if (section.marketDynamics) {
    lines.push("");
    lines.push("Demand Drivers:");
    for (const item of safeArray(section.marketDynamics.demandDrivers)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push("Buying Triggers:");
    for (const item of safeArray(section.marketDynamics.buyingTriggers)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push("Barriers to Purchase:");
    for (const item of safeArray(section.marketDynamics.barriersToPurchase)) {
      lines.push(`  • ${item}`);
    }
  }
  lines.push("");

  // Pain Points
  lines.push(DIVIDER_SINGLE);
  lines.push("PAIN POINTS");
  lines.push(DIVIDER_SINGLE);
  if (section.painPoints) {
    lines.push("");
    lines.push("Primary Pain Points:");
    for (const item of safeArray(section.painPoints.primary)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push("Secondary Pain Points:");
    for (const item of safeArray(section.painPoints.secondary)) {
      lines.push(`  • ${item}`);
    }
  }
  lines.push("");

  // Psychological Drivers
  lines.push(DIVIDER_SINGLE);
  lines.push("PSYCHOLOGICAL DRIVERS");
  lines.push(DIVIDER_SINGLE);
  if (section.psychologicalDrivers?.drivers) {
    for (const driver of section.psychologicalDrivers.drivers) {
      lines.push(`  • ${safeString(driver?.driver)}`);
      if (driver?.description) {
        lines.push(`    ${safeString(driver.description)}`);
      }
    }
  }
  lines.push("");

  // Audience Objections
  lines.push(DIVIDER_SINGLE);
  lines.push("AUDIENCE OBJECTIONS");
  lines.push(DIVIDER_SINGLE);
  if (section.audienceObjections?.objections) {
    for (let i = 0; i < section.audienceObjections.objections.length; i++) {
      const obj = section.audienceObjections.objections[i];
      lines.push(`  ${i + 1}. "${safeString(obj?.objection)}"`);
      if (obj?.howToAddress) {
        lines.push(`     Response: ${safeString(obj.howToAddress)}`);
      }
    }
  }
  lines.push("");

  // Messaging Opportunities
  lines.push(DIVIDER_SINGLE);
  lines.push("MESSAGING OPPORTUNITIES");
  lines.push(DIVIDER_SINGLE);
  if (section.messagingOpportunities) {
    lines.push("");
    lines.push("Opportunities:");
    for (const item of safeArray(section.messagingOpportunities.opportunities)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push("Summary Recommendations:");
    for (const item of safeArray(section.messagingOpportunities.summaryRecommendations)) {
      lines.push(`  • ${item}`);
    }
  }
  lines.push("");

  return lines;
}

function formatIcpAnalysis(section: ICPAnalysisValidation): string[] {
  const lines: string[] = [];

  lines.push(DIVIDER_DOUBLE);
  lines.push("SECTION 2: ICP ANALYSIS & VALIDATION");
  lines.push(DIVIDER_DOUBLE);
  lines.push("");

  // Final Verdict
  lines.push(DIVIDER_SINGLE);
  lines.push("FINAL VERDICT");
  lines.push(DIVIDER_SINGLE);
  if (section.finalVerdict) {
    lines.push(`Status:    ${safeString(section.finalVerdict.status)?.toUpperCase()}`);
    lines.push(`Reasoning: ${safeString(section.finalVerdict.reasoning)}`);
    if (section.finalVerdict.recommendations?.length) {
      lines.push("");
      lines.push("Recommendations:");
      for (const item of section.finalVerdict.recommendations) {
        lines.push(`  • ${item}`);
      }
    }
  }
  lines.push("");

  // Coherence Check
  lines.push(DIVIDER_SINGLE);
  lines.push("ICP COHERENCE CHECK");
  lines.push(DIVIDER_SINGLE);
  if (section.coherenceCheck) {
    lines.push(`Clearly Defined:           ${formatBool(section.coherenceCheck.clearlyDefined)}`);
    lines.push(`Reachable via Paid:        ${formatBool(section.coherenceCheck.reachableThroughPaidChannels)}`);
    lines.push(`Adequate Scale:            ${formatBool(section.coherenceCheck.adequateScale)}`);
    lines.push(`Has Pain Offer Solves:     ${formatBool(section.coherenceCheck.hasPainOfferSolves)}`);
    lines.push(`Has Budget & Authority:    ${formatBool(section.coherenceCheck.hasBudgetAndAuthority)}`);
  }
  lines.push("");

  // Pain-Solution Fit
  lines.push(DIVIDER_SINGLE);
  lines.push("PAIN-SOLUTION FIT");
  lines.push(DIVIDER_SINGLE);
  if (section.painSolutionFit) {
    lines.push(`Primary Pain:      ${safeString(section.painSolutionFit.primaryPain)}`);
    lines.push(`Offer Component:   ${safeString(section.painSolutionFit.offerComponentSolvingIt)}`);
    lines.push(`Fit Assessment:    ${safeString(section.painSolutionFit.fitAssessment)?.toUpperCase()}`);
    if (section.painSolutionFit.notes) {
      lines.push(`Notes:             ${safeString(section.painSolutionFit.notes)}`);
    }
  }
  lines.push("");

  // Market Reachability
  lines.push(DIVIDER_SINGLE);
  lines.push("MARKET REACHABILITY");
  lines.push(DIVIDER_SINGLE);
  if (section.marketReachability) {
    lines.push(`Meta Volume:           ${formatBool(section.marketReachability.metaVolume)}`);
    lines.push(`LinkedIn Volume:       ${formatBool(section.marketReachability.linkedInVolume)}`);
    lines.push(`Google Search Demand:  ${formatBool(section.marketReachability.googleSearchDemand)}`);
    if (section.marketReachability.contradictingSignals?.length) {
      lines.push("");
      lines.push("Contradicting Signals:");
      for (const signal of section.marketReachability.contradictingSignals) {
        lines.push(`  • ${signal}`);
      }
    }
  }
  lines.push("");

  // Risk Assessment
  lines.push(DIVIDER_SINGLE);
  lines.push("RISK ASSESSMENT");
  lines.push(DIVIDER_SINGLE);
  if (section.riskAssessment) {
    lines.push(`Reachability:      ${safeString(section.riskAssessment.reachability)?.toUpperCase()}`);
    lines.push(`Budget:            ${safeString(section.riskAssessment.budget)?.toUpperCase()}`);
    lines.push(`Pain Strength:     ${safeString(section.riskAssessment.painStrength)?.toUpperCase()}`);
    lines.push(`Competitiveness:   ${safeString(section.riskAssessment.competitiveness)?.toUpperCase()}`);
  }
  lines.push("");

  return lines;
}

function formatOfferAnalysis(section: OfferAnalysisViability): string[] {
  const lines: string[] = [];

  lines.push(DIVIDER_DOUBLE);
  lines.push("SECTION 3: OFFER ANALYSIS & VIABILITY");
  lines.push(DIVIDER_DOUBLE);
  lines.push("");

  // Recommendation
  lines.push(DIVIDER_SINGLE);
  lines.push("RECOMMENDATION");
  lines.push(DIVIDER_SINGLE);
  if (section.recommendation) {
    lines.push(`Status:    ${safeString(section.recommendation.status)?.replace(/_/g, " ").toUpperCase()}`);
    lines.push(`Reasoning: ${safeString(section.recommendation.reasoning)}`);
    if (section.recommendation.actionItems?.length) {
      lines.push("");
      lines.push("Action Items:");
      for (const item of section.recommendation.actionItems) {
        lines.push(`  • ${item}`);
      }
    }
  }
  lines.push("");

  // Offer Clarity
  lines.push(DIVIDER_SINGLE);
  lines.push("OFFER CLARITY");
  lines.push(DIVIDER_SINGLE);
  if (section.offerClarity) {
    lines.push(`Clearly Articulated:        ${formatBool(section.offerClarity.clearlyArticulated)}`);
    lines.push(`Solves Real Pain:           ${formatBool(section.offerClarity.solvesRealPain)}`);
    lines.push(`Benefits Easy to Understand: ${formatBool(section.offerClarity.benefitsEasyToUnderstand)}`);
    lines.push(`Transformation Measurable:   ${formatBool(section.offerClarity.transformationMeasurable)}`);
    lines.push(`Value Prop Obvious (3s):     ${formatBool(section.offerClarity.valuePropositionObvious)}`);
  }
  lines.push("");

  // Offer Strength Scores
  lines.push(DIVIDER_SINGLE);
  lines.push("OFFER STRENGTH SCORES");
  lines.push(DIVIDER_SINGLE);
  if (section.offerStrength) {
    lines.push(`Pain Relevance:    ${section.offerStrength.painRelevance}/10`);
    lines.push(`Urgency:           ${section.offerStrength.urgency}/10`);
    lines.push(`Differentiation:   ${section.offerStrength.differentiation}/10`);
    lines.push(`Tangibility:       ${section.offerStrength.tangibility}/10`);
    lines.push(`Proof:             ${section.offerStrength.proof}/10`);
    lines.push(`Pricing Logic:     ${section.offerStrength.pricingLogic}/10`);
    lines.push("");
    lines.push(`OVERALL SCORE:     ${section.offerStrength.overallScore?.toFixed(1)}/10`);
  }
  lines.push("");

  // Market-Offer Fit
  lines.push(DIVIDER_SINGLE);
  lines.push("MARKET-OFFER FIT");
  lines.push(DIVIDER_SINGLE);
  if (section.marketOfferFit) {
    lines.push(`Market Wants Now:           ${formatBool(section.marketOfferFit.marketWantsNow)}`);
    lines.push(`Competitors Offer Similar:  ${formatBool(section.marketOfferFit.competitorsOfferSimilar)}`);
    lines.push(`Price Matches Expectations: ${formatBool(section.marketOfferFit.priceMatchesExpectations)}`);
    lines.push(`Proof Strong for Cold:      ${formatBool(section.marketOfferFit.proofStrongForColdTraffic)}`);
    lines.push(`Transformation Believable:  ${formatBool(section.marketOfferFit.transformationBelievable)}`);
  }
  lines.push("");

  // Red Flags
  if (section.redFlags?.length) {
    lines.push(DIVIDER_SINGLE);
    lines.push("RED FLAGS");
    lines.push(DIVIDER_SINGLE);
    for (const flag of section.redFlags) {
      lines.push(`  • ${safeString(flag).replace(/_/g, " ")}`);
    }
    lines.push("");
  }

  return lines;
}

function formatCompetitorAnalysis(section: CompetitorAnalysis): string[] {
  const lines: string[] = [];

  lines.push(DIVIDER_DOUBLE);
  lines.push("SECTION 4: COMPETITOR ANALYSIS");
  lines.push(DIVIDER_DOUBLE);
  lines.push("");

  // Competitor Snapshots
  lines.push(DIVIDER_SINGLE);
  lines.push("COMPETITOR SNAPSHOTS");
  lines.push(DIVIDER_SINGLE);
  if (section.competitors) {
    for (let i = 0; i < section.competitors.length; i++) {
      const comp = section.competitors[i];
      lines.push("");
      lines.push(`${i + 1}. ${safeString(comp?.name)}`);
      lines.push(`   Positioning: ${safeString(comp?.positioning)}`);
      lines.push(`   Offer: ${safeString(comp?.offer)}`);
      lines.push(`   Price: ${safeString(comp?.price)}`);
      lines.push(`   Funnels: ${safeString(comp?.funnels)}`);
      lines.push(`   Platforms: ${safeArray(comp?.adPlatforms).join(", ")}`);
      if (comp?.strengths?.length) {
        lines.push("   Strengths:");
        for (const s of comp.strengths) {
          lines.push(`     + ${s}`);
        }
      }
      if (comp?.weaknesses?.length) {
        lines.push("   Weaknesses:");
        for (const w of comp.weaknesses) {
          lines.push(`     - ${w}`);
        }
      }
    }
  }
  lines.push("");

  // Creative Library
  lines.push(DIVIDER_SINGLE);
  lines.push("CREATIVE LIBRARY");
  lines.push(DIVIDER_SINGLE);
  if (section.creativeLibrary) {
    lines.push("");
    lines.push("Ad Hooks:");
    for (const hook of safeArray(section.creativeLibrary.adHooks)) {
      lines.push(`  • "${hook}"`);
    }
    lines.push("");
    lines.push("Creative Formats:");
    if (section.creativeLibrary.creativeFormats) {
      const formats = section.creativeLibrary.creativeFormats;
      lines.push(`  UGC:          ${formatBool(formats.ugc)}`);
      lines.push(`  Carousels:    ${formatBool(formats.carousels)}`);
      lines.push(`  Statics:      ${formatBool(formats.statics)}`);
      lines.push(`  Testimonial:  ${formatBool(formats.testimonial)}`);
      lines.push(`  Product Demo: ${formatBool(formats.productDemo)}`);
    }
  }
  lines.push("");

  // Funnel Breakdown
  lines.push(DIVIDER_SINGLE);
  lines.push("FUNNEL BREAKDOWN");
  lines.push(DIVIDER_SINGLE);
  if (section.funnelBreakdown) {
    lines.push("");
    lines.push("Landing Page Patterns:");
    for (const item of safeArray(section.funnelBreakdown.landingPagePatterns)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push("Headline Structure:");
    for (const item of safeArray(section.funnelBreakdown.headlineStructure)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push("CTA Hierarchy:");
    for (const item of safeArray(section.funnelBreakdown.ctaHierarchy)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push(`Form Friction: ${safeString(section.funnelBreakdown.formFriction)?.toUpperCase()}`);
  }
  lines.push("");

  // Market Strengths & Weaknesses
  lines.push(DIVIDER_SINGLE);
  lines.push("MARKET STRENGTHS & WEAKNESSES");
  lines.push(DIVIDER_SINGLE);
  lines.push("");
  lines.push("Market Strengths:");
  for (const item of safeArray(section.marketStrengths)) {
    lines.push(`  + ${item}`);
  }
  lines.push("");
  lines.push("Market Weaknesses:");
  for (const item of safeArray(section.marketWeaknesses)) {
    lines.push(`  - ${item}`);
  }
  lines.push("");

  // Gaps & Opportunities
  lines.push(DIVIDER_SINGLE);
  lines.push("GAPS & OPPORTUNITIES");
  lines.push(DIVIDER_SINGLE);
  if (section.gapsAndOpportunities) {
    lines.push("");
    lines.push("Messaging Opportunities:");
    for (const item of safeArray(section.gapsAndOpportunities.messagingOpportunities)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push("Creative Opportunities:");
    for (const item of safeArray(section.gapsAndOpportunities.creativeOpportunities)) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
    lines.push("Funnel Opportunities:");
    for (const item of safeArray(section.gapsAndOpportunities.funnelOpportunities)) {
      lines.push(`  • ${item}`);
    }
  }
  lines.push("");

  return lines;
}

function formatCrossAnalysis(section: CrossAnalysisSynthesis): string[] {
  const lines: string[] = [];

  lines.push(DIVIDER_DOUBLE);
  lines.push("SECTION 5: CROSS-ANALYSIS SYNTHESIS");
  lines.push(DIVIDER_DOUBLE);
  lines.push("");

  // Key Insights
  lines.push(DIVIDER_SINGLE);
  lines.push("KEY STRATEGIC INSIGHTS");
  lines.push(DIVIDER_SINGLE);
  if (section.keyInsights) {
    for (let i = 0; i < section.keyInsights.length; i++) {
      const insight = section.keyInsights[i];
      lines.push("");
      lines.push(`${i + 1}. ${safeString(insight?.insight)}`);
      lines.push(`   Priority: ${safeString(insight?.priority)?.toUpperCase()}`);
      lines.push(`   Implication: ${safeString(insight?.implication)}`);
    }
  }
  lines.push("");

  // Recommended Positioning
  lines.push(DIVIDER_SINGLE);
  lines.push("RECOMMENDED POSITIONING");
  lines.push(DIVIDER_SINGLE);
  lines.push(safeString(section.recommendedPositioning));
  lines.push("");

  // Primary Messaging Angles
  lines.push(DIVIDER_SINGLE);
  lines.push("PRIMARY MESSAGING ANGLES");
  lines.push(DIVIDER_SINGLE);
  for (const angle of safeArray(section.primaryMessagingAngles)) {
    lines.push(`  • ${angle}`);
  }
  lines.push("");

  // Recommended Platforms
  lines.push(DIVIDER_SINGLE);
  lines.push("RECOMMENDED PLATFORMS");
  lines.push(DIVIDER_SINGLE);
  if (section.recommendedPlatforms) {
    for (const plat of section.recommendedPlatforms) {
      lines.push("");
      lines.push(`${safeString(plat?.platform)} [${safeString(plat?.priority)?.toUpperCase()}]`);
      lines.push(`  ${safeString(plat?.reasoning)}`);
    }
  }
  lines.push("");

  // Critical Success Factors
  lines.push(DIVIDER_SINGLE);
  lines.push("CRITICAL SUCCESS FACTORS");
  lines.push(DIVIDER_SINGLE);
  for (const item of safeArray(section.criticalSuccessFactors)) {
    lines.push(`  • ${item}`);
  }
  lines.push("");

  // Potential Blockers
  if (section.potentialBlockers?.length) {
    lines.push(DIVIDER_SINGLE);
    lines.push("POTENTIAL BLOCKERS");
    lines.push(DIVIDER_SINGLE);
    for (const item of section.potentialBlockers) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
  }

  // Next Steps
  lines.push(DIVIDER_SINGLE);
  lines.push("RECOMMENDED NEXT STEPS");
  lines.push(DIVIDER_SINGLE);
  const nextSteps = safeArray(section.nextSteps);
  for (let i = 0; i < nextSteps.length; i++) {
    lines.push(`  ${i + 1}. ${nextSteps[i]}`);
  }
  lines.push("");

  return lines;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * BlueprintViewer - Displays strategic blueprint in a premium document editor format
 *
 * Converts structured blueprint data to formatted text and displays it in the
 * DocumentEditor component with syntax highlighting.
 */
export function BlueprintViewer({ strategicBlueprint, isStreaming = false }: BlueprintViewerProps) {
  const {
    industryMarketOverview,
    icpAnalysisValidation,
    offerAnalysisViability,
    competitorAnalysis,
    crossAnalysisSynthesis,
    metadata,
  } = strategicBlueprint;

  const [isExporting, setIsExporting] = useState(false);

  // Format all sections into text content
  const formatContent = useCallback((): string => {
    const lines: string[] = [];

    // Header
    lines.push(DIVIDER_DOUBLE);
    lines.push("STRATEGIC BLUEPRINT");
    lines.push(DIVIDER_DOUBLE);
    lines.push("");
    lines.push(`Generated: ${new Date(metadata.generatedAt).toLocaleString()}`);
    lines.push(`Version: ${metadata.version}`);
    lines.push(`Confidence: ${metadata.overallConfidence}%`);
    lines.push("");

    // Add each section
    if (industryMarketOverview) {
      lines.push(...formatIndustryMarketOverview(industryMarketOverview));
    }
    if (icpAnalysisValidation) {
      lines.push(...formatIcpAnalysis(icpAnalysisValidation));
    }
    if (offerAnalysisViability) {
      lines.push(...formatOfferAnalysis(offerAnalysisViability));
    }
    if (competitorAnalysis) {
      lines.push(...formatCompetitorAnalysis(competitorAnalysis));
    }
    if (crossAnalysisSynthesis) {
      lines.push(...formatCrossAnalysis(crossAnalysisSynthesis));
    }

    // Footer
    lines.push(DIVIDER_DOUBLE);
    lines.push(`Strategic Blueprint v${metadata.version}`);
    lines.push(`Generated on ${new Date(metadata.generatedAt).toLocaleDateString()}`);
    lines.push(DIVIDER_DOUBLE);

    return lines.join("\n");
  }, [
    industryMarketOverview,
    icpAnalysisValidation,
    offerAnalysisViability,
    competitorAnalysis,
    crossAnalysisSynthesis,
    metadata,
  ]);

  // PDF Export handler
  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);

    try {
      const [html2canvasModule, jspdfModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jspdfModule;

      const date = new Date().toISOString().split("T")[0];
      const filename = `Strategic-Blueprint-${date}.pdf`;

      // Create a temporary container for the PDF content
      const container = document.createElement("div");
      container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 850px;
        background: #ffffff;
      `;
      document.body.appendChild(container);

      // Render the PdfMarkdownContent component into the container
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(<PdfMarkdownContent strategicBlueprint={strategicBlueprint} />);
        setTimeout(resolve, 300);
      });

      const content = container.firstElementChild as HTMLElement;
      if (!content) {
        throw new Error("Failed to render PDF content");
      }

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      root.unmount();
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      let pageNumber = 0;

      while (heightLeft > 0) {
        if (pageNumber > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position -= pageHeight;
        pageNumber++;
      }

      pdf.save(filename);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert(`PDF export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  }, [strategicBlueprint]);

  const content = formatContent();

  return (
    <div className="w-full space-y-6">
      {/* Header with metadata and export */}
      <GradientBorder>
        <div
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6"
        >
          <div>
            <h1
              className="text-2xl font-bold"
              style={{
                color: 'var(--text-heading)',
                fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              Strategic Blueprint
            </h1>
            <div
              className="flex flex-wrap gap-4 text-sm mt-2"
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans), Inter, sans-serif',
              }}
            >
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                Generated: {new Date(metadata.generatedAt).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Coins className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                ${metadata.totalCost.toFixed(4)}
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                Confidence: {metadata.overallConfidence}%
              </span>
            </div>
          </div>
          <Button
            onClick={handleExportPDF}
            disabled={isExporting}
            variant="outline"
            className="rounded-md"
            style={{
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              background: 'transparent',
              fontFamily: 'var(--font-sans), Inter, sans-serif',
            }}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </>
            )}
          </Button>
        </div>
      </GradientBorder>

      {/* Document Editor Display with GradientBorder */}
      <GradientBorder animate={isStreaming}>
        <DocumentEditor
          content={content}
          filename="strategic-blueprint.md"
          isStreaming={isStreaming}
          highlightLine={highlightLine}
        />
      </GradientBorder>
    </div>
  );
}
