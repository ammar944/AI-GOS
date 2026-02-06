"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
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
import type {
  ProductOfferData,
  PricingModel,
  FunnelType,
  OnboardingFormData,
} from "@/lib/onboarding/types";
import {
  PRICING_MODEL_OPTIONS,
  FUNNEL_TYPE_OPTIONS,
} from "@/lib/onboarding/types";
import { useStepSuggestion } from "@/hooks/use-step-suggestion";
import { AISuggestButton } from "./ai-suggest-button";
import { FieldSuggestion } from "./field-suggestion";

interface StepProductOfferProps {
  initialData?: Partial<ProductOfferData>;
  onSubmit: (data: ProductOfferData) => void;
  onBack?: () => void;
  wizardFormData?: Partial<OnboardingFormData>;
}

export function StepProductOffer({
  initialData,
  onSubmit,
  onBack,
  wizardFormData,
}: StepProductOfferProps) {
  const [formData, setFormData] = useState<ProductOfferData>({
    productDescription: initialData?.productDescription || "",
    coreDeliverables: initialData?.coreDeliverables || "",
    offerPrice: initialData?.offerPrice || 0,
    pricingModel: initialData?.pricingModel || "monthly",
    valueProp: initialData?.valueProp || "",
    guarantees: initialData?.guarantees || "",
    currentFunnelType: initialData?.currentFunnelType || "lead_form",
  });
  const [priceInput, setPriceInput] = useState(
    initialData?.offerPrice?.toString() || ""
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { suggestions, submit: submitSuggestion, isLoading: isSuggesting, stop, fieldsFound } = useStepSuggestion('productOffer');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function hasSuggestion(fieldKey: string): boolean {
    if (dismissed.has(fieldKey)) return false;
    const field = suggestions?.[fieldKey];
    return field?.value != null && field.value !== '';
  }

  function getSuggestion(fieldKey: string) {
    return suggestions?.[fieldKey];
  }

  function updateField<K extends keyof ProductOfferData>(
    field: K,
    value: ProductOfferData[K]
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

    if (!formData.productDescription.trim()) {
      newErrors.productDescription = "Product description is required";
    }
    if (!formData.coreDeliverables.trim()) {
      newErrors.coreDeliverables = "Core deliverables are required";
    }
    const price = parseFloat(priceInput);
    if (!priceInput || isNaN(price) || price <= 0) {
      newErrors.offerPrice = "Please enter a valid price";
    }
    if (!formData.valueProp.trim()) {
      newErrors.valueProp = "Value proposition is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...formData,
      productDescription: formData.productDescription.trim(),
      coreDeliverables: formData.coreDeliverables.trim(),
      offerPrice: parseFloat(priceInput),
      valueProp: formData.valueProp.trim(),
      guarantees: formData.guarantees?.trim() || "",
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
            Product & Offer
          </h2>
          <AISuggestButton
            onClick={() => {
              if (!wizardFormData) return;
              setDismissed(new Set());
              submitSuggestion(wizardFormData);
            }}
            isLoading={isSuggesting}
            fieldsFound={fieldsFound}
            disabled={!wizardFormData?.businessBasics?.businessName || !wizardFormData?.icp?.primaryIcpDescription}
          />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Tell us about what you sell and the value you provide
        </p>
      </motion.div>

      <motion.div
        className="grid gap-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Product Description */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="In simple terms, what does your product do and what core problem does it solve?"
            value={formData.productDescription}
            onChange={(e) => updateField("productDescription", e.target.value)}
            rows={4}
            aria-invalid={!!errors.productDescription}
          />
          {errors.productDescription && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.productDescription}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('productDescription')?.value ?? ''}
            reasoning={getSuggestion('productDescription')?.reasoning ?? ''}
            confidence={getSuggestion('productDescription')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('productDescription')?.value;
              if (val) updateField('productDescription', val);
              setDismissed(prev => new Set(prev).add('productDescription'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('productDescription'))}
            isVisible={hasSuggestion('productDescription')}
          />
        </motion.div>

        {/* Core Deliverables */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What are the core deliverables or features included in your offer?"
            value={formData.coreDeliverables}
            onChange={(e) => updateField("coreDeliverables", e.target.value)}
            rows={3}
            aria-invalid={!!errors.coreDeliverables}
          />
          {errors.coreDeliverables && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.coreDeliverables}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('coreDeliverables')?.value ?? ''}
            reasoning={getSuggestion('coreDeliverables')?.reasoning ?? ''}
            confidence={getSuggestion('coreDeliverables')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('coreDeliverables')?.value;
              if (val) updateField('coreDeliverables', val);
              setDismissed(prev => new Set(prev).add('coreDeliverables'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('coreDeliverables'))}
            isVisible={hasSuggestion('coreDeliverables')}
          />
        </motion.div>

        {/* Price & Pricing Model Row */}
        <motion.div className="grid gap-6 md:grid-cols-2" variants={staggerItem}>
          <div>
            <div className="relative">
              <span
                className="absolute left-0 top-4 text-[16px]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                $
              </span>
              <FloatingLabelInput
                label="Offer Price (USD)"
                type="number"
                min="1"
                step="any"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="pl-4"
                aria-invalid={!!errors.offerPrice}
              />
            </div>
            {errors.offerPrice && (
              <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
                {errors.offerPrice}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              className="text-[14px] font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              How does your pricing work?
            </label>
            <Select
              value={formData.pricingModel}
              onValueChange={(value) =>
                updateField("pricingModel", value as PricingModel)
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
                <SelectValue placeholder="Select pricing model" />
              </SelectTrigger>
              <SelectContent
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {PRICING_MODEL_OPTIONS.map((option) => (
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
          </div>
        </motion.div>

        {/* Value Proposition */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What value does your ICP care about most?"
            value={formData.valueProp}
            onChange={(e) => updateField("valueProp", e.target.value)}
            rows={3}
            aria-invalid={!!errors.valueProp}
          />
          {errors.valueProp && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.valueProp}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('valueProp')?.value ?? ''}
            reasoning={getSuggestion('valueProp')?.reasoning ?? ''}
            confidence={getSuggestion('valueProp')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('valueProp')?.value;
              if (val) updateField('valueProp', val);
              setDismissed(prev => new Set(prev).add('valueProp'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('valueProp'))}
            isVisible={hasSuggestion('valueProp')}
          />
        </motion.div>

        {/* Current Funnel Type */}
        <motion.div className="space-y-2" variants={staggerItem}>
          <label
            className="text-[14px] font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            What type of funnel are you currently using?
          </label>
          <Select
            value={formData.currentFunnelType}
            onValueChange={(value) =>
              updateField("currentFunnelType", value as FunnelType)
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
              <SelectValue placeholder="Select funnel type" />
            </SelectTrigger>
            <SelectContent
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
              }}
            >
              {FUNNEL_TYPE_OPTIONS.map((option) => (
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
        </motion.div>

        {/* Guarantees */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="Do you offer any guarantees, commitments, or risk-reversal elements? (optional)"
            value={formData.guarantees}
            onChange={(e) => updateField("guarantees", e.target.value)}
            rows={2}
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
