"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  CheckCircle,
  CheckSquare,
  Square,
  FileText,
} from "lucide-react";
import type { DocumentExtractionOutput } from "@/lib/company-intel/document-extraction-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentPrefillSummaryProps {
  result: DocumentExtractionOutput;
  documentType: "niche_demographic" | "client_briefing";
  onAcceptSelected: (selectedFields: Set<string>) => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  businessName: "Business Name",
  websiteUrl: "Website URL",
  primaryIcpDescription: "ICP Description",
  industryVertical: "Industry / Vertical",
  jobTitles: "Target Job Titles",
  companySize: "Company Size",
  geography: "Geography",
  easiestToClose: "Easiest to Close",
  buyingTriggers: "Buying Triggers",
  bestClientSources: "Best Client Sources",
  secondaryIcp: "Secondary ICP",
  systemsPlatforms: "Systems & Platforms",
  productDescription: "Product Description",
  coreDeliverables: "Core Deliverables",
  pricingTiers: "Pricing Tiers",
  pricingModel: "Pricing Model",
  valueProp: "Value Proposition",
  guarantees: "Guarantees",
  currentFunnelType: "Funnel Type",
  topCompetitors: "Top Competitors",
  uniqueEdge: "Unique Edge",
  competitorFrustrations: "Competitor Frustrations",
  marketBottlenecks: "Market Bottlenecks",
  proprietaryTech: "Proprietary Tech",
  situationBeforeBuying: "Before Buying",
  desiredTransformation: "Desired Transformation",
  commonObjections: "Common Objections",
  salesCycleLength: "Sales Cycle Length",
  salesProcessOverview: "Sales Process",
  brandPositioning: "Brand Positioning",
  customerVoice: "Customer Voice",
  salesDeckUrl: "Sales Deck URL",
  productDemoUrl: "Product Demo URL",
  caseStudiesUrl: "Case Studies URL",
  testimonialsUrl: "Testimonials URL",
  landingPageUrl: "Landing Page URL",
  existingAdsUrl: "Existing Ads URL",
  brandGuidelinesUrl: "Brand Guidelines URL",
  monthlyAdBudget: "Monthly Ad Budget",
  dailyBudgetCeiling: "Daily Budget Ceiling",
  campaignDuration: "Campaign Duration",
  targetCpl: "Target CPL",
  targetCac: "Target CAC",
  targetSqlsPerMonth: "Target SQLs/Month",
  targetDemosPerMonth: "Target Demos/Month",
  topicsToAvoid: "Topics to Avoid",
  claimRestrictions: "Claim Restrictions",
};

interface FieldGroup {
  label: string;
  fields: string[];
}

const FIELD_GROUPS: FieldGroup[] = [
  { label: "Business Basics", fields: ["businessName", "websiteUrl"] },
  {
    label: "Ideal Customer",
    fields: [
      "primaryIcpDescription", "industryVertical", "jobTitles", "companySize",
      "geography", "easiestToClose", "buyingTriggers", "bestClientSources",
      "secondaryIcp", "systemsPlatforms",
    ],
  },
  {
    label: "Product & Offer",
    fields: [
      "productDescription", "coreDeliverables", "pricingTiers", "pricingModel",
      "valueProp", "guarantees", "currentFunnelType",
    ],
  },
  {
    label: "Market & Competition",
    fields: [
      "topCompetitors", "uniqueEdge", "competitorFrustrations",
      "marketBottlenecks", "proprietaryTech",
    ],
  },
  {
    label: "Customer Journey",
    fields: [
      "situationBeforeBuying", "desiredTransformation", "commonObjections",
      "salesCycleLength", "salesProcessOverview",
    ],
  },
  {
    label: "Brand & Positioning",
    fields: ["brandPositioning", "customerVoice"],
  },
  {
    label: "Assets & Proof",
    fields: [
      "salesDeckUrl", "productDemoUrl", "caseStudiesUrl", "testimonialsUrl",
      "landingPageUrl", "existingAdsUrl", "brandGuidelinesUrl",
    ],
  },
  {
    label: "Budget & Targets",
    fields: [
      "monthlyAdBudget", "dailyBudgetCeiling", "campaignDuration",
      "targetCpl", "targetCac", "targetSqlsPerMonth", "targetDemosPerMonth",
    ],
  },
  {
    label: "Compliance",
    fields: ["topicsToAvoid", "claimRestrictions"],
  },
];

const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap((g) => g.fields);

const DOC_TYPE_LABELS: Record<string, string> = {
  niche_demographic: "Niche & Demographic",
  client_briefing: "Client Briefing",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateValue(value: string, max = 100): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + "\u2026";
}

