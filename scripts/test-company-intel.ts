#!/usr/bin/env npx tsx

/**
 * Test script for Company Intelligence research service
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/test-company-intel.ts https://example.com
 *   npx tsx --tsconfig tsconfig.json scripts/test-company-intel.ts https://example.com https://linkedin.com/company/example
 *
 * Requires:
 *   OPENROUTER_API_KEY environment variable (loaded from .env.local)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local if it exists
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1).replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch {
  // .env.local doesn't exist, that's ok
}

import { researchCompanyForOnboarding } from '@/lib/company-intel';

async function main() {
  const websiteUrl = process.argv[2];
  const linkedinUrl = process.argv[3];

  if (!websiteUrl) {
    console.error('Usage: npx tsx scripts/test-company-intel.ts <website-url> [linkedin-url]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx scripts/test-company-intel.ts https://stripe.com');
    console.error('  npx tsx scripts/test-company-intel.ts https://notion.so https://linkedin.com/company/notionhq');
    process.exit(1);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🔍 Researching company...');
  console.log(`   Website: ${websiteUrl}`);
  if (linkedinUrl) {
    console.log(`   LinkedIn: ${linkedinUrl}`);
  }
  console.log('');

  const startTime = Date.now();

  try {
    const result = await researchCompanyForOnboarding({
      websiteUrl,
      linkedinUrl,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Research complete in ${duration}s\n`);

    // Print summary
    console.log('📊 Summary:');
    console.log(`   Fields found: ${result.summary.fieldsFound}`);
    console.log(`   Fields missing: ${result.summary.fieldsMissing}`);
    console.log(`   Primary source: ${result.summary.primarySource}`);
    console.log('');

    // Print extracted fields
    console.log('📝 Extracted Data:');
    console.log('─'.repeat(60));

    const { extracted } = result;
    const printField = (name: string, field: typeof extracted.businessName) => {
      if (field) {
        const confidence = field.confidence === 'high' ? '🟢' : field.confidence === 'medium' ? '🟡' : '🔴';
        console.log(`${confidence} ${name}:`);
        console.log(`   ${field.value}`);
        console.log(`   (${field.source}, ${field.confidence} confidence)`);
        console.log('');
      }
    };

    printField('Business Name', extracted.businessName);
    printField('Industry', extracted.industryVertical);
    printField('Target Customers', extracted.primaryIcpDescription);
    printField('Company Size', extracted.companySize);
    printField('Location', extracted.geography);
    printField('Product Description', extracted.productDescription);
    printField('Value Proposition', extracted.valueProp);
    printField('Competitors', extracted.topCompetitors);
    printField('Unique Edge', extracted.uniqueEdge);
    printField('Brand Positioning', extracted.brandPositioning);
    printField('Customer Quote', extracted.customerVoice);

    // Print detected URLs
    console.log('🔗 Detected URLs:');
    if (extracted.detectedCaseStudiesUrl) {
      console.log(`   Case Studies: ${extracted.detectedCaseStudiesUrl.value}`);
    }
    if (extracted.detectedTestimonialsUrl) {
      console.log(`   Testimonials: ${extracted.detectedTestimonialsUrl.value}`);
    }
    if (extracted.detectedPricingUrl) {
      console.log(`   Pricing: ${extracted.detectedPricingUrl.value}`);
    }
    if (extracted.detectedDemoUrl) {
      console.log(`   Demo: ${extracted.detectedDemoUrl.value}`);
    }
    console.log('');

    // Print citations
    if (result.citations.length > 0) {
      console.log('📚 Sources:');
      result.citations.slice(0, 5).forEach((citation, i) => {
        console.log(`   ${i + 1}. ${citation.title || citation.url}`);
        if (citation.url !== citation.title) {
          console.log(`      ${citation.url}`);
        }
      });
      if (result.citations.length > 5) {
        console.log(`   ... and ${result.citations.length - 5} more`);
      }
      console.log('');
    }

    // Print warnings
    if (result.warnings && result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach(w => console.log(`   - ${w}`));
      console.log('');
    }

    // Print prefilled data structure (for debugging)
    console.log('📦 Pre-filled OnboardingFormData:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(result.prefilled, null, 2));

  } catch (error) {
    console.error('❌ Research failed:', error);
    process.exit(1);
  }
}

main();
