"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Share2,
  Wand2,
  ArrowLeft,
  Loader2,
  Check,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaginatedBlueprintView } from "@/components/strategic-blueprint/paginated-blueprint-view";
import type { BlueprintRecord } from "@/lib/actions/blueprints";
import type { MediaPlanRecord } from "@/lib/actions/media-plans";

interface Props {
  blueprint: BlueprintRecord;
  linkedMediaPlans: MediaPlanRecord[];
}

const ghostBtn =
  "h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] bg-transparent transition-all duration-150";

const primaryBtn =
  "h-9 px-4 rounded-lg text-[13px] font-medium flex items-center gap-2 bg-[rgb(54,94,255)] text-white hover:bg-[rgb(74,114,255)] transition-colors";

export function BlueprintViewClient({ blueprint, linkedMediaPlans }: Props) {
  const router = useRouter();
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const strategicBlueprint = blueprint.output;

  // Share blueprint — on success, auto-copy to clipboard and briefly show checkmark
  const handleShare = async () => {
    if (!strategicBlueprint) return;
    if (shareUrl) {
      // Already have a URL — just re-copy
      await handleCopyLink(shareUrl);
      return;
    }

    setIsSharing(true);

    try {
      const response = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: strategicBlueprint }),
      });

      const result = await response.json();

      if (result.success) {
        setShareUrl(result.shareUrl);
        await handleCopyLink(result.shareUrl);
      }
    } catch {
      // Silently fail — no inline error display
    } finally {
      setIsSharing(false);
    }
  };

  // Copy a given URL to clipboard and show brief checkmark
  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const hasMediaPlan = linkedMediaPlans.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[rgb(7,9,14)]">
      {/* 48px toolbar */}
      <header className="shrink-0 h-12 flex items-center border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/90 backdrop-blur-sm z-50 px-4 gap-3">
        {/* Left: back */}
        <button
          className={ghostBtn}
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        {/* Center: truncated title */}
        <div className="flex-1 min-w-0">
          <span className="block truncate text-[14px] font-medium text-[var(--text-secondary)]">
            {blueprint.title}
          </span>
        </div>

        {/* Right: primary CTA + overflow */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasMediaPlan ? (
            <Link href={`/media-plan/${linkedMediaPlans[0].id}`}>
              <button className={primaryBtn}>
                <BarChart3 className="h-4 w-4" />
                View Media Plan
              </button>
            </Link>
          ) : (
            <Link href={`/generate?blueprintId=${blueprint.id}&action=media-plan`}>
              <button className={primaryBtn}>
                <Wand2 className="h-4 w-4" />
                Generate Media Plan
              </button>
            </Link>
          )}

          {/* Overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] bg-transparent transition-all duration-150"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {hasMediaPlan && (
                <DropdownMenuItem asChild>
                  <Link href={`/generate?blueprintId=${blueprint.id}&action=media-plan`}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate New Media Plan
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleShare}
                disabled={isSharing}
              >
                {isSharing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : shareCopied ? (
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                {shareCopied ? "Link copied!" : "Share"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/generate")}>
                <Wand2 className="h-4 w-4 mr-2" />
                New Blueprint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Blueprint Content */}
      <div className="flex-1 min-h-0">
        <PaginatedBlueprintView strategicBlueprint={strategicBlueprint} />
      </div>
    </div>
  );
}
