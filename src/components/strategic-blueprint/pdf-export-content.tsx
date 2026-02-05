"use client";

import { forwardRef } from "react";
import type {
  StrategicBlueprintOutput,
  ValidationStatus,
  RiskRating,
  OfferRecommendation,
} from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Simple text icons (no SVG, no emoji - clean and professional)
// =============================================================================

const icons = {
  trendingUp: "",
  users: "",
  package: "",
  swords: "",
  lightbulb: "",
  check: "✓",
  alertTriangle: "!",
  checkCircle: "✓",
  xCircle: "✗",
  brain: "",
  messageSquare: "",
  target: "",
  shield: "",
};

// =============================================================================
// Print-Friendly Color Definitions (inline styles for html2canvas compatibility)
// =============================================================================

const printColors = {
  // Status colors
  validated: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  workable: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  invalid: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },

  // Risk colors
  low: { bg: "#dcfce7", text: "#166534" },
  medium: { bg: "#fef9c3", text: "#854d0e" },
  high: { bg: "#fed7aa", text: "#9a3412" },
  critical: { bg: "#fee2e2", text: "#991b1b" },

  // Offer recommendation colors
  proceed: { bg: "#dcfce7", text: "#166534" },
  adjust_messaging: { bg: "#fef9c3", text: "#854d0e" },
  adjust_pricing: { bg: "#fef9c3", text: "#854d0e" },
  icp_refinement_needed: { bg: "#fed7aa", text: "#9a3412" },
  major_offer_rebuild: { bg: "#fee2e2", text: "#991b1b" },

  // UI colors
  primary: "#3b82f6",
  primaryLight: "#dbeafe",
  muted: "#f3f4f6",
  mutedText: "#6b7280",
  text: "#1f2937",
  green: "#16a34a",
  red: "#dc2626",
  orange: "#ea580c",
  blue: "#2563eb",
  purple: "#9333ea",
};

// =============================================================================
// Helper Functions
// =============================================================================

function safeRender(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(safeRender).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const values = Object.values(obj).filter((v) => v !== null && v !== undefined);
    if (values.length === 0) return "";
    return values.map(safeRender).join(", ");
  }
  return String(value);
}

function safeArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(safeRender);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["items", "values", "list"]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(safeRender);
    }
    return Object.values(obj)
      .filter((v) => v !== null && v !== undefined)
      .map(safeRender);
  }
  return [safeRender(value)];
}

// =============================================================================
// Print-Friendly Components
// =============================================================================

const styles = {
  container: {
    width: "794px", // A4 width at 96 DPI
    backgroundColor: "#ffffff",
    color: printColors.text,
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "40px",
    boxSizing: "border-box" as const,
  },
  header: {
    backgroundColor: printColors.primary,
    color: "#ffffff",
    padding: "24px 32px",
    marginBottom: "32px",
    borderRadius: "8px",
  },
  headerTitle: {
    fontSize: "28px",
    fontWeight: "bold",
    margin: "0 0 8px 0",
  },
  headerMeta: {
    fontSize: "14px",
    opacity: 0.9,
  },
  section: {
    marginBottom: "32px",
    pageBreakInside: "avoid" as const,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
    paddingBottom: "12px",
    borderBottom: `2px solid ${printColors.primaryLight}`,
  },
  sectionNumber: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: printColors.primary,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "16px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: printColors.text,
  },
  subSection: {
    marginBottom: "20px",
  },
  subSectionTitle: {
    fontSize: "12px",
    fontWeight: "600",
    color: printColors.mutedText,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    borderLeft: `4px solid ${printColors.primary}`,
    paddingLeft: "12px",
    marginBottom: "12px",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },
  card: {
    backgroundColor: printColors.muted,
    padding: "12px",
    borderRadius: "8px",
  },
  cardLabel: {
    fontSize: "10px",
    color: printColors.mutedText,
    textTransform: "uppercase" as const,
    marginBottom: "4px",
  },
  cardValue: {
    fontSize: "14px",
    fontWeight: "500",
  },
  badge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "500",
  },
  listItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "6px",
    fontSize: "14px",
  },
  statusBanner: {
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    border: "1px solid",
  },
  progressBar: {
    height: "8px",
    backgroundColor: "#e5e7eb",
    borderRadius: "4px",
    overflow: "hidden",
    marginTop: "4px",
  },
  progressFill: {
    height: "100%",
    borderRadius: "4px",
  },
};

