"use client";

import { useState } from "react";
import { TrendingUp, Swords, AlertTriangle, Lightbulb, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MarketCompetitionData } from "@/lib/onboarding/types";

interface StepMarketCompetitionProps {
  initialData?: Partial<MarketCompetitionData>;
  onSubmit: (data: MarketCompetitionData) => void;
  onBack?: () => void;
}

export function StepMarketCompetition({
  initialData,
  onSubmit,
  onBack,
}: StepMarketCompetitionProps) {
  const [formData, setFormData] = useState<MarketCompetitionData>({
    topCompetitors: initialData?.topCompetitors || "",
    uniqueEdge: initialData?.uniqueEdge || "",
    competitorFrustrations: initialData?.competitorFrustrations || "",
    marketBottlenecks: initialData?.marketBottlenecks || "",
    proprietaryTech: initialData?.proprietaryTech || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof MarketCompetitionData>(
    field: K,
    value: MarketCompetitionData[K]
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

    if (!formData.topCompetitors.trim()) {
      newErrors.topCompetitors = "Competitors are required";
    }
    if (!formData.uniqueEdge.trim()) {
      newErrors.uniqueEdge = "Unique edge is required";
    }
    if (!formData.marketBottlenecks.trim()) {
      newErrors.marketBottlenecks = "Market bottlenecks are required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...formData,
      topCompetitors: formData.topCompetitors.trim(),
      uniqueEdge: formData.uniqueEdge.trim(),
      competitorFrustrations: formData.competitorFrustrations?.trim() || "",
      marketBottlenecks: formData.marketBottlenecks.trim(),
      proprietaryTech: formData.proprietaryTech?.trim() || "",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Market & Competition
        </h2>
        <p className="text-muted-foreground">
          Help us understand your competitive landscape and market dynamics
        </p>
      </div>

      <div className="grid gap-6">
        {/* Top Competitors */}
        <div className="space-y-2">
          <Label htmlFor="topCompetitors" className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-muted-foreground" />
            Who are your top competitors?
          </Label>
          <Textarea
            id="topCompetitors"
            placeholder="List your main competitors and briefly describe what they offer..."
            value={formData.topCompetitors}
            onChange={(e) => updateField("topCompetitors", e.target.value)}
            rows={4}
            aria-invalid={!!errors.topCompetitors}
            className="resize-none"
          />
          {errors.topCompetitors && (
            <p className="text-sm text-destructive">{errors.topCompetitors}</p>
          )}
        </div>

        {/* Unique Edge */}
        <div className="space-y-2">
          <Label htmlFor="uniqueEdge" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            What makes your product more attractive or effective?
          </Label>
          <Textarea
            id="uniqueEdge"
            placeholder="What's the simplest way to explain why customers choose you over alternatives?"
            value={formData.uniqueEdge}
            onChange={(e) => updateField("uniqueEdge", e.target.value)}
            rows={3}
            aria-invalid={!!errors.uniqueEdge}
            className="resize-none"
          />
          {errors.uniqueEdge && (
            <p className="text-sm text-destructive">{errors.uniqueEdge}</p>
          )}
        </div>

        {/* Competitor Frustrations */}
        <div className="space-y-2">
          <Label
            htmlFor="competitorFrustrations"
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            What frustrations do customers have with competing products?
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="competitorFrustrations"
            placeholder="Common complaints, pain points, or gaps that competitors don't address well..."
            value={formData.competitorFrustrations}
            onChange={(e) =>
              updateField("competitorFrustrations", e.target.value)
            }
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Market Bottlenecks */}
        <div className="space-y-2">
          <Label
            htmlFor="marketBottlenecks"
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            What are the biggest frustrations or bottlenecks in your target
            market?
          </Label>
          <Textarea
            id="marketBottlenecks"
            placeholder="Industry-wide challenges, inefficiencies, or problems that your market faces..."
            value={formData.marketBottlenecks}
            onChange={(e) => updateField("marketBottlenecks", e.target.value)}
            rows={3}
            aria-invalid={!!errors.marketBottlenecks}
            className="resize-none"
          />
          {errors.marketBottlenecks && (
            <p className="text-sm text-destructive">
              {errors.marketBottlenecks}
            </p>
          )}
        </div>

        {/* Proprietary Tech */}
        <div className="space-y-2">
          <Label htmlFor="proprietaryTech" className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            Do you use any proprietary frameworks, systems, or technology worth
            highlighting?
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="proprietaryTech"
            placeholder="Any unique methodology, technology, or approach that differentiates your solution..."
            value={formData.proprietaryTech}
            onChange={(e) => updateField("proprietaryTech", e.target.value)}
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
