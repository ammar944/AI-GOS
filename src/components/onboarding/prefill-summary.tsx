"use client";

import { motion } from "framer-motion";
import { X, CheckCircle, AlertTriangle, ExternalLink, FileText } from "lucide-react";
import type { PrefillOnboardingResponse, DataSource } from "@/lib/company-intel";

interface PrefillSummaryProps {
  result: PrefillOnboardingResponse;
  onDismiss: () => void;
}

const sourceLabels: Record<DataSource, string> = {
  website: "Company Website",
  linkedin: "LinkedIn",
  search: "Web Search",
  multiple: "Multiple Sources",
};

export function PrefillSummary({ result, onDismiss }: PrefillSummaryProps) {
  const { summary, citations, warnings } = result;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-lg p-4"
      style={{
        background: "rgba(34, 197, 94, 0.08)",
        border: "1px solid rgba(34, 197, 94, 0.3)",
      }}
    >
      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-md transition-colors hover:bg-white/10"
        style={{ color: "rgb(100, 105, 115)" }}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 pr-8">
        <div
          className="flex-shrink-0 p-1.5 rounded-full"
          style={{ background: "rgba(34, 197, 94, 0.2)" }}
        >
          <CheckCircle className="h-4 w-4" style={{ color: "rgb(34, 197, 94)" }} />
        </div>
        <div className="space-y-1">
          <h4
            className="text-[14px] font-medium"
            style={{ color: "rgb(252, 252, 250)" }}
          >
            AI Research Complete
          </h4>
          <p className="text-[13px]" style={{ color: "rgb(155, 160, 170)" }}>
            Found <strong style={{ color: "rgb(34, 197, 94)" }}>{summary.fieldsFound}</strong> fields
            {summary.fieldsMissing > 0 && (
              <> · <span>{summary.fieldsMissing} fields need manual entry</span></>
            )}
            {summary.primarySource && (
              <> · Primary source: {sourceLabels[summary.primarySource]}</>
            )}
          </p>
        </div>
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {warnings.map((warning, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-[12px]"
              style={{ color: "rgb(250, 204, 21)" }}
            >
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Citations */}
      {citations.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="h-3.5 w-3.5" style={{ color: "rgb(100, 105, 115)" }} />
            <span className="text-[12px] font-medium" style={{ color: "rgb(100, 105, 115)" }}>
              Sources ({citations.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {citations.slice(0, 4).map((citation, idx) => (
              <a
                key={idx}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded transition-colors"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "rgb(155, 160, 170)",
                }}
                title={citation.title || citation.url}
              >
                <span className="max-w-[120px] truncate">
                  {citation.title || new URL(citation.url).hostname}
                </span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ))}
            {citations.length > 4 && (
              <span
                className="text-[12px] px-2 py-1"
                style={{ color: "rgb(100, 105, 115)" }}
              >
                +{citations.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
