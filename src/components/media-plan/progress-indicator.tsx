"use client";

import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/media-plan/types";

interface ProgressIndicatorProps {
  currentStage: PipelineStage;
  error?: string;
}

const STAGES: { id: PipelineStage; label: string; description: string }[] = [
  { id: "extract", label: "Extract", description: "Parsing your inputs" },
  { id: "research", label: "Research", description: "Analyzing the market" },
  { id: "logic", label: "Strategy", description: "Applying decision rules" },
  { id: "synthesize", label: "Generate", description: "Writing your blueprint" },
];

function getStageStatus(
  stageId: PipelineStage,
  currentStage: PipelineStage
): "completed" | "active" | "pending" {
  const stageOrder: PipelineStage[] = ["extract", "research", "logic", "synthesize", "complete"];
  const currentIndex = stageOrder.indexOf(currentStage);
  const stageIndex = stageOrder.indexOf(stageId);

  if (currentStage === "complete" || stageIndex < currentIndex) {
    return "completed";
  }
  if (stageIndex === currentIndex) {
    return "active";
  }
  return "pending";
}

export function ProgressIndicator({ currentStage, error }: ProgressIndicatorProps) {
  const isComplete = currentStage === "complete";

  return (
    <div className="w-full py-6">
      {/* Stage indicators */}
      <div className="flex items-center justify-between mb-8">
        {STAGES.map((stage, index) => {
          const status = getStageStatus(stage.id, currentStage);
          const isLast = index === STAGES.length - 1;

          return (
            <div key={stage.id} className="flex items-center flex-1">
              {/* Stage circle and label */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                    status === "completed" && "bg-primary text-primary-foreground",
                    status === "active" && "bg-primary text-primary-foreground animate-pulse",
                    status === "pending" && "bg-muted text-muted-foreground"
                  )}
                >
                  {status === "completed" ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    status === "active" && "text-primary",
                    status === "pending" && "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-all duration-300",
                    status === "completed" ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current stage description */}
      <div className="text-center">
        {error ? (
          <div className="text-destructive">
            <p className="font-medium">An error occurred</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : isComplete ? (
          <div className="text-primary">
            <p className="font-medium">Blueprint Complete!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your Strategic Research Blueprint is ready
            </p>
          </div>
        ) : (
          <div>
            <p className="font-medium">
              {STAGES.find((s) => s.id === currentStage)?.description || "Processing..."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              This usually takes 40-50 seconds
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
