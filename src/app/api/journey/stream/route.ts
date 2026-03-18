// POST /api/journey/stream
// Streaming chat endpoint for the v2 journey experience.
// Uses Claude Opus 4.6 with adaptive thinking for conversational strategy sessions.

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { anthropic, MODELS } from '@/lib/ai/providers';
import {
  LEAD_AGENT_SYSTEM_PROMPT,
  buildResumeContext,
} from '@/lib/ai/prompts/lead-agent-system';
import {
  sanitizeJourneyMessages,
} from '@/lib/ai/journey-stream-prep';
import { askUser } from '@/lib/ai/tools/ask-user';
import { competitorFastHits } from '@/lib/ai/tools/competitor-fast-hits';
import { scrapeClientSite } from '@/lib/ai/tools/scrape-client-site';
import {
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
} from '@/lib/ai/tools/research';
import { updateFieldInputSchema } from '@/lib/ai/tools/update-field';
import { extractAskUserResults, extractResearchOutputs } from '@/lib/journey/session-state';
import { persistToSupabase, persistResearchToSupabase } from '@/lib/journey/session-state.server';
import { validateWorkerUrl } from '@/lib/env';
import { parseCollectedFields } from '@/lib/ai/journey-state';
import { getDownstreamResearchPlan } from '@/lib/ai/journey-downstream-research';
import {
  getPostApprovalPlan,
  getPostCompetitorPlan,
} from '@/lib/ai/journey-post-approval';
import {
  hasCompletedResearchOutput,
  getApprovedSections,
  getLatestApprovedSection,
  getLatestFeedbackSection,
  getPendingReviewSection,
  shouldSuppressDuplicatePostApprovalReplay,
} from '@/lib/ai/journey-review-gates';
import { detectCompetitorMentions } from '@/lib/ai/competitor-detector';
import { SECTION_META } from '@/lib/journey/section-meta';

// Validate RAILWAY_WORKER_URL at module load time (fires on cold start).
// If missing, logs an actionable error before any user request hits dispatch.
const workerValidation = validateWorkerUrl();
if (!workerValidation.configured) {
  console.error('[journey/stream] STARTUP WARNING:', workerValidation.message);
}

export const maxDuration = 300;

interface JourneyStreamRequest {
  activeRunId?: string | null;
  messages: UIMessage[];
  resumeState?: Record<string, unknown>;
}

