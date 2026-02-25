"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ArrowLeft,
  Wand2,
  Clock,
  Coins,
  FileSearch,
  Share2,
  Link2,
  Check,
  Copy,
  LayoutDashboard,
  Loader2,
} from "lucide-react";
import { PaginatedBlueprintView } from "@/components/strategic-blueprint/paginated-blueprint-view";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { GenerateHeader } from "@/components/generate";
import { durations, easings } from "@/lib/motion";
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
  shareError,
  blueprintCopied,
  onGenerateMediaPlan,
  onBackToReview,
  onShare,
  onCopyLink,
  onCopyBlueprint,
  onStartOver,
}: BlueprintCompleteViewProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-base)]">
      <GenerateHeader
        currentStage={headerStage}
        hasUnsavedProgress={false}
        exitUrl="/dashboard"
      />

      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.015} />

      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        {/* Success Header */}
        <div className="shrink-0 container mx-auto px-4 py-4">
          <motion.div
            className="mx-auto max-w-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.normal, ease: easings.out }}
          >
            <GradientBorder>
              <div className="p-6">
                {/* Main header row */}
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      </div>
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-green-500"
                        initial={{ opacity: 0.5, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 1.5, repeat: 2 }}
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white/90 font-[family-name:var(--font-heading)]">
                        Blueprint Complete
                      </h2>
                      <p className="text-sm text-white/40">
                        {strategicBlueprint?.keywordIntelligence ? '6' : '5'}-section strategic analysis ready
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <MagneticButton
                      className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-white transition-opacity duration-200 hover:opacity-90"
                      onClick={onGenerateMediaPlan}
                    >
                      <Wand2 className="h-4 w-4" />
                      Generate Media Plan
                    </MagneticButton>
                    <a href="/dashboard">
                      <MagneticButton
                        className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-primary/30 hover:text-primary bg-transparent"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Back to Dashboard
                      </MagneticButton>
                    </a>
                    <MagneticButton
                      className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-primary/30 hover:text-primary bg-transparent"
                      onClick={onBackToReview}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Review
                    </MagneticButton>
                    <MagneticButton
                      className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 bg-transparent"
                      onClick={onCopyBlueprint}
                      style={{
                        border: `1px solid ${blueprintCopied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: blueprintCopied ? 'rgb(34,197,94)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {blueprintCopied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {blueprintCopied ? 'Copied' : 'Copy'}
                    </MagneticButton>
                    <MagneticButton
                      className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-primary/30 hover:text-primary bg-transparent"
                      onClick={onShare}
                      disabled={isSharing || !!shareUrl}
                    >
                      {isSharing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : shareUrl ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}
                      {isSharing ? 'Sharing...' : shareUrl ? 'Shared' : 'Share'}
                    </MagneticButton>
                    <MagneticButton
                      className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-primary/30 hover:text-primary bg-transparent"
                      onClick={onStartOver}
                    >
                      <Wand2 className="h-4 w-4" />
                      New Blueprint
                    </MagneticButton>
                  </div>
                </div>

                {/* Stats row */}
                {blueprintMeta && (
                  <motion.div
                    className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/[0.06]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-white/30" />
                      <span className="text-sm font-mono text-white/50">
                        {Math.round(blueprintMeta.totalTime / 1000)}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-white/30" />
                      <span className="text-sm font-mono text-white/50">
                        ${blueprintMeta.totalCost.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-4 w-4 text-white/30" />
                      <span className="text-sm text-white/50">
                        {strategicBlueprint?.keywordIntelligence ? '6' : '5'} sections analyzed
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Share Link Display */}
                <AnimatePresence>
                  {shareUrl && (
                    <motion.div
                      className="mt-6 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Link2 className="h-4 w-4 text-primary" />
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
                          className="h-9 rounded-full px-4 text-sm font-medium bg-gradient-to-r from-primary to-primary/80 text-white transition-opacity duration-200 hover:opacity-90"
                          onClick={onCopyLink}
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
                </AnimatePresence>

                {/* Share Error Display */}
                <AnimatePresence>
                  {shareError && (
                    <motion.div
                      className="mt-4 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-sm text-red-400/80">
                        {shareError}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GradientBorder>
          </motion.div>
        </div>

        {/* Paginated Blueprint Content */}
        <div className="flex-1 min-h-0">
          <PaginatedBlueprintView strategicBlueprint={strategicBlueprint} />
        </div>
      </main>
    </div>
  );
}
