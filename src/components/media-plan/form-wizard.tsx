"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NicheForm } from "./niche-form";
import { BriefingForm } from "./briefing-form";
import { ProgressIndicator } from "./progress-indicator";
import { BlueprintDisplay } from "./blueprint-display";
import type {
  NicheFormData,
  BriefingFormData,
  MediaPlanBlueprint,
  PipelineStage,
} from "@/lib/media-plan/types";

type WizardStep = "niche" | "briefing" | "generating" | "result";

export function FormWizard() {
  const [step, setStep] = useState<WizardStep>("niche");
  const [nicheData, setNicheData] = useState<NicheFormData | null>(null);
  const [briefingData, setBriefingData] = useState<BriefingFormData | null>(null);
  const [blueprint, setBlueprint] = useState<MediaPlanBlueprint | null>(null);
  const [currentStage, setCurrentStage] = useState<PipelineStage>("extract");
  const [error, setError] = useState<string | null>(null);

  async function handleNicheSubmit(data: NicheFormData) {
    setNicheData(data);
    setStep("briefing");
  }

  async function handleBriefingSubmit(data: BriefingFormData) {
    setBriefingData(data);
    setStep("generating");
    setError(null);
    setCurrentStage("extract");

    try {
      // Poll for progress updates using a simple approach
      // In a production app, you might use WebSockets or SSE
      const progressInterval = setInterval(() => {
        setCurrentStage((prev) => {
          const stages: PipelineStage[] = ["extract", "research", "logic", "synthesize"];
          const currentIndex = stages.indexOf(prev);
          // Progress through stages every ~12 seconds for visual feedback
          if (currentIndex < stages.length - 1) {
            return stages[currentIndex + 1];
          }
          return prev;
        });
      }, 12000);

      const response = await fetch("/api/media-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: nicheData,
          briefing: data,
        }),
      });

      clearInterval(progressInterval);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to generate media plan");
      }

      setBlueprint(result.blueprint);
      setCurrentStage("complete");
      setStep("result");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      // Stay on generating step to show error in progress indicator
    }
  }

  function handleStartOver() {
    setStep("niche");
    setNicheData(null);
    setBriefingData(null);
    setBlueprint(null);
    setError(null);
    setCurrentStage("extract");
  }

  // Step indicator for forms
  const formStepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-6">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          step === "niche"
            ? "bg-primary text-primary-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {step === "niche" ? "1" : "✓"}
      </div>
      <div className={`w-12 h-0.5 ${step === "niche" ? "bg-muted" : "bg-primary"}`} />
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          step === "briefing"
            ? "bg-primary text-primary-foreground"
            : step === "niche"
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground"
        }`}
      >
        2
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Niche Form Step */}
      {step === "niche" && (
        <>
          {formStepIndicator}
          <NicheForm
            initialData={nicheData || undefined}
            onSubmit={handleNicheSubmit}
          />
        </>
      )}

      {/* Briefing Form Step */}
      {step === "briefing" && (
        <>
          {formStepIndicator}
          <BriefingForm
            initialData={briefingData || undefined}
            onSubmit={handleBriefingSubmit}
            onBack={() => setStep("niche")}
          />
        </>
      )}

      {/* Generating Step */}
      {step === "generating" && (
        <Card>
          <CardContent className="pt-6">
            <ProgressIndicator currentStage={currentStage} error={error || undefined} />
            {error && (
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setStep("briefing")}>
                  Go Back
                </Button>
                <Button onClick={() => handleBriefingSubmit(briefingData!)}>
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result Step */}
      {step === "result" && blueprint && (
        <div className="space-y-6">
          <BlueprintDisplay blueprint={blueprint} />
          <div className="flex justify-center pt-4">
            <Button onClick={handleStartOver} variant="outline">
              Generate Another Plan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
