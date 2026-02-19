"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileUp,
  FileText,
  ClipboardList,
  Check,
  AlertCircle,
  ChevronDown,
  Square,
  Loader2,
  Minus,
} from "lucide-react";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { DocumentPrefillSummary } from "./document-prefill-summary";
import { useDocumentExtraction } from "@/hooks/use-document-extraction";
import {
  DOCUMENT_TYPE_CONFIG,
  ACCEPTED_FILE_EXTENSIONS,
  type DocumentType,
} from "@/lib/company-intel/document-types";
import type { DocumentExtractionOutput } from "@/lib/company-intel/document-extraction-schema";
import type { OnboardingFormData } from "@/lib/onboarding/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelState = "collapsed" | "expanded" | "extracting" | "success" | "error";

interface DocumentUploadPanelProps {
  onPrefillComplete: (data: Partial<OnboardingFormData>) => void;
}

// ---------------------------------------------------------------------------
// Field label + group config (shared between live view and summary)
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  businessName: "Business Name",
  websiteUrl: "Website URL",
  primaryIcpDescription: "ICP Description",
  industryVertical: "Industry",
  jobTitles: "Job Titles",
  companySize: "Company Size",
  geography: "Geography",
  easiestToClose: "Easiest to Close",
  buyingTriggers: "Buying Triggers",
  bestClientSources: "Client Sources",
  secondaryIcp: "Secondary ICP",
  systemsPlatforms: "Systems & Platforms",
  productDescription: "Product Description",
  coreDeliverables: "Core Deliverables",
  offerPrice: "Offer Price",
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
  desiredTransformation: "Transformation",
  commonObjections: "Objections",
  salesCycleLength: "Sales Cycle",
  salesProcessOverview: "Sales Process",
  brandPositioning: "Brand Positioning",
  customerVoice: "Customer Voice",
  salesDeckUrl: "Sales Deck URL",
  productDemoUrl: "Demo URL",
  caseStudiesUrl: "Case Studies URL",
  testimonialsUrl: "Testimonials URL",
  landingPageUrl: "Landing Page URL",
  existingAdsUrl: "Existing Ads URL",
  brandGuidelinesUrl: "Brand Guidelines URL",
  monthlyAdBudget: "Monthly Budget",
  dailyBudgetCeiling: "Daily Ceiling",
  campaignDuration: "Campaign Duration",
  targetCpl: "Target CPL",
  targetCac: "Target CAC",
  targetSqlsPerMonth: "Target SQLs",
  targetDemosPerMonth: "Target Demos",
  topicsToAvoid: "Topics to Avoid",
  claimRestrictions: "Claim Restrictions",
};

interface FieldGroup {
  label: string;
  icon: string;
  fields: string[];
}

