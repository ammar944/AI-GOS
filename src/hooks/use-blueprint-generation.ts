"use client";

import { useState, useCallback, useRef } from "react";
import { parseApiError, type ParsedApiError } from "@/components/ui/api-error-display";
import { setStrategicBlueprint as saveStrategicBlueprint } from "@/lib/storage/local-storage";
import { useElapsedTimer } from "./use-elapsed-timer";
import type {
  StrategicBlueprintOutput,
  StrategicBlueprintProgress,
  StrategicBlueprintSection,
} from "@/lib/strategic-blueprint/output-types";
import type { OnboardingFormData } from "@/lib/onboarding/types";

// =============================================================================
// SSE Event Types (match server-side definitions)
// =============================================================================

interface SSESectionStartEvent {
  type: "section-start";
  section: StrategicBlueprintSection;
  label: string;
}

interface SSESectionCompleteEvent {
  type: "section-complete";
  section: StrategicBlueprintSection;
  label: string;
  data: unknown;
}

interface SSEProgressEvent {
  type: "progress";
  percentage: number;
  message: string;
}

interface SSEMetadataEvent {
  type: "metadata";
  elapsedTime: number;
  estimatedCost: number;
  completedSections: number;
  totalSections: number;
}

interface SSEDoneEvent {
  type: "done";
  success: true;
  strategicBlueprint: StrategicBlueprintOutput;
  metadata: {
    totalTime: number;
    totalCost: number;
  };
}

interface SSEErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

type SSEEvent =
  | SSESectionStartEvent
  | SSESectionCompleteEvent
  | SSEProgressEvent
  | SSEMetadataEvent
  | SSEDoneEvent
  | SSEErrorEvent;

// =============================================================================
// SSE Parsing Helper
// =============================================================================

function parseSSEEvent(eventStr: string): SSEEvent | null {
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
    return JSON.parse(data) as SSEEvent;
  } catch {
    return null;
  }
}

// =============================================================================
// Hook
// =============================================================================

export interface BlueprintGenerationState {
  strategicBlueprint: StrategicBlueprintOutput | null;
  blueprintProgress: StrategicBlueprintProgress | null;
  error: ParsedApiError | null;
  blueprintMeta: { totalTime: number; totalCost: number } | null;
  streamingSections: Map<StrategicBlueprintSection, unknown>;
  currentStreamingSection: StrategicBlueprintSection | null;
  streamingCost: number;
  isGenerating: boolean;
  elapsedTime: number;
}

export interface UseBlueprintGenerationReturn extends BlueprintGenerationState {
  generate: (onboardingData: OnboardingFormData) => Promise<{ success: boolean }>;
  reset: () => void;
  setStrategicBlueprint: React.Dispatch<React.SetStateAction<StrategicBlueprintOutput | null>>;
  setError: React.Dispatch<React.SetStateAction<ParsedApiError | null>>;
}

export function useBlueprintGeneration(): UseBlueprintGenerationReturn {
  const [strategicBlueprint, setStrategicBlueprint] = useState<StrategicBlueprintOutput | null>(null);
  const [blueprintProgress, setBlueprintProgress] = useState<StrategicBlueprintProgress | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [blueprintMeta, setBlueprintMeta] = useState<{ totalTime: number; totalCost: number } | null>(null);
  const [streamingSections, setStreamingSections] = useState<Map<StrategicBlueprintSection, unknown>>(new Map());
  const [currentStreamingSection, setCurrentStreamingSection] = useState<StrategicBlueprintSection | null>(null);
  const [streamingCost, setStreamingCost] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const elapsedTime = useElapsedTimer(isGenerating);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (onboardingData: OnboardingFormData): Promise<{ success: boolean }> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setError(null);
    setStreamingSections(new Map());
    setCurrentStreamingSection(null);
    setStreamingCost(0);
    setBlueprintProgress({
      currentSection: "industryMarketOverview",
      completedSections: [],
      partialOutput: {},
      progressPercentage: 0,
      progressMessage: "Starting Strategic Blueprint generation...",
    });

    try {
      const response = await fetch("/api/strategic-blueprint/generate?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingData }),
        signal: controller.signal,
      });

      // Handle non-OK responses
      if (!response.ok) {
        const text = await response.text();
        let errorMessage: string;
        try {
          const errBody = JSON.parse(text);
          errorMessage = errBody?.error?.message || errBody?.message || `Server error (${response.status})`;
        } catch {
          errorMessage = text || `Server error (${response.status})`;
        }
        setError({ message: errorMessage, retryable: true });
        setIsGenerating(false);
        return { success: false };
      }

      // Check for streaming response
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream") && response.body) {
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
                setCurrentStreamingSection(event.section);
                setBlueprintProgress((prev) =>
                  prev
                    ? { ...prev, currentSection: event.section, progressMessage: `Generating ${event.label}...` }
                    : null
                );
                break;

              case "section-complete":
                setStreamingSections((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(event.section, event.data);
                  return newMap;
                });
                setBlueprintProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        completedSections: [...prev.completedSections, event.section],
                        partialOutput: { ...prev.partialOutput, [event.section]: event.data },
                        progressMessage: `Completed ${event.label}`,
                      }
                    : null
                );
                break;

              case "progress":
                setBlueprintProgress((prev) =>
                  prev
                    ? { ...prev, progressPercentage: event.percentage, progressMessage: event.message }
                    : null
                );
                break;

              case "metadata":
                setStreamingCost(event.estimatedCost);
                break;

              case "done":
                setStrategicBlueprint(event.strategicBlueprint);
                saveStrategicBlueprint(event.strategicBlueprint);
                setBlueprintMeta({ totalTime: event.metadata.totalTime, totalCost: event.metadata.totalCost });
                setCurrentStreamingSection(null);
                setIsGenerating(false);
                return { success: true };

              case "error":
                setError({ message: event.message, retryable: true });
                setIsGenerating(false);
                return { success: false };
            }
          }
        }
      } else {
        // Fallback to non-streaming JSON response
        const result = await response.json();

        if (result.success && result.strategicBlueprint) {
          setStrategicBlueprint(result.strategicBlueprint);
          saveStrategicBlueprint(result.strategicBlueprint);
          setBlueprintMeta({
            totalTime: result.metadata?.totalTime || 0,
            totalCost: result.metadata?.totalCost || 0,
          });
          setIsGenerating(false);
          return { success: true };
        } else {
          setError(parseApiError(result));
          setIsGenerating(false);
          return { success: false };
        }
      }

      setIsGenerating(false);
      return { success: true };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setIsGenerating(false);
        return { success: false };
      }
      console.error("Blueprint generation error:", err);
      setError({
        message: err instanceof Error ? err.message : "An unexpected error occurred",
        retryable: true,
      });
      setIsGenerating(false);
      return { success: false };
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStrategicBlueprint(null);
    setBlueprintProgress(null);
    setError(null);
    setBlueprintMeta(null);
    setStreamingSections(new Map());
    setCurrentStreamingSection(null);
    setStreamingCost(0);
    setIsGenerating(false);
  }, []);

  return {
    strategicBlueprint,
    blueprintProgress,
    error,
    blueprintMeta,
    streamingSections,
    currentStreamingSection,
    streamingCost,
    isGenerating,
    elapsedTime,
    generate,
    reset,
    setStrategicBlueprint,
    setError,
  };
}
