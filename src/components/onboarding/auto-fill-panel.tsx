"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
  Globe,
  Linkedin,
  Square,
} from "lucide-react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { PrefillSummary } from "./prefill-summary";
import { useCompanyResearch } from "@/hooks/use-company-research";
import type { CompanyResearchOutput } from "@/lib/company-intel";
import type { OnboardingFormData, CompanySize } from "@/lib/onboarding/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelState = "collapsed" | "expanded" | "streaming" | "success" | "error";

interface AutoFillPanelProps {
  onPrefillComplete: (data: Partial<OnboardingFormData>) => void;
}

// ---------------------------------------------------------------------------
// Field label mapping for display
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

const RESEARCH_FIELD_KEYS = Object.keys(FIELD_LABELS);

// ---------------------------------------------------------------------------
// Confidence color helper
// ---------------------------------------------------------------------------

function confidenceDotColor(confidence: number | undefined): string {
  if (confidence == null) return "rgb(100, 105, 115)";
  if (confidence >= 80) return "rgb(34, 197, 94)";
  if (confidence >= 50) return "rgb(250, 204, 21)";
  return "rgb(239, 68, 68)";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AutoFillPanel({ onPrefillComplete }: AutoFillPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("collapsed");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<CompanyResearchOutput | null>(null);

  const {
    partialResult,
    submit,
    isLoading,
    error: hookError,
    stop,
    fieldsFound,
    totalFields,
  } = useCompanyResearch();

  const isExpanded = panelState !== "collapsed";
  const isStreaming = panelState === "streaming";

  // ---- Detect streaming completion ----------------------------------------

  const prevLoading = useRef(isLoading);
  useEffect(() => {
    if (prevLoading.current && !isLoading && !hookError && partialResult) {
      // Streaming finished successfully — store the result for the review UI
      setCompletedResult(partialResult as CompanyResearchOutput);
      setPanelState("success");
    }
    if (prevLoading.current && !isLoading && hookError) {
      setPanelState("error");
    }
    prevLoading.current = isLoading;
  }, [isLoading, hookError, partialResult]);

  // ---- Toggle panel -------------------------------------------------------

  const togglePanel = useCallback(() => {
    if (panelState === "collapsed") {
      setPanelState("expanded");
      setValidationError(null);
    } else if (!isStreaming) {
      setPanelState("collapsed");
      setValidationError(null);
      setCompletedResult(null);
    }
  }, [panelState, isStreaming]);

  // ---- URL validation -----------------------------------------------------

  const validateWebsiteUrl = (
    url: string
  ): { valid: boolean; normalized: string; error?: string } => {
    const trimmed = url.trim();
    if (!trimmed) {
      return { valid: false, normalized: "", error: "Website URL is required" };
    }
    try {
      const urlWithProtocol =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : "https://" + trimmed;
      const urlObj = new URL(urlWithProtocol);
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return { valid: false, normalized: "", error: "URL must use http or https" };
      }
      return { valid: true, normalized: urlObj.toString() };
    } catch {
      return { valid: false, normalized: "", error: "Please enter a valid URL" };
    }
  };

  const validateLinkedInUrl = (
    url: string
  ): { valid: boolean; error?: string } => {
    const trimmed = url.trim();
    if (!trimmed) return { valid: true }; // Optional
    try {
      const urlWithProtocol =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : "https://" + trimmed;
      const urlObj = new URL(urlWithProtocol);
      const lnHost = urlObj.hostname.toLowerCase();
      if (lnHost !== "linkedin.com" && lnHost !== "www.linkedin.com") {
        return { valid: false, error: "Please enter a valid LinkedIn URL" };
      }
      if (!urlObj.pathname.startsWith("/company/")) {
        return {
          valid: false,
          error: "Please use a company page URL (linkedin.com/company/...)",
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "Please enter a valid LinkedIn URL" };
    }
  };

  // ---- Start research -----------------------------------------------------

  const handleResearch = useCallback(() => {
    setValidationError(null);

    const websiteResult = validateWebsiteUrl(websiteUrl);
    if (!websiteResult.valid) {
      setValidationError(websiteResult.error || "Invalid website URL");
      return;
    }

    if (linkedinUrl.trim()) {
      const linkedinResult = validateLinkedInUrl(linkedinUrl);
      if (!linkedinResult.valid) {
        setValidationError(linkedinResult.error || "Invalid LinkedIn URL");
        return;
      }
    }

    setPanelState("streaming");
    submit({
      websiteUrl: websiteResult.normalized,
      linkedinUrl: linkedinUrl.trim() || undefined,
    });
  }, [websiteUrl, linkedinUrl, submit]);

  // ---- Stop research ------------------------------------------------------

  const handleStop = useCallback(() => {
    stop();
    // The useEffect above will handle the state transition
  }, [stop]);

  // ---- Dismiss result -----------------------------------------------------

  const handleDismissResult = useCallback(() => {
    setCompletedResult(null);
    setPanelState("collapsed");
  }, []);

  // ---- Accept selected fields from PrefillSummary -------------------------

  const handleAcceptSelected = useCallback(
    (selectedFields: Set<string>) => {
      if (!completedResult) return;

      const v = (key: string): string => {
        const field = completedResult[key as keyof CompanyResearchOutput] as
          | { value?: string | null }
          | undefined;
        return field?.value ?? "";
      };

      const isSelected = (key: string) => selectedFields.has(key);

      const parseSize = (sizeStr: string): CompanySize => {
        if (!sizeStr) return "11-50";
        const lower = sizeStr.toLowerCase().replace(/,/g, "");
        const numbers = lower.match(/\d+/g)?.map(Number) || [];
        const maxNum = Math.max(...numbers, 0);
        if (lower.includes("solo") || lower.includes("freelance") || maxNum === 1) return "solo";
        if (maxNum <= 10) return "1-10";
        if (maxNum <= 50) return "11-50";
        if (maxNum <= 200) return "51-200";
        if (maxNum <= 1000) return "201-1000";
        if (maxNum > 1000 || lower.includes("1000+") || lower.includes("enterprise")) return "1000+";
        return "11-50";
      };

      const formData: Partial<OnboardingFormData> = {};

      // Business Basics
      if (isSelected("companyName")) {
        formData.businessBasics = { businessName: v("companyName"), websiteUrl: "" };
      }

      // ICP
      const icpKeys = ["industry", "targetCustomers", "targetJobTitles", "companySize", "headquartersLocation"];
      if (icpKeys.some(isSelected)) {
        formData.icp = {
          primaryIcpDescription: isSelected("targetCustomers") ? v("targetCustomers") : "",
          industryVertical: isSelected("industry") ? v("industry") : "",
          jobTitles: isSelected("targetJobTitles") ? v("targetJobTitles") : "",
          companySize: isSelected("companySize") ? (() => { const p = parseSize(v("companySize")); return [p]; })() : [],
          geography: isSelected("headquartersLocation") ? v("headquartersLocation") : "",
          easiestToClose: "",
          buyingTriggers: "",
          bestClientSources: [],
        };
      }

      // Product & Offer
      const productKeys = ["productDescription", "coreFeatures", "valueProposition", "pricing"];
      if (productKeys.some(isSelected)) {
        formData.productOffer = {
          productDescription: isSelected("productDescription") ? v("productDescription") : "",
          coreDeliverables: isSelected("coreFeatures") ? v("coreFeatures") : "",
          offerPrice: 0,
          pricingModel: [],
          valueProp: isSelected("valueProposition") ? v("valueProposition") : "",
          currentFunnelType: [],
        };
      }

      // Market & Competition
      const marketKeys = ["competitors", "uniqueDifferentiator", "marketProblem"];
      if (marketKeys.some(isSelected)) {
        formData.marketCompetition = {
          topCompetitors: isSelected("competitors") ? v("competitors") : "",
          uniqueEdge: isSelected("uniqueDifferentiator") ? v("uniqueDifferentiator") : "",
          marketBottlenecks: isSelected("marketProblem") ? v("marketProblem") : "",
        };
      }

      // Customer Journey
      const journeyKeys = ["customerTransformation", "commonObjections"];
      if (journeyKeys.some(isSelected)) {
        formData.customerJourney = {
          situationBeforeBuying: isSelected("marketProblem") ? v("marketProblem") : "",
          desiredTransformation: isSelected("customerTransformation") ? v("customerTransformation") : "",
          commonObjections: isSelected("commonObjections") ? v("commonObjections") : "",
          salesCycleLength: "14_to_30_days",
        };
      }

      // Brand & Positioning
      const brandKeys = ["brandPositioning", "testimonialQuote"];
      if (brandKeys.some(isSelected)) {
        formData.brandPositioning = {
          brandPositioning: isSelected("brandPositioning") ? v("brandPositioning") : "",
          customerVoice: isSelected("testimonialQuote") ? v("testimonialQuote") : "",
        };
      }

      // Assets & Proof
      const assetKeys = ["caseStudiesUrl", "testimonialsUrl", "pricingUrl", "demoUrl"];
      if (assetKeys.some(isSelected)) {
        formData.assetsProof = {
          caseStudiesUrl: isSelected("caseStudiesUrl") ? v("caseStudiesUrl") : "",
          testimonialsUrl: isSelected("testimonialsUrl") ? v("testimonialsUrl") : "",
          landingPageUrl: isSelected("demoUrl") ? v("demoUrl") : "",
        };
      }

      onPrefillComplete(formData);
      setCompletedResult(null);
      setPanelState("collapsed");
    },
    [completedResult, onPrefillComplete],
  );

  // ---- Determine displayed error ------------------------------------------

  const displayError = validationError || (hookError ? hookError.message : null);

  return (
    <div className="space-y-3">
      {/* Collapsed State - Clickable Header */}
      <button
        type="button"
        onClick={togglePanel}
        disabled={isStreaming}
        className="w-full rounded-lg p-4 text-left transition-all duration-200"
        style={{
          background: isExpanded
            ? "rgba(54, 94, 255, 0.1)"
            : "rgba(54, 94, 255, 0.05)",
          border: `1px solid ${
            isExpanded ? "rgba(54, 94, 255, 0.4)" : "rgba(54, 94, 255, 0.2)"
          }`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: "rgba(54, 94, 255, 0.15)",
                color: "rgb(54, 94, 255)",
              }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p
                className="text-[14px] font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Auto-Fill with AI
              </p>
              <p
                className="text-[13px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Research your company and pre-fill all fields
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ color: "rgb(54, 94, 255)" }}
          >
            <ChevronDown className="h-5 w-5" />
          </motion.div>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
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
              {/* Website URL Input */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Globe
                    className="h-4 w-4"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Company Website
                  </span>
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded"
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "rgb(239, 68, 68)",
                    }}
                  >
                    Required
                  </span>
                </div>
                <FloatingLabelInput
                  label="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  disabled={isStreaming}
                />
              </div>

              {/* LinkedIn URL Input */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Linkedin
                    className="h-4 w-4"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    LinkedIn Company Page
                  </span>
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded"
                    style={{
                      background: "rgba(100, 105, 115, 0.15)",
                      color: "rgb(100, 105, 115)",
                    }}
                  >
                    Optional
                  </span>
                </div>
                <FloatingLabelInput
                  label="linkedin.com/company/..."
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={isStreaming}
                />
                <p
                  className="text-[12px] mt-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Improves accuracy of company data
                </p>
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
                  <p
                    className="text-[13px]"
                    style={{ color: "rgb(239, 68, 68)" }}
                  >
                    {displayError}
                  </p>
                </div>
              )}

              {/* Streaming Progress */}
              {isStreaming && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span style={{ color: "var(--text-secondary)" }}>
                      {fieldsFound === 0
                        ? "Scraping & analyzing website..."
                        : "Extracting company data..."}
                    </span>
                    {fieldsFound > 0 && (
                      <span style={{ color: "rgb(54, 94, 255)" }}>
                        {fieldsFound} of {totalFields} fields
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "rgb(20, 23, 30)" }}
                  >
                    {fieldsFound === 0 ? (
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          width: "30%",
                          background:
                            "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)",
                        }}
                        animate={{ x: ["-100%", "350%"] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    ) : (
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background:
                            "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)",
                        }}
                        animate={{
                          width: `${(fieldsFound / totalFields) * 100}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                  </div>

                  {/* Field discovery feed */}
                  {partialResult && (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      {RESEARCH_FIELD_KEYS.map((key) => {
                        const field = (
                          partialResult as Record<
                            string,
                            | { value?: string | null; confidence?: number }
                            | undefined
                          >
                        )[key];
                        if (!field?.value) return null;

                        const displayValue =
                          field.value.length > 60
                            ? field.value.slice(0, 60) + "..."
                            : field.value;

                        return (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-2 py-1 px-2 rounded"
                            style={{ background: "rgba(255, 255, 255, 0.02)" }}
                          >
                            <Check
                              className="h-3.5 w-3.5 flex-shrink-0"
                              style={{ color: "rgb(34, 197, 94)" }}
                            />
                            <span
                              className="text-[12px] font-medium flex-shrink-0"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {FIELD_LABELS[key] || key}
                            </span>
                            <span
                              className="text-[12px] truncate"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {displayValue}
                            </span>
                            <span
                              className="h-2 w-2 rounded-full flex-shrink-0 ml-auto"
                              style={{
                                background: confidenceDotColor(
                                  field.confidence
                                ),
                              }}
                              title={
                                field.confidence != null
                                  ? `Confidence: ${field.confidence}%`
                                  : undefined
                              }
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                  )}
                </div>
              )}

              {/* Research / Stop Button Row */}
              <div className="flex items-center gap-2">
                <MagneticButton
                  type="button"
                  onClick={isStreaming ? handleStop : handleResearch}
                  disabled={!isStreaming && !websiteUrl.trim()}
                  className="flex-1 py-3 px-4 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2"
                  style={{
                    background: isStreaming
                      ? "rgba(54, 94, 255, 0.3)"
                      : panelState === "success"
                        ? "rgba(34, 197, 94, 0.2)"
                        : "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)",
                    color: "#ffffff",
                    opacity: !isStreaming && !websiteUrl.trim() ? 0.5 : 1,
                    cursor:
                      !isStreaming && !websiteUrl.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {isStreaming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {fieldsFound === 0
                          ? "Scraping website..."
                          : `Extracting... (${fieldsFound} fields found)`}
                      </span>
                    </>
                  ) : panelState === "success" ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Research Complete</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Research & Auto-Fill</span>
                    </>
                  )}
                </MagneticButton>

                {isStreaming && (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center gap-1.5 px-3 py-3 rounded-lg text-[13px] font-medium transition-colors"
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "var(--text-secondary)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <Square className="h-3.5 w-3.5" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Result — user reviews and cherry-picks fields */}
      <AnimatePresence>
        {completedResult && (
          <PrefillSummary
            result={completedResult}
            onAcceptSelected={handleAcceptSelected}
            onDismiss={handleDismissResult}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
