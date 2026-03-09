import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)/);
  if (match) process.env[match[1]] = match[2];
}

async function test() {
  const { clearSkillCache } = await import('./src/lib/ai/skills/manager');
  const { generateSection } = await import('./src/lib/ai/sections');

  // Clear cache to force re-upload of updated skill
  clearSkillCache();

  // Also delete old skill from Anthropic so it uploads the new version
  const client = new Anthropic();
  const BETAS: Anthropic.Beta.AnthropicBeta[] = ["skills-2025-10-02"];
  try {
    const existing = await client.beta.skills.list({ source: "custom", betas: BETAS });
    for await (const skill of existing) {
      if (skill.display_title === 'industry-research') {
        console.log(`Deleting old skill: ${skill.id}`);
        await client.beta.skills.delete(skill.id, { betas: BETAS });
      }
    }
  } catch (e) {
    console.warn('Could not delete old skill:', e);
  }

  const context = {
    companyName: 'SaaSLaunch',
    websiteUrl: 'https://saaslaunch.net',
    businessModel: 'B2B SaaS marketing agency — full-service paid media, positioning, and demand gen for growth-stage SaaS companies',
    productDescription: 'Done-for-you paid media campaigns, positioning workshops, and demand generation programs for B2B SaaS companies doing $1M-$50M ARR',
    primaryIcpDescription: 'B2B SaaS founders and VPs of Marketing at companies doing $1M-$50M ARR who have tried agencies before and been burned, or are doing marketing in-house but hitting a growth ceiling',
  };

  console.log('\n=== SKILL V2 TEST: industryResearch (8 tool calls, no hallucination) ===\n');
  const start = Date.now();

  try {
    const result = await generateSection('industryResearch', context, {
      onDelta: (text) => process.stdout.write('.'),
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\n\nSUCCESS in ${elapsed}s`);
    console.log(`Content length: ${result.text.length} chars`);
    console.log(`Citations: ${result.citations.length}`);

    fs.writeFileSync('/tmp/skill-v2-output.md', result.text);
    fs.writeFileSync('/tmp/skill-v2-citations.json', JSON.stringify(result.citations, null, 2));

    // Quick provenance check
    const stats = result.text.match(/\$[\d,.]+[BMK]?|\d+(\.\d+)?%|\d{1,3}(,\d{3})+/g) || [];
    const hasPreamble = result.text.startsWith('I\'ll') || result.text.startsWith('Let me') || result.text.startsWith('Now');
    const hasInsufficient = result.text.includes('Insufficient data');

    console.log(`\nStats found: ${stats.length}`);
    console.log(`Starts with preamble: ${hasPreamble}`);
    console.log(`Uses "Insufficient data" where needed: ${hasInsufficient}`);

    // Check for source attribution
    const sourceRefs = (result.text.match(/from Step \d|Step \d|tool result/gi) || []).length;
    const sourceAttr = (result.text.match(/Source:|source:/g) || []).length;
    console.log(`Step references: ${sourceRefs}`);
    console.log(`Source attributions: ${sourceAttr}`);

    console.log('\nFirst 1500 chars:');
    console.log(result.text.slice(0, 1500));

  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    console.error('\nFAILED:', error.message);
    if (error.status) console.error('Status:', error.status);
  }
}

test();
