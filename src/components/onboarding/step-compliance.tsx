"use client";

import { useState } from "react";
import { Shield, AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ComplianceData } from "@/lib/onboarding/types";

interface StepComplianceProps {
  initialData?: Partial<ComplianceData>;
  onSubmit: (data: ComplianceData) => void;
  onBack?: () => void;
}

export function StepCompliance({
  initialData,
  onSubmit,
  onBack,
}: StepComplianceProps) {
  const [formData, setFormData] = useState<ComplianceData>({
    topicsToAvoid: initialData?.topicsToAvoid || "",
    claimRestrictions: initialData?.claimRestrictions || "",
  });

  function updateField<K extends keyof ComplianceData>(
    field: K,
    value: ComplianceData[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    onSubmit({
      topicsToAvoid: formData.topicsToAvoid?.trim() || "",
      claimRestrictions: formData.claimRestrictions?.trim() || "",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Compliance & Restrictions
        </h2>
        <p className="text-muted-foreground">
          Help us avoid disapproved ads and protect your brand
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex gap-3">
          <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Why this matters</p>
            <p className="text-sm text-muted-foreground">
              Ad platforms have strict policies. Knowing your restrictions
              upfront helps us create compliant ads that won&apos;t get
              rejected.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Topics to Avoid */}
        <div className="space-y-2">
          <Label htmlFor="topicsToAvoid" className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-muted-foreground" />
            Topics we cannot mention{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="topicsToAvoid"
            placeholder="E.g., competitor names, specific health claims, income guarantees, political topics..."
            value={formData.topicsToAvoid}
            onChange={(e) => updateField("topicsToAvoid", e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            List any topics, words, or themes that should not appear in your
            advertising
          </p>
        </div>

        {/* Claim Restrictions */}
        <div className="space-y-2">
          <Label
            htmlFor="claimRestrictions"
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Claims we must verify or avoid{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="claimRestrictions"
            placeholder="E.g., no income claims without disclaimers, no before/after comparisons, FDA compliance requirements..."
            value={formData.claimRestrictions}
            onChange={(e) => updateField("claimRestrictions", e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Any claims that require disclaimers, documentation, or should be
            avoided entirely
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
          Complete Onboarding
        </Button>
      </div>
    </form>
  );
}
