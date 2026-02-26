"use client";

import {
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Minus,
} from "lucide-react";
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

// -----------------------------------------------------------------------------
// InlineCheckRow — replaces BoolCheck with icon-backed pass/fail rows
// Larger touch target, icon instead of dot, readable label weight.
// Supports toggling in edit mode via isEditing + onToggle.
// -----------------------------------------------------------------------------

function InlineCheckRow({
  value,
  label,
  isEditing,
  onToggle,
}: {
  value: boolean;
  label: string;
  isEditing?: boolean;
  onToggle?: (newValue: boolean) => void;
}) {
  const interactive = isEditing && onToggle != null;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={interactive ? "Click to toggle" : undefined}
      onClick={interactive ? () => onToggle(!value) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle(!value);
              }
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-3 py-[9px] border-b border-[rgba(255,255,255,0.04)] last:border-0 rounded-sm transition-colors duration-150",
        interactive &&
          "cursor-pointer group/checkrow hover:bg-[var(--bg-elevated,rgb(10,13,20))] px-1.5 -mx-1.5"
      )}
    >
      {value ? (
        <span
          className={cn(
            "flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[rgba(34,197,94,0.12)] shrink-0 transition-all duration-150",
            interactive &&
              "group-hover/checkrow:ring-2 group-hover/checkrow:ring-[rgb(54,94,255)] group-hover/checkrow:ring-offset-1 group-hover/checkrow:ring-offset-[rgb(7,9,14)]"
          )}
        >
          <Check className="h-[10px] w-[10px] text-[#22c55e]" strokeWidth={2.5} />
        </span>
      ) : (
        <span
          className={cn(
            "flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[rgba(255,255,255,0.04)] shrink-0 transition-all duration-150",
            interactive &&
              "group-hover/checkrow:ring-2 group-hover/checkrow:ring-[rgb(54,94,255)] group-hover/checkrow:ring-offset-1 group-hover/checkrow:ring-offset-[rgb(7,9,14)]"
          )}
        >
          <Minus className="h-[10px] w-[10px] text-[rgb(70,75,85)]" strokeWidth={2.5} />
        </span>
      )}
      <span
        className={cn(
          "text-[13.5px] leading-snug transition-colors duration-150",
          value ? "text-[rgb(205,208,213)]" : "text-[rgb(100,105,115)]",
          interactive && "group-hover/checkrow:text-[rgb(225,228,233)]"
        )}
      >
        {label}
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CheckGroup — wraps a set of InlineCheckRows with a pass/total summary header.
// Each check item carries a fieldKey so toggle callbacks can target the right
// field path inside onFieldChange.
// -----------------------------------------------------------------------------

