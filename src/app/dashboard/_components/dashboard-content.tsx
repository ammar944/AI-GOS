"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getUserBlueprints, deleteBlueprint, type BlueprintRecord } from "@/lib/actions/blueprints";
import { getUserMediaPlans, deleteMediaPlan, type MediaPlanRecord } from "@/lib/actions/media-plans";
import { getOnboardingStatus } from "@/lib/actions/onboarding";
import { getOnboardingData } from "@/lib/storage/local-storage";
import { mapDbToFormData, getOnboardingProgress } from "@/lib/onboarding/utils";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { WelcomeStrip } from "./welcome-strip";
import { DocumentTabs } from "./document-tabs";

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton">
      {/* Welcome strip skeleton */}
      <div className="pt-8 pb-6 space-y-3">
        <div className="flex items-end justify-between">
          <div className="space-y-2.5">
            <div className="h-8 w-48 skeleton-block rounded-md" />
            <div className="h-4 w-80 skeleton-block-subtle rounded-md" />
          </div>
          <div className="flex gap-2.5">
            <div className="size-9 skeleton-block rounded-lg" />
            <div className="h-10 w-40 skeleton-block-accent rounded-lg" />
          </div>
        </div>
        <div className="flex gap-5 mt-2">
          <div className="h-7 w-28 skeleton-block-subtle rounded" />
          <div className="h-7 w-24 skeleton-block-subtle rounded" />
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />

      {/* Tab bar + controls skeleton */}
      <div className="mt-8">
        <div className="flex items-end justify-between border-b border-white/[0.06] pb-2.5">
          <div className="flex items-center gap-6">
            <div className="h-4 w-12 skeleton-block-subtle rounded" />
            <div className="h-4 w-20 skeleton-block-subtle rounded" />
            <div className="h-4 w-24 skeleton-block-subtle rounded" />
          </div>
          <div className="flex gap-2.5">
            <div className="h-9 w-56 skeleton-block-subtle rounded-lg" />
            <div className="h-9 w-24 skeleton-block-subtle rounded-lg" />
          </div>
        </div>

        {/* Result count placeholder */}
        <div className="h-3.5 w-32 skeleton-block-subtle rounded mt-4 mb-1" />

        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="flex items-start gap-3.5">
                <div className="size-10 skeleton-block rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 skeleton-block rounded" />
                  <div className="h-3 w-24 skeleton-block-subtle rounded" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <div className="h-6 w-20 skeleton-block-subtle rounded-md" />
                <div className="h-6 w-16 skeleton-block-subtle rounded-md" />
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.04]">
                <div className="h-8 w-full skeleton-block-subtle rounded-lg" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardContent() {
  const [onboardingData, setOnboardingData] = useState<OnboardingFormData | null>(null);
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [mediaPlans, setMediaPlans] = useState<MediaPlanRecord[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState<{
    currentStep: number;
    completedSections: number;
    totalSections: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingBlueprintId, setDeletingBlueprintId] = useState<string | null>(null);
  const [deletingMediaPlanId, setDeletingMediaPlanId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const onboardingResult = await getOnboardingStatus();
      if (onboardingResult.data) {
        setOnboardingCompleted(onboardingResult.data.completed);
        if (onboardingResult.data.onboardingData) {
          const dbData = onboardingResult.data.onboardingData;
          setOnboardingData(mapDbToFormData(dbData) as OnboardingFormData);
          setOnboardingProgress(getOnboardingProgress(dbData));
        }
      }

      const blueprintsResult = await getUserBlueprints();
      if (blueprintsResult.data && blueprintsResult.data.length > 0) {
        setBlueprints(blueprintsResult.data);
      }

      const mediaPlansResult = await getUserMediaPlans();
      if (mediaPlansResult.data) {
        setMediaPlans(mediaPlansResult.data);
      }

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

  const handleDeleteBlueprint = useCallback(async (id: string) => {
    setDeletingBlueprintId(id);
    try {
      const result = await deleteBlueprint(id);
      if (result.success) {
        setBlueprints((prev) => prev.filter((bp) => bp.id !== id));
      }
    } catch (error) {
      console.error("[Dashboard] Failed to delete blueprint:", error);
    } finally {
      setDeletingBlueprintId(null);
    }
  }, []);

  const handleDeleteMediaPlan = useCallback(async (id: string) => {
    setDeletingMediaPlanId(id);
    try {
      const result = await deleteMediaPlan(id);
      if (result.success) {
        setMediaPlans((prev) => prev.filter((mp) => mp.id !== id));
      }
    } catch (error) {
      console.error("[Dashboard] Failed to delete media plan:", error);
    } finally {
      setDeletingMediaPlanId(null);
    }
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const hasOnboardingData = !!onboardingData || onboardingCompleted;

  return (
    <div>
      <WelcomeStrip
        onboardingCompleted={onboardingCompleted}
        hasOnboardingData={hasOnboardingData}
        onboardingProgress={onboardingProgress}
        totalBlueprints={blueprints.length}
        totalMediaPlans={mediaPlans.length}
        businessName={onboardingData?.businessBasics?.businessName}
        websiteUrl={onboardingData?.businessBasics?.websiteUrl}
      />

      <DocumentTabs
        blueprints={blueprints}
        mediaPlans={mediaPlans}
        onDeleteBlueprint={handleDeleteBlueprint}
        onDeleteMediaPlan={handleDeleteMediaPlan}
        deletingBlueprintId={deletingBlueprintId}
        deletingMediaPlanId={deletingMediaPlanId}
      />
    </div>
  );
}
