"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { FloatingLabelTextarea } from "@/components/ui/floating-label-textarea";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Checkbox } from "@/components/ui/checkbox";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { ICPData, CompanySize, ClientSource, OnboardingFormData } from "@/lib/onboarding/types";
import {
  COMPANY_SIZE_OPTIONS,
  CLIENT_SOURCE_OPTIONS,
} from "@/lib/onboarding/types";
import { useStepSuggestion } from "@/hooks/use-step-suggestion";
import { AISuggestButton } from "./ai-suggest-button";
import { FieldSuggestion } from "./field-suggestion";

interface StepICPProps {
  initialData?: Partial<ICPData>;
  onSubmit: (data: ICPData) => void;
  onBack?: () => void;
  wizardFormData?: Partial<OnboardingFormData>;
}

export function StepICP({ initialData, onSubmit, onBack, wizardFormData }: StepICPProps) {
  const [formData, setFormData] = useState<ICPData>({
    primaryIcpDescription: initialData?.primaryIcpDescription || "",
    industryVertical: initialData?.industryVertical || "",
    jobTitles: initialData?.jobTitles || "",
    companySize: initialData?.companySize || [],
    geography: initialData?.geography || "",
    easiestToClose: initialData?.easiestToClose || "",
    buyingTriggers: initialData?.buyingTriggers || "",
    bestClientSources: initialData?.bestClientSources || [],
    secondaryIcp: initialData?.secondaryIcp || "",
    systemsPlatforms: initialData?.systemsPlatforms || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { suggestions, submit: submitSuggestion, isLoading: isSuggesting, stop, fieldsFound } = useStepSuggestion('icp');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function hasSuggestion(fieldKey: string): boolean {
    if (dismissed.has(fieldKey)) return false;
    const field = suggestions?.[fieldKey];
    return field?.value != null && field.value !== '';
  }

  function getSuggestion(fieldKey: string) {
    return suggestions?.[fieldKey];
  }

  function updateField<K extends keyof ICPData>(field: K, value: ICPData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function toggleCompanySize(size: CompanySize) {
    const current = formData.companySize;
    if (current.includes(size)) {
      updateField(
        "companySize",
        current.filter((s) => s !== size)
      );
    } else {
      updateField("companySize", [...current, size]);
    }
  }

  function toggleSource(source: ClientSource) {
    const current = formData.bestClientSources;
    if (current.includes(source)) {
      updateField(
        "bestClientSources",
        current.filter((s) => s !== source)
      );
    } else {
      updateField("bestClientSources", [...current, source]);
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.primaryIcpDescription.trim()) {
      newErrors.primaryIcpDescription = "ICP description is required";
    }
    if (!formData.industryVertical.trim()) {
      newErrors.industryVertical = "Industry is required";
    }
    if (!formData.jobTitles.trim()) {
      newErrors.jobTitles = "Job titles are required";
    }
    if (!formData.geography.trim()) {
      newErrors.geography = "Geography is required";
    }
    if (!formData.easiestToClose.trim()) {
      newErrors.easiestToClose = "This field is required";
    }
    if (!formData.buyingTriggers.trim()) {
      newErrors.buyingTriggers = "Buying triggers are required";
    }
    if (formData.companySize.length === 0) {
      newErrors.companySize = "Select at least one company size";
    }
    if (formData.bestClientSources.length === 0) {
      newErrors.bestClientSources = "Select at least one source";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...formData,
      primaryIcpDescription: formData.primaryIcpDescription.trim(),
      industryVertical: formData.industryVertical.trim(),
      jobTitles: formData.jobTitles.trim(),
      geography: formData.geography.trim(),
      easiestToClose: formData.easiestToClose.trim(),
      buyingTriggers: formData.buyingTriggers.trim(),
      secondaryIcp: formData.secondaryIcp?.trim() || "",
      systemsPlatforms: formData.systemsPlatforms?.trim() || "",
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
            Ideal Customer Profile
          </h2>
          <AISuggestButton
            onClick={() => {
              if (!wizardFormData) return;
              setDismissed(new Set());
              submitSuggestion(wizardFormData);
            }}
            isLoading={isSuggesting}
            fieldsFound={fieldsFound}
            disabled={!wizardFormData?.businessBasics?.businessName}
          />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Define who your best customers are and how to reach them
        </p>
      </motion.div>

      <motion.div
        className="grid gap-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Primary ICP Description */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="Who is your ideal client?"
            value={formData.primaryIcpDescription}
            onChange={(e) =>
              updateField("primaryIcpDescription", e.target.value)
            }
            rows={4}
            aria-invalid={!!errors.primaryIcpDescription}
          />
          {errors.primaryIcpDescription && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.primaryIcpDescription}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('primaryIcpDescription')?.value ?? ''}
            reasoning={getSuggestion('primaryIcpDescription')?.reasoning ?? ''}
            confidence={getSuggestion('primaryIcpDescription')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('primaryIcpDescription')?.value;
              if (val) updateField('primaryIcpDescription', val);
              setDismissed(prev => new Set(prev).add('primaryIcpDescription'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('primaryIcpDescription'))}
            isVisible={hasSuggestion('primaryIcpDescription')}
          />
        </motion.div>

        {/* Industry & Job Titles Row */}
        <motion.div className="grid gap-6 md:grid-cols-2" variants={staggerItem}>
          <div>
            <FloatingLabelInput
              label="Industry Vertical"
              value={formData.industryVertical}
              onChange={(e) => updateField("industryVertical", e.target.value)}
              aria-invalid={!!errors.industryVertical}
            />
            {errors.industryVertical && (
              <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
                {errors.industryVertical}
              </p>
            )}
            <FieldSuggestion
              suggestedValue={getSuggestion('industryVertical')?.value ?? ''}
              reasoning={getSuggestion('industryVertical')?.reasoning ?? ''}
              confidence={getSuggestion('industryVertical')?.confidence ?? 0}
              onAccept={() => {
                const val = getSuggestion('industryVertical')?.value;
                if (val) updateField('industryVertical', val);
                setDismissed(prev => new Set(prev).add('industryVertical'));
              }}
              onReject={() => setDismissed(prev => new Set(prev).add('industryVertical'))}
              isVisible={hasSuggestion('industryVertical')}
            />
          </div>

          <div>
            <FloatingLabelInput
              label="Target Job Titles"
              value={formData.jobTitles}
              onChange={(e) => updateField("jobTitles", e.target.value)}
              aria-invalid={!!errors.jobTitles}
            />
            {errors.jobTitles && (
              <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
                {errors.jobTitles}
              </p>
            )}
            <FieldSuggestion
              suggestedValue={getSuggestion('jobTitles')?.value ?? ''}
              reasoning={getSuggestion('jobTitles')?.reasoning ?? ''}
              confidence={getSuggestion('jobTitles')?.confidence ?? 0}
              onAccept={() => {
                const val = getSuggestion('jobTitles')?.value;
                if (val) updateField('jobTitles', val);
                setDismissed(prev => new Set(prev).add('jobTitles'));
              }}
              onReject={() => setDismissed(prev => new Set(prev).add('jobTitles'))}
              isVisible={hasSuggestion('jobTitles')}
            />
          </div>
        </motion.div>

        {/* Company Size */}
        <motion.div className="space-y-3" variants={staggerItem}>
          <label
            className="text-[14px] font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Target Company Size
          </label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {COMPANY_SIZE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-4 transition-all"
                style={{
                  border: '1px solid',
                  borderColor: formData.companySize.includes(option.value)
                    ? 'var(--accent-blue)'
                    : 'var(--border-default)',
                  background: formData.companySize.includes(option.value)
                    ? 'var(--accent-blue-subtle)'
                    : 'transparent',
                }}
              >
                <Checkbox
                  checked={formData.companySize.includes(option.value)}
                  onCheckedChange={() => toggleCompanySize(option.value)}
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
          {errors.companySize && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.companySize}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={(() => {
              const val = getSuggestion('companySize')?.value;
              if (Array.isArray(val)) return val.map((v: string) => COMPANY_SIZE_OPTIONS.find(o => o.value === v)?.label ?? v).join(', ');
              return String(val ?? '');
            })()}
            reasoning={getSuggestion('companySize')?.reasoning ?? ''}
            confidence={getSuggestion('companySize')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('companySize')?.value;
              if (Array.isArray(val)) updateField('companySize', val as CompanySize[]);
              else if (val) updateField('companySize', [val] as CompanySize[]);
              setDismissed(prev => new Set(prev).add('companySize'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('companySize'))}
            isVisible={hasSuggestion('companySize')}
          />
        </motion.div>

        {/* Geography */}
        <motion.div variants={staggerItem}>
          <div>
            <FloatingLabelInput
              label="Geography"
              value={formData.geography}
              onChange={(e) => updateField("geography", e.target.value)}
              aria-invalid={!!errors.geography}
            />
            {errors.geography && (
              <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
                {errors.geography}
              </p>
            )}
            <FieldSuggestion
              suggestedValue={getSuggestion('geography')?.value ?? ''}
              reasoning={getSuggestion('geography')?.reasoning ?? ''}
              confidence={getSuggestion('geography')?.confidence ?? 0}
              onAccept={() => {
                const val = getSuggestion('geography')?.value;
                if (val) updateField('geography', val);
                setDismissed(prev => new Set(prev).add('geography'));
              }}
              onReject={() => setDismissed(prev => new Set(prev).add('geography'))}
              isVisible={hasSuggestion('geography')}
            />
          </div>
        </motion.div>

        {/* Easiest to Close */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What type of companies are easiest for you to close and why?"
            value={formData.easiestToClose}
            onChange={(e) => updateField("easiestToClose", e.target.value)}
            rows={3}
            aria-invalid={!!errors.easiestToClose}
          />
          {errors.easiestToClose && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.easiestToClose}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('easiestToClose')?.value ?? ''}
            reasoning={getSuggestion('easiestToClose')?.reasoning ?? ''}
            confidence={getSuggestion('easiestToClose')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('easiestToClose')?.value;
              if (val) updateField('easiestToClose', val);
              setDismissed(prev => new Set(prev).add('easiestToClose'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('easiestToClose'))}
            isVisible={hasSuggestion('easiestToClose')}
          />
        </motion.div>

        {/* Buying Triggers */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="What problems or situations make them ready to buy?"
            value={formData.buyingTriggers}
            onChange={(e) => updateField("buyingTriggers", e.target.value)}
            rows={3}
            aria-invalid={!!errors.buyingTriggers}
          />
          {errors.buyingTriggers && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.buyingTriggers}
            </p>
          )}
          <FieldSuggestion
            suggestedValue={getSuggestion('buyingTriggers')?.value ?? ''}
            reasoning={getSuggestion('buyingTriggers')?.reasoning ?? ''}
            confidence={getSuggestion('buyingTriggers')?.confidence ?? 0}
            onAccept={() => {
              const val = getSuggestion('buyingTriggers')?.value;
              if (val) updateField('buyingTriggers', val);
              setDismissed(prev => new Set(prev).add('buyingTriggers'));
            }}
            onReject={() => setDismissed(prev => new Set(prev).add('buyingTriggers'))}
            isVisible={hasSuggestion('buyingTriggers')}
          />
        </motion.div>

        {/* Best Client Sources */}
        <motion.div className="space-y-3" variants={staggerItem}>
          <label
            className="text-[14px] font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Where do your best clients typically come from?
          </label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {CLIENT_SOURCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-4 transition-all"
                style={{
                  border: '1px solid',
                  borderColor: formData.bestClientSources.includes(option.value)
                    ? 'var(--accent-blue)'
                    : 'var(--border-default)',
                  background: formData.bestClientSources.includes(option.value)
                    ? 'var(--accent-blue-subtle)'
                    : 'transparent',
                }}
              >
                <Checkbox
                  checked={formData.bestClientSources.includes(option.value)}
                  onCheckedChange={() => toggleSource(option.value)}
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
          {errors.bestClientSources && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--error)' }}>
              {errors.bestClientSources}
            </p>
          )}
        </motion.div>

        {/* Secondary ICP */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="Secondary ICP (optional)"
            value={formData.secondaryIcp}
            onChange={(e) => updateField("secondaryIcp", e.target.value)}
            rows={3}
          />
        </motion.div>

        {/* Systems & Platforms */}
        <motion.div variants={staggerItem}>
          <FloatingLabelTextarea
            label="Systems & Platforms Used (optional)"
            value={formData.systemsPlatforms || ""}
            onChange={(e) => updateField("systemsPlatforms", e.target.value)}
            rows={3}
          />
          <p className="text-[12px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Include CRM, marketing automation, project management, and communication tools
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
