import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)/);
  if (match) process.env[match[1]] = match[2];
}

async function runABTest() {
  const { generateSection } = await import('./src/lib/ai/sections');

  const context = {
    companyName: 'SaaSLaunch',
    websiteUrl: 'https://saaslaunch.net',
    businessModel: 'B2B SaaS marketing agency — full-service paid media, positioning, and demand gen for growth-stage SaaS companies',
    productDescription: 'Done-for-you paid media campaigns, positioning workshops, and demand generation programs for B2B SaaS companies doing $1M-$50M ARR',
    primaryIcpDescription: 'B2B SaaS founders and VPs of Marketing at companies doing $1M-$50M ARR who have tried agencies before and been burned, or are doing marketing in-house but hitting a growth ceiling',
  };

  // --- TEST A: industryResearch (current skills, Sonnet) ---
  console.log('\n=== TEST A: industryResearch (current skill + Sonnet) ===\n');
  const startA = Date.now();
  try {
    const resultA = await generateSection('industryResearch', context, {
      onDelta: () => process.stdout.write('.'),
    });
    const elapsedA = ((Date.now() - startA) / 1000).toFixed(1);

    console.log(`\n\nSUCCESS in ${elapsedA}s`);
    console.log(`Content length: ${resultA.text.length} chars`);
    console.log(`Citations: ${resultA.citations.length}`);
    console.log(`File IDs: ${resultA.fileIds.length}`);

    // Save full output for review
    fs.writeFileSync('/tmp/ab-test-output-A.md', resultA.text);
    fs.writeFileSync('/tmp/ab-test-citations-A.json', JSON.stringify(resultA.citations, null, 2));

    // Quality scoring
    const scoreA = scoreOutput(resultA.text, resultA.citations, 'industryResearch');
    console.log('\n--- QUALITY SCORES (Test A) ---');
    printScores(scoreA);

  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    console.error('\nFAILED:', error.message);
    if (error.status) console.error('Status:', error.status);
  }

  // --- TEST B: competitorIntel (current skills, Sonnet) ---
  console.log('\n\n=== TEST B: competitorIntel (current skill + Sonnet) ===\n');
  const startB = Date.now();
  try {
    const contextB = {
      ...context,
      topCompetitors: ['Directive Consulting', 'Refine Labs', 'Powered by Search'],
    };
    const resultB = await generateSection('competitorIntel', contextB, {
      onDelta: () => process.stdout.write('.'),
    });
    const elapsedB = ((Date.now() - startB) / 1000).toFixed(1);

    console.log(`\n\nSUCCESS in ${elapsedB}s`);
    console.log(`Content length: ${resultB.text.length} chars`);
    console.log(`Citations: ${resultB.citations.length}`);
    console.log(`File IDs: ${resultB.fileIds.length}`);

    fs.writeFileSync('/tmp/ab-test-output-B.md', resultB.text);
    fs.writeFileSync('/tmp/ab-test-citations-B.json', JSON.stringify(resultB.citations, null, 2));

    const scoreB = scoreOutput(resultB.text, resultB.citations, 'competitorIntel');
    console.log('\n--- QUALITY SCORES (Test B) ---');
    printScores(scoreB);

  } catch (err: unknown) {
    const error = err as Error & { status?: number;};
    console.error('\nFAILED:', error.message);
    if (error.status) console.error('Status:', error.status);
  }

  // --- TEST C: icpValidation (uses thinking) ---
  console.log('\n\n=== TEST C: icpValidation (with thinking enabled) ===\n');
  const startC = Date.now();
  try {
    const resultC = await generateSection('icpValidation', context, {
      onDelta: () => process.stdout.write('.'),
    });
    const elapsedC = ((Date.now() - startC) / 1000).toFixed(1);

    console.log(`\n\nSUCCESS in ${elapsedC}s`);
    console.log(`Content length: ${resultC.text.length} chars`);
    console.log(`Citations: ${resultC.citations.length}`);

    fs.writeFileSync('/tmp/ab-test-output-C.md', resultC.text);
    fs.writeFileSync('/tmp/ab-test-citations-C.json', JSON.stringify(resultC.citations, null, 2));

    const scoreC = scoreOutput(resultC.text, resultC.citations, 'icpValidation');
    console.log('\n--- QUALITY SCORES (Test C) ---');
    printScores(scoreC);

  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    console.error('\nFAILED:', error.message);
    if (error.status) console.error('Status:', error.status);
  }

  console.log('\n\n=== A/B TEST COMPLETE ===');
  console.log('Full outputs saved to /tmp/ab-test-output-{A,B,C}.md');
}

