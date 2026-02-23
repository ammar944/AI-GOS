// Quick standalone test to verify document extraction works with Haiku + flat schema
// Run: npx tsx scripts/test-extraction-api.ts

import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}
import { streamObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { documentExtractionSchema, EXTRACTION_FIELD_KEYS } from '../src/lib/company-intel/document-extraction-schema';

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SAMPLE_DOC = `
# PathFinder Marketing - Niche & Demographic Document

## Company Overview
PathFinder Marketing is a B2B SaaS company providing AI-powered marketing automation
for mid-market companies. Website: https://pathfindermarketing.com

## Ideal Customer Profile
Our primary ICP is marketing directors and CMOs at B2B technology companies with
51-200 employees, primarily in North America and Western Europe. They typically use
HubSpot or Salesforce for CRM.

The easiest customers to close are those who have recently hired a new marketing
director and need to show quick wins. Common buying triggers include: new CMO hire,
missed quarterly targets, or competitor launching aggressive campaigns.

Best client sources: LinkedIn (40%), referrals (30%), content marketing (20%), events (10%).

## Product & Offer
PathFinder offers an AI campaign optimization platform that automates A/B testing,
audience segmentation, and budget allocation across channels. Core deliverables:
1. AI Campaign Optimizer
2. Cross-channel Attribution Dashboard
3. Predictive Budget Allocator
4. Automated A/B Testing Engine

Pricing: $2,500/month per seat, annual contracts preferred.

## Competitive Landscape
Top competitors: HubSpot Marketing Hub, Marketo (Adobe), Pardot (Salesforce).
Our unique edge: We're the only platform that uses real-time bid optimization
across all major ad platforms simultaneously.

## Customer Journey
Before buying, customers typically struggle with manual campaign management across
3-5 platforms, wasting 60% of their ad budget on underperforming segments.

The desired transformation: Reduce campaign management time by 70% while improving
ROAS by 2-3x within the first quarter.

Common objections: "We already use HubSpot", "How is this different from our current tools?",
"What's the implementation timeline?"

Sales cycle: 14-30 days typically.

## Brand Positioning
PathFinder positions itself as the "autopilot for B2B paid media" — premium,
data-driven, and results-focused. We avoid hype and lead with concrete ROI metrics.
`;

async function main() {
  console.log('Testing document extraction with Claude Haiku (flat schema)...');
  console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'present' : 'MISSING'}`);

  const startMs = Date.now();

  const result = streamObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: documentExtractionSchema,
    system: `You are a precise document analyst extracting structured business data.
RULES: Only extract what's explicitly stated. If not found, use empty string "".
Condense to 2-5 sentences. Map enums to exact values in field descriptions.`,
    prompt: `Extract all relevant business information from this document.

--- DOCUMENT CONTENT ---
${SAMPLE_DOC}
--- END DOCUMENT ---

Extract every field you can find. Use empty string "" for fields not in the document.`,
    temperature: 0.1,
    maxOutputTokens: 12000,
  });

  let fieldCount = 0;
  let textLength = 0;
  let firstChunkMs: number | null = null;

  try {
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        textLength += chunk.textDelta.length;
        if (!firstChunkMs) {
          firstChunkMs = Date.now() - startMs;
          console.log(`  First token: ${firstChunkMs}ms`);
        }
      } else if (chunk.type === 'object') {
        // Flat schema: values are strings directly
        const obj = chunk.object as Record<string, string | undefined>;
        let found = 0;
        for (const key of EXTRACTION_FIELD_KEYS) {
          const val = obj[key];
          if (typeof val === 'string' && val !== '') found++;
        }
        if (found > fieldCount) {
          fieldCount = found;
          process.stdout.write(`\r  Fields found: ${found}/${EXTRACTION_FIELD_KEYS.length}`);
        }
      } else if (chunk.type === 'error') {
        console.error('\n  STREAM ERROR:', chunk.error);
      } else if (chunk.type === 'finish') {
        console.log(`\n  Finish reason: ${chunk.finishReason}`);
      }
    }
  } catch (err) {
    console.error('\n  STREAM ITERATION ERROR:', err);
  }

  const totalMs = Date.now() - startMs;
  console.log(`\n  Total time: ${totalMs}ms`);
  console.log(`  Text length: ${textLength} chars`);

  try {
    const usage = await result.usage;
    console.log(`  Usage: ${JSON.stringify(usage)}`);
  } catch {}

  try {
    const obj = await result.object;
    const populated = EXTRACTION_FIELD_KEYS.filter(k => {
      const val = (obj as Record<string, string>)[k];
      return typeof val === 'string' && val !== '';
    });
    console.log(`  Final fields with values: ${populated.length}/${EXTRACTION_FIELD_KEYS.length}`);
    console.log('  Sample fields:');
    console.log('    businessName:', JSON.stringify(obj.businessName));
    console.log('    websiteUrl:', JSON.stringify(obj.websiteUrl));
    console.log('    primaryIcpDescription:', JSON.stringify(obj.primaryIcpDescription?.slice(0, 80) + '...'));
    console.log('    topCompetitors:', JSON.stringify(obj.topCompetitors));
    console.log('    offerPrice:', JSON.stringify(obj.offerPrice));
    console.log('    monthlyAdBudget:', JSON.stringify(obj.monthlyAdBudget), '(should be empty)');
    console.log('    confidenceNotes:', JSON.stringify(obj.confidenceNotes?.slice(0, 100)));
  } catch (err) {
    console.error('  Object resolution error:', err);
  }
}

main().catch(console.error);
