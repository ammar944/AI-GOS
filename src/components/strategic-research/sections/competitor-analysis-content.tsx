"use client";

import * as React from "react";
import {
  ExternalLink,
  Star,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditableText, EditableList } from "../editable";
import { SourcedText, SourcedListItem } from "../citations";
import { AnimatePresence, motion } from "framer-motion";
import { AdCreativeCarousel } from "../ad-creative-carousel";
import {
  CompetitorTabStrip as CompetitorPaginationNav,
  CompetitorFooterNav as CompetitorBottomNav,
  competitorSlideVariants,
  competitorSlideTransition,
} from "../competitor-nav";
import { SwipeableCompetitorCard } from "../swipeable-competitor-card";
import {
  safeRender,
  safeArray,
  formatPricingTier,
  parsePricingTierStrings,
  cleanReviewText,
  excerpt,
  buildCompetitorPlatformSearchLinks,
} from "./shared-helpers";
import {
  SubSection,
  ListItem,
  CardGrid,
  EmptyExplanation,
  FieldHighlightWrapper,
  type EditableContentProps,
} from "./shared-primitives";
import type {
  CompetitorAnalysis,
  WhiteSpaceGap,
  CompetitorSnapshot,
} from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Section 4: Competitor Analysis Content
// =============================================================================

// CompetitorCardArrows removed — redundant with tab strip + swipe navigation

interface CompetitorAnalysisContentProps extends EditableContentProps {
  data: CompetitorAnalysis;
}

// =============================================================================
// Threat classification badge
// =============================================================================

function ThreatBadge({ classification }: { classification: "primary" | "secondary" | "low" }) {
  const styles = {
    primary:
      "bg-[rgba(245,158,11,0.12)] text-[#f59e0b] border border-[rgba(245,158,11,0.25)]",
    secondary:
      "bg-[rgba(100,105,115,0.12)] text-[rgb(100,105,115)] border border-[rgba(100,105,115,0.2)]",
    low: "bg-[rgba(70,75,85,0.12)] text-[rgb(100,105,115)] border border-[rgba(70,75,85,0.2)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded",
        styles[classification]
      )}
    >
      {classification}
    </span>
  );
}

// =============================================================================
// Compact pricing display with disclosure
// =============================================================================

interface PricingDisplayProps {
  comp: CompetitorSnapshot;
  i: number;
  isEditing?: boolean;
  onFieldChange?: (field: string, value: unknown) => void;
}

