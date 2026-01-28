"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Check, AlertCircle, ChevronDown, Globe, Linkedin } from "lucide-react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { PrefillSummary } from "./prefill-summary";
import { prefillOnboardingFromUrls } from "@/lib/actions/prefill-onboarding";
import type { PrefillOnboardingResponse } from "@/lib/company-intel";
import type { OnboardingFormData } from "@/lib/onboarding/types";

type PanelState = "collapsed" | "expanded" | "loading" | "success" | "error";

interface AutoFillPanelProps {
  onPrefillComplete: (data: Partial<OnboardingFormData>) => void;
}

export function AutoFillPanel({ onPrefillComplete }: AutoFillPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("collapsed");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prefillResult, setPrefillResult] = useState<PrefillOnboardingResponse | null>(null);

  const isExpanded = panelState !== "collapsed";
  const isLoading = panelState === "loading";

  const togglePanel = useCallback(() => {
    if (panelState === "collapsed") {
      setPanelState("expanded");
      setError(null);
    } else if (panelState !== "loading") {
      setPanelState("collapsed");
      setError(null);
      setPrefillResult(null);
    }
  }, [panelState]);

  const validateWebsiteUrl = (url: string): { valid: boolean; normalized: string; error?: string } => {
    const trimmed = url.trim();
    if (!trimmed) {
      return { valid: false, normalized: "", error: "Website URL is required" };
    }

    try {
      const urlWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
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

  const validateLinkedInUrl = (url: string): { valid: boolean; error?: string } => {
    const trimmed = url.trim();
    if (!trimmed) return { valid: true }; // Optional

    try {
      const urlWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : "https://" + trimmed;

      const urlObj = new URL(urlWithProtocol);

      if (!urlObj.hostname.includes("linkedin.com")) {
        return { valid: false, error: "Please enter a valid LinkedIn URL" };
      }

      if (!urlObj.pathname.startsWith("/company/")) {
        return { valid: false, error: "Please use a company page URL (linkedin.com/company/...)" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Please enter a valid LinkedIn URL" };
    }
  };

  const handleResearch = useCallback(async () => {
    setError(null);

    // Validate website URL
    const websiteResult = validateWebsiteUrl(websiteUrl);
    if (!websiteResult.valid) {
      setError(websiteResult.error || "Invalid website URL");
      return;
    }

    // Validate LinkedIn URL if provided
    if (linkedinUrl.trim()) {
      const linkedinResult = validateLinkedInUrl(linkedinUrl);
      if (!linkedinResult.valid) {
        setError(linkedinResult.error || "Invalid LinkedIn URL");
        return;
      }
    }

    setPanelState("loading");

    try {
      const result = await prefillOnboardingFromUrls(
        websiteResult.normalized,
        linkedinUrl.trim() || undefined
      );

      if (result.success && result.data) {
        setPanelState("success");
        setPrefillResult(result.data);
        onPrefillComplete(result.data.prefilled);
      } else {
        setPanelState("error");
        setError(result.error || "Failed to research company");
      }
    } catch (err) {
      setPanelState("error");
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }, [websiteUrl, linkedinUrl, onPrefillComplete]);

  const handleDismissResult = useCallback(() => {
    setPrefillResult(null);
    setPanelState("collapsed");
  }, []);

  return (
    <div className="space-y-3">
      {/* Collapsed State - Clickable Header */}
      <button
        type="button"
        onClick={togglePanel}
        disabled={isLoading}
        className="w-full rounded-lg p-4 text-left transition-all duration-200"
        style={{
          background: isExpanded
            ? "rgba(54, 94, 255, 0.1)"
            : "rgba(54, 94, 255, 0.05)",
          border: `1px solid ${isExpanded ? "rgba(54, 94, 255, 0.4)" : "rgba(54, 94, 255, 0.2)"}`,
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
                  <Globe className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    Company Website
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239, 68, 68, 0.15)", color: "rgb(239, 68, 68)" }}>
                    Required
                  </span>
                </div>
                <FloatingLabelInput
                  label="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* LinkedIn URL Input */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Linkedin className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    LinkedIn Company Page
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(100, 105, 115, 0.15)", color: "rgb(100, 105, 115)" }}>
                    Optional
                  </span>
                </div>
                <FloatingLabelInput
                  label="linkedin.com/company/..."
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                  Improves accuracy of company data
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  className="flex items-start gap-2 p-3 rounded-lg"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "rgb(239, 68, 68)" }} />
                  <p className="text-[13px]" style={{ color: "rgb(239, 68, 68)" }}>
                    {error}
                  </p>
                </div>
              )}

              {/* Research Button */}
              <MagneticButton
                type="button"
                onClick={handleResearch}
                disabled={isLoading || !websiteUrl.trim()}
                className="w-full py-3 px-4 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2"
                style={{
                  background: isLoading
                    ? "rgba(54, 94, 255, 0.3)"
                    : "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)",
                  color: "#ffffff",
                  opacity: !websiteUrl.trim() ? 0.5 : 1,
                  cursor: isLoading || !websiteUrl.trim() ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Researching company...</span>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Result */}
      <AnimatePresence>
        {prefillResult && (
          <PrefillSummary
            result={prefillResult}
            onDismiss={handleDismissResult}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
