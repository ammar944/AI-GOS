"use client";

import {
  TrendingUp,
  Target,
  Shield,
  Check,
  AlertTriangle,
} from "lucide-react";
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
  FieldHighlightWrapper,
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
          <DataCard label="Category" fieldPath="categorySnapshot.category">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.categorySnapshot?.category)}
                onSave={(v) => onFieldChange("categorySnapshot.category", v)}
              />
            ) : (
              <SourcedText>{safeRender(data?.categorySnapshot?.category)}</SourcedText>
            )}
          </DataCard>

          <DataCard label="Market Maturity" fieldPath="categorySnapshot.marketMaturity">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.categorySnapshot?.marketMaturity)}
                onSave={(v) => onFieldChange("categorySnapshot.marketMaturity", v)}
              />
            ) : (
              <span className="capitalize">{safeRender(data?.categorySnapshot?.marketMaturity)}</span>
            )}
          </DataCard>

          <DataCard label="Awareness Level" fieldPath="categorySnapshot.awarenessLevel">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.categorySnapshot?.awarenessLevel)}
                onSave={(v) => onFieldChange("categorySnapshot.awarenessLevel", v)}
              />
            ) : (
              <span className="capitalize">{safeRender(data?.categorySnapshot?.awarenessLevel)}</span>
            )}
          </DataCard>

          <DataCard label="Buying Behavior" fieldPath="categorySnapshot.buyingBehavior">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.categorySnapshot?.buyingBehavior)}
                onSave={(v) => onFieldChange("categorySnapshot.buyingBehavior", v)}
              />
            ) : (
              <span className="capitalize">
                {safeRender(data?.categorySnapshot?.buyingBehavior)?.replace("_", " ")}
              </span>
            )}
          </DataCard>

          <DataCard label="Sales Cycle" fieldPath="categorySnapshot.averageSalesCycle">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.categorySnapshot?.averageSalesCycle)}
                onSave={(v) => onFieldChange("categorySnapshot.averageSalesCycle", v)}
              />
            ) : (
              <SourcedText>{safeRender(data?.categorySnapshot?.averageSalesCycle)}</SourcedText>
            )}
          </DataCard>

          <DataCard label="Seasonality" fieldPath="categorySnapshot.seasonality">
            {isEditing && onFieldChange ? (
              <EditableText
                value={safeRender(data?.categorySnapshot?.seasonality)}
                onSave={(v) => onFieldChange("categorySnapshot.seasonality", v)}
              />
            ) : (
              <SourcedText>{safeRender(data?.categorySnapshot?.seasonality)}</SourcedText>
            )}
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
              <FieldHighlightWrapper fieldPath="marketDynamics.demandDrivers">
                <div>
                  <h4 className="text-[13px] font-medium text-[rgb(180,185,195)] mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#6fa0ff]" />
                    Demand Drivers
                  </h4>
                  {isEditing && onFieldChange ? (
                    <EditableList
                      items={safeArray(data?.marketDynamics?.demandDrivers)}
                      onSave={(v) => onFieldChange("marketDynamics.demandDrivers", v)}
                      renderPrefix={() => <Check className="h-4 w-4 text-[#6fa0ff]/80" />}
                    />
                  ) : (
                    <ul className="space-y-1">
                      {safeArray(data?.marketDynamics?.demandDrivers).map((item, i) => (
                        <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                      ))}
                    </ul>
                  )}
                </div>
              </FieldHighlightWrapper>
            )}
            {(safeArray(data?.marketDynamics?.buyingTriggers).length > 0 || isEditing) && (
              <FieldHighlightWrapper fieldPath="marketDynamics.buyingTriggers">
                <div>
                  <h4 className="text-[13px] font-medium text-[rgb(180,185,195)] mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#6fa0ff]" />
                    Buying Triggers
                  </h4>
                  {isEditing && onFieldChange ? (
                    <EditableList
                      items={safeArray(data?.marketDynamics?.buyingTriggers)}
                      onSave={(v) => onFieldChange("marketDynamics.buyingTriggers", v)}
                      renderPrefix={() => <Check className="h-4 w-4 text-[#6fa0ff]/80" />}
                    />
                  ) : (
                    <ul className="space-y-1">
                      {safeArray(data?.marketDynamics?.buyingTriggers).map((item, i) => (
                        <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                      ))}
                    </ul>
                  )}
                </div>
              </FieldHighlightWrapper>
            )}
          </div>

          {(safeArray(data?.marketDynamics?.barriersToPurchase).length > 0 || isEditing) && (
            <FieldHighlightWrapper fieldPath="marketDynamics.barriersToPurchase">
              <div className="mt-4">
                <h4 className="text-[13px] font-medium text-[rgb(180,185,195)] mb-2 flex items-center gap-2">
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
            </FieldHighlightWrapper>
          )}
        </SubSection>
      )}

      {/* Pain Points */}
      {(safeArray(data?.painPoints?.primary).length > 0 ||
        safeArray(data?.painPoints?.secondary).length > 0 ||
        isEditing) && (
        <SubSection title="Pain Points">
          <div className="grid md:grid-cols-2 gap-4">
            <FieldHighlightWrapper fieldPath="painPoints.primary">
              <div>
                <h4 className="text-[13px] font-medium text-[rgb(248,113,113)] mb-2">Primary Pain Points</h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(data?.painPoints?.primary)}
                    onSave={(v) => onFieldChange("painPoints.primary", v)}
                    renderPrefix={() => <Check className="h-4 w-4 text-[#6fa0ff]/80" />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {safeArray(data?.painPoints?.primary).map((item, i) => (
                      <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                    ))}
                  </ul>
                )}
              </div>
            </FieldHighlightWrapper>
            <FieldHighlightWrapper fieldPath="painPoints.secondary">
              <div>
                <h4 className="text-[13px] font-medium text-[rgb(252,211,77)] mb-2">Secondary Pain Points</h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={safeArray(data?.painPoints?.secondary)}
                    onSave={(v) => onFieldChange("painPoints.secondary", v)}
                    renderPrefix={() => <Check className="h-4 w-4 text-[#6fa0ff]/80" />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {safeArray(data?.painPoints?.secondary).map((item, i) => (
                      <ListItem key={i}><SourcedListItem>{item}</SourcedListItem></ListItem>
                    ))}
                  </ul>
                )}
              </div>
            </FieldHighlightWrapper>
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
                title={safeRender(driver?.driver)}
                fieldPath={`psychologicalDrivers.drivers[${i}]`}
              >
                {isEditing && onFieldChange ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-1 block">Driver</span>
                      <EditableText
                        value={safeRender(driver?.driver)}
                        onSave={(v) => onFieldChange(`psychologicalDrivers.drivers.${i}.driver`, v)}
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-1 block">Description</span>
                      <EditableText
                        value={safeRender(driver?.description)}
                        onSave={(v) => onFieldChange(`psychologicalDrivers.drivers.${i}.description`, v)}
                        multiline
                      />
                    </div>
                  </div>
                ) : (
                  <>{safeRender(driver?.description)}</>
                )}
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
                title={`"${safeRender(obj?.objection)}"`}
                fieldPath={`audienceObjections.objections[${i}]`}
              >
                {isEditing && onFieldChange ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-1 block">Objection</span>
                      <EditableText
                        value={safeRender(obj?.objection)}
                        onSave={(v) => onFieldChange(`audienceObjections.objections.${i}.objection`, v)}
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-1 block">Response</span>
                      <EditableText
                        value={safeRender(obj?.howToAddress)}
                        onSave={(v) => onFieldChange(`audienceObjections.objections.${i}.howToAddress`, v)}
                        multiline
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-[rgb(100,105,115)] text-[11px] font-semibold uppercase tracking-wider">Response: </span>
                    {safeRender(obj?.howToAddress)}
                  </>
                )}
              </InsightCard>
            ))}
          </div>
        </SubSection>
      )}

      {/* Key Recommendations */}
      {(safeArray(data?.messagingOpportunities?.summaryRecommendations).length > 0 || isEditing) && (
        <SubSection title="Key Recommendations">
          <HighlightBlock>
            <FieldHighlightWrapper fieldPath="messagingOpportunities.summaryRecommendations">
              {isEditing && onFieldChange ? (
                <EditableList
                  items={safeArray(data?.messagingOpportunities?.summaryRecommendations)}
                  onSave={(v) => onFieldChange("messagingOpportunities.summaryRecommendations", v)}
                  renderPrefix={() => <Check className="h-4 w-4 text-[#6fa0ff]/80" />}
                />
              ) : (
                <ul className="space-y-1">
                  {safeArray(data?.messagingOpportunities?.summaryRecommendations).map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
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
