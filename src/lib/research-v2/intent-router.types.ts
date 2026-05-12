export type IntentKind = 'rerun' | 'patch' | 'converse';

export interface IntentPatch {
  path: string;
  value: unknown;
}

export interface IntentResult {
  kind: IntentKind;
  target_section: string | null;
  instruction: string;
  patch: IntentPatch | null;
}

export interface IntentRouterInput {
  userMessage: string;
  auditContext: AuditContextSummary;
  chatHistory: ChatMessageForRouter[];
}

export interface AuditContextSummary {
  runId: string;
  sections: SectionSummary[];
}

export interface SectionSummary {
  sectionId: string;
  title: string;
  statusSummary: string;
  keyFindingTitles: string[];
}

export interface ChatMessageForRouter {
  role: 'user' | 'assistant';
  content: string;
}
