"use client";

import * as React from "react";
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
  Star,
  MessageSquareQuote,
  Search,
  Globe,
  Zap,
  TrendingDown,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EditableText, EditableList } from "./editable";
import { SourcedText, SourcedListItem } from "./citations";
import { AnimatePresence, motion } from "framer-motion";
import { AdCreativeCarousel } from "./ad-creative-carousel";
import {
  CompetitorPaginationNav,
  CompetitorCardArrows,
  competitorSlideVariants,
  competitorSlideTransition,
} from "./competitor-pagination";
import { RESEARCH_SUBTLE_BLOCK_CLASS, STATUS_BADGE_COLORS } from "./ui-tokens";
import { CompetitorBottomNav } from "./competitor-bottom-nav";
import { SwipeableCompetitorCard } from "./swipeable-competitor-card";
import type {
  StrategicBlueprintSection,
  IndustryMarketOverview,
  ICPAnalysisValidation,
  OfferAnalysisViability,
  CompetitorAnalysis,
  CrossAnalysisSynthesis,
  KeywordIntelligence,
  KeywordOpportunity,
  DomainKeywordStats,
  ValidationStatus,
  RiskRating,
  RiskScore,
  WhiteSpaceGap,
  OfferRecommendation,
  PricingTier,
  CompetitorOffer,
  SEOAuditData,
  SEOPageCheck,
  PageSpeedMetrics,
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
  // Handle JSON string arrays (e.g. from chat edit tool)
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(safeRender);
      } catch { /* not valid JSON, fall through */ }
    }
    return [value];
  }
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

/** Check if an array-like value has renderable content */
function hasItems(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

/** Placeholder for sections with no data (hidden in read mode, visible context in edit mode) */
function EmptyExplanation({ message }: { message: string }) {
  return (
    <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>
      {message}
    </p>
  );
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

/** Convert markdown-ish review text into readable plain text. */
function cleanReviewText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(text: string, max = 240): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

interface PlatformSearchLink {
  platform: "meta_manager" | "meta_library" | "linkedin" | "google";
  label: string;
  url: string;
}

function extractDomainFromWebsite(website: string | undefined): string | undefined {
  if (!website?.trim()) return undefined;
  const value = website.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return undefined;
  }
}

function getGoogleAdvertiserUrlFromAds(
  adCreatives: Array<{ detailsUrl?: string; platform?: string }> | undefined
): string | undefined {
  if (!adCreatives || adCreatives.length === 0) return undefined;

  for (const ad of adCreatives) {
    if (ad.platform !== "google" || !ad.detailsUrl) continue;
    const match = ad.detailsUrl.match(/adstransparency\.google\.com\/advertiser\/(AR[0-9A-Z]+)/i);
    if (match?.[1]) {
      return `https://adstransparency.google.com/advertiser/${match[1]}?region=US`;
    }
  }

  return undefined;
}

function buildCompetitorPlatformSearchLinks(comp: {
  name?: string;
  website?: string;
  adCreatives?: Array<{ detailsUrl?: string; platform?: string }>;
}): PlatformSearchLink[] {
  const competitorName = (comp.name || "").trim();
  const encodedName = encodeURIComponent(competitorName);
  const domain = extractDomainFromWebsite(comp.website);

  const metaUrl =
    `https://www.facebook.com/adsmanager/`;

  const metaLibraryUrl =
    `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL` +
    `&q=${encodedName}&search_type=keyword_unordered&media_type=all`;

  const linkedInUrl = `https://www.linkedin.com/ad-library/search?keyword=${encodedName}`;

  const advertiserUrl = getGoogleAdvertiserUrlFromAds(comp.adCreatives);
  const googleUrl = advertiserUrl
    ? advertiserUrl
    : domain
      ? `https://adstransparency.google.com/?region=US&domain=${encodeURIComponent(domain)}`
      : `https://adstransparency.google.com/?region=US`;

  return [
    { platform: "meta_manager", label: "Meta Ad Manager", url: metaUrl },
    { platform: "meta_library", label: "Meta Ad Library", url: metaLibraryUrl },
    { platform: "linkedin", label: "LinkedIn Ads", url: linkedInUrl },
    { platform: "google", label: "Google Ads", url: googleUrl },
  ];
}

// =============================================================================
// Helper Components (adapted from strategic-blueprint-display.tsx)
// =============================================================================

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 mb-5">
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
        <XCircle className="h-4 w-4 text-[rgb(239,68,68)]" />
      )}
      <span
        className={value ? "" : "text-[var(--text-tertiary)]"}
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
  validated: STATUS_BADGE_COLORS.success,
  workable: STATUS_BADGE_COLORS.warning,
  invalid: STATUS_BADGE_COLORS.danger,
};

const RISK_COLORS: Record<RiskRating, string> = {
  low: STATUS_BADGE_COLORS.success,
  medium: STATUS_BADGE_COLORS.warning,
  high: STATUS_BADGE_COLORS.caution,
  critical: STATUS_BADGE_COLORS.danger,
};

