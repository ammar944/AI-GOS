"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FloatingLabelTextarea } from "@/components/ui/floating-label-textarea";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { MarketCompetitionData } from "@/lib/onboarding/types";

interface StepMarketCompetitionProps {
  initialData?: Partial<MarketCompetitionData>;
  onSubmit: (data: MarketCompetitionData) => void;
  onBack?: () => void;
}

export function StepMarketCompetition({
  initialData,
  onSubmit,
  onBack,
}: StepMarketCompetitionProps) {
  const [formData, setFormData] = useState<MarketCompetitionData>({
    topCompetitors: initialData?.topCompetitors || "",
    uniqueEdge: initialData?.uniqueEdge || "",
    competitorFrustrations: initialData?.competitorFrustrations || "",
    marketBottlenecks: initialData?.marketBottlenecks || "",
    proprietaryTech: initialData?.proprietaryTech || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof MarketCompetitionData>(
    field: K,
    value: MarketCompetitionData[K]
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

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.topCompetitors.trim()) {
      newErrors.topCompetitors = "Competitors are required";
    }
    if (!formData.uniqueEdge.trim()) {
      newErrors.uniqueEdge = "Unique edge is required";
    }
    if (!formData.marketBottlenecks.trim()) {
      newErrors.marketBottlenecks = "Market bottlenecks are required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...formData,
      topCompetitors: formData.topCompetitors.trim(),
      uniqueEdge: formData.uniqueEdge.trim(),
      competitorFrustrations: formData.competitorFrustrations?.trim() || "",
      marketBottlenecks: formData.marketBottlenecks.trim(),
      proprietaryTech: formData.proprietaryTech?.trim() || "",
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
          Market & Competition
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Tell us about your market landscape and competitors
        </p>
      </motion.div>

      <motion.div
        className="grid gap-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Top Competitors */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="Who are your top competitors?"
            value={formData.topCompetitors}
            onChange={(e) => updateField("topCompetitors", e.target.value)}
            rows={4}
            aria-invalid={!!errors.topCompetitors}
          />
          {errors.topCompetitors && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.topCompetitors}
            </p>
          )}
        </motion.div>

        {/* Unique Edge */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What makes your product more attractive or effective?"
            value={formData.uniqueEdge}
            onChange={(e) => updateField("uniqueEdge", e.target.value)}
            rows={3}
            aria-invalid={!!errors.uniqueEdge}
          />
          {errors.uniqueEdge && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.uniqueEdge}
            </p>
          )}
        </motion.div>

        {/* Competitor Frustrations */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What frustrations do customers have with competing products? (optional)"
            value={formData.competitorFrustrations}
            onChange={(e) =>
              updateField("competitorFrustrations", e.target.value)
            }
            rows={3}
          />
        </motion.div>

        {/* Market Bottlenecks */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What are the biggest frustrations or bottlenecks in your target market?"
            value={formData.marketBottlenecks}
            onChange={(e) => updateField("marketBottlenecks", e.target.value)}
            rows={3}
            aria-invalid={!!errors.marketBottlenecks}
          />
          {errors.marketBottlenecks && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.marketBottlenecks}
            </p>
          )}
        </motion.div>

        {/* Proprietary Tech */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="Do you use any proprietary frameworks, systems, or technology? (optional)"
            value={formData.proprietaryTech}
            onChange={(e) => updateField("proprietaryTech", e.target.value)}
            rows={2}
          />
          <p className="text-[12px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Any unique methodology, technology, or approach that differentiates your solution
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
          Continue
        </MagneticButton>
      </motion.div>
    </form>
  );
}
