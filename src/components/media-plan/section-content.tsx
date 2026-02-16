"use client";

import * as React from "react";
import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESEARCH_SUBTLE_BLOCK_CLASS, STATUS_BADGE_COLORS } from "@/components/strategic-research/ui-tokens";
import { EditableText } from "@/components/strategic-research/editable/editable-text";
import { EditableList } from "@/components/strategic-research/editable/editable-list";
import type { MediaPlanSectionKey } from "@/lib/media-plan/section-constants";
import type {
  MediaPlanOutput,
  MediaPlanExecutiveSummary,
  PlatformStrategy,
  ICPTargeting,
  CampaignStructure,
  CreativeStrategy,
  BudgetAllocation,
  CampaignPhase,
  KPITarget,
  PerformanceModel,
  RiskMonitoring,
} from "@/lib/media-plan/types";

// =============================================================================
// Shared helpers
// =============================================================================

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-3">
      <h3
        className="border-l-4 pl-3 text-sm font-semibold uppercase tracking-wide"
        style={{
          color: "var(--text-tertiary)",
          borderColor: "var(--accent-blue)",
          fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
      <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p
        className={cn("text-base font-medium", mono && "font-mono")}
        style={{
          color: "var(--text-heading)",
          ...(mono ? { fontFamily: "var(--font-mono), monospace" } : {}),
        }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function StatusBadge({ label, variant }: { label: string; variant: keyof typeof STATUS_BADGE_COLORS }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_BADGE_COLORS[variant],
      )}
    >
      {label}
    </span>
  );
}

const FUNNEL_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  cold: "info",
  warm: "warning",
  hot: "danger",
};

function FunnelBadge({ stage }: { stage: string }) {
  const variant = FUNNEL_COLORS[stage] ?? "neutral";
  return <StatusBadge label={stage} variant={variant} />;
}

const PRIORITY_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  primary: "info",
  secondary: "neutral",
  testing: "warning",
};

function PriorityBadge({ priority }: { priority: string }) {
  const variant = PRIORITY_COLORS[priority] ?? "neutral";
  return <StatusBadge label={priority} variant={variant} />;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent-blue)" }} />
      <span style={{ color: "var(--text-secondary)" }}>{children}</span>
    </li>
  );
}

