// Raw-HTTP Managed Agents client.
//
// The installed @anthropic-ai/sdk version (0.78.0) does not expose Managed
// Agents resources (environments, agents, sessions, events). All previous
// canaries used raw HTTP for this reason — see scripts/managed-agents-*.
//
// This module centralizes the headers, base URL, error handling, and event
// envelope construction so the webhook handler, kickoff helper, and tests
// share one shape.

const ANTHROPIC_API_BASE_URL =
  process.env.ANTHROPIC_API_BASE_URL?.trim() || 'https://api.anthropic.com/v1';

const ANTHROPIC_VERSION = '2023-06-01';

export const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';
export const SKILLS_BETA = 'skills-2025-10-02';
const COMBINED_BETA_HEADER = `${MANAGED_AGENTS_BETA},${SKILLS_BETA}`;

const DEFAULT_TIMEOUT_MS = 60_000;

export class ManagedAgentsApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'ManagedAgentsApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ManagedAgentsClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  defaultTimeoutMs?: number;
}

export interface ManagedAgentsRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /**
   * When true, sends only the skills-API beta header (skills inspection
   * uses a different beta header from managed-agents resources).
   */
  skillsOnly?: boolean;
}

export class ManagedAgentsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;

  constructor(options: ManagedAgentsClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    if (!apiKey) {
      throw new Error('ManagedAgentsClient requires ANTHROPIC_API_KEY');
    }
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? ANTHROPIC_API_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private headers(skillsOnly: boolean): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': skillsOnly ? SKILLS_BETA : COMBINED_BETA_HEADER,
      'X-Api-Key': this.apiKey,
    };
  }

  async request<T = unknown>(
    path: string,
    options: ManagedAgentsRequestOptions = {},
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const signal = options.signal ?? controller.signal;

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(options.skillsOnly === true),
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new ManagedAgentsApiError(
          `Anthropic ${method} ${path} failed ${response.status}`,
          response.status,
          text,
        );
      }
      return (text.trim().length > 0 ? JSON.parse(text) : {}) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ------------------------------------------------------------------------
  // Convenience wrappers for the calls the webhook + kickoff helper need.
  // ------------------------------------------------------------------------

  /**
   * Fetch a single event resource by id. Phase 1 / R3: webhook deliveries
   * carry only the event id; the full payload must be fetched after
   * signature verification.
   */
  async getSessionEvent<T = ManagedAgentsEvent>(
    sessionId: string,
    eventId: string,
  ): Promise<T> {
    return this.request<T>(`/sessions/${sessionId}/events/${eventId}`);
  }

  async listSessionEvents<T = ManagedAgentsEvent>(
    sessionId: string,
    options: { order?: 'asc' | 'desc'; limit?: number } = {},
  ): Promise<ManagedAgentsListResponse<T>> {
    const params = new URLSearchParams();
    params.set('order', options.order ?? 'asc');
    params.set('limit', String(options.limit ?? 200));
    return this.request<ManagedAgentsListResponse<T>>(
      `/sessions/${sessionId}/events?${params.toString()}`,
    );
  }

  async getSession<T = ManagedAgentsSessionResource>(sessionId: string): Promise<T> {
    return this.request<T>(`/sessions/${sessionId}`);
  }

  async sendEvents(sessionId: string, events: ManagedAgentsEventInput[]): Promise<unknown> {
    return this.request(`/sessions/${sessionId}/events`, {
      method: 'POST',
      body: { events },
    });
  }

  /**
   * Sends a successful custom-tool result back to the agent. R-rule note:
   * custom-tool _business_ failures still go through this method with
   * { ok: false, repair_feedback: ... } in the result; only transport
   * failures set isTransportError=true.
   */
  async sendCustomToolResult(
    sessionId: string,
    args: {
      customToolUseId: string;
      sessionThreadId?: string | null;
      result: unknown;
      isTransportError?: boolean;
    },
  ): Promise<unknown> {
    const event: ManagedAgentsEventInput = {
      type: 'user.custom_tool_result',
      custom_tool_use_id: args.customToolUseId,
      content: [{ type: 'text', text: JSON.stringify(args.result) }],
    };
    if (args.sessionThreadId) {
      event.session_thread_id = args.sessionThreadId;
    }
    if (args.isTransportError) {
      event.is_error = true;
    }
    return this.sendEvents(sessionId, [event]);
  }

  /**
   * Posts user.interrupt to a session thread. R5 mitigation: invoked when
   * a section run exceeds the custom-tool retry ceiling so the agent
   * doesn't keep looping at our expense.
   */
  async interruptThread(
    sessionId: string,
    sessionThreadId: string,
    reason: string,
  ): Promise<unknown> {
    const event: ManagedAgentsEventInput = {
      type: 'user.interrupt',
      session_thread_id: sessionThreadId,
      content: [{ type: 'text', text: reason }],
    };
    return this.sendEvents(sessionId, [event]);
  }
}

// ----------------------------------------------------------------------------
// Event envelope types — narrow shapes for the fields we depend on. The
// Managed Agents API may return additional fields; we keep this loose.
// ----------------------------------------------------------------------------

export interface ManagedAgentsListResponse<T> {
  data: T[];
  has_more?: boolean;
  first_id?: string;
  last_id?: string;
}

export interface ManagedAgentsSessionResource {
  id: string;
  status?: string;
  agent?: string;
  environment_id?: string;
  metadata?: Record<string, unknown> | null;
}

export interface ManagedAgentsEventBase {
  id: string;
  type: string;
  session_id?: string;
  session_thread_id?: string;
  created_at: string;
}

export interface ManagedAgentsCustomToolUseEvent extends ManagedAgentsEventBase {
  type: 'agent.custom_tool_use';
  name: string;
  input?: Record<string, unknown>;
}

export interface ManagedAgentsCustomToolResultEvent extends ManagedAgentsEventBase {
  type: 'user.custom_tool_result';
  custom_tool_use_id: string;
  content?: Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

export interface ManagedAgentsMessageEvent extends ManagedAgentsEventBase {
  type: 'agent.message';
  content?: Array<{ type: string; text?: string }>;
}

export interface ManagedAgentsSessionStatusEvent extends ManagedAgentsEventBase {
  type:
    | 'session.status_idle'
    | 'session.status_idled'
    | 'session.thread_status_idle';
  stop_reason?: { type?: string; event_ids?: string[] };
}

export type ManagedAgentsEvent =
  | ManagedAgentsCustomToolUseEvent
  | ManagedAgentsCustomToolResultEvent
  | ManagedAgentsMessageEvent
  | ManagedAgentsSessionStatusEvent
  | (ManagedAgentsEventBase & Record<string, unknown>);

export type ManagedAgentsEventInput = {
  type: string;
  content?: Array<{ type: string; text: string }>;
  custom_tool_use_id?: string;
  session_thread_id?: string;
  is_error?: boolean;
  [key: string]: unknown;
};
