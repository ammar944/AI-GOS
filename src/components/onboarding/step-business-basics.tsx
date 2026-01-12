"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { BusinessBasicsData } from "@/lib/onboarding/types";

interface StepBusinessBasicsProps {
  initialData?: Partial<BusinessBasicsData>;
  onSubmit: (data: BusinessBasicsData) => void;
  onBack?: () => void;
}

export function StepBusinessBasics({
  initialData,
  onSubmit,
  onBack,
}: StepBusinessBasicsProps) {
  const [formData, setFormData] = useState<BusinessBasicsData>({
    businessName: initialData?.businessName || "",
    websiteUrl: initialData?.websiteUrl || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <motion.div
        className="space-y-2"
        variants={fadeUp}
        initial="initial"
        animate="animate"
      >
        <h2
          className="text-[24px] font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Business Basics
        </h2>
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
