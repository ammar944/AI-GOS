"use client";

import { useState } from "react";
import { Sparkles, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrandPositioningData } from "@/lib/onboarding/types";

interface StepBrandPositioningProps {
  initialData?: Partial<BrandPositioningData>;
  onSubmit: (data: BrandPositioningData) => void;
  onBack?: () => void;
}

export function StepBrandPositioning({
  initialData,
  onSubmit,
  onBack,
}: StepBrandPositioningProps) {
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
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Brand & Positioning
        </h2>
        <p className="text-muted-foreground">
          Define how you want to be perceived in the market
        </p>
      </div>

      <div className="grid gap-6">
        {/* Brand Positioning */}
        <div className="space-y-2">
          <Label
            htmlFor="brandPositioning"
            className="flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            What do you want your brand to be known for in your market?
          </Label>
          <Textarea
            id="brandPositioning"
            placeholder="The reputation, perception, and positioning you want to own in your industry..."
            value={formData.brandPositioning}
            onChange={(e) => updateField("brandPositioning", e.target.value)}
            rows={5}
            aria-invalid={!!errors.brandPositioning}
            className="resize-none"
          />
          {errors.brandPositioning && (
            <p className="text-sm text-destructive">
              {errors.brandPositioning}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Think about the key attributes, expertise, or values you want
            associated with your brand
          </p>
        </div>

        {/* Customer Voice */}
        <div className="space-y-2">
          <Label htmlFor="customerVoice" className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-muted-foreground" />
            How would your best customer describe you?
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="customerVoice"
            placeholder="In their own words, how would a satisfied customer describe working with you or using your product?"
            value={formData.customerVoice}
            onChange={(e) => updateField("customerVoice", e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            This helps us understand the voice and language of your customers
          </p>
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
