import type { OnboardingData } from "@/lib/supabase/types";
import type { OnboardingFormData } from "./types";

/**
 * Map database OnboardingData format to the frontend OnboardingFormData format.
 * Note: DB uses `icpData` while the form uses `icp`.
 */
export function mapDbToFormData(
  dbData: OnboardingData
): Partial<OnboardingFormData> {
  return {
    businessBasics:
      dbData.businessBasics as unknown as OnboardingFormData["businessBasics"],
    icp: dbData.icpData as unknown as OnboardingFormData["icp"],
    productOffer:
      dbData.productOffer as unknown as OnboardingFormData["productOffer"],
    marketCompetition:
      dbData.marketCompetition as unknown as OnboardingFormData["marketCompetition"],
    customerJourney:
      dbData.customerJourney as unknown as OnboardingFormData["customerJourney"],
    brandPositioning:
      dbData.brandPositioning as unknown as OnboardingFormData["brandPositioning"],
    assetsProof:
      dbData.assetsProof as unknown as OnboardingFormData["assetsProof"],
    budgetTargets:
      dbData.budgetTargets as unknown as OnboardingFormData["budgetTargets"],
    compliance:
      dbData.compliance as unknown as OnboardingFormData["compliance"],
  };
}

/** The DB field keys that map to onboarding sections (excluding currentStep). */
const SECTION_KEYS = [
  "businessBasics",
  "icpData",
  "productOffer",
  "marketCompetition",
  "customerJourney",
  "brandPositioning",
  "assetsProof",
  "budgetTargets",
  "compliance",
] as const;

const TOTAL_SECTIONS = SECTION_KEYS.length; // 9

/**
 * Compute onboarding progress from saved DB data.
 * Returns the current step, how many sections have data, and the total.
 */
export function getOnboardingProgress(dbData: OnboardingData): {
  currentStep: number;
  completedSections: number;
  totalSections: number;
} {
  // Count sections that have at least some data
  let completedSections = 0;
  for (const key of SECTION_KEYS) {
    const section = dbData[key];
    if (section && Object.keys(section).length > 0) {
      // Check if at least one field has a non-empty value
      const hasValue = Object.values(section).some((v) => {
        if (v === undefined || v === null || v === "") return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      });
      if (hasValue) completedSections++;
    }
  }

  // Use the persisted currentStep if available, otherwise infer from completed sections
  const currentStep =
    typeof dbData.currentStep === "number"
      ? dbData.currentStep
      : Math.min(completedSections, TOTAL_SECTIONS - 1);

  return { currentStep, completedSections, totalSections: TOTAL_SECTIONS };
}
