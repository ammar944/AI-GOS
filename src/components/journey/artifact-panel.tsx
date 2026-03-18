'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  JourneyKeywordIntelDetail,
  getJourneyKeywordIntelDetailData,
} from '@/components/journey/journey-keyword-intel-detail';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { CompetitorAdEvidence } from '@/components/journey/competitor-ad-evidence';
import {
  collapseResearchJobUpdates,
  type ResearchJobActivity,
} from '@/lib/journey/research-job-activity';

interface ArtifactPanelProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  data?: Record<string, unknown>;
  activity?: ResearchJobActivity;
  approved: boolean;
  onApprove: () => void;
  feedbackMode?: boolean;
  onRequestChanges: () => void;
  onClose: () => void;
  showCloseButton?: boolean;
  showReviewControls?: boolean;
}

function useTicker(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  return now;
}

function formatElapsed(iso: string | undefined, now: number): string | null {
  if (!iso) return null;

  const deltaSeconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s`;

  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  return `${deltaHours}h`;
}

function getArtifactWaitGuidance(section: string): string {
  if (section === 'competitors' || section === 'icpValidation') {
    return '[NOTE] This section usually takes 2-3 minutes. Live worker activity streams first; the full artifact appears only after the final write completes.';
  }

  if (section === 'offerAnalysis') {
    return '[NOTE] This section usually takes 1-2 minutes. The full artifact appears once the worker finishes the final synthesis write.';
  }

  return '[INFO] Final artifact blocks will render once the worker writes the completed result.';
}

// -- Loading State -------------------------------------------------------------
function ArtifactLoading({
  activity,
  label,
  section,
}: {
  activity?: ResearchJobActivity;
  label: string;
  section: string;
}) {
  const now = useTicker(Boolean(activity?.startedAt || activity?.lastHeartbeat));
  const startedAgo = formatElapsed(activity?.startedAt, now);
  const heartbeatAgo = formatElapsed(activity?.lastHeartbeat, now);
  const statusLabel =
    activity?.status === 'running'
      ? 'Worker Running'
      : activity?.status === 'error'
        ? 'Worker Error'
        : 'Queued';

  const streamedUpdates = collapseResearchJobUpdates(activity?.updates)
    .slice(-10)
    .map((update) => {
      const age = formatElapsed(update.at, now);
      return {
        id: update.id,
        text: `[${update.phase.toUpperCase()}] ${update.message}${update.count > 1 ? ` x${update.count}` : ''}${age ? ` · ${age} ago` : ''}`,
      };
    });

  const fallbackLines = [
    `[LIVE] ${label} research dispatched from Journey.`,
    activity?.startedAt
      ? `[RUN] Worker started ${startedAgo ?? 'just now'} ago.`
      : '[WAIT] Waiting for worker pickup.',
    heartbeatAgo
      ? `[PING] Last worker heartbeat ${heartbeatAgo} ago.`
      : null,
    activity?.status === 'error' && activity.error
      ? `[ERR] ${activity.error}`
      : getArtifactWaitGuidance(section),
  ].filter(Boolean) as string[];

  const logLines = streamedUpdates.length > 0
    ? streamedUpdates
    : fallbackLines.map((line, index) => ({
        id: `fallback-${index}`,
        text: line,
      }));

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
      <div className="flex gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--section-market)]/10 text-[var(--section-market-text)] text-xs font-mono">
          <Loader2 className="w-3 h-3 animate-spin" />
          {statusLabel}
        </span>
      </div>

      <div className="w-full max-w-xl glass-surface rounded-[var(--radius-control)] p-4">
        <div className="space-y-2 text-xs font-mono text-text-secondary">
          {logLines.map((line) => (
            <div key={line.id}>{line.text}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- Document Renderer -- industryMarket data ----------------------------------
function IndustryMarketDocument({ data }: { data: Record<string, unknown> }) {
  const snapshot = data.categorySnapshot as Record<string, unknown> | undefined;
  const dynamics = data.marketDynamics as Record<string, unknown> | undefined;
  const painPoints = data.painPoints as Record<string, unknown> | undefined;
  const messaging = data.messagingOpportunities as Record<string, unknown> | undefined;
  const trends = data.trendSignals as Array<Record<string, unknown>> | undefined;

  // Build ordered list of renderable blocks — avoids side effects in JSX
  const blocks: Array<{ key: string; render: () => React.ReactNode }> = [];

  if (snapshot) {
    blocks.push({
      key: 'snapshot',
      render: () => (
        <>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-4">
            Category Snapshot
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {!!snapshot.category && <StatBlock label="Category" value={String(snapshot.category)} />}
            {!!snapshot.marketSize && <StatBlock label="Market Size" value={String(snapshot.marketSize)} />}
            {!!snapshot.marketMaturity && <StatBlock label="Maturity" value={String(snapshot.marketMaturity)} />}
            {!!snapshot.awarenessLevel && <StatBlock label="Awareness" value={String(snapshot.awarenessLevel)} />}
            {!!snapshot.buyingBehavior && <StatBlock label="Buying Behavior" value={String(snapshot.buyingBehavior).replaceAll('_', ' ')} />}
            {!!snapshot.averageSalesCycle && <StatBlock label="Sales Cycle" value={String(snapshot.averageSalesCycle)} />}
          </div>
        </>
      ),
    });
  }

  if (painPoints?.primary && Array.isArray(painPoints.primary)) {
    blocks.push({
      key: 'painPoints',
      render: () => (
        <>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Pain Points
          </h3>
          <ul className="space-y-2">
            {(painPoints.primary as string[]).map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-[var(--section-market)] mt-1.5 shrink-0">&#x2022;</span>
                {point}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }

  if (dynamics?.demandDrivers && Array.isArray(dynamics.demandDrivers)) {
    blocks.push({
      key: 'demandDrivers',
      render: () => (
        <>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Demand Drivers
          </h3>
          <ul className="space-y-2">
            {(dynamics.demandDrivers as string[]).map((driver, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-[var(--section-market)] mt-1.5 shrink-0">&#x2022;</span>
                {driver}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }

  if (dynamics?.buyingTriggers && Array.isArray(dynamics.buyingTriggers)) {
    blocks.push({
      key: 'buyingTriggers',
      render: () => (
        <>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Buying Triggers
          </h3>
          <ul className="space-y-2">
            {(dynamics.buyingTriggers as string[]).map((trigger, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-[var(--section-market)] mt-1.5 shrink-0">&#x2022;</span>
                {trigger}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }

  if (dynamics?.barriersToPurchase && Array.isArray(dynamics.barriersToPurchase)) {
    blocks.push({
      key: 'barriers',
      render: () => (
        <>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Barriers to Purchase
          </h3>
          <ul className="space-y-2">
            {(dynamics.barriersToPurchase as string[]).map((barrier, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-[var(--section-market)] mt-1.5 shrink-0">&#x2022;</span>
                {barrier}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }

  if (trends && trends.length > 0) {
    blocks.push({
      key: 'trends',
      render: () => (
        <>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Trend Signals
          </h3>
          <div className="space-y-3">
            {trends.map((trend, i) => (
              <div key={i} className="glass-surface rounded-[var(--radius-control)] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded',
                    trend.direction === 'rising' && 'bg-accent-green/10 text-accent-green',
                    trend.direction === 'declining' && 'bg-accent-red/10 text-accent-red',
                    trend.direction === 'stable' && 'bg-white/5 text-text-tertiary',
                  )}>
                    {String(trend.direction)}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{String(trend.trend)}</span>
                </div>
                <p className="text-xs text-text-tertiary">{String(trend.evidence)}</p>
              </div>
            ))}
          </div>
        </>
      ),
    });
  }

  if (messaging?.summaryRecommendations && Array.isArray(messaging.summaryRecommendations)) {
    blocks.push({
      key: 'messaging',
      render: () => (
        <>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Messaging Opportunities
          </h3>
          <ul className="space-y-2">
            {(messaging.summaryRecommendations as string[]).map((rec, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-accent-green mt-1.5 shrink-0">&#x2713;</span>
                {rec}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }

  const visibleBlocks = useProgressiveReveal(true, blocks.length);

  return (
    <div className="space-y-8 pb-8">
      {blocks.slice(0, visibleBlocks).map(({ key, render }) => (
        <motion.section
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {render()}
        </motion.section>
      ))}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-surface rounded-[var(--radius-control)] p-3">
      <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider block mb-1">
        {label}
      </span>
      <span className="text-sm font-medium text-text-primary capitalize">
        {value}
      </span>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function hasLimitedAdCoverage(adActivity: Record<string, unknown>): boolean {
  const sourceConfidence = asString(adActivity.sourceConfidence)?.toLowerCase();
  const evidence = asString(adActivity.evidence)?.toLowerCase() ?? '';
  const platforms = asStringArray(adActivity.platforms).map((platform) =>
    platform.toLowerCase(),
  );

  return (
    sourceConfidence === 'low' ||
    platforms.includes('not verified') ||
    /limited coverage|not verified|historical/.test(evidence)
  );
}

function getAdActivityCountLabel(adActivity: Record<string, unknown>): string {
  return hasLimitedAdCoverage(adActivity) ? 'Observed Ads' : 'Active Ads';
}

function getAdActivityCoverageValue(adActivity: Record<string, unknown>): string {
  if (hasLimitedAdCoverage(adActivity)) {
    return 'Limited Coverage';
  }

  const sourceConfidence = asString(adActivity.sourceConfidence)?.toLowerCase();
  if (sourceConfidence === 'high') {
    return 'Verified';
  }

  return 'Partial Coverage';
}

function getAdActivityPlatforms(adActivity: Record<string, unknown>): string[] {
  return asStringArray(adActivity.platforms).map((platform) =>
    platform.toLowerCase() === 'not verified' ? 'Not Verified' : platform,
  );
}

function SimpleList({
  title,
  items,
  accent = 'var(--section-market)',
}: {
  title: string;
  items: string[];
  accent?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
            <span className="mt-1.5 shrink-0" style={{ color: accent }}>
              &#x2022;
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompetitorIntelDocument({ data }: { data: Record<string, unknown> }) {
  const competitors = Array.isArray(data.competitors)
    ? data.competitors
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const whiteSpaceGaps = Array.isArray(data.whiteSpaceGaps)
    ? data.whiteSpaceGaps
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const marketPatterns = asStringArray(data.marketPatterns);

  return (
    <div className="space-y-8 pb-8">
      {competitors.map((competitor, index) => {
        const name = asString(competitor.name) ?? `Competitor ${index + 1}`;
        const website = asString(competitor.website);
        const positioning = asString(competitor.positioning);
        const price = asString(competitor.price);
        const pricingConfidence = asString(competitor.pricingConfidence);
        const strengths = asStringArray(competitor.strengths);
        const weaknesses = asStringArray(competitor.weaknesses);
        const opportunities = asStringArray(competitor.opportunities);
        const ourAdvantage = asString(competitor.ourAdvantage);
        const adActivity = asRecord(competitor.adActivity);
        const threat = asRecord(competitor.threatAssessment);
        const hooks = asStringArray(threat?.topAdHooks);
        const counterPositioning = asString(threat?.counterPositioning);

        return (
          <section key={name} className="glass-surface rounded-[var(--radius-control)] p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary">{name}</h3>
                {website && (
                  <p className="mt-1 text-xs font-mono text-text-tertiary">{website}</p>
                )}
                {positioning && (
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{positioning}</p>
                )}
              </div>
              <div className="flex gap-2">
                {price && <StatBlock label="Price" value={price} />}
                {pricingConfidence && (
                  <StatBlock label="Pricing Confidence" value={pricingConfidence} />
                )}
              </div>
            </div>

            <SimpleList title="Strengths" items={strengths} accent="var(--accent-green)" />
            <SimpleList title="Weaknesses" items={weaknesses} accent="var(--accent-red)" />
            <SimpleList title="Opportunities" items={opportunities} accent="var(--accent-blue)" />
            <SimpleList title="Top Ad Hooks" items={hooks} accent="var(--accent-cyan)" />

            {ourAdvantage && (
              <div>
                <h4 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-2">
                  {`Our Advantage vs ${name}`}
                </h4>
                <p className="text-sm leading-relaxed text-text-secondary">{ourAdvantage}</p>
              </div>
            )}

            {adActivity && (
              <div className="glass-surface rounded-[var(--radius-control)] p-3 space-y-2">
                <h4 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest">
                  Ad Activity
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {asNumber(adActivity.activeAdCount) !== null && (
                    <StatBlock
                      label={getAdActivityCountLabel(adActivity)}
                      value={String(asNumber(adActivity.activeAdCount))}
                    />
                  )}
                  {asString(adActivity.sourceConfidence) && (
                    <StatBlock
                      label="Coverage"
                      value={getAdActivityCoverageValue(adActivity)}
                    />
                  )}
                </div>
                <SimpleList
                  title="Platforms"
                  items={getAdActivityPlatforms(adActivity)}
                  accent="var(--accent-cyan)"
                />
                <SimpleList
                  title="Themes"
                  items={asStringArray(adActivity.themes)}
                  accent="var(--accent-blue)"
                />
                {asString(adActivity.evidence) && (
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {String(adActivity.evidence)}
                  </p>
                )}
              </div>
            )}

            <CompetitorAdEvidence
              adActivity={adActivity ? {
                activeAdCount: asNumber(adActivity.activeAdCount) ?? 0,
                platforms: asStringArray(adActivity.platforms),
                themes: asStringArray(adActivity.themes),
                evidence: asString(adActivity.evidence) ?? '',
                sourceConfidence: (asString(adActivity.sourceConfidence) as 'high' | 'medium' | 'low') ?? 'low',
              } : undefined}
              adCreatives={
                Array.isArray(competitor.adCreatives)
                  ? (competitor.adCreatives as Array<Record<string, unknown>>)
                      .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
                      .map((c) => ({
                        platform: (asString(c.platform) ?? 'meta') as 'linkedin' | 'meta' | 'google',
                        id: asString(c.id) ?? '',
                        advertiser: asString(c.advertiser) ?? '',
                        headline: asString(c.headline) ?? undefined,
                        body: asString(c.body) ?? undefined,
                        imageUrl: asString(c.imageUrl) ?? undefined,
                        videoUrl: asString(c.videoUrl) ?? undefined,
                        format: (asString(c.format) ?? 'unknown') as 'video' | 'image' | 'carousel' | 'text' | 'message' | 'unknown',
                        isActive: c.isActive === true,
                        detailsUrl: asString(c.detailsUrl) ?? undefined,
                        firstSeen: asString(c.firstSeen) ?? undefined,
                        lastSeen: asString(c.lastSeen) ?? undefined,
                      }))
                  : undefined
              }
              libraryLinks={
                asRecord(competitor.libraryLinks)
                  ? {
                      metaLibraryUrl: asString(asRecord(competitor.libraryLinks)?.metaLibraryUrl) ?? undefined,
                      linkedInLibraryUrl: asString(asRecord(competitor.libraryLinks)?.linkedInLibraryUrl) ?? undefined,
                      googleAdvertiserUrl: asString(asRecord(competitor.libraryLinks)?.googleAdvertiserUrl) ?? undefined,
                    }
                  : undefined
              }
            />

            {counterPositioning && (
              <div>
                <h4 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-2">
                  Counter Positioning
                </h4>
                <p className="text-sm leading-relaxed text-text-secondary">{counterPositioning}</p>
              </div>
            )}
          </section>
        );
      })}

      <SimpleList title="Market Patterns" items={marketPatterns} accent="var(--accent-cyan)" />

      {whiteSpaceGaps.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            White-Space Gaps
          </h3>
          <div className="space-y-3">
            {whiteSpaceGaps.map((gap, index) => (
              <div
                key={`${gap.gap ?? 'gap'}-${index}`}
                className="glass-surface rounded-[var(--radius-control)] p-4 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">
                    {asString(gap.gap) ?? `Gap ${index + 1}`}
                  </p>
                  {asString(gap.type) && (
                    <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                      {String(gap.type)}
                    </span>
                  )}
                </div>
                {asString(gap.evidence) && (
                  <p className="text-sm text-text-secondary">{String(gap.evidence)}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {asNumber(gap.exploitability) !== null && (
                    <StatBlock
                      label="Exploitability"
                      value={`${asNumber(gap.exploitability)}/10`}
                    />
                  )}
                  {asNumber(gap.impact) !== null && (
                    <StatBlock label="Impact" value={`${asNumber(gap.impact)}/10`} />
                  )}
                </div>
                {asString(gap.recommendedAction) && (
                  <p className="text-sm text-text-secondary">
                    {String(gap.recommendedAction)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ICPValidationDocument({ data }: { data: Record<string, unknown> }) {
  const validatedPersona = asString(data.validatedPersona);
  const demographics = asString(data.demographics);
  const audienceSize = asString(data.audienceSize);
  const confidenceScore = asNumber(data.confidenceScore);
  const decisionProcess = asString(data.decisionProcess);
  const channels = asStringArray(data.channels);
  const triggers = asStringArray(data.triggers);
  const objections = asStringArray(data.objections);
  const finalVerdict = asRecord(data.finalVerdict);
  const recommendations = asStringArray(finalVerdict?.recommendations);

  return (
    <div className="space-y-8 pb-8">
      <section className="grid grid-cols-2 gap-3">
        {validatedPersona && <StatBlock label="Validated Persona" value={validatedPersona} />}
        {audienceSize && <StatBlock label="Audience Size" value={audienceSize} />}
        {confidenceScore !== null && <StatBlock label="Confidence" value={`${confidenceScore}/100`} />}
        {demographics && <StatBlock label="Demographics" value={demographics} />}
      </section>

      {finalVerdict && (
        <section className="glass-surface rounded-[var(--radius-control)] p-4">
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-2">
            Final Verdict
          </h3>
          {asString(finalVerdict.status) && (
            <p className="text-sm font-semibold text-text-primary capitalize">
              {String(finalVerdict.status).replaceAll('_', ' ')}
            </p>
          )}
          {asString(finalVerdict.reasoning) && (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {String(finalVerdict.reasoning)}
            </p>
          )}
        </section>
      )}

      {decisionProcess && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Decision Process
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">{decisionProcess}</p>
        </section>
      )}

      <SimpleList title="Best Channels" items={channels} accent="var(--accent-cyan)" />
      <SimpleList title="Buying Triggers" items={triggers} accent="var(--accent-blue)" />
      <SimpleList title="Core Objections" items={objections} accent="var(--accent-red)" />
      <SimpleList title="Recommendations" items={recommendations} accent="var(--accent-green)" />
    </div>
  );
}

function OfferAnalysisDocument({ data }: { data: Record<string, unknown> }) {
  const offerStrength = asRecord(data.offerStrength);
  const recommendation = asRecord(data.recommendation);
  const overallScore = asNumber(offerStrength?.overallScore);
  const strengths = asStringArray(recommendation?.topStrengths);
  const weaknesses = asStringArray(recommendation?.priorityFixes);
  const actionItems = asStringArray(recommendation?.recommendedActionPlan);
  const reasoning = asString(recommendation?.summary);
  const redFlags = Array.isArray(data.redFlags)
    ? data.redFlags
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const pricingAnalysis = asRecord(data.pricingAnalysis);
  const messagingRecommendations = asStringArray(data.messagingRecommendations);
  const marketFitAssessment = asString(data.marketFitAssessment);

  return (
    <div className="space-y-8 pb-8">
      <section className="grid grid-cols-2 gap-3">
        {overallScore !== null && <StatBlock label="Overall Score" value={`${overallScore}/10`} />}
        {asString(recommendation?.status) && (
          <StatBlock
            label="Recommendation"
            value={String(recommendation?.status).replaceAll('_', ' ')}
          />
        )}
      </section>

      {reasoning && (
        <section className="glass-surface rounded-[var(--radius-control)] p-4">
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-2">
            Recommendation Rationale
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">{reasoning}</p>
        </section>
      )}

      {pricingAnalysis && (
        <section className="glass-surface rounded-[var(--radius-control)] p-4 space-y-3">
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest">
            Pricing Analysis
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {asString(pricingAnalysis.currentPricing) && (
              <StatBlock label="Current Pricing" value={String(pricingAnalysis.currentPricing)} />
            )}
            {asString(pricingAnalysis.marketBenchmark) && (
              <StatBlock label="Benchmark" value={String(pricingAnalysis.marketBenchmark)} />
            )}
            {asString(pricingAnalysis.pricingPosition) && (
              <StatBlock label="Position" value={String(pricingAnalysis.pricingPosition)} />
            )}
          </div>
          {asString(pricingAnalysis.coldTrafficViability) && (
            <p className="text-sm text-text-secondary">
              {String(pricingAnalysis.coldTrafficViability)}
            </p>
          )}
        </section>
      )}

      <SimpleList title="Strengths" items={strengths} accent="var(--accent-green)" />
      <SimpleList title="Weaknesses" items={weaknesses} accent="var(--accent-red)" />
      <SimpleList title="Recommended Actions" items={actionItems} accent="var(--accent-blue)" />
      <SimpleList
        title="Messaging Recommendations"
        items={messagingRecommendations}
        accent="var(--accent-cyan)"
      />

      {marketFitAssessment && (
        <section className="glass-surface rounded-[var(--radius-control)] p-4">
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-2">
            Market Fit Assessment
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            {marketFitAssessment}
          </p>
        </section>
      )}

      {redFlags.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Red Flags
          </h3>
          <div className="space-y-3">
            {redFlags.map((flag, index) => (
              <div
                key={`${flag.issue ?? 'flag'}-${index}`}
                className="glass-surface rounded-[var(--radius-control)] p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-text-primary">
                    {asString(flag.issue) ?? `Flag ${index + 1}`}
                  </p>
                  <div className="flex gap-2">
                    {asString(flag.severity) && (
                      <StatBlock label="Severity" value={String(flag.severity)} />
                    )}
                    {asNumber(flag.priority) !== null && (
                      <StatBlock label="Priority" value={String(asNumber(flag.priority))} />
                    )}
                  </div>
                </div>
                {asString(flag.evidence) && (
                  <p className="text-sm text-text-secondary">{String(flag.evidence)}</p>
                )}
                {asString(flag.recommendedAction) && (
                  <p className="text-sm text-text-secondary">
                    {String(flag.recommendedAction)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CrossAnalysisDocument({ data }: { data: Record<string, unknown> }) {
  const positioningStrategy = asRecord(data.positioningStrategy);
  const recommendedAngle = asString(positioningStrategy?.recommendedAngle);
  const leadRecommendation = asString(positioningStrategy?.leadRecommendation);
  const differentiator = asString(positioningStrategy?.keyDifferentiator);
  const narrative = asString(data.strategicNarrative);
  const planningContext = asRecord(data.planningContext);
  const criticalSuccessFactors = asStringArray(data.criticalSuccessFactors);
  const nextSteps = asStringArray(data.nextSteps);
  const keyInsights = Array.isArray(data.keyInsights)
    ? data.keyInsights
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const platformRecommendations = Array.isArray(data.platformRecommendations)
    ? data.platformRecommendations
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const messagingAngles = Array.isArray(data.messagingAngles)
    ? data.messagingAngles
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const charts = Array.isArray(data.charts)
    ? data.charts
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];

  return (
    <div className="space-y-8 pb-8">
      {(recommendedAngle || leadRecommendation || differentiator) && (
        <section className="glass-surface rounded-[var(--radius-control)] p-4 space-y-3">
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest">
            Positioning Strategy
          </h3>
          {recommendedAngle && (
            <p className="text-base font-semibold text-text-primary">{recommendedAngle}</p>
          )}
          {leadRecommendation && (
            <p className="text-sm leading-relaxed text-text-secondary">{leadRecommendation}</p>
          )}
          {differentiator && (
            <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Differentiator:</span> {differentiator}
            </div>
          )}
        </section>
      )}

      {planningContext && (
        <section className="glass-surface rounded-[var(--radius-control)] p-4 space-y-3">
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest">
            Planning Context
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {asString(planningContext.monthlyBudget) && (
              <StatBlock label="Budget" value={String(planningContext.monthlyBudget)} />
            )}
            {asString(planningContext.targetCpl) && (
              <StatBlock label="Target CPL" value={String(planningContext.targetCpl)} />
            )}
            {asString(planningContext.targetCac) && (
              <StatBlock label="Target CAC" value={String(planningContext.targetCac)} />
            )}
          </div>
          <SimpleList
            title="Downstream Sequence"
            items={asStringArray(planningContext.downstreamSequence)}
            accent="var(--accent-blue)"
          />
        </section>
      )}

      {charts.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Charts
          </h3>
          <div className="grid gap-4">
            {charts.map((chart, index) => {
              const title = asString(chart.title) ?? `Chart ${index + 1}`;
              const imageUrl = asString(chart.imageUrl) ?? asString(chart.url);
              const description = asString(chart.description);

              return (
                <div key={`${title}-${index}`} className="glass-surface rounded-[var(--radius-control)] p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-text-primary">{title}</h4>
                    {description && (
                      <p className="mt-1 text-sm leading-relaxed text-text-secondary">{description}</p>
                    )}
                  </div>
                  {imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote chart URLs come from the worker and may use dynamic external hosts
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full rounded-[var(--radius-control)] border border-white/10 bg-[var(--bg-surface)] object-cover"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {narrative && (
        <section className="glass-surface rounded-[var(--radius-control)] p-4">
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-2">
            Strategic Narrative
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">{narrative}</p>
        </section>
      )}

      {keyInsights.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Key Insights
          </h3>
          <div className="space-y-3">
            {keyInsights.map((insight, index) => {
              const headline = asString(insight.insight);
              const implication = asString(insight.implication);
              const source = asString(insight.source);

              if (!headline) {
                return null;
              }

              return (
                <div key={`${headline}-${index}`} className="glass-surface rounded-[var(--radius-control)] p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    {source && (
                      <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                        {source}
                      </span>
                    )}
                    <p className="text-sm font-medium text-text-primary">{headline}</p>
                  </div>
                  {implication && (
                    <p className="text-sm leading-relaxed text-text-secondary">{implication}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {platformRecommendations.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Platform Recommendations
          </h3>
          <div className="space-y-3">
            {platformRecommendations.map((platform, index) => {
              const name = asString(platform.platform) ?? `Platform ${index + 1}`;
              const role = asString(platform.role);
              const budgetAllocation = asString(platform.budgetAllocation);
              const rationale = asString(platform.rationale);

              return (
                <div key={`${name}-${index}`} className="glass-surface rounded-[var(--radius-control)] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-text-primary">{name}</p>
                    {role && (
                      <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                        {role}
                      </span>
                    )}
                  </div>
                  {budgetAllocation && (
                    <p className="text-sm text-text-secondary">{budgetAllocation}</p>
                  )}
                  {rationale && (
                    <p className="text-sm leading-relaxed text-text-secondary">{rationale}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {messagingAngles.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Messaging Angles
          </h3>
          <div className="space-y-3">
            {messagingAngles.map((angle, index) => {
              const title = asString(angle.angle) ?? `Angle ${index + 1}`;
              const hook = asString(angle.exampleHook);
              const evidence = asString(angle.evidence);

              return (
                <div key={`${title}-${index}`} className="glass-surface rounded-[var(--radius-control)] p-3 space-y-2">
                  <p className="text-sm font-medium text-text-primary">{title}</p>
                  {hook && <p className="text-sm leading-relaxed text-text-secondary">{hook}</p>}
                  {evidence && (
                    <p className="text-xs leading-relaxed text-text-tertiary">{evidence}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SimpleList title="Critical Success Factors" items={criticalSuccessFactors} accent="var(--accent-green)" />
      <SimpleList title="Next Steps" items={nextSteps} accent="var(--accent-blue)" />
    </div>
  );
}

function KeywordIntelDocument({ data }: { data: Record<string, unknown> }) {
  const normalized = getJourneyKeywordIntelDetailData(data);

  if (!normalized) {
    return (
      <div className="space-y-8 pb-8">
        <p className="text-sm text-text-secondary">
          Keyword intelligence could not be rendered.
        </p>
      </div>
    );
  }

  return <JourneyKeywordIntelDetail data={normalized} />;
}

function MediaPlanDocument({ data }: { data: Record<string, unknown> }) {
  const budgetSummary = asRecord(data.budgetSummary);
  const totalMonthly = asNumber(budgetSummary?.totalMonthly);
  const byPlatform = Array.isArray(budgetSummary?.byPlatform)
    ? budgetSummary.byPlatform
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const channelPlan = Array.isArray(data.channelPlan)
    ? data.channelPlan
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const launchSequence = Array.isArray(data.launchSequence)
    ? data.launchSequence
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const kpiFramework = asRecord(data.kpiFramework);
  const northStar = asString(kpiFramework?.northStar);
  const weeklyReview = asStringArray(kpiFramework?.weeklyReview);

  const budgetRows = (byPlatform.length > 0 ? byPlatform : channelPlan)
    .map((item, index) => {
      const platform = asString(item.platform) ?? `Platform ${index + 1}`;
      const amount = asNumber(item.amount) ?? asNumber(item.monthlyBudget);
      const percentage = asNumber(item.percentage) ?? asNumber(item.budgetPercentage);

      return {
        platform,
        amount,
        percentage,
      };
    })
    .filter((item) => item.amount !== null || item.percentage !== null);

  const launchItems = launchSequence
    .map((item) => {
      const week = asNumber(item.week);
      const milestone = asString(item.milestone);
      const actions = asStringArray(item.actions);
      const summary = actions[0] ?? milestone;

      if (!summary) {
        return null;
      }

      return week !== null ? `Week ${week} — ${summary}` : summary;
    })
    .filter((item): item is string => Boolean(item));

  return (
    <div className="space-y-8 pb-8">
      <section className="grid grid-cols-2 gap-3">
        {totalMonthly !== null && (
          <StatBlock label="Monthly Budget" value={`$${totalMonthly.toLocaleString()}`} />
        )}
        {northStar && <StatBlock label="North Star" value={northStar} />}
      </section>

      {budgetRows.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Budget Allocation
          </h3>
          <div className="space-y-2">
            {budgetRows.map((row, index) => (
              <div key={`${row.platform}-${index}`} className="glass-surface rounded-[var(--radius-control)] p-3 flex items-center justify-between gap-4">
                <span className="text-sm text-text-primary">{row.platform}</span>
                <span className="text-sm text-text-secondary">
                  {row.amount !== null ? `$${row.amount.toLocaleString()}` : 'Budget TBD'}
                  {row.percentage !== null ? ` · ${row.percentage}%` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <SimpleList title="Launch Sequence" items={launchItems} accent="var(--accent-blue)" />
      <SimpleList title="Weekly Review" items={weeklyReview} accent="var(--accent-green)" />
    </div>
  );
}

// -- Progressive Reveal --------------------------------------------------------
function useProgressiveReveal(isComplete: boolean, totalBlocks: number) {
  const [visibleBlocks, setVisibleBlocks] = useState(0);

  useEffect(() => {
    if (!isComplete || totalBlocks === 0) {
      const resetFrame = requestAnimationFrame(() => setVisibleBlocks(0));
      return () => cancelAnimationFrame(resetFrame);
    }

    // Reset before starting reveal (handles strict mode double-fire) without
    // tripping the lint rule against synchronous setState in effects.
    const resetFrame = requestAnimationFrame(() => setVisibleBlocks(0));
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setVisibleBlocks(current);
      if (current >= totalBlocks) clearInterval(interval);
    }, 200);

    return () => {
      cancelAnimationFrame(resetFrame);
      clearInterval(interval);
    };
  }, [isComplete, totalBlocks]);

  return visibleBlocks;
}

// -- Main Export ---------------------------------------------------------------
export function ArtifactPanel({
  section,
  status,
  data,
  activity,
  approved,
  onApprove,
  feedbackMode = false,
  onRequestChanges,
  onClose,
  showCloseButton = true,
  showReviewControls = true,
}: ArtifactPanelProps) {
  const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;
  const isComplete = status === 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="h-full flex flex-col glass-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-glass)]">
        <div className="flex items-center gap-3">
          {approved ? (
            <div className="w-2.5 h-2.5 rounded-full bg-accent-green shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          ) : isComplete ? (
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--section-market)]" style={{ boxShadow: '0 0 10px color-mix(in srgb, var(--section-market) 30%, transparent)' }} />
          ) : (
            <Loader2 className="w-4 h-4 text-[var(--section-market)] animate-spin" />
          )}
          <div>
            <span className="text-[10px] font-mono text-[var(--section-market-text)] uppercase tracking-widest">
              Module {meta.moduleNumber}
            </span>
            <h2 className="text-base font-heading font-semibold text-text-primary">
              {meta.label}
            </h2>
          </div>
        </div>
        {showCloseButton ? (
          <button
            onClick={onClose}
            aria-label="Close artifact panel"
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6">
        {status === 'loading' && (
          <ArtifactLoading activity={activity} label={meta.label} section={section} />
        )}
        {status === 'complete' && data && section === 'industryMarket' && (
          <IndustryMarketDocument data={data} />
        )}
        {status === 'complete' && data && section === 'competitors' && (
          <CompetitorIntelDocument data={data} />
        )}
        {status === 'complete' && data && section === 'icpValidation' && (
          <ICPValidationDocument data={data} />
        )}
        {status === 'complete' && data && section === 'offerAnalysis' && (
          <OfferAnalysisDocument data={data} />
        )}
        {status === 'complete' && data && section === 'crossAnalysis' && (
          <CrossAnalysisDocument data={data} />
        )}
        {status === 'complete' && data && section === 'keywordIntel' && (
          <KeywordIntelDocument data={data} />
        )}
        {status === 'complete' && data && section === 'mediaPlan' && (
          <MediaPlanDocument data={data} />
        )}
        {status === 'error' && (
          <div className="min-h-full flex items-center justify-center">
            <p className="text-sm text-accent-red">Research failed. The agent will continue with available data.</p>
          </div>
        )}
      </div>

      {/* Footer -- Approval button */}
      {showReviewControls ? (
        <div className="px-6 py-4 border-t border-[var(--border-glass)]">
          {approved ? (
            <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-accent-green">
              <Check className="w-4 h-4" />
              Section Approved
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={onApprove}
                  disabled={!isComplete}
                  className={cn(
                    'flex-1 py-2.5 rounded-[var(--radius-control)] text-sm font-medium transition-all duration-200',
                    isComplete
                      ? 'sl-btn-primary cursor-pointer'
                      : 'bg-[var(--bg-surface)] text-text-tertiary cursor-not-allowed',
                  )}
                >
                  {isComplete ? 'Looks Good' : 'Waiting for research...'}
                </button>
                <button
                  onClick={onRequestChanges}
                  disabled={!isComplete}
                  className={cn(
                    'rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-medium transition-colors duration-200',
                    isComplete
                      ? 'border-white/10 text-white/72 hover:bg-[var(--bg-hover)] hover:text-white'
                      : 'border-[var(--border-glass)] text-text-tertiary cursor-not-allowed',
                  )}
                >
                  Needs changes
                </button>
              </div>
              {feedbackMode && (
                <p className="text-xs leading-relaxed text-amber-200/70">
                  Tell the agent what to fix in chat. The Journey will stay on this artifact until
                  you approve it.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}
