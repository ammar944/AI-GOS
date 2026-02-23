/**
 * Evaluate quality of recovered LinkedIn employee-sponsored ads.
 * Shows actual headlines, images, ad types for the ads we now capture.
 * Run: npx tsx scripts/test-recovered-ad-quality.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('Could not load .env.local');
}

import { createEnhancedAdLibraryService } from '../src/lib/ad-library';

const COMPANIES = [
  { name: 'beehiiv', domain: 'beehiiv.com' },
  { name: 'instantly', domain: 'instantly.ai' },
  { name: 'lemlist', domain: 'lemlist.com' },
];

async function main() {
  const service = createEnhancedAdLibraryService();

  for (const company of COMPANIES) {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`  ${company.name.toUpperCase()} — Recovered LinkedIn Ad Quality`);
    console.log('='.repeat(90));

    const result = await service.fetchAllPlatforms({
      query: company.name,
      domain: company.domain,
      limit: 120,
      recallMode: 'high',
      countries: ['US', 'CA', 'GB', 'AU'],
      enableForeplayEnrichment: false,
      includeForeplayAsSource: false,
    });

    const linkedinAds = (result.ads || []).filter(a => a.platform === 'linkedin');
    console.log(`\n  LinkedIn ads returned: ${linkedinAds.length}\n`);

    // Separate company-account ads from employee-sponsored ads
    const companyAds = linkedinAds.filter(a =>
      a.advertiser.toLowerCase().includes(company.name.toLowerCase())
    );
    const employeeAds = linkedinAds.filter(a =>
      !a.advertiser.toLowerCase().includes(company.name.toLowerCase())
    );

    // Note: after our fix, advertiser is set from promotor, so "employee" ads
    // now show the company name. We need to check rawData to distinguish.
    const fromEmployee: typeof linkedinAds = [];
    const fromCompany: typeof linkedinAds = [];

    for (const ad of linkedinAds) {
      const raw = ad.rawData as any;
      const personName = raw?.advertiser?.name || '';
      const promotor = raw?.advertiser?.promotor || '';
      // If the person's name differs from the promotor, it's an employee ad
      if (promotor && personName !== promotor && !personName.toLowerCase().includes(company.name.toLowerCase())) {
        fromEmployee.push(ad);
      } else {
        fromCompany.push(ad);
      }
    }

    console.log(`  From company account: ${fromCompany.length}`);
    console.log(`  From employee/creator accounts: ${fromEmployee.length}`);

    if (fromEmployee.length > 0) {
      console.log(`\n  --- EMPLOYEE-SPONSORED ADS (these are the recovered ones) ---\n`);

      for (let i = 0; i < fromEmployee.length; i++) {
        const ad = fromEmployee[i];
        const raw = ad.rawData as any;
        const personName = raw?.advertiser?.name || '?';
        const personTitle = raw?.advertiser?.position || '';
        const adType = raw?.ad_type || ad.format;
        const hasImage = !!ad.imageUrl;
        const hasVideo = !!ad.videoUrl;
        const headline = ad.headline || '';
        const relevance = ad.relevance;

        // Trim headline for readability
        const headlinePreview = headline.length > 150
          ? headline.slice(0, 150) + '...'
          : headline;

        console.log(`  ${i + 1}. [${adType.toUpperCase()}] ${hasImage ? '🖼' : ''}${hasVideo ? '🎬' : ''} Score: ${relevance?.score ?? '?'} (${relevance?.category ?? '?'})`);
        console.log(`     Person: "${personName}"`);
        console.log(`     Title:  "${personTitle.slice(0, 100)}"`);
        console.log(`     Text:   "${headlinePreview}"`);
        if (relevance?.explanation) {
          console.log(`     Why:    "${relevance.explanation.slice(0, 120)}"`);
        }
        console.log('');
      }
    }

    if (fromCompany.length > 0) {
      console.log(`  --- COMPANY-ACCOUNT ADS (already captured before fix) ---\n`);

      for (let i = 0; i < fromCompany.length; i++) {
        const ad = fromCompany[i];
        const raw = ad.rawData as any;
        const personName = raw?.advertiser?.name || '?';
        const adType = raw?.ad_type || ad.format;
        const hasImage = !!ad.imageUrl;
        const hasVideo = !!ad.videoUrl;
        const headline = ad.headline || '';
        const relevance = ad.relevance;

        const headlinePreview = headline.length > 150
          ? headline.slice(0, 150) + '...'
          : headline;

        console.log(`  ${i + 1}. [${adType.toUpperCase()}] ${hasImage ? '🖼' : ''}${hasVideo ? '🎬' : ''} Score: ${relevance?.score ?? '?'} (${relevance?.category ?? '?'})`);
        console.log(`     Account: "${personName}"`);
        console.log(`     Text:    "${headlinePreview}"`);
        console.log('');
      }
    }
  }
}

main().catch(console.error);