/** Format pipe-separated pricing tiers into readable string */
function formatPricingTiers(value: string): string {
  return value
    .split('|')
    .map(entry => {
      const parts = entry.trim().split(':');
      if (parts.length < 3) return entry.trim();
      const name = parts[0].trim();
      const price = parts[1].trim();
      const cycle = parts[2].trim().replace(/_/g, ' ');
      return `${name}: $${price}/${cycle}`;
    })
    .join(', ');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldRow({
  fieldKey,
  value,
  checked,
  onToggle,
}: {
  fieldKey: string;
  value: string;
  checked: boolean;
  onToggle: () => void;
}) {
  if (!value) return null;

  return (
    <div
      className="group rounded-md px-2.5 py-2 transition-colors"
      style={{ background: checked ? "rgba(255, 255, 255, 0.03)" : "transparent" }}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex-shrink-0 mt-0.5 transition-colors"
          style={{ color: checked ? "rgb(34, 197, 94)" : "rgb(100, 105, 115)" }}
          aria-label={checked ? `Deselect ${FIELD_LABELS[fieldKey]}` : `Select ${FIELD_LABELS[fieldKey]}`}
        >
          {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-medium" style={{ color: "rgb(155, 160, 170)" }}>
            {FIELD_LABELS[fieldKey] ?? fieldKey}
          </span>
          <p className="text-[13px] mt-0.5" style={{ color: "rgb(252, 252, 250)" }}>
            {truncateValue(fieldKey === 'pricingTiers' ? formatPricingTiers(value) : value)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DocumentPrefillSummary({
  result,
  documentType,
  onAcceptSelected,
  onDismiss,
}: DocumentPrefillSummaryProps) {
  // Flat schema: each field is a string. Non-empty = found.
  const foundFields = useMemo(() => {
    const found: string[] = [];
    for (const key of ALL_FIELD_KEYS) {
      const val = result[key as keyof DocumentExtractionOutput];
      if (typeof val === 'string' && val !== '') {
        found.push(key);
      }
    }
    return found;
  }, [result]);

  // Default: select all found fields (no confidence filtering with flat schema)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(foundFields));

  const allSelected = selected.size === foundFields.length;

  const toggleField = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(foundFields));
    }
  }, [allSelected, foundFields]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-lg"
      style={{
        background: "rgba(34, 197, 94, 0.06)",
        border: "1px solid rgba(34, 197, 94, 0.25)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-2">
        <div
          className="flex-shrink-0 p-1.5 rounded-full"
          style={{ background: "rgba(34, 197, 94, 0.2)" }}
        >
          <CheckCircle className="h-4 w-4" style={{ color: "rgb(34, 197, 94)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[14px] font-medium" style={{ color: "rgb(252, 252, 250)" }}>
              Document Extraction Complete
            </h4>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(54, 94, 255, 0.15)", color: "rgb(54, 94, 255)" }}
            >
              <FileText className="h-3 w-3" />
              {DOC_TYPE_LABELS[documentType]}
            </span>
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: "rgb(155, 160, 170)" }}>
            Found{" "}
            <strong style={{ color: "rgb(34, 197, 94)" }}>{foundFields.length}</strong>{" "}
            of {ALL_FIELD_KEYS.length} fields
            {ALL_FIELD_KEYS.length - foundFields.length > 0 && (
              <span>
                {" "}
                &middot; {ALL_FIELD_KEYS.length - foundFields.length} not in document
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-white/10"
          style={{ color: "rgb(100, 105, 115)" }}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Select All / Deselect All */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:underline"
          style={{ color: "rgb(155, 160, 170)" }}
        >
          {allSelected ? (
            <CheckSquare className="h-3.5 w-3.5" style={{ color: "rgb(34, 197, 94)" }} />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          {allSelected ? "Deselect All" : "Select All"}
        </button>
        <span className="text-[12px]" style={{ color: "rgb(100, 105, 115)" }}>
          {selected.size} of {foundFields.length} fields selected
        </span>
      </div>

      {/* Scrollable field list */}
      <div className="max-h-[360px] overflow-y-auto px-3 py-2 space-y-3 custom-scrollbar">
        {FIELD_GROUPS.map((group) => {
          const groupFoundFields = group.fields.filter((key) => {
            const val = result[key as keyof DocumentExtractionOutput];
            return typeof val === 'string' && val !== '';
          });
          if (groupFoundFields.length === 0) return null;

          return (
            <div key={group.label}>
              <p
                className="text-[11px] font-semibold uppercase tracking-wider px-2.5 mb-1.5"
                style={{ color: "rgb(100, 105, 115)" }}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {groupFoundFields.map((key) => {
                  const val = result[key as keyof DocumentExtractionOutput] as string;
                  return (
                    <FieldRow
                      key={key}
                      fieldKey={key}
                      value={val}
                      checked={selected.has(key)}
                      onToggle={() => toggleField(key)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confidence Notes */}
      {result.confidenceNotes && (
        <div
          className="flex items-start gap-2 mx-4 mt-1 mb-3 p-2.5 rounded-md"
          style={{ background: "rgba(54, 94, 255, 0.08)", border: "1px solid rgba(54, 94, 255, 0.2)" }}
        >
          <FileText className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "rgb(54, 94, 255)" }} />
          <p className="text-[12px]" style={{ color: "rgb(155, 160, 170)" }}>
            {result.confidenceNotes}
          </p>
        </div>
      )}

      {/* Accept button */}
      <div
        className="px-4 py-3"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <button
          type="button"
          onClick={() => onAcceptSelected(selected)}
          disabled={selected.size === 0}
          className="w-full py-2.5 px-4 rounded-lg text-[14px] font-medium transition-all"
          style={{
            background:
              selected.size === 0
                ? "rgba(34, 197, 94, 0.15)"
                : "linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(22, 163, 74) 100%)",
            color: selected.size === 0 ? "rgb(100, 105, 115)" : "#ffffff",
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
          }}
        >
          Accept {selected.size} Selected Field{selected.size !== 1 ? "s" : ""}
        </button>
      </div>
    </motion.div>
  );
}
