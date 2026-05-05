import { describe, expect, it } from 'vitest';
import { gtmBriefSchema } from '@/lib/gtm/schemas/gtm-brief';
import type { IngestUrlOutput } from '@/lib/gtm/types';
import {
  buildGtmPrefillManifestFromDiscovery,
  buildInitialGtmPrefillManifest,
  confirmGtmPrefillManifest,
} from '@/lib/gtm/onboarding/prefill';

const NOW = '2026-05-04T12:00:00.000Z';

describe('GTM website prefill mapping', () => {
  it('seeds a GTM Brief draft with the submitted website locked behind review', () => {
    const manifest = buildInitialGtmPrefillManifest({
      runId: 'run_1',
      inputUrl: 'https://acme.ai/',
      now: NOW,
    });

    expect(manifest.status).toBe('discovering');
    expect(manifest.reviewRequired).toBe(true);
    expect(manifest.researchUnlocked).toBe(false);
    expect(manifest.websiteUrl).toBe('https://acme.ai/');
    expect(manifest.draft.fields.companyUrl).toMatchObject({
      value: 'https://acme.ai/',
      status: 'confirmed',
      confidence: 'high',
      updatedBy: 'user',
    });
    expect(manifest.draft.fields.companyUrl.sources[0]).toMatchObject({
      source_type: 'user_input',
      claim_path: ['companyIdentity', 'companyUrl'],
    });
    expect(gtmBriefSchema.safeParse(manifest.draft).success).toBe(true);
  });

  it('maps only sourced discover-url fields into suggested GTM Brief fields', () => {
    const manifest = buildGtmPrefillManifestFromDiscovery({
      runId: 'run_1',
      inputUrl: 'https://acme.ai/',
      output: buildDiscoverUrlOutput(),
      now: NOW,
    });

    expect(manifest.status).toBe('ready_for_review');
    expect(manifest.reviewRequired).toBe(true);
    expect(manifest.researchUnlocked).toBe(false);
    expect(manifest.draft.fields.companyName).toMatchObject({
      value: 'Acme AI',
      status: 'suggested',
      confidence: 'high',
      updatedBy: 'ai',
    });
    expect(manifest.draft.fields.companyName.sources).toEqual([
      expect.objectContaining({
        source_type: 'website_url',
        label: 'Company Name',
        url: 'https://acme.ai/',
        quote: 'Acme AI builds revenue automation for SaaS teams.',
        retrieved_at: NOW,
        confidence: 'high',
        claim_path: ['companyIdentity', 'companyName'],
      }),
    ]);
    expect(manifest.draft.fields.pricingTiers).toMatchObject({
      value: '$499/mo Growth plan',
      status: 'suggested',
      confidence: 'medium',
    });
    expect(manifest.draft.fields.targetCustomer).toMatchObject({
      value: '',
      status: 'missing',
      confidence: 'missing',
      sources: [],
    });
    expect(manifest.sourceGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim_path: ['productAndOffer', 'targetCustomer'],
          severity: 'degraded',
          reason: expect.stringContaining('without source evidence'),
        }),
        expect.objectContaining({
          claim_path: ['economics', 'avgAcv'],
          severity: 'degraded',
          reason: 'No ACV found on the public site.',
        }),
        expect.objectContaining({
          claim_path: ['icp', 'jobTitles'],
          severity: 'informational',
        }),
      ]),
    );
    expect(manifest.questions.map((question) => question.claim_path)).toEqual(
      expect.arrayContaining([
        ['productAndOffer', 'targetCustomer'],
        ['economics', 'avgAcv'],
        ['icp', 'jobTitles'],
      ]),
    );
    expect(gtmBriefSchema.safeParse(manifest.draft).success).toBe(true);
  });

  it('promotes reviewed suggestions to confirmed fields without fabricating missing fields', () => {
    const readyManifest = buildGtmPrefillManifestFromDiscovery({
      runId: 'run_1',
      inputUrl: 'https://acme.ai/',
      output: buildDiscoverUrlOutput(),
      now: NOW,
    });
    const confirmed = confirmGtmPrefillManifest({
      prefill: readyManifest,
      fields: {
        companyName: 'Acme AI',
        pricingTiers: '$599/mo Growth plan',
      },
      now: '2026-05-04T12:05:00.000Z',
    });

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.reviewRequired).toBe(false);
    expect(confirmed.researchUnlocked).toBe(true);
    expect(confirmed.draft.fields.companyName.status).toBe('confirmed');
    expect(confirmed.draft.fields.companyName.sources[0]?.source_type).toBe('website_url');
    expect(confirmed.draft.fields.pricingTiers).toMatchObject({
      value: '$599/mo Growth plan',
      status: 'confirmed',
      updatedBy: 'user',
    });
    expect(confirmed.draft.fields.pricingTiers.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_type: 'user_input',
          quote: '$599/mo Growth plan',
          claim_path: ['productAndOffer', 'pricingTiers'],
        }),
      ]),
    );
    expect(confirmed.draft.fields.targetCustomer.status).toBe('missing');
    expect(gtmBriefSchema.safeParse(confirmed.draft).success).toBe(true);
  });
});

function buildDiscoverUrlOutput(): IngestUrlOutput {
  return {
    run_id: 'run_1',
    stage: 'discover-url',
    input_url: 'https://acme.ai/',
    canonical_url: {
      value: 'https://acme.ai/',
      source_url: 'https://acme.ai/',
      retrieved_at: NOW,
    },
    company_name: {
      value: 'Acme AI',
      source_url: 'https://acme.ai/',
      retrieved_at: NOW,
    },
    discovered_pages: [
      {
        url: 'https://acme.ai/pricing',
        page_type: 'pricing',
        title: {
          value: 'Pricing',
          source_url: 'https://acme.ai/pricing',
          retrieved_at: NOW,
        },
      },
    ],
    prefilled_fields: [
      {
        field_key: 'companyName',
        label: 'Company Name',
        value: 'Acme AI',
        confidence: 'high',
        evidence: [
          {
            value: 'Acme AI builds revenue automation for SaaS teams.',
            source_url: 'https://acme.ai/',
            retrieved_at: NOW,
          },
        ],
        reason: 'Homepage hero names the company.',
      },
      {
        field_key: 'pricingTiers',
        label: 'Pricing Tiers',
        value: '$499/mo Growth plan',
        confidence: 'medium',
        evidence: [
          {
            value: '$499/mo Growth plan',
            source_url: 'https://acme.ai/pricing',
            retrieved_at: NOW,
          },
        ],
        reason: 'Pricing page lists the Growth plan.',
      },
      {
        field_key: 'targetCustomer',
        label: 'Target Customer',
        value: 'SaaS teams',
        confidence: 'medium',
        evidence: [],
        reason: 'No supporting snippet was captured.',
      },
    ],
    unresolved_fields: ['jobTitles'],
    source_gaps: [
      {
        field: 'avgAcv',
        reason: 'No ACV found on the public site.',
        remediation: 'Ask the user for average contract value during review.',
        severity: 'warn',
        confidence: 7,
      },
    ],
    generated_at: NOW,
  };
}
