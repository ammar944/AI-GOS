// LocalStorage utility for persisting generation data
// Handles onboarding data and strategic blueprint

import type { OnboardingFormData } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { MediaPlanOutput } from "@/lib/media-plan/types";
import type { AdCopyOutput } from "@/lib/media-plan/ad-copy-types";
import type { OnboardingState } from "@/lib/journey/session-state";

// Storage keys
export const STORAGE_KEYS = {
  ONBOARDING_DATA: "aigog_onboarding_data",
  STRATEGIC_BLUEPRINT: "aigog_strategic_blueprint",
  GENERATION_STATE: "aigog_generation_state",
  MEDIA_PLAN: "aigog_media_plan",
  AD_COPY: "aigog_ad_copy",
  JOURNEY_SESSION: "aigog_journey_session",
  SHELL_STATE: "aigog_shell_state",
} as const;

// Generation state to track progress
export interface GenerationState {
  currentStage:
    | "onboarding"
    | "blueprint-complete"
    | "media-plan-complete"
    | "media-plan-approved"
    | "ad-copy-complete";
  lastUpdated: string;
}

// Check if we're in browser environment
const isBrowser = typeof window !== "undefined";

// =============================================================================
// Generic Storage Functions
// =============================================================================

function getItem<T>(key: string): T | null {
  if (!isBrowser) return null;

  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return null;
  }
}

function setItem<T>(key: string, value: T): boolean {
  if (!isBrowser) return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
    return false;
  }
}

function removeItem(key: string): boolean {
  if (!isBrowser) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
    return false;
  }
}

// =============================================================================
// Specific Storage Functions
// =============================================================================

// Onboarding Data
export function getOnboardingData(): OnboardingFormData | null {
  return getItem<OnboardingFormData>(STORAGE_KEYS.ONBOARDING_DATA);
}

export function setOnboardingData(data: OnboardingFormData): boolean {
  const success = setItem(STORAGE_KEYS.ONBOARDING_DATA, data);
  if (success) {
    updateGenerationState("onboarding");
  }
  return success;
}

// Strategic Blueprint
export function getStrategicBlueprint(): StrategicBlueprintOutput | null {
  return getItem<StrategicBlueprintOutput>(STORAGE_KEYS.STRATEGIC_BLUEPRINT);
}

export function setStrategicBlueprint(data: StrategicBlueprintOutput): boolean {
  const success = setItem(STORAGE_KEYS.STRATEGIC_BLUEPRINT, data);
  if (success) {
    updateGenerationState("blueprint-complete");
  }
  return success;
}

// Media Plan
export function getMediaPlan(): MediaPlanOutput | null {
  return getItem<MediaPlanOutput>(STORAGE_KEYS.MEDIA_PLAN);
}

export function setMediaPlan(data: MediaPlanOutput): boolean {
  const success = setItem(STORAGE_KEYS.MEDIA_PLAN, data);
  if (success) {
    updateGenerationState("media-plan-complete");
  }
  return success;
}

// Ad Copy
export function getAdCopy(): AdCopyOutput | null {
  return getItem<AdCopyOutput>(STORAGE_KEYS.AD_COPY);
}

export function setAdCopy(data: AdCopyOutput): boolean {
  const success = setItem(STORAGE_KEYS.AD_COPY, data);
  if (success) {
    updateGenerationState("ad-copy-complete");
  }
  return success;
}

// Journey Session (v2 onboarding)
export function getJourneySession(): OnboardingState | null {
  return getItem<OnboardingState>(STORAGE_KEYS.JOURNEY_SESSION);
}

export function setJourneySession(data: OnboardingState): boolean {
  return setItem(STORAGE_KEYS.JOURNEY_SESSION, data);
}

export function clearJourneySession(): boolean {
  return removeItem(STORAGE_KEYS.JOURNEY_SESSION);
}

// Generation State
export function getGenerationState(): GenerationState | null {
  return getItem<GenerationState>(STORAGE_KEYS.GENERATION_STATE);
}

function updateGenerationState(stage: GenerationState["currentStage"]): boolean {
  return setItem<GenerationState>(STORAGE_KEYS.GENERATION_STATE, {
    currentStage: stage,
    lastUpdated: new Date().toISOString(),
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if there is saved progress to resume
 */
export function hasSavedProgress(): boolean {
  const state = getGenerationState();
  return state !== null && (
    state.currentStage === "blueprint-complete" ||
    state.currentStage === "media-plan-complete" ||
    state.currentStage === "media-plan-approved" ||
    state.currentStage === "ad-copy-complete"
  );
}

/**
 * Get all saved data for resuming
 */
export function getSavedProgress(): {
  onboardingData: OnboardingFormData | null;
  strategicBlueprint: StrategicBlueprintOutput | null;
  mediaPlan: MediaPlanOutput | null;
  adCopy: AdCopyOutput | null;
  state: GenerationState | null;
} {
  return {
    onboardingData: getOnboardingData(),
    strategicBlueprint: getStrategicBlueprint(),
    mediaPlan: getMediaPlan(),
    adCopy: getAdCopy(),
    state: getGenerationState(),
  };
}

/**
 * Clear all saved generation data
 */
export function clearAllSavedData(): boolean {
  const results = [
    removeItem(STORAGE_KEYS.ONBOARDING_DATA),
    removeItem(STORAGE_KEYS.STRATEGIC_BLUEPRINT),
    removeItem(STORAGE_KEYS.MEDIA_PLAN),
    removeItem(STORAGE_KEYS.AD_COPY),
    removeItem(STORAGE_KEYS.GENERATION_STATE),
  ];
  return results.every(Boolean);
}

/**
 * Clear strategic blueprint data
 */
export function clearBlueprint(): boolean {
  const removed = removeItem(STORAGE_KEYS.STRATEGIC_BLUEPRINT);
  if (removed) {
    updateGenerationState("onboarding");
  }
  return removed;
}

/**
 * Clear only the media plan (revert to blueprint-complete state)
 */
export function clearMediaPlan(): boolean {
  const removed = removeItem(STORAGE_KEYS.MEDIA_PLAN);
  if (removed && getStrategicBlueprint()) {
    updateGenerationState("blueprint-complete");
  }
  return removed;
}

/**
 * Clear both blueprint and media plan (revert to onboarding state)
 */
export function clearBlueprintAndPlan(): boolean {
  const results = [
    removeItem(STORAGE_KEYS.STRATEGIC_BLUEPRINT),
    removeItem(STORAGE_KEYS.MEDIA_PLAN),
  ];
  updateGenerationState("onboarding");
  return results.every(Boolean);
}
