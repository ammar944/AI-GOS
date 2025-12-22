"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BriefingFormData, SalesCycleLength } from "@/lib/media-plan/types";
import { SALES_CYCLE_OPTIONS } from "@/lib/media-plan/types";

interface BriefingFormProps {
  initialData?: Partial<BriefingFormData>;
  onSubmit: (data: BriefingFormData) => void;
  onBack?: () => void;
}

export function BriefingForm({ initialData, onSubmit, onBack }: BriefingFormProps) {
  const [budget, setBudget] = useState<string>(
    initialData?.budget?.toString() || ""
  );
  const [offerPrice, setOfferPrice] = useState<string>(
    initialData?.offerPrice?.toString() || ""
  );
  const [salesCycleLength, setSalesCycleLength] = useState<SalesCycleLength | "">(
    initialData?.salesCycleLength || ""
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    const budgetNum = parseFloat(budget);
    if (!budget || isNaN(budgetNum) || budgetNum <= 0) {
      newErrors.budget = "Budget must be a positive number";
    }

    const offerPriceNum = parseFloat(offerPrice);
    if (!offerPrice || isNaN(offerPriceNum) || offerPriceNum <= 0) {
      newErrors.offerPrice = "Offer price must be a positive number";
    }

    if (!salesCycleLength) {
      newErrors.salesCycleLength = "Please select a sales cycle length";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    onSubmit({
      budget: parseFloat(budget),
      offerPrice: parseFloat(offerPrice),
      salesCycleLength: salesCycleLength as SalesCycleLength,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Briefing</CardTitle>
        <CardDescription>
          Provide your budget and offer details for the media plan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="budget">Monthly Ad Budget (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="budget"
                type="number"
                min="1"
                step="100"
                placeholder="5000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="pl-7"
                aria-invalid={!!errors.budget}
              />
            </div>
            {errors.budget && (
              <p className="text-sm text-destructive">{errors.budget}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="offerPrice">Offer Price (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="offerPrice"
                type="number"
                min="1"
                step="1"
                placeholder="997"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                className="pl-7"
                aria-invalid={!!errors.offerPrice}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The price of your main product or service
            </p>
            {errors.offerPrice && (
              <p className="text-sm text-destructive">{errors.offerPrice}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="salesCycle">Average Sales Cycle Length</Label>
            <Select
              value={salesCycleLength}
              onValueChange={(value) => setSalesCycleLength(value as SalesCycleLength)}
            >
              <SelectTrigger id="salesCycle" aria-invalid={!!errors.salesCycleLength}>
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
            {errors.salesCycleLength && (
              <p className="text-sm text-destructive">{errors.salesCycleLength}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
            <Button type="submit" className="flex-1">
              Generate Media Plan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
