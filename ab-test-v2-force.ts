import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { toFile } from '@anthropic-ai/sdk';
import type {
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  BetaContentBlockParam,
  BetaCodeExecutionTool20250825,
  BetaTool,
  BetaToolUnion,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)/);
  if (match) process.env[match[1]] = match[2];
}

const { SECTION_TOOLS, executeToolCall } = require('./src/lib/ai/sections/tools');
const { SECTION_CONFIGS } = require('./src/lib/ai/sections/configs');

const BETAS: Anthropic.Beta.AnthropicBeta[] = [
  "code-execution-2025-08-25",
  "skills-2025-10-02",
  "files-api-2025-04-14",
];

async function uploadFreshSkill(client: Anthropic): Promise<string> {
  const skillDir = path.join(process.cwd(), 'src/lib/ai/skills/industry-research');
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else files.push(fullPath);
    }
  }
  walk(skillDir);

  // Folder name must match SKILL.md `name` field (industry-research)
  // but we use a different display_title so it doesn't conflict with the cached one
  const folderName = 'industry-research';
  const displayTitle = 'industry-research-v2';
  const uploadFiles = await Promise.all(
    files.map(fp => {
      const rel = path.relative(skillDir, fp).split(path.sep).join('/');
      return toFile(fs.createReadStream(fp), path.posix.join(folderName, rel));
    })
  );

  console.log(`Uploading skill "${displayTitle}" with ${uploadFiles.length} files...`);
  const skill = await client.beta.skills.create({
    display_title: displayTitle,
    files: uploadFiles,
    betas: ["skills-2025-10-02"],
  });

  console.log(`Created skill: ${skill.id}`);
  return skill.id;
}

async function test() {
  const client = new Anthropic();
  const sectionId = 'industryResearch';
  const config = SECTION_CONFIGS[sectionId];

  // Upload fresh skill with updated SKILL.md
  const skillId = await uploadFreshSkill(client);

  const context = {
    companyName: 'SaaSLaunch',
    websiteUrl: 'https://saaslaunch.net',
    businessModel: 'B2B SaaS marketing agency — full-service paid media, positioning, and demand gen for growth-stage SaaS companies',
    productDescription: 'Done-for-you paid media campaigns, positioning workshops, and demand generation programs for B2B SaaS companies doing $1M-$50M ARR',
    primaryIcpDescription: 'B2B SaaS founders and VPs of Marketing at companies doing $1M-$50M ARR who have tried agencies before and been burned, or are doing marketing in-house but hitting a growth ceiling',
  };

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

  let finalText = '';
  let iteration = 0;
  const MAX_ITERATIONS = 20;
  const toolCallLog: string[] = [];

  console.log('\n=== SKILL V2 (FRESH UPLOAD) TEST ===\n');
  const start = Date.now();

  while (true) {
    iteration++;
    if (iteration > MAX_ITERATIONS) break;

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
        process.stdout.write('.');
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
        const inputStr = JSON.stringify(block.input).slice(0, 100);
        toolCallLog.push(`[iter ${iteration}] ${block.name}(${inputStr})`);
        process.stdout.write(`T`);
      }
    }

    if (toolUseBlocks.length === 0) break;

    const toolResults: BetaToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      if (toolUse.name === 'code_execution') continue;
      const result = await executeToolCall(toolUse.name, toolUse.input as Record<string, unknown>);

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
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result.content });
        }
      } else {
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result.content });
      }
    }

    if (toolResults.length === 0) break;

    messages = [
      ...messages,
      { role: "assistant" as const, content: response.content as BetaContentBlockParam[] },
      { role: "user" as const, content: toolResults },
    ];
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n\nDone in ${elapsed}s`);
  console.log(`Content: ${finalText.length} chars`);
  console.log(`Tool calls: ${toolCallLog.length}`);

  console.log('\n--- Tool Call Log ---');
  for (const log of toolCallLog) {
    console.log(`  ${log}`);
  }

  // Save output
  fs.writeFileSync('/tmp/skill-v2-fresh-output.md', finalText);

  // Check key metrics
  const hasPreamble = /^(I'll|Let me|Now|I need)/i.test(finalText.trim());
  const hasInsufficient = finalText.includes('Insufficient data');
  const hasStepRefs = (finalText.match(/Step \d/g) || []).length;
  const hasSourceAttr = (finalText.match(/Source:/g) || []).length;
  const stats = finalText.match(/\$[\d,.]+[BMK]?|\d+(\.\d+)?%|\d{1,3}(,\d{3})+/g) || [];

  console.log('\n--- Quality Metrics ---');
  console.log(`Preamble: ${hasPreamble ? 'YES ❌' : 'NO ✅'}`);
  console.log(`"Insufficient data" used: ${hasInsufficient ? 'YES ✅' : 'NO ⚠️'}`);
  console.log(`Step references: ${hasStepRefs}`);
  console.log(`Source attributions: ${hasSourceAttr}`);
  console.log(`Stats in output: ${stats.length}`);
  console.log(`Tool calls made: ${toolCallLog.length} (expected 8)`);

  console.log('\nFirst 2000 chars:');
  console.log(finalText.slice(0, 2000));
}

test().catch(console.error);
