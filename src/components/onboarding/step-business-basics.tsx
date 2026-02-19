"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import { AutoFillPanel } from "./auto-fill-panel";
import { DocumentUploadPanel } from "./document-upload-panel";
import type { BusinessBasicsData, OnboardingFormData } from "@/lib/onboarding/types";

interface StepBusinessBasicsProps {
  initialData?: Partial<BusinessBasicsData>;
  onSubmit: (data: BusinessBasicsData) => void;
  onBack?: () => void;
  onPrefillAll?: (data: Partial<OnboardingFormData>) => void;
  onClearAll?: () => void;
}

export function StepBusinessBasics({
  initialData,
  onSubmit,
  onBack,
  onPrefillAll,
  onClearAll,
}: StepBusinessBasicsProps) {
  const [formData, setFormData] = useState<BusinessBasicsData>({
    businessName: initialData?.businessName || "",
    websiteUrl: initialData?.websiteUrl || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  function updateField<K extends keyof BusinessBasicsData>(
    field: K,
    value: BusinessBasicsData[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  /**
   * Validate and normalize URL - only allows http/https protocols
   */
  function validateAndNormalizeUrl(url: string): { valid: boolean; normalized: string; error?: string } {
    const trimmed = url.trim();
    if (!trimmed) {
      return { valid: false, normalized: "", error: "Website URL is required" };
    }

    try {
      const urlWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : "https://" + trimmed;

      const urlObj = new URL(urlWithProtocol);

      // Only allow http/https (prevents javascript:, data:, file:, etc.)
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return { valid: false, normalized: "", error: "URL must use http or https protocol" };
      }

      return { valid: true, normalized: urlObj.toString() };
    } catch {
      return { valid: false, normalized: "", error: "Please enter a valid URL" };
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = "Business name is required";
    }

    const urlResult = validateAndNormalizeUrl(formData.websiteUrl);
    if (!urlResult.valid) {
      newErrors.websiteUrl = urlResult.error || "Invalid URL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Get normalized URL (already validated in validate())
    const urlResult = validateAndNormalizeUrl(formData.websiteUrl);
    const url = urlResult.normalized;

    onSubmit({
      businessName: formData.businessName.trim(),
      websiteUrl: url,
    });
  }

  /**
   * Handle prefill data from AI research
   */
  function handlePrefillComplete(prefilled: Partial<OnboardingFormData>) {
    // Update local form state with business basics if found
    if (prefilled.businessBasics) {
      setFormData((prev) => ({
        businessName: prefilled.businessBasics?.businessName || prev.businessName,
        websiteUrl: prefilled.businessBasics?.websiteUrl || prev.websiteUrl,
      }));
    }

    // Propagate all prefilled data to parent wizard
    if (onPrefillAll) {
      onPrefillAll(prefilled);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <motion.div
        className="space-y-2"
        variants={fadeUp}
        initial="initial"
        animate="animate"
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-[24px] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Business Basics
          </h2>
          {onClearAll && !showClearConfirm && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-white/10"
              style={{
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-default)',
              }}
            >
              <RotateCcw className="h-3 w-3" />
              Clear all fields
            </button>
          )}
          {onClearAll && showClearConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                Are you sure?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setFormData({ businessName: "", websiteUrl: "" });
                  setErrors({});
                  setShowClearConfirm(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-red-500/20"
                style={{
                  color: 'rgb(239, 68, 68)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                Yes, clear all
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-white/10"
                style={{
                  color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Let&apos;s start with your company information
        </p>
      </motion.div>

      <motion.div
        className="grid gap-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Auto-Fill Panel - Shown first as the recommended option */}
        {onPrefillAll && (
          <motion.div variants={staggerItem}>
            <AutoFillPanel onPrefillComplete={handlePrefillComplete} />
          </motion.div>
        )}

        {/* First divider */}
        {onPrefillAll && (
          <motion.div variants={staggerItem} className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'var(--border-default)' }} />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-[13px]"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-tertiary)',
                }}
              >
                or
              </span>
            </div>
          </motion.div>
        )}

        {/* Document Upload Panel */}
        {onPrefillAll && (
          <motion.div variants={staggerItem}>
            <DocumentUploadPanel onPrefillComplete={handlePrefillComplete} />
          </motion.div>
        )}

        {/* Second divider */}
        {onPrefillAll && (
          <motion.div variants={staggerItem} className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'var(--border-default)' }} />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-[13px]"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-tertiary)',
                }}
              >
                or fill in manually
              </span>
            </div>
          </motion.div>
        )}

        {/* Business Name */}
        <motion.div variants={staggerItem}>
          <FloatingLabelInput
            label="Business Name"
            value={formData.businessName}
            onChange={(e) => updateField("businessName", e.target.value)}
            aria-invalid={!!errors.businessName}
          />
          {errors.businessName && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.businessName}
            </p>
          )}
        </motion.div>

        {/* Website URL */}
        <motion.div variants={staggerItem}>
          <FloatingLabelInput
            label="Website URL"
            value={formData.websiteUrl}
            onChange={(e) => updateField("websiteUrl", e.target.value)}
            aria-invalid={!!errors.websiteUrl}
          />
          {errors.websiteUrl && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.websiteUrl}
            </p>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        className="flex gap-3 pt-6"
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.3 }}
      >
        {onBack && (
          <MagneticButton
            type="button"
            onClick={onBack}
            className="py-3 px-6 rounded-xl text-[14px] font-medium"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            Back
          </MagneticButton>
        )}
        <MagneticButton
          type="submit"
          className="flex-1 py-3 px-6 rounded-xl text-[14px] font-semibold text-white"
          style={{
            background: 'var(--gradient-primary)',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
          }}
        >
          Continue
        </MagneticButton>
      </motion.div>
    </form>
  );
}