function fmt$(n: number): string {
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${n}%`;
}

// =============================================================================
// Shared editing prop types
// =============================================================================

interface EditingProps {
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}

// =============================================================================
// S1: Executive Summary
// =============================================================================

function ExecutiveSummaryContent({
  data,
  isEditing,
  onFieldChange,
}: { data: MediaPlanExecutiveSummary } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Hero budget */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            Recommended Monthly Budget
          </p>
          {isEditing ? (
            <EditableText
              value={String(data.recommendedMonthlyBudget)}
              onSave={(v) => onFieldChange?.("recommendedMonthlyBudget", Number(v) || 0)}
              className="text-3xl font-bold"
            />
          ) : (
            <p
              className="text-3xl font-bold"
              style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono), monospace" }}
            >
              {fmt$(data.recommendedMonthlyBudget)}
            </p>
          )}
        </div>
        {isEditing ? (
          <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
            <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
              Timeline to Results
            </p>
            <EditableText
              value={data.timelineToResults}
              onSave={(v) => onFieldChange?.("timelineToResults", v)}
            />
          </div>
        ) : (
          <InfoCard label="Timeline to Results" value={data.timelineToResults} />
        )}
      </div>

      {/* Objective */}
      {isEditing ? (
        <EditableText
          value={data.primaryObjective}
          onSave={(v) => onFieldChange?.("primaryObjective", v)}
          className="text-base font-medium"
        />
      ) : (
        <p
          className="text-base font-medium"
          style={{
            color: "var(--text-heading)",
            fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
          }}
        >
          {data.primaryObjective}
        </p>
      )}

      {/* Overview */}
      {isEditing ? (
        <EditableText
          value={data.overview}
          onSave={(v) => onFieldChange?.("overview", v)}
          multiline
          className="text-sm leading-relaxed"
        />
      ) : (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {data.overview}
        </p>
      )}

      {/* Top Priorities */}
      <SubSection title="Top Priorities">
        {isEditing ? (
          <EditableList
            items={data.topPriorities}
            onSave={(items) => onFieldChange?.("topPriorities", items)}
            renderPrefix={(i) => (
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                style={{ background: "rgba(54,94,255,0.15)", color: "var(--accent-blue)" }}
              >
                {i + 1}
              </span>
            )}
          />
        ) : (
          <ol className="list-inside space-y-2">
            {data.topPriorities.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                  style={{ background: "rgba(54,94,255,0.15)", color: "var(--accent-blue)" }}
                >
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ol>
        )}
      </SubSection>
    </div>
  );
}

// =============================================================================
// S2: Platform Strategy
// =============================================================================

function PlatformStrategyContent({
  data,
  isEditing,
  onFieldChange,
}: { data: PlatformStrategy[] } & EditingProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {data.map((ps, idx) => (
        <div key={ps.platform} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-5 space-y-3")}>
          {/* Name + priority */}
          <div className="flex items-center justify-between">
            <span
              className="text-base font-semibold"
              style={{ color: "var(--text-heading)" }}
            >
              {ps.platform}
            </span>
            <PriorityBadge priority={ps.priority} />
          </div>

          {/* Spend */}
          <div className="flex items-baseline gap-2">
            {isEditing ? (
              <EditableText
                value={String(ps.monthlySpend)}
                onSave={(v) => onFieldChange?.(`${idx}.monthlySpend`, Number(v) || 0)}
                className="text-lg font-bold font-mono"
              />
            ) : (
              <span className="text-lg font-bold font-mono" style={{ color: "var(--text-heading)", fontFamily: "var(--font-mono), monospace" }}>
                {fmt$(ps.monthlySpend)}/mo
              </span>
            )}
            {isEditing ? (
              <EditableText
                value={String(ps.budgetPercentage)}
                onSave={(v) => onFieldChange?.(`${idx}.budgetPercentage`, Number(v) || 0)}
                className="text-xs"
              />
            ) : (
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                ({fmtPct(ps.budgetPercentage)})
              </span>
            )}
          </div>

          {/* CPL */}
          {isEditing ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>CPL:</span>
              <EditableText
                value={String(ps.expectedCplRange.min)}
                onSave={(v) => onFieldChange?.(`${idx}.expectedCplRange.min`, Number(v) || 0)}
              />
              <span>&ndash;</span>
              <EditableText
                value={String(ps.expectedCplRange.max)}
                onSave={(v) => onFieldChange?.(`${idx}.expectedCplRange.max`, Number(v) || 0)}
              />
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              CPL: {fmt$(ps.expectedCplRange.min)} &ndash; {fmt$(ps.expectedCplRange.max)}
            </p>
          )}

          {/* Campaign types */}
          {isEditing ? (
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>Campaign Types</p>
              <EditableList
                items={ps.campaignTypes}
                onSave={(items) => onFieldChange?.(`${idx}.campaignTypes`, items)}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {ps.campaignTypes.map((ct) => (
                <Chip key={ct}>{ct}</Chip>
              ))}
            </div>
          )}

          {/* Ad formats + placements */}
          {ps.adFormats.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                Formats
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ps.adFormats.map((f) => (
                  <Chip key={f}>{f}</Chip>
                ))}
              </div>
            </div>
          )}

          {ps.placements.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                Placements
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ps.placements.map((pl) => (
                  <Chip key={pl}>{pl}</Chip>
                ))}
              </div>
            </div>
          )}

          {/* Synergies */}
          {ps.synergiesWithOtherPlatforms && (
            <p className="text-xs italic" style={{ color: "var(--text-tertiary)" }}>
              {ps.synergiesWithOtherPlatforms}
            </p>
          )}

          {/* Rationale */}
          {isEditing ? (
            <EditableText
              value={ps.rationale}
              onSave={(v) => onFieldChange?.(`${idx}.rationale`, v)}
              multiline
              className="text-sm leading-relaxed"
            />
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {ps.rationale}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// S3: ICP Targeting
// =============================================================================

function ICPTargetingContent({
  data,
  isEditing,
  onFieldChange,
}: { data: ICPTargeting } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Audience Segments */}
      <SubSection title="Audience Segments">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.segments.map((seg) => (
            <div key={seg.name} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
                  {seg.name}
                </span>
                <FunnelBadge stage={seg.funnelPosition} />
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {seg.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {seg.targetingParameters.map((tp) => (
                  <Chip key={tp}>{tp}</Chip>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Est. Reach: {seg.estimatedReach}
              </p>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Platform Targeting */}
      <SubSection title="Platform Targeting">
        <div className="space-y-4">
          {data.platformTargeting.map((pt) => (
            <div key={pt.platform} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
                {pt.platform}
              </span>
              {renderChipGroup("Interests", pt.interests)}
              {renderChipGroup("Job Titles", pt.jobTitles)}
              {renderChipGroup("Custom Audiences", pt.customAudiences)}
              {renderChipGroup("Lookalike Audiences", pt.lookalikeAudiences)}
              {renderChipGroup("Exclusions", pt.exclusions)}
            </div>
          ))}
        </div>
      </SubSection>

      {/* Profile */}
      <SubSection title="Profile">
        <div className="space-y-3">
          {data.demographics && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                Demographics
              </p>
              {isEditing ? (
                <EditableText
                  value={data.demographics}
                  onSave={(v) => onFieldChange?.("demographics", v)}
                  multiline
                  className="text-sm"
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{data.demographics}</p>
              )}
            </div>
          )}
          {data.psychographics && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                Psychographics
              </p>
              {isEditing ? (
                <EditableText
                  value={data.psychographics}
                  onSave={(v) => onFieldChange?.("psychographics", v)}
                  multiline
                  className="text-sm"
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{data.psychographics}</p>
              )}
            </div>
          )}
          {data.geographicTargeting && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                Geographic Targeting
              </p>
              {isEditing ? (
                <EditableText
                  value={data.geographicTargeting}
                  onSave={(v) => onFieldChange?.("geographicTargeting", v)}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{data.geographicTargeting}</p>
              )}
            </div>
          )}
        </div>
      </SubSection>

      {/* Reachability banner */}
      {data.reachabilityAssessment && (
        <div
          className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "flex items-start gap-3 p-4")}
          style={{ borderColor: "rgba(54,94,255,0.3)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent-blue)" }} />
          {isEditing ? (
            <EditableText
              value={data.reachabilityAssessment}
              onSave={(v) => onFieldChange?.("reachabilityAssessment", v)}
              multiline
              className="text-sm flex-1"
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {data.reachabilityAssessment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function renderChipGroup(label: string, items: string[]) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Chip key={item}>{item}</Chip>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// S4: Campaign Structure
// =============================================================================

function CampaignStructureContent({
  data,
  isEditing,
  onFieldChange,
}: { data: CampaignStructure } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Campaigns */}
      <SubSection title="Campaigns">
        <div className="space-y-4">
          {data.campaigns.map((c, cIdx) => (
            <div key={c.name} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-3")}>
              <div className="flex flex-wrap items-center gap-2">
                {isEditing ? (
                  <EditableText
                    value={c.name}
                    onSave={(v) => onFieldChange?.(`campaigns.${cIdx}.name`, v)}
                    className="text-sm font-semibold"
                  />
                ) : (
                  <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
                    {c.name}
                  </span>
                )}
                <FunnelBadge stage={c.funnelStage} />
                <Chip>{c.platform}</Chip>
              </div>
              <div className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                <span>Objective: <strong style={{ color: "var(--text-secondary)" }}>{c.objective}</strong></span>
                <span>Daily Budget: {isEditing ? (
                  <EditableText
                    value={String(c.dailyBudget)}
                    onSave={(v) => onFieldChange?.(`campaigns.${cIdx}.dailyBudget`, Number(v) || 0)}
                  />
                ) : (
                  <strong className="font-mono" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono), monospace" }}>{fmt$(c.dailyBudget)}</strong>
                )}</span>
              </div>

              {/* Ad sets */}
              {c.adSets.length > 0 && (
                <div className="space-y-2 pl-4 border-l-2 border-[var(--border-subtle)]">
                  {c.adSets.map((as, asIdx) => (
                    <div key={as.name} className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span className="font-medium" style={{ color: "var(--text-heading)" }}>{as.name}</span>
                      <span>{as.targeting}</span>
                      <Chip>{as.adsToTest} ads</Chip>
                      {isEditing ? (
                        <EditableText
                          value={as.bidStrategy}
                          onSave={(v) => onFieldChange?.(`campaigns.${cIdx}.adSets.${asIdx}.bidStrategy`, v)}
                        />
                      ) : (
                        <Chip>{as.bidStrategy}</Chip>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SubSection>

      {/* Naming Conventions */}
      <SubSection title="Naming Conventions">
        <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "space-y-2 p-4")}>
          <NamingRow label="Campaign" pattern={data.namingConvention.campaignPattern} />
          <NamingRow label="Ad Set" pattern={data.namingConvention.adSetPattern} />
          <NamingRow label="Ad" pattern={data.namingConvention.adPattern} />
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>UTM Structure</p>
            <div className="grid grid-cols-2 gap-1 text-xs font-mono" style={{ fontFamily: "var(--font-mono), monospace", color: "var(--text-secondary)" }}>
              <span>source: {data.namingConvention.utmStructure.source}</span>
              <span>medium: {data.namingConvention.utmStructure.medium}</span>
              <span>campaign: {data.namingConvention.utmStructure.campaign}</span>
              <span>content: {data.namingConvention.utmStructure.content}</span>
            </div>
          </div>
        </div>
      </SubSection>

      {/* Retargeting Segments */}
      {data.retargetingSegments.length > 0 && (
        <SubSection title="Retargeting Segments">
          <div className="space-y-3">
            {data.retargetingSegments.map((rs) => (
              <div key={rs.name} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "flex items-start gap-4 p-4")}>
                <div className="shrink-0">
                  <StatusBadge label={`${rs.lookbackDays}d`} variant="info" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-heading)" }}>{rs.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{rs.source}</p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{rs.messagingApproach}</p>
                </div>
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* Negative Keywords */}
      {data.negativeKeywords.length > 0 && (
        <SubSection title="Negative Keywords">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Keyword</th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Match Type</th>
                  <th className="pb-2 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.negativeKeywords.map((nk) => (
                  <tr key={nk.keyword} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs" style={{ color: "var(--text-heading)", fontFamily: "var(--font-mono), monospace" }}>{nk.keyword}</td>
                    <td className="py-2 pr-4"><Chip>{nk.matchType}</Chip></td>
                    <td className="py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{nk.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>
      )}
    </div>
  );
}

function NamingRow({ label, pattern }: { label: string; pattern: string }) {
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <span className="w-20 shrink-0 font-medium" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <code className="font-mono" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono), monospace" }}>{pattern}</code>
    </div>
  );
}

// =============================================================================
// S5: Creative Strategy
// =============================================================================

function CreativeStrategyContent({
  data,
  isEditing,
  onFieldChange,
}: { data: CreativeStrategy } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Creative Angles */}
      <SubSection title="Creative Angles">
        <div className="space-y-4">
          {data.angles.map((a, aIdx) => (
            <div key={a.name} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
                {a.name}
              </span>
              {isEditing ? (
                <EditableText
                  value={a.description}
                  onSave={(v) => onFieldChange?.(`angles.${aIdx}.description`, v)}
                  multiline
                  className="text-sm"
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{a.description}</p>
              )}
              {/* Hook in quote block */}
              {isEditing ? (
                <div className="border-l-2 pl-3" style={{ borderColor: "var(--accent-blue)" }}>
                  <EditableText
                    value={a.exampleHook}
                    onSave={(v) => onFieldChange?.(`angles.${aIdx}.exampleHook`, v)}
                    className="text-sm italic"
                  />
                </div>
              ) : (
                <blockquote
                  className="border-l-2 pl-3 text-sm italic"
                  style={{ borderColor: "var(--accent-blue)", color: "var(--text-heading)" }}
                >
                  &ldquo;{a.exampleHook}&rdquo;
                </blockquote>
              )}
              <div className="flex flex-wrap gap-1.5">
                {a.bestForFunnelStages.map((s) => (
                  <FunnelBadge key={s} stage={s} />
                ))}
                {a.platforms.map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Format Specs */}
      <SubSection title="Format Specifications">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Format</th>
                <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Dimensions</th>
                <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Platform</th>
                <th className="pb-2 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Copy Guideline</th>
              </tr>
            </thead>
            <tbody>
              {data.formatSpecs.map((fs) => (
                <tr key={`${fs.format}-${fs.platform}`} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-2 pr-4 font-medium" style={{ color: "var(--text-heading)" }}>{fs.format}</td>
                  <td className="py-2 pr-4 font-mono text-xs" style={{ fontFamily: "var(--font-mono), monospace", color: "var(--text-secondary)" }}>{fs.dimensions}</td>
                  <td className="py-2 pr-4"><Chip>{fs.platform}</Chip></td>
                  <td className="py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{fs.copyGuideline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SubSection>

      {/* Testing Plan */}
      <SubSection title="Testing Plan">
        <div className="space-y-3">
          {data.testingPlan.map((tp) => (
            <div key={tp.phase} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>{tp.phase}</span>
                <Chip>{tp.variantsToTest} variants</Chip>
                <Chip>{tp.durationDays}d</Chip>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono), monospace" }}>
                  {fmt$(tp.testingBudget)}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tp.methodology}</p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Success: {tp.successCriteria}
              </p>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Refresh Cadence */}
      <SubSection title="Refresh Cadence">
        <div className="space-y-2">
          {data.refreshCadence.map((rc) => (
            <div key={rc.platform} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "flex items-start gap-4 p-4")}>
              <div className="shrink-0">
                <Chip>{rc.platform}</Chip>
              </div>
              <div className="space-y-1">
                <p className="text-sm" style={{ color: "var(--text-heading)" }}>
                  Every {rc.refreshIntervalDays} days
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rc.fatigueSignals.map((fs) => (
                    <span key={fs} className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {fs}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Brand Guidelines */}
      {data.brandGuidelines.length > 0 && (
        <SubSection title="Brand Guidelines">
          <div className="space-y-2">
            {data.brandGuidelines.map((bg, bgIdx) => (
              <div key={bgIdx} className="flex items-start gap-3 text-sm">
                <Chip>{bg.category}</Chip>
                {isEditing ? (
                  <EditableText
                    value={bg.guideline}
                    onSave={(v) => onFieldChange?.(`brandGuidelines.${bgIdx}.guideline`, v)}
                    className="flex-1"
                  />
                ) : (
                  <span style={{ color: "var(--text-secondary)" }}>{bg.guideline}</span>
                )}
              </div>
            ))}
          </div>
        </SubSection>
      )}
    </div>
  );
}

// =============================================================================
// S6: Budget Allocation
// =============================================================================

function BudgetAllocationContent({
  data,
  isEditing,
  onFieldChange,
}: { data: BudgetAllocation } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Header budgets */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            Total Monthly Budget
          </p>
          <p
            className="text-3xl font-bold"
            style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono), monospace" }}
          >
            {fmt$(data.totalMonthlyBudget)}
          </p>
        </div>
        <InfoCard label="Daily Ceiling" value={fmt$(data.dailyCeiling)} mono />
      </div>

      {/* Platform Breakdown */}
      <SubSection title="Platform Breakdown">
        <div className="space-y-2">
          {data.platformBreakdown.map((pb, pbIdx) => {
            const pct = Math.min(pb.percentage, 100);
            return (
              <div key={pb.platform} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--text-heading)" }}>{pb.platform}</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <EditableText
                        value={String(pb.percentage)}
                        onSave={(v) => onFieldChange?.(`platformBreakdown.${pbIdx}.percentage`, Number(v) || 0)}
                        className="font-mono text-xs"
                      />
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>%</span>
                    </div>
                  ) : (
                    <span className="font-mono text-xs" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono), monospace" }}>
                      {fmt$(pb.monthlyBudget)} ({fmtPct(pb.percentage)})
                    </span>
                  )}
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: "var(--gradient-primary)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SubSection>

      {/* Funnel Split */}
      <SubSection title="Funnel Split">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {data.funnelSplit.map((fs, fsIdx) => {
            const borderColor =
              fs.stage === "cold"
                ? "rgba(54,94,255,0.4)"
                : fs.stage === "warm"
                  ? "rgba(245,158,11,0.4)"
                  : "rgba(239,68,68,0.4)";
            return (
              <div
                key={fs.stage}
                className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}
                style={{ borderColor }}
              >
                <div className="flex items-center justify-between">
                  <FunnelBadge stage={fs.stage} />
                  {isEditing ? (
                    <EditableText
                      value={String(fs.percentage)}
                      onSave={(v) => onFieldChange?.(`funnelSplit.${fsIdx}.percentage`, Number(v) || 0)}
                      className="text-xl font-bold font-mono"
                    />
                  ) : (
                    <span
                      className="text-xl font-bold font-mono"
                      style={{ color: "var(--text-heading)", fontFamily: "var(--font-mono), monospace" }}
                    >
                      {fmtPct(fs.percentage)}
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {fs.rationale}
                </p>
              </div>
            );
          })}
        </div>
      </SubSection>

      {/* Monthly Roadmap */}
      <SubSection title="Monthly Roadmap">
        <div className="space-y-3">
          {data.monthlyRoadmap.map((mr) => (
            <div key={mr.month} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium"
                  style={{ background: "rgba(54,94,255,0.15)", color: "var(--accent-blue)" }}
                >
                  M{mr.month}
                </span>
                <span className="text-sm font-mono font-medium" style={{ color: "var(--text-heading)", fontFamily: "var(--font-mono), monospace" }}>
                  {fmt$(mr.budget)}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{mr.focus}</span>
              </div>
              {mr.scalingTriggers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mr.scalingTriggers.map((st) => (
                    <Chip key={st}>{st}</Chip>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SubSection>

      {/* Ramp-up Strategy */}
      {data.rampUpStrategy && (
        <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
          <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
            Ramp-Up Strategy
          </p>
          {isEditing ? (
            <EditableText
              value={data.rampUpStrategy}
              onSave={(v) => onFieldChange?.("rampUpStrategy", v)}
              multiline
              className="text-sm"
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{data.rampUpStrategy}</p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// S7: Campaign Phases
// =============================================================================

function CampaignPhasesContent({
  data,
  isEditing,
  onFieldChange,
}: { data: CampaignPhase[] } & EditingProps) {
  return (
    <div className="space-y-4">
      {data.map((phase, pIdx) => (
        <div key={phase.phase} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-5 space-y-3")}>
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
              style={{ background: "rgba(54,94,255,0.15)", color: "var(--accent-blue)" }}
            >
              {phase.phase}
            </span>
            <span className="text-base font-semibold" style={{ color: "var(--text-heading)" }}>
              {phase.name}
            </span>
            <StatusBadge label={`${phase.durationWeeks} weeks`} variant="info" />
            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono), monospace" }}>
              {fmt$(phase.estimatedBudget)}
            </span>
          </div>

          {/* Objective */}
          {isEditing ? (
            <EditableText
              value={phase.objective}
              onSave={(v) => onFieldChange?.(`${pIdx}.objective`, v)}
              multiline
              className="text-sm"
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{phase.objective}</p>
          )}

          {/* Activities */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
              Activities
            </p>
            {isEditing ? (
              <EditableList
                items={phase.activities}
                onSave={(items) => onFieldChange?.(`${pIdx}.activities`, items)}
              />
            ) : (
              <ul className="space-y-1">
                {phase.activities.map((a, i) => (
                  <ListItem key={i}>{a}</ListItem>
                ))}
              </ul>
            )}
          </div>

          {/* Success Criteria */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
              Success Criteria
            </p>
            {isEditing ? (
              <EditableList
                items={phase.successCriteria}
                onSave={(items) => onFieldChange?.(`${pIdx}.successCriteria`, items)}
              />
            ) : (
              <ul className="space-y-1">
                {phase.successCriteria.map((sc, i) => (
                  <ListItem key={i}>{sc}</ListItem>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// S8: KPI Targets
// =============================================================================

function KPITargetsContent({
  data,
  isEditing,
  onFieldChange,
}: { data: KPITarget[] } & EditingProps) {
  const primary = data.filter((k) => k.type === "primary");
  const secondary = data.filter((k) => k.type === "secondary");

  // We need to map back to original indices for editing
  const primaryIndices = data.reduce<number[]>((acc, k, i) => {
    if (k.type === "primary") acc.push(i);
    return acc;
  }, []);
  const secondaryIndices = data.reduce<number[]>((acc, k, i) => {
    if (k.type === "secondary") acc.push(i);
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {primary.length > 0 && (
        <SubSection title="Primary KPIs">
          <KPITable kpis={primary} indices={primaryIndices} isEditing={isEditing} onFieldChange={onFieldChange} />
        </SubSection>
      )}
      {secondary.length > 0 && (
        <SubSection title="Secondary KPIs">
          <KPITable kpis={secondary} indices={secondaryIndices} isEditing={isEditing} onFieldChange={onFieldChange} />
        </SubSection>
      )}
    </div>
  );
}

function KPITable({
  kpis,
  indices,
  isEditing,
  onFieldChange,
}: {
  kpis: KPITarget[];
  indices: number[];
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Metric</th>
            <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Target</th>
            <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Timeframe</th>
            <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Benchmark</th>
            <th className="pb-2 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Measurement</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((k, localIdx) => {
            const globalIdx = indices[localIdx];
            return (
              <tr key={k.metric} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="py-2 pr-4 font-medium" style={{ color: "var(--text-heading)" }}>{k.metric}</td>
                <td className="py-2 pr-4 font-mono text-xs" style={{ fontFamily: "var(--font-mono), monospace", color: "var(--accent-blue)" }}>
                  {isEditing ? (
                    <EditableText
                      value={k.target}
                      onSave={(v) => onFieldChange?.(`${globalIdx}.target`, v)}
                    />
                  ) : (
                    k.target
                  )}
                </td>
                <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {isEditing ? (
                    <EditableText
                      value={k.timeframe}
                      onSave={(v) => onFieldChange?.(`${globalIdx}.timeframe`, v)}
                    />
                  ) : (
                    k.timeframe
                  )}
                </td>
                <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {isEditing ? (
                    <EditableText
                      value={k.benchmark}
                      onSave={(v) => onFieldChange?.(`${globalIdx}.benchmark`, v)}
                    />
                  ) : (
                    k.benchmark
                  )}
                </td>
                <td className="py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{k.measurementMethod}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// S9: Performance Model
// =============================================================================

function PerformanceModelContent({
  data,
  isEditing,
  onFieldChange,
}: { data: PerformanceModel } & EditingProps) {
  const m = data.cacModel;

  return (
    <div className="space-y-6">
      {/* CAC Funnel Model */}
      <SubSection title="CAC Funnel Model">
        {isEditing ? (
          <>
            {/* Editable grid row 1 */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Target CPL</p>
                <EditableText
                  value={String(m.targetCPL)}
                  onSave={(v) => onFieldChange?.("cacModel.targetCPL", Number(v) || 0)}
                />
              </div>
              <InfoCard label="Expected Leads/mo" value={m.expectedMonthlyLeads} mono />
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Lead &rarr; SQL</p>
                <EditableText
                  value={String(m.leadToSqlRate)}
                  onSave={(v) => onFieldChange?.("cacModel.leadToSqlRate", Number(v) || 0)}
                />
              </div>
              <InfoCard label="Expected SQLs/mo" value={m.expectedMonthlySQLs} mono />
            </div>
            {/* Editable grid row 2 */}
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>SQL &rarr; Customer</p>
                <EditableText
                  value={String(m.sqlToCustomerRate)}
                  onSave={(v) => onFieldChange?.("cacModel.sqlToCustomerRate", Number(v) || 0)}
                />
              </div>
              <InfoCard label="Customers/mo" value={m.expectedMonthlyCustomers} mono />
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Target CAC</p>
                <EditableText
                  value={String(m.targetCAC)}
                  onSave={(v) => onFieldChange?.("cacModel.targetCAC", Number(v) || 0)}
                />
              </div>
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Est. LTV</p>
                <EditableText
                  value={String(m.estimatedLTV)}
                  onSave={(v) => onFieldChange?.("cacModel.estimatedLTV", Number(v) || 0)}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Funnel flow */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <InfoCard label="Target CPL" value={fmt$(m.targetCPL)} mono />
              <InfoCard label="Expected Leads/mo" value={m.expectedMonthlyLeads} mono />
              <InfoCard label="Lead → SQL" value={fmtPct(m.leadToSqlRate)} mono />
              <InfoCard label="Expected SQLs/mo" value={m.expectedMonthlySQLs} mono />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <InfoCard label="SQL → Customer" value={fmtPct(m.sqlToCustomerRate)} mono />
              <InfoCard label="Customers/mo" value={m.expectedMonthlyCustomers} mono />
              <InfoCard label="Target CAC" value={fmt$(m.targetCAC)} mono />
              <InfoCard label="Est. LTV" value={fmt$(m.estimatedLTV)} mono />
            </div>
          </>
        )}

        {/* LTV:CAC highlight */}
        <div
          className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "mt-3 flex items-center justify-between p-4")}
          style={{ borderColor: "rgba(34,197,94,0.3)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-heading)" }}>
            LTV : CAC Ratio
          </span>
          <span
            className="text-xl font-bold font-mono"
            style={{ color: "rgb(34,197,94)", fontFamily: "var(--font-mono), monospace" }}
          >
            {m.ltvToCacRatio}
          </span>
        </div>
      </SubSection>

      {/* Monitoring Schedule */}
      <SubSection title="Monitoring Schedule">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MonitoringColumn title="Daily" items={data.monitoringSchedule.daily} />
          <MonitoringColumn title="Weekly" items={data.monitoringSchedule.weekly} />
          <MonitoringColumn title="Monthly" items={data.monitoringSchedule.monthly} />
        </div>
      </SubSection>
    </div>
  );
}

function MonitoringColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
      <p className="text-xs font-semibold uppercase" style={{ color: "var(--accent-blue)" }}>
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <ListItem key={i}>{item}</ListItem>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// S10: Risk & Monitoring
// =============================================================================

const SEVERITY_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const CATEGORY_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  budget: "warning",
  creative: "info",
  audience: "neutral",
  platform: "caution",
  compliance: "danger",
  market: "neutral",
};

function RiskMonitoringContent({
  data,
  isEditing,
  onFieldChange,
}: { data: RiskMonitoring } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Risks */}
      <SubSection title="Identified Risks">
        <div className="space-y-3">
          {data.risks.map((r, rIdx) => (
            <div key={rIdx} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={r.category} variant={CATEGORY_COLORS[r.category] ?? "neutral"} />
                <StatusBadge label={`Severity: ${r.severity}`} variant={SEVERITY_COLORS[r.severity] ?? "neutral"} />
                <StatusBadge label={`Likelihood: ${r.likelihood}`} variant={SEVERITY_COLORS[r.likelihood] ?? "neutral"} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-heading)" }}>{r.risk}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                    Mitigation
                  </p>
                  {isEditing ? (
                    <EditableText
                      value={r.mitigation}
                      onSave={(v) => onFieldChange?.(`risks.${rIdx}.mitigation`, v)}
                      multiline
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.mitigation}</p>
                  )}
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                    Contingency
                  </p>
                  {isEditing ? (
                    <EditableText
                      value={r.contingency}
                      onSave={(v) => onFieldChange?.(`risks.${rIdx}.contingency`, v)}
                      multiline
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.contingency}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Key Assumptions */}
      {data.assumptions.length > 0 && (
        <SubSection title="Key Assumptions">
          {isEditing ? (
            <EditableList
              items={data.assumptions}
              onSave={(items) => onFieldChange?.("assumptions", items)}
            />
          ) : (
            <ul className="space-y-1">
              {data.assumptions.map((a, i) => (
                <ListItem key={i}>{a}</ListItem>
              ))}
            </ul>
          )}
        </SubSection>
      )}
    </div>
  );
}

// =============================================================================
// Dispatcher
// =============================================================================

interface MediaPlanSectionContentProps {
  sectionKey: MediaPlanSectionKey;
  mediaPlan: MediaPlanOutput;
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}

export function MediaPlanSectionContent({
  sectionKey,
  mediaPlan,
  isEditing,
  onFieldChange,
}: MediaPlanSectionContentProps) {
  switch (sectionKey) {
    case "executiveSummary":
      return <ExecutiveSummaryContent data={mediaPlan.executiveSummary} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "platformStrategy":
      return <PlatformStrategyContent data={mediaPlan.platformStrategy} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "icpTargeting":
      return <ICPTargetingContent data={mediaPlan.icpTargeting} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "campaignStructure":
      return <CampaignStructureContent data={mediaPlan.campaignStructure} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "creativeStrategy":
      return <CreativeStrategyContent data={mediaPlan.creativeStrategy} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "budgetAllocation":
      return <BudgetAllocationContent data={mediaPlan.budgetAllocation} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "campaignPhases":
      return <CampaignPhasesContent data={mediaPlan.campaignPhases} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "kpiTargets":
      return <KPITargetsContent data={mediaPlan.kpiTargets} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "performanceModel":
      return <PerformanceModelContent data={mediaPlan.performanceModel} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "riskMonitoring":
      return <RiskMonitoringContent data={mediaPlan.riskMonitoring} isEditing={isEditing} onFieldChange={onFieldChange} />;
    default:
      return null;
  }
}
