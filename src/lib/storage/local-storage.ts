// LocalStorage utility for persisting generation data
// Handles onboarding data, strategic blueprint, and media plan

import type { OnboardingFormData } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { MediaPlanOutput } from "@/lib/media-plan/output-types";

// Storage keys
export const STORAGE_KEYS = {
  ONBOARDING_DATA: "aigog_onboarding_data",
  STRATEGIC_BLUEPRINT: "aigog_strategic_blueprint",
  MEDIA_PLAN: "aigog_media_plan",
  GENERATION_STATE: "aigog_generation_state",
} as const;

// Generation state to track progress
export interface GenerationState {
  currentStage: "onboarding" | "blueprint-complete" | "plan-complete";
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
    updateGenerationState("plan-complete");
  }
  return success;
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
  return state !== null && (state.currentStage === "blueprint-complete" || state.currentStage === "plan-complete");
}

/**
 * Get all saved data for resuming
 */
export function getSavedProgress(): {
  onboardingData: OnboardingFormData | null;
  strategicBlueprint: StrategicBlueprintOutput | null;
  mediaPlan: MediaPlanOutput | null;
  state: GenerationState | null;
} {
  return {
    onboardingData: getOnboardingData(),
    strategicBlueprint: getStrategicBlueprint(),
    mediaPlan: getMediaPlan(),
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
    removeItem(STORAGE_KEYS.GENERATION_STATE),
  ];
  return results.every(Boolean);
}

/**
 * Clear only the media plan (for regeneration)
 */
export function clearMediaPlan(): boolean {
  const removed = removeItem(STORAGE_KEYS.MEDIA_PLAN);
  if (removed) {
    // Revert state to blueprint-complete
    const blueprint = getStrategicBlueprint();
    if (blueprint) {
      updateGenerationState("blueprint-complete");
    }
  }
  return removed;
}

/**
 * Clear strategic blueprint and media plan (for regeneration from scratch)
 */
export function clearBlueprintAndPlan(): boolean {
  const results = [
    removeItem(STORAGE_KEYS.STRATEGIC_BLUEPRINT),
    removeItem(STORAGE_KEYS.MEDIA_PLAN),
  ];
  // Keep onboarding data, reset state
  updateGenerationState("onboarding");
  return results.every(Boolean);
}
