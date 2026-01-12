"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";
import { FloatingLabelTextarea } from "@/components/ui/floating-label-textarea";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { ComplianceData } from "@/lib/onboarding/types";

interface StepComplianceProps {
  initialData?: Partial<ComplianceData>;
  onSubmit: (data: ComplianceData) => void;
  onBack?: () => void;
}

export function StepCompliance({
  initialData,
  onSubmit,
  onBack,
}: StepComplianceProps) {
  const [formData, setFormData] = useState<ComplianceData>({
    topicsToAvoid: initialData?.topicsToAvoid || "",
    claimRestrictions: initialData?.claimRestrictions || "",
  });

  function updateField<K extends keyof ComplianceData>(
    field: K,
    value: ComplianceData[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    onSubmit({
      topicsToAvoid: formData.topicsToAvoid?.trim() || "",
      claimRestrictions: formData.claimRestrictions?.trim() || "",
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
          Compliance & Restrictions
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Help us avoid disapproved ads and protect your brand
        </p>
      </motion.div>

      <motion.div
        className="rounded-lg p-4"
        style={{
          border: '1px solid rgba(245, 158, 11, 0.2)',
          background: 'rgba(245, 158, 11, 0.05)',
        }}
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.1 }}
      >
        <div className="flex gap-3">
          <Shield className="h-5 w-5 mt-0.5" style={{ color: '#d97706' }} />
          <div className="space-y-1">
            <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
              Why this matters
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
              Ad platforms have strict policies. Knowing your restrictions
              upfront helps us create compliant ads that won&apos;t get
              rejected.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="grid gap-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Topics to Avoid */}
        <motion.div variants={staggerItem} className="space-y-2">
          <FloatingLabelTextarea
            label="Topics we cannot mention (optional)"
            value={formData.topicsToAvoid}
            onChange={(e) => updateField("topicsToAvoid", e.target.value)}
            rows={4}
          />
          <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
            List any topics, words, or themes that should not appear in your
            advertising
          </p>
        </motion.div>

        {/* Claim Restrictions */}
        <motion.div variants={staggerItem} className="space-y-2">
          <FloatingLabelTextarea
            label="Claims we must verify or avoid (optional)"
            value={formData.claimRestrictions}
            onChange={(e) => updateField("claimRestrictions", e.target.value)}
            rows={4}
          />
          <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
            Any claims that require disclaimers, documentation, or should be
            avoided entirely
          </p>
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
          Complete Onboarding
        </MagneticButton>
      </motion.div>
    </form>
  );
}
