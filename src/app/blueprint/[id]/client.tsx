"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Share2,
  Wand2,
  ArrowLeft,
  Loader2,
  Check,
  Link2,
  FileText,
  Calendar,
  BarChart3,
} from "lucide-react";
import { PaginatedBlueprintView } from "@/components/strategic-blueprint/paginated-blueprint-view";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { easings, durations } from "@/lib/motion";
import type { BlueprintRecord } from "@/lib/actions/blueprints";
import type { MediaPlanRecord } from "@/lib/actions/media-plans";
import { cn } from "@/lib/utils";

interface Props {
  blueprint: BlueprintRecord;
  linkedMediaPlans: MediaPlanRecord[];
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

export function BlueprintViewClient({ blueprint, linkedMediaPlans }: Props) {
  const router = useRouter();
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const strategicBlueprint = blueprint.output;

  // Share blueprint
  const handleShare = async () => {
    if (!strategicBlueprint) return;

    setIsSharing(true);
    setShareError(null);

    try {
      const response = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: strategicBlueprint }),
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

  // Create new blueprint
  const handleNewBlueprint = () => {
    router.push("/generate");
  };

  const ghostButtonClass =
    "h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-white/[0.15] hover:text-white/70 bg-transparent";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-base)]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] backdrop-blur-xl bg-[rgba(7,9,14,0.8)]">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Back to Dashboard */}
            <MagneticButton
              className={cn(ghostButtonClass, "hover:border-blue-500/30 hover:text-blue-400")}
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </MagneticButton>

            {/* Title */}
            <div className="hidden md:flex items-center gap-2">
              <FileText className="h-5 w-5 text-white/40" />
              <h1 className="text-base font-semibold truncate max-w-[300px] text-white/90 font-[family-name:var(--font-heading)]">
                {blueprint.title}
              </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <MagneticButton
                className={cn(ghostButtonClass, "hover:border-blue-500/30 hover:text-blue-400")}
                onClick={handleShare}
                disabled={isSharing || !!shareUrl}
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
      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        {/* Action Cards Row */}
        <div className="shrink-0 container mx-auto px-4 py-4">
          <motion.div
            className="mx-auto max-w-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.normal, ease: easings.out }}
          >
            <GradientBorder>
              <div className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Left: Info */}
                  <div>
                    <h2 className="text-xl font-semibold text-white/90 font-[family-name:var(--font-heading)]">
                      {blueprint.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-white/30" />
                      <p className="text-sm text-white/40">
                        Generated {formatDate(blueprint.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    {linkedMediaPlans.length > 0 && (
                      <Link href={`/media-plan/${linkedMediaPlans[0].id}`}>
                        <MagneticButton
                          className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-blue-500/30 hover:text-blue-400 bg-transparent"
                        >
                          <BarChart3 className="h-4 w-4" />
                          View Media Plan
                        </MagneticButton>
                      </Link>
                    )}
                    <Link href={`/generate?blueprintId=${blueprint.id}&action=media-plan`}>
                      <MagneticButton
                        className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white transition-opacity duration-200 hover:opacity-90"
                      >
                        <Wand2 className="h-4 w-4" />
                        Generate Media Plan
                      </MagneticButton>
                    </Link>
                    <MagneticButton
                      className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-blue-500/30 hover:text-blue-400 bg-transparent"
                      onClick={handleNewBlueprint}
                    >
                      <Wand2 className="h-4 w-4" />
                      New Blueprint
                    </MagneticButton>
                  </div>
                </div>

                {/* Share Link Display */}
                {shareUrl && (
                  <motion.div
                    className="mt-6 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 className="h-4 w-4 text-blue-400" />
                      <span className="font-medium text-sm text-white/80">
                        Shareable Link
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3 py-2 text-sm rounded-md bg-white/[0.03] border border-white/[0.08] text-white/80 font-[family-name:var(--font-mono)] outline-none"
                      />
                      <MagneticButton
                        className="h-9 px-4 rounded-md text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-500 text-white transition-opacity duration-200 hover:opacity-90"
                        onClick={handleCopyLink}
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
                    <p className="text-xs mt-2 text-white/30">
                      Anyone with this link can view this blueprint
                    </p>
                  </motion.div>
                )}

                {/* Share Error Display */}
                {shareError && (
                  <motion.div
                    className="mt-4 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-sm text-red-400/80">
                      {shareError}
                    </p>
                  </motion.div>
                )}
              </div>
            </GradientBorder>
          </motion.div>
        </div>

        {/* Blueprint Content */}
        <div className="flex-1 min-h-0">
          <PaginatedBlueprintView strategicBlueprint={strategicBlueprint} />
        </div>
      </main>
    </div>
  );
}
