'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type DeepPartial } from 'ai';
import {
  documentExtractionSchema,
  EXTRACTION_FIELD_KEYS,
  TOTAL_EXTRACTION_FIELDS,
  type DocumentExtractionOutput,
} from '@/lib/company-intel/document-extraction-schema';
import type { DocumentType } from '@/lib/company-intel/document-types';
import type {
  OnboardingFormData,
  CompanySize,
  ClientSource,
  PricingModel,
  FunnelType,
  SalesCycleLength,
  CampaignDuration,
} from '@/lib/onboarding/types';

// ---------------------------------------------------------------------------
// Enum Parsers
// ---------------------------------------------------------------------------

const VALID_COMPANY_SIZES: CompanySize[] = ['solo', '1-10', '11-50', '51-200', '201-1000', '1000+'];
const VALID_CLIENT_SOURCES: ClientSource[] = ['referrals', 'linkedin', 'outbound', 'paid_ads', 'seo', 'events', 'partnerships', 'content', 'other'];
const VALID_PRICING_MODELS: PricingModel[] = ['monthly', 'annual', 'one_time', 'usage_based', 'seat_based', 'custom'];
const VALID_FUNNEL_TYPES: FunnelType[] = ['lead_form', 'booking_page', 'free_trial', 'webinar', 'demo', 'application', 'challenge', 'ecommerce', 'other'];
const VALID_SALES_CYCLE: SalesCycleLength[] = ['less_than_7_days', '7_to_14_days', '14_to_30_days', 'more_than_30_days'];
const VALID_CAMPAIGN_DURATION: CampaignDuration[] = ['ongoing', '1_month', '3_months', '6_months', 'fixed'];

