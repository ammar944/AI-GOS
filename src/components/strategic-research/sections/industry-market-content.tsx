"use client";

import {
  TrendingUp,
  Target,
  Shield,
  Brain,
  MessageSquare,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditableText, EditableList } from "../editable";
import { SourcedText, SourcedListItem } from "../citations";
import { safeRender, safeArray, hasItems } from "./shared-helpers";
import {
  SubSection,
  ListItem,
  DataCard,
  InsightCard,
  CardGrid,
  WarningItem,
  HighlightBlock,
  type EditableContentProps,
} from "./shared-primitives";
import type { IndustryMarketOverview } from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Section 1: Industry & Market Overview Content
// =============================================================================

interface IndustryMarketContentProps extends EditableContentProps {
  data: IndustryMarketOverview;
}

export function IndustryMarketContent({ data, isEditing, onFieldChange }: IndustryMarketContentProps) {
  return (
    <div className="space-y-5">
      {/* Category Snapshot */}
      <SubSection title="Category Snapshot">
        <CardGrid cols={3}>
          <DataCard label="Category">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.categorySnapshot?.category)}
                onSave={(v) => onFieldChange("categorySnapshot.category", v)}
              />
            ) : (
              <SourcedText>{safeRender(data?.categorySnapshot?.category)}</SourcedText>
            )}
          </DataCard>

          <DataCard label="Market Maturity">
            <Badge variant="outline" className="capitalize text-xs">
              {safeRender(data?.categorySnapshot?.marketMaturity)}
            </Badge>
          </DataCard>

          <DataCard label="Awareness Level">
            <Badge variant="outline" className="capitalize text-xs">
              {safeRender(data?.categorySnapshot?.awarenessLevel)}
            </Badge>
          </DataCard>

          <DataCard label="Buying Behavior">
            <span className="capitalize">
              {safeRender(data?.categorySnapshot?.buyingBehavior)?.replace("_", " ")}
            </span>
          </DataCard>

          <DataCard label="Sales Cycle">
            <SourcedText>{safeRender(data?.categorySnapshot?.averageSalesCycle)}</SourcedText>
          </DataCard>

          <DataCard label="Seasonality">
            <SourcedText>{safeRender(data?.categorySnapshot?.seasonality)}</SourcedText>
          </DataCard>
        </CardGrid>
      </SubSection>

      {/* Market Dynamics */}
      {(safeArray(data?.marketDynamics?.demandDrivers).length > 0 ||
        safeArray(data?.marketDynamics?.buyingTriggers).length > 0 ||
        safeArray(data?.marketDynamics?.barriersToPurchase).length > 0 ||
        isEditing) && (
        <SubSection title="Market Dynamics">
          <div className="grid md:grid-cols-2 gap-4">
            {(safeArray(data?.marketDynamics?.demandDrivers).length > 0 || isEditing) && (
              <div>
                <h4 className="text-[13px] font-medium text-white/70 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400/70" />
                  Demand Drivers
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(data?.marketDynamics?.demandDrivers)}
                    onSave={(v) => onFieldChange("marketDynamics.demandDrivers", v)}
                    renderPrefix={() => <Check className="h-4 w-4 text-blue-400/80" />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {safeArray(data?.marketDynamics?.demandDrivers).map((item, i) => (
                      <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {(safeArray(data?.marketDynamics?.buyingTriggers).length > 0 || isEditing) && (
              <div>
                <h4 className="text-[13px] font-medium text-white/70 mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-400/70" />
                  Buying Triggers
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(data?.marketDynamics?.buyingTriggers)}
                    onSave={(v) => onFieldChange("marketDynamics.buyingTriggers", v)}
                    renderPrefix={() => <Check className="h-4 w-4 text-blue-400/80" />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {safeArray(data?.marketDynamics?.buyingTriggers).map((item, i) => (
                      <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {(safeArray(data?.marketDynamics?.barriersToPurchase).length > 0 || isEditing) && (
            <div className="mt-4">
              <h4 className="text-[13px] font-medium text-white/70 mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400/70" />
                Barriers to Purchase
              </h4>
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.marketDynamics?.barriersToPurchase)}
                  onSave={(v) => onFieldChange("marketDynamics.barriersToPurchase", v)}
                  renderPrefix={() => <AlertTriangle className="h-4 w-4 text-amber-400/70" />}
                />
              ) : (
                <ul className="space-y-1">
                  {safeArray(data?.marketDynamics?.barriersToPurchase).map((item, i) => (
                    <WarningItem key={i}><SourcedListItem>{item}</SourcedListItem></WarningItem>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SubSection>
      )}

      {/* Pain Points */}
      {(safeArray(data?.painPoints?.primary).length > 0 ||
        safeArray(data?.painPoints?.secondary).length > 0 ||
        isEditing) && (
        <SubSection title="Pain Points">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-[13px] font-medium text-red-400/70 mb-2">Primary Pain Points</h4>
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.painPoints?.primary)}
                  onSave={(v) => onFieldChange("painPoints.primary", v)}
                  renderPrefix={() => <Check className="h-4 w-4 text-blue-400/80" />}
                />
              ) : (
                <ul className="space-y-1">
                  {safeArray(data?.painPoints?.primary).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-amber-400/70 mb-2">Secondary Pain Points</h4>
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.painPoints?.secondary)}
                  onSave={(v) => onFieldChange("painPoints.secondary", v)}
                  renderPrefix={() => <Check className="h-4 w-4 text-blue-400/80" />}
                />
              ) : (
                <ul className="space-y-1">
                  {safeArray(data?.painPoints?.secondary).map((item, i) => (
                    <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SubSection>
      )}

      {/* Psychological Drivers */}
      {(hasItems(data?.psychologicalDrivers?.drivers) || isEditing) && (
        <SubSection title="Psychological Drivers">
          <CardGrid cols={2}>
            {(data?.psychologicalDrivers?.drivers || []).map((driver, i) => (
              <InsightCard
                key={i}
                icon={Brain}
                iconColor="text-blue-400/70"
                title={safeRender(driver?.driver)}
                accentBorder
              >
                {safeRender(driver?.description)}
              </InsightCard>
            ))}
          </CardGrid>
        </SubSection>
      )}

      {/* Audience Objections */}
      {(hasItems(data?.audienceObjections?.objections) || isEditing) && (
        <SubSection title="Audience Objections">
          <div className="space-y-2">
            {(data?.audienceObjections?.objections || []).map((obj, i) => (
              <InsightCard
                key={i}
                icon={MessageSquare}
                iconColor="text-amber-400/70"
                title={`"${safeRender(obj?.objection)}"`}
              >
                <span className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">Response: </span>
                {safeRender(obj?.howToAddress)}
              </InsightCard>
            ))}
          </div>
        </SubSection>
      )}

      {/* Key Recommendations */}
      {(safeArray(data?.messagingOpportunities?.summaryRecommendations).length > 0 || isEditing) && (
        <SubSection title="Key Recommendations">
          <HighlightBlock>
            {isEditing && onFieldChange ? (
              <EditableList
                items={safeArray(data?.messagingOpportunities?.summaryRecommendations)}
                onSave={(v) => onFieldChange("messagingOpportunities.summaryRecommendations", v)}
                renderPrefix={() => <Check className="h-4 w-4 text-blue-400/80" />}
              />
            ) : (
              <ul className="space-y-1">
                {safeArray(data?.messagingOpportunities?.summaryRecommendations).map((item, i) => (
                  <ListItem key={i}>{item}</ListItem>
                ))}
              </ul>
            )}
          </HighlightBlock>
        </SubSection>
      )}
    </div>
  );
}
