import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import {
  CANONICAL_RESEARCH_SECTION_ORDER,
  normalizeResearchRecord,
} from '@/lib/journey/research-sections';
import { SECTION_CONFIGS } from '@/lib/ai/sections/configs';
import { SECTION_SKILL_MAP } from '@/lib/ai/skills/manager';
import {
  normalizeGeneratedResearchResult,
} from '@/lib/ai/tools/generate-research';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SKILLS_DIR = path.join(process.cwd(), 'src/lib/ai/skills');

function readSkillContent(sectionId: string): string {
  const skillName = SECTION_SKILL_MAP[sectionId];
  if (!skillName) return '';
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
  try {
    return fs.readFileSync(skillPath, 'utf-8');
  } catch {
    return '';
  }
}

interface SessionContext {
  companyName: string;
  websiteUrl: string;
  businessModel: string;
  productDescription: string;
  primaryIcpDescription: string;
  topCompetitors?: string[];
  monthlyAdBudget?: string;
}

function extractContextFromMetadata(metadata: Record<string, unknown>): SessionContext | null {
  const fields = metadata?.confirmedFields as Record<string, { value: unknown }> | undefined;
  if (!fields) return null;

  const get = (key: string): string =>
    (fields[key]?.value as string) ?? '';

  const companyName = get('companyName');
  const websiteUrl = get('websiteUrl');
  const businessModel = get('businessModel');
  const productDescription = get('productDescription');
  const primaryIcpDescription = get('primaryIcpDescription');

  if (!companyName || !businessModel) return null;

  const topCompetitors = fields.topCompetitors?.value;
  const monthlyAdBudget = get('monthlyAdBudget');

  return {
    companyName,
    websiteUrl,
    businessModel,
    productDescription,
    primaryIcpDescription,
    topCompetitors: Array.isArray(topCompetitors) ? topCompetitors : undefined,
    monthlyAdBudget: monthlyAdBudget || undefined,
  };
}

function buildBatchBrief(sectionId: string, ctx: SessionContext, previousSections?: Record<string, string>): string {
  const config = SECTION_CONFIGS[sectionId];
  const skillContent = readSkillContent(sectionId);

  let brief = '';
  if (skillContent) {
    brief += `${skillContent}\n\n---\n\n`;
  }

  brief += `# Research Brief: ${config.name}\n\n`;
  brief += `**Company:** ${ctx.companyName}\n`;
  brief += `**Website:** ${ctx.websiteUrl}\n`;
  brief += `**Business Model:** ${ctx.businessModel}\n`;
  brief += `**Product:** ${ctx.productDescription}\n`;
  brief += `**Target Customer:** ${ctx.primaryIcpDescription}\n`;

  if (ctx.topCompetitors?.length) {
    brief += `**Competitors:** ${ctx.topCompetitors.join(', ')}\n`;
  }
  if (ctx.monthlyAdBudget) {
    brief += `**Monthly Ad Budget:** ${ctx.monthlyAdBudget}\n`;
  }

  if (previousSections && config.dependsOn.length > 0) {
    brief += `\n## Previous Research Results\n\n`;
    for (const depId of config.dependsOn) {
      if (previousSections[depId]) {
        brief += `### ${SECTION_CONFIGS[depId]?.name ?? depId}\n`;
        brief += previousSections[depId].slice(0, 4000) + '\n\n';
      }
    }
  }

  brief += `\nGenerate the ${config.name} section. Provide comprehensive analysis based on the context above. Do not use any information from your training data for statistics, market figures, or company details — only analyze what is provided.`;

  return brief;
}

