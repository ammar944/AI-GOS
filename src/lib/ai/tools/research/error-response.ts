export interface ToolErrorResult {
  error: true;
  attempted: string;
  reason: string;
  duration: string;
  suggestion: string;
  canRetry: boolean;
}

interface ErrorOpts {
  canRetry?: boolean;
  suggestion?: string;
}

const DEFAULT_SUGGESTIONS: Record<string, string> = {
  researchIndustry:
    'Proceed with onboarding. Industry research can be retried later.',
  researchCompetitors:
    'Continue with other research. Competitor data is supplementary.',
  researchICP:
    "Use training knowledge for ICP validation. Live data enhances but isn't required.",
  researchOffer: 'Proceed with synthesis using available data.',
  synthesizeResearch:
    'Review individual research sections directly instead of synthesis.',
  researchKeywords:
    "Skip keyword intel. Core strategy doesn't depend on it.",
  researchMediaPlan:
    'Build media plan from synthesis data without live platform benchmarks.',
};

export function buildErrorResponse(
  tool: string,
  reason: string,
  durationMs: number,
  opts?: ErrorOpts,
): ToolErrorResult {
  return {
    error: true,
    attempted: tool,
    reason,
    duration: `${(durationMs / 1000).toFixed(1)}s`,
    suggestion:
      opts?.suggestion ?? DEFAULT_SUGGESTIONS[tool] ?? 'Continue with available data.',
    canRetry: opts?.canRetry ?? false,
  };
}
