// src/components/shell/research-canvas.tsx
// Tabbed research canvas for the right panel.
// Tabs appear progressively as research sections complete.
// Each tab shows the full structured output for that section.

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Users, Target, Package, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResearchSectionKey, ResearchSection } from '@/hooks/use-research-data';

// ── Section meta ────────────────────────────────────────────────────────────

interface SectionTab {
  key: ResearchSectionKey;
  label: string;
  shortLabel: string;
  icon: typeof Globe;
  color: string;
}

const TABS: SectionTab[] = [
  { key: 'industryMarket', label: 'Industry & Market', shortLabel: 'Industry', icon: Globe,    color: 'var(--accent-blue)' },
  { key: 'competitors',    label: 'Competitor Analysis', shortLabel: 'Competitors', icon: Users, color: 'var(--accent-purple, #a855f7)' },
  { key: 'icpValidation',  label: 'ICP Validation',     shortLabel: 'ICP',       icon: Target,  color: 'var(--accent-cyan, #06b6d4)' },
  { key: 'offerAnalysis',  label: 'Offer Analysis',     shortLabel: 'Offer',     icon: Package, color: 'var(--accent-green, #22c55e)' },
  { key: 'crossAnalysis',  label: 'Synthesis',          shortLabel: 'Synthesis', icon: Layers,  color: '#f59e0b' },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface ResearchCanvasProps {
  sections: Record<ResearchSectionKey, ResearchSection>;
  activeSection?: ResearchSectionKey | null;
  onTabChange?: (key: ResearchSectionKey) => void;
}

// ── Tab bar ────────────────────────────────────────────────────────────────

function TabBar({
  tabs,
  activeKey,
  sections,
  onSelect,
}: {
  tabs: SectionTab[];
  activeKey: ResearchSectionKey | null;
  sections: Record<ResearchSectionKey, ResearchSection>;
  onSelect: (key: ResearchSectionKey) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: '8px 12px 0',
        borderBottom: '1px solid var(--border-default)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map((tab) => {
        const section = sections[tab.key];
        const isAvailable = section.status === 'complete' || section.status === 'error';
        const isRunning = section.status === 'running';
        const isActive = activeKey === tab.key;
        const Icon = tab.icon;

        if (!isAvailable && !isRunning) return null; // Tab only appears when visible

        return (
          <motion.button
            key={tab.key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => isAvailable && onSelect(tab.key)}
            disabled={!isAvailable}
            style={{
              flexShrink: 0,
              padding: '6px 10px',
              borderRadius: '6px 6px 0 0',
              border: '1px solid transparent',
              borderBottom: 'none',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              borderColor: isActive ? 'var(--border-default)' : 'transparent',
              cursor: isAvailable ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              position: 'relative',
              marginBottom: isActive ? -1 : 0,
            }}
          >
            {isRunning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Icon style={{ width: 11, height: 11, color: tab.color }} />
              </motion.div>
            ) : (
              <Icon
                style={{
                  width: 11,
                  height: 11,
                  color: isActive ? tab.color : 'var(--text-quaternary)',
                }}
              />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-quaternary)',
                letterSpacing: '0.01em',
              }}
            >
              {tab.shortLabel}
            </span>
            {isRunning && (
              <motion.span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: tab.color,
                  flexShrink: 0,
                }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Section content views ──────────────────────────────────────────────────
// These render the raw structured data in a readable way.
// Each is a separate component so they can be upgraded independently.

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
      {children}
    </p>
  );
}

function DataRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function BulletList({ items, color = 'var(--accent-blue)' }: { items: string[]; color?: string }) {
  if (!items?.length) return null;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? 'var(--accent-blue)' : pct >= 50 ? '#f59e0b' : 'var(--status-error)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border-default)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, flexShrink: 0 }}>{score}/{max}</span>
    </div>
  );
}

function get<T>(obj: unknown, key: string): T | undefined {
  return (obj as Record<string, T> | undefined)?.[key];
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  return get<string>(v, 'point') ?? get<string>(v, 'insight') ?? get<string>(v, 'name') ?? '';
}

