"use client";

import { useRef, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  TrendingUp,
  Users,
  Package,
  Swords,
  Lightbulb,
  Check,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Brain,
  MessageSquare,
  Target,
  Shield,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { PdfExportContent } from "./pdf-export-content";
import type {
  StrategicBlueprintOutput,
  StrategicBlueprintSection,
  ValidationStatus,
  RiskRating,
  OfferRecommendation,
} from "@/lib/strategic-blueprint/output-types";

interface StrategicBlueprintDisplayProps {
  strategicBlueprint: StrategicBlueprintOutput;
}

// Section icons mapping
const SECTION_ICONS: Record<StrategicBlueprintSection, React.ReactNode> = {
  industryMarketOverview: <TrendingUp className="h-5 w-5" />,
  icpAnalysisValidation: <Users className="h-5 w-5" />,
  offerAnalysisViability: <Package className="h-5 w-5" />,
  competitorAnalysis: <Swords className="h-5 w-5" />,
  crossAnalysisSynthesis: <Lightbulb className="h-5 w-5" />,
};

const SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market Overview",
  icpAnalysisValidation: "ICP Analysis & Validation",
  offerAnalysisViability: "Offer Analysis & Viability",
  competitorAnalysis: "Competitor Analysis",
  crossAnalysisSynthesis: "Cross-Analysis Synthesis",
};

// Status colors - Dark mode compatible
const VALIDATION_STATUS_COLORS: Record<ValidationStatus, string> = {
  validated: "bg-green-500/20 text-green-400 border-green-500/30",
  workable: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  invalid: "bg-red-500/20 text-red-400 border-red-500/30",
};

const RISK_COLORS: Record<RiskRating, string> = {
  low: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-orange-500/20 text-orange-400",
  critical: "bg-red-500/20 text-red-400",
};

const OFFER_RECOMMENDATION_COLORS: Record<OfferRecommendation, string> = {
  proceed: "bg-green-500/20 text-green-400",
  adjust_messaging: "bg-yellow-500/20 text-yellow-400",
  adjust_pricing: "bg-yellow-500/20 text-yellow-400",
  icp_refinement_needed: "bg-orange-500/20 text-orange-400",
  major_offer_rebuild: "bg-red-500/20 text-red-400",
};

// Section Component
function Section({
  title,
  icon,
  children,
  sectionNumber,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  sectionNumber: number;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-primary/20">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
          {sectionNumber}
        </div>
        <div className="flex items-center gap-2 text-primary">{icon}</div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="pl-2">{children}</div>
    </div>
  );
}

// Sub-section header
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 mb-6">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide border-l-4 border-primary/40 pl-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

// List item with check
function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

