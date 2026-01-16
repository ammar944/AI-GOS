"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Target, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { BudgetTargetsData, CampaignDuration } from "@/lib/onboarding/types";
import { CAMPAIGN_DURATION_OPTIONS } from "@/lib/onboarding/types";

interface StepBudgetTargetsProps {
  initialData?: Partial<BudgetTargetsData>;
  onSubmit: (data: BudgetTargetsData) => void;
  onBack?: () => void;
}

export function StepBudgetTargets({
  initialData,
  onSubmit,
  onBack,
}: StepBudgetTargetsProps) {
  const [monthlyBudget, setMonthlyBudget] = useState(
    initialData?.monthlyAdBudget?.toString() || ""
  );
  const [dailyCeiling, setDailyCeiling] = useState(
    initialData?.dailyBudgetCeiling?.toString() || ""
  );
  const [campaignDuration, setCampaignDuration] = useState<CampaignDuration>(
    initialData?.campaignDuration || "ongoing"
  );
  const [targetCpl, setTargetCpl] = useState(
    initialData?.targetCpl?.toString() || ""
  );
  const [targetCac, setTargetCac] = useState(
    initialData?.targetCac?.toString() || ""
  );
  const [targetSqls, setTargetSqls] = useState(
    initialData?.targetSqlsPerMonth?.toString() || ""
  );
  const [targetDemos, setTargetDemos] = useState(
    initialData?.targetDemosPerMonth?.toString() || ""
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    const budget = parseFloat(monthlyBudget);
    if (!monthlyBudget || isNaN(budget) || budget <= 0) {
      newErrors.monthlyAdBudget = "Please enter a valid monthly budget";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function parseOptionalNumber(value: string): number | undefined {
    const num = parseFloat(value);
    return isNaN(num) || num <= 0 ? undefined : num;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      monthlyAdBudget: parseFloat(monthlyBudget),
      dailyBudgetCeiling: parseOptionalNumber(dailyCeiling),
      campaignDuration,
      targetCpl: parseOptionalNumber(targetCpl),
      targetCac: parseOptionalNumber(targetCac),
      targetSqlsPerMonth: parseOptionalNumber(targetSqls),
      targetDemosPerMonth: parseOptionalNumber(targetDemos),
    });
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div className="space-y-2" variants={fadeUp}>
        <h2 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Budget & Targets
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Set your advertising budget and performance goals
        </p>
      </motion.div>

      <motion.div className="grid gap-6" variants={staggerContainer}>
        {/* Budget Section */}
        <motion.div className="space-y-4" variants={staggerItem}>
          <h3 className="flex items-center gap-2 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
            <DollarSign className="h-5 w-5" style={{ color: 'var(--accent-blue)' }} />
            Budget
          </h3>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Monthly Budget */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>$</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Monthly Ad Budget (USD)
                </span>
              </div>
              <FloatingLabelInput
                id="monthlyAdBudget"
                placeholder="5000"
                type="number"
                min="1"
                step="any"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                aria-label="Monthly Ad Budget in USD"
                aria-invalid={!!errors.monthlyAdBudget}
              />
              {errors.monthlyAdBudget && (
                <p className="text-sm" style={{ color: 'var(--error)' }}>
                  {errors.monthlyAdBudget}
                </p>
              )}
            </div>

            {/* Daily Ceiling */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>$</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Daily Budget Ceiling
                </span>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
              </div>
              <FloatingLabelInput
                id="dailyBudgetCeiling"
                placeholder="200"
                type="number"
                min="1"
                step="any"
                value={dailyCeiling}
                onChange={(e) => setDailyCeiling(e.target.value)}
                aria-label="Daily Budget Ceiling in USD"
              />
            </div>
          </div>

          {/* Campaign Duration */}
          <div className="space-y-2">
            <Label
              htmlFor="campaignDuration"
              className="flex items-center gap-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Calendar className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
              Campaign Duration
            </Label>
            <Select
              value={campaignDuration}
              onValueChange={(value) =>
                setCampaignDuration(value as CampaignDuration)
              }
            >
              <SelectTrigger
                id="campaignDuration"
                className="h-11"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {CAMPAIGN_DURATION_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Targets Section */}
        <motion.div className="space-y-4" variants={staggerItem}>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
              <Target className="h-5 w-5" style={{ color: 'var(--accent-blue)' }} />
              Target Outcomes
            </h3>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Leave blank if unknown - we&apos;ll set benchmarks
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Target CPL */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>$</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Target CPL
                </span>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>(Cost per Lead)</span>
              </div>
              <FloatingLabelInput
                id="targetCpl"
                placeholder="50"
                type="number"
                min="1"
                step="any"
                value={targetCpl}
                onChange={(e) => setTargetCpl(e.target.value)}
                aria-label="Target Cost per Lead in USD"
              />
            </div>

            {/* Target CAC */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>$</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Target CAC
                </span>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>(Customer Acquisition Cost)</span>
              </div>
              <FloatingLabelInput
                id="targetCac"
                placeholder="500"
                type="number"
                min="1"
                step="any"
                value={targetCac}
                onChange={(e) => setTargetCac(e.target.value)}
                aria-label="Target Customer Acquisition Cost in USD"
              />
            </div>

            {/* Target SQLs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Target SQLs / month
                </span>
              </div>
              <FloatingLabelInput
                id="targetSqls"
                placeholder="50"
                type="number"
                min="1"
                step="1"
                value={targetSqls}
                onChange={(e) => setTargetSqls(e.target.value)}
                aria-label="Target SQLs per month"
              />
            </div>

            {/* Target Demos */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Target Demos / month
                </span>
              </div>
              <FloatingLabelInput
                id="targetDemos"
                placeholder="30"
                type="number"
                min="1"
                step="1"
                value={targetDemos}
                onChange={(e) => setTargetDemos(e.target.value)}
                aria-label="Target Demos per month"
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div className="flex gap-3 pt-4" variants={staggerItem}>
        {onBack && (
          <MagneticButton
            type="button"
            className="h-10 px-4 py-2 rounded-md text-sm font-medium"
            onClick={onBack}
            style={{
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              background: 'transparent',
            }}
          >
            Back
          </MagneticButton>
        )}
        <MagneticButton
          type="submit"
          className="flex-1 h-10 px-4 py-2 rounded-md text-sm font-medium"
          style={{
            background: 'var(--gradient-primary)',
            color: 'white',
          }}
        >
          Continue
        </MagneticButton>
      </motion.div>
    </motion.form>
  );
}
