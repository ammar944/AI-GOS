"use client";

import { useState } from "react";
import { Users, Building, MapPin, Zap, TrendingUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ICPData, CompanySize, ClientSource } from "@/lib/onboarding/types";
import {
  COMPANY_SIZE_OPTIONS,
  CLIENT_SOURCE_OPTIONS,
} from "@/lib/onboarding/types";

interface StepICPProps {
  initialData?: Partial<ICPData>;
  onSubmit: (data: ICPData) => void;
  onBack?: () => void;
}

export function StepICP({ initialData, onSubmit, onBack }: StepICPProps) {
  const [formData, setFormData] = useState<ICPData>({
    primaryIcpDescription: initialData?.primaryIcpDescription || "",
    industryVertical: initialData?.industryVertical || "",
    jobTitles: initialData?.jobTitles || "",
    companySize: initialData?.companySize || "11-50",
    geography: initialData?.geography || "",
    easiestToClose: initialData?.easiestToClose || "",
    buyingTriggers: initialData?.buyingTriggers || "",
    bestClientSources: initialData?.bestClientSources || [],
    secondaryIcp: initialData?.secondaryIcp || "",
    systemsPlatforms: initialData?.systemsPlatforms || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof ICPData>(field: K, value: ICPData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function toggleSource(source: ClientSource) {
    const current = formData.bestClientSources;
    if (current.includes(source)) {
      updateField(
        "bestClientSources",
        current.filter((s) => s !== source)
      );
    } else {
      updateField("bestClientSources", [...current, source]);
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.primaryIcpDescription.trim()) {
      newErrors.primaryIcpDescription = "ICP description is required";
    }
    if (!formData.industryVertical.trim()) {
      newErrors.industryVertical = "Industry is required";
    }
    if (!formData.jobTitles.trim()) {
      newErrors.jobTitles = "Job titles are required";
    }
    if (!formData.geography.trim()) {
      newErrors.geography = "Geography is required";
    }
    if (!formData.easiestToClose.trim()) {
      newErrors.easiestToClose = "This field is required";
    }
    if (!formData.buyingTriggers.trim()) {
      newErrors.buyingTriggers = "Buying triggers are required";
    }
    if (formData.bestClientSources.length === 0) {
      newErrors.bestClientSources = "Select at least one source";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...formData,
      primaryIcpDescription: formData.primaryIcpDescription.trim(),
      industryVertical: formData.industryVertical.trim(),
      jobTitles: formData.jobTitles.trim(),
      geography: formData.geography.trim(),
      easiestToClose: formData.easiestToClose.trim(),
      buyingTriggers: formData.buyingTriggers.trim(),
      secondaryIcp: formData.secondaryIcp?.trim() || "",
      systemsPlatforms: formData.systemsPlatforms?.trim() || "",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ideal Customer Profile
        </h2>
        <p className="text-muted-foreground">
          Define who your best customers are and how to reach them
        </p>
      </div>

      <div className="grid gap-6">
        {/* Primary ICP Description */}
        <div className="space-y-2">
          <Label
            htmlFor="primaryIcpDescription"
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            Who is your ideal client?
          </Label>
          <Textarea
            id="primaryIcpDescription"
            placeholder="Include titles, roles, industries, business size, geography, and buying behavior..."
            value={formData.primaryIcpDescription}
            onChange={(e) =>
              updateField("primaryIcpDescription", e.target.value)
            }
            rows={4}
            aria-invalid={!!errors.primaryIcpDescription}
            className="resize-none"
          />
          {errors.primaryIcpDescription && (
            <p className="text-sm text-destructive">
              {errors.primaryIcpDescription}
            </p>
          )}
        </div>

        {/* Industry & Job Titles Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="industryVertical"
              className="flex items-center gap-2"
            >
              <Building className="h-4 w-4 text-muted-foreground" />
              Industry Vertical
            </Label>
            <Input
              id="industryVertical"
              placeholder="e.g., SaaS, E-commerce, Healthcare"
              value={formData.industryVertical}
              onChange={(e) => updateField("industryVertical", e.target.value)}
              aria-invalid={!!errors.industryVertical}
              className="h-11"
            />
            {errors.industryVertical && (
              <p className="text-sm text-destructive">
                {errors.industryVertical}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobTitles">Target Job Titles</Label>
            <Input
              id="jobTitles"
              placeholder="e.g., CEO, CMO, Marketing Director"
              value={formData.jobTitles}
              onChange={(e) => updateField("jobTitles", e.target.value)}
              aria-invalid={!!errors.jobTitles}
              className="h-11"
            />
            {errors.jobTitles && (
              <p className="text-sm text-destructive">{errors.jobTitles}</p>
            )}
          </div>
        </div>

        {/* Company Size & Geography Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companySize">Company Size</Label>
            <Select
              value={formData.companySize}
              onValueChange={(value) =>
                updateField("companySize", value as CompanySize)
              }
            >
              <SelectTrigger id="companySize" className="h-11">
                <SelectValue placeholder="Select company size" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="geography" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Geography
            </Label>
            <Input
              id="geography"
              placeholder="e.g., USA, North America, Global"
              value={formData.geography}
              onChange={(e) => updateField("geography", e.target.value)}
              aria-invalid={!!errors.geography}
              className="h-11"
            />
            {errors.geography && (
              <p className="text-sm text-destructive">{errors.geography}</p>
            )}
          </div>
        </div>

        {/* Easiest to Close */}
        <div className="space-y-2">
          <Label htmlFor="easiestToClose" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            What type of companies or users are easiest for you to close and
            why?
          </Label>
          <Textarea
            id="easiestToClose"
            placeholder="Include patterns in mindset, urgency, buying triggers, or use cases..."
            value={formData.easiestToClose}
            onChange={(e) => updateField("easiestToClose", e.target.value)}
            rows={3}
            aria-invalid={!!errors.easiestToClose}
            className="resize-none"
          />
          {errors.easiestToClose && (
            <p className="text-sm text-destructive">{errors.easiestToClose}</p>
          )}
        </div>

        {/* Buying Triggers */}
        <div className="space-y-2">
          <Label htmlFor="buyingTriggers" className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            What problems or situations make them ready to buy?
          </Label>
          <Textarea
            id="buyingTriggers"
            placeholder="E.g., missed KPIs, inefficiencies, hiring gaps, system limitations..."
            value={formData.buyingTriggers}
            onChange={(e) => updateField("buyingTriggers", e.target.value)}
            rows={3}
            aria-invalid={!!errors.buyingTriggers}
            className="resize-none"
          />
          {errors.buyingTriggers && (
            <p className="text-sm text-destructive">{errors.buyingTriggers}</p>
          )}
        </div>

        {/* Best Client Sources */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            Where do your best clients typically come from?
          </Label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {CLIENT_SOURCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent ${
                  formData.bestClientSources.includes(option.value)
                    ? "border-primary bg-primary/5"
                    : "border-input"
                }`}
              >
                <Checkbox
                  checked={formData.bestClientSources.includes(option.value)}
                  onCheckedChange={() => toggleSource(option.value)}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.bestClientSources && (
            <p className="text-sm text-destructive">
              {errors.bestClientSources}
            </p>
          )}
        </div>

        {/* Secondary ICP */}
        <div className="space-y-2">
          <Label htmlFor="secondaryIcp">
            Secondary ICP{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="secondaryIcp"
            placeholder="If you target multiple segments, describe your secondary ICP here..."
            value={formData.secondaryIcp}
            onChange={(e) => updateField("secondaryIcp", e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Systems & Platforms */}
        <div className="space-y-2">
          <Label htmlFor="systemsPlatforms" className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Systems & Platforms Used{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="systemsPlatforms"
            placeholder="List the systems and platforms you use: CRM (HubSpot, Salesforce), Marketing (GHL, ActiveCampaign), Delivery (Slack, ClickUp), Communication tools..."
            value={formData.systemsPlatforms || ""}
            onChange={(e) => updateField("systemsPlatforms", e.target.value)}
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Include CRM, marketing automation, project management, and communication tools
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
