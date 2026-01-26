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
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard, GlowCardContent } from "@/components/ui/glow-card";
import { GradientText } from "@/components/ui/gradient-text";
import { fadeUp, staggerContainer, staggerItem, springs } from "@/lib/motion";
import {
  getOnboardingData,
  getStrategicBlueprint,
} from "@/lib/storage/local-storage";
import { getUserBlueprints, deleteBlueprint, type BlueprintRecord } from "@/lib/actions/blueprints";
import { getOnboardingStatus } from "@/lib/actions/onboarding";
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
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      // Fetch onboarding status from database
      const onboardingResult = await getOnboardingStatus();
      if (onboardingResult.data) {
        setOnboardingCompleted(onboardingResult.data.completed);
        // If onboarding data exists in DB, use it
        if (onboardingResult.data.onboardingData) {
          // Map DB format to form format (use unknown cast for JSON data)
          const dbData = onboardingResult.data.onboardingData;
          setOnboardingData({
            businessBasics: dbData.businessBasics as unknown as OnboardingFormData['businessBasics'],
            icp: dbData.icpData as unknown as OnboardingFormData['icp'],
            productOffer: dbData.productOffer as unknown as OnboardingFormData['productOffer'],
            marketCompetition: dbData.marketCompetition as unknown as OnboardingFormData['marketCompetition'],
            customerJourney: dbData.customerJourney as unknown as OnboardingFormData['customerJourney'],
            brandPositioning: dbData.brandPositioning as unknown as OnboardingFormData['brandPositioning'],
            assetsProof: dbData.assetsProof as unknown as OnboardingFormData['assetsProof'],
            budgetTargets: dbData.budgetTargets as unknown as OnboardingFormData['budgetTargets'],
            compliance: dbData.compliance as unknown as OnboardingFormData['compliance'],
          } as OnboardingFormData);
        }
      }

      // Fetch ALL blueprints from database
      const blueprintsResult = await getUserBlueprints();
      if (blueprintsResult.data && blueprintsResult.data.length > 0) {
        setBlueprints(blueprintsResult.data);
      }

      // Fallback to localStorage if database empty (migration period)
      if (!blueprintsResult.data?.length) {
        const localBlueprint = getStrategicBlueprint();
        if (localBlueprint) {
          setSavedBlueprint(localBlueprint);
        }
      }

      // Fallback for onboarding data from localStorage
      if (!onboardingResult.data?.onboardingData) {
        const localOnboarding = getOnboardingData();
        if (localOnboarding) {
          setOnboardingData(localOnboarding);
        }
      }

      setIsLoading(false);
    }

    loadData();
  }, []);

  const handleDeleteBlueprint = async (id: string) => {
    setDeletingId(id);
    try {
      const result = await deleteBlueprint(id);
      if (result.success) {
        setBlueprints((prev) => prev.filter((bp) => bp.id !== id));
      }
    } catch (error) {
      console.error('[Dashboard] Failed to delete blueprint:', error);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const hasOnboardingData = !!onboardingData || onboardingCompleted;
  const hasBlueprint = blueprints.length > 0 || !!savedBlueprint;
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
                  <Link href={hasOnboardingData ? "/onboarding/edit" : "/generate"}>
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

      {/* Saved Blueprints Section - From Database */}
      {blueprints.length > 0 && (
        <motion.section
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ ...springs.smooth, delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            Your Blueprints ({blueprints.length})
          </h2>

          <div className="space-y-4">
            {blueprints.map((bp) => (
              <GlowCard key={bp.id} variant="glass" glow="sm" className="p-6">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="inline-flex items-center justify-center size-10 rounded-lg bg-green-500/20 text-green-400 shrink-0">
                      <FileCheck className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {bp.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Generated {formatDate(bp.created_at)}
                      </p>
                      {bp.output?.competitorAnalysis?.competitors && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {bp.output.competitorAnalysis.competitors.length} competitors analyzed
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Link href={`/blueprint/${bp.id}`} className="flex-1 sm:flex-none">
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        <Eye className="size-4 mr-2" />
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none text-red-400 hover:text-red-300 hover:border-red-400"
                      onClick={() => handleDeleteBlueprint(bp.id)}
                      disabled={deletingId === bp.id}
                    >
                      <Trash2 className="size-4 mr-2" />
                      {deletingId === bp.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        </motion.section>
      )}

      {/* Fallback: localStorage blueprint (for migration period) */}
      {blueprints.length === 0 && savedBlueprint && (
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
                <div className="inline-flex items-center justify-center size-10 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
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
                  <p className="text-xs text-yellow-400 mt-1">
                    Local only - generate a new blueprint to save to cloud
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Link href="/blueprint/view" className="flex-1 sm:flex-none">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Eye className="size-4 mr-2" />
                    View
                  </Button>
                </Link>
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
