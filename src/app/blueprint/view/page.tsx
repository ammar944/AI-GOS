"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  Share2,
  Edit,
  Wand2,
  ArrowLeft,
  Loader2,
  Check,
  Link2,
  FileText,
} from "lucide-react";
import { PolishedBlueprintView } from "@/components/strategic-blueprint/polished-blueprint-view";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { easings, durations } from "@/lib/motion";
import { getStrategicBlueprint, getOnboardingData } from "@/lib/storage/local-storage";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { OnboardingFormData } from "@/lib/onboarding/types";

export default function BlueprintViewPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [blueprint, setBlueprint] = useState<StrategicBlueprintOutput | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication and load blueprint
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // Load blueprint from localStorage
    const savedBlueprint = getStrategicBlueprint();

    if (!savedBlueprint) {
      // No blueprint found, redirect to generate
      router.push("/generate");
      return;
    }

    setBlueprint(savedBlueprint);
    setIsLoading(false);
  }, [isLoaded, isSignedIn, router]);

  // Share blueprint
  const handleShare = async () => {
    if (!blueprint) return;

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
  };

  // Copy share link to clipboard
  const handleCopyLink = async () => {
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
  };

  // Edit blueprint - navigate to generate with existing data
  const handleEdit = () => {
    const savedOnboarding = getOnboardingData();
    if (savedOnboarding && blueprint) {
      // Data is already in localStorage, just navigate
      router.push("/generate");
    }
  };

  // Create new blueprint
  const handleNewBlueprint = () => {
    router.push("/generate");
  };

  // Loading state
  if (isLoading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent-blue)" }} />
      </div>
    );
  }

  // No blueprint state (shouldn't happen due to redirect, but safety check)
  if (!blueprint) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Back to Dashboard */}
            <MagneticButton
              className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
              onClick={() => router.push("/dashboard")}
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                background: "transparent",
                fontFamily: "var(--font-sans), Inter, sans-serif",
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </MagneticButton>

            {/* Title */}
            <div className="hidden md:flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              <h1
                className="text-lg font-semibold"
                style={{
                  color: "var(--text-heading)",
                  fontFamily: "var(--font-heading), 'Instrument Sans', sans-serif",
                }}
              >
                Strategic Blueprint
              </h1>
            </div>

            {/* Actions - Primary CTA style */}
            <div className="flex items-center gap-2">
              <MagneticButton
                className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                onClick={handleShare}
                disabled={isSharing || !!shareUrl}
                style={{
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                  background: "transparent",
                  fontFamily: "var(--font-sans), Inter, sans-serif",
                }}
              >
                {isSharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : shareUrl ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isSharing ? "Sharing..." : shareUrl ? "Shared" : "Share"}
                </span>
              </MagneticButton>
            </div>
          </div>
        </div>
      </header>

      {/* Background */}
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.02} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* Action Cards Row */}
        <motion.div
          className="mx-auto max-w-5xl mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.normal, ease: easings.out }}
        >
          <GradientBorder>
            <div className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Left: Info */}
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{
                      color: "var(--text-heading)",
                      fontFamily: "var(--font-heading), 'Instrument Sans', sans-serif",
                    }}
                  >
                    Your Strategic Blueprint
                  </h2>
                  <p
                    className="text-sm mt-1"
                    style={{
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-sans), Inter, sans-serif",
                    }}
                  >
                    5-section strategic analysis ready for action
                  </p>
                </div>

                {/* Right: Secondary Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <MagneticButton
                    className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                    onClick={handleEdit}
                    style={{
                      border: "1px solid var(--border-default)",
                      color: "var(--text-secondary)",
                      background: "transparent",
                      fontFamily: "var(--font-sans), Inter, sans-serif",
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </MagneticButton>
                  <MagneticButton
                    className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2"
                    onClick={handleNewBlueprint}
                    style={{
                      background: "var(--gradient-primary)",
                      color: "white",
                      fontFamily: "var(--font-display), 'Cabinet Grotesk', sans-serif",
                    }}
                  >
                    <Wand2 className="h-4 w-4" />
                    New Blueprint
                  </MagneticButton>
                </div>
              </div>

              {/* Share Link Display */}
              {shareUrl && (
                <motion.div
                  className="mt-6 p-4 rounded-lg"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                  }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="h-4 w-4" style={{ color: "var(--accent-blue)" }} />
                    <span
                      className="font-medium text-sm"
                      style={{
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-sans), Inter, sans-serif",
                      }}
                    >
                      Shareable Link
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2 text-sm rounded-md font-mono"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium"
                      onClick={handleCopyLink}
                      style={{
                        background: "var(--gradient-primary)",
                        color: "white",
                        fontFamily: "var(--font-display), 'Cabinet Grotesk', sans-serif",
                      }}
                    >
                      {shareCopied ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          Copied
                        </span>
                      ) : (
                        "Copy"
                      )}
                    </MagneticButton>
                  </div>
                  <p
                    className="text-xs mt-2"
                    style={{
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-sans), Inter, sans-serif",
                    }}
                  >
                    Anyone with this link can view this blueprint
                  </p>
                </motion.div>
              )}

              {/* Share Error Display */}
              {shareError && (
                <motion.div
                  className="mt-4 p-3 rounded-lg"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgb(239, 68, 68)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <p
                    className="text-sm"
                    style={{
                      color: "rgb(239, 68, 68)",
                      fontFamily: "var(--font-sans), Inter, sans-serif",
                    }}
                  >
                    {shareError}
                  </p>
                </motion.div>
              )}
            </div>
          </GradientBorder>
        </motion.div>

        {/* Blueprint Content */}
        <motion.div
          className="mx-auto max-w-5xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: durations.normal, ease: easings.out }}
        >
          <PolishedBlueprintView strategicBlueprint={blueprint} />
        </motion.div>
      </main>
    </div>
  );
}