function Badge({ children, variant }: { children: React.ReactNode; variant: ValidationStatus | RiskRating | OfferRecommendation | "outline" | "secondary" | "destructive" }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    validated: printColors.validated,
    workable: printColors.workable,
    invalid: printColors.invalid,
    low: printColors.low,
    medium: printColors.medium,
    high: printColors.high,
    critical: printColors.critical,
    proceed: printColors.proceed,
    adjust_messaging: printColors.adjust_messaging,
    adjust_pricing: printColors.adjust_pricing,
    icp_refinement_needed: printColors.icp_refinement_needed,
    major_offer_rebuild: printColors.major_offer_rebuild,
    outline: { bg: "#ffffff", text: printColors.text },
    secondary: { bg: printColors.muted, text: printColors.text },
    destructive: { bg: "#fee2e2", text: "#991b1b" },
  };

  const colors = colorMap[variant] || colorMap.outline;

  return (
    <span style={{ ...styles.badge, backgroundColor: colors.bg, color: colors.text }}>
      {children}
    </span>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.listItem}>
      <span style={{ flexShrink: 0 }}>•</span>
      <span>{children}</span>
    </div>
  );
}

function BoolCheck({ value, label }: { value: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{
        color: value ? printColors.green : printColors.red,
        fontWeight: 600
      }}>{value ? "Yes" : "No"}</span>
      <span style={{ color: value ? printColors.text : printColors.mutedText }}>{label}</span>
    </div>
  );
}

