"use client";

import * as React from "react";
import type { KPITarget } from "@/lib/media-plan/types";
import {
  SubSection,
  KPITable,
  type EditingProps,
} from "./shared";

export function KPITargetsContent({
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
