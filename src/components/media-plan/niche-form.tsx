"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NicheFormData } from "@/lib/media-plan/types";

interface NicheFormProps {
  initialData?: Partial<NicheFormData>;
  onSubmit: (data: NicheFormData) => void;
  onBack?: () => void;
}

export function NicheForm({ initialData, onSubmit, onBack }: NicheFormProps) {
  const [industry, setIndustry] = useState(initialData?.industry || "");
  const [audience, setAudience] = useState(initialData?.audience || "");
  const [icp, setIcp] = useState(initialData?.icp || "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!industry.trim()) {
      newErrors.industry = "Industry is required";
    }
    if (!audience.trim()) {
      newErrors.audience = "Target audience is required";
    }
    if (!icp.trim()) {
      newErrors.icp = "Ideal Customer Profile is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    onSubmit({
      industry: industry.trim(),
      audience: audience.trim(),
      icp: icp.trim(),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Niche Information</CardTitle>
        <CardDescription>
          Tell us about your target market and ideal customer
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              placeholder="e.g., SaaS, E-commerce, Healthcare, Real Estate"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              aria-invalid={!!errors.industry}
            />
            {errors.industry && (
              <p className="text-sm text-destructive">{errors.industry}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience</Label>
            <Input
              id="audience"
              placeholder="e.g., Small business owners, Marketing managers, Fitness enthusiasts"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              aria-invalid={!!errors.audience}
            />
            {errors.audience && (
              <p className="text-sm text-destructive">{errors.audience}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="icp">Ideal Customer Profile (ICP)</Label>
            <Textarea
              id="icp"
              placeholder="Describe your ideal customer in detail. Include their role, company size, pain points, goals, and what makes them a perfect fit for your offer..."
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              rows={5}
              aria-invalid={!!errors.icp}
            />
            {errors.icp && (
              <p className="text-sm text-destructive">{errors.icp}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
            <Button type="submit" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