// Industry tab content
function IndustryContent({ data }: { data: Record<string, unknown> }) {
  const snap = get<Record<string, unknown>>(data, 'categorySnapshot');
  const painPoints = get<Record<string, unknown>>(data, 'painPoints');
  const trends = arr(get(data, 'marketTrends')).map(str).filter(Boolean);
  const messaging = get<Record<string, unknown>>(data, 'messagingOpportunities');
  const angles = arr(get(messaging, 'angles')).map(str).filter(Boolean);
  const primaryPains = arr(get(painPoints, 'primary')).map(str).filter(Boolean);
  const triggers = arr(get(painPoints, 'triggers')).map(str).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {snap && (
        <div>
          <SectionLabel>Market Snapshot</SectionLabel>
          <DataRow label="Category" value={get<string>(snap, 'category')} />
          <DataRow label="Maturity" value={get<string>(snap, 'marketMaturity')} />
          <DataRow label="Awareness level" value={get<string>(snap, 'awarenessLevel')} />
          <DataRow label="Sales cycle" value={get<string>(snap, 'averageSalesCycle')} />
          <DataRow label="Buying behavior" value={get<string>(snap, 'buyingBehavior')} />
        </div>
      )}
      {primaryPains.length > 0 && (
        <div>
          <SectionLabel>Primary Pain Points</SectionLabel>
          <BulletList items={primaryPains} color="var(--status-error)" />
        </div>
      )}
      {triggers.length > 0 && (
        <div>
          <SectionLabel>Purchase Triggers</SectionLabel>
          <BulletList items={triggers} color="#f59e0b" />
        </div>
      )}
      {trends.length > 0 && (
        <div>
          <SectionLabel>Market Trends</SectionLabel>
          <BulletList items={trends} color="var(--accent-blue)" />
        </div>
      )}
      {angles.length > 0 && (
        <div>
          <SectionLabel>Messaging Angles</SectionLabel>
          <BulletList items={angles} color="var(--accent-purple, #a855f7)" />
        </div>
      )}
    </div>
  );
}

