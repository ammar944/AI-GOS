"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
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
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div className="space-y-2" variants={fadeUp}>
        <h2 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Assets & Proof
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Share links to your existing marketing materials. All fields are optional.
        </p>
      </motion.div>

      <motion.div
        className="rounded-xl p-4"
        style={{
          border: '1px solid var(--border-default)',
          background: 'var(--bg-elevated)',
        }}
        variants={staggerItem}
      >
        <div className="flex gap-3">
          <FileCheck className="h-5 w-5 mt-0.5" style={{ color: 'var(--accent-blue)' }} />
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Why we ask for these
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              These assets help our AI create better ad angles, scripts, and
              creative direction based on your existing proof and messaging.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div className="grid gap-5" variants={staggerContainer}>
        {ASSET_FIELDS.map((field) => (
          <motion.div key={field.key} variants={staggerItem}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: 'var(--text-tertiary)' }}>{field.icon}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {field.label}
              </span>
            </div>
            <FloatingLabelInput
              id={field.key}
              label={field.placeholder}
              type="url"
              value={formData[field.key] || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
            />
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="flex gap-3 pt-4" variants={staggerItem}>
        {onBack && (
          <MagneticButton
            type="button"
            className="h-10 px-4 py-2 rounded-md text-sm font-medium"
            onClick={onBack}
            style={{
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              background: 'transparent',
            }}
          >
            Back
          </MagneticButton>
        )}
        <MagneticButton
          type="submit"
          className="flex-1 h-10 px-4 py-2 rounded-md text-sm font-medium"
          style={{
            background: 'var(--gradient-primary)',
            color: 'white',
          }}
        >
          Continue
        </MagneticButton>
      </motion.div>
    </motion.form>
  );
}
