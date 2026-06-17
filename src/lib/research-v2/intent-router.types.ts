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
  /**
   * Bounded slice of the section's actual key-finding sentences
   * (body.keyFindings[].finding / .sentence) so the orchestrator reasons over
   * real content, not just titles. Char-budgeted by the chat route.
   */
  keyFindingSentences?: string[];
  /** Bounded slice of the section's cited source URLs. */
  sourceUrls?: string[];
}

export interface ChatMessageForRouter {
  role: 'user' | 'assistant';
  content: string;
}
