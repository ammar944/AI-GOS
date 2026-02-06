"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FloatingLabelTextarea } from "@/components/ui/floating-label-textarea";
import { MagneticButton } from "@/components/ui/magnetic-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { CustomerJourneyData, SalesCycleLength, OnboardingFormData } from "@/lib/onboarding/types";
import { SALES_CYCLE_OPTIONS } from "@/lib/onboarding/types";
import { useStepSuggestion } from "@/hooks/use-step-suggestion";
import { AISuggestButton } from "./ai-suggest-button";
import { FieldSuggestion } from "./field-suggestion";

interface StepCustomerJourneyProps {
  initialData?: Partial<CustomerJourneyData>;
  onSubmit: (data: CustomerJourneyData) => void;
  onBack?: () => void;
  wizardFormData?: Partial<OnboardingFormData>;
}

export function StepCustomerJourney({
  initialData,
  onSubmit,
  onBack,
  wizardFormData,
}: StepCustomerJourneyProps) {
  const { suggestions, submit: submitSuggestion, isLoading: isSuggesting, stop, fieldsFound } = useStepSuggestion('customerJourney');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function hasSuggestion(fieldKey: string): boolean {
    if (dismissed.has(fieldKey)) return false;
    const field = suggestions?.[fieldKey];
    return field?.value != null && field.value !== '';
  }
  function getSuggestion(fieldKey: string) {
    return suggestions?.[fieldKey];
  }

  const [formData, setFormData] = useState<CustomerJourneyData>({
    situationBeforeBuying: initialData?.situationBeforeBuying || "",
    desiredTransformation: initialData?.desiredTransformation || "",
    commonObjections: initialData?.commonObjections || "",
    salesCycleLength: initialData?.salesCycleLength || "14_to_30_days",
    salesProcessOverview: initialData?.salesProcessOverview || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof CustomerJourneyData>(
    field: K,
    value: CustomerJourneyData[K]
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

    if (!formData.situationBeforeBuying.trim()) {
      newErrors.situationBeforeBuying = "This field is required";
    }
    if (!formData.desiredTransformation.trim()) {
      newErrors.desiredTransformation = "This field is required";
    }
    if (!formData.commonObjections.trim()) {
      newErrors.commonObjections = "This field is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...formData,
      situationBeforeBuying: formData.situationBeforeBuying.trim(),
      desiredTransformation: formData.desiredTransformation.trim(),
      commonObjections: formData.commonObjections.trim(),
      salesProcessOverview: formData.salesProcessOverview?.trim() || "",
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
            Customer Journey
          </h2>
          <AISuggestButton
            onClick={() => wizardFormData && submitSuggestion(wizardFormData)}
            isLoading={isSuggesting}
            fieldsFound={fieldsFound}
            disabled={!wizardFormData?.businessBasics?.businessName}
          />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Map out how customers discover and buy from you
        </p>
      </motion.div>

      <motion.div
        className="grid gap-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Situation Before Buying */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What situation is your ideal client usually in before buying?"
            value={formData.situationBeforeBuying}
            onChange={(e) =>
              updateField("situationBeforeBuying", e.target.value)
            }
            rows={4}
            aria-invalid={!!errors.situationBeforeBuying}
          />
          {errors.situationBeforeBuying && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.situationBeforeBuying}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('situationBeforeBuying')?.value ?? ''}
            reasoning={getSuggestion('situationBeforeBuying')?.reasoning ?? ''}
            confidence={getSuggestion('situationBeforeBuying')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('situationBeforeBuying')?.value;
              if (val) updateField('situationBeforeBuying', val);
              setDismissed(prev => new Set(prev).add('situationBeforeBuying'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('situationBeforeBuying'))}
            isVisible={hasSuggestion('situationBeforeBuying')}
          />
        </motion.div>

        {/* Desired Transformation */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What outcome or transformation are they hoping to achieve?"
            value={formData.desiredTransformation}
            onChange={(e) =>
              updateField("desiredTransformation", e.target.value)
            }
            rows={4}
            aria-invalid={!!errors.desiredTransformation}
          />
          {errors.desiredTransformation && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.desiredTransformation}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('desiredTransformation')?.value ?? ''}
            reasoning={getSuggestion('desiredTransformation')?.reasoning ?? ''}
            confidence={getSuggestion('desiredTransformation')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('desiredTransformation')?.value;
              if (val) updateField('desiredTransformation', val);
              setDismissed(prev => new Set(prev).add('desiredTransformation'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('desiredTransformation'))}
            isVisible={hasSuggestion('desiredTransformation')}
          />
        </motion.div>

        {/* Common Objections */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What common objections do prospects bring up and how do you address them?"
            value={formData.commonObjections}
            onChange={(e) => updateField("commonObjections", e.target.value)}
            rows={4}
            aria-invalid={!!errors.commonObjections}
          />
          {errors.commonObjections && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.commonObjections}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('commonObjections')?.value ?? ''}
            reasoning={getSuggestion('commonObjections')?.reasoning ?? ''}
            confidence={getSuggestion('commonObjections')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('commonObjections')?.value;
              if (val) updateField('commonObjections', val);
              setDismissed(prev => new Set(prev).add('commonObjections'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('commonObjections'))}
            isVisible={hasSuggestion('commonObjections')}
          />
        </motion.div>

        {/* Sales Cycle Length */}
        <motion.div className="space-y-2" variants={staggerItem}>
          <label
            className="text-[14px] font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Average Sales Cycle Length
          </label>
          <Select
            value={formData.salesCycleLength}
            onValueChange={(value) =>
              updateField("salesCycleLength", value as SalesCycleLength)
            }
          >
            <SelectTrigger
              className="h-12 rounded-lg"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            >
              <SelectValue placeholder="Select sales cycle length" />
            </SelectTrigger>
            <SelectContent
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
              }}
            >
              {SALES_CYCLE_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="hover:bg-[var(--bg-hover)]"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            Time from first contact to closed sale
          </p>
        </motion.div>

        {/* Sales Process Overview */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What does your sales process look like from lead to close? (optional)"
            value={formData.salesProcessOverview}
            onChange={(e) =>
              updateField("salesProcessOverview", e.target.value)
            }
            rows={3}
          />
          <p className="text-[12px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
            E.g., Lead capture, Discovery call, Demo, Proposal, Close
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
