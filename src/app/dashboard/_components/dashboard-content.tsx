"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Wand2,
  ArrowRight,
  ClipboardEdit,
  FileCheck,
  Share2,
  Eye,
  TrendingUp,
  Users,
  Target,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard, GlowCardContent } from "@/components/ui/glow-card";
import { GradientText } from "@/components/ui/gradient-text";
import { fadeUp, staggerContainer, staggerItem, springs } from "@/lib/motion";
import {
  getOnboardingData,
  getStrategicBlueprint,
} from "@/lib/storage/local-storage";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { OnboardingFormData } from "@/lib/onboarding/types";

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="h-10 w-80 bg-muted rounded" />
        <div className="h-5 w-96 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-48 bg-muted rounded-xl" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardContent() {
  const [onboardingData, setOnboardingData] = useState<OnboardingFormData | null>(null);
  const [savedBlueprint, setSavedBlueprint] = useState<StrategicBlueprintOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const onboarding = getOnboardingData();
    const blueprint = getStrategicBlueprint();

    setOnboardingData(onboarding);
    setSavedBlueprint(blueprint);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const hasOnboardingData = !!onboardingData;
  const hasBlueprint = !!savedBlueprint;
  const companyName = onboardingData?.businessBasics?.businessName || "Your Company";

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={springs.smooth}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-4">
          <Sparkles className="size-4" />
          <span>{hasBlueprint ? "Welcome back" : "Getting Started"}</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          <span className="text-white">Your </span>
          <GradientText variant="hero" as="span" className="font-bold">
            Marketing Research
          </GradientText>
          <span className="text-white"> Hub</span>
        </h1>

        <p className="mt-4 text-muted-foreground max-w-xl">
          Generate AI-powered Strategic Research Blueprints with market analysis,
          competitor insights, and actionable recommendations.
        </p>
      </motion.div>

      {/* Primary Action Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Generate Blueprint Card */}
        <motion.div variants={staggerItem} transition={springs.smooth}>
          <GlowCard variant="glass" glow="md" gradientBorder className="p-6 h-full">
            <GlowCardContent className="p-0">
              <div className="flex items-start gap-4">
                <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/20 text-primary shrink-0">
                  <Wand2 className="size-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-white mb-2">
                    Generate Strategic Blueprint
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create a comprehensive market research document with AI-powered
                    insights, competitor analysis, and recommendations.
                  </p>
                  <Link href="/generate">
                    <Button variant="gradient" size="lg" className="group">
                      {hasBlueprint ? "Generate New" : "Start Research"}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </GlowCardContent>
          </GlowCard>
        </motion.div>

        {/* Edit Onboarding Card */}
        <motion.div variants={staggerItem} transition={springs.smooth}>
          <GlowCard variant="glass" glow="sm" className="p-6 h-full">
            <GlowCardContent className="p-0">
              <div className="flex items-start gap-4">
                <div className="inline-flex items-center justify-center size-12 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                  <ClipboardEdit className="size-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-white mb-2">
                    {hasOnboardingData ? "Edit Business Profile" : "Complete Onboarding"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {hasOnboardingData
                      ? `Update ${companyName}'s details to refine future blueprints and ensure accurate research.`
                      : "Tell us about your business to generate accurate, personalized research and recommendations."}
                  </p>
                  <Link href="/generate">
                    <Button variant="outline" size="default">
                      {hasOnboardingData ? "Edit Profile" : "Get Started"}
                    </Button>
                  </Link>
                </div>
              </div>
            </GlowCardContent>
          </GlowCard>
        </motion.div>
      </motion.div>

      {/* Saved Blueprint Section */}
      {hasBlueprint && savedBlueprint && (
        <motion.section
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ ...springs.smooth, delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            Your Blueprints
          </h2>

          <GlowCard variant="glass" glow="sm" className="p-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="inline-flex items-center justify-center size-10 rounded-lg bg-green-500/20 text-green-400 shrink-0">
                  <FileCheck className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {savedBlueprint.industryMarketOverview?.categorySnapshot?.category ||
                      companyName + " Blueprint"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Generated{" "}
                    {savedBlueprint.metadata?.generatedAt
                      ? formatDate(savedBlueprint.metadata.generatedAt)
                      : "recently"}
                  </p>
                  {savedBlueprint.competitorAnalysis?.competitors && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {savedBlueprint.competitorAnalysis.competitors.length} competitors analyzed
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Link href="/generate" className="flex-1 sm:flex-none">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Eye className="size-4 mr-2" />
                    View
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Share2 className="size-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </GlowCard>
        </motion.section>
      )}

      {/* Features Grid */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <h2 className="text-xl font-semibold text-white mb-6">
          What You&apos;ll Get
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div variants={staggerItem} transition={springs.smooth}>
            <GlowCard variant="glass" glow="sm" className="p-6 text-left h-full">
              <GlowCardContent className="p-0">
                <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/20 text-primary mb-4">
                  <TrendingUp className="size-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-white">
                  Market Analysis
                </h3>
                <p className="text-sm text-muted-foreground">
                  Deep dive into your industry, market dynamics, trends, and growth
                  opportunities.
                </p>
              </GlowCardContent>
            </GlowCard>
          </motion.div>

          <motion.div variants={staggerItem} transition={springs.smooth}>
            <GlowCard variant="glass" glow="sm" className="p-6 text-left h-full">
              <GlowCardContent className="p-0">
                <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/20 text-primary mb-4">
                  <Users className="size-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-white">
                  ICP Validation
                </h3>
                <p className="text-sm text-muted-foreground">
                  Validate your ideal customer profile with data-driven insights
                  and persona analysis.
                </p>
              </GlowCardContent>
            </GlowCard>
          </motion.div>

          <motion.div variants={staggerItem} transition={springs.smooth}>
            <GlowCard variant="glass" glow="sm" className="p-6 text-left h-full">
              <GlowCardContent className="p-0">
                <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/20 text-primary mb-4">
                  <Target className="size-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-white">
                  Competitor Intel
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analyze competitor strategies, ad creatives, positioning, and
                  market share.
                </p>
              </GlowCardContent>
            </GlowCard>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
