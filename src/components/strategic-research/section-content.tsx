"use client";

import {
  TrendingUp,
  Target,
  Shield,
  Brain,
  MessageSquare,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  StrategicBlueprintSection,
  IndustryMarketOverview,
  ICPAnalysisValidation,
  OfferAnalysisViability,
  CompetitorAnalysis,
  CrossAnalysisSynthesis,
  ValidationStatus,
  RiskRating,
  OfferRecommendation,
} from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Helper Functions (adapted from strategic-blueprint-display.tsx)
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
// Helper Components (adapted from strategic-blueprint-display.tsx)
// =============================================================================

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

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

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

// =============================================================================
// Status Colors
// =============================================================================

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

// =============================================================================
// Section 1: Industry & Market Overview Content
// =============================================================================

function IndustryMarketContent({ data }: { data: IndustryMarketOverview }) {
  return (
    <div className="space-y-6">
      {/* Category Snapshot */}
      <SubSection title="Category Snapshot">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase">Category</p>
            <p className="font-medium">{safeRender(data?.categorySnapshot?.category)}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase">Market Maturity</p>
            <Badge variant="outline" className="mt-1 capitalize">
              {safeRender(data?.categorySnapshot?.marketMaturity)}
            </Badge>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase">Awareness Level</p>
            <Badge variant="outline" className="mt-1 capitalize">
              {safeRender(data?.categorySnapshot?.awarenessLevel)}
            </Badge>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase">Buying Behavior</p>
            <p className="font-medium capitalize">{safeRender(data?.categorySnapshot?.buyingBehavior)?.replace("_", " ")}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase">Sales Cycle</p>
            <p className="font-medium">{safeRender(data?.categorySnapshot?.averageSalesCycle)}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase">Seasonality</p>
            <p className="font-medium">{safeRender(data?.categorySnapshot?.seasonality)}</p>
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
              {safeArray(data?.marketDynamics?.demandDrivers).map((item, i) => (
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
              {safeArray(data?.marketDynamics?.buyingTriggers).map((item, i) => (
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
            {safeArray(data?.marketDynamics?.barriersToPurchase).map((item, i) => (
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
              {safeArray(data?.painPoints?.primary).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-orange-600">Secondary Pain Points</h4>
            <ul className="space-y-1">
              {safeArray(data?.painPoints?.secondary).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
        </div>
      </SubSection>

      {/* Psychological Drivers */}
      <SubSection title="Psychological Drivers">
        <div className="grid md:grid-cols-2 gap-4">
          {(data?.psychologicalDrivers?.drivers || []).map((driver, i) => (
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
          {(data?.audienceObjections?.objections || []).map((obj, i) => (
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
          {safeArray(data?.messagingOpportunities?.opportunities).map((item, i) => (
            <Badge key={i} variant="secondary">{item}</Badge>
          ))}
        </div>
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <h4 className="font-medium mb-2">Key Recommendations</h4>
          <ul className="space-y-1">
            {safeArray(data?.messagingOpportunities?.summaryRecommendations).map((item, i) => (
              <ListItem key={i}>{item}</ListItem>
            ))}
          </ul>
        </div>
      </SubSection>
    </div>
  );
}

// =============================================================================
// Section 2: ICP Analysis & Validation Content
// =============================================================================

function ICPAnalysisContent({ data }: { data: ICPAnalysisValidation }) {
  return (
    <div className="space-y-6">
      {/* Final Verdict Banner */}
      <div className={cn(
        "p-4 rounded-lg border",
        VALIDATION_STATUS_COLORS[data?.finalVerdict?.status || "workable"]
      )}>
        <div className="flex items-center gap-2 font-medium text-lg">
          {data?.finalVerdict?.status === "validated" && <CheckCircle2 className="h-5 w-5" />}
          {data?.finalVerdict?.status === "workable" && <AlertTriangle className="h-5 w-5" />}
          {data?.finalVerdict?.status === "invalid" && <XCircle className="h-5 w-5" />}
          ICP Status: {safeRender(data?.finalVerdict?.status)?.toUpperCase()}
        </div>
        <p className="mt-2">{safeRender(data?.finalVerdict?.reasoning)}</p>
      </div>

      {/* Coherence Check */}
      <SubSection title="ICP Coherence Check">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <BoolCheck value={data?.coherenceCheck?.clearlyDefined || false} label="Clearly Defined" />
          <BoolCheck value={data?.coherenceCheck?.reachableThroughPaidChannels || false} label="Reachable via Paid Channels" />
          <BoolCheck value={data?.coherenceCheck?.adequateScale || false} label="Adequate Scale" />
          <BoolCheck value={data?.coherenceCheck?.hasPainOfferSolves || false} label="Has Pain Offer Solves" />
          <BoolCheck value={data?.coherenceCheck?.hasBudgetAndAuthority || false} label="Has Budget & Authority" />
        </div>
      </SubSection>

      {/* Pain-Solution Fit */}
      <SubSection title="Pain-Solution Fit">
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Primary Pain</p>
              <p className="font-medium">{safeRender(data?.painSolutionFit?.primaryPain)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Offer Component Solving It</p>
              <p className="font-medium">{safeRender(data?.painSolutionFit?.offerComponentSolvingIt)}</p>
            </div>
          </div>
          <div className="mt-4">
            <Badge className={cn(
              data?.painSolutionFit?.fitAssessment === "strong" ? "bg-green-500/20 text-green-400" :
              data?.painSolutionFit?.fitAssessment === "moderate" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-red-500/20 text-red-400"
            )}>
              Fit: {safeRender(data?.painSolutionFit?.fitAssessment)?.toUpperCase()}
            </Badge>
          </div>
        </div>
      </SubSection>

      {/* Market Reachability */}
      <SubSection title="Market Size & Reachability">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          <BoolCheck value={data?.marketReachability?.metaVolume || false} label="Meta Audience Volume" />
          <BoolCheck value={data?.marketReachability?.linkedInVolume || false} label="LinkedIn Volume" />
          <BoolCheck value={data?.marketReachability?.googleSearchDemand || false} label="Google Search Demand" />
        </div>
        {data?.marketReachability?.contradictingSignals && data.marketReachability.contradictingSignals.length > 0 && (
          <div className="mt-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
            <p className="text-sm font-medium text-orange-400 mb-1">Contradicting Signals</p>
            <ul className="text-sm space-y-1">
              {data.marketReachability.contradictingSignals.map((signal, i) => (
                <ListItem key={i}>{signal}</ListItem>
              ))}
            </ul>
          </div>
        )}
      </SubSection>

      {/* Economic Feasibility */}
      <SubSection title="Economic Feasibility">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <BoolCheck value={data?.economicFeasibility?.hasBudget || false} label="ICP Has Budget" />
          <BoolCheck value={data?.economicFeasibility?.purchasesSimilar || false} label="Purchases Similar Solutions" />
          <BoolCheck value={data?.economicFeasibility?.tamAlignedWithCac || false} label="TAM Aligns with CAC" />
        </div>
        {data?.economicFeasibility?.notes && (
          <p className="mt-3 text-sm text-muted-foreground">{data.economicFeasibility.notes}</p>
        )}
      </SubSection>

      {/* Risk Assessment */}
      <SubSection title="Risk Assessment">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["reachability", "budget", "painStrength", "competitiveness"] as const).map((key) => (
            <div key={key} className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">{key.replace(/([A-Z])/g, " $1")}</p>
              <Badge className={cn("mt-2", RISK_COLORS[data?.riskAssessment?.[key] || "medium"])}>
                {safeRender(data?.riskAssessment?.[key])?.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Recommendations */}
      {data?.finalVerdict?.recommendations && (
        <SubSection title="Recommendations">
          <ul className="space-y-1">
            {safeArray(data.finalVerdict.recommendations).map((item, i) => (
              <ListItem key={i}>{item}</ListItem>
            ))}
          </ul>
        </SubSection>
      )}
    </div>
  );
}

// =============================================================================
// Section 3: Offer Analysis & Viability Content
// =============================================================================

function OfferAnalysisContent({ data }: { data: OfferAnalysisViability }) {
  return (
    <div className="space-y-6">
      {/* Recommendation Banner */}
      <div className={cn(
        "p-4 rounded-lg border",
        OFFER_RECOMMENDATION_COLORS[data?.recommendation?.status || "proceed"]
      )}>
        <div className="font-medium text-lg capitalize">
          Recommendation: {safeRender(data?.recommendation?.status)?.replace(/_/g, " ")}
        </div>
        <p className="mt-2">{safeRender(data?.recommendation?.reasoning)}</p>
      </div>

      {/* Offer Clarity */}
      <SubSection title="Offer Clarity">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <BoolCheck value={data?.offerClarity?.clearlyArticulated || false} label="Clearly Articulated" />
          <BoolCheck value={data?.offerClarity?.solvesRealPain || false} label="Solves Real Pain" />
          <BoolCheck value={data?.offerClarity?.benefitsEasyToUnderstand || false} label="Benefits Easy to Understand" />
          <BoolCheck value={data?.offerClarity?.transformationMeasurable || false} label="Transformation Measurable" />
          <BoolCheck value={data?.offerClarity?.valuePropositionObvious || false} label="Value Prop Obvious in 3s" />
        </div>
      </SubSection>

      {/* Offer Strength Scores */}
      <SubSection title="Offer Strength Scores">
        <div className="grid md:grid-cols-2 gap-4">
          <ScoreDisplay label="Pain Relevance" score={data?.offerStrength?.painRelevance || 0} />
          <ScoreDisplay label="Urgency" score={data?.offerStrength?.urgency || 0} />
          <ScoreDisplay label="Differentiation" score={data?.offerStrength?.differentiation || 0} />
          <ScoreDisplay label="Tangibility" score={data?.offerStrength?.tangibility || 0} />
          <ScoreDisplay label="Proof" score={data?.offerStrength?.proof || 0} />
          <ScoreDisplay label="Pricing Logic" score={data?.offerStrength?.pricingLogic || 0} />
        </div>
        <div className="mt-4 p-4 bg-primary/10 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">Overall Score</p>
          <p className="text-3xl font-bold text-primary">
            {(data?.offerStrength?.overallScore || 0).toFixed(1)}/10
          </p>
        </div>
      </SubSection>

      {/* Market-Offer Fit */}
      <SubSection title="Market-Offer Fit">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <BoolCheck value={data?.marketOfferFit?.marketWantsNow || false} label="Market Wants This Now" />
          <BoolCheck value={data?.marketOfferFit?.competitorsOfferSimilar || false} label="Competitors Offer Similar" />
          <BoolCheck value={data?.marketOfferFit?.priceMatchesExpectations || false} label="Price Matches Expectations" />
          <BoolCheck value={data?.marketOfferFit?.proofStrongForColdTraffic || false} label="Proof Strong for Cold Traffic" />
          <BoolCheck value={data?.marketOfferFit?.transformationBelievable || false} label="Transformation Believable" />
        </div>
      </SubSection>

      {/* Red Flags */}
      {data?.redFlags && data.redFlags.length > 0 && (
        <SubSection title="Red Flags">
          <div className="flex flex-wrap gap-2">
            {data.redFlags.map((flag, i) => (
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
          {safeArray(data?.recommendation?.actionItems).map((item, i) => (
            <ListItem key={i}>{item}</ListItem>
          ))}
        </ul>
      </SubSection>
    </div>
  );
}

// =============================================================================
// Section 4: Competitor Analysis Content
// =============================================================================

function CompetitorAnalysisContent({ data }: { data: CompetitorAnalysis }) {
  return (
    <div className="space-y-6">
      {/* Competitor Snapshots */}
      <SubSection title="Competitor Snapshots">
        <div className="space-y-4">
          {(data?.competitors || []).map((comp, i) => (
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
            {safeArray(data?.creativeLibrary?.adHooks).map((hook, i) => (
              <Badge key={i} variant="outline" className="text-sm">&quot;{hook}&quot;</Badge>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Creative Formats Used</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <BoolCheck value={data?.creativeLibrary?.creativeFormats?.ugc || false} label="UGC" />
            <BoolCheck value={data?.creativeLibrary?.creativeFormats?.carousels || false} label="Carousels" />
            <BoolCheck value={data?.creativeLibrary?.creativeFormats?.statics || false} label="Statics" />
            <BoolCheck value={data?.creativeLibrary?.creativeFormats?.testimonial || false} label="Testimonials" />
            <BoolCheck value={data?.creativeLibrary?.creativeFormats?.productDemo || false} label="Product Demo" />
          </div>
        </div>
      </SubSection>

      {/* Funnel Breakdown */}
      <SubSection title="Funnel Breakdown">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Landing Page Patterns</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.landingPagePatterns).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Headline Structure</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.headlineStructure).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">CTA Hierarchy</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.ctaHierarchy).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Social Proof Patterns</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.socialProofPatterns).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Lead Capture Methods</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.leadCaptureMethods).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">Form Friction Level</p>
            <Badge variant="outline" className="mt-1 capitalize">
              {safeRender(data?.funnelBreakdown?.formFriction)}
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
              {safeArray(data?.marketStrengths).map((item, i) => (
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
              {safeArray(data?.marketWeaknesses).map((item, i) => (
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
              {safeArray(data?.gapsAndOpportunities?.messagingOpportunities).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <h4 className="font-medium text-blue-400 mb-2">Creative Opportunities</h4>
            <ul className="text-sm space-y-1">
              {safeArray(data?.gapsAndOpportunities?.creativeOpportunities).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
            <h4 className="font-medium text-purple-400 mb-2">Funnel Opportunities</h4>
            <ul className="text-sm space-y-1">
              {safeArray(data?.gapsAndOpportunities?.funnelOpportunities).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          </div>
        </div>
      </SubSection>
    </div>
  );
}

// =============================================================================
// Section 5: Cross-Analysis Synthesis Content
// =============================================================================

function CrossAnalysisContent({ data }: { data: CrossAnalysisSynthesis }) {
  return (
    <div className="space-y-6">
      {/* Key Insights */}
      <SubSection title="Key Strategic Insights">
        <div className="space-y-3">
          {(data?.keyInsights || []).map((insight, i) => (
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
          <p className="text-lg">{safeRender(data?.recommendedPositioning)}</p>
        </div>
      </SubSection>

      {/* Primary Messaging Angles */}
      <SubSection title="Primary Messaging Angles">
        <div className="flex flex-wrap gap-2">
          {safeArray(data?.primaryMessagingAngles).map((angle, i) => (
            <Badge key={i} variant="outline" className="text-base py-1 px-3">{angle}</Badge>
          ))}
        </div>
      </SubSection>

      {/* Recommended Platforms */}
      <SubSection title="Recommended Platforms">
        <div className="grid md:grid-cols-3 gap-4">
          {(data?.recommendedPlatforms || []).map((plat, i) => (
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
          {safeArray(data?.criticalSuccessFactors).map((item, i) => (
            <ListItem key={i}>{item}</ListItem>
          ))}
        </ul>
      </SubSection>

      {/* Potential Blockers */}
      {data?.potentialBlockers && data.potentialBlockers.length > 0 && (
        <SubSection title="Potential Blockers">
          <ul className="space-y-1">
            {safeArray(data.potentialBlockers).map((item, i) => (
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
          {safeArray(data?.nextSteps).map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium shrink-0">
                {i + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </SubSection>
    </div>
  );
}

// =============================================================================
// Main Section Content Renderer
// =============================================================================

export function SectionContentRenderer({
  sectionKey,
  data,
}: {
  sectionKey: StrategicBlueprintSection;
  data: unknown;
}) {
  switch (sectionKey) {
    case "industryMarketOverview":
      return <IndustryMarketContent data={data as IndustryMarketOverview} />;
    case "icpAnalysisValidation":
      return <ICPAnalysisContent data={data as ICPAnalysisValidation} />;
    case "offerAnalysisViability":
      return <OfferAnalysisContent data={data as OfferAnalysisViability} />;
    case "competitorAnalysis":
      return <CompetitorAnalysisContent data={data as CompetitorAnalysis} />;
    case "crossAnalysisSynthesis":
      return <CrossAnalysisContent data={data as CrossAnalysisSynthesis} />;
    default:
      return <div className="text-muted-foreground">Unknown section type</div>;
  }
}
