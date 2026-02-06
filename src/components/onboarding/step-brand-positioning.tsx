"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FloatingLabelTextarea } from "@/components/ui/floating-label-textarea";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { BrandPositioningData, OnboardingFormData } from "@/lib/onboarding/types";
import { useStepSuggestion } from "@/hooks/use-step-suggestion";
import { AISuggestButton } from "./ai-suggest-button";
import { FieldSuggestion } from "./field-suggestion";

interface StepBrandPositioningProps {
  initialData?: Partial<BrandPositioningData>;
  onSubmit: (data: BrandPositioningData) => void;
  onBack?: () => void;
  wizardFormData?: Partial<OnboardingFormData>;
}

export function StepBrandPositioning({
  initialData,
  onSubmit,
  onBack,
  wizardFormData,
}: StepBrandPositioningProps) {
  const { suggestions, submit: submitSuggestion, isLoading: isSuggesting, stop, fieldsFound } = useStepSuggestion('brandPositioning');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function hasSuggestion(fieldKey: string): boolean {
    if (dismissed.has(fieldKey)) return false;
    const field = suggestions?.[fieldKey];
    return field?.value != null && field.value !== '';
  }
  function getSuggestion(fieldKey: string) {
    return suggestions?.[fieldKey];
  }

  const [formData, setFormData] = useState<BrandPositioningData>({
    brandPositioning: initialData?.brandPositioning || "",
    customerVoice: initialData?.customerVoice || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof BrandPositioningData>(
    field: K,
    value: BrandPositioningData[K]
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

    if (!formData.brandPositioning.trim()) {
      newErrors.brandPositioning = "Brand positioning is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      brandPositioning: formData.brandPositioning.trim(),
      customerVoice: formData.customerVoice?.trim() || "",
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
        <div className="flex items-center justify-between">
          <h2
            className="text-[24px] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Brand & Positioning
          </h2>
          <AISuggestButton
            onClick={() => wizardFormData && submitSuggestion(wizardFormData)}
            isLoading={isSuggesting}
            fieldsFound={fieldsFound}
            disabled={!wizardFormData?.businessBasics?.businessName}
          />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Define your brand voice and market positioning
        </p>
      </motion.div>

      <motion.div
        className="grid gap-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Brand Positioning */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What do you want your brand to be known for in your market?"
            value={formData.brandPositioning}
            onChange={(e) => updateField("brandPositioning", e.target.value)}
            rows={5}
            aria-invalid={!!errors.brandPositioning}
          />
          {errors.brandPositioning && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.brandPositioning}
            </p>
          )}
          <p className="text-[12px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Think about the key attributes, expertise, or values you want associated with your brand
          </p>
          <FieldSuggestion
            suggestedValue={getSuggestion('brandPositioning')?.value ?? ''}
            reasoning={getSuggestion('brandPositioning')?.reasoning ?? ''}
            confidence={getSuggestion('brandPositioning')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('brandPositioning')?.value;
              if (val) updateField('brandPositioning', val);
              setDismissed(prev => new Set(prev).add('brandPositioning'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('brandPositioning'))}
            isVisible={hasSuggestion('brandPositioning')}
          />
        </motion.div>

        {/* Customer Voice */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="How would your best customer describe you? (optional)"
            value={formData.customerVoice}
            onChange={(e) => updateField("customerVoice", e.target.value)}
            rows={4}
          />
          <p className="text-[12px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
            This helps us understand the voice and language of your customers
          </p>
          <FieldSuggestion
            suggestedValue={getSuggestion('customerVoice')?.value ?? ''}
            reasoning={getSuggestion('customerVoice')?.reasoning ?? ''}
            confidence={getSuggestion('customerVoice')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('customerVoice')?.value;
              if (val) updateField('customerVoice', val);
              setDismissed(prev => new Set(prev).add('customerVoice'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('customerVoice'))}
            isVisible={hasSuggestion('customerVoice')}
          />
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
