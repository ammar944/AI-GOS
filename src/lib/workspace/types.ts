export type SectionKey =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'keywordIntel'
  | 'crossAnalysis'
  | 'mediaPlan';

export type SectionPhase =
  | 'queued'
  | 'researching'
  | 'streaming'
  | 'review'
  | 'approved'
  | 'error';

export interface CardSnapshot {
  content: Record<string, unknown>;
  editedBy: 'user' | 'ai';
  timestamp: number;
}

export interface CardState {
  id: string;
  sectionKey: SectionKey;
  cardType: string;
  label: string;
  content: Record<string, unknown>;
  status: 'draft' | 'edited' | 'approved';
  versions: CardSnapshot[];
}

export interface WorkspaceState {
  sessionId: string;
  phase: 'onboarding' | 'workspace';
  currentSection: SectionKey;
  sectionStates: Record<SectionKey, SectionPhase>;
  sectionErrors: Partial<Record<SectionKey, string>>;
  cards: Record<string, CardState>;
}
