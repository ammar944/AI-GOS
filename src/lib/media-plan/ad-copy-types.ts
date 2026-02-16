// Ad Copy Generation — Type definitions
// Platform-specific, copy-paste-ready ad copy

// =============================================================================
// Platform-Specific Copy Types
// =============================================================================

export interface MetaAdCopy {
  primaryText: string;
  headline: string;
  linkDescription: string;
  ctaButton: "Learn More" | "Sign Up" | "Get Quote" | "Shop Now" | "Contact Us" | "Download" | "Book Now";
}

export interface GoogleRSACopy {
  headlines: string[];
  descriptions: string[];
  displayPaths: [string?, string?];
}

export interface LinkedInAdCopy {
  introText: string;
  ctaButton: "Learn More" | "Sign Up" | "Register" | "Download" | "Request Demo" | "Get Quote";
}

export interface TikTokAdCopy {
  adText: string;
  videoScript: {
    hook: string;
    body: string;
    cta: string;
  };
}

export interface YouTubeAdCopy {
  headlineOverlay: string;
  ctaText: string;
  script: {
    hook: string;
    problemSolution: string;
    socialProof: string;
    cta: string;
  };
}

// =============================================================================
// Variant Union
// =============================================================================

export type PlatformCopyVariant =
  | { platform: "meta"; copy: MetaAdCopy }
  | { platform: "google"; copy: GoogleRSACopy }
  | { platform: "linkedin"; copy: LinkedInAdCopy }
  | { platform: "tiktok"; copy: TikTokAdCopy }
  | { platform: "youtube"; copy: YouTubeAdCopy };

// =============================================================================
// Copy Set (angle x platform)
// =============================================================================

export interface AngleCopySet {
  angleName: string;
  angleDescription: string;
  funnelStage: "cold" | "warm" | "hot";
  variants: PlatformCopyVariant[];
}

// =============================================================================
// Output
// =============================================================================

export interface AdCopyOutput {
  copySets: AngleCopySet[];
  metadata: {
    generatedAt: string;
    processingTime: number;
    totalCost: number;
    modelUsed: string;
  };
}

// =============================================================================
// SSE Events
// =============================================================================

export interface AdCopySSEProgressEvent {
  type: "progress";
  percentage: number;
  message: string;
}

export interface AdCopySSEDoneEvent {
  type: "done";
  success: true;
  adCopy: AdCopyOutput;
  metadata: {
    totalTime: number;
    totalCost: number;
  };
}

export interface AdCopySSEErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

export type AdCopySSEEvent =
  | AdCopySSEProgressEvent
  | AdCopySSEDoneEvent
  | AdCopySSEErrorEvent;
