// PROTOTYPE — throwaway. Shape of ./fixture.json: the frozen real run
// db41a945 used to replay the agent-at-work UI deterministically (no live
// API cost). Delete when the live-run rebuild lands.

export interface FixtureEventPayload {
  type?: string;
  message?: string;
  metadata?: {
    reason?: string;
    query?: string;
    toolName?: string;
    issues?: unknown;
    subSectionKey?: string;
    skillSlug?: string;
    durationMs?: number;
    attempt?: number;
    sectionId?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface FixtureEvent {
  id: string;
  zone: string;
  message: string | null;
  payload: FixtureEventPayload | null;
  createdAt: string;
  eventType: string;
}

export interface FixtureVerification {
  verifiedCount?: number;
  unsupportedCount?: number;
  claims?: unknown[];
}

export interface FixtureArtifactData {
  id?: string;
  sectionId?: string;
  sectionTitle?: string;
  verdict?: string;
  statusSummary?: string;
  confidence?: string | number;
  sources?: Array<{ url?: string; title?: string } & Record<string, unknown>>;
  verification?: FixtureVerification;
  body?: Record<string, unknown>;
  createdAt?: string;
}

export interface FixtureSection {
  zone: string;
  title: string | null;
  status: string | null;
  revision: number;
  sources: unknown;
  claims: unknown;
  data: FixtureArtifactData | null;
}

export interface Fixture {
  runId: string;
  meta: {
    parentStatus: string | null;
    childrenComplete: number;
    childrenTotal: number;
    createdAt: string;
    updatedAt: string;
  };
  events: FixtureEvent[];
  sections: FixtureSection[];
}
