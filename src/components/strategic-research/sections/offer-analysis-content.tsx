"use client";

import { EditableText, EditableList } from "../editable";
import { SourcedListItem } from "../citations";
import { safeRender, safeArray } from "./shared-helpers";
import {
  SubSection,
  ListItem,
  BoolCheck,
  ScoreDisplay,
  OverallScoreDisplay,
  StatusBanner,
  HighlightBlock,
  CardGrid,
  FieldHighlightWrapper,
  OFFER_RECOMMENDATION_COLORS,
  type EditableContentProps,
} from "./shared-primitives";
import type { OfferAnalysisViability } from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Section 3: Offer Analysis & Viability Content
// =============================================================================

interface OfferAnalysisContentProps extends EditableContentProps {
  data: OfferAnalysisViability;
}

export function OfferAnalysisContent({ data, isEditing, onFieldChange }: OfferAnalysisContentProps) {
  const recommendationStatus = data?.recommendation?.status || "proceed";

  return (
    <div className="space-y-5">
      {/* Recommendation Banner */}
      <FieldHighlightWrapper fieldPath="recommendation">
        <StatusBanner
          status={safeRender(recommendationStatus)}
          statusLabel="Recommendation"
          colorClass={OFFER_RECOMMENDATION_COLORS[recommendationStatus]}
        >
          {isEditing && onFieldChange ? (
            <EditableText
              value={safeRender(data?.recommendation?.reasoning)}
              onSave={(v) => onFieldChange("recommendation.reasoning", v)}
              multiline
            />
          ) : (
            <SourcedListItem>{safeRender(data?.recommendation?.reasoning)}</SourcedListItem>
          )}
        </StatusBanner>
      </FieldHighlightWrapper>

      {/* Offer Clarity */}
      <SubSection title="Offer Clarity">
        <FieldHighlightWrapper fieldPath="offerClarity">
          <CardGrid cols={3}>
            <BoolCheck
              value={data?.offerClarity?.clearlyArticulated || false}
              label="Clearly Articulated"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("offerClarity.clearlyArticulated", v) : undefined}
            />
            <BoolCheck
              value={data?.offerClarity?.solvesRealPain || false}
              label="Solves Real Pain"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("offerClarity.solvesRealPain", v) : undefined}
            />
            <BoolCheck
              value={data?.offerClarity?.benefitsEasyToUnderstand || false}
              label="Benefits Easy to Understand"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("offerClarity.benefitsEasyToUnderstand", v) : undefined}
            />
            <BoolCheck
              value={data?.offerClarity?.transformationMeasurable || false}
              label="Transformation Measurable"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("offerClarity.transformationMeasurable", v) : undefined}
            />
            <BoolCheck
              value={data?.offerClarity?.valuePropositionObvious || false}
              label="Value Prop Obvious in 3s"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("offerClarity.valuePropositionObvious", v) : undefined}
            />
          </CardGrid>
        </FieldHighlightWrapper>
      </SubSection>

      {/* Offer Strength Scores */}
      <SubSection title="Offer Strength Scores">
        <FieldHighlightWrapper fieldPath="offerStrength">
          <CardGrid cols={2}>
            {isEditing && onFieldChange ? (
              <div className="flex items-center justify-between py-[10px] border-b border-[rgba(255,255,255,0.06)]">
                <span className="text-[13.5px] text-[rgb(205,208,213)]">Pain Relevance</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={data?.offerStrength?.painRelevance || 0}
                  onChange={(e) => onFieldChange("offerStrength.painRelevance", Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 h-7 text-sm text-right rounded-md border px-2 font-medium tabular-nums"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: '#a78bfa' }}
                />
              </div>
            ) : (
              <ScoreDisplay label="Pain Relevance" score={data?.offerStrength?.painRelevance || 0} accentColor="#a78bfa" />
            )}
            {isEditing && onFieldChange ? (
              <div className="flex items-center justify-between py-[10px] border-b border-[rgba(255,255,255,0.06)]">
                <span className="text-[13.5px] text-[rgb(205,208,213)]">Urgency</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={data?.offerStrength?.urgency || 0}
                  onChange={(e) => onFieldChange("offerStrength.urgency", Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 h-7 text-sm text-right rounded-md border px-2 font-medium tabular-nums"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: '#a78bfa' }}
                />
              </div>
            ) : (
              <ScoreDisplay label="Urgency" score={data?.offerStrength?.urgency || 0} accentColor="#a78bfa" />
            )}
            {isEditing && onFieldChange ? (
              <div className="flex items-center justify-between py-[10px] border-b border-[rgba(255,255,255,0.06)]">
                <span className="text-[13.5px] text-[rgb(205,208,213)]">Differentiation</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={data?.offerStrength?.differentiation || 0}
                  onChange={(e) => onFieldChange("offerStrength.differentiation", Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 h-7 text-sm text-right rounded-md border px-2 font-medium tabular-nums"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: '#a78bfa' }}
                />
              </div>
            ) : (
              <ScoreDisplay label="Differentiation" score={data?.offerStrength?.differentiation || 0} accentColor="#a78bfa" />
            )}
            {isEditing && onFieldChange ? (
              <div className="flex items-center justify-between py-[10px] border-b border-[rgba(255,255,255,0.06)]">
                <span className="text-[13.5px] text-[rgb(205,208,213)]">Tangibility</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={data?.offerStrength?.tangibility || 0}
                  onChange={(e) => onFieldChange("offerStrength.tangibility", Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 h-7 text-sm text-right rounded-md border px-2 font-medium tabular-nums"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: '#a78bfa' }}
                />
              </div>
            ) : (
              <ScoreDisplay label="Tangibility" score={data?.offerStrength?.tangibility || 0} accentColor="#a78bfa" />
            )}
            {isEditing && onFieldChange ? (
              <div className="flex items-center justify-between py-[10px] border-b border-[rgba(255,255,255,0.06)]">
                <span className="text-[13.5px] text-[rgb(205,208,213)]">Proof</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={data?.offerStrength?.proof || 0}
                  onChange={(e) => onFieldChange("offerStrength.proof", Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 h-7 text-sm text-right rounded-md border px-2 font-medium tabular-nums"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: '#a78bfa' }}
                />
              </div>
            ) : (
              <ScoreDisplay label="Proof" score={data?.offerStrength?.proof || 0} accentColor="#a78bfa" />
            )}
            {isEditing && onFieldChange ? (
              <div className="flex items-center justify-between py-[10px] border-b border-[rgba(255,255,255,0.06)]">
                <span className="text-[13.5px] text-[rgb(205,208,213)]">Pricing Logic</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={data?.offerStrength?.pricingLogic || 0}
                  onChange={(e) => onFieldChange("offerStrength.pricingLogic", Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 h-7 text-sm text-right rounded-md border px-2 font-medium tabular-nums"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: '#a78bfa' }}
                />
              </div>
            ) : (
              <ScoreDisplay label="Pricing Logic" score={data?.offerStrength?.pricingLogic || 0} accentColor="#a78bfa" />
            )}
          </CardGrid>
          <div className="mt-3">
            {isEditing && onFieldChange ? (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)]">Overall Score</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={data?.offerStrength?.overallScore || 0}
                  onChange={(e) => onFieldChange("offerStrength.overallScore", Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-24 h-10 text-xl text-center rounded-md border font-bold tabular-nums"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: '#a78bfa' }}
                />
                <span className="text-[12px] text-[rgb(100,105,115)]">out of 10</span>
              </div>
            ) : (
              <OverallScoreDisplay
                label="Overall Score"
                score={data?.offerStrength?.overallScore || 0}
                max={10}
              />
            )}
          </div>
        </FieldHighlightWrapper>
      </SubSection>

      {/* Market-Offer Fit */}
      <SubSection title="Market-Offer Fit">
        <FieldHighlightWrapper fieldPath="marketOfferFit">
          <CardGrid cols={3}>
            <BoolCheck
              value={data?.marketOfferFit?.marketWantsNow || false}
              label="Market Wants This Now"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("marketOfferFit.marketWantsNow", v) : undefined}
            />
            <BoolCheck
              value={data?.marketOfferFit?.competitorsOfferSimilar || false}
              label="Competitors Offer Similar"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("marketOfferFit.competitorsOfferSimilar", v) : undefined}
            />
            <BoolCheck
              value={data?.marketOfferFit?.priceMatchesExpectations || false}
              label="Price Matches Expectations"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("marketOfferFit.priceMatchesExpectations", v) : undefined}
            />
            <BoolCheck
              value={data?.marketOfferFit?.proofStrongForColdTraffic || false}
              label="Proof Strong for Cold Traffic"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("marketOfferFit.proofStrongForColdTraffic", v) : undefined}
            />
            <BoolCheck
              value={data?.marketOfferFit?.transformationBelievable || false}
              label="Transformation Believable"
              isEditing={isEditing}
              onToggle={onFieldChange ? (v) => onFieldChange("marketOfferFit.transformationBelievable", v) : undefined}
            />
          </CardGrid>
        </FieldHighlightWrapper>
      </SubSection>

      {/* Red Flags */}
      {(safeArray(data?.redFlags).length > 0 || isEditing) && (
        <SubSection title="Red Flags">
          <FieldHighlightWrapper fieldPath="redFlags">
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.redFlags)}
                onSave={(v) => onFieldChange("redFlags", v)}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.redFlags).map((flag, i) => (
                  <li key={i} className="text-[#ef4444] text-[12px] font-medium capitalize">
                    {safeRender(flag).replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            )}
          </FieldHighlightWrapper>
        </SubSection>
      )}

      {/* Action Items */}
      {(safeArray(data?.recommendation?.actionItems).length > 0 || isEditing) && (
        <SubSection title="Action Items">
          <HighlightBlock>
            <FieldHighlightWrapper fieldPath="recommendation.actionItems">
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.recommendation?.actionItems)}
                  onSave={(v) => onFieldChange("recommendation.actionItems", v)}
                />
              ) : (
                <ul className="space-y-1">
                  {safeArray(data?.recommendation?.actionItems).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              )}
            </FieldHighlightWrapper>
          </HighlightBlock>
        </SubSection>
      )}
    </div>
  );
}