interface QualityScore {
  dataSpecificity: number;      // Real numbers, not vague
  structureCompliance: number;  // Follows SKILL.md headers
  toolUsageEvidence: number;    // References tool results
  citationDensity: number;      // Citations per 1000 chars
  actionability: number;        // Concrete recommendations
  depth: number;                // Length & detail
  overallScore: number;
  breakdown: string[];
}

function scoreOutput(
  text: string,
  citations: Array<{ url: string; title?: string }>,
  sectionId: string,
): QualityScore {
  const breakdown: string[] = [];
  const len = text.length;

  // 1. Data Specificity — count numbers, percentages, dollar amounts
  const numbers = (text.match(/\$[\d,.]+|\d+(\.\d+)?%|\d{1,3}(,\d{3})+/g) || []).length;
  const dataSpecificity = Math.min(10, Math.round((numbers / Math.max(len / 1000, 1)) * 2));
  breakdown.push(`Data points: ${numbers} (${(numbers / (len / 1000)).toFixed(1)} per 1k chars)`);

  // 2. Structure Compliance — check for expected headers
  const expectedHeaders: Record<string, string[]> = {
    industryResearch: ['Market Overview', 'Pain Points', 'Buying Behavior', 'Trend Signals', 'Seasonality', 'Macro Risks', 'Strategic Implications'],
    competitorIntel: ['Website', 'Ad Strategy', 'Keyword', 'Landing Page', 'Threat Assessment', 'Competitive Matrix', 'Strategic Gaps'],
    icpValidation: ['ICP Persona', 'Demographics', 'Psychographics', 'Channel Preferences', 'Trigger Events', 'Buying Committee', 'Final Verdict'],
  };
  const headers = expectedHeaders[sectionId] || [];
  let matched = 0;
  for (const h of headers) {
    if (text.toLowerCase().includes(h.toLowerCase())) matched++;
  }
  const structureCompliance = headers.length > 0 ? Math.round((matched / headers.length) * 10) : 5;
  breakdown.push(`Headers matched: ${matched}/${headers.length}`);

  // 3. Tool Usage Evidence — phrases indicating real research
  const toolPhrases = ['according to', 'source:', 'data shows', 'research indicates', 'survey', 'report', 'study', 'billion', 'million', 'CAGR', 'YoY', 'forecast'];
  let toolEvidence = 0;
  for (const phrase of toolPhrases) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) toolEvidence++;
  }
  const toolUsageEvidence = Math.min(10, Math.round((toolEvidence / toolPhrases.length) * 10));
  breakdown.push(`Tool evidence phrases: ${toolEvidence}/${toolPhrases.length}`);

  // 4. Citation Density
  const citationDensity = Math.min(10, Math.round((citations.length / Math.max(len / 2000, 1)) * 2));
  breakdown.push(`Citations: ${citations.length} (${(citations.length / (len / 1000)).toFixed(2)} per 1k chars)`);

  // 5. Actionability — phrases indicating recommendations
  const actionPhrases = ['recommend', 'should', 'opportunity', 'leverage', 'prioritize', 'focus on', 'allocate', 'target', 'test', 'launch'];
  let actionCount = 0;
  for (const phrase of actionPhrases) {
    const regex = new RegExp(phrase, 'gi');
    actionCount += (text.match(regex) || []).length;
  }
  const actionability = Math.min(10, Math.round(actionCount / 3));
  breakdown.push(`Actionable phrases: ${actionCount}`);

  // 6. Depth — based on content length
  const depthThresholds = [2000, 4000, 8000, 12000, 16000, 20000];
  let depth = 1;
  for (const threshold of depthThresholds) {
    if (len >= threshold) depth++;
  }
  depth = Math.min(10, depth + 3);
  breakdown.push(`Content length: ${len} chars`);

  // Overall
  const overallScore = Math.round(
    (dataSpecificity * 0.2 +
      structureCompliance * 0.2 +
      toolUsageEvidence * 0.15 +
      citationDensity * 0.15 +
      actionability * 0.15 +
      depth * 0.15) * 10
  ) / 10;

  return {
    dataSpecificity,
    structureCompliance,
    toolUsageEvidence,
    citationDensity,
    actionability,
    depth,
    overallScore,
    breakdown,
  };
}

function printScores(score: QualityScore) {
  console.log(`  Data Specificity:     ${score.dataSpecificity}/10`);
  console.log(`  Structure Compliance: ${score.structureCompliance}/10`);
  console.log(`  Tool Usage Evidence:  ${score.toolUsageEvidence}/10`);
  console.log(`  Citation Density:     ${score.citationDensity}/10`);
  console.log(`  Actionability:        ${score.actionability}/10`);
  console.log(`  Depth:                ${score.depth}/10`);
  console.log(`  ────────────────────────────`);
  console.log(`  OVERALL:              ${score.overallScore}/10`);
  console.log('');
  for (const line of score.breakdown) {
    console.log(`  • ${line}`);
  }
}

runABTest();
