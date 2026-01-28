'use server';

// Server Action: Prefill Onboarding from Company Research
// Uses Perplexity to research a company and extract onboarding fields

import {
  researchCompanyForOnboarding,
  isValidUrl,
  isLinkedInCompanyUrl,
  type PrefillOnboardingResponse,
} from '@/lib/company-intel';

export interface PrefillOnboardingResult {
  success: boolean;
  data?: PrefillOnboardingResponse;
  error?: string;
}

/**
 * Research a company and return pre-filled onboarding data
 *
 * @param websiteUrl - The company's website URL (required)
 * @param linkedinUrl - The company's LinkedIn URL (optional)
 * @returns Pre-filled onboarding data with confidence levels and citations
 */
export async function prefillOnboardingFromUrls(
  websiteUrl: string,
  linkedinUrl?: string
): Promise<PrefillOnboardingResult> {
  // Validate website URL
  if (!websiteUrl || !websiteUrl.trim()) {
    return {
      success: false,
      error: 'Website URL is required',
    };
  }

  // Normalize URLs
  let normalizedWebsite = websiteUrl.trim();
  if (!normalizedWebsite.startsWith('http://') && !normalizedWebsite.startsWith('https://')) {
    normalizedWebsite = `https://${normalizedWebsite}`;
  }

  if (!isValidUrl(normalizedWebsite)) {
    return {
      success: false,
      error: 'Invalid website URL format',
    };
  }

  // Validate LinkedIn URL if provided
  let normalizedLinkedin: string | undefined;
  if (linkedinUrl && linkedinUrl.trim()) {
    normalizedLinkedin = linkedinUrl.trim();
    if (!normalizedLinkedin.startsWith('http://') && !normalizedLinkedin.startsWith('https://')) {
      normalizedLinkedin = `https://${normalizedLinkedin}`;
    }

    if (!isValidUrl(normalizedLinkedin)) {
      return {
        success: false,
        error: 'Invalid LinkedIn URL format',
      };
    }

    if (!isLinkedInCompanyUrl(normalizedLinkedin)) {
      return {
        success: false,
        error: 'LinkedIn URL should be a company page (e.g., linkedin.com/company/...)',
      };
    }
  }

  try {
    console.log('[PrefillAction] Starting company research:', {
      website: normalizedWebsite,
      linkedin: normalizedLinkedin,
    });

    const result = await researchCompanyForOnboarding({
      websiteUrl: normalizedWebsite,
      linkedinUrl: normalizedLinkedin,
    });

    console.log('[PrefillAction] Research complete:', {
      fieldsFound: result.summary.fieldsFound,
      citations: result.citations.length,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[PrefillAction] Research failed:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        return {
          success: false,
          error: 'Research timed out. The website may be slow or blocking access. Please try again or fill in fields manually.',
        };
      }

      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return {
          success: false,
          error: 'Too many requests. Please wait a moment and try again.',
        };
      }

      return {
        success: false,
        error: `Research failed: ${error.message}`,
      };
    }

    return {
      success: false,
      error: 'An unexpected error occurred during research',
    };
  }
}
