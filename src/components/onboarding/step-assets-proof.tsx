"use client";

import { useState } from "react";
import {
  FileCheck,
  Presentation,
  Play,
  Award,
  MessageSquareQuote,
  Globe,
  Image,
  Palette,
  Video,
  Mail,
  Camera,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssetsProofData } from "@/lib/onboarding/types";

interface StepAssetsProofProps {
  initialData?: Partial<AssetsProofData>;
  onSubmit: (data: AssetsProofData) => void;
  onBack?: () => void;
}

interface AssetField {
  key: keyof AssetsProofData;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
}

const ASSET_FIELDS: AssetField[] = [
  {
    key: "salesDeckUrl",
    label: "Sales Deck",
    placeholder: "https://docs.google.com/presentation/...",
    icon: <Presentation className="h-4 w-4" />,
  },
  {
    key: "productDemoUrl",
    label: "Product Demo / Explainer",
    placeholder: "https://www.loom.com/share/...",
    icon: <Play className="h-4 w-4" />,
  },
  {
    key: "caseStudiesUrl",
    label: "Case Studies",
    placeholder: "https://yoursite.com/case-studies",
    icon: <Award className="h-4 w-4" />,
  },
  {
    key: "testimonialsUrl",
    label: "Testimonials",
    placeholder: "https://yoursite.com/testimonials",
    icon: <MessageSquareQuote className="h-4 w-4" />,
  },
  {
    key: "landingPageUrl",
    label: "Landing Page",
    placeholder: "https://yoursite.com/offer",
    icon: <Globe className="h-4 w-4" />,
  },
  {
    key: "existingAdsUrl",
    label: "Existing Ads / Creatives",
    placeholder: "https://drive.google.com/folder/...",
    icon: <Image className="h-4 w-4" />,
  },
  {
    key: "brandGuidelinesUrl",
    label: "Brand Guidelines",
    placeholder: "https://docs.google.com/document/...",
    icon: <Palette className="h-4 w-4" />,
  },
  {
    key: "loomWalkthroughUrl",
    label: "Loom / Walkthrough Video",
    placeholder: "https://www.loom.com/share/...",
    icon: <Video className="h-4 w-4" />,
  },
  {
    key: "emailSequencesUrl",
    label: "Email Sequences",
    placeholder: "https://docs.google.com/document/...",
    icon: <Mail className="h-4 w-4" />,
  },
  {
    key: "productScreenshotsUrl",
    label: "Product Screenshots",
    placeholder: "https://drive.google.com/folder/...",
    icon: <Camera className="h-4 w-4" />,
  },
  {
    key: "ugcVideosUrl",
    label: "UGC Videos",
    placeholder: "https://drive.google.com/folder/...",
    icon: <Users className="h-4 w-4" />,
  },
];

export function StepAssetsProof({
  initialData,
  onSubmit,
  onBack,
}: StepAssetsProofProps) {
  const [formData, setFormData] = useState<AssetsProofData>({
    salesDeckUrl: initialData?.salesDeckUrl || "",
    productDemoUrl: initialData?.productDemoUrl || "",
    caseStudiesUrl: initialData?.caseStudiesUrl || "",
    testimonialsUrl: initialData?.testimonialsUrl || "",
    landingPageUrl: initialData?.landingPageUrl || "",
    existingAdsUrl: initialData?.existingAdsUrl || "",
    brandGuidelinesUrl: initialData?.brandGuidelinesUrl || "",
    loomWalkthroughUrl: initialData?.loomWalkthroughUrl || "",
    emailSequencesUrl: initialData?.emailSequencesUrl || "",
    productScreenshotsUrl: initialData?.productScreenshotsUrl || "",
    ugcVideosUrl: initialData?.ugcVideosUrl || "",
  });

  function updateField<K extends keyof AssetsProofData>(
    field: K,
    value: string
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Normalize and validate URL to prevent XSS/SSRF attacks.
   * Only allows http/https protocols.
   * Returns empty string for invalid URLs.
   */
  function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return "";

    try {
      // Add https:// if no protocol specified
      const urlWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : "https://" + trimmed;

      const urlObj = new URL(urlWithProtocol);

      // Only allow http and https protocols (prevents javascript:, data:, file:, etc.)
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        console.warn(`Rejected URL with invalid protocol: ${urlObj.protocol}`);
        return "";
      }

      // Prevent localhost/internal URLs in production (optional security)
      const hostname = urlObj.hostname.toLowerCase();
      const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
      if (process.env.NODE_ENV === "production" && blockedHostnames.includes(hostname)) {
        console.warn(`Rejected localhost URL in production: ${hostname}`);
        return "";
      }

      return urlObj.toString();
    } catch {
      // Invalid URL format
      console.warn(`Invalid URL format: ${trimmed.slice(0, 100)}`);
      return "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Normalize all URLs
    const normalized: AssetsProofData = {
      salesDeckUrl: normalizeUrl(formData.salesDeckUrl || ""),
      productDemoUrl: normalizeUrl(formData.productDemoUrl || ""),
      caseStudiesUrl: normalizeUrl(formData.caseStudiesUrl || ""),
      testimonialsUrl: normalizeUrl(formData.testimonialsUrl || ""),
      landingPageUrl: normalizeUrl(formData.landingPageUrl || ""),
      existingAdsUrl: normalizeUrl(formData.existingAdsUrl || ""),
      brandGuidelinesUrl: normalizeUrl(formData.brandGuidelinesUrl || ""),
      loomWalkthroughUrl: normalizeUrl(formData.loomWalkthroughUrl || ""),
      emailSequencesUrl: normalizeUrl(formData.emailSequencesUrl || ""),
      productScreenshotsUrl: normalizeUrl(formData.productScreenshotsUrl || ""),
      ugcVideosUrl: normalizeUrl(formData.ugcVideosUrl || ""),
    };

    onSubmit(normalized);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Assets & Proof
        </h2>
        <p className="text-muted-foreground">
          Share links to your existing marketing materials. All fields are
          optional.
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex gap-3">
          <FileCheck className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Why we ask for these</p>
            <p className="text-sm text-muted-foreground">
              These assets help our AI create better ad angles, scripts, and
              creative direction based on your existing proof and messaging.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        {ASSET_FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label
              htmlFor={field.key}
              className="flex items-center gap-2 text-muted-foreground"
            >
              {field.icon}
              <span className="text-foreground">{field.label}</span>
            </Label>
            <Input
              id={field.key}
              type="url"
              placeholder={field.placeholder}
              value={formData[field.key] || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              className="h-11"
            />
          </div>
        ))}
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
