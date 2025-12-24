"use client";

import { useState } from "react";
import { Target, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Budget & Targets
        </h2>
        <p className="text-muted-foreground">
          Set your advertising budget and performance goals
        </p>
      </div>

      <div className="grid gap-6">
        {/* Budget Section */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-medium">
            <DollarSign className="h-5 w-5 text-primary" />
            Budget
          </h3>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Monthly Budget */}
            <div className="space-y-2">
              <Label htmlFor="monthlyAdBudget">Monthly Ad Budget (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="monthlyAdBudget"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="5000"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  className="h-11 pl-7"
                  aria-invalid={!!errors.monthlyAdBudget}
                />
              </div>
              {errors.monthlyAdBudget && (
                <p className="text-sm text-destructive">
                  {errors.monthlyAdBudget}
                </p>
              )}
            </div>

            {/* Daily Ceiling */}
            <div className="space-y-2">
              <Label htmlFor="dailyBudgetCeiling">
                Daily Budget Ceiling{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="dailyBudgetCeiling"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="200"
                  value={dailyCeiling}
                  onChange={(e) => setDailyCeiling(e.target.value)}
                  className="h-11 pl-7"
                />
              </div>
            </div>
          </div>

          {/* Campaign Duration */}
          <div className="space-y-2">
            <Label
              htmlFor="campaignDuration"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Campaign Duration
            </Label>
            <Select
              value={campaignDuration}
              onValueChange={(value) =>
                setCampaignDuration(value as CampaignDuration)
              }
            >
              <SelectTrigger id="campaignDuration" className="h-11">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Targets Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-medium">
              <Target className="h-5 w-5 text-primary" />
              Target Outcomes
            </h3>
            <span className="text-sm text-muted-foreground">
              Leave blank if unknown - we&apos;ll set benchmarks
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Target CPL */}
            <div className="space-y-2">
              <Label htmlFor="targetCpl">
                Target CPL{" "}
                <span className="text-muted-foreground">(Cost per Lead)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="targetCpl"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="50"
                  value={targetCpl}
                  onChange={(e) => setTargetCpl(e.target.value)}
                  className="h-11 pl-7"
                />
              </div>
            </div>

            {/* Target CAC */}
            <div className="space-y-2">
              <Label htmlFor="targetCac">
                Target CAC{" "}
                <span className="text-muted-foreground">
                  (Customer Acquisition Cost)
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="targetCac"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="500"
                  value={targetCac}
                  onChange={(e) => setTargetCac(e.target.value)}
                  className="h-11 pl-7"
                />
              </div>
            </div>

            {/* Target SQLs */}
            <div className="space-y-2">
              <Label htmlFor="targetSqls" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Target SQLs / month
              </Label>
              <Input
                id="targetSqls"
                type="number"
                min="1"
                step="1"
                placeholder="50"
                value={targetSqls}
                onChange={(e) => setTargetSqls(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Target Demos */}
            <div className="space-y-2">
              <Label htmlFor="targetDemos">Target Demos / month</Label>
              <Input
                id="targetDemos"
                type="number"
                min="1"
                step="1"
                placeholder="30"
                value={targetDemos}
                onChange={(e) => setTargetDemos(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} size="lg">
            Back
          </Button>
        )}
        <Button type="submit" className="flex-1" size="lg">
          Continue
        </Button>
      </div>
    </form>
  );
}
