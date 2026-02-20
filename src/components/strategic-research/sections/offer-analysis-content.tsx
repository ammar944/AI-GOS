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

      {/* Offer Clarity */}
      <SubSection title="Offer Clarity">
        <CardGrid cols={3}>
          <BoolCheck value={data?.offerClarity?.clearlyArticulated || false} label="Clearly Articulated" />
          <BoolCheck value={data?.offerClarity?.solvesRealPain || false} label="Solves Real Pain" />
          <BoolCheck value={data?.offerClarity?.benefitsEasyToUnderstand || false} label="Benefits Easy to Understand" />
          <BoolCheck value={data?.offerClarity?.transformationMeasurable || false} label="Transformation Measurable" />
          <BoolCheck value={data?.offerClarity?.valuePropositionObvious || false} label="Value Prop Obvious in 3s" />
        </CardGrid>
      </SubSection>

      {/* Offer Strength Scores */}
      <SubSection title="Offer Strength Scores">
        <CardGrid cols={2}>
          <ScoreDisplay label="Pain Relevance" score={data?.offerStrength?.painRelevance || 0} />
          <ScoreDisplay label="Urgency" score={data?.offerStrength?.urgency || 0} />
          <ScoreDisplay label="Differentiation" score={data?.offerStrength?.differentiation || 0} />
          <ScoreDisplay label="Tangibility" score={data?.offerStrength?.tangibility || 0} />
          <ScoreDisplay label="Proof" score={data?.offerStrength?.proof || 0} />
          <ScoreDisplay label="Pricing Logic" score={data?.offerStrength?.pricingLogic || 0} />
        </CardGrid>
        <div className="mt-3">
          <OverallScoreDisplay
            label="Overall Score"
            score={data?.offerStrength?.overallScore || 0}
            max={10}
          />
        </div>
      </SubSection>

      {/* Market-Offer Fit */}
      <SubSection title="Market-Offer Fit">
        <CardGrid cols={3}>
          <BoolCheck value={data?.marketOfferFit?.marketWantsNow || false} label="Market Wants This Now" />
          <BoolCheck value={data?.marketOfferFit?.competitorsOfferSimilar || false} label="Competitors Offer Similar" />
          <BoolCheck value={data?.marketOfferFit?.priceMatchesExpectations || false} label="Price Matches Expectations" />
          <BoolCheck value={data?.marketOfferFit?.proofStrongForColdTraffic || false} label="Proof Strong for Cold Traffic" />
          <BoolCheck value={data?.marketOfferFit?.transformationBelievable || false} label="Transformation Believable" />
        </CardGrid>
      </SubSection>

      {/* Red Flags */}
      {data?.redFlags && data.redFlags.length > 0 && (
        <SubSection title="Red Flags">
          <div className="flex flex-wrap gap-2">
            {data.redFlags.map((flag, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium capitalize border bg-red-500/[0.1] text-red-400/70 border-red-500/[0.15]"
              >
                {safeRender(flag).replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </SubSection>
      )}

      {/* Action Items */}
      {(safeArray(data?.recommendation?.actionItems).length > 0 || isEditing) && (
        <SubSection title="Action Items">
          <HighlightBlock>
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
          </HighlightBlock>
        </SubSection>
      )}
    </div>
  );
}