function parseEnumList<T extends string>(str: string | null | undefined, validValues: T[]): T[] {
  if (!str) return [];
  return str
    .split(/[,;]+/)
    .map(s => s.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter((s): s is T => validValues.includes(s as T));
}

function parseEnum<T extends string>(str: string | null | undefined, validValues: T[], fallback: T): T {
  if (!str) return fallback;
  const normalized = str.trim().toLowerCase().replace(/\s+/g, '_');
  return validValues.includes(normalized as T) ? (normalized as T) : fallback;
}

function parseNumber(str: string | null | undefined): number {
  if (!str) return 0;
  // Extract the first number from the string (handles multi-price strings like "$195, $395, $995")
  const match = str.match(/[\d,]+\.?\d*/);
  if (!match) return 0;
  const num = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

function parseOptionalNumber(str: string | null | undefined): number | undefined {
  if (!str) return undefined;
  const match = str.match(/[\d,]+\.?\d*/);
  if (!match) return undefined;
  const num = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(num) ? undefined : num;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseDocumentExtractionReturn {
  partialResult: DeepPartial<DocumentExtractionOutput> | undefined;
  submit: (data: { fileName: string; mimeType: string; fileBase64: string; documentType: DocumentType }) => void;
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
  fieldsFound: number;
  totalFields: number;
  mapToFormData: (selectedFields?: Set<string>) => Partial<OnboardingFormData> | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDocumentExtraction(): UseDocumentExtractionReturn {
  // Track finish errors that the hook doesn't surface via `error`
  const [finishError, setFinishError] = useState<Error | undefined>(undefined);
  const finishErrorRef = useRef<Error | undefined>(undefined);

  const { object, submit: submitObject, isLoading, error, stop } = useObject({
    api: '/api/onboarding/extract-document',
    schema: documentExtractionSchema,
    onError: (err) => {
      console.error('[useDocumentExtraction] Stream error:', err);
    },
    onFinish: ({ object: finalObject, error: onFinishErr }) => {
      if (onFinishErr) {
        console.error('[useDocumentExtraction] Finish error:', onFinishErr.message);
        finishErrorRef.current = onFinishErr;
        setFinishError(onFinishErr);
      } else {
        console.log('[useDocumentExtraction] Stream finished with',
          finalObject ? 'valid data' : 'no data',
        );
        finishErrorRef.current = undefined;
        setFinishError(undefined);
      }
    },
  });

  // Combine hook error + finish error for the component
  const combinedError = error ?? finishError;

  // ---- fieldsFound --------------------------------------------------------
  // Schema is now flat strings — count non-empty values directly

  const fieldsFound = useMemo(() => {
    if (!object) return 0;

    let count = 0;
    for (const key of EXTRACTION_FIELD_KEYS) {
      const val = object[key];
      if (typeof val === 'string' && val !== '') {
        count++;
      }
    }
    return count;
  }, [object]);

  // ---- submit wrapper -----------------------------------------------------

  const submit = useCallback(
    (data: { fileName: string; mimeType: string; fileBase64: string; documentType: DocumentType }) => {
      console.log('[useDocumentExtraction] Submitting:', {
        fileName: data.fileName,
        mimeType: data.mimeType,
        documentType: data.documentType,
        base64Length: data.fileBase64.length,
      });
      submitObject(data);
    },
    [submitObject],
  );

  // ---- mapToFormData ------------------------------------------------------
  // Schema is now flat strings — read values directly from object

  const mapToFormData = useCallback((selectedFields?: Set<string>): Partial<OnboardingFormData> | null => {
    if (!object) return null;

    // Only map fields the user selected (if provided), otherwise map all
    const v = (key: keyof DocumentExtractionOutput): string => {
      if (selectedFields && !selectedFields.has(key as string)) return '';
      const val = object[key];
      return typeof val === 'string' ? val : '';
    };

    const formData: Partial<OnboardingFormData> = {};

    // Step 1: Business Basics
    const businessName = v('businessName');
    const websiteUrl = v('websiteUrl');
    if (businessName || websiteUrl) {
      formData.businessBasics = {
        businessName,
        websiteUrl,
      };
    }

    // Step 2: ICP
    const icpDesc = v('primaryIcpDescription');
    const industry = v('industryVertical');
    const jobTitles = v('jobTitles');
    const companySize = v('companySize');
    const geography = v('geography');
    if (icpDesc || industry || jobTitles || companySize || geography) {
      const parsedCompanySize = parseEnumList(companySize, VALID_COMPANY_SIZES);
      const parsedClientSources = parseEnumList(v('bestClientSources'), VALID_CLIENT_SOURCES);
      formData.icp = {
        primaryIcpDescription: icpDesc,
        industryVertical: industry,
        jobTitles,
        ...(parsedCompanySize.length > 0 && { companySize: parsedCompanySize }),
        geography,
        easiestToClose: v('easiestToClose'),
        buyingTriggers: v('buyingTriggers'),
        ...(parsedClientSources.length > 0 && { bestClientSources: parsedClientSources }),
        secondaryIcp: v('secondaryIcp') || undefined,
        systemsPlatforms: v('systemsPlatforms') || undefined,
      } as OnboardingFormData['icp'];
    }

    // Step 3: Product & Offer
    const productDesc = v('productDescription');
    const valuePropVal = v('valueProp');
    const deliverables = v('coreDeliverables');
    if (productDesc || valuePropVal || deliverables) {
      const parsedPrice = v('offerPrice');
      const parsedPricingModel = parseEnumList(v('pricingModel'), VALID_PRICING_MODELS);
      const parsedFunnelType = parseEnumList(v('currentFunnelType'), VALID_FUNNEL_TYPES);
      formData.productOffer = {
        productDescription: productDesc,
        coreDeliverables: deliverables,
        ...(parsedPrice ? { offerPrice: parseNumber(parsedPrice) } : {}),
        ...(parsedPricingModel.length > 0 && { pricingModel: parsedPricingModel }),
        valueProp: valuePropVal,
        guarantees: v('guarantees') || undefined,
        ...(parsedFunnelType.length > 0 && { currentFunnelType: parsedFunnelType }),
      } as OnboardingFormData['productOffer'];
    }

    // Step 4: Market & Competition
    const competitors = v('topCompetitors');
    const uniqueEdge = v('uniqueEdge');
    const bottlenecks = v('marketBottlenecks');
    if (competitors || uniqueEdge || bottlenecks) {
      formData.marketCompetition = {
        topCompetitors: competitors,
        uniqueEdge,
        competitorFrustrations: v('competitorFrustrations') || undefined,
        marketBottlenecks: bottlenecks,
        proprietaryTech: v('proprietaryTech') || undefined,
      };
    }

    // Step 5: Customer Journey
    const situation = v('situationBeforeBuying');
    const transformation = v('desiredTransformation');
    const objections = v('commonObjections');
    if (situation || transformation || objections) {
      formData.customerJourney = {
        situationBeforeBuying: situation,
        desiredTransformation: transformation,
        commonObjections: objections,
        salesCycleLength: parseEnum(v('salesCycleLength'), VALID_SALES_CYCLE, '14_to_30_days'),
        salesProcessOverview: v('salesProcessOverview') || undefined,
      };
    }

    // Step 6: Brand & Positioning
    const brand = v('brandPositioning');
    const voice = v('customerVoice');
    if (brand || voice) {
      formData.brandPositioning = {
        brandPositioning: brand,
        customerVoice: voice || undefined,
      };
    }

    // Step 7: Assets & Proof
    const salesDeck = v('salesDeckUrl');
    const productDemo = v('productDemoUrl');
    const caseStudies = v('caseStudiesUrl');
    const testimonials = v('testimonialsUrl');
    const landing = v('landingPageUrl');
    const existingAds = v('existingAdsUrl');
    const brandGuidelines = v('brandGuidelinesUrl');
    if (salesDeck || productDemo || caseStudies || testimonials || landing || existingAds || brandGuidelines) {
      formData.assetsProof = {
        salesDeckUrl: salesDeck || undefined,
        productDemoUrl: productDemo || undefined,
        caseStudiesUrl: caseStudies || undefined,
        testimonialsUrl: testimonials || undefined,
        landingPageUrl: landing || undefined,
        existingAdsUrl: existingAds || undefined,
        brandGuidelinesUrl: brandGuidelines || undefined,
      };
    }

    // Step 8: Budget & Targets
    const monthlyBudget = v('monthlyAdBudget');
    const dailyCeiling = v('dailyBudgetCeiling');
    const duration = v('campaignDuration');
    const cpl = v('targetCpl');
    const cac = v('targetCac');
    const sqls = v('targetSqlsPerMonth');
    const demos = v('targetDemosPerMonth');
    if (monthlyBudget || dailyCeiling || cpl || cac || sqls || demos) {
      formData.budgetTargets = {
        ...(monthlyBudget ? { monthlyAdBudget: parseNumber(monthlyBudget) } : {}),
        dailyBudgetCeiling: parseOptionalNumber(dailyCeiling),
        campaignDuration: parseEnum(duration, VALID_CAMPAIGN_DURATION, 'ongoing'),
        targetCpl: parseOptionalNumber(cpl),
        targetCac: parseOptionalNumber(cac),
        targetSqlsPerMonth: parseOptionalNumber(sqls),
        targetDemosPerMonth: parseOptionalNumber(demos),
      } as OnboardingFormData['budgetTargets'];
    }

    // Step 9: Compliance
    const topics = v('topicsToAvoid');
    const claims = v('claimRestrictions');
    if (topics || claims) {
      formData.compliance = {
        topicsToAvoid: topics || undefined,
        claimRestrictions: claims || undefined,
      };
    }

    return formData;
  }, [object]);

  return {
    partialResult: object,
    submit,
    isLoading,
    error: combinedError ?? undefined,
    stop,
    fieldsFound,
    totalFields: TOTAL_EXTRACTION_FIELDS,
    mapToFormData,
  };
}
