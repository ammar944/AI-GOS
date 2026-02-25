"use client";

import { useState, useCallback } from "react";
import { generateBlueprintMarkdown } from "@/lib/strategic-blueprint/markdown-generator";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

export interface UseBlueprintShareReturn {
  isSharing: boolean;
  shareUrl: string | null;
  shareCopied: boolean;
  shareError: string | null;
  blueprintCopied: boolean;
  handleShare: (blueprint: StrategicBlueprintOutput) => Promise<void>;
  handleCopyLink: () => Promise<void>;
  handleCopyBlueprint: (blueprint: StrategicBlueprintOutput) => void;
  resetShareState: () => void;
}

export function useBlueprintShare(): UseBlueprintShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [blueprintCopied, setBlueprintCopied] = useState(false);

  const handleShare = useCallback(async (blueprint: StrategicBlueprintOutput) => {
    setIsSharing(true);
    setShareError(null);

    try {
      const response = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint }),
      });

      const result = await response.json();

      if (result.success) {
        setShareUrl(result.shareUrl);
      } else {
        setShareError(result.error?.message || "Failed to create share link");
      }
    } catch {
      setShareError("Failed to create share link");
    } finally {
      setIsSharing(false);
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }, [shareUrl]);

  const handleCopyBlueprint = useCallback((blueprint: StrategicBlueprintOutput) => {
    const markdown = generateBlueprintMarkdown(blueprint);
    navigator.clipboard.writeText(markdown);
    setBlueprintCopied(true);
    setTimeout(() => setBlueprintCopied(false), 2000);
  }, []);

  const resetShareState = useCallback(() => {
    setShareUrl(null);
    setShareError(null);
    setShareCopied(false);
    setBlueprintCopied(false);
  }, []);

  return {
    isSharing,
    shareUrl,
    shareCopied,
    shareError,
    blueprintCopied,
    handleShare,
    handleCopyLink,
    handleCopyBlueprint,
    resetShareState,
  };
}