function ScoreDisplay({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const percentage = (score / max) * 100;
  const color = percentage >= 70 ? printColors.green : percentage >= 50 ? "#eab308" : printColors.red;

  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "4px" }}>
        <span>{label}</span>
        <span style={{ fontWeight: 500 }}>{score}/{max}</span>
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${percentage}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.subSection}>
      <div style={styles.subSectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Section({ title, children, number }: { title: string; children: React.ReactNode; number: number }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionNumber}>{number}</div>
        <span style={styles.sectionTitle}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// =============================================================================
// Main PDF Export Content Component
// =============================================================================

interface PdfExportContentProps {
  strategicBlueprint: StrategicBlueprintOutput;
}

export const PdfExportContent = forwardRef<HTMLDivElement, PdfExportContentProps>(
  function PdfExportContent({ strategicBlueprint }, ref) {
    const {
      industryMarketOverview,
      icpAnalysisValidation,
      offerAnalysisViability,
      competitorAnalysis,
      crossAnalysisSynthesis,
      metadata,
    } = strategicBlueprint;

    return (
      <div ref={ref} style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Strategic Blueprint</h1>
          <div style={styles.headerMeta}>
            Generated: {new Date(metadata.generatedAt).toLocaleDateString()} |
            Confidence: {metadata.overallConfidence ?? 'N/A'}%
          </div>
        </div>

        {/* Section 1: Industry & Market Overview */}
        <Section title="Industry & Market Overview" number={1}>
          <SubSection title="Category Snapshot">
            <div style={styles.grid3}>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Category</div>
                <div style={styles.cardValue}>{safeRender(industryMarketOverview?.categorySnapshot?.category)}</div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Market Maturity</div>
                <Badge variant="outline">{safeRender(industryMarketOverview?.categorySnapshot?.marketMaturity)}</Badge>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Awareness Level</div>
                <Badge variant="outline">{safeRender(industryMarketOverview?.categorySnapshot?.awarenessLevel)}</Badge>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Buying Behavior</div>
                <div style={styles.cardValue}>{safeRender(industryMarketOverview?.categorySnapshot?.buyingBehavior)?.replace("_", " ")}</div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Sales Cycle</div>
                <div style={styles.cardValue}>{safeRender(industryMarketOverview?.categorySnapshot?.averageSalesCycle)}</div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Seasonality</div>
                <div style={styles.cardValue}>{safeRender(industryMarketOverview?.categorySnapshot?.seasonality)}</div>
              </div>
            </div>
          </SubSection>

          <SubSection title="Market Dynamics">
            <div style={styles.grid2}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>Demand Drivers</div>
                {safeArray(industryMarketOverview?.marketDynamics?.demandDrivers).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>Buying Triggers</div>
                {safeArray(industryMarketOverview?.marketDynamics?.buyingTriggers).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>Barriers to Purchase</div>
              {safeArray(industryMarketOverview?.marketDynamics?.barriersToPurchase).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </div>
          </SubSection>

          <SubSection title="Pain Points">
            <div style={styles.grid2}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8, color: printColors.red }}>Primary Pain Points</div>
                {safeArray(industryMarketOverview?.painPoints?.primary).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8, color: printColors.orange }}>Secondary Pain Points</div>
                {safeArray(industryMarketOverview?.painPoints?.secondary).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </div>
            </div>
          </SubSection>

          <SubSection title="Psychological Drivers">
            <div style={styles.grid2}>
              {(industryMarketOverview?.psychologicalDrivers?.drivers || []).map((driver, i) => (
                <div key={i} style={{ ...styles.card, borderLeft: `4px solid ${printColors.primary}` }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{safeRender(driver?.driver)}</div>
                  <div style={{ fontSize: 13, color: printColors.mutedText }}>{safeRender(driver?.description)}</div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Audience Objections">
            {(industryMarketOverview?.audienceObjections?.objections || []).map((obj, i) => (
              <div key={i} style={{ ...styles.card, marginBottom: 12 }}>
                <div style={{ fontWeight: 500 }}>&quot;{safeRender(obj?.objection)}&quot;</div>
                <div style={{ fontSize: 13, color: printColors.mutedText, marginTop: 8 }}>
                  <strong>Response:</strong> {safeRender(obj?.howToAddress)}
                </div>
              </div>
            ))}
          </SubSection>

          <SubSection title="Messaging Opportunities">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {safeArray(industryMarketOverview?.messagingOpportunities?.opportunities).map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    backgroundColor: printColors.muted,
                    fontSize: 13,
                    wordBreak: "break-word",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
            <div style={{ ...styles.card, backgroundColor: printColors.primaryLight, border: `1px solid ${printColors.primary}` }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>Key Recommendations</div>
              {safeArray(industryMarketOverview?.messagingOpportunities?.summaryRecommendations).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </div>
          </SubSection>
        </Section>

        {/* Section 2: ICP Analysis & Validation */}
        <Section title="ICP Analysis & Validation" number={2}>
          {/* Status Banner */}
          <div style={{
            ...styles.statusBanner,
            backgroundColor: printColors[icpAnalysisValidation?.finalVerdict?.status as ValidationStatus || "workable"]?.bg,
            borderColor: printColors[icpAnalysisValidation?.finalVerdict?.status as ValidationStatus || "workable"]?.border,
            color: printColors[icpAnalysisValidation?.finalVerdict?.status as ValidationStatus || "workable"]?.text,
          }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              ICP Status: {safeRender(icpAnalysisValidation?.finalVerdict?.status)?.toUpperCase()}
            </div>
            <div style={{ marginTop: 8 }}>{safeRender(icpAnalysisValidation?.finalVerdict?.reasoning)}</div>
          </div>

          <SubSection title="ICP Coherence Check">
            <div style={styles.grid3}>
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.clearlyDefined || false} label="Clearly Defined" />
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.reachableThroughPaidChannels || false} label="Reachable via Paid Channels" />
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.adequateScale || false} label="Adequate Scale" />
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.hasPainOfferSolves || false} label="Has Pain Offer Solves" />
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.hasBudgetAndAuthority || false} label="Has Budget & Authority" />
            </div>
          </SubSection>

          <SubSection title="Pain-Solution Fit">
            <div style={styles.card}>
              <div style={styles.grid2}>
                <div>
                  <div style={{ fontSize: 12, color: printColors.mutedText }}>Primary Pain</div>
                  <div style={{ fontWeight: 500 }}>{safeRender(icpAnalysisValidation?.painSolutionFit?.primaryPain)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: printColors.mutedText }}>Offer Component Solving It</div>
                  <div style={{ fontWeight: 500 }}>{safeRender(icpAnalysisValidation?.painSolutionFit?.offerComponentSolvingIt)}</div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <Badge variant={icpAnalysisValidation?.painSolutionFit?.fitAssessment === "strong" ? "validated" : icpAnalysisValidation?.painSolutionFit?.fitAssessment === "moderate" ? "workable" : "invalid"}>
                  Fit: {safeRender(icpAnalysisValidation?.painSolutionFit?.fitAssessment)?.toUpperCase()}
                </Badge>
              </div>
            </div>
          </SubSection>

          <SubSection title="Risk Assessment">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {(["reachability", "budget", "painStrength", "competitiveness"] as const).map((key) => (
                <div key={key} style={{ ...styles.card, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: printColors.mutedText, textTransform: "uppercase" }}>{key.replace(/([A-Z])/g, " $1")}</div>
                  <div style={{ marginTop: 8 }}>
                    <Badge variant={icpAnalysisValidation?.riskAssessment?.[key] as RiskRating || "medium"}>
                      {safeRender(icpAnalysisValidation?.riskAssessment?.[key])?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

          {icpAnalysisValidation?.finalVerdict?.recommendations && (
            <SubSection title="Recommendations">
              {safeArray(icpAnalysisValidation.finalVerdict.recommendations).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </SubSection>
          )}
        </Section>

        {/* Section 3: Offer Analysis & Viability */}
        <Section title="Offer Analysis & Viability" number={3}>
          {/* Recommendation Banner */}
          <div style={{
            ...styles.statusBanner,
            backgroundColor: printColors[offerAnalysisViability?.recommendation?.status as OfferRecommendation || "proceed"]?.bg,
            color: printColors[offerAnalysisViability?.recommendation?.status as OfferRecommendation || "proceed"]?.text,
            borderColor: printColors.muted,
          }}>
            <div style={{ fontWeight: 600, fontSize: 16, textTransform: "capitalize" }}>
              Recommendation: {safeRender(offerAnalysisViability?.recommendation?.status)?.replace(/_/g, " ")}
            </div>
            <div style={{ marginTop: 8 }}>{safeRender(offerAnalysisViability?.recommendation?.reasoning)}</div>
          </div>

          <SubSection title="Offer Clarity">
            <div style={styles.grid3}>
              <BoolCheck value={offerAnalysisViability?.offerClarity?.clearlyArticulated || false} label="Clearly Articulated" />
              <BoolCheck value={offerAnalysisViability?.offerClarity?.solvesRealPain || false} label="Solves Real Pain" />
              <BoolCheck value={offerAnalysisViability?.offerClarity?.benefitsEasyToUnderstand || false} label="Benefits Easy to Understand" />
              <BoolCheck value={offerAnalysisViability?.offerClarity?.transformationMeasurable || false} label="Transformation Measurable" />
              <BoolCheck value={offerAnalysisViability?.offerClarity?.valuePropositionObvious || false} label="Value Prop Obvious in 3s" />
            </div>
          </SubSection>

          <SubSection title="Offer Strength Scores">
            <div style={styles.grid2}>
              <ScoreDisplay label="Pain Relevance" score={offerAnalysisViability?.offerStrength?.painRelevance || 0} />
              <ScoreDisplay label="Urgency" score={offerAnalysisViability?.offerStrength?.urgency || 0} />
              <ScoreDisplay label="Differentiation" score={offerAnalysisViability?.offerStrength?.differentiation || 0} />
              <ScoreDisplay label="Tangibility" score={offerAnalysisViability?.offerStrength?.tangibility || 0} />
              <ScoreDisplay label="Proof" score={offerAnalysisViability?.offerStrength?.proof || 0} />
              <ScoreDisplay label="Pricing Logic" score={offerAnalysisViability?.offerStrength?.pricingLogic || 0} />
            </div>
            <div style={{ ...styles.card, backgroundColor: printColors.primaryLight, textAlign: "center", marginTop: 16 }}>
              <div style={{ fontSize: 12, color: printColors.mutedText }}>Overall Score</div>
              <div style={{ fontSize: 32, fontWeight: "bold", color: printColors.primary }}>
                {(offerAnalysisViability?.offerStrength?.overallScore || 0).toFixed(1)}/10
              </div>
            </div>
          </SubSection>

          <SubSection title="Market-Offer Fit">
            <div style={styles.grid3}>
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.marketWantsNow || false} label="Market Wants This Now" />
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.competitorsOfferSimilar || false} label="Competitors Offer Similar" />
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.priceMatchesExpectations || false} label="Price Matches Expectations" />
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.proofStrongForColdTraffic || false} label="Proof Strong for Cold Traffic" />
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.transformationBelievable || false} label="Transformation Believable" />
            </div>
          </SubSection>

          {offerAnalysisViability?.redFlags && offerAnalysisViability.redFlags.length > 0 && (
            <SubSection title="Red Flags">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {offerAnalysisViability.redFlags.map((flag, i) => (
                  <Badge key={i} variant="destructive">{safeRender(flag).replace(/_/g, " ")}</Badge>
                ))}
              </div>
            </SubSection>
          )}

          <SubSection title="Action Items">
            {safeArray(offerAnalysisViability?.recommendation?.actionItems).map((item, i) => (
              <ListItem key={i}>{item}</ListItem>
            ))}
          </SubSection>
        </Section>

        {/* Section 4: Competitor Analysis */}
        <Section title="Competitor Analysis" number={4}>
          <SubSection title="Competitor Snapshots">
            {(competitorAnalysis?.competitors || []).map((comp, i) => (
              <div key={i} style={{ ...styles.card, marginBottom: 16, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{safeRender(comp?.name)}</div>
                <div style={{ fontSize: 13, color: printColors.mutedText, marginBottom: 12 }}>{safeRender(comp?.positioning)}</div>
                <div style={styles.grid2}>
                  <div>
                    <div style={{ fontSize: 12, color: printColors.mutedText }}>Offer</div>
                    <div>{safeRender(comp?.offer)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: printColors.mutedText }}>Price</div>
                    <div>{safeRender(comp?.price)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: printColors.mutedText }}>Platforms</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {safeArray(comp?.adPlatforms).map((p, j) => (
                        <Badge key={j} variant="outline">{p}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: printColors.mutedText }}>Funnels</div>
                    <div>{safeRender(comp?.funnels)}</div>
                  </div>
                </div>
                <div style={{ ...styles.grid2, marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: printColors.green }}>Strengths</div>
                    {safeArray(comp?.strengths).map((s, j) => (
                      <div key={j} style={{ fontSize: 13 }}>+ {s}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: printColors.red }}>Weaknesses</div>
                    {safeArray(comp?.weaknesses).map((w, j) => (
                      <div key={j} style={{ fontSize: 13 }}>- {w}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </SubSection>

          <SubSection title="Gaps & Opportunities">
            <div style={styles.grid3}>
              <div style={{ ...styles.card, backgroundColor: "#dcfce7", border: "1px solid #86efac" }}>
                <div style={{ fontWeight: 500, color: printColors.green, marginBottom: 8 }}>Messaging Opportunities</div>
                {safeArray(competitorAnalysis?.gapsAndOpportunities?.messagingOpportunities).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </div>
              <div style={{ ...styles.card, backgroundColor: "#dbeafe", border: "1px solid #93c5fd" }}>
                <div style={{ fontWeight: 500, color: printColors.blue, marginBottom: 8 }}>Creative Opportunities</div>
                {safeArray(competitorAnalysis?.gapsAndOpportunities?.creativeOpportunities).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </div>
              <div style={{ ...styles.card, backgroundColor: "#f3e8ff", border: "1px solid #d8b4fe" }}>
                <div style={{ fontWeight: 500, color: printColors.purple, marginBottom: 8 }}>Funnel Opportunities</div>
                {safeArray(competitorAnalysis?.gapsAndOpportunities?.funnelOpportunities).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </div>
            </div>
          </SubSection>
        </Section>

        {/* Section 5: Cross-Analysis Synthesis */}
        <Section title="Cross-Analysis Synthesis" number={5}>
          <SubSection title="Key Strategic Insights">
            {(crossAnalysisSynthesis?.keyInsights || []).map((insight, i) => (
              <div key={i} style={{ ...styles.card, borderLeft: `4px solid ${printColors.primary}`, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{safeRender(insight?.insight)}</div>
                    <div style={{ fontSize: 13, color: printColors.mutedText, marginTop: 4 }}>
                      <strong>Implication:</strong> {safeRender(insight?.implication)}
                    </div>
                  </div>
                  <Badge variant={insight?.priority === "high" ? "validated" : "secondary"}>
                    {safeRender(insight?.priority)}
                  </Badge>
                </div>
              </div>
            ))}
          </SubSection>

          <SubSection title="Recommended Positioning">
            <div style={{ ...styles.card, backgroundColor: printColors.primaryLight, border: `1px solid ${printColors.primary}` }}>
              <div style={{ fontSize: 16 }}>{safeRender(crossAnalysisSynthesis?.recommendedPositioning)}</div>
            </div>
          </SubSection>

          <SubSection title="Primary Messaging Angles">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {safeArray(crossAnalysisSynthesis?.primaryMessagingAngles).map((angle, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    backgroundColor: printColors.primary,
                    color: "white",
                    fontSize: 14,
                    fontWeight: 500,
                    wordBreak: "break-word",
                  }}
                >
                  {angle}
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Recommended Platforms">
            <div style={styles.grid3}>
              {(crossAnalysisSynthesis?.recommendedPlatforms || []).map((plat, i) => (
                <div key={i} style={{
                  ...styles.card,
                  backgroundColor: plat?.priority === "primary" ? printColors.primaryLight : printColors.muted,
                  border: plat?.priority === "primary" ? `1px solid ${printColors.primary}` : "1px solid #e5e7eb",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>{safeRender(plat?.platform)}</div>
                    <Badge variant={plat?.priority === "primary" ? "validated" : "secondary"}>
                      {safeRender(plat?.priority)}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 13, color: printColors.mutedText }}>{safeRender(plat?.reasoning)}</div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Critical Success Factors">
            {safeArray(crossAnalysisSynthesis?.criticalSuccessFactors).map((item, i) => (
              <ListItem key={i}>{item}</ListItem>
            ))}
          </SubSection>

          {crossAnalysisSynthesis?.potentialBlockers && crossAnalysisSynthesis.potentialBlockers.length > 0 && (
            <SubSection title="Potential Blockers">
              {safeArray(crossAnalysisSynthesis.potentialBlockers).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </SubSection>
          )}

          <SubSection title="Recommended Next Steps">
            {safeArray(crossAnalysisSynthesis?.nextSteps).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: printColors.primary,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <span style={{ paddingTop: 2 }}>{item}</span>
              </div>
            ))}
          </SubSection>
        </Section>

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb", textAlign: "center", fontSize: 12, color: printColors.mutedText }}>
          <div>Strategic Blueprint v{metadata.version}</div>
          <div>Generated on {new Date(metadata.generatedAt).toLocaleDateString()} by SaaSLaunch AI</div>
        </div>
      </div>
    );
  }
);
