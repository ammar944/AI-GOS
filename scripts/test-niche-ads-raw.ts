/**
 * Diagnostic: dump raw ad data for rejected "insufficient_content" ads.
 * Run: npx tsx scripts/test-niche-ads-raw.ts
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

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search';
const API_KEY = process.env.SEARCHAPI_KEY!;

async function fetchRaw(params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, api_key: API_KEY });
  const res = await fetch(`${SEARCHAPI_BASE}?${qs}`);
  return res.json();
}

async function main() {
  // ---- BEEHIIV: LinkedIn (0 ads kept in previous test, but "342 available") ----
  console.log('\n' + '='.repeat(80));
  console.log('  BEEHIIV — LinkedIn Raw');
  console.log('='.repeat(80));

  const linkedinData = await fetchRaw({
    engine: 'linkedin_ad_library',
    advertiser: 'beehiiv',
  });

  const linkedinAds = linkedinData.ads || [];
  console.log(`Total LinkedIn ads: ${linkedinAds.length}\n`);

  for (let i = 0; i < Math.min(5, linkedinAds.length); i++) {
    const ad = linkedinAds[i];
    const advertiser = ad.advertiser || {};
    const content = ad.content || {};
    const hLen = (content.headline || '').trim().length;
    const bLen = (content.body || '').trim().length;
    const hasVisual = !!(content.image || content.video_url);
    const hasText = hLen >= 10 || bLen >= 20;
    const passes = hasText || hasVisual;
    console.log(`  ${i + 1}. advertiser: "${advertiser.name}"`);
    console.log(`     headline (${hLen}): "${(content.headline || '').slice(0, 60)}"`);
    console.log(`     body (${bLen}): "${(content.body || '').slice(0, 60)}"`);
    console.log(`     image: ${!!content.image} | video: ${!!content.video_url} | type: ${content.type || 'n/a'}`);
    console.log(`     → PASSES insufficient_content? ${passes}\n`);
  }

  // ---- CRISP: Meta ----
  console.log('='.repeat(80));
  console.log('  CRISP — Meta Page Search + Ads');
  console.log('='.repeat(80));

  const pageData = await fetchRaw({
    engine: 'meta_ad_library_page_search',
    q: 'crisp',
  });

  const pages = pageData.pages || [];
  console.log(`Pages found: ${pages.length}`);
  for (const p of pages.slice(0, 5)) {
    console.log(`  "${p.name}" (id: ${p.id}, likes: ${p.likes})`);
  }

  const crispPage = pages.find((p: any) => p.name?.toLowerCase() === 'crisp');
  if (crispPage) {
    const metaData = await fetchRaw({
      engine: 'meta_ad_library',
      page_id: String(crispPage.id),
      country: 'US',
    });

    const ads = metaData.ads || [];
    console.log(`\nMeta ads for "${crispPage.name}": ${ads.length}\n`);

    for (let i = 0; i < Math.min(5, ads.length); i++) {
      const ad = ads[i];
      const snapshot = ad.snapshot || {};
      const body = snapshot.body || {};
      const images = snapshot.images || [];
      const videos = snapshot.videos || [];
      const hLen = (snapshot.title || '').trim().length;
      const bLen = (body.text || '').trim().length;
      const hasVisual = images.length > 0 || videos.length > 0;
      const hasText = hLen >= 10 || bLen >= 20;
      const passes = hasText || hasVisual;

      console.log(`  ${i + 1}. page_name: "${ad.page_name || ''}"`);
      console.log(`     title (${hLen}): "${(snapshot.title || '').slice(0, 60)}"`);
      console.log(`     body.text (${bLen}): "${(body.text || '').slice(0, 60)}"`);
      console.log(`     images: ${images.length} | videos: ${videos.length}`);
      if (images.length > 0) {
        const img = images[0];
        if (typeof img === 'object' && img !== null) {
          console.log(`     img keys: [${Object.keys(img).join(', ')}]`);
          console.log(`     img.url: ${(img as any).url ? 'YES' : 'NO'} | img.original_image_url: ${(img as any).original_image_url ? 'YES' : 'NO'}`);
        } else {
          console.log(`     img value (string): "${String(img).slice(0, 80)}"`);
        }
      }
      console.log(`     → PASSES insufficient_content? ${passes}\n`);
    }
  }

  // ---- INSTANTLY: LinkedIn (only 1 kept from 2224 available) ----
  console.log('='.repeat(80));
  console.log('  INSTANTLY — LinkedIn Raw (checking who the advertisers are)');
  console.log('='.repeat(80));

  const instantlyData = await fetchRaw({
    engine: 'linkedin_ad_library',
    advertiser: 'instantly',
  });

  const instAds = instantlyData.ads || [];
  console.log(`Total LinkedIn ads: ${instAds.length}\n`);

  // Count by advertiser name
  const advCounts: Record<string, number> = {};
  for (const ad of instAds) {
    const name = ad.advertiser?.name || '(unknown)';
    advCounts[name] = (advCounts[name] ?? 0) + 1;
  }
  console.log('  Advertiser distribution:');
  for (const [name, count] of Object.entries(advCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    "${name}": ${count}`);
  }

  // ---- LEMLIST: Google (LEMPIRE rejection) ----
  console.log('\n' + '='.repeat(80));
  console.log('  LEMLIST — Google Raw (checking LEMPIRE ads)');
  console.log('='.repeat(80));

  const googleData = await fetchRaw({
    engine: 'google_ads_transparency_center',
    advertiser_name: 'lemlist',
    format: 'image',
  });

  const googleAds = googleData.ad_creatives || [];
  console.log(`Total Google ads: ${googleAds.length}\n`);

  const gAdvCounts: Record<string, number> = {};
  for (const ad of googleAds) {
    const name = ad.advertiser?.name || '(unknown)';
    gAdvCounts[name] = (gAdvCounts[name] ?? 0) + 1;
  }
  console.log('  Advertiser distribution:');
  for (const [name, count] of Object.entries(gAdvCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    "${name}": ${count}`);
  }

  // Show a sample LEMPIRE ad
  const lempireAd = googleAds.find((a: any) => a.advertiser?.name?.includes('LEMPIRE'));
  if (lempireAd) {
    console.log(`\n  Sample LEMPIRE ad:`);
    console.log(`    advertiser: "${lempireAd.advertiser?.name}"`);
    console.log(`    headline: "${lempireAd.headline || ''}"`);
    console.log(`    description: "${(lempireAd.description || '').slice(0, 100)}"`);
    console.log(`    details_link: "${lempireAd.details_link || ''}"`);
    console.log(`    image: ${!!lempireAd.image?.link}`);
  }
}

main().catch(console.error);
