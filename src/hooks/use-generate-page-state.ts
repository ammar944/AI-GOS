"use client";

import { useState } from "react";
import type { GenerateStage } from "@/components/generate";

export type PageState =
  | "onboarding"
  | "profile-complete"
  | "generating-blueprint"
  | "review-blueprint"
  | "complete"
  | "generating-media-plan"
  | "review-media-plan"
  | "media-plan-approved"
  | "error";

/** Pipeline stages for blueprint generation progress visualization */
export const BLUEPRINT_STAGES = ["Industry", "ICP", "Offer", "Competitors", "Keywords", "Synthesis"];

/** Map page state to header stage */
export function getHeaderStage(pageState: PageState): GenerateStage {
  switch (pageState) {
    case "onboarding":
    case "profile-complete":
      return "onboarding";
    case "generating-blueprint":
    case "generating-media-plan":
    case "error":
      return "generate";
    case "review-blueprint":
    case "review-media-plan":
      return "review";
    case "complete":
    case "media-plan-approved":
      return "complete";
    default:
      return "onboarding";
  }
}

export function useGeneratePageState(initial: PageState = "onboarding") {
  const [pageState, setPageState] = useState<PageState>(initial);
  const headerStage = getHeaderStage(pageState);
  return { pageState, setPageState, headerStage } as const;
}
