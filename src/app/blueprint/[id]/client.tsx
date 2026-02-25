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
import type { BlueprintRecord } from "@/lib/actions/blueprints";
import type { MediaPlanRecord } from "@/lib/actions/media-plans";

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

const ghostBtn =
  "h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-2 text-[rgb(100,105,115)] border border-[rgb(31,31,31)] hover:border-[rgba(54,94,255,0.3)] hover:text-[rgb(205,208,213)] bg-transparent transition-all duration-150";

const primaryBtn =
  "h-9 px-4 rounded-lg text-[13px] font-medium flex items-center gap-2 bg-[rgb(54,94,255)] text-white hover:bg-[rgb(0,111,255)] transition-colors";

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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[rgb(7,9,14)]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[rgb(31,31,31)] backdrop-blur-sm bg-[rgba(7,9,14,0.8)]">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Back to Dashboard */}
            <button
              className={ghostBtn}
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>

            {/* Title */}
            <div className="hidden md:flex items-center gap-2">
              <FileText className="h-5 w-5 text-[rgb(100,105,115)]" />
              <h1 className="text-[20px] font-semibold text-[rgb(252,252,250)] tracking-[-0.02em] truncate max-w-[300px] font-[family-name:var(--font-heading)]">
                {blueprint.title}
              </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                className={ghostBtn}
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
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        {/* Action Cards Row */}
        <div className="shrink-0 container mx-auto px-4 py-4">
          <motion.div
            className="mx-auto max-w-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="border border-[rgb(31,31,31)] rounded-xl">
              <div className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Left: Info */}
                  <div>
                    <h2 className="text-xl font-semibold text-[rgb(252,252,250)] font-[family-name:var(--font-heading)]">
                      {blueprint.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-[rgb(100,105,115)]" />
                      <p className="text-sm text-[rgb(100,105,115)]">
                        Generated {formatDate(blueprint.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    {linkedMediaPlans.length > 0 && (
                      <Link href={`/media-plan/${linkedMediaPlans[0].id}`}>
                        <button className={ghostBtn}>
                          <BarChart3 className="h-4 w-4" />
                          View Media Plan
                        </button>
                      </Link>
                    )}
                    <Link href={`/generate?blueprintId=${blueprint.id}&action=media-plan`}>
                      <button className={primaryBtn}>
                        <Wand2 className="h-4 w-4" />
                        Generate Media Plan
                      </button>
                    </Link>
                    <button
                      className={ghostBtn}
                      onClick={handleNewBlueprint}
                    >
                      <Wand2 className="h-4 w-4" />
                      New Blueprint
                    </button>
                  </div>
                </div>

                {/* Share Link Display */}
                {shareUrl && (
                  <motion.div
                    className="mt-6 p-4 rounded-lg bg-transparent border border-[rgb(31,31,31)]"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 className="h-4 w-4 text-[rgb(54,94,255)]" />
                      <span className="font-medium text-[13px] text-[rgb(205,208,213)]">
                        Shareable Link
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3 py-2 bg-transparent border border-[rgb(31,31,31)] text-[rgb(205,208,213)] text-[13px] rounded-md font-[family-name:var(--font-mono)] outline-none"
                      />
                      <button
                        className={primaryBtn}
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
                      </button>
                    </div>
                    <p className="text-xs mt-2 text-[rgb(100,105,115)]">
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
            </div>
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
