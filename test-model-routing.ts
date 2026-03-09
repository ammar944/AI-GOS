import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)/);
  if (match) process.env[match[1]] = match[2];
}

async function test() {
  const { generateSection } = await import('./src/lib/ai/sections');

  const context = {
    companyName: 'SaaSLaunch',
    websiteUrl: 'https://saaslaunch.net',
    businessModel: 'B2B SaaS marketing agency — full-service paid media, positioning, and demand gen for growth-stage SaaS companies',
    productDescription: 'Done-for-you paid media campaigns, positioning workshops, and demand generation programs for B2B SaaS companies doing $1M-$50M ARR',
    primaryIcpDescription: 'B2B SaaS founders and VPs of Marketing at companies doing $1M-$50M ARR who have tried agencies before and been burned, or are doing marketing in-house but hitting a growth ceiling',
  };

  console.log('Starting industryResearch with Sonnet...');
  const start = Date.now();

  try {
    const result = await generateSection('industryResearch', context, {
      onDelta: () => process.stdout.write('.'),
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n\nSUCCESS in ${elapsed}s`);
    console.log('Content length:', result.text.length);
    console.log('Citations:', result.citations.length);
    console.log('\nFirst 800 chars:');
    console.log(result.text.slice(0, 800));
  } catch (err: unknown) {
    const error = err as Error & { status?: number; error?: unknown };
    console.error('\nFAILED:', error.message);
    if (error.status) console.error('Status:', error.status);
  }
}

test();
