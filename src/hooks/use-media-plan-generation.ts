"use client";

import { useState, useCallback, useRef } from "react";
import type { MediaPlanOutput, MediaPlanSSEEvent } from "@/lib/media-plan/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { OnboardingFormData } from "@/lib/onboarding/types";

// =============================================================================
// SSE Parsing (same logic as generate/page.tsx)
// =============================================================================

function parseSSEEvent(eventStr: string): MediaPlanSSEEvent | null {
  const lines = eventStr.trim().split("\n");
  let eventType = "";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventType = line.slice(7);
    } else if (line.startsWith("data: ")) {
      data = line.slice(6);
    }
  }

  if (!eventType || !data) return null;

  try {
    return JSON.parse(data) as MediaPlanSSEEvent;
  } catch {
    return null;
  }
}

// =============================================================================
// Hook
// =============================================================================

export interface MediaPlanGenerationState {
  mediaPlan: MediaPlanOutput | null;
  isGenerating: boolean;
  progress: { percentage: number; message: string };
  error: string | null;
  meta: { totalTime: number; totalCost: number } | null;
}

export interface UseMediaPlanGenerationReturn extends MediaPlanGenerationState {
  generate: (blueprint: StrategicBlueprintOutput, onboardingData: OnboardingFormData) => Promise<void>;
  reset: () => void;
}

export function useMediaPlanGeneration(): UseMediaPlanGenerationReturn {
  const [mediaPlan, setMediaPlan] = useState<MediaPlanOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ percentage: 0, message: "" });
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ totalTime: number; totalCost: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (
    blueprint: StrategicBlueprintOutput,
    onboardingData: OnboardingFormData,
  ) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setError(null);
    setMediaPlan(null);
    setMeta(null);
    setProgress({ percentage: 0, message: "Starting media plan generation..." });

    try {
      const response = await fetch("/api/media-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint, onboardingData }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("text/event-stream") || !response.body) {
        throw new Error("Expected SSE stream response");
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          const event = parseSSEEvent(eventStr);
          if (!event) continue;

          switch (event.type) {
            case "section-start":
              setProgress({ percentage: 10, message: `Generating ${event.label}...` });
              break;

            case "progress":
              setProgress({ percentage: event.percentage, message: event.message });
              break;

            case "section-complete":
              setProgress({ percentage: 80, message: `Completed ${event.label}` });
              break;

            case "done":
              setMediaPlan(event.mediaPlan);
              setMeta({
                totalTime: event.metadata.totalTime,
                totalCost: event.metadata.totalCost,
              });
              setProgress({ percentage: 100, message: "Media plan complete!" });
              break;

            case "error":
              setError(event.message);
              break;
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled — don't set error
        return;
      }
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setMediaPlan(null);
    setIsGenerating(false);
    setProgress({ percentage: 0, message: "" });
    setError(null);
    setMeta(null);
  }, []);

  return { mediaPlan, isGenerating, progress, error, meta, generate, reset };
}
