"use client";

import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditableText, EditableList } from "../editable";
import { safeRender, safeArray } from "./shared-helpers";
import {
  SubSection,
  ListItem,
  InsightCard,
  HighlightBlock,
  WarningItem,
  NumberedStep,
  PriorityBadge,
  CardGrid,
  FieldHighlightWrapper,
  type EditableContentProps,
} from "./shared-primitives";
import type { CrossAnalysisSynthesis } from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Section 5: Cross-Analysis Synthesis Content
// =============================================================================

interface CrossAnalysisContentProps extends EditableContentProps {
  data: CrossAnalysisSynthesis;
}

export function CrossAnalysisContent({ data, isEditing, onFieldChange }: CrossAnalysisContentProps) {
  return (
    <div className="space-y-5">
      {/* Key Insights */}
      {((data?.keyInsights || []).length > 0 || isEditing) && (
        <SubSection title="Key Strategic Insights">
          <div className="space-y-2.5">
            {(data?.keyInsights || []).map((insight, i) => (
              <InsightCard
                key={i}
                fieldPath={`keyInsights[${i}]`}
                icon={Lightbulb}
                iconColor="text-primary/70"
                title={safeRender(insight?.insight)}
                accentBorder
              >
                <div className="flex items-start justify-between gap-3 mt-1">
                  <p className="text-sm text-white/55 leading-relaxed flex-1">
                    <span className="font-medium text-white/70">Implication: </span>
                    {safeRender(insight?.implication)}
                  </p>
                  {insight?.priority && (
                    <PriorityBadge priority={insight.priority} className="shrink-0 mt-0.5" />
                  )}
                </div>
              </InsightCard>
            ))}
          </div>
        </SubSection>
      )}

      {/* Recommended Positioning */}
      <SubSection title="Recommended Positioning">
        <FieldHighlightWrapper fieldPath="recommendedPositioning">
          <HighlightBlock>
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.recommendedPositioning)}
                onSave={(v) => onFieldChange("recommendedPositioning", v)}
                multiline
                className="text-lg text-white/85"
              />
            ) : (
              <p className="text-lg text-white/85 leading-relaxed">
                {safeRender(data?.recommendedPositioning)}
              </p>
            )}
          </HighlightBlock>
        </FieldHighlightWrapper>
      </SubSection>

      {/* Ad Hooks with Source Attribution */}
      {data?.messagingFramework?.adHooks && data.messagingFramework.adHooks.length > 0 && (
        <SubSection title="Ad Hooks (from Competitor Ads)">
          <FieldHighlightWrapper fieldPath="messagingFramework.adHooks">
            <p className="text-xs text-white/30 mb-3">
              Hooks extracted or inspired by real competitor ads. Green = verbatim, Blue = inspired, Gray = generated.
            </p>
            <div className="space-y-2.5">
              {data.messagingFramework.adHooks.map((hookItem: any, i: number) => {
                const sourceType = hookItem?.source?.type;
                const borderClass =
                  sourceType === "extracted"
                    ? "border-emerald-500/40"
                    : sourceType === "inspired"
                      ? "border-primary/40"
                      : "border-white/[0.08]";

                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg bg-[var(--bg-surface)] border p-3.5",
                      borderClass
                    )}
                  >
                    <p className="text-[13px] font-medium text-white/85 leading-snug">
                      &quot;{typeof hookItem === "string" ? hookItem : hookItem.hook}&quot;
                    </p>
                    {typeof hookItem !== "string" && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {sourceType && (
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border",
                                sourceType === "extracted"
                                  ? "bg-emerald-500/[0.08] text-emerald-400/80 border-emerald-500/[0.15]"
                                  : sourceType === "inspired"
                                    ? "bg-primary/[0.08] text-primary/80 border-primary/[0.15]"
                                    : "bg-white/[0.04] text-white/40 border-white/[0.08]"
                              )}
                            >
                              {sourceType}
                            </span>
                          )}
                          {hookItem.source?.competitors && hookItem.source.competitors.length > 0 && (
                            <span className="text-xs text-white/30">
                              from: {hookItem.source.competitors.join(", ")}
                            </span>
                          )}
                          {hookItem.source?.platform && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-[var(--bg-surface)] text-white/40 border-border">
                              {hookItem.source.platform}
                            </span>
                          )}
                        </div>
                        {(hookItem.technique || hookItem.targetAwareness) && (
                          <div className="flex gap-2 mt-1.5 text-xs text-white/30">
                            {hookItem.technique && <span>Technique: {hookItem.technique}</span>}
                            {hookItem.technique && hookItem.targetAwareness && <span>·</span>}
                            {hookItem.targetAwareness && <span>Awareness: {hookItem.targetAwareness}</span>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </FieldHighlightWrapper>
        </SubSection>
      )}

      {/* Recommended Platforms */}
      {((data?.recommendedPlatforms || []).length > 0 || isEditing) && (
        <SubSection title="Recommended Platforms">
          <CardGrid cols={3}>
            {(data?.recommendedPlatforms || []).map((plat, i) => {
              const isPrimary = plat?.priority === "primary";
              return (
                <FieldHighlightWrapper key={i} fieldPath={`recommendedPlatforms[${i}]`}>
                  <div
                    className={cn(
                      "rounded-lg border p-3.5",
                      isPrimary
                        ? "bg-primary/[0.04] border-primary/[0.12]"
                        : "bg-[var(--bg-surface)] border-border"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[13px] font-semibold text-white/90">
                        {safeRender(plat?.platform)}
                      </h4>
                      {plat?.priority && (
                        <PriorityBadge priority={plat.priority} />
                      )}
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      {safeRender(plat?.reasoning)}
                    </p>
                  </div>
                </FieldHighlightWrapper>
              );
            })}
          </CardGrid>
        </SubSection>
      )}

      {/* Critical Success Factors */}
      {(safeArray(data?.criticalSuccessFactors).length > 0 || isEditing) && (
        <SubSection title="Critical Success Factors">
          <FieldHighlightWrapper fieldPath="criticalSuccessFactors">
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.criticalSuccessFactors)}
                onSave={(v) => onFieldChange("criticalSuccessFactors", v)}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.criticalSuccessFactors).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </ul>
            )}
          </FieldHighlightWrapper>
        </SubSection>
      )}

      {/* Potential Blockers */}
      {((data?.potentialBlockers && data.potentialBlockers.length > 0) || isEditing) && (
        <SubSection title="Potential Blockers">
          <FieldHighlightWrapper fieldPath="potentialBlockers">
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.potentialBlockers)}
                onSave={(v) => onFieldChange("potentialBlockers", v)}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.potentialBlockers).map((item, i) => (
                  <WarningItem key={i}>{item}</WarningItem>
                ))}
              </ul>
            )}
          </FieldHighlightWrapper>
        </SubSection>
      )}

      {/* Next Steps */}
      {(safeArray(data?.nextSteps).length > 0 || isEditing) && (
        <SubSection title="Recommended Next Steps">
          <FieldHighlightWrapper fieldPath="nextSteps">
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.nextSteps)}
                onSave={(v) => onFieldChange("nextSteps", v)}
              />
            ) : (
              <ol className="space-y-1.5">
                {safeArray(data?.nextSteps).map((item, i) => (
                  <NumberedStep key={i} index={i + 1}>{item}</NumberedStep>
                ))}
              </ol>
            )}
          </FieldHighlightWrapper>
        </SubSection>
      )}
    </div>
  );
}