// Boolean check display
function BoolCheck({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

// Score display with progress bar
function ScoreDisplay({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const percentage = (score / max) * 100;
  const colorClass =
    percentage >= 70 ? "bg-green-500" : percentage >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{score}/{max}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", colorClass)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

// Safe render helper
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

// Safe array helper
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

export function StrategicBlueprintDisplay({ strategicBlueprint }: StrategicBlueprintDisplayProps) {
  const {
    industryMarketOverview,
    icpAnalysisValidation,
    offerAnalysisViability,
    competitorAnalysis,
    crossAnalysisSynthesis,
    metadata,
  } = strategicBlueprint;

  const documentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);

    try {
      // Dynamically import html2canvas and jsPDF
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
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "850px";
      document.body.appendChild(container);

      // Render the PdfExportContent component into the container
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(<PdfExportContent strategicBlueprint={strategicBlueprint} />);
        // Give React time to render
        setTimeout(resolve, 100);
      });

      // Get the rendered content
      const content = container.firstElementChild as HTMLElement;
      if (!content) {
        throw new Error("Failed to render PDF content");
      }

      // Capture the content with html2canvas
      // Note: html2canvas may log warnings about unsupported color functions (oklch, lab) from Tailwind CSS 4
      // These warnings are non-fatal - the PDF will still render correctly using inline styles
      const canvas = await html2canvas(content, {
        scale: 2, // Higher resolution for better quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 794, // A4 width at 96 DPI
      });

      // Clean up the temporary container
      root.unmount();
      document.body.removeChild(container);

      // Create PDF from canvas
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Calculate image dimensions to fit page width
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      // Add pages as needed
      let heightLeft = imgHeight;
      let position = 0;
      let pageNumber = 0;

      while (heightLeft > 0) {
        if (pageNumber > 0) {
          pdf.addPage();
        }

        // Add image with offset for current page position
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

        heightLeft -= pageHeight;
        position -= pageHeight;
        pageNumber++;
      }

      pdf.save(filename);
    } catch (error) {
      console.error("PDF export failed:", error);
      // Show error to user (you could add a toast notification here)
      alert("PDF export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [strategicBlueprint]);

  return (
    <div className="w-full">
      {/* Header with metadata and export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
        <div>
          <h1 className="text-2xl font-bold">Strategic Blueprint</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Generated: {new Date(metadata.generatedAt).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Coins className="h-4 w-4" />${metadata.totalCost.toFixed(4)}
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Confidence: {metadata.overallConfidence}%
            </span>
          </div>
        </div>
        <Button onClick={handleExportPDF} disabled={isExporting} variant="outline">
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

      {/* Document content */}
      <div
        ref={documentRef}
        className="bg-card text-card-foreground rounded-lg border shadow-sm p-8 print:shadow-none print:border-none"
      >
        {/* Section 1: Industry & Market Overview */}
        <Section title={SECTION_LABELS.industryMarketOverview} icon={SECTION_ICONS.industryMarketOverview} sectionNumber={1}>
          {/* Category Snapshot */}
          <SubSection title="Category Snapshot">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground uppercase">Category</p>
                <p className="font-medium">{safeRender(industryMarketOverview?.categorySnapshot?.category)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground uppercase">Market Maturity</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {safeRender(industryMarketOverview?.categorySnapshot?.marketMaturity)}
                </Badge>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground uppercase">Awareness Level</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {safeRender(industryMarketOverview?.categorySnapshot?.awarenessLevel)}
                </Badge>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground uppercase">Buying Behavior</p>
                <p className="font-medium capitalize">{safeRender(industryMarketOverview?.categorySnapshot?.buyingBehavior)?.replace("_", " ")}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground uppercase">Sales Cycle</p>
                <p className="font-medium">{safeRender(industryMarketOverview?.categorySnapshot?.averageSalesCycle)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground uppercase">Seasonality</p>
                <p className="font-medium">{safeRender(industryMarketOverview?.categorySnapshot?.seasonality)}</p>
              </div>
            </div>
          </SubSection>

          {/* Market Dynamics */}
          <SubSection title="Market Dynamics">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Demand Drivers
                </h4>
                <ul className="space-y-1">
                  {safeArray(industryMarketOverview?.marketDynamics?.demandDrivers).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  Buying Triggers
                </h4>
                <ul className="space-y-1">
                  {safeArray(industryMarketOverview?.marketDynamics?.buyingTriggers).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-orange-600" />
                Barriers to Purchase
              </h4>
              <ul className="space-y-1">
                {safeArray(industryMarketOverview?.marketDynamics?.barriersToPurchase).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </SubSection>

          {/* Pain Points */}
          <SubSection title="Pain Points">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2 text-red-600">Primary Pain Points</h4>
                <ul className="space-y-1">
                  {safeArray(industryMarketOverview?.painPoints?.primary).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-orange-600">Secondary Pain Points</h4>
                <ul className="space-y-1">
                  {safeArray(industryMarketOverview?.painPoints?.secondary).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
            </div>
          </SubSection>

          {/* Psychological Drivers */}
          <SubSection title="Psychological Drivers">
            <div className="grid md:grid-cols-2 gap-4">
              {(industryMarketOverview?.psychologicalDrivers?.drivers || []).map((driver, i) => (
                <div key={i} className="p-3 bg-muted/30 rounded-lg border-l-4 border-primary">
                  <p className="font-medium flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    {safeRender(driver?.driver)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{safeRender(driver?.description)}</p>
                </div>
              ))}
            </div>
          </SubSection>

          {/* Audience Objections */}
          <SubSection title="Audience Objections">
            <div className="space-y-3">
              {(industryMarketOverview?.audienceObjections?.objections || []).map((obj, i) => (
                <div key={i} className="p-4 bg-muted/30 rounded-lg">
                  <p className="font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-600" />
                    &quot;{safeRender(obj?.objection)}&quot;
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 ml-6">
                    <strong>Response:</strong> {safeRender(obj?.howToAddress)}
                  </p>
                </div>
              ))}
            </div>
          </SubSection>

          {/* Messaging Opportunities */}
          <SubSection title="Messaging Opportunities">
            <div className="flex flex-wrap gap-2 mb-4">
              {safeArray(industryMarketOverview?.messagingOpportunities?.opportunities).map((item, i) => (
                <Badge key={i} variant="secondary">{item}</Badge>
              ))}
            </div>
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="font-medium mb-2">Key Recommendations</h4>
              <ul className="space-y-1">
                {safeArray(industryMarketOverview?.messagingOpportunities?.summaryRecommendations).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </ul>
            </div>
          </SubSection>
        </Section>

        {/* Section 2: ICP Analysis & Validation */}
        <Section title={SECTION_LABELS.icpAnalysisValidation} icon={SECTION_ICONS.icpAnalysisValidation} sectionNumber={2}>
          {/* Final Verdict Banner */}
          <div className={cn(
            "p-4 rounded-lg border mb-6",
            VALIDATION_STATUS_COLORS[icpAnalysisValidation?.finalVerdict?.status || "workable"]
          )}>
            <div className="flex items-center gap-2 font-medium text-lg">
              {icpAnalysisValidation?.finalVerdict?.status === "validated" && <CheckCircle2 className="h-5 w-5" />}
              {icpAnalysisValidation?.finalVerdict?.status === "workable" && <AlertTriangle className="h-5 w-5" />}
              {icpAnalysisValidation?.finalVerdict?.status === "invalid" && <XCircle className="h-5 w-5" />}
              ICP Status: {safeRender(icpAnalysisValidation?.finalVerdict?.status)?.toUpperCase()}
            </div>
            <p className="mt-2">{safeRender(icpAnalysisValidation?.finalVerdict?.reasoning)}</p>
          </div>

          {/* Coherence Check */}
          <SubSection title="ICP Coherence Check">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.clearlyDefined || false} label="Clearly Defined" />
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.reachableThroughPaidChannels || false} label="Reachable via Paid Channels" />
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.adequateScale || false} label="Adequate Scale" />
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.hasPainOfferSolves || false} label="Has Pain Offer Solves" />
              <BoolCheck value={icpAnalysisValidation?.coherenceCheck?.hasBudgetAndAuthority || false} label="Has Budget & Authority" />
            </div>
          </SubSection>

          {/* Pain-Solution Fit */}
          <SubSection title="Pain-Solution Fit">
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Primary Pain</p>
                  <p className="font-medium">{safeRender(icpAnalysisValidation?.painSolutionFit?.primaryPain)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Offer Component Solving It</p>
                  <p className="font-medium">{safeRender(icpAnalysisValidation?.painSolutionFit?.offerComponentSolvingIt)}</p>
                </div>
              </div>
              <div className="mt-4">
                <Badge className={cn(
                  icpAnalysisValidation?.painSolutionFit?.fitAssessment === "strong" ? "bg-green-500/20 text-green-400" :
                  icpAnalysisValidation?.painSolutionFit?.fitAssessment === "moderate" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-red-500/20 text-red-400"
                )}>
                  Fit: {safeRender(icpAnalysisValidation?.painSolutionFit?.fitAssessment)?.toUpperCase()}
                </Badge>
              </div>
            </div>
          </SubSection>

          {/* Market Size & Reachability */}
          <SubSection title="Market Size & Reachability">
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              <BoolCheck value={icpAnalysisValidation?.marketReachability?.metaVolume || false} label="Meta Audience Volume" />
              <BoolCheck value={icpAnalysisValidation?.marketReachability?.linkedInVolume || false} label="LinkedIn Volume" />
              <BoolCheck value={icpAnalysisValidation?.marketReachability?.googleSearchDemand || false} label="Google Search Demand" />
            </div>
            {icpAnalysisValidation?.marketReachability?.contradictingSignals && icpAnalysisValidation.marketReachability.contradictingSignals.length > 0 && (
              <div className="mt-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                <p className="text-sm font-medium text-orange-400 mb-1">Contradicting Signals</p>
                <ul className="text-sm space-y-1">
                  {icpAnalysisValidation.marketReachability.contradictingSignals.map((signal, i) => (
                    <ListItem key={i}>{signal}</ListItem>
                  ))}
                </ul>
              </div>
            )}
          </SubSection>

          {/* Economic Feasibility */}
          <SubSection title="Economic Feasibility">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <BoolCheck value={icpAnalysisValidation?.economicFeasibility?.hasBudget || false} label="ICP Has Budget" />
              <BoolCheck value={icpAnalysisValidation?.economicFeasibility?.purchasesSimilar || false} label="Purchases Similar Solutions" />
              <BoolCheck value={icpAnalysisValidation?.economicFeasibility?.tamAlignedWithCac || false} label="TAM Aligns with CAC" />
            </div>
            {icpAnalysisValidation?.economicFeasibility?.notes && (
              <p className="mt-3 text-sm text-muted-foreground">{icpAnalysisValidation.economicFeasibility.notes}</p>
            )}
          </SubSection>

          {/* Risk Assessment */}
          <SubSection title="Risk Assessment">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["reachability", "budget", "painStrength", "competitiveness"].map((key) => (
                <div key={key} className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">{key.replace(/([A-Z])/g, " $1")}</p>
                  <Badge className={cn("mt-2", RISK_COLORS[icpAnalysisValidation?.riskAssessment?.[key as keyof typeof icpAnalysisValidation.riskAssessment] || "medium"])}>
                    {safeRender(icpAnalysisValidation?.riskAssessment?.[key as keyof typeof icpAnalysisValidation.riskAssessment])?.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </SubSection>

          {/* Recommendations */}
          {icpAnalysisValidation?.finalVerdict?.recommendations && (
            <SubSection title="Recommendations">
              <ul className="space-y-1">
                {safeArray(icpAnalysisValidation.finalVerdict.recommendations).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </ul>
            </SubSection>
          )}
        </Section>

        {/* Section 3: Offer Analysis & Viability */}
        <Section title={SECTION_LABELS.offerAnalysisViability} icon={SECTION_ICONS.offerAnalysisViability} sectionNumber={3}>
          {/* Recommendation Banner */}
          <div className={cn(
            "p-4 rounded-lg border mb-6",
            OFFER_RECOMMENDATION_COLORS[offerAnalysisViability?.recommendation?.status || "proceed"]
          )}>
            <div className="font-medium text-lg capitalize">
              Recommendation: {safeRender(offerAnalysisViability?.recommendation?.status)?.replace(/_/g, " ")}
            </div>
            <p className="mt-2">{safeRender(offerAnalysisViability?.recommendation?.reasoning)}</p>
          </div>

          {/* Offer Clarity */}
          <SubSection title="Offer Clarity">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <BoolCheck value={offerAnalysisViability?.offerClarity?.clearlyArticulated || false} label="Clearly Articulated" />
              <BoolCheck value={offerAnalysisViability?.offerClarity?.solvesRealPain || false} label="Solves Real Pain" />
              <BoolCheck value={offerAnalysisViability?.offerClarity?.benefitsEasyToUnderstand || false} label="Benefits Easy to Understand" />
              <BoolCheck value={offerAnalysisViability?.offerClarity?.transformationMeasurable || false} label="Transformation Measurable" />
              <BoolCheck value={offerAnalysisViability?.offerClarity?.valuePropositionObvious || false} label="Value Prop Obvious in 3s" />
            </div>
          </SubSection>

          {/* Offer Strength Scores */}
          <SubSection title="Offer Strength Scores">
            <div className="grid md:grid-cols-2 gap-4">
              <ScoreDisplay label="Pain Relevance" score={offerAnalysisViability?.offerStrength?.painRelevance || 0} />
              <ScoreDisplay label="Urgency" score={offerAnalysisViability?.offerStrength?.urgency || 0} />
              <ScoreDisplay label="Differentiation" score={offerAnalysisViability?.offerStrength?.differentiation || 0} />
              <ScoreDisplay label="Tangibility" score={offerAnalysisViability?.offerStrength?.tangibility || 0} />
              <ScoreDisplay label="Proof" score={offerAnalysisViability?.offerStrength?.proof || 0} />
              <ScoreDisplay label="Pricing Logic" score={offerAnalysisViability?.offerStrength?.pricingLogic || 0} />
            </div>
            <div className="mt-4 p-4 bg-primary/10 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Overall Score</p>
              <p className="text-3xl font-bold text-primary">
                {(offerAnalysisViability?.offerStrength?.overallScore || 0).toFixed(1)}/10
              </p>
            </div>
          </SubSection>

          {/* Market-Offer Fit */}
          <SubSection title="Market-Offer Fit">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.marketWantsNow || false} label="Market Wants This Now" />
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.competitorsOfferSimilar || false} label="Competitors Offer Similar" />
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.priceMatchesExpectations || false} label="Price Matches Expectations" />
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.proofStrongForColdTraffic || false} label="Proof Strong for Cold Traffic" />
              <BoolCheck value={offerAnalysisViability?.marketOfferFit?.transformationBelievable || false} label="Transformation Believable" />
            </div>
          </SubSection>

          {/* Red Flags */}
          {offerAnalysisViability?.redFlags && offerAnalysisViability.redFlags.length > 0 && (
            <SubSection title="Red Flags">
              <div className="flex flex-wrap gap-2">
                {offerAnalysisViability.redFlags.map((flag, i) => (
                  <Badge key={i} variant="destructive" className="capitalize">
                    {safeRender(flag).replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </SubSection>
          )}

          {/* Action Items */}
          <SubSection title="Action Items">
            <ul className="space-y-1">
              {safeArray(offerAnalysisViability?.recommendation?.actionItems).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </SubSection>
        </Section>

        {/* Section 4: Competitor Analysis */}
        <Section title={SECTION_LABELS.competitorAnalysis} icon={SECTION_ICONS.competitorAnalysis} sectionNumber={4}>
          {/* Competitor Snapshots */}
          <SubSection title="Competitor Snapshots">
            <div className="space-y-4">
              {(competitorAnalysis?.competitors || []).map((comp, i) => (
                <div key={i} className="p-4 bg-muted/30 rounded-lg border">
                  <h4 className="font-semibold text-lg">{safeRender(comp?.name)}</h4>
                  <p className="text-sm text-muted-foreground mb-3">{safeRender(comp?.positioning)}</p>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Offer</p>
                      <p>{safeRender(comp?.offer)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p>{safeRender(comp?.price)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Platforms</p>
                      <div className="flex gap-1 flex-wrap">
                        {safeArray(comp?.adPlatforms).map((p, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Funnels</p>
                      <p>{safeRender(comp?.funnels)}</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-sm font-medium text-green-600">Strengths</p>
                      <ul className="text-sm space-y-1">
                        {safeArray(comp?.strengths).map((s, j) => (
                          <li key={j}>+ {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-600">Weaknesses</p>
                      <ul className="text-sm space-y-1">
                        {safeArray(comp?.weaknesses).map((w, j) => (
                          <li key={j}>- {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

          {/* Creative Library */}
          <SubSection title="Creative Library">
            <div className="mb-4">
              <h4 className="font-medium mb-2">Ad Hooks Competitors Use</h4>
              <div className="flex flex-wrap gap-2">
                {safeArray(competitorAnalysis?.creativeLibrary?.adHooks).map((hook, i) => (
                  <Badge key={i} variant="outline" className="text-sm">&quot;{hook}&quot;</Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Creative Formats Used</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <BoolCheck value={competitorAnalysis?.creativeLibrary?.creativeFormats?.ugc || false} label="UGC" />
                <BoolCheck value={competitorAnalysis?.creativeLibrary?.creativeFormats?.carousels || false} label="Carousels" />
                <BoolCheck value={competitorAnalysis?.creativeLibrary?.creativeFormats?.statics || false} label="Statics" />
                <BoolCheck value={competitorAnalysis?.creativeLibrary?.creativeFormats?.testimonial || false} label="Testimonials" />
                <BoolCheck value={competitorAnalysis?.creativeLibrary?.creativeFormats?.productDemo || false} label="Product Demo" />
              </div>
            </div>
          </SubSection>

          {/* Funnel Breakdown */}
          <SubSection title="Funnel Breakdown">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Landing Page Patterns</h4>
                <ul className="space-y-1">
                  {safeArray(competitorAnalysis?.funnelBreakdown?.landingPagePatterns).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Headline Structure</h4>
                <ul className="space-y-1">
                  {safeArray(competitorAnalysis?.funnelBreakdown?.headlineStructure).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">CTA Hierarchy</h4>
                <ul className="space-y-1">
                  {safeArray(competitorAnalysis?.funnelBreakdown?.ctaHierarchy).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Social Proof Patterns</h4>
                <ul className="space-y-1">
                  {safeArray(competitorAnalysis?.funnelBreakdown?.socialProofPatterns).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Lead Capture Methods</h4>
                <ul className="space-y-1">
                  {safeArray(competitorAnalysis?.funnelBreakdown?.leadCaptureMethods).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Form Friction Level</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {safeRender(competitorAnalysis?.funnelBreakdown?.formFriction)}
                </Badge>
              </div>
            </div>
          </SubSection>

          {/* Market Strengths & Weaknesses */}
          <SubSection title="Market Strengths & Weaknesses">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2 text-green-400">Market Strengths</h4>
                <ul className="space-y-1">
                  {safeArray(competitorAnalysis?.marketStrengths).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-red-400">Market Weaknesses</h4>
                <ul className="space-y-1">
                  {safeArray(competitorAnalysis?.marketWeaknesses).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </SubSection>

          {/* Gaps & Opportunities */}
          <SubSection title="Gaps & Opportunities">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <h4 className="font-medium text-green-400 mb-2">Messaging Opportunities</h4>
                <ul className="text-sm space-y-1">
                  {safeArray(competitorAnalysis?.gapsAndOpportunities?.messagingOpportunities).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <h4 className="font-medium text-blue-400 mb-2">Creative Opportunities</h4>
                <ul className="text-sm space-y-1">
                  {safeArray(competitorAnalysis?.gapsAndOpportunities?.creativeOpportunities).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <h4 className="font-medium text-purple-400 mb-2">Funnel Opportunities</h4>
                <ul className="text-sm space-y-1">
                  {safeArray(competitorAnalysis?.gapsAndOpportunities?.funnelOpportunities).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </div>
            </div>
          </SubSection>
        </Section>

        {/* Section 5: Cross-Analysis Synthesis */}
        <Section title={SECTION_LABELS.crossAnalysisSynthesis} icon={SECTION_ICONS.crossAnalysisSynthesis} sectionNumber={5}>
          {/* Key Insights */}
          <SubSection title="Key Strategic Insights">
            <div className="space-y-3">
              {(crossAnalysisSynthesis?.keyInsights || []).map((insight, i) => (
                <div key={i} className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{safeRender(insight?.insight)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        <strong>Implication:</strong> {safeRender(insight?.implication)}
                      </p>
                    </div>
                    <Badge variant={insight?.priority === "high" ? "default" : "secondary"} className="shrink-0">
                      {safeRender(insight?.priority)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

          {/* Recommended Positioning */}
          <SubSection title="Recommended Positioning">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-lg">{safeRender(crossAnalysisSynthesis?.recommendedPositioning)}</p>
            </div>
          </SubSection>

          {/* Primary Messaging Angles */}
          <SubSection title="Primary Messaging Angles">
            <div className="flex flex-wrap gap-2">
              {safeArray(crossAnalysisSynthesis?.primaryMessagingAngles).map((angle, i) => (
                <Badge key={i} variant="outline" className="text-base py-1 px-3">{angle}</Badge>
              ))}
            </div>
          </SubSection>

          {/* Recommended Platforms */}
          <SubSection title="Recommended Platforms">
            <div className="grid md:grid-cols-3 gap-4">
              {(crossAnalysisSynthesis?.recommendedPlatforms || []).map((plat, i) => (
                <div key={i} className={cn(
                  "p-4 rounded-lg border",
                  plat?.priority === "primary" ? "bg-primary/10 border-primary" : "bg-muted/30"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{safeRender(plat?.platform)}</h4>
                    <Badge variant={plat?.priority === "primary" ? "default" : "secondary"}>
                      {safeRender(plat?.priority)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{safeRender(plat?.reasoning)}</p>
                </div>
              ))}
            </div>
          </SubSection>

          {/* Critical Success Factors */}
          <SubSection title="Critical Success Factors">
            <ul className="space-y-1">
              {safeArray(crossAnalysisSynthesis?.criticalSuccessFactors).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </SubSection>

          {/* Potential Blockers */}
          {crossAnalysisSynthesis?.potentialBlockers && crossAnalysisSynthesis.potentialBlockers.length > 0 && (
            <SubSection title="Potential Blockers">
              <ul className="space-y-1">
                {safeArray(crossAnalysisSynthesis.potentialBlockers).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </SubSection>
          )}

          {/* Next Steps */}
          <SubSection title="Recommended Next Steps">
            <ol className="space-y-2">
              {safeArray(crossAnalysisSynthesis?.nextSteps).map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium shrink-0">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{item}</span>
                </li>
              ))}
            </ol>
          </SubSection>
        </Section>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>Strategic Blueprint v{metadata.version}</p>
          <p>Generated on {new Date(metadata.generatedAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
