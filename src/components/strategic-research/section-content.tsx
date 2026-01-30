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
  Image,
  DollarSign,
  Sparkles,
  Tag,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EditableText, EditableList } from "./editable";
import { SourcedText, SourcedListItem } from "./citations";
import { AdCreativeCarousel } from "./ad-creative-carousel";
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
  PricingTier,
  CompetitorOffer,
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

/** Format a PricingTier to a string for editing */
function formatPricingTier(tier: PricingTier): string {
  return `${tier.tier}: ${tier.price}`;
}

/** Parse pricing tier strings back to PricingTier objects */
function parsePricingTierStrings(strings: string[]): PricingTier[] {
  return strings.map(s => {
    const [tier, ...priceParts] = s.split(':');
    return {
      tier: tier.trim(),
      price: priceParts.join(':').trim() || 'Custom',
    };
  });
}

// =============================================================================
// Helper Components (adapted from strategic-blueprint-display.tsx)
// =============================================================================

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 mb-6">
      <h3
        className="font-semibold text-sm uppercase tracking-wide border-l-4 pl-3"
        style={{
          color: 'var(--text-tertiary)',
          borderColor: 'var(--accent-blue)',
          fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }} />
      <span>{children}</span>
    </li>
  );
}

function BoolCheck({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span
        className={value ? "" : "text-muted-foreground"}
        style={value ? { color: 'var(--text-heading)' } : {}}
      >
        {label}
      </span>
    </div>
  );
}