// ---------------------------------------------------------------------------
// POST — Submit batch refresh
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { sessionId: string };
  const { sessionId } = body;
  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 });
  }

  // Fetch session
  const supabase = createAdminClient();
  const { data: session, error: fetchError } = await supabase
    .from('journey_sessions')
    .select('metadata, research_results')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const ctx = extractContextFromMetadata(session.metadata as Record<string, unknown>);
  if (!ctx) {
    return Response.json({ error: 'Insufficient onboarding data to refresh research' }, { status: 422 });
  }

  // Extract previous section prose for dependent sections
  const existingResearch = normalizeResearchRecord(
    session.research_results as Record<string, unknown> | null,
  );
  const previousSections: Record<string, string> = {};
  for (const [sectionId, result] of Object.entries(existingResearch)) {
    const r = result as { data?: { content?: string } } | null;
    if (r?.data?.content) {
      previousSections[sectionId] = r.data.content;
    }
  }

  // Build batch requests — one per section
  // NOTE: Batch API supports basic messages only (no tools/skills/betas).
  // We inline the SKILL.md content as the system prompt and the research brief as the user message.
  const requests = CANONICAL_RESEARCH_SECTION_ORDER.map((sectionId) => {
    const config = SECTION_CONFIGS[sectionId];
    const brief = buildBatchBrief(sectionId, ctx, previousSections);

    return {
      custom_id: sectionId,
      params: {
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [{ role: 'user' as const, content: brief }],
      },
    };
  });

  // Submit batch
  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests });

  // Store batch ID in job_status
  await supabase
    .from('journey_sessions')
    .update({
      job_status: {
        refreshBatch: {
          batchId: batch.id,
          status: 'processing',
          submittedAt: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  return Response.json({
    batchId: batch.id,
    status: 'processing',
    estimatedMinutes: 15,
  });
}

// ---------------------------------------------------------------------------
// GET — Poll batch status / retrieve results
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const batchId = url.searchParams.get('batchId');
  const sessionId = url.searchParams.get('sessionId');

  if (!batchId || !sessionId) {
    return Response.json({ error: 'batchId and sessionId required' }, { status: 400 });
  }

  const client = new Anthropic();
  const batch = await client.messages.batches.retrieve(batchId);

  if (batch.processing_status !== 'ended') {
    return Response.json({
      status: 'processing',
      processingStatus: batch.processing_status,
      requestCounts: batch.request_counts,
    });
  }

  // Batch complete — read results and persist
  const sectionResults: Record<string, unknown> = {};
  const completedSections: string[] = [];

  const resultsStream = await client.messages.batches.results(batchId);
  for await (const entry of resultsStream) {
    const sectionId = entry.custom_id;

    if (entry.result.type === 'succeeded') {
      const message = entry.result.message;
      const textContent = message.content
        .filter((b: Anthropic.ContentBlock): b is Anthropic.TextBlock => b.type === 'text')
        .map((b: Anthropic.TextBlock) => b.text)
        .join('');

      const normalized = normalizeGeneratedResearchResult(sectionId, textContent, []);

      sectionResults[sectionId] = {
        status: 'complete',
        section: sectionId,
        data: {
          content: normalized.content,
          fileIds: [],
          citations: normalized.citations,
          provenance: normalized.provenance,
          claims: normalized.claims,
          missingData: normalized.missingData,
          data: normalized.data,
        },
        durationMs: 0,
        refreshedAt: new Date().toISOString(),
      };
      completedSections.push(sectionId);
    } else {
      sectionResults[sectionId] = {
        status: 'error',
        section: sectionId,
        error: entry.result.type === 'errored'
          ? entry.result.error?.error?.message ?? 'Batch request failed'
          : `Batch request ${entry.result.type}`,
        durationMs: 0,
      };
    }
  }

  // Persist refreshed results to Supabase
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  const currentResearch = normalizeResearchRecord(
    (existing?.research_results as Record<string, unknown>) ?? {},
  );
  const mergedResearch = { ...currentResearch, ...sectionResults };

  await supabase
    .from('journey_sessions')
    .update({
      research_results: mergedResearch,
      job_status: {
        refreshBatch: {
          batchId,
          status: 'complete',
          completedAt: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  return Response.json({
    status: 'complete',
    completedSections,
    totalSections: CANONICAL_RESEARCH_SECTION_ORDER.length,
  });
}
