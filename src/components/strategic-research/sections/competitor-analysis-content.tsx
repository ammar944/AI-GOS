"use client";

import * as React from "react";
import {
  Check,
  DollarSign,
  Sparkles,
  Tag,
  Image,
  ExternalLink,
  Star,
  MessageSquareQuote,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EditableText, EditableList } from "../editable";
import { SourcedText, SourcedListItem } from "../citations";
import { AnimatePresence, motion } from "framer-motion";
import { AdCreativeCarousel } from "../ad-creative-carousel";
import {
  CompetitorPaginationNav,
  CompetitorCardArrows,
  competitorSlideVariants,
  competitorSlideTransition,
} from "../competitor-pagination";
import { CompetitorBottomNav } from "../competitor-bottom-nav";
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
  DataCard,
  CardGrid,
  EmptyExplanation,
  FieldHighlightWrapper,
  type EditableContentProps,
} from "./shared-primitives";
import type {
  CompetitorAnalysis,
  WhiteSpaceGap,
} from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Section 4: Competitor Analysis Content
// =============================================================================

interface CompetitorAnalysisContentProps extends EditableContentProps {
  data: CompetitorAnalysis;
}

export function CompetitorAnalysisContent({ data, isEditing, onFieldChange }: CompetitorAnalysisContentProps) {
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
                          className="rounded-lg bg-[var(--bg-surface)] border border-border p-3.5"
                        >
                          {/* Competitor header */}
                          <h4 className="font-semibold text-lg flex items-center gap-2 flex-wrap text-white/90">
                            {isEditing && onFieldChange ? (
                              <EditableText
                                value={safeRender(comp?.name)}
                                onSave={(v) => onFieldChange(`competitors.${i}.name`, v)}
                              />
                            ) : (
                              <SourcedText>{safeRender(comp?.name)}</SourcedText>
                            )}
                            {(comp as any)?.analysisDepth === 'summary' && (
                              <span className="inline-flex items-center rounded-md bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-white/40">
                                Summary Analysis
                              </span>
                            )}
                            {comp?.website && (
                              <a
                                href={comp.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-normal text-white/40 transition-colors hover:text-primary/80"
                              >
                                <span className="truncate max-w-[200px]">{comp.website.replace(/^https?:\/\//, '')}</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              </a>
                            )}
                          </h4>

                          {/* Platform search links */}
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
                                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-white/50 transition-colors hover:border-white/[0.14] hover:text-white/70"
                                    title={`Open ${link.label} with this competitor pre-filled`}
                                  >
                                    {link.label}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Positioning */}
                          <FieldHighlightWrapper fieldPath={`competitors[${i}].positioning`} className="mb-3 text-sm text-white/60">
                            {isEditing && onFieldChange ? (
                              <EditableText
                                value={safeRender(comp?.positioning)}
                                onSave={(v) => onFieldChange(`competitors.${i}.positioning`, v)}
                              />
                            ) : (
                              <SourcedListItem>{safeRender(comp?.positioning)}</SourcedListItem>
                            )}
                          </FieldHighlightWrapper>

                          {/* Quick facts grid */}
                          <div className="grid md:grid-cols-2 gap-3 text-sm">
                            {/* Only show simple Offer if no detailed mainOffer exists */}
                            {!comp?.mainOffer && (
                              <FieldHighlightWrapper fieldPath={`competitors[${i}].offer`}>
                                <p className="text-[10px] uppercase tracking-[0.08em] text-white/30 mb-1">Offer</p>
                                {isEditing && onFieldChange ? (
                                  <EditableText
                                    value={safeRender(comp?.offer)}
                                    onSave={(v) => onFieldChange(`competitors.${i}.offer`, v)}
                                  />
                                ) : (
                                  <p className="text-white/70"><SourcedListItem>{safeRender(comp?.offer)}</SourcedListItem></p>
                                )}
                              </FieldHighlightWrapper>
                            )}
                            {/* Only show simple Price if no detailed pricingTiers exist */}
                            {!(comp?.pricingTiers && comp.pricingTiers.length > 0) && (
                              <FieldHighlightWrapper fieldPath={`competitors[${i}].price`}>
                                <p className="text-[10px] uppercase tracking-[0.08em] text-white/30 mb-1">Price</p>
                                {isEditing && onFieldChange ? (
                                  <EditableText
                                    value={safeRender(comp?.price)}
                                    onSave={(v) => onFieldChange(`competitors.${i}.price`, v)}
                                  />
                                ) : (
                                  <p className="font-[family-name:var(--font-mono)] text-white/85">
                                    <SourcedText>{safeRender(comp?.price)}</SourcedText>
                                  </p>
                                )}
                              </FieldHighlightWrapper>
                            )}
                            <FieldHighlightWrapper fieldPath={`competitors[${i}].adPlatforms`}>
                              <p className="text-[10px] uppercase tracking-[0.08em] text-white/30 mb-1">Platforms</p>
                              <div className="flex gap-1 flex-wrap">
                                {safeArray(comp?.adPlatforms).length > 0 ? (
                                  safeArray(comp?.adPlatforms).map((p, j) => (
                                    <Badge key={j} variant="outline" className="text-xs border-white/[0.1] text-white/60">{p}</Badge>
                                  ))
                                ) : (
                                  <span className="text-xs italic text-white/30">
                                    No active paid campaigns detected
                                  </span>
                                )}
                              </div>
                            </FieldHighlightWrapper>
                            {safeRender(comp?.funnels) && (
                              <FieldHighlightWrapper fieldPath={`competitors[${i}].funnels`}>
                                <p className="text-[10px] uppercase tracking-[0.08em] text-white/30 mb-1">Funnels</p>
                                <p className="text-white/60">{safeRender(comp?.funnels)}</p>
                              </FieldHighlightWrapper>
                            )}
                          </div>

                          {/* Strengths & Weaknesses */}
                          <div className="grid md:grid-cols-2 gap-3 mt-3">
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
                                    <li key={j} className="text-white/60">+ <SourcedListItem>{s}</SourcedListItem></li>
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
                                    <li key={j} className="text-white/60">- <SourcedListItem>{w}</SourcedListItem></li>
                                  ))}
                                </ul>
                              )}
                            </FieldHighlightWrapper>
                          </div>

                          {/* Customer Reviews */}
                          {comp?.reviewData && (() => {
                            const tp = comp.reviewData!.trustpilot;
                            const g2 = comp.reviewData!.g2;
                            const hasG2Data = g2 && (g2.rating != null && g2.rating > 0 || g2.reviewCount != null && g2.reviewCount > 0);
                            const hasTpData = tp && (tp.trustScore != null && tp.trustScore > 0 || tp.totalReviews != null && tp.totalReviews > 0);
                            if (!hasG2Data && !hasTpData) return null;
                            const complaints = (tp?.reviews ?? []).filter(r => r.rating <= 2).slice(0, 3);
                            const praise = (tp?.reviews ?? []).filter(r => r.rating >= 4).slice(0, 2);
                            return (
                              <div className="mt-3 rounded-lg bg-[var(--bg-surface)] border border-border p-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <p className="flex items-center gap-2 text-sm font-medium text-white/80">
                                    <MessageSquareQuote className="h-4 w-4 text-amber-400/70" />
                                    Customer Reviews
                                  </p>
                                  <span className="text-[10px] uppercase tracking-[0.08em] text-white/30">
                                    Voice of customer
                                  </span>
                                </div>

                                {/* Rating badges */}
                                <div className="mb-3 flex flex-wrap gap-2">
                                  {g2 && g2.rating != null && (g2.rating > 0 || (g2.reviewCount != null && g2.reviewCount > 0)) && (
                                    <div className="flex items-center gap-1.5">
                                      {g2.url ? (
                                        <a href={g2.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-opacity hover:opacity-80">
                                          <Badge variant="outline" className="gap-1 border-white/[0.1] bg-white/[0.03] text-xs text-white/60">
                                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                            G2: {g2.rating.toFixed(1)}/5
                                            {g2.reviewCount != null && <span className="text-white/30">({g2.reviewCount})</span>}
                                            <ExternalLink className="h-3 w-3" />
                                          </Badge>
                                        </a>
                                      ) : (
                                        <Badge variant="outline" className="gap-1 border-white/[0.1] bg-white/[0.03] text-xs text-white/60">
                                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                          G2: {g2.rating.toFixed(1)}/5
                                          {g2.reviewCount != null && <span className="text-white/30">({g2.reviewCount})</span>}
                                        </Badge>
                                      )}
                                      {g2.productCategory && (
                                        <Badge variant="outline" className="text-xs">{g2.productCategory}</Badge>
                                      )}
                                    </div>
                                  )}
                                  {tp && tp.trustScore != null && (tp.trustScore > 0 || (tp.totalReviews != null && tp.totalReviews > 0)) && (
                                    <a href={tp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-opacity hover:opacity-80">
                                      <Badge variant="outline" className="gap-1 border-white/[0.1] bg-white/[0.03] text-xs text-white/60">
                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                        Trustpilot: {tp.trustScore.toFixed(1)}/5
                                        {tp.totalReviews != null && <span className="text-white/30">({tp.totalReviews})</span>}
                                        <ExternalLink className="h-3 w-3" />
                                      </Badge>
                                    </a>
                                  )}
                                </div>

                                {tp?.aiSummary && (
                                  <p className="mb-3 text-xs italic text-white/40">
                                    {excerpt(cleanReviewText(tp.aiSummary), 220)}
                                  </p>
                                )}

                                {(complaints.length > 0 || praise.length > 0) && (
                                  <div className="space-y-3">
                                    {/* Stats row */}
                                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                      <div className="rounded-lg bg-[var(--bg-surface)] border border-border/80 p-2">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-white/30">Complaints</p>
                                        <p className="mt-1 text-sm font-semibold text-red-400/70 font-[family-name:var(--font-mono)]">{complaints.length}</p>
                                      </div>
                                      <div className="rounded-lg bg-[var(--bg-surface)] border border-border/80 p-2">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-white/30">Praise</p>
                                        <p className="mt-1 text-sm font-semibold text-emerald-400/70 font-[family-name:var(--font-mono)]">{praise.length}</p>
                                      </div>
                                      {tp?.totalReviews != null && (
                                        <div className="rounded-lg bg-[var(--bg-surface)] border border-border/80 p-2">
                                          <p className="text-[10px] uppercase tracking-[0.08em] text-white/30">Trustpilot Reviews</p>
                                          <p className="mt-1 text-sm font-semibold text-white/80 font-[family-name:var(--font-mono)]">{tp.totalReviews}</p>
                                        </div>
                                      )}
                                      {g2?.reviewCount != null && (
                                        <div className="rounded-lg bg-[var(--bg-surface)] border border-border/80 p-2">
                                          <p className="text-[10px] uppercase tracking-[0.08em] text-white/30">G2 Reviews</p>
                                          <p className="mt-1 text-sm font-semibold text-white/80 font-[family-name:var(--font-mono)]">{g2.reviewCount}</p>
                                        </div>
                                      )}
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                      {complaints.length > 0 && (
                                        <div className="rounded-lg bg-red-500/[0.04] border border-red-500/[0.18] p-3">
                                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-400/70">
                                            Top Criticism
                                          </p>
                                          <div className="space-y-2">
                                            {complaints.map((review, j) => (
                                              <div key={j} className="rounded-md border border-border bg-[var(--bg-surface)] p-2.5 text-xs">
                                                <div className="mb-1 flex items-center gap-1">
                                                  {Array.from({ length: 5 }).map((_, k) => (
                                                    <Star
                                                      key={k}
                                                      className={cn(
                                                        'h-3 w-3',
                                                        k < review.rating ? 'fill-amber-400 text-amber-400' : 'text-white/20'
                                                      )}
                                                    />
                                                  ))}
                                                  {review.date && (
                                                    <span className="ml-1 text-white/30">{review.date}</span>
                                                  )}
                                                </div>
                                                <p className="leading-relaxed text-white/60">
                                                  {excerpt(cleanReviewText(review.text || ""), 220)}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {praise.length > 0 && (
                                        <div className="rounded-lg bg-emerald-500/[0.04] border border-emerald-500/[0.18] p-3">
                                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-400/70">
                                            Top Praise
                                          </p>
                                          <div className="space-y-2">
                                            {praise.map((review, j) => (
                                              <div key={j} className="rounded-md border border-border bg-[var(--bg-surface)] p-2.5 text-xs">
                                                <div className="mb-1 flex items-center gap-1">
                                                  {Array.from({ length: 5 }).map((_, k) => (
                                                    <Star
                                                      key={k}
                                                      className={cn(
                                                        'h-3 w-3',
                                                        k < review.rating ? 'fill-amber-400 text-amber-400' : 'text-white/20'
                                                      )}
                                                    />
                                                  ))}
                                                  {review.date && (
                                                    <span className="ml-1 text-white/30">{review.date}</span>
                                                  )}
                                                </div>
                                                <p className="leading-relaxed text-white/60">
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

                          {/* Pricing Tiers */}
                          {comp?.pricingTiers && comp.pricingTiers.length > 0 && (
                            <FieldHighlightWrapper fieldPath={`competitors[${i}].pricingTiers`} className="mt-4">
                              <p className="mb-1 flex items-center gap-2 text-sm font-medium text-white/80">
                                <DollarSign className="h-4 w-4 text-emerald-400/80" />
                                Pricing Tiers
                              </p>
                              <p className="mb-2 text-xs italic text-white/30">
                                Prices may vary by region. USD equivalents are approximate.
                              </p>
                              {isEditing && onFieldChange ? (
                                <EditableList
                                  items={comp.pricingTiers.map(formatPricingTier)}
                                  onSave={(v) => onFieldChange(`competitors.${i}.pricingTiers`, parsePricingTierStrings(v))}
                                  renderPrefix={() => <DollarSign className="h-3 w-3 text-emerald-400/80" />}
                                  className="text-sm"
                                />
                              ) : (
                                <div className="grid gap-2.5 md:grid-cols-2">
                                  {comp.pricingTiers.map((tier, j) => (
                                    <div
                                      key={j}
                                      className="rounded-lg bg-[var(--bg-surface)] border border-border p-3 text-xs break-words"
                                    >
                                      {/* Tier name and price */}
                                      <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold leading-tight text-white/85">
                                          {tier.tier}
                                        </span>
                                        <span className="whitespace-nowrap text-sm font-[family-name:var(--font-mono)] text-emerald-400/80">
                                          {tier.price}
                                        </span>
                                      </div>
                                      {/* Target audience */}
                                      {tier.targetAudience && (
                                        <Badge variant="outline" className="mb-2 border-white/[0.08] bg-white/[0.03] text-[10px] text-white/40">
                                          {tier.targetAudience}
                                        </Badge>
                                      )}
                                      {/* Description */}
                                      {tier.description && (
                                        <p className="mb-2 text-sm leading-relaxed text-white/60">
                                          {excerpt(cleanReviewText(tier.description), 140)}
                                        </p>
                                      )}
                                      {/* Features list */}
                                      {tier.features && tier.features.length > 0 && (
                                        <ul className="space-y-1 pl-3 text-sm text-white/55">
                                          {tier.features.slice(0, 8).map((feature, k) => (
                                            <li key={k} className="list-disc list-outside">
                                              {excerpt(cleanReviewText(feature), 84)}
                                            </li>
                                          ))}
                                          {tier.features.length > 8 && (
                                            <li className="list-none pl-0 text-xs italic text-white/30">
                                              +{tier.features.length - 8} more features
                                            </li>
                                          )}
                                        </ul>
                                      )}
                                      {/* Limitations */}
                                      {tier.limitations && (
                                        <p className="mt-3 border-t border-border pt-2 text-xs italic text-white/35">
                                          Limits: {excerpt(cleanReviewText(tier.limitations), 90)}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </FieldHighlightWrapper>
                          )}

                          {/* Main Offer */}
                          {comp?.mainOffer && (
                            <FieldHighlightWrapper fieldPath={`competitors[${i}].mainOffer`} className="mt-4 rounded-lg bg-primary/[0.04] border border-primary/[0.14] p-3">
                              <p className="text-sm font-medium mb-2 flex items-center gap-2 text-white/80">
                                <Sparkles className="h-4 w-4 text-primary/80" />
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
                                    <p className="font-semibold text-white/85">{comp.mainOffer.headline}</p>
                                  )}
                                </div>
                                <div>
                                  {isEditing && onFieldChange ? (
                                    <EditableText
                                      value={comp.mainOffer.valueProposition}
                                      onSave={(v) => onFieldChange(`competitors.${i}.mainOffer.valueProposition`, v)}
                                      className="italic text-white/50"
                                    />
                                  ) : (
                                    <p className="italic text-white/50">{comp.mainOffer.valueProposition}</p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  CTA: {comp.mainOffer.cta}
                                </Badge>
                              </div>
                            </FieldHighlightWrapper>
                          )}

                          {/* Ad Messaging Themes */}
                          {comp?.adMessagingThemes && comp.adMessagingThemes.length > 0 && (
                            <FieldHighlightWrapper fieldPath={`competitors[${i}].adMessagingThemes`} className="mt-4">
                              <p className="text-sm font-medium mb-2 flex items-center gap-2 text-white/80">
                                <Tag className="h-4 w-4 text-primary/80" />
                                Ad Themes
                              </p>
                              {isEditing && onFieldChange ? (
                                <EditableList
                                  items={comp.adMessagingThemes}
                                  onSave={(v) => onFieldChange(`competitors.${i}.adMessagingThemes`, v)}
                                  renderPrefix={() => <Tag className="h-3 w-3 text-primary/80" />}
                                  className="text-sm"
                                />
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {comp.adMessagingThemes.map((theme, j) => (
                                    <span
                                      key={j}
                                      className="inline-flex items-center rounded-md bg-primary/[0.08] border border-primary/[0.18] px-2.5 py-1 text-xs capitalize text-primary/70 break-words"
                                    >
                                      {theme}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </FieldHighlightWrapper>
                          )}

                          {/* Ad Creatives Carousel */}
                          {comp?.adCreatives && comp.adCreatives.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-medium mb-2 flex items-center gap-2 text-white/80">
                                <Image className="h-4 w-4 text-primary/80" />
                                Ad Creatives ({comp.adCreatives.length})
                              </p>
                              <AdCreativeCarousel ads={comp.adCreatives} />
                            </div>
                          )}

                          {/* Bottom navigation */}
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
          <h4 className="text-sm font-medium text-white/70 mb-2">Creative Formats Used</h4>
          <div className="flex flex-wrap gap-2">
            {data?.creativeLibrary?.creativeFormats?.ugc && (
              <Badge variant="outline" className="text-sm">UGC</Badge>
            )}
            {data?.creativeLibrary?.creativeFormats?.carousels && (
              <Badge variant="outline" className="text-sm">Carousels</Badge>
            )}
            {data?.creativeLibrary?.creativeFormats?.statics && (
              <Badge variant="outline" className="text-sm">Statics</Badge>
            )}
            {data?.creativeLibrary?.creativeFormats?.testimonial && (
              <Badge variant="outline" className="text-sm">Testimonials</Badge>
            )}
            {data?.creativeLibrary?.creativeFormats?.productDemo && (
              <Badge variant="outline" className="text-sm">Product Demo</Badge>
            )}
            {!data?.creativeLibrary?.creativeFormats?.ugc &&
             !data?.creativeLibrary?.creativeFormats?.carousels &&
             !data?.creativeLibrary?.creativeFormats?.statics &&
             !data?.creativeLibrary?.creativeFormats?.testimonial &&
             !data?.creativeLibrary?.creativeFormats?.productDemo && (
              <span className="text-sm text-white/30">No formats identified</span>
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
                <h4 className="text-sm font-medium text-white/70 mb-2">Landing Page Patterns</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.landingPagePatterns).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {(safeArray(data?.funnelBreakdown?.headlineStructure).length > 0 || isEditing) && (
              <div>
                <h4 className="text-sm font-medium text-white/70 mb-2">Headline Structure</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.headlineStructure).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {(safeArray(data?.funnelBreakdown?.ctaHierarchy).length > 0 || isEditing) && (
              <div>
                <h4 className="text-sm font-medium text-white/70 mb-2">CTA Hierarchy</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.ctaHierarchy).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {(safeArray(data?.funnelBreakdown?.socialProofPatterns).length > 0 || isEditing) && (
              <div>
                <h4 className="text-sm font-medium text-white/70 mb-2">Social Proof Patterns</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.socialProofPatterns).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {(safeArray(data?.funnelBreakdown?.leadCaptureMethods).length > 0 || isEditing) && (
              <div>
                <h4 className="text-sm font-medium text-white/70 mb-2">Lead Capture Methods</h4>
                <ul className="space-y-1">
                  {safeArray(data?.funnelBreakdown?.leadCaptureMethods).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              </div>
            )}
            {data?.funnelBreakdown?.formFriction && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-white/30 mb-1">Form Friction Level</p>
                <span className="text-sm capitalize text-white/70">{safeRender(data.funnelBreakdown.formFriction)}</span>
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
              <h4 className="font-medium mb-2 text-emerald-400/80">Market Strengths</h4>
              <ul className="space-y-1">
                {safeArray(data?.marketStrengths).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400/80" />
                    <span className="text-white/60"><SourcedListItem>{item}</SourcedListItem></span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-medium text-red-400/70">Market Weaknesses</h4>
              <ul className="space-y-1">
                {safeArray(data?.marketWeaknesses).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400/60" />
                    <span className="text-white/60"><SourcedListItem>{item}</SourcedListItem></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SubSection>
      )}

      {/* White Space Gaps / Gaps & Opportunities */}
      <SubSection title="Gaps & Opportunities">
        {data?.whiteSpaceGaps?.length ? (
          <div className="space-y-2.5">
            {data.whiteSpaceGaps.map((wsg: WhiteSpaceGap, idx: number) => {
              const typeConfig: Record<string, { bg: string; border: string; text: string }> = {
                messaging: { bg: "bg-emerald-500/[0.05]", border: "border-emerald-500/[0.18]", text: "text-emerald-400/70" },
                feature:   { bg: "bg-primary/[0.05]",    border: "border-primary/[0.18]",    text: "text-primary/70"    },
                audience:  { bg: "bg-violet-500/[0.05]",  border: "border-violet-500/[0.18]",  text: "text-violet-400/70"  },
                channel:   { bg: "bg-amber-500/[0.05]",   border: "border-amber-500/[0.18]",   text: "text-amber-400/70"   },
              };
              const config = typeConfig[wsg.type] || { bg: "bg-[var(--bg-surface)]", border: "border-border", text: "text-white/50" };
              return (
                <FieldHighlightWrapper key={idx} fieldPath={`whiteSpaceGaps[${idx}]`}>
                  <div className={cn("rounded-lg border p-3", config.bg, config.border)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn("text-[10px] font-semibold uppercase tracking-[0.08em]", config.text)}>
                        {wsg.type}
                      </span>
                      <span className="text-[10px] text-white/30 font-[family-name:var(--font-mono)]">
                        Exploit: {wsg.exploitability}/10 &middot; Impact: {wsg.impact}/10
                        {wsg.compositeScore != null && ` · Score: ${wsg.compositeScore}`}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white/85">{wsg.gap}</p>
                    <p className="text-xs text-white/40 mt-1">{wsg.evidence}</p>
                    <p className="text-xs text-white/60 mt-1">{wsg.recommendedAction}</p>
                  </div>
                </FieldHighlightWrapper>
              );
            })}
          </div>
        ) : (safeArray(data?.gapsAndOpportunities?.messagingOpportunities).length > 0 ||
              safeArray(data?.gapsAndOpportunities?.creativeOpportunities).length > 0 ||
              safeArray(data?.gapsAndOpportunities?.funnelOpportunities).length > 0 ||
              isEditing) ? (
          /* Legacy fallback for old blueprints */
          <CardGrid cols={3}>
            <div className="rounded-lg bg-emerald-500/[0.05] border border-emerald-500/[0.18] p-3">
              <h4 className="font-medium mb-2 text-emerald-400/80">Messaging Opportunities</h4>
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.gapsAndOpportunities?.messagingOpportunities)}
                  onSave={(v) => onFieldChange("gapsAndOpportunities.messagingOpportunities", v)}
                  renderPrefix={() => <Check className="h-4 w-4 text-primary/80" />}
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
            <div className="rounded-lg bg-primary/[0.05] border border-primary/[0.18] p-3">
              <h4 className="font-medium mb-2 text-primary/80">Creative Opportunities</h4>
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.gapsAndOpportunities?.creativeOpportunities)}
                  onSave={(v) => onFieldChange("gapsAndOpportunities.creativeOpportunities", v)}
                  renderPrefix={() => <Check className="h-4 w-4 text-primary/80" />}
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
            <div className="rounded-lg bg-violet-500/[0.05] border border-violet-500/[0.18] p-3">
              <h4 className="mb-2 font-medium text-violet-400/70">Funnel Opportunities</h4>
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.gapsAndOpportunities?.funnelOpportunities)}
                  onSave={(v) => onFieldChange("gapsAndOpportunities.funnelOpportunities", v)}
                  renderPrefix={() => <Check className="h-4 w-4 text-primary/80" />}
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
          </CardGrid>
        ) : (
          <EmptyExplanation message="No competitive gaps or opportunities identified from available data." />
        )}
      </SubSection>
    </div>
  );
}
