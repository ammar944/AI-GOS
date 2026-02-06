"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  Info,
  CheckSquare,
  Square,
} from "lucide-react";
import type { CompanyResearchOutput, ResearchedField } from "@/lib/company-intel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrefillSummaryProps {
  /** The completed research result */
  result: CompanyResearchOutput;
  /** Called when user accepts selected fields */
  onAcceptSelected: (selectedFields: Set<string>) => void;
  /** Called to dismiss */
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  companyName: "Company Name",
  industry: "Industry",
  targetCustomers: "Target Customers",
  targetJobTitles: "Target Job Titles",
  companySize: "Company Size",
  headquartersLocation: "Headquarters",
  productDescription: "Product Description",
  coreFeatures: "Core Features",
  valueProposition: "Value Proposition",
  pricing: "Pricing",
  competitors: "Competitors",
  uniqueDifferentiator: "Unique Edge",
  marketProblem: "Market Problem",
  customerTransformation: "Customer Transformation",
  commonObjections: "Common Objections",
  brandPositioning: "Brand Positioning",
  testimonialQuote: "Testimonial",
  caseStudiesUrl: "Case Studies URL",
  testimonialsUrl: "Testimonials URL",
  pricingUrl: "Pricing URL",
  demoUrl: "Demo/Trial URL",
};

interface FieldGroup {
  label: string;
  fields: string[];
}

const FIELD_GROUPS: FieldGroup[] = [
  { label: "Business Basics", fields: ["companyName"] },
  {
    label: "Ideal Customer",
    fields: ["industry", "targetCustomers", "targetJobTitles", "companySize", "headquartersLocation"],
  },
  {
    label: "Product & Offer",
    fields: ["productDescription", "coreFeatures", "valueProposition", "pricing"],
  },
  {
    label: "Market & Competition",
    fields: ["competitors", "uniqueDifferentiator", "marketProblem"],
  },
  {
    label: "Customer Journey",
    fields: ["customerTransformation", "commonObjections"],
  },
  {
    label: "Brand & Positioning",
    fields: ["brandPositioning", "testimonialQuote"],
  },
  {
    label: "Assets",
    fields: ["caseStudiesUrl", "testimonialsUrl", "pricingUrl", "demoUrl"],
  },
];

// All field keys (excludes confidenceNotes which is a plain string, not a ResearchedField)
const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap((g) => g.fields);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfidenceBadge(confidence: number) {
  if (confidence >= 90) return { label: "High", color: "rgb(34, 197, 94)", bg: "rgba(34, 197, 94, 0.15)" };
  if (confidence >= 50) return { label: "Medium", color: "rgb(250, 204, 21)", bg: "rgba(250, 204, 21, 0.15)" };
  return { label: "Low", color: "rgb(239, 68, 68)", bg: "rgba(239, 68, 68, 0.15)" };
}

function truncateValue(value: string, max = 80): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + "\u2026";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const badge = getConfidenceBadge(confidence);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: badge.bg, color: badge.color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: badge.color }}
      />
      {badge.label}
    </span>
  );
}

function FieldRow({
  fieldKey,
  field,
  checked,
  onToggle,
}: {
  fieldKey: string;
  field: ResearchedField;
  checked: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (field.value === null) return null;

  return (
    <div
      className="group rounded-md px-2.5 py-2 transition-colors"
      style={{ background: checked ? "rgba(255, 255, 255, 0.03)" : "transparent" }}
    >
      {/* Main row */}
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-shrink-0 mt-0.5 transition-colors"
          style={{ color: checked ? "rgb(34, 197, 94)" : "rgb(100, 105, 115)" }}
          aria-label={checked ? `Deselect ${FIELD_LABELS[fieldKey]}` : `Select ${FIELD_LABELS[fieldKey]}`}
        >
          {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-medium" style={{ color: "rgb(155, 160, 170)" }}>
              {FIELD_LABELS[fieldKey] ?? fieldKey}
            </span>
            <ConfidenceBadge confidence={field.confidence} />
            {field.sourceUrl && (
              <a
                href={field.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 transition-opacity opacity-50 hover:opacity-100"
                style={{ color: "rgb(155, 160, 170)" }}
                title={field.sourceUrl}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: "rgb(252, 252, 250)" }}>
            {truncateValue(field.value)}
          </p>

          {/* Reasoning toggle */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-1 text-[11px] transition-colors hover:underline"
            style={{ color: "rgb(100, 105, 115)" }}
          >
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronDown className="h-3 w-3" />
            </motion.div>
            {expanded ? "Hide reasoning" : "Why this value?"}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[12px] mt-1 overflow-hidden"
                style={{ color: "rgb(130, 135, 145)" }}
              >
                {field.reasoning}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PrefillSummary({ result, onAcceptSelected, onDismiss }: PrefillSummaryProps) {
  // Build the set of field keys that have a non-null value
  const foundFields = useMemo(() => {
    const found: string[] = [];
    for (const key of ALL_FIELD_KEYS) {
      const field = result[key as keyof CompanyResearchOutput] as ResearchedField | undefined;
      if (field && field.value !== null) {
        found.push(key);
      }
    }
    return found;
  }, [result]);

  // Default selection: confidence >= 50
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const key of foundFields) {
      const field = result[key as keyof CompanyResearchOutput] as ResearchedField;
      if (field.confidence >= 50) {
        initial.add(key);
      }
    }
    return initial;
  });

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

  const totalFields = ALL_FIELD_KEYS.length;

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
          <h4 className="text-[14px] font-medium" style={{ color: "rgb(252, 252, 250)" }}>
            AI Research Complete
          </h4>
          <p className="text-[13px] mt-0.5" style={{ color: "rgb(155, 160, 170)" }}>
            Found{" "}
            <strong style={{ color: "rgb(34, 197, 94)" }}>{foundFields.length}</strong>{" "}
            of {totalFields} fields
            {totalFields - foundFields.length > 0 && (
              <span>
                {" "}
                &middot; {totalFields - foundFields.length} need manual entry
              </span>
            )}
          </p>
        </div>

        {/* Dismiss */}
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
          // Only show groups that have at least one found field
          const groupFoundFields = group.fields.filter((key) => {
            const field = result[key as keyof CompanyResearchOutput] as ResearchedField | undefined;
            return field && field.value !== null;
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
                  const field = result[key as keyof CompanyResearchOutput] as ResearchedField;
                  return (
                    <FieldRow
                      key={key}
                      fieldKey={key}
                      field={field}
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
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "rgb(54, 94, 255)" }} />
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