const OFFER_RECOMMENDATION_COLORS: Record<OfferRecommendation, string> = {
  proceed: STATUS_BADGE_COLORS.success,
  adjust_messaging: STATUS_BADGE_COLORS.warning,
  adjust_pricing: STATUS_BADGE_COLORS.warning,
  icp_refinement_needed: STATUS_BADGE_COLORS.caution,
  major_offer_rebuild: STATUS_BADGE_COLORS.danger,
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
    <div className="space-y-5">
      {/* Category Snapshot */}
      <SubSection title="Category Snapshot">
        <div className="grid grid-cols-3 gap-2.5">
          <div
            className="px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Category</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-heading)' }}>
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
            className="px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Market Maturity</p>
            <Badge variant="outline" className="mt-0.5 capitalize text-xs">
              {safeRender(data?.categorySnapshot?.marketMaturity)}
            </Badge>
          </div>
          <div
            className="px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Awareness Level</p>
            <Badge variant="outline" className="mt-0.5 capitalize text-xs">
              {safeRender(data?.categorySnapshot?.awarenessLevel)}
            </Badge>
          </div>
          <div
            className="px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Buying Behavior</p>
            <p className="text-sm font-medium capitalize mt-0.5" style={{ color: 'var(--text-heading)' }}>{safeRender(data?.categorySnapshot?.buyingBehavior)?.replace("_", " ")}</p>
          </div>
          <div
            className="px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Sales Cycle</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-heading)' }}>
              <SourcedText>{safeRender(data?.categorySnapshot?.averageSalesCycle)}</SourcedText>
            </p>
          </div>
          <div
            className="px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Seasonality</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-heading)' }}>
              <SourcedText>{safeRender(data?.categorySnapshot?.seasonality)}</SourcedText>
            </p>
          </div>
        </div>
      </SubSection>

      {/* Market Dynamics */}
      {(safeArray(data?.marketDynamics?.demandDrivers).length > 0 ||
        safeArray(data?.marketDynamics?.buyingTriggers).length > 0 ||
        safeArray(data?.marketDynamics?.barriersToPurchase).length > 0 ||
        isEditing) && (
        <SubSection title="Market Dynamics">
          <div className="grid md:grid-cols-2 gap-4">
            {(safeArray(data?.marketDynamics?.demandDrivers).length > 0 || isEditing) && (
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
            )}
            {(safeArray(data?.marketDynamics?.buyingTriggers).length > 0 || isEditing) && (
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
            )}
          </div>
          {(safeArray(data?.marketDynamics?.barriersToPurchase).length > 0 || isEditing) && (
            <div className="mt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                <Shield className="h-4 w-4 text-[rgb(251,146,60)]" />
                Barriers to Purchase
              </h4>
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.marketDynamics?.barriersToPurchase)}
                  onSave={(v) => onFieldChange("marketDynamics.barriersToPurchase", v)}
                  renderPrefix={() => <AlertTriangle className="h-4 w-4 text-[rgb(251,146,60)]" />}
                />
              ) : (
                <ul className="space-y-1">
                  {safeArray(data?.marketDynamics?.barriersToPurchase).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(251,146,60)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SubSection>
      )}

      {/* Pain Points */}
      {(safeArray(data?.painPoints?.primary).length > 0 ||
        safeArray(data?.painPoints?.secondary).length > 0 ||
        isEditing) && (
        <SubSection title="Pain Points">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="mb-2 font-medium text-[rgb(252,165,165)]">Primary Pain Points</h4>
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
              <h4 className="mb-2 font-medium text-[rgb(253,186,116)]">Secondary Pain Points</h4>
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
      )}

      {/* Psychological Drivers */}
      {(hasItems(data?.psychologicalDrivers?.drivers) || isEditing) && (
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
      )}

      {/* Audience Objections */}
      {(hasItems(data?.audienceObjections?.objections) || isEditing) && (
        <SubSection title="Audience Objections">
          <div className="space-y-2">
            {(data?.audienceObjections?.objections || []).map((obj, i) => (
              <div
                key={i}
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
              >
                <p className="font-medium flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                  <MessageSquare className="h-4 w-4 text-[rgb(253,186,116)]" />
                  &quot;{safeRender(obj?.objection)}&quot;
                </p>
                <p className="text-sm mt-2 ml-6" style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-heading)' }}>Response:</strong> {safeRender(obj?.howToAddress)}
                </p>
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* Key Recommendations */}
      {(safeArray(data?.messagingOpportunities?.summaryRecommendations).length > 0 || isEditing) && (
        <SubSection title="Key Recommendations">
          <div
            className="p-3 rounded-lg"
            style={{
              backgroundColor: 'rgba(54, 94, 255, 0.05)',
              borderWidth: '1px',
              borderColor: 'rgba(54, 94, 255, 0.2)'
            }}
          >
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
      )}
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
    <div className="space-y-5">
      {/* Final Verdict Banner */}
      <div className={cn(
        "p-3 rounded-lg border",
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
          className="p-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
        >
          <div className="grid md:grid-cols-2 gap-3">
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
              data?.painSolutionFit?.fitAssessment === "strong" ? STATUS_BADGE_COLORS.success :
              data?.painSolutionFit?.fitAssessment === "moderate" ? STATUS_BADGE_COLORS.warning :
              STATUS_BADGE_COLORS.danger
            )}>
              Fit: {safeRender(data?.painSolutionFit?.fitAssessment)?.toUpperCase()}
            </Badge>
          </div>
        </div>
      </SubSection>

      {/* Market Reachability */}
      <SubSection title="Market Size & Reachability">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BoolCheck value={data?.marketReachability?.metaVolume || false} label="Meta Audience Volume" />
          <BoolCheck value={data?.marketReachability?.linkedInVolume || false} label="LinkedIn Volume" />
          <BoolCheck value={data?.marketReachability?.googleSearchDemand || false} label="Google Search Demand" />
        </div>
        {data?.marketReachability?.contradictingSignals && data.marketReachability.contradictingSignals.length > 0 && (
          <div className={`mt-3 p-3 ${RESEARCH_SUBTLE_BLOCK_CLASS}`} style={{ borderColor: "rgba(249,115,22,0.34)" }}>
            <p className="mb-1 text-sm font-medium text-[rgb(253,186,116)]">Contradicting Signals</p>
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <BoolCheck value={data?.economicFeasibility?.hasBudget || false} label="ICP Has Budget" />
          <BoolCheck value={data?.economicFeasibility?.purchasesSimilar || false} label="Purchases Similar Solutions" />
          <BoolCheck value={data?.economicFeasibility?.tamAlignedWithCac || false} label="TAM Aligns with CAC" />
        </div>
        {data?.economicFeasibility?.notes && (
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">
            <SourcedListItem>{data.economicFeasibility.notes}</SourcedListItem>
          </p>
        )}
      </SubSection>

      {/* Risk Scores (new) / Risk Assessment (legacy) */}
      {(hasItems(data?.riskScores) || (data as any)?.riskAssessment || isEditing) && (
      <SubSection title="Risk Assessment">
        {data?.riskScores?.length ? (
          <div className="space-y-3">
            {data.riskScores.map((rs: RiskScore, idx: number) => {
              const score = rs.score ?? rs.probability * rs.impact;
              const classification = rs.classification ?? (score >= 16 ? 'critical' : score >= 9 ? 'high' : score >= 4 ? 'medium' : 'low');
              return (
                <div key={idx} className="rounded-lg bg-[var(--bg-elevated)] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs uppercase text-[var(--text-tertiary)]">{rs.category.replace(/_/g, ' ')}</span>
                    <Badge className={cn(RISK_COLORS[classification as RiskRating] || RISK_COLORS.medium)}>
                      {classification.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm">{rs.risk}</p>
                  <div className="flex gap-4 mt-1 text-xs text-[var(--text-tertiary)]">
                    <span>P: {rs.probability}/5</span>
                    <span>I: {rs.impact}/5</span>
                    <span>Score: {score}/25</span>
                  </div>
                  {rs.mitigation && <p className="text-xs mt-1 text-[var(--text-secondary)]">Mitigation: {rs.mitigation}</p>}
                </div>
              );
            })}
          </div>
        ) : (data as any)?.riskAssessment ? (
          /* Legacy fallback for old blueprints */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["reachability", "budget", "painStrength", "competitiveness"] as const).map((key) => (
              <div key={key} className="rounded-lg bg-[var(--bg-elevated)] p-3 text-center">
                <p className="text-xs uppercase text-[var(--text-tertiary)]">{key.replace(/([A-Z])/g, " $1")}</p>
                <Badge className={cn("mt-2", RISK_COLORS[((data as any).riskAssessment?.[key] || "medium") as RiskRating])}>
                  {safeRender((data as any).riskAssessment?.[key])?.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}
      </SubSection>
      )}

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
    <div className="space-y-5">
      {/* Recommendation Banner */}
      <div className={cn(
        "p-3 rounded-lg border",
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <BoolCheck value={data?.offerClarity?.clearlyArticulated || false} label="Clearly Articulated" />
          <BoolCheck value={data?.offerClarity?.solvesRealPain || false} label="Solves Real Pain" />
          <BoolCheck value={data?.offerClarity?.benefitsEasyToUnderstand || false} label="Benefits Easy to Understand" />
          <BoolCheck value={data?.offerClarity?.transformationMeasurable || false} label="Transformation Measurable" />
          <BoolCheck value={data?.offerClarity?.valuePropositionObvious || false} label="Value Prop Obvious in 3s" />
        </div>
      </SubSection>

      {/* Offer Strength Scores */}
      <SubSection title="Offer Strength Scores">
        <div className="grid md:grid-cols-2 gap-3">
          <ScoreDisplay label="Pain Relevance" score={data?.offerStrength?.painRelevance || 0} />
          <ScoreDisplay label="Urgency" score={data?.offerStrength?.urgency || 0} />
          <ScoreDisplay label="Differentiation" score={data?.offerStrength?.differentiation || 0} />
          <ScoreDisplay label="Tangibility" score={data?.offerStrength?.tangibility || 0} />
          <ScoreDisplay label="Proof" score={data?.offerStrength?.proof || 0} />
          <ScoreDisplay label="Pricing Logic" score={data?.offerStrength?.pricingLogic || 0} />
        </div>
        <div
          className="mt-3 p-3 rounded-lg text-center"
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
      {(safeArray(data?.recommendation?.actionItems).length > 0 || isEditing) && (
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
      )}
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
  // Debug: Log competitor data including ads
  React.useEffect(() => {
    const totalAds = data?.competitors?.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0) ?? 0;
    console.log('[CompetitorAnalysisContent] Rendering with data:', {
      competitorCount: data?.competitors?.length ?? 0,
      totalAds,
      competitors: data?.competitors?.map(c => ({
        name: c.name,
        adCount: c.adCreatives?.length ?? 0,
        pricingTiers: c.pricingTiers?.length ?? 0,
      })),
    });
  }, [data]);

  const [currentCompetitorPage, setCurrentCompetitorPage] = React.useState(0);
  const [competitorDirection, setCompetitorDirection] = React.useState(0);
  const sectionRef = React.useRef<HTMLDivElement>(null);

  const competitors = data?.competitors || [];
  const currentComp = competitors[currentCompetitorPage];

  const goToCompetitor = React.useCallback(
    (page: number) => {
      if (page < 0 || page >= competitors.length || page === currentCompetitorPage) return;
      setCompetitorDirection(page > currentCompetitorPage ? 1 : -1);
      setCurrentCompetitorPage(page);
      // Scroll section top into view if it's scrolled past
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        if (rect.top < 0) {
          sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    },
    [currentCompetitorPage, competitors.length]
  );

  return (
    <div className="space-y-5" ref={sectionRef}>
      {/* Competitor Snapshots */}
      <SubSection title="Competitor Snapshots">
        {competitors.length > 0 && currentComp && (
          <>
            {/* Tab navigation — above the card */}
            {competitors.length > 1 && (
              <CompetitorPaginationNav
                competitors={competitors}
                currentPage={currentCompetitorPage}
                onGoToPage={goToCompetitor}
              />
            )}

            {/* Paginated competitor card with arrow overlays + swipe */}
            <SwipeableCompetitorCard
              onSwipeLeft={() => goToCompetitor(currentCompetitorPage + 1)}
              onSwipeRight={() => goToCompetitor(currentCompetitorPage - 1)}
              canSwipeLeft={currentCompetitorPage < competitors.length - 1}
              canSwipeRight={currentCompetitorPage > 0}
              isEditing={isEditing}
            >
            <div className="relative min-h-[200px]">
              <CompetitorCardArrows
                currentPage={currentCompetitorPage}
                total={competitors.length}
                onPrev={() => goToCompetitor(currentCompetitorPage - 1)}
                onNext={() => goToCompetitor(currentCompetitorPage + 1)}
              />
              <AnimatePresence mode="wait" custom={competitorDirection}>
                <motion.div
                  key={currentCompetitorPage}
                  custom={competitorDirection}
                  variants={competitorSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={competitorSlideTransition}
                  role="tabpanel"
                  id={`competitor-panel-${currentCompetitorPage}`}
                  aria-label={currentComp?.name || `Competitor ${currentCompetitorPage + 1}`}
                >
                  {(() => {
                    const comp = currentComp;
                    const i = currentCompetitorPage;
                    return (
            <div
              key={i}
              className="p-3 rounded-lg"
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
                {(comp as any)?.analysisDepth === 'summary' && (
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-tertiary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    Summary Analysis
                  </span>
                )}
                {comp?.website && (
                  <a
                    href={comp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-normal text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-blue)]"
                  >
                    <span className="truncate max-w-[200px]">{comp.website.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                )}
              </h4>
              {(() => {
                const platformLinks = buildCompetitorPlatformSearchLinks(comp);
                return (
                  <div className="mt-2 mb-3 flex flex-wrap items-center gap-2">
                    {platformLinks.map((link) => (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-secondary)",
                          backgroundColor: "var(--bg-elevated)",
                        }}
                        title={`Open ${link.label} with this competitor pre-filled`}
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                );
              })()}
              <div className="mb-3 text-sm text-[var(--text-tertiary)]">
                {isEditing && onFieldChange ? (
                  <EditableText
                    value={safeRender(comp?.positioning)}
                    onSave={(v) => onFieldChange(`competitors.${i}.positioning`, v)}
                  />
                ) : (
                  <SourcedListItem>{safeRender(comp?.positioning)}</SourcedListItem>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
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
                    {safeArray(comp?.adPlatforms).length > 0 ? (
                      safeArray(comp?.adPlatforms).map((p, j) => (
                        <Badge key={j} variant="outline" className="text-xs">{p}</Badge>
                      ))
                    ) : (
                      <span className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                        No active paid campaigns detected
                      </span>
                    )}
                  </div>
                </div>
                {safeRender(comp?.funnels) && (
                  <div>
                    <p style={{ color: 'var(--text-tertiary)' }}>Funnels</p>
                    <p style={{ color: 'var(--text-secondary)' }}>{safeRender(comp?.funnels)}</p>
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
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
                  <p className="text-sm font-medium text-[rgb(252,165,165)]">Weaknesses</p>
                  {isEditing && onFieldChange ? (
                    <EditableList
                      items={safeArray(comp?.weaknesses)}
                      onSave={(v) => onFieldChange(`competitors.${i}.weaknesses`, v)}
                      renderPrefix={() => <span className="text-[rgb(252,165,165)]">-</span>}
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

              {/* Customer Reviews - only render if reviewData has actual ratings/reviews */}
              {comp?.reviewData && (() => {
                const tp = comp.reviewData!.trustpilot;
                const g2 = comp.reviewData!.g2;
                const hasG2Data = g2 && (g2.rating != null && g2.rating > 0 || g2.reviewCount != null && g2.reviewCount > 0);
                const hasTpData = tp && (tp.trustScore != null && tp.trustScore > 0 || tp.totalReviews != null && tp.totalReviews > 0);
                if (!hasG2Data && !hasTpData) return null;
                const complaints = (tp?.reviews ?? []).filter(r => r.rating <= 2).slice(0, 3);
                const praise = (tp?.reviews ?? []).filter(r => r.rating >= 4).slice(0, 2);
                return (
                  <div className={`mt-3 p-3 ${RESEARCH_SUBTLE_BLOCK_CLASS}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                        <MessageSquareQuote className="h-4 w-4 text-[rgb(245,158,11)]" />
                        Customer Reviews
                      </p>
                      <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                        Voice of customer
                      </span>
                    </div>

                    {/* Rating badges */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      {g2 && g2.rating != null && (g2.rating > 0 || (g2.reviewCount != null && g2.reviewCount > 0)) && (
                        <div className="flex items-center gap-1.5">
                          {g2.url ? (
                            <a href={g2.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-opacity hover:opacity-80">
                              <Badge variant="outline" className="gap-1 border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                G2: {g2.rating.toFixed(1)}/5
                                {g2.reviewCount != null && <span style={{ color: 'var(--text-tertiary)' }}>({g2.reviewCount})</span>}
                                <ExternalLink className="h-3 w-3" />
                              </Badge>
                            </a>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              G2: {g2.rating.toFixed(1)}/5
                              {g2.reviewCount != null && <span style={{ color: 'var(--text-tertiary)' }}>({g2.reviewCount})</span>}
                            </Badge>
                          )}
                          {g2.productCategory && (
                            <Badge variant="secondary" className="text-xs">{g2.productCategory}</Badge>
                          )}
                        </div>
                      )}
                      {tp && tp.trustScore != null && (tp.trustScore > 0 || (tp.totalReviews != null && tp.totalReviews > 0)) && (
                        <a href={tp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-opacity hover:opacity-80">
                          <Badge variant="outline" className="gap-1 border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            Trustpilot: {tp.trustScore.toFixed(1)}/5
                            {tp.totalReviews != null && <span style={{ color: 'var(--text-tertiary)' }}>({tp.totalReviews})</span>}
                            <ExternalLink className="h-3 w-3" />
                          </Badge>
                        </a>
                      )}
                    </div>

                    {tp?.aiSummary && (
                      <p className="mb-3 text-xs italic text-[var(--text-tertiary)]">
                        {excerpt(cleanReviewText(tp.aiSummary), 220)}
                      </p>
                    )}

                    {(complaints.length > 0 || praise.length > 0) && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          <div className={`p-2 ${RESEARCH_SUBTLE_BLOCK_CLASS}`}>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Complaints</p>
                            <p className="mt-1 text-sm font-semibold text-[rgb(252,165,165)]">{complaints.length}</p>
                          </div>
                          <div className={`p-2 ${RESEARCH_SUBTLE_BLOCK_CLASS}`}>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Praise</p>
                            <p className="mt-1 text-sm font-semibold text-[rgb(134,239,172)]">{praise.length}</p>
                          </div>
                          {tp?.totalReviews != null && (
                            <div className={`p-2 ${RESEARCH_SUBTLE_BLOCK_CLASS}`}>
                              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Trustpilot Reviews</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--text-heading)]">{tp.totalReviews}</p>
                            </div>
                          )}
                          {g2?.reviewCount != null && (
                            <div className={`p-2 ${RESEARCH_SUBTLE_BLOCK_CLASS}`}>
                              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">G2 Reviews</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--text-heading)]">{g2.reviewCount}</p>
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                        {complaints.length > 0 && (
                          <div className={`p-3 ${RESEARCH_SUBTLE_BLOCK_CLASS}`} style={{ borderColor: "rgba(239,68,68,0.28)" }}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(252,165,165)]">
                              Top Criticism
                            </p>
                            <div className="space-y-2">
                              {complaints.map((review, j) => (
                                <div key={j} className="rounded-md border border-[var(--border-subtle)] bg-[rgba(7,9,14,0.45)] p-2.5 text-xs">
                                  <div className="mb-1 flex items-center gap-1">
                                    {Array.from({ length: 5 }).map((_, k) => (
                                      <Star
                                        key={k}
                                        className={cn(
                                          'h-3 w-3',
                                          k < review.rating ? 'fill-amber-400 text-amber-400' : 'text-[color:rgba(100,105,115,0.3)]'
                                        )}
                                      />
                                    ))}
                                    {review.date && (
                                      <span className="ml-1 text-[var(--text-tertiary)]">{review.date}</span>
                                    )}
                                  </div>
                                  <p className="leading-relaxed text-[var(--text-secondary)]">
                                    {excerpt(cleanReviewText(review.text || ""), 220)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {praise.length > 0 && (
                          <div className={`p-3 ${RESEARCH_SUBTLE_BLOCK_CLASS}`} style={{ borderColor: "rgba(34,197,94,0.28)" }}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(134,239,172)]">
                              Top Praise
                            </p>
                            <div className="space-y-2">
                              {praise.map((review, j) => (
                                <div key={j} className="rounded-md border border-[var(--border-subtle)] bg-[rgba(7,9,14,0.45)] p-2.5 text-xs">
                                  <div className="mb-1 flex items-center gap-1">
                                    {Array.from({ length: 5 }).map((_, k) => (
                                      <Star
                                        key={k}
                                        className={cn(
                                          'h-3 w-3',
                                          k < review.rating ? 'fill-amber-400 text-amber-400' : 'text-[color:rgba(100,105,115,0.3)]'
                                        )}
                                      />
                                    ))}
                                    {review.date && (
                                      <span className="ml-1 text-[var(--text-tertiary)]">{review.date}</span>
                                    )}
                                  </div>
                                  <p className="leading-relaxed text-[var(--text-secondary)]">
                                    {excerpt(cleanReviewText(review.text || ""), 220)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Pricing Tiers - only render if available */}
              {comp?.pricingTiers && comp.pricingTiers.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                    <DollarSign className="h-4 w-4" style={{ color: 'var(--success)' }} />
                    Pricing Tiers
                  </p>
                  <p className="mb-2 text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                    Prices may vary by region
                  </p>
                  {isEditing && onFieldChange ? (
                    <EditableList
                      items={comp.pricingTiers.map(formatPricingTier)}
                      onSave={(v) => onFieldChange(`competitors.${i}.pricingTiers`, parsePricingTierStrings(v))}
                      renderPrefix={() => <DollarSign className="h-3 w-3" style={{ color: 'var(--success)' }} />}
                      className="text-sm"
                    />
                  ) : (
                    <div className="grid gap-2.5 md:grid-cols-2">
                      {comp.pricingTiers.map((tier, j) => (
                        <div
                          key={j}
                          className={`p-3 text-xs break-words ${RESEARCH_SUBTLE_BLOCK_CLASS}`}
                        >
                          {/* Tier name and price */}
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>
                              {tier.tier}
                            </span>
                            <span
                              className="whitespace-nowrap text-sm"
                              style={{
                                fontFamily: 'var(--font-mono), monospace',
                                color: 'rgb(134,239,172)',
                              }}
                            >
                              {tier.price}
                            </span>
                          </div>
                          {/* Target audience */}
                          {tier.targetAudience && (
                            <Badge variant="outline" className="mb-2 border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[10px] text-[var(--text-tertiary)]">
                              {tier.targetAudience}
                            </Badge>
                          )}
                          {/* Description */}
                          {tier.description && (
                            <p className="mb-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {excerpt(cleanReviewText(tier.description), 140)}
                            </p>
                          )}
                          {/* Features list */}
                          {tier.features && tier.features.length > 0 && (
                            <ul className="space-y-1 pl-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {tier.features.slice(0, 8).map((feature, k) => (
                                <li key={k} className="list-disc list-outside">
                                  {excerpt(cleanReviewText(feature), 84)}
                                </li>
                              ))}
                              {tier.features.length > 8 && (
                                <li className="list-none pl-0 text-xs italic text-[var(--text-tertiary)]">
                                  +{tier.features.length - 8} more features
                                </li>
                              )}
                            </ul>
                          )}
                          {/* Limitations */}
                          {tier.limitations && (
                            <p className="mt-3 border-t border-[var(--border-subtle)] pt-2 text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                              Limits: {excerpt(cleanReviewText(tier.limitations), 90)}
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
                          className="italic text-[var(--text-tertiary)]"
                        />
                      ) : (
                        <p className="italic text-[var(--text-tertiary)]">{comp.mainOffer.valueProposition}</p>
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

              {/* Bottom navigation — always visible after content */}
              <CompetitorBottomNav
                competitors={competitors}
                currentPage={currentCompetitorPage}
                onGoToPage={goToCompetitor}
              />
            </div>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
            </div>
            </SwipeableCompetitorCard>

          </>
        )}
      </SubSection>

      {/* Creative Library */}
      <SubSection title="Creative Library">
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
              <span className="text-sm text-[var(--text-tertiary)]">No formats identified</span>
            )}
          </div>
        </div>
      </SubSection>

      {/* Funnel Breakdown */}
      {(safeArray(data?.funnelBreakdown?.landingPagePatterns).length > 0 ||
        safeArray(data?.funnelBreakdown?.headlineStructure).length > 0 ||
        safeArray(data?.funnelBreakdown?.ctaHierarchy).length > 0 ||
        safeArray(data?.funnelBreakdown?.socialProofPatterns).length > 0 ||
        safeArray(data?.funnelBreakdown?.leadCaptureMethods).length > 0 ||
        isEditing) && (
        <SubSection title="Funnel Breakdown">
          <div className="grid md:grid-cols-2 gap-4">
            {(safeArray(data?.funnelBreakdown?.landingPagePatterns).length > 0 || isEditing) && (
              <div>
                <h4 className="font-medium mb-2">Landing Page Patterns</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.landingPagePatterns).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {(safeArray(data?.funnelBreakdown?.headlineStructure).length > 0 || isEditing) && (
              <div>
                <h4 className="font-medium mb-2">Headline Structure</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.headlineStructure).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {(safeArray(data?.funnelBreakdown?.ctaHierarchy).length > 0 || isEditing) && (
              <div>
                <h4 className="font-medium mb-2">CTA Hierarchy</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.ctaHierarchy).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {(safeArray(data?.funnelBreakdown?.socialProofPatterns).length > 0 || isEditing) && (
              <div>
                <h4 className="font-medium mb-2">Social Proof Patterns</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.socialProofPatterns).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {(safeArray(data?.funnelBreakdown?.leadCaptureMethods).length > 0 || isEditing) && (
              <div>
                <h4 className="font-medium mb-2">Lead Capture Methods</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.leadCaptureMethods).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {data?.funnelBreakdown?.formFriction && (
              <div>
                <p className="mb-1 text-sm text-[var(--text-tertiary)]">Form Friction Level</p>
                <span className="text-sm capitalize">{safeRender(data.funnelBreakdown.formFriction)}</span>
              </div>
            )}
          </div>
        </SubSection>
      )}

      {/* Market Strengths & Weaknesses */}
      {(safeArray(data?.marketStrengths).length > 0 ||
        safeArray(data?.marketWeaknesses).length > 0 ||
        isEditing) && (
        <SubSection title="Market Strengths & Weaknesses">
          <div className="grid md:grid-cols-2 gap-4">
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
              <h4 className="mb-2 font-medium text-[rgb(252,165,165)]">Market Weaknesses</h4>
              <ul className="space-y-1">
                {safeArray(data?.marketWeaknesses).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(252,165,165)]" />
                    <span style={{ color: 'var(--text-secondary)' }}><SourcedListItem>{item}</SourcedListItem></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SubSection>
      )}

      {/* White Space Gaps (new) / Gaps & Opportunities (legacy) */}
      <SubSection title="Gaps & Opportunities">
        {data?.whiteSpaceGaps?.length ? (
          <div className="space-y-3">
            {data.whiteSpaceGaps.map((wsg: WhiteSpaceGap, idx: number) => {
              const typeColors: Record<string, string> = {
                messaging: 'var(--success)',
                feature: 'var(--accent-blue)',
                audience: 'rgb(196,181,253)',
                channel: 'var(--accent-amber)',
              };
              const color = typeColors[wsg.type] || 'var(--text-secondary)';
              return (
                <div key={idx} className="rounded-lg bg-[var(--bg-elevated)] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <Badge className="text-xs" style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>{wsg.type}</Badge>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      Exploit: {wsg.exploitability}/10 | Impact: {wsg.impact}/10
                      {wsg.compositeScore != null && ` | Score: ${wsg.compositeScore}`}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{wsg.gap}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">{wsg.evidence}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{wsg.recommendedAction}</p>
                </div>
              );
            })}
          </div>
        ) : (safeArray(data?.gapsAndOpportunities?.messagingOpportunities).length > 0 ||
              safeArray(data?.gapsAndOpportunities?.creativeOpportunities).length > 0 ||
              safeArray(data?.gapsAndOpportunities?.funnelOpportunities).length > 0 ||
              isEditing) ? (
          /* Legacy fallback for old blueprints */
          <div className="grid md:grid-cols-3 gap-3">
            <div
              className="p-3 rounded-lg"
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
              className="p-3 rounded-lg"
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
            <div className={`p-3 ${RESEARCH_SUBTLE_BLOCK_CLASS}`} style={{ borderColor: "rgba(167,139,250,0.34)" }}>
              <h4 className="mb-2 font-medium text-[rgb(196,181,253)]">Funnel Opportunities</h4>
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
        ) : (
          <EmptyExplanation message="No competitive gaps or opportunities identified from available data." />
        )}
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
    <div className="space-y-5">
      {/* Key Insights */}
      {((data?.keyInsights || []).length > 0 || isEditing) && (
        <SubSection title="Key Strategic Insights">
          <div className="space-y-2.5">
            {(data?.keyInsights || []).map((insight, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border-l-4"
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
      )}

      {/* Recommended Positioning */}
      <SubSection title="Recommended Positioning">
        <div
          className="p-3 rounded-lg"
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

      {/* Ad Hooks with Source Attribution (from messagingFramework) */}
      {data?.messagingFramework?.adHooks && data.messagingFramework.adHooks.length > 0 && (
        <SubSection title="Ad Hooks (from Competitor Ads)">
          <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Hooks extracted or inspired by real competitor ads. Green = verbatim, Blue = inspired, Gray = generated.
          </p>
          <div className="space-y-3">
            {data.messagingFramework.adHooks.map((hookItem: any, i: number) => (
              <div
                key={i}
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderWidth: '2px',
                  borderColor: hookItem.source?.type === 'extracted'
                    ? '#22c55e'
                    : hookItem.source?.type === 'inspired'
                      ? 'var(--accent-blue)'
                      : 'var(--border-default)',
                }}
              >
                <p className="font-medium" style={{ color: 'var(--text-heading)' }}>
                  &quot;{typeof hookItem === 'string' ? hookItem : hookItem.hook}&quot;
                </p>
                {typeof hookItem !== 'string' && (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <Badge variant={hookItem.source?.type === 'extracted' ? 'default' : 'secondary'}>
                        {hookItem.source?.type || 'generated'}
                      </Badge>
                      {hookItem.source?.competitors && hookItem.source.competitors.length > 0 && (
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          from: {hookItem.source.competitors.join(', ')}
                        </span>
                      )}
                      {hookItem.source?.platform && (
                        <Badge variant="outline">{hookItem.source.platform}</Badge>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {hookItem.technique && <span>Technique: {hookItem.technique}</span>}
                      {hookItem.technique && hookItem.targetAwareness && <span>•</span>}
                      {hookItem.targetAwareness && <span>Awareness: {hookItem.targetAwareness}</span>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* Recommended Platforms */}
      {((data?.recommendedPlatforms || []).length > 0 || isEditing) && (
        <SubSection title="Recommended Platforms">
          <div className="grid md:grid-cols-3 gap-3">
            {(data?.recommendedPlatforms || []).map((plat, i) => (
              <div
                key={i}
                className={cn("p-3 rounded-lg")}
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
      )}

      {/* Critical Success Factors */}
      {(safeArray(data?.criticalSuccessFactors).length > 0 || isEditing) && (
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
      )}

      {/* Potential Blockers */}
      {(data?.potentialBlockers && data.potentialBlockers.length > 0) || isEditing ? (
        <SubSection title="Potential Blockers">
          {isEditing && onFieldChange ? (
            <EditableList
              items={safeArray(data?.potentialBlockers)}
              onSave={(v) => onFieldChange("potentialBlockers", v)}
              renderPrefix={() => <AlertTriangle className="h-4 w-4 text-[rgb(251,146,60)]" />}
            />
          ) : (
            <ul className="space-y-1">
              {safeArray(data?.potentialBlockers).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(251,146,60)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </SubSection>
      ) : null}

      {/* Next Steps */}
      {(safeArray(data?.nextSteps).length > 0 || isEditing) && (
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
      )}
    </div>
  );
}

// =============================================================================
// Section 6: Keyword Intelligence Content
// =============================================================================

interface KeywordIntelligenceContentProps extends EditableContentProps {
  data: KeywordIntelligence;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: STATUS_BADGE_COLORS.success,
  medium: STATUS_BADGE_COLORS.warning,
  hard: STATUS_BADGE_COLORS.caution,
  veryHard: STATUS_BADGE_COLORS.danger,
};

function getDifficultyLabel(difficulty: number): { label: string; color: string } {
  if (difficulty <= 30) return { label: "Easy", color: DIFFICULTY_COLORS.easy };
  if (difficulty <= 50) return { label: "Medium", color: DIFFICULTY_COLORS.medium };
  if (difficulty <= 70) return { label: "Hard", color: DIFFICULTY_COLORS.hard };
  return { label: "Very Hard", color: DIFFICULTY_COLORS.veryHard };
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return "N/A";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function DomainStatCard({ stats, label }: { stats: DomainKeywordStats; label?: string }) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
        <p className="font-medium text-sm truncate" style={{ color: 'var(--text-heading)' }}>
          {label || stats.domain}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p style={{ color: 'var(--text-tertiary)' }}>Organic KWs</p>
          <p className="font-medium" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-mono), monospace' }}>
            {formatNumber(stats.organicKeywords)}
          </p>
        </div>
        <div>
          <p style={{ color: 'var(--text-tertiary)' }}>Paid KWs</p>
          <p className="font-medium" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-mono), monospace' }}>
            {formatNumber(stats.paidKeywords)}
          </p>
        </div>
        <div>
          <p style={{ color: 'var(--text-tertiary)' }}>Organic Clicks/mo</p>
          <p className="font-medium" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-mono), monospace' }}>
            {formatNumber(stats.monthlyOrganicClicks)}
          </p>
        </div>
        <div>
          <p style={{ color: 'var(--text-tertiary)' }}>Paid Clicks/mo</p>
          <p className="font-medium" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-mono), monospace' }}>
            {formatNumber(stats.monthlyPaidClicks)}
          </p>
        </div>
        {stats.organicClicksValue > 0 && (
          <div>
            <p style={{ color: 'var(--text-tertiary)' }} title="Estimated cost to buy this organic traffic via Google Ads (clicks × CPC). Not actual revenue.">
              Est. Traffic Value
            </p>
            <p className="font-medium" style={{ color: 'var(--success)', fontFamily: 'var(--font-mono), monospace' }}>
              ${formatNumber(stats.organicClicksValue)}
            </p>
          </div>
        )}
        {stats.paidClicksValue > 0 && (
          <div>
            <p style={{ color: 'var(--text-tertiary)' }} title="Estimated monthly ad spend based on paid keyword bids and click volume.">
              Ad Spend/mo
            </p>
            <p className="font-medium" style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono), monospace' }}>
              ${formatNumber(stats.paidClicksValue)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function KeywordTable({ keywords, maxRows = 15 }: { keywords: KeywordOpportunity[]; maxRows?: number }) {
  const [sortBy, setSortBy] = React.useState<'searchVolume' | 'cpc' | 'difficulty'>('searchVolume');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  const sorted = React.useMemo(() => {
    const copy = [...keywords];
    copy.sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      return sortDir === 'desc' ? valB - valA : valA - valB;
    });
    return copy.slice(0, maxRows);
  }, [keywords, sortBy, sortDir, maxRows]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  if (keywords.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No keywords found</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
            <th className="text-left py-2 pr-4 font-medium text-xs" style={{ color: 'var(--text-tertiary)' }}>Keyword</th>
            <th
              className="text-right py-2 px-2 font-medium text-xs cursor-pointer select-none"
              style={{ color: sortBy === 'searchVolume' ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
              onClick={() => toggleSort('searchVolume')}
            >
              Volume {sortBy === 'searchVolume' && (sortDir === 'desc' ? '↓' : '↑')}
            </th>
            <th
              className="text-right py-2 px-2 font-medium text-xs cursor-pointer select-none"
              style={{ color: sortBy === 'cpc' ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
              onClick={() => toggleSort('cpc')}
            >
              CPC {sortBy === 'cpc' && (sortDir === 'desc' ? '↓' : '↑')}
            </th>
            <th
              className="text-right py-2 px-2 font-medium text-xs cursor-pointer select-none"
              style={{ color: sortBy === 'difficulty' ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
              onClick={() => toggleSort('difficulty')}
            >
              Difficulty {sortBy === 'difficulty' && (sortDir === 'desc' ? '↓' : '↑')}
            </th>
            <th className="text-right py-2 pl-2 font-medium text-xs" style={{ color: 'var(--text-tertiary)' }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((kw, i) => {
            const diff = getDifficultyLabel(kw.difficulty);
            return (
              <tr
                key={`${kw.keyword}-${i}`}
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <td className="py-2 pr-4 font-medium" style={{ color: 'var(--text-heading)' }}>
                  {kw.keyword}
                  {kw.competitors && kw.competitors.length > 0 && (
                    <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                      ({kw.competitors.length} competitors)
                    </span>
                  )}
                </td>
                <td className="text-right py-2 px-2" style={{ fontFamily: 'var(--font-mono), monospace', color: 'var(--text-secondary)' }}>
                  {formatNumber(kw.searchVolume)}
                </td>
                <td className="text-right py-2 px-2" style={{ fontFamily: 'var(--font-mono), monospace', color: 'var(--text-secondary)' }}>
                  ${kw.cpc.toFixed(2)}
                </td>
                <td className="text-right py-2 px-2">
                  <Badge className={cn("text-xs", diff.color)}>{diff.label}</Badge>
                </td>
                <td className="text-right py-2 pl-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {kw.source.replace(/_/g, ' ')}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {keywords.length > maxRows && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Showing {maxRows} of {keywords.length} keywords
        </p>
      )}
    </div>
  );
}

// =============================================================================
// SEO Audit Sub-components
// =============================================================================

function SEOScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 80 ? 'var(--success)' : score >= 50 ? 'rgb(245, 158, 11)' : 'var(--destructive)';
  const bgColor = score >= 80 ? 'rgba(34, 197, 94, 0.12)' : score >= 50 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
  const sizes = { sm: 'text-sm px-2 py-0.5', md: 'text-lg px-3 py-1', lg: 'text-2xl px-4 py-2 font-bold' };
  return (
    <span
      className={cn("rounded-md font-semibold inline-flex items-center", sizes[size])}
      style={{ color, backgroundColor: bgColor, fontFamily: 'var(--font-mono), monospace' }}
    >
      {score}/100
    </span>
  );
}

function PassFailIcon({ pass }: { pass: boolean }) {
  return pass
    ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />
    : <XCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--destructive)' }} />;
}

function CoreWebVitalCard({ label, value, unit, thresholds }: {
  label: string;
  value: number;
  unit: string;
  thresholds: { good: number; poor: number };
}) {
  const isGood = value <= thresholds.good;
  const isPoor = value > thresholds.poor;
  const color = isGood ? 'var(--success)' : isPoor ? 'var(--destructive)' : 'rgb(245, 158, 11)';
  const bg = isGood ? 'rgba(34, 197, 94, 0.08)' : isPoor ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)';

  return (
    <div className="p-3 rounded-lg text-center" style={{ backgroundColor: bg, border: `1px solid ${color}20` }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color, fontFamily: 'var(--font-mono), monospace' }}>
        {value}{unit}
      </p>
    </div>
  );
}

function TechnicalSEOAuditSection({ audit }: { audit: SEOAuditData['technical'] }) {
  return (
    <SubSection title="Technical SEO Audit">
      {/* Overview badges */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SEOScoreBadge score={audit.overallScore} />
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" style={{ color: 'var(--destructive)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{audit.issueCount.critical} critical</span>
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'rgb(245, 158, 11)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{audit.issueCount.warning} warnings</span>
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{audit.issueCount.pass} passed</span>
          </span>
        </div>
      </div>

      {/* Site-level checks */}
      <div className="flex gap-3 mb-3">
        <Badge className={cn("text-xs", audit.sitemapFound ? STATUS_BADGE_COLORS.success : STATUS_BADGE_COLORS.danger)}>
          {audit.sitemapFound ? '✓' : '✗'} Sitemap
        </Badge>
        <Badge className={cn("text-xs", audit.robotsTxtFound ? STATUS_BADGE_COLORS.success : STATUS_BADGE_COLORS.danger)}>
          {audit.robotsTxtFound ? '✓' : '✗'} Robots.txt
        </Badge>
      </div>

      {/* Page-by-page table */}
      {audit.pages.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--text-tertiary)' }}>Page</th>
                <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Title</th>
                <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Meta Desc</th>
                <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>H1</th>
                <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Canonical</th>
                <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Images</th>
                <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Schema</th>
                <th className="text-center py-2 pl-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>HTTPS</th>
              </tr>
            </thead>
            <tbody>
              {audit.pages.map((page, i) => {
                // Display short path from URL
                let shortUrl: string;
                try {
                  shortUrl = new URL(page.url).pathname || '/';
                } catch {
                  shortUrl = page.url;
                }

                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="py-2 pr-3 font-medium truncate max-w-[120px]" style={{ color: 'var(--text-heading)' }} title={page.url}>
                      {shortUrl}
                    </td>
                    <td className="text-center py-2 px-2"><PassFailIcon pass={page.title.pass} /></td>
                    <td className="text-center py-2 px-2"><PassFailIcon pass={page.metaDescription.pass} /></td>
                    <td className="text-center py-2 px-2"><PassFailIcon pass={page.h1.pass} /></td>
                    <td className="text-center py-2 px-2"><PassFailIcon pass={page.canonical.pass} /></td>
                    <td className="text-center py-2 px-2">
                      <span style={{
                        color: page.images.coveragePercent >= 80 ? 'var(--success)' : page.images.coveragePercent >= 50 ? 'rgb(245, 158, 11)' : 'var(--destructive)',
                        fontFamily: 'var(--font-mono), monospace',
                      }}>
                        {page.images.coveragePercent}%
                      </span>
                    </td>
                    <td className="text-center py-2 px-2">
                      {page.schemaTypes.length > 0
                        ? <CheckCircle2 className="h-4 w-4 inline" style={{ color: 'var(--success)' }} />
                        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      }
                    </td>
                    <td className="text-center py-2 pl-2"><PassFailIcon pass={page.isHttps} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SubSection>
  );
}

function PerformanceAuditSection({ performance }: { performance: SEOAuditData['performance'] }) {
  const hasData = performance.mobile || performance.desktop;

  if (!hasData) {
    return (
      <SubSection title="Performance (PageSpeed Insights)">
        <div
          className="p-4 rounded-lg text-sm flex items-center gap-2"
          style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <span style={{ color: 'var(--accent-yellow)' }}>&#9888;</span>
          PageSpeed data unavailable — the site may be unreachable, behind authentication, or the API timed out. The overall SEO score reflects technical checks only.
        </div>
      </SubSection>
    );
  }

  const renderMetrics = (metrics: PageSpeedMetrics, label: string) => (
    <div
      className="p-3 rounded-lg flex-1"
      style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm" style={{ color: 'var(--text-heading)' }}>{label}</p>
        <SEOScoreBadge score={metrics.performanceScore} size="sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CoreWebVitalCard label="LCP" value={metrics.lcp} unit="s" thresholds={{ good: 2.5, poor: 4 }} />
        <CoreWebVitalCard label="CLS" value={metrics.cls} unit="" thresholds={{ good: 0.1, poor: 0.25 }} />
        <CoreWebVitalCard label="FCP" value={metrics.fcp} unit="s" thresholds={{ good: 1.8, poor: 3 }} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <CoreWebVitalCard label="TTI" value={metrics.tti} unit="s" thresholds={{ good: 3.8, poor: 7.3 }} />
        <CoreWebVitalCard label="Speed Index" value={metrics.speedIndex} unit="s" thresholds={{ good: 3.4, poor: 5.8 }} />
        <CoreWebVitalCard label="TBT" value={metrics.fid} unit="ms" thresholds={{ good: 200, poor: 600 }} />
      </div>
    </div>
  );

  return (
    <SubSection title="Performance (PageSpeed Insights)">
      <div className="flex flex-col md:flex-row gap-4">
        {performance.mobile && renderMetrics(performance.mobile, 'Mobile')}
        {performance.desktop && renderMetrics(performance.desktop, 'Desktop')}
      </div>
    </SubSection>
  );
}

function KeywordIntelligenceContent({ data, isEditing, onFieldChange }: KeywordIntelligenceContentProps) {
  const [activeTab, setActiveTab] = React.useState<'organic' | 'paid' | 'shared'>('organic');

  const tabKeywords = activeTab === 'organic' ? data?.organicGaps
    : activeTab === 'paid' ? data?.paidGaps
    : data?.sharedKeywords;

  return (
    <div className="space-y-5">
      {/* SEO Audit: Technical */}
      {data?.seoAudit?.technical && (
        <TechnicalSEOAuditSection audit={data.seoAudit.technical} />
      )}

      {/* SEO Audit: Performance */}
      {data?.seoAudit?.performance && (
        <PerformanceAuditSection performance={data.seoAudit.performance} />
      )}

      {/* SEO Audit: Overall Score */}
      {data?.seoAudit && (() => {
        const hasPerf = data.seoAudit!.performance.mobile || data.seoAudit!.performance.desktop;
        return (
          <div
            className="p-3 rounded-lg flex items-center justify-between text-sm"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              Overall SEO Score
              {hasPerf ? ' (60% Technical + 40% Performance)' : ' (Technical only — PageSpeed unavailable)'}
            </span>
            <SEOScoreBadge score={data.seoAudit!.overallScore} />
          </div>
        );
      })()}

      {/* Domain Overview */}
      {(data?.clientDomain || (data?.competitorDomains && data.competitorDomains.length > 0)) && (
        <SubSection title="Domain Overview">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data?.clientDomain && (
              <div className="relative">
                <div
                  className="absolute -top-2 left-3 px-2 text-xs font-medium rounded"
                  style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}
                >
                  Your Site
                </div>
                <DomainStatCard stats={data.clientDomain} />
              </div>
            )}
            {(data?.competitorDomains || []).map((stats, i) => (
              <DomainStatCard key={i} stats={stats} />
            ))}
          </div>
        </SubSection>
      )}

      {/* Keyword Gaps with Tabs */}
      <SubSection title="Keyword Gap Analysis">
        <div className="flex gap-2 mb-4">
          {([
            { key: 'organic' as const, label: 'Organic Gaps', count: data?.organicGaps?.length ?? 0 },
            { key: 'paid' as const, label: 'Paid Gaps', count: data?.paidGaps?.length ?? 0 },
            { key: 'shared' as const, label: 'Shared', count: data?.sharedKeywords?.length ?? 0 },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "text-white"
                  : "hover:opacity-80"
              )}
              style={activeTab === tab.key ? {
                backgroundColor: 'var(--accent-blue)',
              } : {
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
        >
          <KeywordTable keywords={tabKeywords || []} />
        </div>
      </SubSection>

      {/* Quick Wins */}
      {data?.quickWins && data.quickWins.length > 0 && (
        <SubSection title="Quick Win Opportunities">
          <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Low difficulty + decent volume — target these first for fast organic wins.
          </p>
          <div className="grid md:grid-cols-2 gap-2.5">
            {data.quickWins.slice(0, 8).map((kw, i) => (
              <div
                key={i}
                className="p-3 rounded-lg flex items-center justify-between"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.08)',
                  borderWidth: '1px',
                  borderColor: 'rgba(34, 197, 94, 0.25)',
                }}
              >
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text-heading)' }}>{kw.keyword}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {formatNumber(kw.searchVolume)} vol · ${kw.cpc.toFixed(2)} CPC
                  </p>
                </div>
                <Badge className={cn("text-xs", getDifficultyLabel(kw.difficulty).color)}>
                  {kw.difficulty}
                </Badge>
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* Long-Term Plays */}
      {data?.longTermPlays && data.longTermPlays.length > 0 && (
        <SubSection title="Long-Term Plays">
          <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
            High-volume keywords with moderate-to-high difficulty — build authority over 3-6 months with pillar content.
          </p>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <KeywordTable keywords={data.longTermPlays} maxRows={10} />
          </div>
        </SubSection>
      )}

      {/* High-Intent Keywords */}
      {data?.highIntentKeywords && data.highIntentKeywords.length > 0 && (
        <SubSection title="High-Intent Keywords">
          <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
            High CPC signals strong commercial intent — valuable for paid campaigns and conversion-focused content.
          </p>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <KeywordTable keywords={data.highIntentKeywords} maxRows={10} />
          </div>
        </SubSection>
      )}

      {/* Client Strengths */}
      {data?.clientStrengths && data.clientStrengths.length > 0 && (
        <SubSection title="Your Keyword Strengths">
          <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Keywords you rank for that competitors don't — defend these positions and build on them.
          </p>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <KeywordTable keywords={data.clientStrengths} maxRows={10} />
          </div>
        </SubSection>
      )}

      {/* Related Expansions */}
      {data?.relatedExpansions && data.relatedExpansions.length > 0 && (
        <SubSection title="Related Keyword Expansions">
          <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Thematic keyword opportunities beyond direct competitor gaps — expand your content footprint.
          </p>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)' }}
          >
            <KeywordTable keywords={data.relatedExpansions} maxRows={10} />
          </div>
        </SubSection>
      )}

      {/* Content Topic Clusters */}
      {data?.contentTopicClusters && data.contentTopicClusters.length > 0 && (
        <SubSection title="Content Topic Clusters">
          <div className="grid md:grid-cols-2 gap-3">
            {data.contentTopicClusters.map((cluster, i) => (
              <div
                key={i}
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: 'rgba(54, 94, 255, 0.05)',
                  borderWidth: '1px',
                  borderColor: 'rgba(54, 94, 255, 0.2)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm" style={{ color: 'var(--text-heading)' }}>
                    {isEditing && onFieldChange ? (
                      <EditableText
                        value={cluster.theme}
                        onSave={(v) => onFieldChange(`contentTopicClusters.${i}.theme`, v)}
                      />
                    ) : (
                      cluster.theme
                    )}
                  </h4>
                  {isEditing && onFieldChange ? (
                    <EditableText
                      value={cluster.recommendedFormat}
                      onSave={(v) => onFieldChange(`contentTopicClusters.${i}.recommendedFormat`, v)}
                      className="text-xs"
                    />
                  ) : (
                    <Badge variant="outline" className="text-xs capitalize">{cluster.recommendedFormat}</Badge>
                  )}
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono), monospace' }}>
                  {formatNumber(cluster.searchVolumeTotal)} total volume
                </p>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={cluster.keywords}
                    onSave={(v) => onFieldChange(`contentTopicClusters.${i}.keywords`, v)}
                    className="text-xs"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.keywords.slice(0, 6).map((kw, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">{kw}</Badge>
                    ))}
                    {cluster.keywords.length > 6 && (
                      <Badge variant="secondary" className="text-xs">+{cluster.keywords.length - 6}</Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* Strategic Recommendations */}
      {data?.strategicRecommendations && (
        <SubSection title="Strategic Recommendations">
          <div className="grid md:grid-cols-2 gap-4">
            {data.strategicRecommendations.organicStrategy?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2 text-sm" style={{ color: 'var(--success)' }}>
                  <Search className="h-4 w-4" />
                  Organic Strategy
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={data.strategicRecommendations.organicStrategy}
                    onSave={(v) => onFieldChange("strategicRecommendations.organicStrategy", v)}
                    renderPrefix={() => <Search className="h-3 w-3" style={{ color: 'var(--success)' }} />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.strategicRecommendations.organicStrategy.map((item, i) => (
                      <ListItem key={i}>{item}</ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {data.strategicRecommendations.paidSearchStrategy?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2 text-sm" style={{ color: 'var(--accent-blue)' }}>
                  <DollarSign className="h-4 w-4" />
                  Paid Search Strategy
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={data.strategicRecommendations.paidSearchStrategy}
                    onSave={(v) => onFieldChange("strategicRecommendations.paidSearchStrategy", v)}
                    renderPrefix={() => <DollarSign className="h-3 w-3" style={{ color: 'var(--accent-blue)' }} />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.strategicRecommendations.paidSearchStrategy.map((item, i) => (
                      <ListItem key={i}>{item}</ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {data.strategicRecommendations.competitivePositioning?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2 text-sm" style={{ color: 'var(--text-heading)' }}>
                  <Target className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
                  Competitive Positioning
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={data.strategicRecommendations.competitivePositioning}
                    onSave={(v) => onFieldChange("strategicRecommendations.competitivePositioning", v)}
                    renderPrefix={() => <Target className="h-3 w-3" style={{ color: 'var(--accent-blue)' }} />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.strategicRecommendations.competitivePositioning.map((item, i) => (
                      <ListItem key={i}>{item}</ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {data.strategicRecommendations.quickWinActions?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2 text-sm" style={{ color: 'rgb(245, 158, 11)' }}>
                  <Zap className="h-4 w-4" />
                  Quick Win Actions
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={data.strategicRecommendations.quickWinActions}
                    onSave={(v) => onFieldChange("strategicRecommendations.quickWinActions", v)}
                    renderPrefix={() => <Zap className="h-3 w-3" style={{ color: 'rgb(245, 158, 11)' }} />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.strategicRecommendations.quickWinActions.map((item, i) => (
                      <ListItem key={i}>{item}</ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </SubSection>
      )}

      {/* Metadata */}
      {data?.metadata && (
        <div
          className="p-3 rounded-lg text-xs"
          style={{ backgroundColor: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
        >
          <div className="flex flex-wrap gap-4">
            <span>Client: {data.metadata.clientDomain}</span>
            <span>Competitors analyzed: {data.metadata.competitorDomainsAnalyzed.length}</span>
            <span>Keywords analyzed: {formatNumber(data.metadata.totalKeywordsAnalyzed)}</span>
            <span style={{ fontFamily: 'var(--font-mono), monospace' }}>SpyFu cost: ${data.metadata.spyfuCost.toFixed(4)}</span>
            {data.metadata.collectedAt && (
              <span>Collected: {new Date(data.metadata.collectedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}
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
    case "keywordIntelligence":
      return <KeywordIntelligenceContent data={data as KeywordIntelligence} isEditing={isEditing} onFieldChange={onFieldChange} />;
    default:
      return <div className="text-[var(--text-tertiary)]">Unknown section type</div>;
  }
}
