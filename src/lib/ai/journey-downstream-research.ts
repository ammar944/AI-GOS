export interface DownstreamResearchState {
  synthesisStarted: boolean;
  synthesisComplete: boolean;
  keywordResearchStarted: boolean;
  keywordResearchComplete: boolean;
  mediaPlanStarted: boolean;
  mediaPlanComplete: boolean;
}

export interface DownstreamResearchPlan {
  nextTool:
    | 'synthesizeResearch'
    | 'researchKeywords'
    | null;
  strategistModeReady: boolean;
}

export function getDownstreamResearchPlan(
  state: DownstreamResearchState,
): DownstreamResearchPlan {
  if (!state.synthesisComplete) {
    return {
      nextTool: state.synthesisStarted ? null : 'synthesizeResearch',
      strategistModeReady: false,
    };
  }

  if (!state.keywordResearchComplete) {
    return {
      nextTool: state.keywordResearchStarted ? null : 'researchKeywords',
      strategistModeReady: false,
    };
  }

  return {
    nextTool: null,
    strategistModeReady: true,
  };
}
