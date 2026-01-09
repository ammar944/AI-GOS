"use client";

import { useState } from "react";
import { Building2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusinessBasicsData } from "@/lib/onboarding/types";

interface StepBusinessBasicsProps {
  initialData?: Partial<BusinessBasicsData>;
  onSubmit: (data: BusinessBasicsData) => void;
  onBack?: () => void;
}

export function StepBusinessBasics({
  initialData,
  onSubmit,
  onBack,
}: StepBusinessBasicsProps) {
  const [formData, setFormData] = useState<BusinessBasicsData>({
    businessName: initialData?.businessName || "",
    websiteUrl: initialData?.websiteUrl || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof BusinessBasicsData>(
    field: K,
    value: BusinessBasicsData[K]
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

  /**
   * Validate and normalize URL - only allows http/https protocols
   */
  function validateAndNormalizeUrl(url: string): { valid: boolean; normalized: string; error?: string } {
    const trimmed = url.trim();
    if (!trimmed) {
      return { valid: false, normalized: "", error: "Website URL is required" };
    }

    try {
      const urlWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : "https://" + trimmed;

      const urlObj = new URL(urlWithProtocol);

      // Only allow http/https (prevents javascript:, data:, file:, etc.)
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return { valid: false, normalized: "", error: "URL must use http or https protocol" };
      }

      return { valid: true, normalized: urlObj.toString() };
    } catch {
      return { valid: false, normalized: "", error: "Please enter a valid URL" };
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = "Business name is required";
    }

    const urlResult = validateAndNormalizeUrl(formData.websiteUrl);
    if (!urlResult.valid) {
      newErrors.websiteUrl = urlResult.error || "Invalid URL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Get normalized URL (already validated in validate())
    const urlResult = validateAndNormalizeUrl(formData.websiteUrl);
    const url = urlResult.normalized;

    onSubmit({
      businessName: formData.businessName.trim(),
      websiteUrl: url,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Business Basics
        </h2>
        <p className="text-muted-foreground">
          Let&apos;s start with your company information
        </p>
      </div>

      <div className="grid gap-6">
        {/* Business Name */}
        <div className="space-y-2">
          <Label htmlFor="businessName" className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Business Name
          </Label>
          <Input
            id="businessName"
            placeholder="Acme Inc."
            value={formData.businessName}
            onChange={(e) => updateField("businessName", e.target.value)}
            aria-invalid={!!errors.businessName}
            className="h-11"
          />
          {errors.businessName && (
            <p className="text-sm text-destructive">{errors.businessName}</p>
          )}
        </div>

        {/* Website URL */}
        <div className="space-y-2">
          <Label htmlFor="websiteUrl" className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Website URL
          </Label>
          <Input
            id="websiteUrl"
            placeholder="www.example.com"
            value={formData.websiteUrl}
            onChange={(e) => updateField("websiteUrl", e.target.value)}
            aria-invalid={!!errors.websiteUrl}
            className="h-11"
          />
          {errors.websiteUrl && (
            <p className="text-sm text-destructive">{errors.websiteUrl}</p>
          )}
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
