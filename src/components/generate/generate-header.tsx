"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export type GenerateStage = "onboarding" | "generate" | "review" | "complete";

interface GenerateHeaderProps {
  /** Current stage in the generation workflow */
  currentStage: GenerateStage;

  /** Whether the user has unsaved progress that would be lost on exit */
  hasUnsavedProgress?: boolean;

  /** Callback when user confirms exit (navigate to dashboard) */
  onExit?: () => void;

  /** Custom exit URL (defaults to /dashboard) */
  exitUrl?: string;

  /** Whether the header should be collapsible (useful during generation) */
  collapsible?: boolean;

  /** Initial collapsed state (only applies if collapsible is true) */
  defaultCollapsed?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Optional action buttons rendered in the right slot (before Exit + UserButton) */
  actions?: React.ReactNode;
}

// =============================================================================
// Stage Configuration
// =============================================================================

const STAGE_CONFIG: Record<
  GenerateStage,
  {
    number: number;
    label: string;
    shortLabel: string;
  }
> = {
  onboarding: {
    number: 1,
    label: "Onboarding",
    shortLabel: "Setup",
  },
  generate: {
    number: 2,
    label: "Generate Blueprint",
    shortLabel: "Generate",
  },
  review: {
    number: 3,
    label: "Review & Refine",
    shortLabel: "Review",
  },
  complete: {
    number: 4,
    label: "Complete",
    shortLabel: "Done",
  },
};

// =============================================================================
// Component
// =============================================================================

export function GenerateHeader({
  currentStage,
  hasUnsavedProgress = false,
  onExit,
  exitUrl = "/dashboard",
  collapsible = false,
  defaultCollapsed = false,
  className,
  actions,
}: GenerateHeaderProps) {
  const router = useRouter();
  const [isExitDialogOpen, setIsExitDialogOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  // Handle exit button click
  const handleExitClick = React.useCallback(() => {
    if (hasUnsavedProgress) {
      setIsExitDialogOpen(true);
    } else {
      onExit?.();
      router.push(exitUrl);
    }
  }, [hasUnsavedProgress, onExit, exitUrl, router]);

  // Confirm exit with unsaved progress
  const handleConfirmExit = React.useCallback(() => {
    setIsExitDialogOpen(false);
    onExit?.();
    router.push(exitUrl);
  }, [onExit, exitUrl, router]);

  const stages = Object.entries(STAGE_CONFIG) as [GenerateStage, typeof STAGE_CONFIG[GenerateStage]][];
  const currentStageNumber = STAGE_CONFIG[currentStage].number;

  return (
    <>
      <motion.header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          "border-b border-[var(--border-subtle)] backdrop-blur-sm bg-[var(--bg-base)]/80",
          className
        )}
        initial={false}
        animate={{
          height: collapsible && isCollapsed ? "40px" : "auto",
        }}
      >
        <div className="container mx-auto px-4">
          {/* Main Header Content */}
          <div className="flex h-12 items-center justify-between">
            {/* Left: Logo */}
            <Link
              href={exitUrl}
              className="transition-opacity hover:opacity-80"
              aria-label="Go to dashboard"
            >
              <Logo size="sm" />
            </Link>

            {/* Center: Progress Indicator (hidden on mobile) */}
            <AnimatePresence mode="wait">
              {(!collapsible || !isCollapsed) && (
                <motion.div
                  className="hidden md:flex items-center gap-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {stages.map(([stageKey, stage], index) => {
                    const isActive = stage.number === currentStageNumber;
                    const isCompleted = stage.number < currentStageNumber;
                    const isUpcoming = stage.number > currentStageNumber;

                    return (
                      <React.Fragment key={stageKey}>
                        {/* Stage Indicator */}
                        <div
                          className={cn(
                            "flex items-center gap-2 transition-all duration-300",
                            isUpcoming && "opacity-40"
                          )}
                        >
                          {/* Circle */}
                          <div
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all duration-300",
                              isCompleted &&
                                "bg-green-500/20 border border-green-500 text-green-500",
                              isActive &&
                                "bg-[rgba(54,94,255,0.15)] border border-[rgb(54,94,255)] text-[rgb(54,94,255)]",
                              isUpcoming &&
                                "bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]"
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              stage.number
                            )}
                          </div>

                          {/* Label */}
                          <span
                            className={cn(
                              "text-sm transition-all duration-300",
                              isActive && "font-medium text-foreground",
                              !isActive && "text-muted-foreground"
                            )}
                          >
                            {stage.shortLabel}
                          </span>
                        </div>

                        {/* Separator */}
                        {index < stages.length - 1 && (
                          <div
                            className={cn(
                              "h-px w-8 transition-all duration-300",
                              stage.number < currentStageNumber
                                ? "bg-green-500/50"
                                : "bg-border/50"
                            )}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Right: Actions + Exit Button + UserButton */}
            <div className="flex items-center gap-3">
              {/* Injected action buttons (e.g. from complete view) */}
              {actions}

              {/* Collapse Toggle (only if collapsible) */}
              {collapsible && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="hidden md:flex"
                  aria-label={isCollapsed ? "Expand header" : "Collapse header"}
                >
                  <motion.div
                    animate={{ rotate: isCollapsed ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </motion.div>
                </Button>
              )}

              {/* Exit Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExitClick}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Exit</span>
              </Button>

              {/* User Button */}
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>

          {/* Mobile Progress Indicator (below main header) */}
          <AnimatePresence>
            {(!collapsible || !isCollapsed) && (
              <motion.div
                className="md:hidden pb-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
                  {stages.map(([stageKey, stage], index) => {
                    const isActive = stage.number === currentStageNumber;
                    const isCompleted = stage.number < currentStageNumber;
                    const isUpcoming = stage.number > currentStageNumber;

                    return (
                      <React.Fragment key={stageKey}>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 whitespace-nowrap transition-all duration-300",
                            isUpcoming && "opacity-40"
                          )}
                        >
                          {/* Circle */}
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-all duration-300",
                              isCompleted &&
                                "bg-green-500/20 border border-green-500 text-green-500",
                              isActive &&
                                "bg-[rgba(54,94,255,0.15)] border border-[rgb(54,94,255)] text-[rgb(54,94,255)]",
                              isUpcoming &&
                                "bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]"
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              stage.number
                            )}
                          </div>

                          {/* Label (short version) */}
                          <span
                            className={cn(
                              "text-xs transition-all duration-300",
                              isActive && "font-medium text-foreground",
                              !isActive && "text-muted-foreground"
                            )}
                          >
                            {stage.shortLabel}
                          </span>
                        </div>

                        {index < stages.length - 1 && (
                          <div
                            className={cn(
                              "h-px w-4 transition-all duration-300",
                              stage.number < currentStageNumber
                                ? "bg-green-500/50"
                                : "bg-border/50"
                            )}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <AlertDialogTitle className="text-xl">
                Exit Without Saving?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base">
              {currentStage === "generate"
                ? "Your blueprint is currently being generated. If you exit now, you'll lose this progress and will need to start over."
                : "You have unsaved progress. If you exit now, your changes will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmExit}
              className="bg-destructive hover:bg-destructive/90"
            >
              Exit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
