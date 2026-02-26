// Deep Research Tool
// Multi-phase parallel research using Perplexity Sonar Pro for complex questions

import { z } from 'zod';
import { tool, generateText } from 'ai';
import { perplexity, MODELS, estimateCost } from '@/lib/ai/providers';
import type { DeepResearchResult } from './types';

// Derived type aliases for internal use (single source of truth in types.ts)
type ResearchPhase = DeepResearchResult['phases'][number];
type ResearchFinding = DeepResearchResult['findings'][number];
type ResearchSource = DeepResearchResult['sources'][number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all http/https URLs from a block of text. */
function extractUrls(text: string): string[] {
  const pattern = /https?:\/\/[^\s"'<>)}\]]+/g;
  const matches = text.match(pattern) ?? [];
  return matches;
}

/** Get the domain portion of a URL (hostname only). */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Deduplicate URLs by domain, keeping the first URL seen per domain. */
function deduplicateSources(urls: string[]): ResearchSource[] {
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const url of urls) {
    const domain = getDomain(url);
    if (!seen.has(domain)) {
      seen.add(domain);
      sources.push({ domain, url });
    }
  }
  return sources;
}

/**
 * Parse inline citations from Perplexity output.
 * Perplexity often uses [1], [2] style footnotes or bare URLs.
 * We extract numbered brackets and map them to URLs found in the text.
 */
function extractCitations(text: string, urls: string[]): { label: string; url: string }[] {
  const numbered = text.match(/\[\d+\]/g) ?? [];
  const labels = [...new Set(numbered)]; // deduplicate, preserve order

  return labels.map((label, i) => ({
    label,
    url: urls[i] ?? '',
  }));
}

/**
 * Heuristically decompose a query into 3-5 focused sub-questions.
 * Uses keyword matching to choose relevant angles without an AI call.
 */
function decomposeQuery(query: string): string[] {
  const lower = query.toLowerCase();

  const subQuestions: string[] = [];

  // Market / landscape is almost always relevant
  subQuestions.push(`What is the current market landscape and size for: ${query}?`);

  // Key players / competitive
  if (
    lower.includes('competitor') ||
    lower.includes('player') ||
    lower.includes('landscape') ||
    lower.includes('market') ||
    lower.includes('industry')
  ) {
    subQuestions.push(`Who are the key players and market leaders in: ${query}? Include market share data.`);
  } else {
    subQuestions.push(`Who are the main stakeholders and key players involved with: ${query}?`);
  }

  // Pricing / business models
  if (
    lower.includes('pric') ||
    lower.includes('cost') ||
    lower.includes('revenue') ||
    lower.includes('monetiz') ||
    lower.includes('business model')
  ) {
    subQuestions.push(`What are the pricing models, cost structures, and revenue dynamics for: ${query}?`);
  } else {
    subQuestions.push(`What are the common business models and monetization strategies related to: ${query}?`);
  }

  // Technology / trends
  if (
    lower.includes('tech') ||
    lower.includes('trend') ||
    lower.includes('emerg') ||
    lower.includes('innovat') ||
    lower.includes('ai') ||
    lower.includes('software')
  ) {
    subQuestions.push(`What are the latest technology developments and emerging trends in: ${query}?`);
  } else {
    subQuestions.push(`What are the current trends and future outlook for: ${query}?`);
  }

  // Challenges / opportunities — always useful
  subQuestions.push(`What are the main challenges, risks, and opportunities related to: ${query}?`);

  // Return at most 5
  return subQuestions.slice(0, 5);
}

/**
 * Run a single Perplexity research query and return the text plus cost.
 */
async function runSingleQuery(
  subQuery: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const result = await generateText({
    model: perplexity(MODELS.SONAR_PRO),
    system:
      'You are a deep research analyst. Provide comprehensive, factual findings with specific ' +
      'data points, statistics, and named sources. Structure your response with clear subsections.',
    prompt: subQuery,
    maxOutputTokens: 2048,
    temperature: 0.3,
  });

  return {
    text: result.text,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDeepResearchTool() {
  return tool({
    description:
      'Conduct in-depth multi-phase research on a topic using parallel web searches. ' +
      'Use this for complex questions requiring multiple angles of investigation — ' +
      'market sizing, competitive landscapes, emerging trends, or pricing analysis.',

    inputSchema: z.object({
      query: z.string().describe('The main research question to investigate'),
      focusAreas: z
        .array(z.string())
        .optional()
        .describe(
          'Specific aspects or sub-topics to focus on. If omitted the tool will decompose the query automatically.'
        ),
      depth: z
        .enum(['quick', 'standard', 'deep'])
        .optional()
        .default('standard')
        .describe(
          "'quick' = single parallel pass; 'standard' = parallel pass + synthesis; " +
            "'deep' = parallel pass + synthesis + gap analysis + follow-up pass + final synthesis"
        ),
    }),

    execute: async ({ query, focusAreas, depth = 'standard' }): Promise<DeepResearchResult> => {
      const totalStart = Date.now();
      const phases: ResearchPhase[] = [];
      const findings: ResearchFinding[] = [];
      const allUrls: string[] = [];
      let totalCost = 0;

      try {
        // ----------------------------------------------------------------
        // 1. Decompose into sub-questions
        // ----------------------------------------------------------------
        const subQueries =
          focusAreas && focusAreas.length > 0
            ? focusAreas.map((area) => `${query} — specifically regarding: ${area}`)
            : decomposeQuery(query);

        // ----------------------------------------------------------------
        // 2. Pass 1: Parallel research
        // ----------------------------------------------------------------
        const pass1Start = Date.now();

        const pass1Settled = await Promise.allSettled(subQueries.map((sq) => runSingleQuery(sq)));

        const pass1Duration = Date.now() - pass1Start;
        phases.push({ name: 'Parallel Research', status: 'done', duration: pass1Duration });

        // Count successes — if all failed, bail early
        const pass1Successes = pass1Settled.filter(r => r.status === 'fulfilled').length;
        if (pass1Successes === 0) {
          return {
            query,
            phases,
            findings: [],
            sources: [],
            totalDuration: Date.now() - totalStart,
            totalCost: 0,
            error: 'All research queries failed. Please try again.',
          };
        }

        // Accumulate costs and build findings from pass 1 (preserving original indices)
        const pass1Texts: string[] = [];
        pass1Settled.forEach((settled, i) => {
          if (settled.status !== 'fulfilled') return;
          const res = settled.value;
          totalCost += estimateCost(MODELS.SONAR_PRO, res.inputTokens, res.outputTokens);

          const subQuery = subQueries[i];
          const urls = extractUrls(res.text);
          allUrls.push(...urls);

          const title = focusAreas?.[i]
            ? focusAreas[i]
            : subQuery.split('—')[0].trim().replace(/^What (is|are) (the )?(current )?/i, '').replace(/\?$/, '');

          findings.push({
            title: title.charAt(0).toUpperCase() + title.slice(1),
            content: res.text,
            citations: extractCitations(res.text, urls),
          });

          pass1Texts.push(`## ${subQuery}\n\n${res.text}`);
        });

        // ----------------------------------------------------------------
        // 3. Pass 2: Synthesis (standard + deep)
        // ----------------------------------------------------------------
        let synthesisText = '';

        if (depth === 'standard' || depth === 'deep') {
          const synthStart = Date.now();

          const synthesisResult = await generateText({
            model: perplexity(MODELS.SONAR_PRO),
            system:
              'You are a senior strategic analyst. Synthesize the research findings below into a ' +
              'cohesive narrative. Highlight convergent insights, resolve contradictions, and draw ' +
              'actionable conclusions. Use clear section headers.',
            prompt:
              `Original question: ${query}\n\nResearch findings:\n\n${pass1Texts.join('\n\n---\n\n')}`,
            maxOutputTokens: 3000,
            temperature: 0.4,
          });

          const synthDuration = Date.now() - synthStart;
          phases.push({ name: 'Synthesis', status: 'done', duration: synthDuration });

          totalCost += estimateCost(
            MODELS.SONAR_PRO,
            synthesisResult.usage?.inputTokens ?? 0,
            synthesisResult.usage?.outputTokens ?? 0
          );

          synthesisText = synthesisResult.text;
          const synthUrls = extractUrls(synthesisText);
          allUrls.push(...synthUrls);

          findings.push({
            title: 'Synthesis',
            content: synthesisText,
            citations: extractCitations(synthesisText, synthUrls),
          });
        }

        // ----------------------------------------------------------------
        // 4. Pass 3: Gap analysis + follow-up + final synthesis (deep only)
        // ----------------------------------------------------------------
        if (depth === 'deep') {
          // Gap analysis — identify what is missing
          const gapStart = Date.now();

          const gapResult = await generateText({
            model: perplexity(MODELS.SONAR_PRO),
            system:
              'You are a critical research reviewer. Identify gaps, unanswered questions, and areas ' +
              'needing deeper investigation in the research provided. Return ONLY a numbered list of ' +
              '2-3 specific follow-up research questions — nothing else.',
            prompt:
              `Original question: ${query}\n\nCurrent findings:\n\n${synthesisText || pass1Texts.join('\n\n')}`,
            maxOutputTokens: 512,
            temperature: 0.3,
          });

          totalCost += estimateCost(
            MODELS.SONAR_PRO,
            gapResult.usage?.inputTokens ?? 0,
            gapResult.usage?.outputTokens ?? 0
          );

          // Parse the numbered follow-up questions
          const followUpQuestions = gapResult.text
            .split('\n')
            .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
            .filter((line) => line.length > 10)
            .slice(0, 3);

          const gapDuration = Date.now() - gapStart;
          phases.push({ name: 'Gap Analysis', status: 'done', duration: gapDuration });

          // Follow-up research in parallel
          if (followUpQuestions.length > 0) {
            const followUpStart = Date.now();

            const followUpSettled = await Promise.allSettled(
              followUpQuestions.map((q) => runSingleQuery(q))
            );

            const followUpDuration = Date.now() - followUpStart;
            phases.push({ name: 'Follow-up Research', status: 'done', duration: followUpDuration });

            const followUpTexts: string[] = [];
            followUpSettled.forEach((settled, i) => {
              if (settled.status !== 'fulfilled') return;
              const res = settled.value;
              totalCost += estimateCost(MODELS.SONAR_PRO, res.inputTokens, res.outputTokens);

              const followUpUrls = extractUrls(res.text);
              allUrls.push(...followUpUrls);

              findings.push({
                title: `Follow-up: ${followUpQuestions[i].replace(/\?$/, '')}`,
                content: res.text,
                citations: extractCitations(res.text, followUpUrls),
              });

              followUpTexts.push(`## ${followUpQuestions[i]}\n\n${res.text}`);
            });

            // Final synthesis incorporating all passes
            const finalSynthStart = Date.now();

            const finalSynthResult = await generateText({
              model: perplexity(MODELS.SONAR_PRO),
              system:
                'You are a senior strategic analyst producing a final, authoritative research report. ' +
                'Integrate all findings — initial research, earlier synthesis, and follow-up investigation — ' +
                'into a comprehensive, well-structured report. Include executive summary, key findings, ' +
                'strategic implications, and data-backed recommendations.',
              prompt:
                `Original question: ${query}\n\n` +
                `Initial synthesis:\n${synthesisText}\n\n` +
                `Follow-up findings:\n${followUpTexts.join('\n\n---\n\n')}`,
              maxOutputTokens: 4000,
              temperature: 0.4,
            });

            const finalSynthDuration = Date.now() - finalSynthStart;
            phases.push({ name: 'Final Synthesis', status: 'done', duration: finalSynthDuration });

            totalCost += estimateCost(
              MODELS.SONAR_PRO,
              finalSynthResult.usage?.inputTokens ?? 0,
              finalSynthResult.usage?.outputTokens ?? 0
            );

            const finalUrls = extractUrls(finalSynthResult.text);
            allUrls.push(...finalUrls);

            findings.push({
              title: 'Final Synthesis',
              content: finalSynthResult.text,
              citations: extractCitations(finalSynthResult.text, finalUrls),
            });
          }
        }

        // ----------------------------------------------------------------
        // 5. Build deduplicated source list
        // ----------------------------------------------------------------
        const sources = deduplicateSources(allUrls);
        const totalDuration = Date.now() - totalStart;

        return {
          query,
          phases,
          findings,
          sources,
          totalDuration,
          totalCost,
        };
      } catch (err) {
        console.error('[deepResearch] failed:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return {
          query,
          phases,
          findings,
          sources: [],
          totalDuration: Date.now() - totalStart,
          totalCost,
          error: `Deep research failed: ${message}`,
        };
      }
    },
  });
}
