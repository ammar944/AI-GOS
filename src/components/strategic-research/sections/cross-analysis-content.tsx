"use client";

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
                title={safeRender(insight?.insight)}
              >
                <div className="flex items-start justify-between gap-3 mt-1">
                  <div className="flex-1">
                    {isEditing && onFieldChange ? (
                      <div className="space-y-2">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-1 block">
                            Insight
                          </span>
                          <EditableText
                            value={safeRender(insight?.insight)}
                            onSave={(v) => onFieldChange(`keyInsights.${i}.insight`, v)}
                            multiline
                          />
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-1 block">
                            Implication
                          </span>
                          <EditableText
                            value={safeRender(insight?.implication)}
                            onSave={(v) => onFieldChange(`keyInsights.${i}.implication`, v)}
                            multiline
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13px] text-[rgb(205,208,213)] leading-relaxed">
                        <span className="font-medium text-[rgb(252,252,250)]">Implication: </span>
                        {safeRender(insight?.implication)}
                      </p>
                    )}
                  </div>
                  {(insight?.priority || isEditing) && (
                    isEditing && onFieldChange ? (
                      <EditableText
                        value={safeRender(insight?.priority || "medium")}
                        onSave={(v) => onFieldChange(`keyInsights.${i}.priority`, v)}
                        className="text-[12px] font-medium tabular-nums shrink-0 mt-0.5"
                      />
                    ) : (
                      <PriorityBadge priority={insight.priority!} className="shrink-0 mt-0.5" />
                    )
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
                className="text-[15px] text-[rgb(252,252,250)]"
              />
            ) : (
              <p className="text-[15px] text-[rgb(252,252,250)] leading-relaxed">
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
            <p className="text-xs text-[rgb(100,105,115)] mb-3">
              Hooks extracted or inspired by real competitor ads. Green = verbatim, Pink = inspired, Gray = generated.
            </p>
            <div className="space-y-2.5">
              {data.messagingFramework.adHooks.map((hookItem: any, i: number) => {
                const sourceType = hookItem?.source?.type;
                const hookText = typeof hookItem === "string" ? hookItem : hookItem.hook;

                return (
                  <div
                    key={i}
                    className="py-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0"
                  >
                    {isEditing && onFieldChange ? (
                      <EditableText
                        value={safeRender(hookText)}
                        onSave={(v) => onFieldChange(`messagingFramework.adHooks.${i}.hook`, v)}
                      />
                    ) : (
                      <p className="text-[14px] font-medium text-[rgb(252,252,250)] leading-snug">
                        &quot;{hookText}&quot;
                      </p>
                    )}
                    {typeof hookItem !== "string" && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {sourceType && (
                            <span
                              className={cn(
                                "text-[12px] font-medium uppercase tracking-[0.04em]",
                                sourceType === "extracted"
                                  ? "text-[#22c55e]"
                                  : sourceType === "inspired"
                                    ? "text-[#f472b6]"
                                    : "text-[rgb(100,105,115)]"
                              )}
                            >
                              {sourceType}
                            </span>
                          )}
                          {hookItem.source?.competitors && hookItem.source.competitors.length > 0 && (
                            <span className="text-[12px] text-[rgb(100,105,115)]">
                              from: {hookItem.source.competitors.join(", ")}
                            </span>
                          )}
                          {hookItem.source?.platform && (
                            <span className="text-[12px] text-[rgb(100,105,115)]">
                              {hookItem.source.platform}
                            </span>
                          )}
                        </div>
                        {(hookItem.technique || hookItem.targetAwareness || isEditing) && (
                          <div className="flex gap-2 mt-1.5 text-[12px] text-[rgb(100,105,115)]">
                            {(hookItem.technique || isEditing) && (
                              <span>
                                Technique:{" "}
                                {isEditing && onFieldChange ? (
                                  <EditableText
                                    value={hookItem.technique || ""}
                                    onSave={(v) => onFieldChange(`messagingFramework.adHooks.${i}.technique`, v)}
                                    placeholder="Add technique..."
                                  />
                                ) : (
                                  hookItem.technique
                                )}
                              </span>
                            )}
                            {hookItem.technique && hookItem.targetAwareness && !isEditing && <span>·</span>}
                            {(hookItem.targetAwareness || isEditing) && (
                              <span>
                                Awareness:{" "}
                                {isEditing && onFieldChange ? (
                                  <EditableText
                                    value={hookItem.targetAwareness || ""}
                                    onSave={(v) => onFieldChange(`messagingFramework.adHooks.${i}.targetAwareness`, v)}
                                    placeholder="Add awareness level..."
                                  />
                                ) : (
                                  hookItem.targetAwareness
                                )}
                              </span>
                            )}
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
            {(data?.recommendedPlatforms || []).map((plat, i) => (
              <FieldHighlightWrapper key={i} fieldPath={`recommendedPlatforms[${i}]`}>
                <div className="py-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0">
                  <div className="flex items-center justify-between mb-1.5">
                    {isEditing && onFieldChange ? (
                      <EditableText
                        value={safeRender(plat?.platform)}
                        onSave={(v) => onFieldChange(`recommendedPlatforms.${i}.platform`, v)}
                        className="text-[14px] font-medium text-[rgb(252,252,250)]"
                      />
                    ) : (
                      <h4 className="text-[14px] font-medium text-[rgb(252,252,250)]">
                        {safeRender(plat?.platform)}
                      </h4>
                    )}
                    {(plat?.priority || isEditing) && (
                      isEditing && onFieldChange ? (
                        <EditableText
                          value={safeRender(plat?.priority || "secondary")}
                          onSave={(v) => onFieldChange(`recommendedPlatforms.${i}.priority`, v)}
                          className="text-[12px] font-medium tabular-nums"
                        />
                      ) : (
                        <PriorityBadge priority={plat.priority!} />
                      )
                    )}
                  </div>
                  {isEditing && onFieldChange ? (
                    <EditableText
                      value={safeRender(plat?.reasoning)}
                      onSave={(v) => onFieldChange(`recommendedPlatforms.${i}.reasoning`, v)}
                      multiline
                    />
                  ) : (
                    <p className="text-[13px] text-[rgb(205,208,213)] leading-relaxed">
                      {safeRender(plat?.reasoning)}
                    </p>
                  )}
                </div>
              </FieldHighlightWrapper>
            ))}
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
