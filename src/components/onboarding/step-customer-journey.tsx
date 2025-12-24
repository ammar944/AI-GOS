"use client";

import { useState } from "react";
import { Route, Sparkles, MessageSquare, Clock, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomerJourneyData, SalesCycleLength } from "@/lib/onboarding/types";
import { SALES_CYCLE_OPTIONS } from "@/lib/onboarding/types";

interface StepCustomerJourneyProps {
  initialData?: Partial<CustomerJourneyData>;
  onSubmit: (data: CustomerJourneyData) => void;
  onBack?: () => void;
}

export function StepCustomerJourney({
  initialData,
  onSubmit,
  onBack,
}: StepCustomerJourneyProps) {
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
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Customer Journey
        </h2>
        <p className="text-muted-foreground">
          Describe the transformation your customers experience
        </p>
      </div>

      <div className="grid gap-6">
        {/* Situation Before Buying */}
        <div className="space-y-2">
          <Label
            htmlFor="situationBeforeBuying"
            className="flex items-center gap-2"
          >
            <Route className="h-4 w-4 text-muted-foreground" />
            What situation is your ideal client usually in before buying from
            you?
          </Label>
          <Textarea
            id="situationBeforeBuying"
            placeholder="Describe their current state, struggles, and what they've typically tried before..."
            value={formData.situationBeforeBuying}
            onChange={(e) =>
              updateField("situationBeforeBuying", e.target.value)
            }
            rows={4}
            aria-invalid={!!errors.situationBeforeBuying}
            className="resize-none"
          />
          {errors.situationBeforeBuying && (
            <p className="text-sm text-destructive">
              {errors.situationBeforeBuying}
            </p>
          )}
        </div>

        {/* Desired Transformation */}
        <div className="space-y-2">
          <Label
            htmlFor="desiredTransformation"
            className="flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            What outcome or transformation are they hoping to achieve?
          </Label>
          <Textarea
            id="desiredTransformation"
            placeholder="The end result, goals, or transformation your customers are seeking..."
            value={formData.desiredTransformation}
            onChange={(e) =>
              updateField("desiredTransformation", e.target.value)
            }
            rows={4}
            aria-invalid={!!errors.desiredTransformation}
            className="resize-none"
          />
          {errors.desiredTransformation && (
            <p className="text-sm text-destructive">
              {errors.desiredTransformation}
            </p>
          )}
        </div>

        {/* Common Objections */}
        <div className="space-y-2">
          <Label
            htmlFor="commonObjections"
            className="flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            What common objections do prospects bring up and how do you address
            them?
          </Label>
          <Textarea
            id="commonObjections"
            placeholder="List typical objections and your responses to them..."
            value={formData.commonObjections}
            onChange={(e) => updateField("commonObjections", e.target.value)}
            rows={4}
            aria-invalid={!!errors.commonObjections}
            className="resize-none"
          />
          {errors.commonObjections && (
            <p className="text-sm text-destructive">
              {errors.commonObjections}
            </p>
          )}
        </div>

        {/* Sales Cycle Length */}
        <div className="space-y-2">
          <Label htmlFor="salesCycleLength" className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Average Sales Cycle Length
          </Label>
          <Select
            value={formData.salesCycleLength}
            onValueChange={(value) =>
              updateField("salesCycleLength", value as SalesCycleLength)
            }
          >
            <SelectTrigger id="salesCycleLength" className="h-11">
              <SelectValue placeholder="Select sales cycle length" />
            </SelectTrigger>
            <SelectContent>
              {SALES_CYCLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Time from first contact to closed sale
          </p>
        </div>

        {/* Sales Process Overview */}
        <div className="space-y-2">
          <Label
            htmlFor="salesProcessOverview"
            className="flex items-center gap-2"
          >
            <Workflow className="h-4 w-4 text-muted-foreground" />
            What does your sales process look like from lead to close?
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="salesProcessOverview"
            placeholder="E.g., Lead capture → Discovery call → Demo → Proposal → Close..."
            value={formData.salesProcessOverview}
            onChange={(e) =>
              updateField("salesProcessOverview", e.target.value)
            }
            rows={3}
            className="resize-none"
          />
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