function PricingDisplay({ comp, i, isEditing, onFieldChange }: PricingDisplayProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const tiers = comp.pricingTiers ?? [];

  if (tiers.length === 0) return null;

  const isHorizontal = tiers.length <= 3;

  const sourceIndicator =
    comp.pricingSource === "scraped" ? (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/70 ml-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 inline-block" />
        verified
      </span>
    ) : comp.pricingNote ? (
      <span className="text-[10px] italic text-[rgb(100,105,115)] ml-2">{comp.pricingNote}</span>
    ) : null;

  return (
    <FieldHighlightWrapper fieldPath={`competitors[${i}].pricingTiers`} className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-medium text-[rgb(252,252,250)]">Pricing</p>
        {sourceIndicator}
      </div>

      {isEditing && onFieldChange ? (
        <EditableList
          items={tiers.map(formatPricingTier)}
          onSave={(v) => onFieldChange(`competitors.${i}.pricingTiers`, parsePricingTierStrings(v))}
          className="text-sm"
        />
      ) : isHorizontal ? (
        /* Horizontal chips for 1–3 tiers */
        <div className="flex flex-wrap gap-2">
          {tiers.map((tier, j) => (
            <div
              key={j}
              className="flex flex-col gap-0.5 px-3 py-2 rounded bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] min-w-[90px]"
            >
              <span className="text-[10px] uppercase tracking-[0.08em] text-[rgb(100,105,115)] font-semibold">
                {tier.tier}
              </span>
              <span className="text-sm font-[family-name:var(--font-mono)] text-[#fbbf4d]">
                {tier.price}
              </span>
              {(tier.targetAudience || tier.limitations) && (
                <span className="text-[10px] text-[rgb(100,105,115)] leading-tight">
                  {excerpt(tier.targetAudience || tier.limitations || "", 40)}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Compact row list for 4+ tiers */
        <div className="space-y-0">
          {tiers.map((tier, j) => (
            <div
              key={j}
              className="flex items-baseline justify-between py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-b-0"
            >
              <span className="text-[11px] uppercase tracking-[0.08em] text-[rgb(100,105,115)] font-semibold">
                {tier.tier}
              </span>
              <span className="text-sm font-[family-name:var(--font-mono)] text-[#fbbf4d]">
                {tier.price}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* View tier details disclosure */}
      {!isEditing && (
        <div className="mt-2">
          <InlineDisclosure
            label={showDetails ? "Hide details" : "Details"}
            isOpen={showDetails}
            onToggle={() => setShowDetails((v) => !v)}
          >
            <div className="flex flex-col space-y-2">
              {tiers.map((tier, j) => (
                <div
                  key={j}
                  className="py-2 border-b border-[rgba(255,255,255,0.06)] last:border-b-0 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-[rgb(252,252,250)]">{tier.tier}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[#fbbf4d]">{tier.price}</span>
                  </div>
                  {tier.targetAudience && (
                    <span className="text-[12px] text-[rgb(100,105,115)] mb-1 block">
                      {tier.targetAudience}
                    </span>
                  )}
                  {tier.description && (
                    <p className="mb-1.5 text-sm leading-relaxed text-[rgb(205,208,213)]">
                      {excerpt(cleanReviewText(tier.description), 140)}
                    </p>
                  )}
                  {tier.features && tier.features.length > 0 && (
                    <ul className="space-y-1 pl-3 text-sm text-[rgb(100,105,115)]">
                      {tier.features.slice(0, 8).map((feature, k) => (
                        <li key={k} className="list-disc list-outside">
                          {excerpt(cleanReviewText(feature), 84)}
                        </li>
                      ))}
                      {tier.features.length > 8 && (
                        <li className="list-none pl-0 text-xs italic text-[rgb(100,105,115)]">
                          +{tier.features.length - 8} more features
                        </li>
                      )}
                    </ul>
                  )}
                  {tier.limitations && (
                    <p className="mt-2 text-xs italic text-[rgb(100,105,115)]">
                      Limits: {excerpt(cleanReviewText(tier.limitations), 90)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </InlineDisclosure>
        </div>
      )}
    </FieldHighlightWrapper>
  );
}

// =============================================================================
// Compact reviews block with disclosure
// =============================================================================

interface ReviewsBlockProps {
  comp: CompetitorSnapshot;
}

function ReviewsBlock({ comp }: ReviewsBlockProps) {
  const [showComplaints, setShowComplaints] = React.useState(false);
  const [showPraise, setShowPraise] = React.useState(false);

  if (!comp?.reviewData) return null;

  const tp = comp.reviewData.trustpilot;
  const g2 = comp.reviewData.g2;
  const hasG2Data =
    g2 &&
    ((g2.rating != null && g2.rating > 0) ||
      (g2.reviewCount != null && g2.reviewCount > 0));
  const hasTpData =
    tp &&
    ((tp.trustScore != null && tp.trustScore > 0) ||
      (tp.totalReviews != null && tp.totalReviews > 0));

  if (!hasG2Data && !hasTpData) return null;

  const complaints = (tp?.reviews ?? []).filter((r) => r.rating <= 2).slice(0, 3);
  const praise = (tp?.reviews ?? []).filter((r) => r.rating >= 4).slice(0, 3);

  return (
    <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[rgb(252,252,250)]">Customer Reviews</p>
        <span className="text-[10px] uppercase tracking-[0.08em] text-[rgb(100,105,115)]">
          Voice of customer
        </span>
      </div>

      {/* Rating badges */}
      <div className="mb-3 flex flex-wrap gap-3">
        {g2 &&
          g2.rating != null &&
          (g2.rating > 0 || (g2.reviewCount != null && g2.reviewCount > 0)) && (
            <div className="flex items-center gap-1.5">
              {g2.url ? (
                <a
                  href={g2.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                >
                  <span className="inline-flex items-center gap-1 text-[13px] text-[rgb(205,208,213)]">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    G2: {g2.rating.toFixed(1)}/5
                    {g2.reviewCount != null && (
                      <span className="text-[rgb(100,105,115)]">({g2.reviewCount})</span>
                    )}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-[13px] text-[rgb(205,208,213)]">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  G2: {g2.rating.toFixed(1)}/5
                  {g2.reviewCount != null && (
                    <span className="text-[rgb(100,105,115)]">({g2.reviewCount})</span>
                  )}
                </span>
              )}
              {g2.productCategory && (
                <span className="text-[12px] text-[rgb(100,105,115)]">{g2.productCategory}</span>
              )}
            </div>
          )}
        {tp &&
          tp.trustScore != null &&
          (tp.trustScore > 0 || (tp.totalReviews != null && tp.totalReviews > 0)) &&
          tp.url && (
            <a
              href={tp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
            >
              <span className="inline-flex items-center gap-1 text-[13px] text-[rgb(205,208,213)]">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                Trustpilot: {tp.trustScore.toFixed(1)}/5
                {tp.totalReviews != null && (
                  <span className="text-[rgb(100,105,115)]">({tp.totalReviews})</span>
                )}
                <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          )}
      </div>

      {/* Review volume context */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[11px] text-[rgb(100,105,115)]">
        {tp?.totalReviews != null && <span>Trustpilot: {tp.totalReviews} reviews</span>}
        {g2?.reviewCount != null && <span>G2: {g2.reviewCount} reviews</span>}
      </div>

      {/* AI summary — first ~180 chars, primary review signal */}
      {tp?.aiSummary && (
        <p className="mb-3 text-xs italic text-[rgb(100,105,115)]">
          {excerpt(cleanReviewText(tp.aiSummary), 180)}
        </p>
      )}

      {/* Sentiment disclosures */}
      <div className="flex flex-wrap gap-2 mt-3">
        {complaints.length > 0 && (
          <InlineDisclosure
            label={`${complaints.length} complaints`}
            isOpen={showComplaints}
            onToggle={() => setShowComplaints((v) => !v)}
            variant="red"
          >
            <div className="space-y-3 mt-1">
              {complaints.map((r, k) => (
                <div key={k} className="text-[12px] text-[rgb(180,183,190)]">
                  <span className="text-[rgb(248,113,113)] mr-1.5">★ {r.rating}</span>
                  {cleanReviewText(excerpt(r.text, 200))}
                </div>
              ))}
            </div>
          </InlineDisclosure>
        )}
        {praise.length > 0 && (
          <InlineDisclosure
            label={`${praise.length} top praise`}
            isOpen={showPraise}
            onToggle={() => setShowPraise((v) => !v)}
            variant="emerald"
          >
            <div className="space-y-3 mt-1">
              {praise.map((r, k) => (
                <div key={k} className="text-[12px] text-[rgb(180,183,190)]">
                  <span className="text-[rgb(52,211,153)] mr-1.5">★ {r.rating}</span>
                  {cleanReviewText(excerpt(r.text, 200))}
                </div>
              ))}
            </div>
          </InlineDisclosure>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Reusable disclosure wrapper — section-level trigger with badge + preview
// =============================================================================

interface DisclosureSectionProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Right-aligned badge text, e.g. "5 ads" or "3 tiers" */
  badge?: string;
  /** Subtle badge color variant */
  badgeColor?: "amber" | "red" | "emerald" | "neutral";
  /** One-line preview shown when collapsed */
  preview?: string;
  /** Extra class for the trigger row */
  className?: string;
  children: React.ReactNode;
}

function DisclosureSection({
  label,
  isOpen,
  onToggle,
  badge,
  badgeColor = "neutral",
  preview,
  className,
  children,
}: DisclosureSectionProps) {
  const badgeColors = {
    amber: "bg-[rgba(245,158,11,0.1)] text-[#fbbf4d]",
    red: "bg-[rgba(239,68,68,0.1)] text-[rgb(248,113,113)]",
    emerald: "bg-[rgba(16,185,129,0.1)] text-[rgb(52,211,153)]",
    neutral: "bg-[rgba(255,255,255,0.06)] text-[rgb(140,143,150)]",
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "w-full flex items-center justify-between gap-3",
          "min-h-[44px] -mx-2 px-2 rounded-md",
          "transition-colors duration-150",
          "hover:bg-[rgba(255,255,255,0.03)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(245,158,11,0.5)]",
          isOpen && "border-l-2 border-[rgba(245,158,11,0.4)] pl-3"
        )}
      >
        <div className="flex flex-col items-start gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[rgb(160,163,170)]">
              {label}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-[rgb(140,143,150)] transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
          {!isOpen && preview && (
            <span className="text-[10px] text-[rgb(100,105,115)] truncate max-w-[280px]">
              {preview}
            </span>
          )}
        </div>
        {badge && (
          <span
            className={cn(
              "shrink-0 px-2 py-0.5 rounded text-[10px] font-medium",
              badgeColors[badgeColor]
            )}
          >
            {badge}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Reusable inline disclosure — nested trigger pill for smaller disclosures
// =============================================================================

interface InlineDisclosureProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Color variant for the pill */
  variant?: "neutral" | "red" | "emerald";
  children: React.ReactNode;
}

function InlineDisclosure({
  label,
  isOpen,
  onToggle,
  variant = "neutral",
  children,
}: InlineDisclosureProps) {
  const variants = {
    neutral:
      "bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[rgb(160,163,170)]",
    red: "bg-[rgba(239,68,68,0.1)] hover:bg-[rgba(239,68,68,0.15)] text-[rgb(248,113,113)]",
    emerald:
      "bg-[rgba(16,185,129,0.1)] hover:bg-[rgba(16,185,129,0.15)] text-[rgb(52,211,153)]",
  };

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "inline-flex items-center gap-1.5",
          "text-[11px] px-2.5 py-1 rounded-md min-h-[32px]",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(245,158,11,0.5)]",
          variants[variant]
        )}
      >
        {label}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Competitor card body — three-tier progressive disclosure
// =============================================================================

interface CompetitorCardBodyProps {
  comp: CompetitorSnapshot;
  i: number;
  isEditing?: boolean;
  onFieldChange?: (field: string, value: unknown) => void;
}

function CompetitorCardBody({ comp, i, isEditing, onFieldChange }: CompetitorCardBodyProps) {
  // Tier 2 expanded by default; tier 3 collapsed
  const [tier2Open, setTier2Open] = React.useState(true);
  const [tier3Open, setTier3Open] = React.useState(false);

  const platformLinks = buildCompetitorPlatformSearchLinks(comp);
  const adCreativeCount = comp.adCreatives?.length ?? 0;

  // Price range for Tier 1 at-a-glance strip
  const priceTiers = comp.pricingTiers ?? [];
  const priceRangeDisplay = (() => {
    if (priceTiers.length === 0) return safeRender(comp?.price) || null;
    const first = priceTiers[0]?.price;
    const last = priceTiers[priceTiers.length - 1]?.price;
    if (priceTiers.length === 1) return first;
    if (first === last) return first;
    return `${first} \u2013 ${last}`;
  })();

  return (
    <div className="py-4">
      {/* ------------------------------------------------------------------ */}
      {/* TIER 1 — Always visible "At a Glance" row                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Competitor name */}
        <h4 className="text-base font-semibold text-[rgb(252,252,250)]">
          {isEditing && onFieldChange ? (
            <EditableText
              value={safeRender(comp?.name)}
              onSave={(v) => onFieldChange(`competitors.${i}.name`, v)}
            />
          ) : (
            <SourcedText>{safeRender(comp?.name)}</SourcedText>
          )}
        </h4>

        {/* Summary Analysis badge */}
        {(comp as { analysisDepth?: string })?.analysisDepth === "summary" && (
          <span className="text-[11px] text-[rgb(100,105,115)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded">
            Summary Analysis
          </span>
        )}

        {/* Website link inline with name */}
        {comp?.website && (
          <a
            href={comp.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-normal text-[rgb(100,105,115)] transition-colors hover:text-[rgb(205,208,213)]"
          >
            <span className="truncate max-w-[160px]">
              {comp.website.replace(/^https?:\/\//, "")}
            </span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        )}

        {/* Threat classification badge */}
        {comp.threatAssessment?.classification && (
          <ThreatBadge classification={comp.threatAssessment.classification} />
        )}
      </div>

      {/* Price range + ad platform chips */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        {priceRangeDisplay && (
          <span className="text-sm font-[family-name:var(--font-mono)] text-[#fbbf4d]">
            {priceRangeDisplay}
          </span>
        )}
        {safeArray(comp?.adPlatforms).map((p, j) => (
          <span
            key={j}
            className="text-[11px] text-[rgb(100,105,115)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded"
          >
            {p}
          </span>
        ))}
        {(comp as { funnels?: string }).funnels && (
          <span className="text-[11px] text-[rgb(160,163,170)] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 rounded">
            {(comp as { funnels?: string }).funnels}
          </span>
        )}
      </div>

      {/* Platform search links — compact */}
      <div className="mt-1 mb-2 flex flex-wrap items-center gap-2">
        {platformLinks.map((link) => (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[rgb(100,105,115)] transition-colors hover:text-[rgb(205,208,213)]"
            title={`Open ${link.label} with this competitor pre-filled`}
          >
            {link.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TIER 2 — Core Intel (expanded by default, collapsible)             */}
      {/* ------------------------------------------------------------------ */}
      <DisclosureSection
        label="Core Intel"
        isOpen={tier2Open}
        onToggle={() => setTier2Open((v) => !v)}
        badge={`${[comp.strengths?.length, comp.weaknesses?.length, comp.pricingTiers?.length, comp.adMessagingThemes?.length].reduce((a, b) => (a || 0) + (b || 0), 0)} fields`}
        badgeColor="neutral"
        preview={comp.positioning ? excerpt(comp.positioning, 70) : "Positioning · Strengths · Pricing · Reviews"}
        className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]"
      >
          <div className="space-y-3 pb-2">
            {/* Positioning */}
            <FieldHighlightWrapper
              fieldPath={`competitors[${i}].positioning`}
              className="text-sm text-[rgb(205,208,213)]"
            >
              {isEditing && onFieldChange ? (
                <EditableText
                  value={safeRender(comp?.positioning)}
                  onSave={(v) => onFieldChange(`competitors.${i}.positioning`, v)}
                />
              ) : (
                <SourcedListItem>{safeRender(comp?.positioning)}</SourcedListItem>
              )}
            </FieldHighlightWrapper>

            {/* Strengths & Weaknesses */}
            <div className="grid md:grid-cols-2 gap-3">
              <FieldHighlightWrapper fieldPath={`competitors[${i}].strengths`}>
                <p className="text-sm font-medium text-emerald-400/80 mb-1">Strengths</p>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(comp?.strengths)}
                    onSave={(v) => onFieldChange(`competitors.${i}.strengths`, v)}
                    renderPrefix={() => <span className="text-emerald-400/80">+</span>}
                    className="text-sm"
                  />
                ) : (
                  <ul className="text-sm space-y-1">
                    {safeArray(comp?.strengths).map((s, j) => (
                      <li key={j} className="text-[rgb(205,208,213)]">
                        + <SourcedListItem>{s}</SourcedListItem>
                      </li>
                    ))}
                  </ul>
                )}
              </FieldHighlightWrapper>
              <FieldHighlightWrapper fieldPath={`competitors[${i}].weaknesses`}>
                <p className="text-sm font-medium text-red-400/70 mb-1">Weaknesses</p>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(comp?.weaknesses)}
                    onSave={(v) => onFieldChange(`competitors.${i}.weaknesses`, v)}
                    renderPrefix={() => <span className="text-red-400/70">-</span>}
                    className="text-sm"
                  />
                ) : (
                  <ul className="text-sm space-y-1">
                    {safeArray(comp?.weaknesses).map((w, j) => (
                      <li key={j} className="text-[rgb(205,208,213)]">
                        - <SourcedListItem>{w}</SourcedListItem>
                      </li>
                    ))}
                  </ul>
                )}
              </FieldHighlightWrapper>
            </div>

            {/* Pricing — compact redesign with disclosure */}
            <PricingDisplay
              comp={comp}
              i={i}
              isEditing={isEditing}
              onFieldChange={onFieldChange}
            />

            {/* Simple price fallback when no pricing tiers */}
            {!(comp?.pricingTiers && comp.pricingTiers.length > 0) &&
              safeRender(comp?.price) && (
                <FieldHighlightWrapper fieldPath={`competitors[${i}].price`}>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[rgb(100,105,115)] mb-1">
                    Price
                  </p>
                  {isEditing && onFieldChange ? (
                    <EditableText
                      value={safeRender(comp?.price)}
                      onSave={(v) => onFieldChange(`competitors.${i}.price`, v)}
                    />
                  ) : (
                    <p className="font-[family-name:var(--font-mono)] text-[#fbbf4d]">
                      <SourcedText>{safeRender(comp?.price)}</SourcedText>
                    </p>
                  )}
                </FieldHighlightWrapper>
              )}

            {/* Main Offer */}
            {comp?.mainOffer && (
              <FieldHighlightWrapper
                fieldPath={`competitors[${i}].mainOffer`}
                className="pl-4 border-l-2 border-[rgba(255,255,255,0.06)]"
              >
                <p className="text-sm font-medium mb-2 text-[rgb(252,252,250)]">Main Offer</p>
                <div className="space-y-2 text-sm">
                  <div>
                    {isEditing && onFieldChange ? (
                      <EditableText
                        value={comp.mainOffer.headline}
                        onSave={(v) =>
                          onFieldChange(`competitors.${i}.mainOffer.headline`, v)
                        }
                        className="font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-[rgb(252,252,250)]">
                        {comp.mainOffer.headline}
                      </p>
                    )}
                  </div>
                  <div>
                    {isEditing && onFieldChange ? (
                      <EditableText
                        value={comp.mainOffer.valueProposition}
                        onSave={(v) =>
                          onFieldChange(
                            `competitors.${i}.mainOffer.valueProposition`,
                            v
                          )
                        }
                        className="italic text-[rgb(100,105,115)]"
                      />
                    ) : (
                      <p className="italic text-[rgb(100,105,115)]">
                        {comp.mainOffer.valueProposition}
                      </p>
                    )}
                  </div>
                  <span className="text-[12px] text-[rgb(100,105,115)]">
                    CTA: {comp.mainOffer.cta}
                  </span>
                </div>
              </FieldHighlightWrapper>
            )}

            {/* Simple Offer fallback when no mainOffer */}
            {!comp?.mainOffer && safeRender(comp?.offer) && (
              <FieldHighlightWrapper fieldPath={`competitors[${i}].offer`}>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[rgb(100,105,115)] mb-1">
                  Offer
                </p>
                {isEditing && onFieldChange ? (
                  <EditableText
                    value={safeRender(comp?.offer)}
                    onSave={(v) => onFieldChange(`competitors.${i}.offer`, v)}
                  />
                ) : (
                  <p className="text-[rgb(205,208,213)]">
                    <SourcedListItem>{safeRender(comp?.offer)}</SourcedListItem>
                  </p>
                )}
              </FieldHighlightWrapper>
            )}

            {/* Reviews — compact disclosure pattern */}
            <ReviewsBlock comp={comp} />

            {/* Ad Messaging Themes as inline tags */}
            {comp?.adMessagingThemes && comp.adMessagingThemes.length > 0 && (
              <FieldHighlightWrapper fieldPath={`competitors[${i}].adMessagingThemes`}>
                <p className="text-sm font-medium mb-2 text-[rgb(252,252,250)]">Ad Themes</p>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={comp.adMessagingThemes}
                    onSave={(v) =>
                      onFieldChange(`competitors.${i}.adMessagingThemes`, v)
                    }
                    className="text-sm"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {comp.adMessagingThemes.map((theme, j) => (
                      <span
                        key={j}
                        className="inline-flex bg-[rgba(255,255,255,0.04)] text-[rgb(180,185,195)] text-[11px] px-2 py-0.5 rounded capitalize"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
              </FieldHighlightWrapper>
            )}
          </div>
      </DisclosureSection>

      {/* ------------------------------------------------------------------ */}
      {/* TIER 3 — Ad Creatives (collapsed by default)                       */}
      {/* ------------------------------------------------------------------ */}
      {adCreativeCount > 0 && (
        <DisclosureSection
          label="Ad Creatives"
          isOpen={tier3Open}
          onToggle={() => setTier3Open((v) => !v)}
          badge={`${adCreativeCount} ads`}
          badgeColor="amber"
          preview={
            (comp.adCreatives ?? [])
              .map((ad) => ad.format)
              .filter(Boolean)
              .filter((v, idx, arr) => arr.indexOf(v) === idx)
              .slice(0, 3)
              .join(" · ") || undefined
          }
          className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]"
        >
          <AdCreativeCarousel ads={comp.adCreatives ?? []} />
        </DisclosureSection>
      )}
    </div>
  );
}

// =============================================================================
// Main export
// =============================================================================

export function CompetitorAnalysisContent({
  data,
  isEditing,
  onFieldChange,
}: CompetitorAnalysisContentProps) {
  const [currentCompetitorPage, setCurrentCompetitorPage] = React.useState(0);
  const [competitorDirection, setCompetitorDirection] = React.useState(0);
  const sectionRef = React.useRef<HTMLDivElement>(null);

  const competitors = data?.competitors || [];
  const currentComp = competitors[currentCompetitorPage];

  const goToCompetitor = React.useCallback(
    (page: number) => {
      if (
        page < 0 ||
        page >= competitors.length ||
        page === currentCompetitorPage
      )
        return;
      setCompetitorDirection(page > currentCompetitorPage ? 1 : -1);
      setCurrentCompetitorPage(page);
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        if (rect.top < 0) {
          sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    },
    [currentCompetitorPage, competitors.length]
  );

  // Compute creative formats once for aggregate sections
  const creativeFormats = [
    data?.creativeLibrary?.creativeFormats?.ugc && "UGC",
    data?.creativeLibrary?.creativeFormats?.carousels && "Carousels",
    data?.creativeLibrary?.creativeFormats?.statics && "Statics",
    data?.creativeLibrary?.creativeFormats?.testimonial && "Testimonials",
    data?.creativeLibrary?.creativeFormats?.productDemo && "Product Demo",
  ].filter(Boolean) as string[];

  // 2+ formats: collapse Creative Library into inline line inside Funnel Breakdown
  const collapseCreativeLibrary = creativeFormats.length >= 2;

  return (
    <div className="space-y-5" ref={sectionRef}>
      {/* ------------------------------------------------------------------ */}
      {/* Per-competitor paginated card                                       */}
      {/* ------------------------------------------------------------------ */}
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
              <div>
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
                    aria-label={
                      currentComp?.name || `Competitor ${currentCompetitorPage + 1}`
                    }
                  >
                    <CompetitorCardBody
                      comp={currentComp}
                      i={currentCompetitorPage}
                      isEditing={isEditing}
                      onFieldChange={onFieldChange}
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Bottom navigation inside card */}
                <CompetitorBottomNav
                  competitors={competitors}
                  currentPage={currentCompetitorPage}
                  onGoToPage={goToCompetitor}
                />
              </div>
            </SwipeableCompetitorCard>
          </>
        )}
      </SubSection>

      {/* ------------------------------------------------------------------ */}
      {/* Aggregate sections — amber left border to visually separate        */}
      {/* Order: Gaps & Opportunities → Market S/W → Funnel → Creative      */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-l-2 border-[rgba(245,158,11,0.15)] pl-4 space-y-5">

        {/* 1. Gaps & Opportunities — actionable synthesis first */}
        <SubSection title="Gaps & Opportunities">
          {data?.whiteSpaceGaps?.length ? (
            <div className="space-y-0">
              {data.whiteSpaceGaps.map((wsg: WhiteSpaceGap, idx: number) => {
                const typeConfig: Record<string, { text: string }> = {
                  messaging: { text: "text-emerald-400/70" },
                  feature: { text: "text-[#f59e0b]/70" },
                  audience: { text: "text-violet-400/70" },
                  channel: { text: "text-amber-400/70" },
                };
                const config =
                  typeConfig[wsg.type] || { text: "text-[rgb(100,105,115)]" };
                return (
                  <FieldHighlightWrapper key={idx} fieldPath={`whiteSpaceGaps[${idx}]`}>
                    <div className="py-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-[0.08em]",
                            config.text
                          )}
                        >
                          {wsg.type}
                        </span>
                        <span className="text-[10px] text-[rgb(100,105,115)] font-[family-name:var(--font-mono)]">
                          Exploit: {wsg.exploitability}/10 &middot; Impact:{" "}
                          {wsg.impact}/10
                          {wsg.compositeScore != null &&
                            ` · Score: ${wsg.compositeScore}`}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[rgb(252,252,250)]">
                        {wsg.gap}
                      </p>
                      <p className="text-xs text-[rgb(100,105,115)] mt-1">
                        {wsg.evidence}
                      </p>
                      <p className="text-xs text-[rgb(205,208,213)] mt-1">
                        {wsg.recommendedAction}
                      </p>
                    </div>
                  </FieldHighlightWrapper>
                );
              })}
            </div>
          ) : safeArray(data?.gapsAndOpportunities?.messagingOpportunities).length >
              0 ||
            safeArray(data?.gapsAndOpportunities?.creativeOpportunities).length >
              0 ||
            safeArray(data?.gapsAndOpportunities?.funnelOpportunities).length > 0 ||
            isEditing ? (
            /* Legacy fallback for old blueprints */
            <CardGrid cols={3}>
              <div className="pt-3">
                <h4 className="font-medium mb-2 text-emerald-400/80">
                  Messaging Opportunities
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(
                      data?.gapsAndOpportunities?.messagingOpportunities
                    )}
                    onSave={(v) =>
                      onFieldChange(
                        "gapsAndOpportunities.messagingOpportunities",
                        v
                      )
                    }
                    className="text-sm"
                  />
                ) : (
                  <ul className="text-sm space-y-1">
                    {safeArray(
                      data?.gapsAndOpportunities?.messagingOpportunities
                    ).map((item, idx) => (
                      <ListItem key={idx}>
                        <SourcedListItem>{item}</SourcedListItem>
                      </ListItem>
                    ))}
                  </ul>
                )}
              </div>
              <div className="pt-3">
                <h4 className="font-medium mb-2 text-[#f59e0b]">
                  Creative Opportunities
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(
                      data?.gapsAndOpportunities?.creativeOpportunities
                    )}
                    onSave={(v) =>
                      onFieldChange(
                        "gapsAndOpportunities.creativeOpportunities",
                        v
                      )
                    }
                    className="text-sm"
                  />
                ) : (
                  <ul className="text-sm space-y-1">
                    {safeArray(
                      data?.gapsAndOpportunities?.creativeOpportunities
                    ).map((item, idx) => (
                      <ListItem key={idx}>
                        <SourcedListItem>{item}</SourcedListItem>
                      </ListItem>
                    ))}
                  </ul>
                )}
              </div>
              <div className="pt-3">
                <h4 className="mb-2 font-medium text-violet-400/70">
                  Funnel Opportunities
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(
                      data?.gapsAndOpportunities?.funnelOpportunities
                    )}
                    onSave={(v) =>
                      onFieldChange(
                        "gapsAndOpportunities.funnelOpportunities",
                        v
                      )
                    }
                    className="text-sm"
                  />
                ) : (
                  <ul className="text-sm space-y-1">
                    {safeArray(
                      data?.gapsAndOpportunities?.funnelOpportunities
                    ).map((item, idx) => (
                      <ListItem key={idx}>
                        <SourcedListItem>{item}</SourcedListItem>
                      </ListItem>
                    ))}
                  </ul>
                )}
              </div>
            </CardGrid>
          ) : (
            <EmptyExplanation message="No competitive gaps or opportunities identified from available data." />
          )}
        </SubSection>

        {/* 2. Market Strengths & Weaknesses */}
        {(safeArray(data?.marketStrengths).length > 0 ||
          safeArray(data?.marketWeaknesses).length > 0 ||
          isEditing) && (
          <SubSection title="Market Strengths & Weaknesses">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2 text-emerald-400/80">
                  Market Strengths
                </h4>
                <ul className="space-y-1">
                  {safeArray(data?.marketStrengths).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400/80 text-sm leading-relaxed shrink-0">
                        +
                      </span>
                      <span className="text-[rgb(205,208,213)] text-sm leading-relaxed">
                        <SourcedListItem>{item}</SourcedListItem>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 font-medium text-red-400/70">
                  Market Weaknesses
                </h4>
                <ul className="space-y-1">
                  {safeArray(data?.marketWeaknesses).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-400/70 text-sm leading-relaxed shrink-0">
                        -
                      </span>
                      <span className="text-[rgb(205,208,213)] text-sm leading-relaxed">
                        <SourcedListItem>{item}</SourcedListItem>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </SubSection>
        )}

        {/* 3. Funnel Breakdown — includes creative formats inline when 2+ */}
        {(safeArray(data?.funnelBreakdown?.landingPagePatterns).length > 0 ||
          safeArray(data?.funnelBreakdown?.headlineStructure).length > 0 ||
          safeArray(data?.funnelBreakdown?.ctaHierarchy).length > 0 ||
          safeArray(data?.funnelBreakdown?.socialProofPatterns).length > 0 ||
          safeArray(data?.funnelBreakdown?.leadCaptureMethods).length > 0 ||
          isEditing) && (
          <SubSection title="Funnel Breakdown">
            {/* Inline creative formats summary when 2+ formats */}
            {collapseCreativeLibrary && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.08em] text-[rgb(100,105,115)]">
                  Creative formats:
                </span>
                {creativeFormats.map((label, j) => (
                  <span key={j} className="text-[13px] text-[rgb(205,208,213)]">
                    {label}
                    {j < creativeFormats.length - 1 ? "," : ""}
                  </span>
                ))}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {(safeArray(data?.funnelBreakdown?.landingPagePatterns).length > 0 ||
                isEditing) && (
                <div>
                  <h4 className="text-sm font-medium text-[rgb(205,208,213)] mb-2">
                    Landing Page Patterns
                  </h4>
                  <ul className="space-y-1">
                    {safeArray(data?.funnelBreakdown?.landingPagePatterns).map(
                      (item, idx) => (
                        <ListItem key={idx}>
                          <SourcedListItem>{item}</SourcedListItem>
                        </ListItem>
                      )
                    )}
                  </ul>
                </div>
              )}
              {(safeArray(data?.funnelBreakdown?.headlineStructure).length > 0 ||
                isEditing) && (
                <div>
                  <h4 className="text-sm font-medium text-[rgb(205,208,213)] mb-2">
                    Headline Structure
                  </h4>
                  <ul className="space-y-1">
                    {safeArray(data?.funnelBreakdown?.headlineStructure).map(
                      (item, idx) => (
                        <ListItem key={idx}>
                          <SourcedListItem>{item}</SourcedListItem>
                        </ListItem>
                      )
                    )}
                  </ul>
                </div>
              )}
              {(safeArray(data?.funnelBreakdown?.ctaHierarchy).length > 0 ||
                isEditing) && (
                <div>
                  <h4 className="text-sm font-medium text-[rgb(205,208,213)] mb-2">
                    CTA Hierarchy
                  </h4>
                  <ul className="space-y-1">
                    {safeArray(data?.funnelBreakdown?.ctaHierarchy).map(
                      (item, idx) => (
                        <ListItem key={idx}>
                          <SourcedListItem>{item}</SourcedListItem>
                        </ListItem>
                      )
                    )}
                  </ul>
                </div>
              )}
              {(safeArray(data?.funnelBreakdown?.socialProofPatterns).length > 0 ||
                isEditing) && (
                <div>
                  <h4 className="text-sm font-medium text-[rgb(205,208,213)] mb-2">
                    Social Proof Patterns
                  </h4>
                  <ul className="space-y-1">
                    {safeArray(data?.funnelBreakdown?.socialProofPatterns).map(
                      (item, idx) => (
                        <ListItem key={idx}>
                          <SourcedListItem>{item}</SourcedListItem>
                        </ListItem>
                      )
                    )}
                  </ul>
                </div>
              )}
              {(safeArray(data?.funnelBreakdown?.leadCaptureMethods).length > 0 ||
                isEditing) && (
                <div>
                  <h4 className="text-sm font-medium text-[rgb(205,208,213)] mb-2">
                    Lead Capture Methods
                  </h4>
                  <ul className="space-y-1">
                    {safeArray(data?.funnelBreakdown?.leadCaptureMethods).map(
                      (item, idx) => (
                        <ListItem key={idx}>
                          <SourcedListItem>{item}</SourcedListItem>
                        </ListItem>
                      )
                    )}
                  </ul>
                </div>
              )}
              {data?.funnelBreakdown?.formFriction && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[rgb(100,105,115)] mb-1">
                    Form Friction Level
                  </p>
                  <span className="text-sm capitalize text-[rgb(205,208,213)]">
                    {safeRender(data.funnelBreakdown.formFriction)}
                  </span>
                </div>
              )}
            </div>
          </SubSection>
        )}

        {/* 4. Creative Library — standalone only when fewer than 2 formats identified */}
        {!collapseCreativeLibrary && (
          <SubSection title="Creative Library">
            <div>
              <h4 className="text-sm font-medium text-[rgb(205,208,213)] mb-2">
                Creative Formats Used
              </h4>
              <div>
                {creativeFormats.length === 0 ? (
                  <span className="text-sm text-[rgb(100,105,115)]">
                    No formats identified
                  </span>
                ) : (
                  creativeFormats.map((label, j) => (
                    <span key={j} className="text-[13px] text-[rgb(205,208,213)]">
                      {label}
                      {j < creativeFormats.length - 1 ? ", " : ""}
                    </span>
                  ))
                )}
              </div>
            </div>
          </SubSection>
        )}
      </div>
    </div>
  );
}