function hasResearchToolActivity(
  messages: UIMessage[],
  toolName: string,
): boolean {
  return messages.some((message) => {
    if (message.role !== 'assistant') return false;

    return message.parts.some((part) => {
      if (typeof part !== 'object' || !part || !('type' in part)) {
        return false;
      }

      const typedPart = part as {
        type?: string;
        toolName?: string;
      };

      return (
        (typedPart.type === 'tool-invocation' && typedPart.toolName === toolName) ||
        (typedPart.type === `tool-${toolName}` && typedPart.toolName === toolName)
      );
    });
  });
}

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse request ───────────────────────────────────────────────────────
  let body: JourneyStreamRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return new Response(
      JSON.stringify({ error: 'messages array is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const requestMessages = body.messages as UIMessage[];

  // ── Prepare model replay messages ───────────────────────────────────────
  const modelMessages = sanitizeJourneyMessages(requestMessages);

  // ── Extract last user message for competitor detection ───────────────────────
  const lastUserMessage = requestMessages.findLast((m) => m.role === 'user');
  const lastUserText =
    lastUserMessage?.parts
      .filter(
        (p): p is { type: 'text'; text: string } =>
          typeof p === 'object' && p !== null && (p as { type: string }).type === 'text',
      )
      .map((p) => p.text)
      .join(' ') ?? '';

  // ── Persist askUser results from previous round trips ──────────────────
  const askUserFields = extractAskUserResults(requestMessages);
  if (Object.keys(askUserFields).length > 0) {
    // Fire-and-forget — do not await, do not block the response
    persistToSupabase(userId, askUserFields, body.activeRunId ?? undefined).then((result) => {
      if (!result.ok) {
        console.error('[journey/stream] askUser persist failed:', result.error);
      }
    }).catch((err) => {
      console.error('[journey/stream] askUser persist threw:', err);
    });
  }

  // ── Persist research outputs from completed tools ───────────────────────
  const researchOutputs = extractResearchOutputs(requestMessages);
  if (Object.keys(researchOutputs).length > 0) {
    persistResearchToSupabase(userId, researchOutputs, body.activeRunId ?? undefined).then((result) => {
      if (!result.ok) {
        console.error('[journey/stream] research persist failed:', result.error);
      }
    }).catch((err) => {
      console.error('[journey/stream] research persist threw:', err);
    });
  }

  // ── Build system prompt (augment with resume context if present) ────────
  let systemPrompt = LEAD_AGENT_SYSTEM_PROMPT;
  if (
    body.resumeState &&
    typeof body.resumeState === 'object' &&
    Object.keys(body.resumeState).length > 0
  ) {
    systemPrompt += buildResumeContext(body.resumeState);
  }

  // ── Prefill detection ──────────────────────────────────────────────────────
  // Detect if this is the first request and the user's message contains prefill data.
  // Prefill messages start with "Here's what I found about the company:" and are sent
  // as plain text (not askUser tool results), so parseCollectedFields won't count them.
  // We inject an explicit directive telling the agent to fire researchIndustry immediately.
  const userMessages = requestMessages.filter((m) => m.role === 'user');
  const isFirstRequest = userMessages.length === 1;
  const PREFILL_PREFIX = "Here's what I found about the company:";
  const isPrefillMessage = isFirstRequest && lastUserText.startsWith(PREFILL_PREFIX);

  // ── Derive per-request state snapshot ──────────────────────────────────────
  const journeySnap = parseCollectedFields(requestMessages);
  const marketOverviewReady = hasCompletedResearchOutput(
    requestMessages,
    'researchIndustry',
  );
  const competitorsReady = hasCompletedResearchOutput(
    requestMessages,
    'researchCompetitors',
  );
  const icpReady = hasCompletedResearchOutput(
    requestMessages,
    'researchICP',
  );
  const offerReady = hasCompletedResearchOutput(
    requestMessages,
    'researchOffer',
  );
  const approvedSections = getApprovedSections(requestMessages);
  const marketOverviewApproved = approvedSections.has('industryMarket');
  const isApprovalMessage = lastUserText.startsWith('[SECTION_APPROVED');
  const isSectionFeedbackMessage = lastUserText.startsWith('[SECTION_FEEDBACK:');
  const latestApprovedSection = getLatestApprovedSection(requestMessages);
  const latestFeedbackSection = getLatestFeedbackSection(requestMessages);
  const pendingReviewSection = getPendingReviewSection(requestMessages);
  const suppressDuplicatePostApprovalReplay = shouldSuppressDuplicatePostApprovalReplay(
    requestMessages,
  );
  const postApprovalPlan = getPostApprovalPlan(journeySnap);
  const postCompetitorPlan = getPostCompetitorPlan(journeySnap);
  const competitorResearchStarted = hasResearchToolActivity(
    requestMessages,
    'researchCompetitors',
  );
  const icpResearchStarted = hasResearchToolActivity(
    requestMessages,
    'researchICP',
  );
  const offerResearchStarted = hasResearchToolActivity(
    requestMessages,
    'researchOffer',
  );
  const synthesisStarted = hasResearchToolActivity(
    requestMessages,
    'synthesizeResearch',
  );
  const keywordResearchStarted = hasResearchToolActivity(
    requestMessages,
    'researchKeywords',
  );
  const mediaPlanStarted = hasResearchToolActivity(
    requestMessages,
    'researchMediaPlan',
  );
  const allCoreResearchComplete =
    marketOverviewReady && competitorsReady && icpReady && offerReady;
  const downstreamPlan = getDownstreamResearchPlan({
    synthesisStarted,
    synthesisComplete: journeySnap.synthComplete,
    keywordResearchStarted,
    keywordResearchComplete: journeySnap.keywordResearchComplete,
    mediaPlanStarted,
    mediaPlanComplete: journeySnap.mediaPlanComplete,
  });

  // Stage 2: competitor detection — inject instruction if new competitor found
  const competitorDetection = lastUserText
    ? detectCompetitorMentions(lastUserText)
    : null;

  const competitorAlreadyCalled =
    competitorDetection !== null &&
    journeySnap.competitorFastHitsCalledFor.has(competitorDetection.domain);

  if (
    competitorDetection !== null &&
    !competitorAlreadyCalled &&
    !isPrefillMessage
  ) {
    const domainLabel = competitorDetection.inferredDomain
      ? `${competitorDetection.domain} (inferred from "${competitorDetection.rawMention}")`
      : competitorDetection.domain;

    const postCompetitorInstruction =
      marketOverviewApproved && !journeySnap.synthComplete
        ? approvedSections.has('competitors')
          ? 'After the tool completes, briefly acknowledge the finding, then continue the current Journey step. Do NOT dispatch any additional research from this response.'
          : postCompetitorPlan.nextField === 'productDescription'
            ? 'After the tool completes, briefly acknowledge the finding, explain that competitor context is now locked, then ask exactly one focused follow-up about what the client actually buys from them. Do NOT ask about ICP or pricing in the same response and do NOT dispatch the downstream research batch.'
          : postCompetitorPlan.nextField === 'pricingContext'
            ? 'After the tool completes, briefly acknowledge the finding, explain that competitor context is now locked, then ask exactly one focused follow-up about pricing or budget. Do NOT ask about ICP in the same response and do NOT dispatch the downstream research batch.'
            : 'After the tool completes, briefly acknowledge the finding, explain that competitor context is now locked, then ask exactly one focused follow-up about the best-fit customer / ICP. Do NOT ask about pricing in the same response and do NOT dispatch the downstream research batch.'
        : 'After the tool completes, briefly acknowledge the finding (1-2 sentences) then continue with the next onboarding question.';

    systemPrompt += `\n\n## Stage 2 Directive (this request only)\n\nThe user's latest message contains a competitor reference: **${competitorDetection.rawMention}**. Extracted domain: \`${competitorDetection.domain}\` ${competitorDetection.inferredDomain ? '(inferred — verify if incorrect)' : ''}.\n\nIMPORTANTLY: Call \`competitorFastHits\` with \`competitorUrl: "${competitorDetection.domain}"\` as your FIRST action in this response — before writing any text.\n\n${postCompetitorInstruction}\n\nDomain used: ${domainLabel}.`;
  }

  // Strategist Mode guard: unlock after synthesis and keyword intel complete
  if (journeySnap.strategistModeReady) {
    systemPrompt += `\n\n## Strategist Mode (enforced)\n\nThe full downstream research sequence is complete. You are now in Strategist Mode. ABSOLUTE RULES:\n- Do NOT call \`askUser\` to collect more onboarding fields. The onboarding phase is over.\n- Do NOT call any research tools again — all research has been dispatched.\n- Respond to the user's strategic questions with specific, opinionated recommendations.\n- If the user asks a question that requires data you don't have, acknowledge the gap and give your best take based on what was collected.`;
  }

  // Prefill research trigger: when user accepted prefill data, inject explicit instruction
  // to fire researchIndustry immediately. Bifurcated: first call vs already-dispatched.
  if (isPrefillMessage) {
    // Check if researchIndustry has already been dispatched in this conversation
    const industryAlreadyCalled = requestMessages.some((m) =>
      m.role === 'assistant' &&
      m.parts.some((p) => {
        const part = p as Record<string, unknown>;
        return (
          (part.type === 'tool-invocation' && part.toolName === 'researchIndustry') ||
          (typeof part.type === 'string' && part.type === 'tool-researchIndustry')
        );
      })
    );

    if (industryAlreadyCalled) {
      // Auto-send loop fired after tool returned { status: 'queued' } — research is still running
      systemPrompt += `\n\n## Research Running Directive (this request only)

researchIndustry has been dispatched and is running asynchronously. The user will see results appear in the artifact panel automatically.

YOUR ONLY RESPONSE: "Research is underway — your market overview will appear in the panel shortly."

Then STOP. Do NOT:
- Ask any questions
- Continue the onboarding
- Call any tools
- Suggest next steps
- Add commentary

Just acknowledge research is running and end your response.`;
    } else {
      systemPrompt += `\n\n## Prefill Research Directive (this request only)

The user's message contains structured prefill data that was reviewed and accepted through the UI. ALL prefill fields are confirmed — do NOT re-ask or re-confirm any of them.

ACTION REQUIRED: Call \`researchIndustry\` as your FIRST action in this response. The prefill data provides businessModel and industry context — that is sufficient to trigger industry research. Pass the relevant context from the prefill fields.

After calling researchIndustry:
1. Say "Building your market overview now." and nothing else
2. STOP. Do NOT add preliminary analysis, strategic observations, or next-step commentary
3. Do NOT ask the user any questions while research is running
4. Wait for the research results to arrive before continuing

The user will review research results in an artifact panel and click "Looks Good" when satisfied. When you receive their approval message, acknowledge briefly and tell them you're preparing the next section.`;
    }
  }

  if (
    pendingReviewSection &&
    !isApprovalMessage &&
    !isSectionFeedbackMessage &&
    !isPrefillMessage &&
    !journeySnap.strategistModeReady
  ) {
    const sectionLabel = SECTION_META[pendingReviewSection]?.label ?? pendingReviewSection;
    const lowerLabel = sectionLabel.toLowerCase();

    systemPrompt += `\n\n## Artifact Review Gate (this request only)

The ${sectionLabel} research result already exists in the conversation and is visible in the artifact panel. The user has NOT approved it yet.

YOUR ONLY RESPONSE:
- Tell the user their ${lowerLabel} is ready in the artifact panel
- Ask them to review it and click "Looks Good" if it is accurate, or tell you what should change
- STOP after that

Do NOT:
- Ask the next onboarding question
- Launch the next research section
- Call any tools
- Offer a strategic summary yet`;
  }

  if (isSectionFeedbackMessage && !journeySnap.strategistModeReady) {
    const feedbackSection = latestFeedbackSection ?? pendingReviewSection ?? 'industryMarket';
    const sectionLabel = SECTION_META[feedbackSection]?.label ?? feedbackSection;

    systemPrompt += `\n\n## Section Feedback Directive (this request only)

The user's latest message is feedback on the ${sectionLabel} artifact. Keep the Journey anchored on that section until it is approved.

YOUR RESPONSE MUST:
- Acknowledge the requested correction or refinement
- Ask one focused follow-up question if the change request is ambiguous, otherwise state how you'll adjust the section
- Keep the conversation on the ${sectionLabel} only

DO NOT:
- Continue the broader onboarding flow yet
- Move on to the next research section
- Act like the section is already approved
- Launch downstream research`;
  }

  if (suppressDuplicatePostApprovalReplay) {
    systemPrompt += `\n\n## Hidden Wake-Up Guard (this request only)

The latest user message is a hidden control wake-up that arrived after a section approval was already acknowledged. No new section transition has happened since that approval.

DO NOT:
- repeat the prior "locked in" acknowledgement
- re-emit the same post-approval handoff text
- act like a fresh approval just happened`;
  }

  // Approval handling: when user approves a section via the artifact panel button
  if (isApprovalMessage && latestApprovedSection && !journeySnap.strategistModeReady) {
    if (latestApprovedSection === 'industryMarket') {
      const missingInputs = postApprovalPlan.missingInputs.join(', ');
      const nextQuestionDirective =
        postApprovalPlan.nextWaveReady
          ? competitorResearchStarted
            ? 'Competitor Intel is already running. Briefly acknowledge that the market overview is locked, tell the user Competitor Intel is now underway, and STOP.'
            : 'Competitor Intel is next. Call `researchCompetitors` as your FIRST action in this response. After calling it, say "Market overview locked in. I\'m launching Competitor Intel now so you can review the competitive landscape next." Then STOP.'
          : postApprovalPlan.nextField === 'topCompetitors'
            ? 'After the acknowledgement, explain that Competitor Intel is the next required section, then ask for the top 2-3 competitors they run into most.'
            : postApprovalPlan.nextField === 'productDescription'
              ? 'After the acknowledgement, explain that the next sections depend on a clear offer definition, then ask what the client actually buys from them.'
            : postApprovalPlan.nextField === 'primaryIcpDescription'
              ? 'After the acknowledgement, explain that the next section depends on a sharper ICP, then ask who their best customers are in the user\'s own words.'
              : 'After the acknowledgement, explain that Offer Analysis depends on pricing context, then ask for pricing tiers or monthly ad budget.';

      systemPrompt += `\n\n## Section Approved Directive (this request only)

The user has approved the Market Overview artifact.

YOUR RESPONSE MUST:
- Start with a brief acknowledgement (for example: "Market overview locked in.")
- Explain that Journey is now moving section-by-section through Competitor Intel, ICP Validation, and Offer Analysis
- Keep the handoff intentional and specific

Current missing inputs before the next section can launch: ${missingInputs || 'none'}.

${nextQuestionDirective}`;
    } else if (latestApprovedSection === 'competitors') {
      const nextDirective = icpResearchStarted
        ? 'ICP Validation is already running. Briefly acknowledge that it is underway and STOP.'
        : 'Call `researchICP` as your FIRST action in this response. After calling it, say "Competitor intel is locked. I’m launching ICP Validation next so we can pressure-test who we should target." Then STOP.';

      systemPrompt += `\n\n## Section Approved Directive (this request only)

The user has approved the Competitor Intel artifact.

YOUR RESPONSE MUST:
- Start with a brief acknowledgement (for example: "Competitor intel locked in.")
- Explain that ICP Validation is the next section in the Journey

${nextDirective}`;
    } else if (latestApprovedSection === 'icpValidation') {
      const nextDirective = offerResearchStarted
        ? 'Offer Analysis is already running. Briefly acknowledge that it is underway and STOP.'
        : 'Call `researchOffer` as your FIRST action in this response. After calling it, say "ICP validation is locked. I’m launching Offer Analysis next so we can pressure-test the package and pricing." Then STOP.';

      systemPrompt += `\n\n## Section Approved Directive (this request only)

The user has approved the ICP Validation artifact.

YOUR RESPONSE MUST:
- Start with a brief acknowledgement (for example: "ICP validation locked in.")
- Explain that Offer Analysis is the next section in the Journey

${nextDirective}`;
    } else if (latestApprovedSection === 'offerAnalysis') {
      const nextDirective =
        downstreamPlan.nextTool === 'synthesizeResearch'
          ? 'Call `synthesizeResearch` as your FIRST action in this response. After calling it, say "Offer analysis is locked. I’m synthesizing the full picture now, then I’ll move into keyword intelligence." Then STOP.'
          : downstreamPlan.nextTool === 'researchKeywords'
            ? 'Call `researchKeywords` as your FIRST action in this response. After calling it, say "Synthesis is locked. I’m launching keyword intelligence next so the paid-search structure is grounded in the strategy." Then STOP.'
            : downstreamPlan.strategistModeReady
              ? 'Briefly acknowledge that keyword intelligence is locked and continue in Strategist Mode.'
              : 'The downstream research sequence is already running. Briefly acknowledge that it is underway and STOP.';

      systemPrompt += `\n\n## Section Approved Directive (this request only)

The user has approved the Offer Analysis artifact.

YOUR RESPONSE MUST:
- Start with a brief acknowledgement (for example: "Offer analysis locked in.")
- Explain that the onboarding research sections are now complete and you are synthesizing the full strategy

${nextDirective}`;
    }
  }

  if (
    marketOverviewApproved &&
    !isApprovalMessage &&
    !isSectionFeedbackMessage &&
    !journeySnap.strategistModeReady &&
    !pendingReviewSection &&
    !suppressDuplicatePostApprovalReplay
  ) {
    if (!approvedSections.has('competitors')) {
      if (!postApprovalPlan.nextWaveReady) {
        const missingInputs = postApprovalPlan.missingInputs.join(', ');
        const nextStepInstruction =
          postApprovalPlan.nextField === 'topCompetitors'
            ? 'Do not dispatch Competitor Intel yet. Ask for the top 2-3 competitors first.'
            : postApprovalPlan.nextField === 'productDescription'
              ? 'Do not dispatch Competitor Intel yet. Ask what the client actually buys from them first.'
            : postApprovalPlan.nextField === 'primaryIcpDescription'
              ? 'Do not dispatch Competitor Intel yet. Ask for a sharper best-customer / ICP description first.'
              : 'Do not dispatch Competitor Intel yet. Ask for pricing tiers or monthly ad budget first.';

        systemPrompt += `\n\n## Sequential Recovery (this request only)

The Market Overview is approved, but Journey is still missing context before Competitor Intel can start.

Missing inputs: ${missingInputs || 'none'}.

${nextStepInstruction}`;
      } else if (!competitorResearchStarted) {
        systemPrompt += `\n\n## Sequential Recovery (this request only)

The Market Overview has already been approved. Competitor Intel is the next required section and has not been dispatched yet.

YOUR RESPONSE MUST:
- Say that Market Overview is locked and Competitor Intel is next
- Call \`researchCompetitors\` as your FIRST action
- After calling it, say "Market overview is locked. I’m launching Competitor Intel now so you can review it next." and STOP`;
      }
    } else if (!approvedSections.has('icpValidation') && !icpResearchStarted) {
      systemPrompt += `\n\n## Sequential Recovery (this request only)

Competitor Intel has already been approved. ICP Validation is the next required section and has not been dispatched yet.

YOUR RESPONSE MUST:
- Say that Competitor Intel is locked and ICP Validation is next
- Call \`researchICP\` as your FIRST action
- After calling it, say "Competitor intel is locked. I’m launching ICP Validation next." and STOP`;
    } else if (!approvedSections.has('offerAnalysis') && !offerResearchStarted) {
      systemPrompt += `\n\n## Sequential Recovery (this request only)

ICP Validation has already been approved. Offer Analysis is the next required section and has not been dispatched yet.

YOUR RESPONSE MUST:
- Say that ICP Validation is locked and Offer Analysis is next
- Call \`researchOffer\` as your FIRST action
- After calling it, say "ICP validation is locked. I’m launching Offer Analysis next." and STOP`;
    } else if (
      approvedSections.has('offerAnalysis') &&
      allCoreResearchComplete &&
      downstreamPlan.nextTool === 'synthesizeResearch'
    ) {
      systemPrompt += `\n\n## Sequential Recovery (this request only)

All onboarding research sections have been completed and approved. Strategic synthesis has not been dispatched yet.

YOUR RESPONSE MUST:
- Say that the onboarding research sections are locked and you are synthesizing the full picture
- Call \`synthesizeResearch\` as your FIRST action
- After calling it, say "All core sections are locked. I’m synthesizing the strategy now, then I’ll move into keyword intelligence." and STOP`;
    } else if (downstreamPlan.nextTool === 'researchKeywords') {
      systemPrompt += `\n\n## Sequential Recovery (this request only)

Strategic synthesis is complete, but Keyword Intelligence has not been dispatched yet.

YOUR RESPONSE MUST:
- Say that the strategic synthesis is locked and keyword intelligence is next
- Call \`researchKeywords\` as your FIRST action
- After calling it, say "Strategy synthesis is locked. I’m launching keyword intelligence now so the paid-search structure is grounded in the strategy." and STOP`;
    }
  }

  // ── Stream ──────────────────────────────────────────────────────────────
  const result = streamText({
    model: anthropic(MODELS.CLAUDE_OPUS),
    system: systemPrompt,
    messages: await convertToModelMessages(modelMessages),
    experimental_context: {
      activeRunId: body.activeRunId ?? null,
    },
    maxRetries: 0,
    tools: {
      askUser,
      competitorFastHits,
      scrapeClientSite,
      researchIndustry,
      researchCompetitors,
      researchICP,
      researchOffer,
      synthesizeResearch,
      researchKeywords,
      updateField: {
        description:
          'Update a specific onboarding field in the user\'s session. Call this when the user approves a recommended improvement to their business data (value prop, pricing, ICP description, etc.). Only call after the user explicitly confirms the change.',
        inputSchema: updateFieldInputSchema,
        execute: async ({ key, value, reason }: { key: string; value: string; reason: string }) => {
          const result = await persistToSupabase(
            userId,
            { [key]: value },
            body.activeRunId ?? undefined,
          );
          if (!result.ok) {
            return { updated: false, error: result.error ?? 'Failed to update field' };
          }
          return { updated: true, key, value, reason };
        },
      },
    },
    stopWhen: stepCountIs(25),
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 5000 },
      },
    },
    onFinish: async ({ usage, steps }) => {
      console.log('[journey] stream finished', {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        steps: steps.length,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
