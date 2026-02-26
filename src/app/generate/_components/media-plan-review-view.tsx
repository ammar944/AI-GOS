"use client";

import { MediaPlanAgentChat } from "@/components/chat";
import { TwoColumnLayout } from "@/components/layout";
import { MediaPlanDocument } from "@/components/media-plan";
import { GenerateHeader } from "@/components/generate";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import type { GenerateStage } from "@/components/generate";
import type { MediaPlanOutput } from "@/lib/media-plan/types";

export interface MediaPlanReviewViewProps {
  headerStage: GenerateStage;
  activeMediaPlan: MediaPlanOutput;
  savedMediaPlanId: string;
  onboardingData: Record<string, unknown>;
  onApprove: (plan: MediaPlanOutput) => void;
  onMediaPlanChatUpdate: (updated: Record<string, unknown>) => void;
  onStartOver: () => void;
}

export function MediaPlanReviewView({
  headerStage,
  activeMediaPlan,
  savedMediaPlanId,
  onboardingData,
  onApprove,
  onMediaPlanChatUpdate,
  onStartOver,
}: MediaPlanReviewViewProps) {
  return (
    <div className="relative flex h-screen flex-col" style={{ background: 'var(--bg-base)' }}>
      <GenerateHeader
        currentStage={headerStage}
        hasUnsavedProgress={!savedMediaPlanId}
        onExit={onStartOver}
        exitUrl="/dashboard"
      />
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.015} />
      <div className="z-10 flex min-h-0 flex-1">
        <TwoColumnLayout
          chatContent={
            <MediaPlanAgentChat
              mediaPlan={activeMediaPlan as unknown as Record<string, unknown>}
              mediaPlanId={savedMediaPlanId}
              onboardingData={onboardingData}
              onMediaPlanUpdate={onMediaPlanChatUpdate}
            />
          }
          blueprintContent={
            <MediaPlanDocument mediaPlan={activeMediaPlan} onApprove={onApprove} />
          }
        />
      </div>
    </div>
  );
}