// Competitors tab content
function CompetitorsContent({ data }: { data: Record<string, unknown> }) {
  const competitors = arr(data.competitors);
  const gaps = arr(data.whiteSpaceGaps);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {competitors.map((comp, i) => {
        const c = comp as Record<string, unknown>;
        const name = get<string>(c, 'name') ?? `Competitor ${i + 1}`;
        const positioning = get<string>(c, 'positioning') ?? '';
        const offer = get<string>(c, 'offer') ?? '';
        const price = get<string>(c, 'price') ?? '';
        const strengths = arr(get(c, 'strengths')).map(str).filter(Boolean);
        const weaknesses = arr(get(c, 'weaknesses')).map(str).filter(Boolean);
        const platforms = arr(get(c, 'adPlatforms')).map(str).filter(Boolean);
        const threat = get<Record<string, unknown>>(c, 'threatAssessment');
        const hooks = arr(get(threat, 'topAdHooks')).map(str).filter(Boolean);
        const counter = get<string>(threat, 'counterPositioning') ?? '';

        return (
          <div key={i} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-hover)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{name}</p>
            {positioning && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, lineHeight: 1.4 }}>{positioning}</p>}
            <DataRow label="Offer" value={offer} />
            <DataRow label="Price" value={price} />
            {platforms.length > 0 && <DataRow label="Ad platforms" value={platforms.join(', ')} />}
            {strengths.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <SectionLabel>Strengths</SectionLabel>
                <BulletList items={strengths} color="var(--accent-green, #22c55e)" />
              </div>
            )}
            {weaknesses.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <SectionLabel>Weaknesses</SectionLabel>
                <BulletList items={weaknesses} color="#f59e0b" />
              </div>
            )}
            {hooks.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <SectionLabel>Top Ad Hooks</SectionLabel>
                <BulletList items={hooks} color="var(--accent-purple, #a855f7)" />
              </div>
            )}
            {counter && (
              <div style={{ marginTop: 10 }}>
                <SectionLabel>Counter-positioning</SectionLabel>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{counter}</p>
              </div>
            )}
          </div>
        );
      })}
      {gaps.length > 0 && (
        <div>
          <SectionLabel>White-Space Gaps ({gaps.length})</SectionLabel>
          {gaps.map((gap, i) => {
            const g = gap as Record<string, unknown>;
            return (
              <div key={i} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', marginBottom: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{get<string>(g, 'gap')}</p>
                {get<string>(g, 'evidence') && (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{get<string>(g, 'evidence')}</p>
                )}
                {get<string>(g, 'recommendedAction') && (
                  <p style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 4 }}>&rarr; {get<string>(g, 'recommendedAction')}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ICP tab content
function ICPContent({ data }: { data: Record<string, unknown> }) {
  const verdict = get<Record<string, unknown>>(data, 'finalVerdict');
  const verdictStatus = get<string>(verdict, 'status') ?? '';
  const verdictColor = verdictStatus === 'Validated' ? 'var(--accent-green, #22c55e)' : verdictStatus === 'Invalid' ? 'var(--status-error)' : '#f59e0b';

  const fit = get<Record<string, unknown>>(data, 'painSolutionFit');
  const checklist = get<Record<string, unknown>>(data, 'coherenceChecklist');
  const risk = get<Record<string, unknown>>(data, 'riskAssessment');
  const flags = arr(get(risk, 'flags')).map(str).filter(Boolean);
  const targeting = get<Record<string, unknown>>(data, 'targetingFeasibility');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {verdictStatus && (
        <div style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${verdictColor}`, background: `color-mix(in srgb, ${verdictColor} 10%, transparent)` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: verdictColor }}>{verdictStatus}</p>
          {get<string>(verdict, 'summary') && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{get<string>(verdict, 'summary')}</p>
          )}
        </div>
      )}
      {fit && (
        <div>
          <SectionLabel>Pain-Solution Fit</SectionLabel>
          <DataRow label="Primary pain" value={get<string>(fit, 'primaryPain')} />
          <DataRow label="Solution addresses" value={get<string>(fit, 'solutionAddresses')} />
          <DataRow label="Fit score" value={get<number>(fit, 'fitScore')} />
        </div>
      )}
      {checklist && (
        <div>
          <SectionLabel>Coherence Checklist</SectionLabel>
          {Object.entries(checklist).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: v ? 'var(--accent-green, #22c55e)' : 'var(--status-error)' }}>
                {v ? 'Pass' : 'Fail'}
              </span>
            </div>
          ))}
        </div>
      )}
      {targeting && (
        <div>
          <SectionLabel>Targeting Feasibility</SectionLabel>
          <DataRow label="Platform reach" value={get<string>(targeting, 'platformReach')} />
          <DataRow label="Audience size" value={get<string>(targeting, 'estimatedSize')} />
        </div>
      )}
      {flags.length > 0 && (
        <div>
          <SectionLabel>Risk Flags</SectionLabel>
          <BulletList items={flags} color="var(--status-error)" />
        </div>
      )}
    </div>
  );
}

// Offer tab content
function OfferContent({ data }: { data: Record<string, unknown> }) {
  const recommendation = get<string>(data, 'recommendationStatus') ?? get<string>(data, 'recommendation') ?? '';
  const recColor = recommendation?.includes('Proceed') ? 'var(--accent-green, #22c55e)' : recommendation?.includes('Rebuild') ? 'var(--status-error)' : '#f59e0b';
  const strength = get<Record<string, unknown>>(data, 'offerStrength');
  const overallScore = get<number>(strength, 'overallScore') ?? get<number>(data, 'overallScore');
  const redFlags = arr(data.redFlags).map(str).filter(Boolean);
  const recommendations = arr(data.recommendations).map(str).filter(Boolean);
  const clarity = get<Record<string, unknown>>(data, 'offerClarity');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {recommendation && (
        <div style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${recColor}`, background: `color-mix(in srgb, ${recColor} 10%, transparent)` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: recColor }}>{recommendation}</p>
        </div>
      )}
      {overallScore !== undefined && (
        <div>
          <SectionLabel>Overall Offer Score</SectionLabel>
          <ScoreBar score={overallScore} />
        </div>
      )}
      {strength && (
        <div>
          <SectionLabel>Strength Breakdown</SectionLabel>
          {Object.entries(strength).filter(([k]) => k !== 'overallScore').map(([k, v]) => (
            typeof v === 'number' ? (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k}</span>
                </div>
                <ScoreBar score={v} />
              </div>
            ) : null
          ))}
        </div>
      )}
      {clarity && (
        <div>
          <SectionLabel>Offer Clarity</SectionLabel>
          <DataRow label="Clarity score" value={get<number>(clarity, 'score')} />
          <DataRow label="Issues" value={get<string>(clarity, 'issues')} />
        </div>
      )}
      {redFlags.length > 0 && (
        <div>
          <SectionLabel>Red Flags</SectionLabel>
          <BulletList items={redFlags} color="var(--status-error)" />
        </div>
      )}
      {recommendations.length > 0 && (
        <div>
          <SectionLabel>Recommendations</SectionLabel>
          <BulletList items={recommendations} color="var(--accent-blue)" />
        </div>
      )}
    </div>
  );
}

// Synthesis tab content
function SynthesisContent({ data }: { data: Record<string, unknown> }) {
  const positioning = get<string>(data, 'positioningStatement') ?? '';
  const hooks = arr(data.adHooks).map(str).filter(Boolean);
  const platforms = arr(data.recommendedPlatforms).map(str).filter(Boolean);
  const insights = arr(data.keyInsights).map(str).filter(Boolean);
  const critical = arr(data.criticalSuccessFactors).map(str).filter(Boolean);
  const quickWins = arr(data.quickWins).map(str).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {positioning && (
        <div>
          <SectionLabel>Positioning Statement</SectionLabel>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', padding: '10px 12px', borderLeft: '3px solid var(--accent-blue)', background: 'var(--bg-hover)', borderRadius: '0 6px 6px 0' }}>
            &ldquo;{positioning}&rdquo;
          </p>
        </div>
      )}
      {insights.length > 0 && (
        <div>
          <SectionLabel>Key Insights</SectionLabel>
          <BulletList items={insights} color="var(--accent-blue)" />
        </div>
      )}
      {hooks.length > 0 && (
        <div>
          <SectionLabel>Ad Hooks</SectionLabel>
          {hooks.map((hook, i) => (
            <div key={i} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', marginBottom: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
              &ldquo;{hook}&rdquo;
            </div>
          ))}
        </div>
      )}
      {platforms.length > 0 && (
        <div>
          <SectionLabel>Recommended Platforms</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {platforms.map((p, i) => (
              <span key={i} style={{ padding: '4px 10px', borderRadius: 12, background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)', color: 'var(--accent-blue)', fontSize: 11, fontWeight: 500 }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
      {critical.length > 0 && (
        <div>
          <SectionLabel>Critical Success Factors</SectionLabel>
          <BulletList items={critical} color="#f59e0b" />
        </div>
      )}
      {quickWins.length > 0 && (
        <div>
          <SectionLabel>Quick Wins</SectionLabel>
          <BulletList items={quickWins} color="var(--accent-green, #22c55e)" />
        </div>
      )}
    </div>
  );
}

// ── Empty/running state ────────────────────────────────────────────────────

function SectionEmpty({ tab, status }: { tab: SectionTab; status: ResearchSection['status'] }) {
  const Icon = tab.icon;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 16px', textAlign: 'center' }}>
      {status === 'running' ? (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
          <Icon style={{ width: 24, height: 24, color: tab.color, opacity: 0.5 }} />
        </motion.div>
      ) : (
        <Icon style={{ width: 24, height: 24, color: 'var(--text-quaternary)' }} />
      )}
      <p style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>
        {status === 'running' ? 'Analyzing...' : 'Waiting for data'}
      </p>
    </div>
  );
}

// ── Main canvas ────────────────────────────────────────────────────────────

export function ResearchCanvas({ sections, activeSection, onTabChange }: ResearchCanvasProps) {
  const availableTabs = TABS.filter(
    (t) => sections[t.key].status === 'complete' || sections[t.key].status === 'error' || sections[t.key].status === 'running'
  );

  // Auto-select first available tab if none selected or selected tab not available
  const [internalActive, setInternalActive] = useState<ResearchSectionKey | null>(null);

  useEffect(() => {
    if (activeSection && sections[activeSection].status === 'complete') {
      setInternalActive(activeSection);
      return;
    }
    if (!internalActive || sections[internalActive].status === 'pending') {
      const first = availableTabs.find((t) => sections[t.key].status !== 'pending');
      if (first) setInternalActive(first.key);
    }
  }, [activeSection, availableTabs, internalActive, sections]);

  const activeKey = (activeSection && sections[activeSection].status === 'complete') ? activeSection : internalActive;
  const activeTab = TABS.find((t) => t.key === activeKey);
  const activeSection_ = activeKey ? sections[activeKey] : null;

  const handleTabSelect = (key: ResearchSectionKey) => {
    setInternalActive(key);
    onTabChange?.(key);
  };

  if (availableTabs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>Research will appear here as it completes</p>
      </div>
    );
  }

  // cn is imported for convention/future use
  void cn;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TabBar tabs={TABS} activeKey={activeKey} sections={sections} onSelect={handleTabSelect} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        <AnimatePresence mode="wait">
          {activeSection_ && activeTab && (
            <motion.div
              key={activeKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {activeSection_.status === 'complete' && activeSection_.data ? (
                <>
                  {activeKey === 'industryMarket' && <IndustryContent data={activeSection_.data} />}
                  {activeKey === 'competitors'    && <CompetitorsContent data={activeSection_.data} />}
                  {activeKey === 'icpValidation'  && <ICPContent data={activeSection_.data} />}
                  {activeKey === 'offerAnalysis'  && <OfferContent data={activeSection_.data} />}
                  {activeKey === 'crossAnalysis'  && <SynthesisContent data={activeSection_.data} />}
                </>
              ) : (
                <SectionEmpty tab={activeTab} status={activeSection_.status} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
