"use client";

import { BlueprintEditProvider } from "@/components/strategic-blueprint/blueprint-edit-context";
import { BlueprintDocument } from "@/components/strategic-research";
import { AgentChat } from "@/components/chat";
import { SplitChatLayout } from "@/components/layout";
import { GenerateHeader } from "@/components/generate";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import type { GenerateStage } from "@/components/generate";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

export interface BlueprintReviewViewProps {
  headerStage: GenerateStage;
  hasUnsavedProgress: boolean;
  strategicBlueprint: StrategicBlueprintOutput;
  onApprove: (blueprint: StrategicBlueprintOutput) => void;
  onBlueprintUpdate: (updated: StrategicBlueprintOutput) => void;
  onStartOver: () => void;
}

export function BlueprintReviewView({
  headerStage,
  hasUnsavedProgress,
  strategicBlueprint,
  onApprove,
  onBlueprintUpdate,
  onStartOver,
}: BlueprintReviewViewProps) {
  return (
    <div className="relative flex h-screen flex-col" style={{ background: 'var(--bg-base)' }}>
      <GenerateHeader
        currentStage={headerStage}
        hasUnsavedProgress={hasUnsavedProgress}
        onExit={onStartOver}
        exitUrl="/dashboard"
      />
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.015} />
      <div className="z-10 flex min-h-0 flex-1">
        <BlueprintEditProvider>
          <SplitChatLayout
            chatContent={
              <AgentChat
                blueprint={strategicBlueprint as unknown as Record<string, unknown>}
                onBlueprintUpdate={(updated) => onBlueprintUpdate(updated as unknown as StrategicBlueprintOutput)}
              />
            }
            blueprintContent={
              <BlueprintDocument strategicBlueprint={strategicBlueprint} onApprove={onApprove} />
            }
          />
        </BlueprintEditProvider>
      </div>
    </div>
  );
}
