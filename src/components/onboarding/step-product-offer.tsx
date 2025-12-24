"use client";

import { useState } from "react";
import { Package, DollarSign, Heart, Shield, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ProductOfferData,
  PricingModel,
  FunnelType,
} from "@/lib/onboarding/types";
import {
  PRICING_MODEL_OPTIONS,
  FUNNEL_TYPE_OPTIONS,
} from "@/lib/onboarding/types";

interface StepProductOfferProps {
  initialData?: Partial<ProductOfferData>;
  onSubmit: (data: ProductOfferData) => void;
  onBack?: () => void;
}

export function StepProductOffer({
  initialData,
  onSubmit,
  onBack,
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
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Product & Offer
        </h2>
        <p className="text-muted-foreground">
          Tell us about what you sell and the value you provide
        </p>
      </div>

      <div className="grid gap-6">
        {/* Product Description */}
        <div className="space-y-2">
          <Label
            htmlFor="productDescription"
            className="flex items-center gap-2"
          >
            <Package className="h-4 w-4 text-muted-foreground" />
            In simple terms, what does your product do and what core problem
            does it solve?
          </Label>
          <Textarea
            id="productDescription"
            placeholder="Describe your product/service and the main problem it solves for your customers..."
            value={formData.productDescription}
            onChange={(e) => updateField("productDescription", e.target.value)}
            rows={4}
            aria-invalid={!!errors.productDescription}
            className="resize-none"
          />
          {errors.productDescription && (
            <p className="text-sm text-destructive">
              {errors.productDescription}
            </p>
          )}
        </div>

        {/* Core Deliverables */}
        <div className="space-y-2">
          <Label
            htmlFor="coreDeliverables"
            className="flex items-center gap-2"
          >
            <Layers className="h-4 w-4 text-muted-foreground" />
            What are the core deliverables or features included in your offer?
          </Label>
          <Textarea
            id="coreDeliverables"
            placeholder="List the main features, services, or deliverables your customers receive..."
            value={formData.coreDeliverables}
            onChange={(e) => updateField("coreDeliverables", e.target.value)}
            rows={3}
            aria-invalid={!!errors.coreDeliverables}
            className="resize-none"
          />
          {errors.coreDeliverables && (
            <p className="text-sm text-destructive">
              {errors.coreDeliverables}
            </p>
          )}
        </div>

        {/* Price & Pricing Model Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="offerPrice" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Offer Price (USD)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="offerPrice"
                type="number"
                min="1"
                step="any"
                placeholder="997"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="h-11 pl-7"
                aria-invalid={!!errors.offerPrice}
              />
            </div>
            {errors.offerPrice && (
              <p className="text-sm text-destructive">{errors.offerPrice}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricingModel">How does your pricing work?</Label>
            <Select
              value={formData.pricingModel}
              onValueChange={(value) =>
                updateField("pricingModel", value as PricingModel)
              }
            >
              <SelectTrigger id="pricingModel" className="h-11">
                <SelectValue placeholder="Select pricing model" />
              </SelectTrigger>
              <SelectContent>
                {PRICING_MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="space-y-2">
          <Label htmlFor="valueProp" className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-muted-foreground" />
            What value does your ICP care about most?
          </Label>
          <Textarea
            id="valueProp"
            placeholder="What outcomes, results, or benefits matter most to your ideal customers?"
            value={formData.valueProp}
            onChange={(e) => updateField("valueProp", e.target.value)}
            rows={3}
            aria-invalid={!!errors.valueProp}
            className="resize-none"
          />
          {errors.valueProp && (
            <p className="text-sm text-destructive">{errors.valueProp}</p>
          )}
        </div>

        {/* Current Funnel Type */}
        <div className="space-y-2">
          <Label htmlFor="currentFunnelType">
            What type of funnel are you currently using?
          </Label>
          <Select
            value={formData.currentFunnelType}
            onValueChange={(value) =>
              updateField("currentFunnelType", value as FunnelType)
            }
          >
            <SelectTrigger id="currentFunnelType" className="h-11">
              <SelectValue placeholder="Select funnel type" />
            </SelectTrigger>
            <SelectContent>
              {FUNNEL_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Guarantees */}
        <div className="space-y-2">
          <Label htmlFor="guarantees" className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Do you offer any guarantees, commitments, or risk-reversal elements?
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="guarantees"
            placeholder="E.g., money-back guarantee, performance guarantees, free trial period..."
            value={formData.guarantees}
            onChange={(e) => updateField("guarantees", e.target.value)}
            rows={2}
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
