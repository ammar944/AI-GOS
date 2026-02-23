/**
 * Dump ALL fields from employee/creator LinkedIn ads for beehiiv & instantly.
 * Goal: find which fields (landing URL, body text, etc.) reference the actual company.
 * Run: npx tsx scripts/test-employee-ads-fields.ts
 */
import { readFileSync, writeFileSync } from 'fs';
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

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search';
const API_KEY = process.env.SEARCHAPI_KEY!;

async function fetchRaw(params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, api_key: API_KEY });
  const res = await fetch(`${SEARCHAPI_BASE}?${qs}`);
  return res.json();
}

async function main() {
  // ---- BEEHIIV LinkedIn ----
  console.log('Fetching beehiiv LinkedIn ads...');
  const beehiivData = await fetchRaw({
    engine: 'linkedin_ad_library',
    advertiser: 'beehiiv',
  });

  const beehiivAds = beehiivData.ads || [];
  console.log(`beehiiv: ${beehiivAds.length} ads returned\n`);

  // ---- INSTANTLY LinkedIn ----
  console.log('Fetching instantly LinkedIn ads...');
  const instantlyData = await fetchRaw({
    engine: 'linkedin_ad_library',
    advertiser: 'instantly',
  });

  const instantlyAds = instantlyData.ads || [];
  console.log(`instantly: ${instantlyAds.length} ads returned\n`);

  // Combine and analyze
  const datasets = [
    { company: 'beehiiv', domain: 'beehiiv.com', ads: beehiivAds },
    { company: 'instantly', domain: 'instantly.ai', ads: instantlyAds },
  ];

  for (const { company, domain, ads } of datasets) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  ${company.toUpperCase()} — Full Field Analysis (${ads.length} ads)`);
    console.log('='.repeat(80));

    // First: dump ALL top-level keys from the first ad
    if (ads.length > 0) {
      console.log(`\n  Top-level keys on ad object: [${Object.keys(ads[0]).join(', ')}]`);
      const content = ads[0].content || {};
      console.log(`  Keys on ad.content: [${Object.keys(content).join(', ')}]`);
      const advertiser = ads[0].advertiser || {};
      console.log(`  Keys on ad.advertiser: [${Object.keys(advertiser).join(', ')}]`);
    }

    // Now check EVERY ad for company references
    let adsWithCompanyInBody = 0;
    let adsWithCompanyInHeadline = 0;
    let adsWithDomainInBody = 0;
    let adsWithDomainInHeadline = 0;
    let adsWithLandingUrl = 0;
    let adsWithDomainInLandingUrl = 0;
    let adsWithCompanyInLandingUrl = 0;
    let adsWithAnyCompanySignal = 0;
    let adsFromCompanyAccount = 0;

    const landingUrlExamples: string[] = [];
    const bodyExamples: string[] = [];

    for (const ad of ads) {
      const advertiserName = (ad.advertiser?.name || '').toLowerCase();
      const content = ad.content || {};
      const headline = (content.headline || '').toLowerCase();
      const body = (content.body || '').toLowerCase();
      const companyLower = company.toLowerCase();
      const domainLower = domain.toLowerCase();

      // Check advertiser name
      if (advertiserName.includes(companyLower)) {
        adsFromCompanyAccount++;
      }

      // Check headline
      if (headline.includes(companyLower)) adsWithCompanyInHeadline++;
      if (headline.includes(domainLower)) adsWithDomainInHeadline++;

      // Check body
      if (body.includes(companyLower)) adsWithCompanyInBody++;
      if (body.includes(domainLower)) adsWithDomainInBody++;

      // Check ALL fields for URLs — look for any field that might be a landing URL
      const allFields = JSON.stringify(ad).toLowerCase();

      // Look for landing_url, click_url, destination_url, link, url fields
      const landingUrl = content.landing_url || content.click_url || content.destination_url ||
                         content.link || content.url || ad.landing_url || ad.click_url ||
                         ad.destination_url || ad.link || ad.url || '';

      if (landingUrl) {
        adsWithLandingUrl++;
        if (landingUrl.toLowerCase().includes(domainLower)) adsWithDomainInLandingUrl++;
        if (landingUrl.toLowerCase().includes(companyLower)) adsWithCompanyInLandingUrl++;
        if (landingUrlExamples.length < 5) landingUrlExamples.push(landingUrl);
      }

      // Check if domain appears ANYWHERE in the full ad JSON
      const hasDomainAnywhere = allFields.includes(domainLower);
      const hasCompanyAnywhere = allFields.includes(companyLower);
      if (hasDomainAnywhere || hasCompanyAnywhere) adsWithAnyCompanySignal++;

      // Collect body examples from employee ads (not from company account)
      if (!advertiserName.includes(companyLower) && body && bodyExamples.length < 3) {
        bodyExamples.push(`[${ad.advertiser?.name}] ${body.slice(0, 200)}`);
      }
    }

    console.log(`\n  --- Signal Detection (out of ${ads.length} ads) ---`);
    console.log(`  Ads from company account (name match):    ${adsFromCompanyAccount}`);
    console.log(`  Ads with "${company}" in headline:          ${adsWithCompanyInHeadline}`);
    console.log(`  Ads with "${domain}" in headline:     ${adsWithDomainInHeadline}`);
    console.log(`  Ads with "${company}" in body:              ${adsWithCompanyInBody}`);
    console.log(`  Ads with "${domain}" in body:         ${adsWithDomainInBody}`);
    console.log(`  Ads with any landing URL field:           ${adsWithLandingUrl}`);
    console.log(`  Ads with "${domain}" in landing URL:  ${adsWithDomainInLandingUrl}`);
    console.log(`  Ads with "${company}" in landing URL:       ${adsWithCompanyInLandingUrl}`);
    console.log(`  Ads with ANY "${company}" or "${domain}" signal: ${adsWithAnyCompanySignal}`);

    if (landingUrlExamples.length > 0) {
      console.log(`\n  Landing URL examples:`);
      for (const url of landingUrlExamples) {
        console.log(`    ${url}`);
      }
    }

    if (bodyExamples.length > 0) {
      console.log(`\n  Body text examples from EMPLOYEE ads:`);
      for (const ex of bodyExamples) {
        console.log(`    ${ex}`);
      }
    }

    // Dump 2 full employee ad objects as JSON so we can see EVERY field
    const employeeAds = ads.filter((a: any) => !(a.advertiser?.name || '').toLowerCase().includes(company.toLowerCase()));
    if (employeeAds.length > 0) {
      console.log(`\n  --- Full JSON dump of first employee ad ---`);
      console.log(JSON.stringify(employeeAds[0], null, 2));
      if (employeeAds.length > 1) {
        console.log(`\n  --- Full JSON dump of second employee ad ---`);
        console.log(JSON.stringify(employeeAds[1], null, 2));
      }
    }
  }

  // Also check: what does our normalizeAd do with these?
  // Let's see what the service.ts filterValidAds actually checks
  console.log(`\n${'='.repeat(80)}`);
  console.log('  ALSO CHECKING: Meta ads for lemlist (LEMPIRE parent company)');
  console.log('='.repeat(80));

  // Search for LEMPIRE on Meta to see if landing URLs point to lemlist.com
  const lempireMetaPages = await fetchRaw({
    engine: 'meta_ad_library_page_search',
    q: 'lempire',
  });
  const pages = lempireMetaPages.pages || [];
  console.log(`\nMeta pages for "lempire": ${pages.length}`);
  for (const p of pages.slice(0, 5)) {
    console.log(`  "${p.name}" (id: ${p.id}, likes: ${p.likes})`);
  }

  // Also try searching for lemlist on Google with LEMPIRE advertiser
  const lempireGoogle = await fetchRaw({
    engine: 'google_ads_transparency_center',
    advertiser_name: 'lempire',
    format: 'image',
  });
  const lempireAds = lempireGoogle.ad_creatives || [];
  console.log(`\nGoogle ads for "lempire": ${lempireAds.length}`);

  let lempireWithLemlistDomain = 0;
  let lempireWithLemlistInText = 0;
  for (const ad of lempireAds) {
    const allText = JSON.stringify(ad).toLowerCase();
    if (allText.includes('lemlist.com')) lempireWithLemlistDomain++;
    if (allText.includes('lemlist')) lempireWithLemlistInText++;
  }
  console.log(`  Ads mentioning "lemlist.com": ${lempireWithLemlistDomain}`);
  console.log(`  Ads mentioning "lemlist": ${lempireWithLemlistInText}`);

  if (lempireAds.length > 0) {
    console.log(`\n  Sample LEMPIRE ad (full JSON):`);
    console.log(JSON.stringify(lempireAds[0], null, 2));
  }
}

main().catch(console.error);
