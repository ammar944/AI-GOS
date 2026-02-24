"use client";

import {
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EditableText, EditableList } from "../editable";
import { SourcedText, SourcedListItem } from "../citations";
import { STATUS_BADGE_COLORS } from "../ui-tokens";
import { safeRender, safeArray, hasItems } from "./shared-helpers";
import {
  SubSection,
  ListItem,
  DataCard,
  StatusBanner,
  BoolCheck,
  WarningItem,
  CardGrid,
  FieldHighlightWrapper,
  VALIDATION_STATUS_COLORS,
  RISK_COLORS,
  type EditableContentProps,
} from "./shared-primitives";
import type {
  ICPAnalysisValidation,
  RiskRating,
  RiskScore,
} from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Section 2: ICP Analysis & Validation Content
// =============================================================================

interface ICPAnalysisContentProps extends EditableContentProps {
  data: ICPAnalysisValidation;
}

export function ICPAnalysisContent({ data, isEditing, onFieldChange }: ICPAnalysisContentProps) {
  const verdictStatus = data?.finalVerdict?.status || "workable";

  return (
    <div className="space-y-5">
      {/* Final Verdict Banner */}
      <FieldHighlightWrapper fieldPath="finalVerdict.reasoning">
        <StatusBanner
          status={verdictStatus}
          statusLabel="ICP Status"
          colorClass={VALIDATION_STATUS_COLORS[verdictStatus]}
        >
          <div className="flex items-center gap-1.5 mb-2">
            {verdictStatus === "validated" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {verdictStatus === "workable" && <AlertTriangle className="h-4 w-4 shrink-0" />}
            {verdictStatus === "invalid" && <XCircle className="h-4 w-4 shrink-0" />}
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70">
              {safeRender(verdictStatus)}
            </span>
          </div>
          {isEditing && onFieldChange ? (
            <EditableText
              value={safeRender(data?.finalVerdict?.reasoning)}
              onSave={(v) => onFieldChange("finalVerdict.reasoning", v)}
              multiline
            />
          ) : (
            <p className="text-sm leading-relaxed opacity-90">
              <SourcedListItem>{safeRender(data?.finalVerdict?.reasoning)}</SourcedListItem>
            </p>
          )}
        </StatusBanner>
      </FieldHighlightWrapper>

      {/* Coherence Check */}
      <SubSection title="ICP Coherence Check">
        <FieldHighlightWrapper fieldPath="coherenceCheck">
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
              <BoolCheck value={data?.coherenceCheck?.clearlyDefined || false} label="Clearly Defined" />
              <BoolCheck value={data?.coherenceCheck?.reachableThroughPaidChannels || false} label="Reachable via Paid Channels" />
              <BoolCheck value={data?.coherenceCheck?.adequateScale || false} label="Adequate Scale" />
              <BoolCheck value={data?.coherenceCheck?.hasPainOfferSolves || false} label="Has Pain Offer Solves" />
              <BoolCheck value={data?.coherenceCheck?.hasBudgetAndAuthority || false} label="Has Budget & Authority" />
            </div>
          </div>
        </FieldHighlightWrapper>
      </SubSection>

      {/* Pain-Solution Fit */}
      <SubSection title="Pain-Solution Fit">
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <DataCard label="Primary Pain" fieldPath="painSolutionFit.primaryPain">
              {isEditing && onFieldChange ? (
                <EditableText
                  value={safeRender(data?.painSolutionFit?.primaryPain)}
                  onSave={(v) => onFieldChange("painSolutionFit.primaryPain", v)}
                />
              ) : (
                <SourcedText>{safeRender(data?.painSolutionFit?.primaryPain)}</SourcedText>
              )}
            </DataCard>
            <DataCard label="Offer Component Solving It" fieldPath="painSolutionFit.offerComponentSolvingIt">
              {isEditing && onFieldChange ? (
                <EditableText
                  value={safeRender(data?.painSolutionFit?.offerComponentSolvingIt)}
                  onSave={(v) => onFieldChange("painSolutionFit.offerComponentSolvingIt", v)}
                />
              ) : (
                <SourcedText>{safeRender(data?.painSolutionFit?.offerComponentSolvingIt)}</SourcedText>
              )}
            </DataCard>
          </div>
          <div className="pt-1 border-t border-white/[0.04]">
            <Badge className={cn(
              "text-[10px] uppercase tracking-wider",
              data?.painSolutionFit?.fitAssessment === "strong" ? STATUS_BADGE_COLORS.success :
              data?.painSolutionFit?.fitAssessment === "moderate" ? STATUS_BADGE_COLORS.warning :
              STATUS_BADGE_COLORS.danger
            )}>
              Fit: {safeRender(data?.painSolutionFit?.fitAssessment)}
            </Badge>
          </div>
        </div>
      </SubSection>

      {/* Market Reachability */}
      <SubSection title="Market Size & Reachability">
        <FieldHighlightWrapper fieldPath="marketReachability">
          <div className="space-y-3">
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <BoolCheck value={data?.marketReachability?.metaVolume || false} label="Meta Audience Volume" />
                <BoolCheck value={data?.marketReachability?.linkedInVolume || false} label="LinkedIn Volume" />
                <BoolCheck value={data?.marketReachability?.googleSearchDemand || false} label="Google Search Demand" />
              </div>
            </div>

            {data?.marketReachability?.contradictingSignals && data.marketReachability.contradictingSignals.length > 0 && (
              <div className="rounded-lg bg-amber-500/[0.04] border border-amber-500/[0.15] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-400/70 mb-2">
                  Contradicting Signals
                </p>
                <ul className="space-y-1">
                  {data.marketReachability.contradictingSignals.map((signal, i) => (
                    <WarningItem key={i}><SourcedListItem>{signal}</SourcedListItem></WarningItem>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </FieldHighlightWrapper>
      </SubSection>

      {/* Economic Feasibility */}
      <SubSection title="Economic Feasibility">
        <FieldHighlightWrapper fieldPath="economicFeasibility">
          <div className="space-y-3">
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <BoolCheck value={data?.economicFeasibility?.hasBudget || false} label="ICP Has Budget" />
                <BoolCheck value={data?.economicFeasibility?.purchasesSimilar || false} label="Purchases Similar Solutions" />
                <BoolCheck value={data?.economicFeasibility?.tamAlignedWithCac || false} label="TAM Aligns with CAC" />
              </div>
            </div>

            {data?.economicFeasibility?.notes && (
              <p className="text-sm text-white/50 leading-relaxed px-0.5">
                <SourcedListItem>{data.economicFeasibility.notes}</SourcedListItem>
              </p>
            )}
          </div>
        </FieldHighlightWrapper>
      </SubSection>

      {/* Risk Scores (new) / Risk Assessment (legacy) */}
      {(hasItems(data?.riskScores) || (data as any)?.riskAssessment || isEditing) && (
        <SubSection title="Risk Assessment">
          {data?.riskScores?.length ? (
            <div className="space-y-2">
              {data.riskScores.map((rs: RiskScore, idx: number) => {
                const score = rs.score ?? rs.probability * rs.impact;
                const classification = rs.classification ?? (
                  score >= 16 ? "critical" : score >= 9 ? "high" : score >= 4 ? "medium" : "low"
                );
                return (
                  <div
                    key={idx}
                    className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-white/40">
                        {rs.category.replace(/_/g, " ")}
                      </span>
                      <Badge className={cn(
                        "text-[10px] uppercase tracking-wider",
                        RISK_COLORS[classification as RiskRating] || RISK_COLORS.medium
                      )}>
                        {classification}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/70 leading-snug">{rs.risk}</p>
                    <div className="flex gap-4 mt-2 text-[11px] text-white/30 font-[family-name:var(--font-mono)] tabular-nums">
                      <span>P: {rs.probability}/5</span>
                      <span>I: {rs.impact}/5</span>
                      <span>Score: {score}/25</span>
                    </div>
                    {rs.mitigation && (
                      <p className="text-xs mt-1.5 text-white/45 leading-snug">
                        Mitigation: {rs.mitigation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (data as any)?.riskAssessment ? (
            /* Legacy fallback for old blueprints */
            <CardGrid cols={4}>
              {(["reachability", "budget", "painStrength", "competitiveness"] as const).map((key) => (
                <DataCard key={key} label={key.replace(/([A-Z])/g, " $1")} fieldPath={`riskAssessment.${key}`}>
                  <Badge className={cn(
                    "text-[10px] uppercase tracking-wider",
                    RISK_COLORS[((data as any).riskAssessment?.[key] || "medium") as RiskRating]
                  )}>
                    {safeRender((data as any).riskAssessment?.[key])}
                  </Badge>
                </DataCard>
              ))}
            </CardGrid>
          ) : null}
        </SubSection>
      )}

      {/* Recommendations */}
      {(data?.finalVerdict?.recommendations || isEditing) && (
        <SubSection title="Recommendations">
          <FieldHighlightWrapper fieldPath="finalVerdict.recommendations">
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.finalVerdict?.recommendations)}
                onSave={(v) => onFieldChange("finalVerdict.recommendations", v)}
                renderPrefix={() => <Check className="h-4 w-4 text-blue-400/70" />}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.finalVerdict?.recommendations).map((item, i) => (
                  <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                ))}
              </ul>
            )}
          </FieldHighlightWrapper>
        </SubSection>
      )}
    </div>
  );
}
