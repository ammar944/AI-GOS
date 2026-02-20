"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { FloatingLabelTextarea } from "@/components/ui/floating-label-textarea";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Checkbox } from "@/components/ui/checkbox";
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
  PricingTier,
  FunnelType,
  OnboardingFormData,
} from "@/lib/onboarding/types";
import {
  PRICING_MODEL_OPTIONS,
  FUNNEL_TYPE_OPTIONS,
  derivePricingFields,
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

/** Migrate old single-price data to a single tier */
function initTiers(data?: Partial<ProductOfferData>): PricingTier[] {
  if (data?.pricingTiers && data.pricingTiers.length > 0) {
    return data.pricingTiers;
  }
  if (data?.offerPrice && data.offerPrice > 0) {
    return [{
      name: "Main",
      price: data.offerPrice,
      billingCycle: data.pricingModel?.[0] ?? "monthly",
      isPrimary: true,
    }];
  }
  return [];
}

export function StepProductOffer({
  initialData,
  onSubmit,
  onBack,
  wizardFormData,
}: StepProductOfferProps) {
  const [productDescription, setProductDescription] = useState(initialData?.productDescription || "");
  const [coreDeliverables, setCoreDeliverables] = useState(initialData?.coreDeliverables || "");
  const [valueProp, setValueProp] = useState(initialData?.valueProp || "");
  const [guarantees, setGuarantees] = useState(initialData?.guarantees || "");
  const [currentFunnelType, setCurrentFunnelType] = useState<FunnelType[]>(initialData?.currentFunnelType || []);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(() => initTiers(initialData));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const { suggestions, submit: submitSuggestion, isLoading: isSuggesting, fieldsFound } = useStepSuggestion('productOffer');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function hasSuggestion(fieldKey: string): boolean {
    if (dismissed.has(fieldKey)) return false;
    const field = suggestions?.[fieldKey];
    return field?.value != null && field.value !== '';
  }

  function getSuggestion(fieldKey: string) {
    return suggestions?.[fieldKey];
  }

  function clearError(key: string) {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  // --- Tier management ---

  function updateTier(index: number, patch: Partial<PricingTier>) {
    setPricingTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    clearError("pricingTiers");
  }

  function setPrimaryTier(index: number) {
    setPricingTiers((prev) =>
      prev.map((t, i) => ({ ...t, isPrimary: i === index }))
    );
  }

  function addTier() {
    setPricingTiers((prev) => [
      ...prev,
      { name: "", price: 0, billingCycle: "monthly" as PricingModel, isPrimary: prev.length === 0 },
    ]);
    clearError("pricingTiers");
  }

  function removeTier(index: number) {
    setPricingTiers((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // If removed tier was primary, auto-set first as primary
      if (next.length > 0 && !next.some((t) => t.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  }

  function toggleFunnelType(ftype: FunnelType) {
    setCurrentFunnelType((prev) =>
      prev.includes(ftype)
        ? prev.filter((f) => f !== ftype)
        : [...prev, ftype]
    );
    clearError("currentFunnelType");
  }

  // --- Validation ---

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!productDescription.trim()) {
      newErrors.productDescription = "Product description is required";
    }
    if (!coreDeliverables.trim()) {
      newErrors.coreDeliverables = "Core deliverables are required";
    }
    if (pricingTiers.length === 0) {
      newErrors.pricingTiers = "At least one pricing tier is required";
    } else {
      for (let i = 0; i < pricingTiers.length; i++) {
        const t = pricingTiers[i];
        if (!t.name.trim()) {
          newErrors.pricingTiers = `Tier ${i + 1} needs a name`;
          break;
        }
        if (!t.price || t.price <= 0) {
          newErrors.pricingTiers = `Tier "${t.name || i + 1}" needs a price greater than 0`;
          break;
        }
      }
    }
    if (!valueProp.trim()) {
      newErrors.valueProp = "Value proposition is required";
    }
    if (currentFunnelType.length === 0) {
      newErrors.currentFunnelType = "Select at least one funnel type";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // --- Submit ---

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Ensure exactly one primary
    const tiers = [...pricingTiers];
    if (!tiers.some((t) => t.isPrimary) && tiers.length > 0) {
      tiers[0].isPrimary = true;
    }

    const { offerPrice, pricingModel } = derivePricingFields(tiers);

    onSubmit({
      productDescription: productDescription.trim(),
      coreDeliverables: coreDeliverables.trim(),
      offerPrice,
      pricingModel,
      pricingTiers: tiers,
      valueProp: valueProp.trim(),
      guarantees: guarantees?.trim() || "",
      currentFunnelType,
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
            value={productDescription}
            onChange={(e) => { setProductDescription(e.target.value); clearError("productDescription"); }}
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
              if (val) setProductDescription(val);
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
            value={coreDeliverables}
            onChange={(e) => { setCoreDeliverables(e.target.value); clearError("coreDeliverables"); }}
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
              if (val) setCoreDeliverables(val);
              setDismissed(prev => new Set(prev).add('coreDeliverables'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('coreDeliverables'))}
            isVisible={hasSuggestion('coreDeliverables')}
          />
        </motion.div>

        {/* Pricing Tiers */}
        <motion.div className="space-y-3" variants={staggerItem}>
          <label
            className="text-[14px] font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Pricing Tiers
          </label>
          <div className="space-y-3">
            {pricingTiers.map((tier, index) => (
              <div
                key={index}
                className="rounded-lg p-4 space-y-3 transition-all"
                style={{
                  border: '1px solid',
                  borderColor: tier.isPrimary ? 'var(--accent-blue)' : 'var(--border-default)',
                  background: tier.isPrimary ? 'var(--accent-blue-subtle)' : 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Tier Name */}
                  <div className="flex-1">
                    <FloatingLabelInput
                      label={`Tier ${index + 1} Name`}
                      value={tier.name}
                      onChange={(e) => updateTier(index, { name: e.target.value })}
                      placeholder="e.g., Starter"
                    />
                  </div>
                  {/* Remove button */}
                  {pricingTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      className="flex-shrink-0 p-1.5 rounded-md transition-colors hover:bg-white/10"
                      style={{ color: 'var(--text-tertiary)' }}
                      aria-label={`Remove tier ${tier.name || index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Price */}
                  <div className="relative flex-1">
                    <span
                      className="absolute left-0 top-4 text-[16px]"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      $
                    </span>
                    <FloatingLabelInput
                      label="Price (USD)"
                      type="number"
                      min="1"
                      step="any"
                      value={tier.price > 0 ? tier.price.toString() : ""}
                      onChange={(e) => updateTier(index, { price: parseFloat(e.target.value) || 0 })}
                      className="pl-4"
                    />
                  </div>

                  {/* Billing Cycle */}
                  <div className="flex-1">
                    <Select
                      value={tier.billingCycle}
                      onValueChange={(val) => updateTier(index, { billingCycle: val as PricingModel })}
                    >
                      <SelectTrigger
                        className="h-[52px] rounded-lg text-[14px]"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <SelectValue placeholder="Billing cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICING_MODEL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Primary Radio */}
                  <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
                    <input
                      type="radio"
                      name="primaryTier"
                      checked={tier.isPrimary === true}
                      onChange={() => setPrimaryTier(index)}
                      className="h-4 w-4 accent-blue-500"
                    />
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: tier.isPrimary ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
                    >
                      Primary
                    </span>
                  </label>
                </div>
              </div>
            ))}

            {/* Add Tier Button */}
            <button
              type="button"
              onClick={addTier}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-medium transition-all"
              style={{
                border: '1px dashed var(--border-default)',
                color: 'var(--text-secondary)',
                background: 'transparent',
              }}
            >
              <Plus className="h-4 w-4" />
              Add Pricing Tier
            </button>
          </div>

          {errors.pricingTiers && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.pricingTiers}
            </p>
          )}
        </motion.div>

        {/* Value Proposition */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What value does your ICP care about most?"
            value={valueProp}
            onChange={(e) => { setValueProp(e.target.value); clearError("valueProp"); }}
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
              if (val) setValueProp(val);
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
                  borderColor: currentFunnelType.includes(option.value)
                    ? 'var(--accent-blue)'
                    : 'var(--border-default)',
                  background: currentFunnelType.includes(option.value)
                    ? 'var(--accent-blue-subtle)'
                    : 'transparent',
                }}
              >
                <Checkbox
                  checked={currentFunnelType.includes(option.value)}
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
            value={guarantees}
            onChange={(e) => setGuarantees(e.target.value)}
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
