export interface ResearchCardCommonProps {
  status: 'streaming' | 'complete' | 'error';
  streamingText?: string;
  data?: Record<string, unknown>;
  citations?: Array<{ number: number; url: string; title?: string }>;
  error?: string;
}
