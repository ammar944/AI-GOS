"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Wand2, Play, ArrowRight, Building2, Globe, Pencil } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { springs } from "@/lib/motion";

interface OnboardingProgress {
  currentStep: number;
  completedSections: number;
  totalSections: number;
}

interface WelcomeStripProps {
  onboardingCompleted: boolean;
  hasOnboardingData: boolean;
  onboardingProgress: OnboardingProgress | null;
  totalBlueprints: number;
  totalMediaPlans: number;
  businessName?: string;
  websiteUrl?: string;
}

export function WelcomeStrip({
  onboardingCompleted,
  hasOnboardingData,
  onboardingProgress,
  totalBlueprints,
  totalMediaPlans,
  businessName,
  websiteUrl,
}: WelcomeStripProps) {
  const { user } = useUser();
  const firstName = user?.firstName || "there";

  const isOnboardingComplete =
    onboardingCompleted ||
    (onboardingProgress && onboardingProgress.completedSections >= 9);

  const isOnboardingPartial =
    hasOnboardingData &&
    onboardingProgress &&
    onboardingProgress.completedSections < 9 &&
    !onboardingCompleted;

  const totalDocs = totalBlueprints + totalMediaPlans;

  // Clean up website URL for display
  const displayUrl = websiteUrl
    ?.replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return (
    <motion.div
      className="pb-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: 0.05 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {/* Left: Greeting + business context + metrics */}
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-[32px] font-light tracking-tight text-white">
            Hey {firstName}
          </h1>

          {/* Business identity line — shown when onboarding is complete */}
          {isOnboardingComplete && businessName ? (
            <div className="flex items-center gap-3 pt-0.5">
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <Building2 className="size-3.5 text-[var(--text-tertiary)]" />
                <span className="font-medium text-white">{businessName}</span>
              </div>
              {displayUrl && (
                <>
                  <span className="text-white/[0.12]">/</span>
                  <a
                    href={websiteUrl?.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-blue-400 transition-colors"
                  >
                    <Globe className="size-3.5" />
                    <span>{displayUrl}</span>
                  </a>
                </>
              )}
              <Link
                href="/onboarding/edit"
                className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-white transition-colors ml-1 opacity-0 group-hover/welcome:opacity-100"
              >
                <Pencil className="size-3" />
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
              {isOnboardingComplete
                ? "Your workspace is ready."
                : "Complete onboarding to get started."}
            </p>
          )}

          {/* Inline stat badges — compact pills */}
          {totalDocs > 0 && (
            <div className="flex items-center gap-2 pt-1.5">
              {totalBlueprints > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                  <span className="font-medium text-white tabular-nums">
                    {totalBlueprints}
                  </span>
                  {totalBlueprints === 1 ? "blueprint" : "blueprints"}
                </span>
              )}
              {totalMediaPlans > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                  <span className="font-medium text-white tabular-nums">
                    {totalMediaPlans}
                  </span>
                  {totalMediaPlans === 1 ? "plan" : "plans"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!hasOnboardingData && (
            <Link href="/generate">
              <Button variant="default" size="default" className="group">
                Start Onboarding
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          )}

          {isOnboardingPartial && (
            <Link href="/generate">
              <Button variant="default" size="default" className="group">
                <Play className="size-3.5" />
                Resume Step {onboardingProgress!.currentStep + 1}/{onboardingProgress!.totalSections}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          )}

          {isOnboardingComplete && (
            <>
              <Link href="/onboarding/edit">
                <Button
                  variant="outline"
                  size="default"
                  className="text-[var(--text-secondary)] border-white/[0.08] hover:border-white/[0.15] hover:text-white"
                >
                  <Pencil className="size-3.5" />
                  Edit Profile
                </Button>
              </Link>
              <Link href="/generate">
                <Button variant="default" size="default" className="group">
                  <Wand2 className="size-3.5" />
                  New Blueprint
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Clean bottom border */}
      <div className="mt-6 h-px bg-white/[0.06]" />
    </motion.div>
  );
}
