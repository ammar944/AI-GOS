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
    topCompetitors: ['Directive Consulting', 'Refine Labs', 'Powered by Search'],
  };

  console.log('=== competitorIntel (MAX_ITERATIONS=20, no meta-narration) ===\n');
  const start = Date.now();
  let iterCount = 0;

  try {
    const result = await generateSection('competitorIntel', context, {
      onDelta: () => {
        iterCount++;
        if (iterCount % 100 === 0) process.stdout.write('.');
      },
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\n\nSUCCESS in ${elapsed}s`);
    console.log(`Content length: ${result.text.length} chars`);
    console.log(`Citations: ${result.citations.length}`);
    console.log('\nFirst 2000 chars:');
    console.log(result.text.slice(0, 2000));
    console.log('\n\nLast 1000 chars:');
    console.log(result.text.slice(-1000));

    fs.writeFileSync('/tmp/ab-test-competitor-fixed.md', result.text);
    fs.writeFileSync('/tmp/ab-test-competitor-citations.json', JSON.stringify(result.citations, null, 2));
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    console.error('\nFAILED:', error.message);
    if (error.status) console.error('Status:', error.status);
  }
}

test();
