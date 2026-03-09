import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  BetaContentBlockParam,
  BetaCodeExecutionTool20250825,
  BetaTool,
  BetaToolUnion,
  BetaTextBlock,
  BetaTextCitation,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)/);
  if (match) process.env[match[1]] = match[2];
}

// Import after env loaded
const { SECTION_TOOLS, executeToolCall } = require('./src/lib/ai/sections/tools');
const { getOrUploadSkill, SECTION_SKILL_MAP } = require('./src/lib/ai/skills/manager');
const { SECTION_CONFIGS } = require('./src/lib/ai/sections/configs');

interface TraceEntry {
  iteration: number;
  toolName: string;
  input: Record<string, unknown>;
  outputLength: number;
  outputPreview: string;
  citations: number;
  hasRealData: boolean; // Did the tool return actual data vs error/empty?
}

async function tracedTest() {
  const client = new Anthropic();
  const sectionId = 'industryResearch';
  const config = SECTION_CONFIGS[sectionId];

  const context = {
    companyName: 'SaaSLaunch',
    websiteUrl: 'https://saaslaunch.net',
    businessModel: 'B2B SaaS marketing agency',
    productDescription: 'Done-for-you paid media campaigns for B2B SaaS companies doing $1M-$50M ARR',
    primaryIcpDescription: 'B2B SaaS founders and VPs of Marketing at $1M-$50M ARR companies',
  };

  // Get skill
  const skillName = SECTION_SKILL_MAP[sectionId];
  const skillId = await getOrUploadSkill(client, skillName);
  console.log(`Skill: ${skillName} → ${skillId}`);

  const BETAS: Anthropic.Beta.AnthropicBeta[] = [
    "code-execution-2025-08-25",
    "skills-2025-10-02",
    "files-api-2025-04-14",
  ];

  const codeExecutionTool: BetaCodeExecutionTool20250825 = {
    type: "code_execution_20250825",
    name: "code_execution",
  };

  const sectionToolNames = config.tools;
  const customTools: BetaTool[] = SECTION_TOOLS
    .filter((t: any) => sectionToolNames.includes(t.name))
    .map((t: any) => ({ ...t, type: "custom" as const }) as BetaTool);

  const tools: BetaToolUnion[] = [codeExecutionTool, ...customTools];

  const brief = `# Research Brief: ${config.name}

**Company:** ${context.companyName}
**Website:** ${context.websiteUrl}
**Business Model:** ${context.businessModel}
**Product:** ${context.productDescription}
**Target Customer:** ${context.primaryIcpDescription}

Generate the ${config.name} section. Use your tools to gather real data. Do not use any information from your training data for statistics, market figures, or company details.

IMPORTANT OUTPUT RULES:
- Start your response DIRECTLY with the research content — no preamble like "I'll generate..." or "Let me first..."
- Do NOT narrate your process. Just call the tools silently and write the final report.
- Your entire response should be the finished report, ready to display to a client.`;

  let messages: BetaMessageParam[] = [
    { role: "user", content: brief },
  ];

  const trace: TraceEntry[] = [];
  let finalText = '';
  let iteration = 0;
  const MAX_ITERATIONS = 20;

  console.log('\n=== TRACED PIPELINE TEST ===\n');

  while (true) {
    iteration++;
    if (iteration > MAX_ITERATIONS) break;

    console.log(`\n--- Iteration ${iteration} ---`);

    const response = await client.beta.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      betas: BETAS,
      container: {
        skills: [{ type: "custom" as const, skill_id: skillId }],
      },
      tools,
      messages,
    });

    const toolUseBlocks: BetaToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
        console.log(`  [TEXT] ${block.text.length} chars`);
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
        console.log(`  [TOOL CALL] ${block.name}(${JSON.stringify(block.input).slice(0, 120)})`);
      }
    }

    if (toolUseBlocks.length === 0) {
      console.log('  → No more tool calls, done.');
      break;
    }

    // Execute tools and log EVERY response
    const toolResults: BetaToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      if (toolUse.name === 'code_execution') continue;

      const result = await executeToolCall(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
      );

      const isError = result.content.includes('Tool error:') ||
                      result.content.includes('not configured') ||
                      result.content.includes('Failed to') ||
                      result.content.length < 100;

      const citationCount = result.citations?.length || 0;

      const entry: TraceEntry = {
        iteration,
        toolName: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
        outputLength: result.content.length,
        outputPreview: result.content.slice(0, 500),
        citations: citationCount,
        hasRealData: !isError && result.content.length > 200,
      };
      trace.push(entry);

      console.log(`  [TOOL RESULT] ${toolUse.name}: ${result.content.length} chars, ${citationCount} citations, real=${entry.hasRealData}`);

      // Format tool result
      if (result.citations && result.citations.length > 0) {
        const validCites = result.citations.filter((c: any) => c.url);
        if (validCites.length > 0) {
          const searchResultBlocks = validCites.map((cite: any) => ({
            type: "search_result" as const,
            source: cite.url,
            title: cite.title || new URL(cite.url).hostname,
            content: [{ type: "text" as const, text: result.content }],
            citations: { enabled: true },
          }));
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: searchResultBlocks,
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result.content,
          });
        }
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.content,
        });
      }
    }

    if (toolResults.length === 0) break;

    messages = [
      ...messages,
      { role: "assistant" as const, content: response.content as BetaContentBlockParam[] },
      { role: "user" as const, content: toolResults },
    ];
  }

  // === ANALYSIS ===
  console.log('\n\n========================================');
  console.log('         PIPELINE TRACE REPORT          ');
  console.log('========================================\n');

  console.log(`Total iterations: ${iteration}`);
  console.log(`Total tool calls: ${trace.length}`);
  console.log(`Final output: ${finalText.length} chars\n`);

  console.log('--- Tool Call Summary ---');
  for (const entry of trace) {
    const status = entry.hasRealData ? '✅' : '❌';
    console.log(`${status} [iter ${entry.iteration}] ${entry.toolName}(${JSON.stringify(entry.input).slice(0, 80)}) → ${entry.outputLength} chars, ${entry.citations} citations`);
  }

  const workingCalls = trace.filter(e => e.hasRealData).length;
  const failedCalls = trace.filter(e => !e.hasRealData).length;
  console.log(`\nWorking: ${workingCalls}/${trace.length} | Failed: ${failedCalls}/${trace.length}`);

  // Save trace for deep analysis
  fs.writeFileSync('/tmp/pipeline-trace.json', JSON.stringify(trace, null, 2));
  fs.writeFileSync('/tmp/pipeline-output.md', finalText);

  // === DATA PROVENANCE CHECK ===
  console.log('\n--- Data Provenance Check ---');

  // Extract all numbers/stats from the output
  const stats = finalText.match(/\$[\d,.]+[BMK]?|\d+(\.\d+)?%|\d{1,3}(,\d{3})+|\d+\.\d+ (billion|million|trillion)/gi) || [];
  console.log(`\nStatistics in output: ${stats.length}`);
  console.log('Sample stats:', stats.slice(0, 15).join(', '));

  // Check how many stats appear in tool results vs nowhere
  let traceable = 0;
  let untraceable = 0;
  const allToolContent = trace.map(e => e.outputPreview).join(' ');

  for (const stat of stats) {
    // Normalize for comparison
    const normalized = stat.replace(/[,$%]/g, '');
    const found = allToolContent.includes(normalized) || allToolContent.includes(stat);
    if (found) {
      traceable++;
    } else {
      untraceable++;
    }
  }

  console.log(`\nTraceable to tool results: ${traceable}/${stats.length} (${((traceable/Math.max(stats.length,1))*100).toFixed(0)}%)`);
  console.log(`Untraceable (possibly hallucinated): ${untraceable}/${stats.length} (${((untraceable/Math.max(stats.length,1))*100).toFixed(0)}%)`);

  // Show Perplexity quality — first tool result preview
  console.log('\n--- Perplexity Data Quality Sample ---');
  const firstPerplexity = trace.find(e => e.toolName === 'search_market_data');
  if (firstPerplexity) {
    console.log(`Query: ${JSON.stringify(firstPerplexity.input)}`);
    console.log(`Response (first 800 chars):\n${firstPerplexity.outputPreview.slice(0, 800)}`);
  }
}

tracedTest().catch(console.error);
