"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { EditableList } from "@/components/strategic-research/editable/editable-list";
import type { CampaignStructure } from "@/lib/media-plan/types";
import {
  SubSection,
  FunnelBadge,
  Chip,
  StatusBadge,
  NamingRow,
  EditableText,
  RESEARCH_SUBTLE_BLOCK_CLASS,
  fmt$,
  type EditingProps,
} from "./shared";

export function CampaignStructureContent({
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