function CheckGroup({
  checks,
  fieldPath,
  isEditing,
  onFieldChange,
}: {
  checks: { value: boolean; label: string; fieldKey: string }[];
  fieldPath?: string;
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}) {
  const passCount = checks.filter((c) => c.value).length;
  const total = checks.length;

  return (
    <FieldHighlightWrapper fieldPath={fieldPath}>
      <div className="border-t border-[rgba(255,255,255,0.06)]">
        {/* Summary row */}
        <div className="flex items-center justify-between pt-2 pb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(70,75,85)]">
            Criteria
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.06em] tabular-nums",
              passCount === total
                ? "text-[#22c55e]"
                : passCount >= Math.ceil(total / 2)
                  ? "text-[#f59e0b]"
                  : "text-[#ef4444]"
            )}
          >
            {passCount}/{total} passing
          </span>
        </div>
        {/* Check rows */}
        <div>
          {checks.map((c) => (
            <InlineCheckRow
              key={c.fieldKey}
              value={c.value}
              label={c.label}
              isEditing={isEditing}
              onToggle={
                onFieldChange && fieldPath
                  ? (newVal) => onFieldChange(`${fieldPath}.${c.fieldKey}`, newVal)
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </FieldHighlightWrapper>
  );
}

// -----------------------------------------------------------------------------
// PainSolutionBlock — stacked layout replacing horizontal DataCard
// Renders pain and solution as two labeled blocks connected by a flow arrow
// -----------------------------------------------------------------------------

function PainSolutionBlock({
  primaryPain,
  offerComponentSolvingIt,
  fitAssessment,
  isEditing,
  onFieldChange,
}: {
  primaryPain: string;
  offerComponentSolvingIt: string;
  fitAssessment: "strong" | "moderate" | "weak" | string;
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}) {
  const fitColor =
    fitAssessment === "strong"
      ? STATUS_BADGE_COLORS.success
      : fitAssessment === "moderate"
        ? STATUS_BADGE_COLORS.warning
        : STATUS_BADGE_COLORS.danger;

  return (
    <div className="space-y-0">
      {/* Primary Pain block */}
      <FieldHighlightWrapper fieldPath="painSolutionFit.primaryPain">
        <div className="border-t border-[rgba(255,255,255,0.06)] py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-2">
            Primary Pain
          </p>
          {isEditing && onFieldChange ? (
            <EditableText
              value={primaryPain}
              onSave={(v) => onFieldChange("painSolutionFit.primaryPain", v)}
              multiline
            />
          ) : (
            <p className="text-[13.5px] text-[rgb(205,208,213)] leading-[1.65]">
              <SourcedText>{primaryPain}</SourcedText>
            </p>
          )}
        </div>
      </FieldHighlightWrapper>

      {/* Arrow connector */}
      <div className="flex items-center gap-2 py-1 pl-1">
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-[rgb(49,53,63)]"
          aria-hidden
        />
        {isEditing && onFieldChange ? (
          <EditableText
            value={fitAssessment}
            onSave={(v) => onFieldChange("painSolutionFit.fitAssessment", v)}
          />
        ) : (
          <span className={cn("text-[11px] font-semibold uppercase tracking-[0.06em]", fitColor)}>
            {fitAssessment} fit
          </span>
        )}
      </div>

      {/* Offer Component block */}
      <FieldHighlightWrapper fieldPath="painSolutionFit.offerComponentSolvingIt">
        <div className="border-b border-[rgba(255,255,255,0.06)] py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-2">
            Offer Component Solving It
          </p>
          {isEditing && onFieldChange ? (
            <EditableText
              value={offerComponentSolvingIt}
              onSave={(v) => onFieldChange("painSolutionFit.offerComponentSolvingIt", v)}
              multiline
            />
          ) : (
            <p className="text-[13.5px] text-[rgb(205,208,213)] leading-[1.65]">
              <SourcedText>{offerComponentSolvingIt}</SourcedText>
            </p>
          )}
        </div>
      </FieldHighlightWrapper>
    </div>
  );
}

// -----------------------------------------------------------------------------
// RiskScoreRow — single risk item with score bar visualization
// -----------------------------------------------------------------------------

function RiskScoreRow({
  rs,
  idx,
  isEditing,
  onFieldChange,
}: {
  rs: RiskScore;
  idx: number;
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}) {
  const score = rs.score ?? rs.probability * rs.impact;
  const classification =
    rs.classification ??
    (score >= 16 ? "critical" : score >= 9 ? "high" : score >= 4 ? "medium" : "low");

  const barPercent = (score / 25) * 100;
  const barColorClass =
    classification === "critical"
      ? "bg-[#ef4444]"
      : classification === "high"
        ? "bg-[#f59e0b]"
        : classification === "medium"
          ? "bg-[#f59e0b]"
          : "bg-[#22c55e]";

  return (
    <div className="py-3.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      {/* Header row: category + classification */}
      <div className="flex items-center justify-between mb-2">
        {isEditing && onFieldChange ? (
          <EditableText
            value={rs.category.replace(/_/g, " ")}
            onSave={(v) => onFieldChange(`riskScores.${idx}.category`, v)}
          />
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)]">
            {rs.category.replace(/_/g, " ")}
          </span>
        )}
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.06em]",
            RISK_COLORS[classification as RiskRating] || RISK_COLORS.medium
          )}
        >
          {classification}
        </span>
      </div>

      {/* Risk description */}
      <FieldHighlightWrapper fieldPath={`riskScores.${idx}.risk`}>
        {isEditing && onFieldChange ? (
          <EditableText
            value={rs.risk}
            onSave={(v) => onFieldChange(`riskScores.${idx}.risk`, v)}
            multiline
          />
        ) : (
          <p className="text-[13.5px] text-[rgb(180,185,195)] leading-snug mb-2.5">{rs.risk}</p>
        )}
      </FieldHighlightWrapper>

      {/* Score bar + P×I numerics */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-[2px] bg-[rgba(255,255,255,0.05)] rounded-[1px] overflow-hidden">
          <div
            className={cn("h-full rounded-[1px]", barColorClass)}
            style={{ width: `${barPercent}%` }}
          />
        </div>
        {isEditing && onFieldChange ? (
          <div className="flex gap-3 shrink-0 text-[11px] text-[rgb(70,75,85)] font-[family-name:var(--font-mono)] tabular-nums items-center">
            <span className="flex items-center gap-1">
              P
              <input
                type="number"
                min={1}
                max={5}
                step={1}
                value={rs.probability}
                onChange={(e) => onFieldChange(`riskScores.${idx}.probability`, Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-10 h-6 text-xs text-center rounded border"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-heading)',
                }}
              />
              /5
            </span>
            <span className="flex items-center gap-1">
              I
              <input
                type="number"
                min={1}
                max={5}
                step={1}
                value={rs.impact}
                onChange={(e) => onFieldChange(`riskScores.${idx}.impact`, Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-10 h-6 text-xs text-center rounded border"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-heading)',
                }}
              />
              /5
            </span>
            <span className="text-[rgb(100,105,115)]">Score {score}/25</span>
          </div>
        ) : (
          <div className="flex gap-3 shrink-0 text-[11px] text-[rgb(70,75,85)] font-[family-name:var(--font-mono)] tabular-nums">
            <span>P {rs.probability}/5</span>
            <span>I {rs.impact}/5</span>
            <span className="text-[rgb(100,105,115)]">Score {score}/25</span>
          </div>
        )}
      </div>

      {/* Mitigation note */}
      {(rs.mitigation || isEditing) && (
        <FieldHighlightWrapper fieldPath={`riskScores.${idx}.mitigation`}>
          <div className="text-[12px] mt-2 text-[rgb(100,105,115)] leading-snug">
            <span className="font-medium text-[rgb(70,75,85)]">Mitigation: </span>
            {isEditing && onFieldChange ? (
              <EditableText
                value={rs.mitigation ?? ""}
                onSave={(v) => onFieldChange(`riskScores.${idx}.mitigation`, v)}
                multiline
                placeholder="Add mitigation..."
              />
            ) : (
              <span>{rs.mitigation}</span>
            )}
          </div>
        </FieldHighlightWrapper>
      )}

      {/* Early warning indicator */}
      {(rs.earlyWarningIndicator || isEditing) && (
        <FieldHighlightWrapper fieldPath={`riskScores.${idx}.earlyWarningIndicator`}>
          <div className="text-[12px] mt-1 text-[rgb(100,105,115)] leading-snug">
            <span className="font-medium text-[rgb(70,75,85)]">Watch: </span>
            {isEditing && onFieldChange ? (
              <EditableText
                value={rs.earlyWarningIndicator ?? ""}
                onSave={(v) => onFieldChange(`riskScores.${idx}.earlyWarningIndicator`, v)}
                multiline
                placeholder="Add early warning..."
              />
            ) : (
              <span>{rs.earlyWarningIndicator}</span>
            )}
          </div>
        </FieldHighlightWrapper>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// LegacyRiskRow — flat key/value row for deprecated riskAssessment shape
// Uses DataCard horizontal layout which works well for single-word values
// -----------------------------------------------------------------------------

function LegacyRiskRow({
  label,
  value,
  fieldPath,
}: {
  label: string;
  value: RiskRating;
  fieldPath: string;
}) {
  return (
    <DataCard label={label} fieldPath={fieldPath}>
      <span
        className={cn(
          "text-[12px] font-semibold uppercase tracking-wider",
          RISK_COLORS[value] || RISK_COLORS.medium
        )}
      >
        {safeRender(value)}
      </span>
    </DataCard>
  );
}

// =============================================================================
// Main export
// =============================================================================

export function ICPAnalysisContent({ data, isEditing, onFieldChange }: ICPAnalysisContentProps) {
  const verdictStatus = data?.finalVerdict?.status || "workable";

  return (
    <div className="space-y-8">

      {/* ── Final Verdict Banner ────────────────────────────────────────────── */}
      <FieldHighlightWrapper fieldPath="finalVerdict.reasoning">
        <StatusBanner
          status={verdictStatus}
          statusLabel="ICP Status"
          colorClass={VALIDATION_STATUS_COLORS[verdictStatus]}
        >
          <div className="flex items-center gap-1.5 mb-2">
            {verdictStatus === "validated" && (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            {verdictStatus === "workable" && (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {verdictStatus === "invalid" && (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgb(130,135,145)]">
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
            <p className="text-sm leading-relaxed text-[rgb(180,185,195)]">
              <SourcedListItem>{safeRender(data?.finalVerdict?.reasoning)}</SourcedListItem>
            </p>
          )}
        </StatusBanner>
      </FieldHighlightWrapper>

      {/* ── ICP Coherence Check ─────────────────────────────────────────────── */}
      <SubSection title="ICP Coherence Check">
        <CheckGroup
          fieldPath="coherenceCheck"
          isEditing={isEditing}
          onFieldChange={onFieldChange}
          checks={[
            {
              value: data?.coherenceCheck?.clearlyDefined || false,
              label: "Clearly Defined",
              fieldKey: "clearlyDefined",
            },
            {
              value: data?.coherenceCheck?.reachableThroughPaidChannels || false,
              label: "Reachable via Paid Channels",
              fieldKey: "reachableThroughPaidChannels",
            },
            {
              value: data?.coherenceCheck?.adequateScale || false,
              label: "Adequate Scale",
              fieldKey: "adequateScale",
            },
            {
              value: data?.coherenceCheck?.hasPainOfferSolves || false,
              label: "Has Pain the Offer Solves",
              fieldKey: "hasPainOfferSolves",
            },
            {
              value: data?.coherenceCheck?.hasBudgetAndAuthority || false,
              label: "Has Budget & Decision Authority",
              fieldKey: "hasBudgetAndAuthority",
            },
          ]}
        />
      </SubSection>

      {/* ── Pain-Solution Fit ────────────────────────────────────────────────── */}
      <SubSection title="Pain-Solution Fit">
        <PainSolutionBlock
          primaryPain={safeRender(data?.painSolutionFit?.primaryPain)}
          offerComponentSolvingIt={safeRender(data?.painSolutionFit?.offerComponentSolvingIt)}
          fitAssessment={data?.painSolutionFit?.fitAssessment || "moderate"}
          isEditing={isEditing}
          onFieldChange={onFieldChange}
        />
        {(data?.painSolutionFit?.notes || isEditing) && (
          <FieldHighlightWrapper fieldPath="painSolutionFit.notes">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.painSolutionFit?.notes || "")}
                onSave={(v) => onFieldChange("painSolutionFit.notes", v)}
                multiline
                placeholder="Add notes..."
              />
            ) : (
              <p className="text-[13px] text-[rgb(100,105,115)] leading-relaxed mt-3">
                <SourcedListItem>{data.painSolutionFit.notes}</SourcedListItem>
              </p>
            )}
          </FieldHighlightWrapper>
        )}
      </SubSection>

      {/* ── Market Size & Reachability ───────────────────────────────────────── */}
      <SubSection title="Market Size & Reachability">
        <CheckGroup
          fieldPath="marketReachability"
          isEditing={isEditing}
          onFieldChange={onFieldChange}
          checks={[
            {
              value: data?.marketReachability?.metaVolume || false,
              label: "Meta Audience Volume",
              fieldKey: "metaVolume",
            },
            {
              value: data?.marketReachability?.linkedInVolume || false,
              label: "LinkedIn Volume",
              fieldKey: "linkedInVolume",
            },
            {
              value: data?.marketReachability?.googleSearchDemand || false,
              label: "Google Search Demand",
              fieldKey: "googleSearchDemand",
            },
          ]}
        />

        {(safeArray(data?.marketReachability?.contradictingSignals).length > 0 || isEditing) && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-2">
              Contradicting Signals
            </p>
            <FieldHighlightWrapper fieldPath="marketReachability.contradictingSignals">
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.marketReachability?.contradictingSignals)}
                  onSave={(v) => onFieldChange("marketReachability.contradictingSignals", v)}
                  renderPrefix={() => <AlertTriangle className="h-4 w-4 text-amber-400/70" />}
                />
              ) : (
                <ul className="space-y-0.5">
                  {data.marketReachability.contradictingSignals.map((signal, i) => (
                    <WarningItem key={i}>
                      <SourcedListItem>{signal}</SourcedListItem>
                    </WarningItem>
                  ))}
                </ul>
              )}
            </FieldHighlightWrapper>
          </div>
        )}
      </SubSection>

      {/* ── Economic Feasibility ─────────────────────────────────────────────── */}
      <SubSection title="Economic Feasibility">
        <CheckGroup
          fieldPath="economicFeasibility"
          isEditing={isEditing}
          onFieldChange={onFieldChange}
          checks={[
            {
              value: data?.economicFeasibility?.hasBudget || false,
              label: "ICP Has Budget",
              fieldKey: "hasBudget",
            },
            {
              value: data?.economicFeasibility?.purchasesSimilar || false,
              label: "Purchases Similar Solutions",
              fieldKey: "purchasesSimilar",
            },
            {
              value: data?.economicFeasibility?.tamAlignedWithCac || false,
              label: "TAM Aligns with CAC Target",
              fieldKey: "tamAlignedWithCac",
            },
          ]}
        />

        {(data?.economicFeasibility?.notes || isEditing) && (
          <FieldHighlightWrapper fieldPath="economicFeasibility.notes">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.economicFeasibility?.notes || "")}
                onSave={(v) => onFieldChange("economicFeasibility.notes", v)}
                multiline
                placeholder="Add notes..."
              />
            ) : (
              <p className="text-[13px] text-[rgb(130,135,145)] leading-relaxed mt-4">
                <SourcedListItem>{data.economicFeasibility.notes}</SourcedListItem>
              </p>
            )}
          </FieldHighlightWrapper>
        )}
      </SubSection>

      {/* ── Risk Assessment ──────────────────────────────────────────────────── */}
      {(hasItems(data?.riskScores) || (data as any)?.riskAssessment || isEditing) && (
        <SubSection title="Risk Assessment">
          {data?.riskScores?.length ? (
            /* Modern riskScores shape — score bar per risk */
            <div className="border-t border-[rgba(255,255,255,0.06)]">
              {data.riskScores.map((rs: RiskScore, idx: number) => (
                <RiskScoreRow
                  key={idx}
                  rs={rs}
                  idx={idx}
                  isEditing={isEditing}
                  onFieldChange={onFieldChange}
                />
              ))}
            </div>
          ) : (data as any)?.riskAssessment ? (
            /* Legacy fallback — horizontal key/value rows work fine for single-word ratings */
            <CardGrid cols={4}>
              {(
                [
                  ["reachability", "Reachability"],
                  ["budget", "Budget"],
                  ["painStrength", "Pain Strength"],
                  ["competitiveness", "Competitiveness"],
                ] as const
              ).map(([key, label]) => (
                <LegacyRiskRow
                  key={key}
                  label={label}
                  value={(data as any).riskAssessment?.[key] || "medium"}
                  fieldPath={`riskAssessment.${key}`}
                />
              ))}
            </CardGrid>
          ) : null}
        </SubSection>
      )}

      {/* ── Recommendations ──────────────────────────────────────────────────── */}
      {(data?.finalVerdict?.recommendations || isEditing) && (
        <SubSection title="Recommendations">
          <FieldHighlightWrapper fieldPath="finalVerdict.recommendations">
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.finalVerdict?.recommendations)}
                onSave={(v) => onFieldChange("finalVerdict.recommendations", v)}
                renderPrefix={() => (
                  <Check className="h-4 w-4 text-[#5edead]/70" />
                )}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.finalVerdict?.recommendations).map((item, i) => (
                  <ListItem key={i}>
                    <SourcedListItem>{item}</SourcedListItem>
                  </ListItem>
                ))}
              </ul>
            )}
          </FieldHighlightWrapper>
        </SubSection>
      )}
    </div>
  );
}