function ScoreDisplay({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const percentage = (score / max) * 100;
  const getBarColor = () => {
    if (percentage >= 70) return 'var(--gradient-primary)';
    if (percentage >= 50) return 'linear-gradient(90deg, #f59e0b, #fbbf24)'; // yellow gradient
    return 'linear-gradient(90deg, #ef4444, #f87171)'; // red gradient
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span
          className="font-medium"
          style={{
            fontFamily: 'var(--font-mono), monospace',
            color: percentage >= 70 ? 'var(--accent-blue)' : 'var(--text-heading)'
          }}
        >
          {score}/{max}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            background: getBarColor(),
            boxShadow: percentage >= 70 ? '0 0 8px rgba(54, 94, 255, 0.3)' : 'none'
          }}
        />
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
// Shared Props Interface for Editable Content
// =============================================================================

interface EditableContentProps {
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}

// =============================================================================
// Section 1: Industry & Market Overview Content
// =============================================================================

interface IndustryMarketContentProps extends EditableContentProps {
  data: IndustryMarketOverview;
}

function IndustryMarketContent({ data, isEditing, onFieldChange }: IndustryMarketContentProps) {
  return (
    <div className="space-y-6">
      {/* Category Snapshot */}
      <SubSection title="Category Snapshot">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Category</p>
            <p className="font-medium" style={{ color: 'var(--text-heading)' }}>
              {isEditing && onFieldChange ? (
                <EditableText
                  value={safeRender(data?.categorySnapshot?.category)}
                  onSave={(v) => onFieldChange("categorySnapshot.category", v)}
                />
              ) : (
                <SourcedText>{safeRender(data?.categorySnapshot?.category)}</SourcedText>
              )}
            </p>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Market Maturity</p>
            <Badge variant="outline" className="mt-1 capitalize">
              {safeRender(data?.categorySnapshot?.marketMaturity)}
            </Badge>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Awareness Level</p>
            <Badge variant="outline" className="mt-1 capitalize">
              {safeRender(data?.categorySnapshot?.awarenessLevel)}
            </Badge>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Buying Behavior</p>
            <p className="font-medium capitalize" style={{ color: 'var(--text-heading)' }}>{safeRender(data?.categorySnapshot?.buyingBehavior)?.replace("_", " ")}</p>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Sales Cycle</p>
            <p className="font-medium" style={{ color: 'var(--text-heading)' }}>
              <SourcedText>{safeRender(data?.categorySnapshot?.averageSalesCycle)}</SourcedText>
            </p>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>Seasonality</p>
            <p className="font-medium" style={{ color: 'var(--text-heading)' }}>
              <SourcedText>{safeRender(data?.categorySnapshot?.seasonality)}</SourcedText>
            </p>
          </div>
        </div>
      </SubSection>

      {/* Market Dynamics */}
      <SubSection title="Market Dynamics">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
              <TrendingUp className="h-4 w-4" style={{ color: 'var(--success)' }} />
              Demand Drivers
            </h4>
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.marketDynamics?.demandDrivers)}
                onSave={(v) => onFieldChange("marketDynamics.demandDrivers", v)}
                renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.marketDynamics?.demandDrivers).map((item, i) => (
                  <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
              <Target className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
              Buying Triggers
            </h4>
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.marketDynamics?.buyingTriggers)}
                onSave={(v) => onFieldChange("marketDynamics.buyingTriggers", v)}
                renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.marketDynamics?.buyingTriggers).map((item, i) => (
                  <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-4">
          <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
            <Shield className="h-4 w-4 text-orange-600" />
            Barriers to Purchase
          </h4>
          {isEditing && onFieldChange ? (
            <EditableList
              items={safeArray(data?.marketDynamics?.barriersToPurchase)}
              onSave={(v) => onFieldChange("marketDynamics.barriersToPurchase", v)}
              renderPrefix={() => <AlertTriangle className="h-4 w-4 text-orange-500" />}
            />
          ) : (
            <ul className="space-y-1">
              {safeArray(data?.marketDynamics?.barriersToPurchase).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SubSection>

      {/* Pain Points */}
      <SubSection title="Pain Points">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2 text-red-500">Primary Pain Points</h4>
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.painPoints?.primary)}
                onSave={(v) => onFieldChange("painPoints.primary", v)}
                renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.painPoints?.primary).map((item, i) => (
                  <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-medium mb-2 text-orange-500">Secondary Pain Points</h4>
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.painPoints?.secondary)}
                onSave={(v) => onFieldChange("painPoints.secondary", v)}
                renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.painPoints?.secondary).map((item, i) => (
                  <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SubSection>

      {/* Psychological Drivers */}
      <SubSection title="Psychological Drivers">
        <div className="grid md:grid-cols-2 gap-4">
          {(data?.psychologicalDrivers?.drivers || []).map((driver, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border-l-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderLeftColor: 'var(--accent-blue)'
              }}
            >
              <p className="font-medium flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                <Brain className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
                {safeRender(driver?.driver)}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{safeRender(driver?.description)}</p>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Audience Objections */}
      <SubSection title="Audience Objections">
        <div className="space-y-3">
          {(data?.audienceObjections?.objections || []).map((obj, i) => (
            <div
              key={i}
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
            >
              <p className="font-medium flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                <MessageSquare className="h-4 w-4 text-orange-500" />
                &quot;{safeRender(obj?.objection)}&quot;
              </p>
              <p className="text-sm mt-2 ml-6" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-heading)' }}>Response:</strong> {safeRender(obj?.howToAddress)}
              </p>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Messaging Opportunities */}
      <SubSection title="Messaging Opportunities">
        <div className="space-y-3 mb-4">
          {safeArray(data?.messagingOpportunities?.opportunities).map((item, i) => (
            <div
              key={i}
              className="p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-[var(--shadow-card)]"
            >
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed" style={{ wordBreak: 'break-word' }}>
                {item}
              </p>
            </div>
          ))}
        </div>
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: 'rgba(54, 94, 255, 0.05)',
            borderWidth: '1px',
            borderColor: 'rgba(54, 94, 255, 0.2)'
          }}
        >
          <h4 className="font-medium mb-2" style={{ color: 'var(--text-heading)' }}>Key Recommendations</h4>
          {isEditing && onFieldChange ? (
            <EditableList
              items={safeArray(data?.messagingOpportunities?.summaryRecommendations)}
              onSave={(v) => onFieldChange("messagingOpportunities.summaryRecommendations", v)}
              renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
            />
          ) : (
            <ul className="space-y-1">
              {safeArray(data?.messagingOpportunities?.summaryRecommendations).map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </ul>
          )}
        </div>
      </SubSection>
    </div>
  );
}

// =============================================================================
// Section 2: ICP Analysis & Validation Content
// =============================================================================

interface ICPAnalysisContentProps extends EditableContentProps {
  data: ICPAnalysisValidation;
}

function ICPAnalysisContent({ data, isEditing, onFieldChange }: ICPAnalysisContentProps) {
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
        <div className="mt-2">
          {isEditing && onFieldChange ? (
            <EditableText
              value={safeRender(data?.finalVerdict?.reasoning)}
              onSave={(v) => onFieldChange("finalVerdict.reasoning", v)}
              multiline
            />
          ) : (
            <p><SourcedListItem>{safeRender(data?.finalVerdict?.reasoning)}</SourcedListItem></p>
          )}
        </div>
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
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Primary Pain</p>
              <p className="font-medium" style={{ color: 'var(--text-heading)' }}>
                {isEditing && onFieldChange ? (
                  <EditableText
                    value={safeRender(data?.painSolutionFit?.primaryPain)}
                    onSave={(v) => onFieldChange("painSolutionFit.primaryPain", v)}
                  />
                ) : (
                  <SourcedText>{safeRender(data?.painSolutionFit?.primaryPain)}</SourcedText>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Offer Component Solving It</p>
              <p className="font-medium" style={{ color: 'var(--text-heading)' }}>
                {isEditing && onFieldChange ? (
                  <EditableText
                    value={safeRender(data?.painSolutionFit?.offerComponentSolvingIt)}
                    onSave={(v) => onFieldChange("painSolutionFit.offerComponentSolvingIt", v)}
                  />
                ) : (
                  <SourcedText>{safeRender(data?.painSolutionFit?.offerComponentSolvingIt)}</SourcedText>
                )}
              </p>
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
                <ListItem key={i}><SourcedListItem>{signal}</SourcedListItem></ListItem>
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
          <p className="mt-3 text-sm text-muted-foreground">
            <SourcedListItem>{data.economicFeasibility.notes}</SourcedListItem>
          </p>
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
      {(data?.finalVerdict?.recommendations || isEditing) && (
        <SubSection title="Recommendations">
          {isEditing && onFieldChange ? (
            <EditableList
              items={safeArray(data?.finalVerdict?.recommendations)}
              onSave={(v) => onFieldChange("finalVerdict.recommendations", v)}
              renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
            />
          ) : (
            <ul className="space-y-1">
              {safeArray(data?.finalVerdict?.recommendations).map((item, i) => (
                <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
              ))}
            </ul>
          )}
        </SubSection>
      )}
    </div>
  );
}

// =============================================================================
// Section 3: Offer Analysis & Viability Content
// =============================================================================

interface OfferAnalysisContentProps extends EditableContentProps {
  data: OfferAnalysisViability;
}

function OfferAnalysisContent({ data, isEditing, onFieldChange }: OfferAnalysisContentProps) {
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
        <div className="mt-2">
          {isEditing && onFieldChange ? (
            <EditableText
              value={safeRender(data?.recommendation?.reasoning)}
              onSave={(v) => onFieldChange("recommendation.reasoning", v)}
              multiline
            />
          ) : (
            <p><SourcedListItem>{safeRender(data?.recommendation?.reasoning)}</SourcedListItem></p>
          )}
        </div>
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
        <div
          className="mt-4 p-4 rounded-lg text-center"
          style={{
            background: 'rgba(54, 94, 255, 0.1)',
            borderWidth: '1px',
            borderColor: 'rgba(54, 94, 255, 0.3)'
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Overall Score</p>
          <p
            className="text-3xl font-bold"
            style={{
              color: 'var(--accent-blue)',
              fontFamily: 'var(--font-mono), monospace',
              textShadow: '0 0 20px rgba(54, 94, 255, 0.3)'
            }}
          >
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
        {isEditing && onFieldChange ? (
          <EditableList
            items={safeArray(data?.recommendation?.actionItems)}
            onSave={(v) => onFieldChange("recommendation.actionItems", v)}
            renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
          />
        ) : (
          <ul className="space-y-1">
            {safeArray(data?.recommendation?.actionItems).map((item, i) => (
              <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
            ))}
          </ul>
        )}
      </SubSection>
    </div>
  );
}

// =============================================================================
// Section 4: Competitor Analysis Content
// =============================================================================

interface CompetitorAnalysisContentProps extends EditableContentProps {
  data: CompetitorAnalysis;
}

function CompetitorAnalysisContent({ data, isEditing, onFieldChange }: CompetitorAnalysisContentProps) {
  return (
    <div className="space-y-6">
      {/* Competitor Snapshots */}
      <SubSection title="Competitor Snapshots">
        <div className="space-y-4">
          {(data?.competitors || []).map((comp, i) => (
            <div
              key={i}
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
            >
              <h4 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                {isEditing && onFieldChange ? (
                  <EditableText
                    value={safeRender(comp?.name)}
                    onSave={(v) => onFieldChange(`competitors.${i}.name`, v)}
                  />
                ) : (
                  <SourcedText>{safeRender(comp?.name)}</SourcedText>
                )}
                {comp?.website && (
                  <a
                    href={comp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground hover:text-primary transition-colors"
                  >
                    <span className="truncate max-w-[200px]">{comp.website.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                )}
              </h4>
              <div className="text-sm text-muted-foreground mb-3">
                {isEditing && onFieldChange ? (
                  <EditableText
                    value={safeRender(comp?.positioning)}
                    onSave={(v) => onFieldChange(`competitors.${i}.positioning`, v)}
                  />
                ) : (
                  <SourcedListItem>{safeRender(comp?.positioning)}</SourcedListItem>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                {/* Only show simple Offer if no detailed mainOffer exists */}
                {!comp?.mainOffer && (
                  <div>
                    <p style={{ color: 'var(--text-tertiary)' }}>Offer</p>
                    {isEditing && onFieldChange ? (
                      <EditableText
                        value={safeRender(comp?.offer)}
                        onSave={(v) => onFieldChange(`competitors.${i}.offer`, v)}
                      />
                    ) : (
                      <p><SourcedListItem>{safeRender(comp?.offer)}</SourcedListItem></p>
                    )}
                  </div>
                )}
                {/* Only show simple Price if no detailed pricingTiers exist */}
                {!(comp?.pricingTiers && comp.pricingTiers.length > 0) && (
                  <div>
                    <p style={{ color: 'var(--text-tertiary)' }}>Price</p>
                    {isEditing && onFieldChange ? (
                      <EditableText
                        value={safeRender(comp?.price)}
                        onSave={(v) => onFieldChange(`competitors.${i}.price`, v)}
                      />
                    ) : (
                      <p
                        style={{
                          fontFamily: 'var(--font-mono), monospace',
                          color: 'var(--text-heading)'
                        }}
                      >
                        <SourcedText>{safeRender(comp?.price)}</SourcedText>
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <p style={{ color: 'var(--text-tertiary)' }}>Platforms</p>
                  <div className="flex gap-1 flex-wrap">
                    {safeArray(comp?.adPlatforms).map((p, j) => (
                      <Badge key={j} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ color: 'var(--text-tertiary)' }}>Funnels</p>
                  <p style={{ color: 'var(--text-secondary)' }}>{safeRender(comp?.funnels)}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>Strengths</p>
                  {isEditing && onFieldChange ? (
                    <EditableList
                      items={safeArray(comp?.strengths)}
                      onSave={(v) => onFieldChange(`competitors.${i}.strengths`, v)}
                      renderPrefix={() => <span style={{ color: 'var(--success)' }}>+</span>}
                      className="text-sm"
                    />
                  ) : (
                    <ul className="text-sm space-y-1">
                      {safeArray(comp?.strengths).map((s, j) => (
                        <li key={j} style={{ color: 'var(--text-secondary)' }}>+ <SourcedListItem>{s}</SourcedListItem></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-red-500">Weaknesses</p>
                  {isEditing && onFieldChange ? (
                    <EditableList
                      items={safeArray(comp?.weaknesses)}
                      onSave={(v) => onFieldChange(`competitors.${i}.weaknesses`, v)}
                      renderPrefix={() => <span className="text-red-500">-</span>}
                      className="text-sm"
                    />
                  ) : (
                    <ul className="text-sm space-y-1">
                      {safeArray(comp?.weaknesses).map((w, j) => (
                        <li key={j} style={{ color: 'var(--text-secondary)' }}>- <SourcedListItem>{w}</SourcedListItem></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Pricing Tiers - only render if available */}
              {comp?.pricingTiers && comp.pricingTiers.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                    <DollarSign className="h-4 w-4" style={{ color: 'var(--success)' }} />
                    Pricing Tiers
                  </p>
                  {isEditing && onFieldChange ? (
                    <EditableList
                      items={comp.pricingTiers.map(formatPricingTier)}
                      onSave={(v) => onFieldChange(`competitors.${i}.pricingTiers`, parsePricingTierStrings(v))}
                      renderPrefix={() => <DollarSign className="h-3 w-3" style={{ color: 'var(--success)' }} />}
                      className="text-sm"
                    />
                  ) : (
                    <div className="space-y-2">
                      {comp.pricingTiers.map((tier, j) => (
                        <div
                          key={j}
                          className="p-3 rounded text-xs break-words"
                          style={{
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            borderWidth: '1px',
                            borderColor: 'rgba(34, 197, 94, 0.3)',
                          }}
                        >
                          {/* Tier name and price */}
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>
                              {tier.tier}
                            </span>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono), monospace',
                                color: 'var(--success)',
                              }}
                            >
                              {tier.price}
                            </span>
                          </div>
                          {/* Target audience */}
                          {tier.targetAudience && (
                            <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                              For: {tier.targetAudience}
                            </p>
                          )}
                          {/* Description */}
                          {tier.description && (
                            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                              {tier.description}
                            </p>
                          )}
                          {/* Features list */}
                          {tier.features && tier.features.length > 0 && (
                            <ul className="text-xs space-y-0.5 pl-3" style={{ color: 'var(--text-secondary)' }}>
                              {tier.features.map((feature, k) => (
                                <li key={k} className="list-disc list-outside">
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          )}
                          {/* Limitations */}
                          {tier.limitations && (
                            <p className="text-xs mt-2 italic" style={{ color: 'var(--text-tertiary)' }}>
                              Limits: {tier.limitations}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Main Offer - only render if available */}
              {comp?.mainOffer && (
                <div
                  className="mt-4 p-3 rounded-lg"
                  style={{
                    backgroundColor: 'rgba(54, 94, 255, 0.05)',
                    borderWidth: '1px',
                    borderColor: 'rgba(54, 94, 255, 0.2)'
                  }}
                >
                  <p className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                    <Sparkles className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
                    Main Offer
                  </p>
                  <div className="space-y-2 text-sm">
                    <div>
                      {isEditing && onFieldChange ? (
                        <EditableText
                          value={comp.mainOffer.headline}
                          onSave={(v) => onFieldChange(`competitors.${i}.mainOffer.headline`, v)}
                          className="font-semibold"
                        />
                      ) : (
                        <p className="font-semibold">{comp.mainOffer.headline}</p>
                      )}
                    </div>
                    <div>
                      {isEditing && onFieldChange ? (
                        <EditableText
                          value={comp.mainOffer.valueProposition}
                          onSave={(v) => onFieldChange(`competitors.${i}.mainOffer.valueProposition`, v)}
                          className="text-muted-foreground italic"
                        />
                      ) : (
                        <p className="text-muted-foreground italic">{comp.mainOffer.valueProposition}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      CTA: {comp.mainOffer.cta}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Ad Messaging Themes - only render if available */}
              {comp?.adMessagingThemes && comp.adMessagingThemes.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                    <Tag className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
                    Ad Themes
                  </p>
                  {isEditing && onFieldChange ? (
                    <EditableList
                      items={comp.adMessagingThemes}
                      onSave={(v) => onFieldChange(`competitors.${i}.adMessagingThemes`, v)}
                      renderPrefix={() => <Tag className="h-3 w-3" style={{ color: 'var(--accent-blue)' }} />}
                      className="text-sm"
                    />
                  ) : (
                    <div className="space-y-1">
                      {comp.adMessagingThemes.map((theme, j) => (
                        <div
                          key={j}
                          className="py-1.5 px-3 rounded text-xs capitalize break-words"
                          style={{
                            backgroundColor: 'rgba(54, 94, 255, 0.1)',
                            borderWidth: '1px',
                            borderColor: 'rgba(54, 94, 255, 0.3)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {theme}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ad Creatives Carousel */}
              {comp?.adCreatives && comp.adCreatives.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                    <Image className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
                    Ad Creatives ({comp.adCreatives.length})
                  </p>
                  <AdCreativeCarousel ads={comp.adCreatives} />
                </div>
              )}
            </div>
          ))}
        </div>
      </SubSection>

      {/* Creative Library */}
      <SubSection title="Creative Library">
        <div className="mb-4">
          <h4 className="font-medium mb-2">Ad Hooks Competitors Use</h4>
          <div className="space-y-2">
            {safeArray(data?.creativeLibrary?.adHooks).map((hook, i) => (
              <div
                key={i}
                className="py-2 px-3 rounded-lg text-sm break-words"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                &quot;{hook}&quot;
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Creative Formats Used</h4>
          <div className="flex flex-wrap gap-2">
            {data?.creativeLibrary?.creativeFormats?.ugc && (
              <Badge variant="secondary" className="text-sm">UGC</Badge>
            )}
            {data?.creativeLibrary?.creativeFormats?.carousels && (
              <Badge variant="secondary" className="text-sm">Carousels</Badge>
            )}
            {data?.creativeLibrary?.creativeFormats?.statics && (
              <Badge variant="secondary" className="text-sm">Statics</Badge>
            )}
            {data?.creativeLibrary?.creativeFormats?.testimonial && (
              <Badge variant="secondary" className="text-sm">Testimonials</Badge>
            )}
            {data?.creativeLibrary?.creativeFormats?.productDemo && (
              <Badge variant="secondary" className="text-sm">Product Demo</Badge>
            )}
            {!data?.creativeLibrary?.creativeFormats?.ugc &&
             !data?.creativeLibrary?.creativeFormats?.carousels &&
             !data?.creativeLibrary?.creativeFormats?.statics &&
             !data?.creativeLibrary?.creativeFormats?.testimonial &&
             !data?.creativeLibrary?.creativeFormats?.productDemo && (
              <span className="text-sm text-muted-foreground">No formats identified</span>
            )}
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
                <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Headline Structure</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.headlineStructure).map((item, i) => (
                <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">CTA Hierarchy</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.ctaHierarchy).map((item, i) => (
                <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Social Proof Patterns</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.socialProofPatterns).map((item, i) => (
                <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Lead Capture Methods</h4>
            <ul className="space-y-1">
              {safeArray(data?.funnelBreakdown?.leadCaptureMethods).map((item, i) => (
                <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
              ))}
            </ul>
          </div>
          {data?.funnelBreakdown?.formFriction && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Form Friction Level</p>
              <span className="text-sm capitalize">{safeRender(data.funnelBreakdown.formFriction)}</span>
            </div>
          )}
        </div>
      </SubSection>

      {/* Market Strengths & Weaknesses */}
      <SubSection title="Market Strengths & Weaknesses">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2" style={{ color: 'var(--success)' }}>Market Strengths</h4>
            <ul className="space-y-1">
              {safeArray(data?.marketStrengths).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}><SourcedListItem>{item}</SourcedListItem></span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-red-500">Market Weaknesses</h4>
            <ul className="space-y-1">
              {safeArray(data?.marketWeaknesses).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                  <span style={{ color: 'var(--text-secondary)' }}><SourcedListItem>{item}</SourcedListItem></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SubSection>

      {/* Gaps & Opportunities */}
      <SubSection title="Gaps & Opportunities">
        <div className="grid md:grid-cols-3 gap-4">
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderWidth: '1px',
              borderColor: 'rgba(34, 197, 94, 0.3)'
            }}
          >
            <h4 className="font-medium mb-2" style={{ color: 'var(--success)' }}>Messaging Opportunities</h4>
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.gapsAndOpportunities?.messagingOpportunities)}
                onSave={(v) => onFieldChange("gapsAndOpportunities.messagingOpportunities", v)}
                renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
                className="text-sm"
              />
            ) : (
              <ul className="text-sm space-y-1">
                {safeArray(data?.gapsAndOpportunities?.messagingOpportunities).map((item, i) => (
                  <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                ))}
              </ul>
            )}
          </div>
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: 'rgba(54, 94, 255, 0.1)',
              borderWidth: '1px',
              borderColor: 'rgba(54, 94, 255, 0.3)'
            }}
          >
            <h4 className="font-medium mb-2" style={{ color: 'var(--accent-blue)' }}>Creative Opportunities</h4>
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.gapsAndOpportunities?.creativeOpportunities)}
                onSave={(v) => onFieldChange("gapsAndOpportunities.creativeOpportunities", v)}
                renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
                className="text-sm"
              />
            ) : (
              <ul className="text-sm space-y-1">
                {safeArray(data?.gapsAndOpportunities?.creativeOpportunities).map((item, i) => (
                  <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
            <h4 className="font-medium text-purple-400 mb-2">Funnel Opportunities</h4>
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.gapsAndOpportunities?.funnelOpportunities)}
                onSave={(v) => onFieldChange("gapsAndOpportunities.funnelOpportunities", v)}
                renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
                className="text-sm"
              />
            ) : (
              <ul className="text-sm space-y-1">
                {safeArray(data?.gapsAndOpportunities?.funnelOpportunities).map((item, i) => (
                  <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SubSection>
    </div>
  );
}

// =============================================================================
// Section 5: Cross-Analysis Synthesis Content
// =============================================================================

interface CrossAnalysisContentProps extends EditableContentProps {
  data: CrossAnalysisSynthesis;
}

function CrossAnalysisContent({ data, isEditing, onFieldChange }: CrossAnalysisContentProps) {
  return (
    <div className="space-y-6">
      {/* Key Insights */}
      <SubSection title="Key Strategic Insights">
        <div className="space-y-3">
          {(data?.keyInsights || []).map((insight, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border-l-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderLeftColor: 'var(--accent-blue)'
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-heading)' }}>{safeRender(insight?.insight)}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-heading)' }}>Implication:</strong> {safeRender(insight?.implication)}
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
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: 'rgba(54, 94, 255, 0.05)',
            borderWidth: '1px',
            borderColor: 'rgba(54, 94, 255, 0.2)'
          }}
        >
          {isEditing && onFieldChange ? (
            <EditableText
              value={safeRender(data?.recommendedPositioning)}
              onSave={(v) => onFieldChange("recommendedPositioning", v)}
              multiline
              className="text-lg"
            />
          ) : (
            <p className="text-lg" style={{ color: 'var(--text-heading)' }}>{safeRender(data?.recommendedPositioning)}</p>
          )}
        </div>
      </SubSection>

      {/* Primary Messaging Angles */}
      <SubSection title="Primary Messaging Angles">
        {isEditing && onFieldChange ? (
          <EditableList
            items={safeArray(data?.primaryMessagingAngles)}
            onSave={(v) => onFieldChange("primaryMessagingAngles", v)}
          />
        ) : (
          <div className="space-y-2">
            {safeArray(data?.primaryMessagingAngles).map((angle, i) => (
              <div
                key={i}
                className="py-2 px-4 rounded-lg text-base font-medium break-words"
                style={{
                  backgroundColor: 'var(--accent-blue)',
                  color: 'white',
                }}
              >
                {angle}
              </div>
            ))}
          </div>
        )}
      </SubSection>

      {/* Recommended Platforms */}
      <SubSection title="Recommended Platforms">
        <div className="grid md:grid-cols-3 gap-4">
          {(data?.recommendedPlatforms || []).map((plat, i) => (
            <div
              key={i}
              className={cn("p-4 rounded-lg")}
              style={plat?.priority === "primary" ? {
                backgroundColor: 'rgba(54, 94, 255, 0.1)',
                borderWidth: '1px',
                borderColor: 'var(--accent-blue)'
              } : {
                backgroundColor: 'var(--bg-surface)',
                borderWidth: '1px',
                borderColor: 'var(--border-default)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold" style={{ color: 'var(--text-heading)' }}>{safeRender(plat?.platform)}</h4>
                <Badge variant={plat?.priority === "primary" ? "default" : "secondary"}>
                  {safeRender(plat?.priority)}
                </Badge>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{safeRender(plat?.reasoning)}</p>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Critical Success Factors */}
      <SubSection title="Critical Success Factors">
        {isEditing && onFieldChange ? (
          <EditableList
            items={safeArray(data?.criticalSuccessFactors)}
            onSave={(v) => onFieldChange("criticalSuccessFactors", v)}
            renderPrefix={() => <Check className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />}
          />
        ) : (
          <ul className="space-y-1">
            {safeArray(data?.criticalSuccessFactors).map((item, i) => (
              <ListItem key={i}>{item}</ListItem>
            ))}
          </ul>
        )}
      </SubSection>

      {/* Potential Blockers */}
      {(data?.potentialBlockers && data.potentialBlockers.length > 0) || isEditing ? (
        <SubSection title="Potential Blockers">
          {isEditing && onFieldChange ? (
            <EditableList
              items={safeArray(data?.potentialBlockers)}
              onSave={(v) => onFieldChange("potentialBlockers", v)}
              renderPrefix={() => <AlertTriangle className="h-4 w-4 text-orange-500" />}
            />
          ) : (
            <ul className="space-y-1">
              {safeArray(data?.potentialBlockers).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </SubSection>
      ) : null}

      {/* Next Steps */}
      <SubSection title="Recommended Next Steps">
        {isEditing && onFieldChange ? (
          <EditableList
            items={safeArray(data?.nextSteps)}
            onSave={(v) => onFieldChange("nextSteps", v)}
            renderPrefix={(index) => (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium shrink-0">
                {index + 1}
              </span>
            )}
          />
        ) : (
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
        )}
      </SubSection>
    </div>
  );
}

// =============================================================================
// Main Section Content Renderer
// =============================================================================

export interface SectionContentRendererProps {
  sectionKey: StrategicBlueprintSection;
  data: unknown;
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}

export function SectionContentRenderer({
  sectionKey,
  data,
  isEditing,
  onFieldChange,
}: SectionContentRendererProps) {
  switch (sectionKey) {
    case "industryMarketOverview":
      return <IndustryMarketContent data={data as IndustryMarketOverview} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "icpAnalysisValidation":
      return <ICPAnalysisContent data={data as ICPAnalysisValidation} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "offerAnalysisViability":
      return <OfferAnalysisContent data={data as OfferAnalysisViability} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "competitorAnalysis":
      return <CompetitorAnalysisContent data={data as CompetitorAnalysis} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "crossAnalysisSynthesis":
      return <CrossAnalysisContent data={data as CrossAnalysisSynthesis} isEditing={isEditing} onFieldChange={onFieldChange} />;
    default:
      return <div className="text-muted-foreground">Unknown section type</div>;
  }
}
