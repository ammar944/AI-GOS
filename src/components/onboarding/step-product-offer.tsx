"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { FloatingLabelTextarea } from "@/components/ui/floating-label-textarea";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Checkbox } from "@/components/ui/checkbox";
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
    pricingModel: initialData?.pricingModel || [],
    valueProp: initialData?.valueProp || "",
    guarantees: initialData?.guarantees || "",
    currentFunnelType: initialData?.currentFunnelType || [],
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

  function togglePricingModel(model: PricingModel) {
    const current = formData.pricingModel;
    if (current.includes(model)) {
      updateField("pricingModel", current.filter((m) => m !== model));
    } else {
      updateField("pricingModel", [...current, model]);
    }
  }

  function toggleFunnelType(ftype: FunnelType) {
    const current = formData.currentFunnelType;
    if (current.includes(ftype)) {
      updateField("currentFunnelType", current.filter((f) => f !== ftype));
    } else {
      updateField("currentFunnelType", [...current, ftype]);
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
    if (formData.pricingModel.length === 0) {
      newErrors.pricingModel = "Select at least one pricing model";
    }
    if (!formData.valueProp.trim()) {
      newErrors.valueProp = "Value proposition is required";
    }
    if (formData.currentFunnelType.length === 0) {
      newErrors.currentFunnelType = "Select at least one funnel type";
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

        {/* Offer Price */}
        <motion.div variants={staggerItem}>
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
        </motion.div>

        {/* Pricing Model */}
        <motion.div className="space-y-3" variants={staggerItem}>
          <label
            className="text-[14px] font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            How does your pricing work? (select all that apply)
          </label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {PRICING_MODEL_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-4 transition-all"
                style={{
                  border: '1px solid',
                  borderColor: formData.pricingModel.includes(option.value)
                    ? 'var(--accent-blue)'
                    : 'var(--border-default)',
                  background: formData.pricingModel.includes(option.value)
                    ? 'var(--accent-blue-subtle)'
                    : 'transparent',
                }}
              >
                <Checkbox
                  checked={formData.pricingModel.includes(option.value)}
                  onCheckedChange={() => togglePricingModel(option.value)}
                />
                <span
                  className="text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
          {errors.pricingModel && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.pricingModel}
            </p>
          )}
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
        <motion.div className="space-y-3" variants={staggerItem}>
          <label
            className="text-[14px] font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            What type of funnel are you currently using? (select all that apply)
          </label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {FUNNEL_TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-4 transition-all"
                style={{
                  border: '1px solid',
                  borderColor: formData.currentFunnelType.includes(option.value)
                    ? 'var(--accent-blue)'
                    : 'var(--border-default)',
                  background: formData.currentFunnelType.includes(option.value)
                    ? 'var(--accent-blue-subtle)'
                    : 'transparent',
                }}
              >
                <Checkbox
                  checked={formData.currentFunnelType.includes(option.value)}
                  onCheckedChange={() => toggleFunnelType(option.value)}
                />
                <span
                  className="text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
          {errors.currentFunnelType && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.currentFunnelType}
            </p>
          )}
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
