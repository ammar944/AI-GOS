"use client";

import {
  CheckCircle2,
  ArrowLeft,
  Wand2,
  Share2,
  Check,
  Copy,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaginatedBlueprintView } from "@/components/strategic-blueprint/paginated-blueprint-view";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { GenerateHeader } from "@/components/generate";
import type { GenerateStage } from "@/components/generate";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

export interface BlueprintCompleteViewProps {
  headerStage: GenerateStage;
  strategicBlueprint: StrategicBlueprintOutput;
  blueprintMeta: { totalTime: number; totalCost: number } | null;
  // Share state
  isSharing: boolean;
  shareUrl: string | null;
  shareCopied: boolean;
  shareError: string | null;
  blueprintCopied: boolean;
  // Callbacks
  onGenerateMediaPlan: () => void;
  onBackToReview: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  onCopyBlueprint: () => void;
  onStartOver: () => void;
}

export function BlueprintCompleteView({
  headerStage,
  strategicBlueprint,
  blueprintMeta,
  isSharing,
  shareUrl,
  shareCopied,
  blueprintCopied,
  onGenerateMediaPlan,
  onBackToReview,
  onShare,
  onCopyLink,
  onCopyBlueprint,
  onStartOver,
}: BlueprintCompleteViewProps) {
  const shareMenuLabel = isSharing
    ? "Sharing..."
    : shareCopied
    ? "Link copied!"
    : shareUrl
    ? "Copy link"
    : "Share";

  const shareMenuIcon = isSharing ? (
    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  ) : shareCopied ? (
    <Check className="h-4 w-4 mr-2 text-green-500" />
  ) : (
    <Share2 className="h-4 w-4 mr-2" />
  );

  // When shareUrl is already available and user clicks "Share" in the menu,
  // just copy the link directly.
  const handleShareMenuClick = () => {
    if (shareUrl) {
      onCopyLink();
    } else {
      onShare();
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      {/* Primary CTA */}
      <button
        className="h-8 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 bg-[rgb(54,94,255)] text-white hover:bg-[rgb(0,111,255)] transition-colors"
        onClick={onGenerateMediaPlan}
      >
        <Wand2 className="h-3.5 w-3.5" />
        Generate Media Plan
      </button>

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
          <DropdownMenuItem asChild>
            <a href="/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Back to Dashboard
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onBackToReview}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Review
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyBlueprint}>
            {blueprintCopied ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {blueprintCopied ? "Copied!" : "Copy blueprint"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleShareMenuClick}
            disabled={isSharing}
          >
            {shareMenuIcon}
            {shareMenuLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onStartOver}>
            <Wand2 className="h-4 w-4 mr-2" />
            New Blueprint
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-base)]">
      <GenerateHeader
        currentStage={headerStage}
        hasUnsavedProgress={false}
        exitUrl="/dashboard"
        actions={headerActions}
      />

      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.015} />

      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        {/* Slim stats line — 32px */}
        {blueprintMeta && (
          <div className="shrink-0 flex items-center gap-4 px-6 py-1.5 border-b border-[var(--border-subtle)]">
            <span className="flex items-center gap-1.5 text-[11px] text-green-500/70">
              <CheckCircle2 className="h-3 w-3" />
              Complete
            </span>
            <span className="text-[11px] font-mono text-white/30">
              {Math.round(blueprintMeta.totalTime / 1000)}s
            </span>
            <span className="text-[11px] font-mono text-white/30">
              ${blueprintMeta.totalCost.toFixed(4)}
            </span>
            <span className="text-[11px] text-white/30">
              {strategicBlueprint?.keywordIntelligence ? "6" : "5"} sections
            </span>
          </div>
        )}

        {/* Paginated Blueprint Content */}
        <div className="flex-1 min-h-0">
          <PaginatedBlueprintView strategicBlueprint={strategicBlueprint} />
        </div>
      </main>
    </div>
  );
}
