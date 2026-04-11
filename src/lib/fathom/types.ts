/** Fathom API meeting object (from GET /meetings) */
export interface FathomMeeting {
  title: string;
  meeting_title: string | null;
  recording_id: number;
  url: string;
  share_url: string;
  created_at: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  recording_start_time: string;
  recording_end_time: string;
  calendar_invitees_domains_type: 'only_internal' | 'one_or_more_external';
  transcript_language: string;
  recorded_by: {
    name: string;
    email: string;
    email_domain: string;
    team: string | null;
  };
  calendar_invitees: FathomInvitee[];
  transcript: FathomTranscriptSegment[] | null;
  default_summary: { template_name: string | null; markdown_formatted: string | null } | null;
  action_items: FathomActionItem[] | null;
}

export interface FathomInvitee {
  name: string | null;
  email: string | null;
  email_domain: string | null;
  is_external: boolean;
  matched_speaker_display_name: string | null;
}

export interface FathomActionItem {
  description: string;
  user_generated: boolean;
  completed: boolean;
  recording_timestamp: string;
  recording_playback_url: string;
  assignee: { name: string; email: string; team: string | null } | null;
}

export interface FathomTranscriptSegment {
  speaker: {
    display_name: string;
    matched_calendar_invitee_email: string | null;
  };
  text: string;
  timestamp: string;
}

export interface FathomTranscriptResponse {
  transcript: FathomTranscriptSegment[];
}

export interface FathomMeetingsResponse {
  limit: number;
  next_cursor: string | null;
  items: FathomMeeting[];
}

/** Stored per-call metadata in journey_sessions.fathom_calls */
export interface FathomCallMeta {
  recordingId: number;
  shareUrl: string;
  title: string;
  date: string;
  durationSeconds: number;
  attendees: Array<{
    name: string | null;
    email: string | null;
    isExternal: boolean;
  }>;
  summary: string | null;
  actionItems: Array<{
    description: string;
    assignee?: string;
    completed: boolean;
  }>;
  documentId: string;
  status: 'fetching' | 'extracting' | 'ready' | 'error';
  error?: string;
}

/** Structured insights extracted by the worker */
export interface SalesCallInsights {
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