const FIELD_GROUPS: FieldGroup[] = [
  { label: "Business Basics", icon: "🏢", fields: ["businessName", "websiteUrl"] },
  {
    label: "Ideal Customer",
    icon: "👥",
    fields: [
      "primaryIcpDescription", "industryVertical", "jobTitles", "companySize",
      "geography", "easiestToClose", "buyingTriggers", "bestClientSources",
      "secondaryIcp", "systemsPlatforms",
    ],
  },
  {
    label: "Product & Offer",
    icon: "📦",
    fields: [
      "productDescription", "coreDeliverables", "offerPrice", "pricingModel",
      "valueProp", "guarantees", "currentFunnelType",
    ],
  },
  {
    label: "Market & Competition",
    icon: "📊",
    fields: [
      "topCompetitors", "uniqueEdge", "competitorFrustrations",
      "marketBottlenecks", "proprietaryTech",
    ],
  },
  {
    label: "Customer Journey",
    icon: "🛤️",
    fields: [
      "situationBeforeBuying", "desiredTransformation", "commonObjections",
      "salesCycleLength", "salesProcessOverview",
    ],
  },
  { label: "Brand & Positioning", icon: "✨", fields: ["brandPositioning", "customerVoice"] },
  {
    label: "Assets & Proof",
    icon: "📎",
    fields: [
      "salesDeckUrl", "productDemoUrl", "caseStudiesUrl", "testimonialsUrl",
      "landingPageUrl", "existingAdsUrl", "brandGuidelinesUrl",
    ],
  },
  {
    label: "Budget & Targets",
    icon: "🎯",
    fields: [
      "monthlyAdBudget", "dailyBudgetCeiling", "campaignDuration",
      "targetCpl", "targetCac", "targetSqlsPerMonth", "targetDemosPerMonth",
    ],
  },
  { label: "Compliance", icon: "🛡️", fields: ["topicsToAvoid", "claimRestrictions"] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtBadge(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? '';
}

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  return map[ext ?? ''] ?? 'application/octet-stream';
}

// With flat schema, partial result values are strings or undefined (during streaming)

// ---------------------------------------------------------------------------
// Live Extraction View — shows grouped fields streaming in real-time
// ---------------------------------------------------------------------------

function LiveExtractionView({
  partialResult,
  fieldsFound,
  totalFields,
  selectedFile,
  activeDocType,
  isLoading,
  onStop,
}: {
  partialResult: Record<string, string | undefined> | undefined;
  fieldsFound: number;
  totalFields: number;
  selectedFile: File | null;
  activeDocType: DocumentType | null;
  isLoading: boolean;
  onStop: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute per-group stats (flat schema: values are strings directly)
  const groupStats = useMemo(() => {
    return FIELD_GROUPS.map((group) => {
      let found = 0;
      for (const key of group.fields) {
        const val = partialResult?.[key];
        if (typeof val === 'string' && val !== '') found++;
      }
      return { found, total: group.fields.length };
    });
  }, [partialResult]);

  const progress = totalFields > 0 ? (fieldsFound / totalFields) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg overflow-hidden"
      style={{
        background: "rgba(139, 92, 246, 0.04)",
        border: "1px solid rgba(139, 92, 246, 0.2)",
      }}
    >
      {/* Header bar: file info + progress + stop */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(139, 92, 246, 0.15)" }}
      >
        {/* File badge */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0"
            style={{ background: "rgba(139, 92, 246, 0.15)" }}
          >
            <Loader2
              className="h-4 w-4 animate-spin"
              style={{ color: "rgb(139, 92, 246)" }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {selectedFile && (
                <>
                  <span
                    className="text-[10px] font-semibold px-1 py-0.5 rounded flex-shrink-0"
                    style={{ background: "rgba(139, 92, 246, 0.15)", color: "rgb(139, 92, 246)" }}
                  >
                    {getFileExtBadge(selectedFile.name)}
                  </span>
                  <span
                    className="text-[13px] font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {selectedFile.name}
                  </span>
                  <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                    ({formatFileSize(selectedFile.size)})
                  </span>
                </>
              )}
            </div>
            <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {activeDocType ? DOCUMENT_TYPE_CONFIG[activeDocType].label : "Document"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[18px] font-bold leading-none" style={{ color: "rgb(139, 92, 246)" }}>
              {fieldsFound}
              <span className="text-[12px] font-normal" style={{ color: "var(--text-tertiary)" }}>
                /{totalFields}
              </span>
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              fields found
            </p>
          </div>
          {isLoading && (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                color: "var(--text-secondary)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1" style={{ background: "rgba(139, 92, 246, 0.1)" }}>
        {fieldsFound === 0 ? (
          <motion.div
            className="h-full"
            style={{
              width: "30%",
              background: "linear-gradient(90deg, transparent, rgb(139, 92, 246), transparent)",
            }}
            animate={{ x: ["-100%", "400%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : (
          <motion.div
            className="h-full"
            style={{
              background: "linear-gradient(90deg, rgb(139, 92, 246), rgb(109, 40, 217))",
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        )}
      </div>

      {/* Grouped field grid */}
      <div
        ref={scrollRef}
        className="max-h-[420px] overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar"
      >
        {FIELD_GROUPS.map((group, gi) => {
          const stats = groupStats[gi];
          const hasAnyData = stats.found > 0;

          return (
            <div key={group.label}>
              {/* Group header */}
              <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                <span className="text-[13px]">{group.icon}</span>
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: hasAnyData ? "rgb(139, 92, 246)" : "var(--text-tertiary)" }}
                >
                  {group.label}
                </span>
                <span
                  className="text-[11px] ml-auto"
                  style={{
                    color: hasAnyData ? "rgb(139, 92, 246)" : "var(--text-tertiary)",
                  }}
                >
                  {stats.found}/{stats.total}
                </span>
              </div>

              {/* Fields */}
              <div className="space-y-0.5">
                {group.fields.map((key) => {
                  const val = partialResult?.[key];
                  // Flat schema: val is string (or undefined during streaming)
                  const hasValue = typeof val === 'string' && val !== '';
                  // Field streamed but empty = not in document
                  const isNotFound = val === '';

                  return (
                    <motion.div
                      key={key}
                      layout
                      className="flex items-start gap-2 py-1.5 px-2 rounded-md"
                      style={{
                        background: hasValue
                          ? "rgba(34, 197, 94, 0.05)"
                          : "transparent",
                      }}
                    >
                      {/* Status icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {hasValue ? (
                          <Check
                            className="h-3.5 w-3.5"
                            style={{ color: "rgb(34, 197, 94)" }}
                          />
                        ) : isNotFound ? (
                          <Minus
                            className="h-3.5 w-3.5"
                            style={{ color: "rgb(100, 105, 115)" }}
                          />
                        ) : (
                          <div
                            className="h-3.5 w-3.5 rounded-sm"
                            style={{ border: "1px dashed rgba(255,255,255,0.1)" }}
                          />
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className="text-[12px] font-medium flex-shrink-0 w-[120px]"
                        style={{
                          color: hasValue
                            ? "var(--text-secondary)"
                            : "var(--text-tertiary)",
                        }}
                      >
                        {FIELD_LABELS[key] || key}
                      </span>

                      {/* Value or placeholder */}
                      <div className="flex-1 min-w-0">
                        {hasValue ? (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="text-[12px] leading-relaxed"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {val.length > 100
                              ? val.slice(0, 100) + "\u2026"
                              : val}
                          </motion.p>
                        ) : isNotFound ? (
                          <span className="text-[11px] italic" style={{ color: "rgb(80, 84, 92)" }}>
                            Not in document
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: "rgb(60, 64, 72)" }}>
                            Waiting...
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Upload Zone Sub-component
// ---------------------------------------------------------------------------

interface UploadZoneProps {
  docType: DocumentType;
  icon: React.ReactNode;
  selectedFile: File | null;
  onFileSelect: (file: File, docType: DocumentType) => void;
  disabled: boolean;
}

function UploadZone({ docType, icon, selectedFile, onFileSelect, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const config = DOCUMENT_TYPE_CONFIG[docType];

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file, docType);
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="w-full rounded-lg p-4 text-center transition-all cursor-pointer"
        style={{
          background: selectedFile ? "rgba(34, 197, 94, 0.08)" : "rgba(255, 255, 255, 0.02)",
          border: `1px dashed ${selectedFile ? "rgba(34, 197, 94, 0.4)" : "rgba(255, 255, 255, 0.1)"}`,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              background: selectedFile ? "rgba(34, 197, 94, 0.15)" : "rgba(54, 94, 255, 0.1)",
              color: selectedFile ? "rgb(34, 197, 94)" : "rgb(54, 94, 255)",
            }}
          >
            {selectedFile ? <Check className="h-5 w-5" /> : icon}
          </div>
          <div>
            <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              {config.label}
            </p>
            {selectedFile ? (
              <div className="flex items-center gap-1.5 mt-1 justify-center">
                <span
                  className="text-[10px] font-semibold px-1 py-0.5 rounded"
                  style={{ background: "rgba(54, 94, 255, 0.15)", color: "rgb(54, 94, 255)" }}
                >
                  {getFileExtBadge(selectedFile.name)}
                </span>
                <span className="text-[12px] truncate max-w-[140px]" style={{ color: "var(--text-secondary)" }}>
                  {selectedFile.name}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  ({formatFileSize(selectedFile.size)})
                </span>
              </div>
            ) : (
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                PDF, DOCX, or TXT
              </p>
            )}
          </div>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_EXTENSIONS}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DocumentUploadPanel({ onPrefillComplete }: DocumentUploadPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("collapsed");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeDocType, setActiveDocType] = useState<DocumentType | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<DocumentExtractionOutput | null>(null);

  const {
    partialResult,
    submit,
    isLoading,
    error: hookError,
    stop,
    fieldsFound,
    totalFields,
    mapToFormData,
  } = useDocumentExtraction();

  const isExpanded = panelState !== "collapsed";
  const isExtracting = panelState === "extracting";

  // ---- Detect extraction completion ---------------------------------------

  const prevLoading = useRef(isLoading);
  useEffect(() => {
    // Transition: loading → done
    if (prevLoading.current && !isLoading) {
      if (hookError) {
        console.error('[DocumentUploadPanel] Extraction error:', hookError);
        setPanelState("error");
      } else if (partialResult && fieldsFound > 0) {
        setCompletedResult(partialResult as DocumentExtractionOutput);
        setPanelState("success");
      } else {
        // Dead state: loading ended with no error but also no results.
        // This happens when the AI SDK's textStream silently drops stream errors.
        console.warn('[DocumentUploadPanel] Extraction ended with no data — likely a swallowed API error. Check server logs.');
        setPanelState("error");
        setValidationError("Extraction failed — the AI service may be unavailable. Check server terminal for details.");
      }
    }
    prevLoading.current = isLoading;
  }, [isLoading, hookError, partialResult, fieldsFound]);

  // Handle late-arriving hookError (finishError set after isLoading goes false due to async validation)
  useEffect(() => {
    if (hookError && panelState === "extracting") {
      console.error('[DocumentUploadPanel] Late error arrived:', hookError);
      setPanelState("error");
    }
  }, [hookError, panelState]);

  // ---- Toggle panel -------------------------------------------------------

  const togglePanel = useCallback(() => {
    if (panelState === "collapsed") {
      setPanelState("expanded");
      setValidationError(null);
    } else if (!isExtracting) {
      setPanelState("collapsed");
      setValidationError(null);
      setSelectedFile(null);
      setActiveDocType(null);
      setCompletedResult(null);
    }
  }, [panelState, isExtracting]);

  // ---- File selection -----------------------------------------------------

  const handleFileSelect = useCallback((file: File, docType: DocumentType) => {
    const config = DOCUMENT_TYPE_CONFIG[docType];
    setValidationError(null);

    if (file.size > config.maxFileSizeBytes) {
      const maxMB = (config.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
      setValidationError(`File too large (${formatFileSize(file.size)}). Maximum: ${maxMB}MB`);
      return;
    }

    if (!config.acceptedMimeTypes.includes(file.type) && file.type !== '') {
      setValidationError(`Unsupported file type. Accepted: ${config.acceptedExtensions.join(', ')}`);
      return;
    }

    setSelectedFile(file);
    setActiveDocType(docType);
  }, []);

  // ---- Start extraction ---------------------------------------------------

  const handleExtract = useCallback(() => {
    if (!selectedFile || !activeDocType) return;
    setValidationError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        setValidationError("Failed to read file");
        return;
      }

      setPanelState("extracting");
      submit({
        fileName: selectedFile.name,
        mimeType: inferMimeType(selectedFile),
        fileBase64: base64,
        documentType: activeDocType,
      });
    };
    reader.onerror = () => {
      setValidationError("Failed to read file");
    };
    reader.readAsDataURL(selectedFile);
  }, [selectedFile, activeDocType, submit]);

  // ---- Stop extraction ----------------------------------------------------

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  // ---- Dismiss result -----------------------------------------------------

  const handleDismissResult = useCallback(() => {
    setCompletedResult(null);
    setSelectedFile(null);
    setActiveDocType(null);
    setPanelState("collapsed");
  }, []);

  // ---- Accept selected fields ---------------------------------------------

  const handleAcceptSelected = useCallback(
    (selectedFields: Set<string>) => {
      const formData = mapToFormData(selectedFields);
      if (!formData) return;

      onPrefillComplete(formData);
      setCompletedResult(null);
      setSelectedFile(null);
      setActiveDocType(null);
      setPanelState("collapsed");
    },
    [mapToFormData, onPrefillComplete],
  );

  // ---- Displayed error ----------------------------------------------------

  const displayError = validationError || (hookError ? hookError.message : null);

  return (
    <div className="space-y-3">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={togglePanel}
        disabled={isExtracting}
        className="w-full rounded-lg p-4 text-left transition-all duration-200"
        style={{
          background: isExpanded
            ? "rgba(139, 92, 246, 0.1)"
            : "rgba(139, 92, 246, 0.05)",
          border: `1px solid ${
            isExpanded ? "rgba(139, 92, 246, 0.4)" : "rgba(139, 92, 246, 0.2)"
          }`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: "rgba(139, 92, 246, 0.15)",
                color: "rgb(139, 92, 246)",
              }}
            >
              <FileUp className="h-4 w-4" />
            </div>
            <div>
              <p
                className="text-[14px] font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Auto-Fill from Documents
              </p>
              <p
                className="text-[13px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Upload your niche doc or briefing sheet to pre-fill fields
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ color: "rgb(139, 92, 246)" }}
          >
            <ChevronDown className="h-5 w-5" />
          </motion.div>
        </div>
      </button>

      {/* Expanded Content — upload zones + extract button (only in expanded/error states) */}
      <AnimatePresence>
        {(panelState === "expanded" || panelState === "error") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-lg p-4 space-y-4"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-default)",
              }}
            >
              {/* Upload Zones */}
              <div className="flex gap-3">
                <UploadZone
                  docType="niche_demographic"
                  icon={<FileText className="h-5 w-5" />}
                  selectedFile={activeDocType === "niche_demographic" ? selectedFile : null}
                  onFileSelect={handleFileSelect}
                  disabled={false}
                />
                <UploadZone
                  docType="client_briefing"
                  icon={<ClipboardList className="h-5 w-5" />}
                  selectedFile={activeDocType === "client_briefing" ? selectedFile : null}
                  onFileSelect={handleFileSelect}
                  disabled={false}
                />
              </div>

              {/* Error Message */}
              {displayError && (
                <div
                  className="flex items-start gap-2 p-3 rounded-lg"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <AlertCircle
                    className="h-4 w-4 flex-shrink-0 mt-0.5"
                    style={{ color: "rgb(239, 68, 68)" }}
                  />
                  <p className="text-[13px]" style={{ color: "rgb(239, 68, 68)" }}>
                    {displayError}
                  </p>
                </div>
              )}

              {/* Extract Button */}
              <MagneticButton
                type="button"
                onClick={handleExtract}
                disabled={!selectedFile}
                className="w-full py-3 px-4 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2"
                style={{
                  background: panelState === "success"
                    ? "rgba(34, 197, 94, 0.2)"
                    : "linear-gradient(135deg, rgb(139, 92, 246) 0%, rgb(109, 40, 217) 100%)",
                  color: "#ffffff",
                  opacity: !selectedFile ? 0.5 : 1,
                  cursor: !selectedFile ? "not-allowed" : "pointer",
                }}
              >
                {panelState === "success" ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Extraction Complete</span>
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    <span>Extract & Auto-Fill</span>
                  </>
                )}
              </MagneticButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Extraction View — replaces the upload zones during extraction */}
      <AnimatePresence>
        {isExtracting && (
          <>
            <LiveExtractionView
              partialResult={partialResult as Record<string, string | undefined> | undefined}
              fieldsFound={fieldsFound}
              totalFields={totalFields}
              selectedFile={selectedFile}
              activeDocType={activeDocType}
              isLoading={isLoading}
              onStop={handleStop}
            />
            {/* Show hook error while still in extracting state */}
            {hookError && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg"
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <AlertCircle
                  className="h-4 w-4 flex-shrink-0 mt-0.5"
                  style={{ color: "rgb(239, 68, 68)" }}
                />
                <p className="text-[13px]" style={{ color: "rgb(239, 68, 68)" }}>
                  {hookError.message || "Extraction failed. Check the server logs for details."}
                </p>
              </div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Success Result — user reviews and cherry-picks fields */}
      <AnimatePresence>
        {completedResult && activeDocType && (
          <DocumentPrefillSummary
            result={completedResult}
            documentType={activeDocType}
            onAcceptSelected={handleAcceptSelected}
            onDismiss={handleDismissResult}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
