import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';

import { SONNET_SECTION_MODEL_ID } from '@/lib/lab-engine/ai/models';
import {
  STRATEGY_BRIEF_TITLE,
  strategyBriefArtifactSchema,
  type StrategyBriefArtifact,
} from './schema';

const COMPOSER_INSTRUCTIONS = [
  'You are a senior GTM strategist writing the Offer & Angle Brief that downstream media planning treats as source of truth.',
  'Compose ONLY from the committed research sections, the evidence pool, and the operator inputs below.',
  'Do not invent quotes, numbers, companies, or audience figures. If evidence is missing, write the gap into body.gaps instead.',
  'Angles are emotion-engineered objects: vignette, core emotion, ad frame, rank. Every angle must cite sourceEvidence (committed section ids or evidence sourceUrls).',
  'The lexicon bans client self-description that does not sell; give a reason for every ban.',
  'Changelog: exactly one entry, revision 1 for a fresh draft (or revision = prior+1 when a prior brief is provided, summarizing what changed and why).',
].join('\n');

export interface BuildStrategyBriefPromptInput {
  committedSectionMarkdown: Record<string, string>;
  evidencePoolSlice: string;
  onboardingFrame: string;
  refinement: string | null;
  priorBrief: StrategyBriefArtifact | null;
}

export function buildStrategyBriefPrompt(
  input: BuildStrategyBriefPromptInput,
): string {
  const sections = Object.entries(input.committedSectionMarkdown)
    .map(([id, markdown]) => `<section id="${id}">\n${markdown}\n</section>`)
    .join('\n\n');
  const priorRevision =
    input.priorBrief?.body.changelog.at(-1)?.revision ?? null;

  return [
    '<committed-research>',
    sections,
    '</committed-research>',
    '<evidence-pool>',
    input.evidencePoolSlice,
    '</evidence-pool>',
    '<operator-frame>',
    input.onboardingFrame,
    '</operator-frame>',
    input.priorBrief === null
      ? ''
      : `<prior-brief revision="${priorRevision ?? 1}">\n${JSON.stringify(input.priorBrief.body)}\n</prior-brief>`,
    input.refinement === null || input.refinement === ''
      ? ''
      : `<user-refinement binding="true">\n${input.refinement}\n</user-refinement>`,
    `Produce the ${STRATEGY_BRIEF_TITLE}. Do not invent evidence.`,
  ]
    .filter((part) => part !== '')
    .join('\n\n');
}

export interface ComposeStrategyBriefInput
  extends BuildStrategyBriefPromptInput {
  abortSignal?: AbortSignal;
}

export async function composeStrategyBrief(
  input: ComposeStrategyBriefInput,
): Promise<StrategyBriefArtifact> {
  const result = await generateText({
    model: anthropic(SONNET_SECTION_MODEL_ID),
    output: Output.object({ schema: strategyBriefArtifactSchema }),
    system: COMPOSER_INSTRUCTIONS,
    prompt: buildStrategyBriefPrompt(input),
    maxOutputTokens: 8000,
    ...(input.abortSignal === undefined
      ? {}
      : { abortSignal: input.abortSignal }),
  });

  let output: unknown;
  try {
    output = result.output;
  } catch {
    throw new Error('strategy_brief_compose_no_output');
  }

  const parsed = strategyBriefArtifactSchema.safeParse(output);
  if (!parsed.success) {
    throw new Error(`strategy_brief_compose_invalid: ${parsed.error.message}`);
  }

  const { confidence } = parsed.data;
  if (confidence < 0 || confidence > 1) {
    throw new Error('strategy_brief_confidence_out_of_range');
  }

  return parsed.data;
}
