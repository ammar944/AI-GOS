import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)/);
  if (match) process.env[match[1]] = match[2];
}

async function provenanceCheck() {
  const { executeToolCall } = require('./src/lib/ai/sections/tools');

  // Run the exact same queries the model made and capture FULL responses
  const queries = [
    { query: "B2B SaaS marketing agency market size revenue growth rate 2024 2025 forecast", focus: "market_size" },
    { query: "B2B SaaS marketing paid media customer pain points complaints reviews G2 Reddit forums", focus: "pain_points" },
    { query: "B2B SaaS founders VPs Marketing $1M-$50M ARR buying behavior decision process sales cycle triggers seasonal", focus: "buying_behavior" },
    { query: "B2B SaaS marketing emerging trends 2024 2025 rising declining shifts disruption", focus: "trends" },
    { query: "B2B SaaS marketing seasonal demand patterns month by month peak trough budget cycles", focus: "buying_behavior" },
    { query: "B2B SaaS regulatory risks market downturn consolidation threats 2024 2025", focus: "trends" },
  ];

  // Get all full tool responses
  console.log('Fetching fresh Perplexity responses for provenance check...\n');
  const allToolContent: string[] = [];
  for (const q of queries) {
    const result = await executeToolCall('search_market_data', q);
    allToolContent.push(result.content);
    console.log(`Query: "${q.query.slice(0, 60)}..." → ${result.content.length} chars`);
  }

  const combinedToolData = allToolContent.join('\n\n===SEPARATOR===\n\n');
  fs.writeFileSync('/tmp/all-tool-responses.txt', combinedToolData);

  // Now check the output
  const output = fs.readFileSync('/tmp/pipeline-output.md', 'utf8');

  // Extract all specific claims/stats from output
  const claims = [
    { text: "USD 328-393 billion in 2024", stat: true },
    { text: "210.22 billion", stat: true },
    { text: "9.05%", stat: true },
    { text: "26.24%", stat: true },
    { text: "85% of business apps", stat: true },
    { text: "26% in 2024", stat: true },
    { text: "35% in 2025", stat: true },
    { text: "25% growth", stat: true },
    { text: "30% in 2023", stat: true },
    { text: "75% of B2B buyers research online", stat: true },
    { text: "75% of B2B firms stop paid media campaigns", stat: true },
    { text: "$10K across US/Canada/UK", stat: true },
    { text: "$40/click on Google", stat: true },
    { text: "every 4-6 weeks", stat: true },
    { text: "52% of B2B decision-makers", stat: true },
    { text: "73%", stat: true },
    { text: "75% of global data", stat: true },
    { text: "€35M or 7% revenue", stat: true },
    { text: "70-80% of B2B buying decisions", stat: true },
    { text: "30-40% during Q1", stat: true },
    // Non-stat claims
    { text: "Efficiency and Scale Urgency", stat: false },
    { text: "ROI Accountability", stat: false },
    { text: "Competitive Advantage", stat: false },
    { text: "Time Scarcity", stat: false },
    { text: "Expertise Gap", stat: false },
  ];

  console.log('\n\n========================================');
  console.log('      FULL PROVENANCE AUDIT             ');
  console.log('========================================\n');

  let traceableCount = 0;
  let hallCount = 0;

  for (const claim of claims) {
    // Search in combined tool data
    const searchTerms = [claim.text, claim.text.replace(/[%$€]/g, '')];
    let found = false;
    for (const term of searchTerms) {
      if (combinedToolData.includes(term)) {
        found = true;
        break;
      }
    }
    // Also try partial match for numbers
    if (!found && claim.stat) {
      const numbers = claim.text.match(/[\d,.]+/g);
      if (numbers) {
        for (const num of numbers) {
          if (combinedToolData.includes(num)) {
            found = true;
            break;
          }
        }
      }
    }

    const emoji = found ? '✅' : '❌';
    const label = claim.stat ? 'STAT' : 'CLAIM';
    console.log(`${emoji} [${label}] "${claim.text}" → ${found ? 'TRACEABLE to tool data' : 'NOT FOUND in any tool response'}`);

    if (found) traceableCount++;
    else hallCount++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Traceable: ${traceableCount}/${claims.length} (${((traceableCount/claims.length)*100).toFixed(0)}%)`);
  console.log(`Hallucinated: ${hallCount}/${claims.length} (${((hallCount/claims.length)*100).toFixed(0)}%)`);

  // Now check which OUTPUT SECTIONS have NO corresponding tool call
  console.log('\n--- Section Coverage Analysis ---');
  const sections = [
    { name: 'Market Overview', hasToolCall: true, tool: 'market_size query' },
    { name: 'Pain Points', hasToolCall: true, tool: 'pain_points query' },
    { name: 'Buying Behavior', hasToolCall: true, tool: 'buying_behavior query' },
    { name: 'Psychological Drivers', hasToolCall: false, tool: 'NO TOOL CALL — synthesized from training data' },
    { name: 'Audience Objections', hasToolCall: false, tool: 'NO TOOL CALL — synthesized from training data' },
    { name: 'Trend Signals', hasToolCall: true, tool: 'trends query' },
    { name: 'Seasonality Calendar', hasToolCall: true, tool: 'seasonality query' },
    { name: 'Macro Risks', hasToolCall: true, tool: 'macro_risks query' },
    { name: 'Strategic Implications', hasToolCall: false, tool: 'NO TOOL CALL — synthesized from training data' },
  ];

  for (const sec of sections) {
    const emoji = sec.hasToolCall ? '✅' : '⚠️';
    console.log(`${emoji} ${sec.name} ← ${sec.tool}`);
  }

  const toolBacked = sections.filter(s => s.hasToolCall).length;
  const notToolBacked = sections.filter(s => !s.hasToolCall).length;
  console.log(`\nTool-backed: ${toolBacked}/${sections.length}`);
  console.log(`Training-data-dependent: ${notToolBacked}/${sections.length}`);
  console.log('\n⚠️  Psychological Drivers, Objections, and Strategic Implications have NO tool calls.');
  console.log('   Claude fills these entirely from training knowledge.');
}

provenanceCheck().catch(console.error);
