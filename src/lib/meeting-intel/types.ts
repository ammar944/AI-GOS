/** Meeting type categories */
export type MeetingType =
  | 'discovery'
  | 'demo'
  | 'follow_up'
  | 'closing'
  | 'strategy'
  | 'kickoff'
  | 'review'
  | 'other';

/** Stored per-meeting metadata in journey_sessions.meeting_transcripts */
export interface MeetingMeta {
  id: string;
  title: string;
  meetingType: MeetingType;
  transcriptLength: number;
  documentId: string;
  status: 'saving' | 'extracting' | 'ready' | 'error';
  error?: string;
  dateAdded: string;
}

/** Local-only meeting held in React state during onboarding (before runId exists) */
export interface PendingMeeting {
  id: string;
  title: string;
  meetingType: MeetingType;
  transcript: string;
  dateAdded: string;
}

/** Structured insights extracted by the worker from a meeting transcript */
export interface MeetingInsights {
  businessHealthSummary: string;
  callType: 'discovery' | 'demo' | 'follow_up' | 'closing' | 'other';
  painPoints: Array<{
    pain: string;
    severity: 'critical' | 'moderate' | 'minor';
    quote?: string;
  }>;
  budgetSignals: {
    mentionedSpend?: string;
    willingnessToPay?: string;
    priceSensitivity: 'low' | 'medium' | 'high';
    quotes: string[];
  };
  competitorMentions: Array<{
    name: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    context: string;
    quote?: string;
  }>;
  buyingTriggers: Array<{
    trigger: string;
    urgency: 'immediate' | 'near_term' | 'exploratory';
    quote?: string;
  }>;
  objections: Array<{
    objection: string;
    resolution?: string;
    quote?: string;
  }>;
  icpSignals: {
    companySize?: string;
    role?: string;
    industry?: string;
    decisionProcess?: string;
    decisionTimeline?: string;
  };
  currentMarketing: {
    channels: string[];
    whatWorks?: string;
    whatFails?: string;
    monthlySpend?: string;
    quotes: string[];
  };
  goalsAndOutcomes: {
    primaryGoal?: string;
    successMetrics?: string;
    desiredTransformation?: string;
    quotes: string[];
  };
  notableQuotes: Array<{
    quote: string;
    context: string;
    relevance: string;
  }>;
}
