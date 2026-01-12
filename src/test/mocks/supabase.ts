/**
 * Mock Supabase Client for Testing
 *
 * Provides a mock implementation of Supabase client with:
 * - Query builder pattern (from().select().insert() etc.)
 * - Auth mocks (getUser, getSession, signIn, signOut)
 * - RPC function mocks
 * - Data factories for common entities
 * - Error simulation
 */

import { vi } from "vitest";
import type { User, Session, AuthError } from "@supabase/supabase-js";

// =============================================================================
// Types
// =============================================================================

export interface MockSupabaseConfig {
  /** Default user for auth.getUser() */
  defaultUser?: Partial<User> | null;
  /** Default session for auth.getSession() */
  defaultSession?: Partial<Session> | null;
  /** Simulate auth error */
  authError?: { code: string; message: string };
  /** Simulate query error on all operations */
  queryError?: { code: string; message: string };
}

export interface MockQueryResult<T = unknown> {
  data: T | null;
  error: { code: string; message: string } | null;
  count?: number;
  status?: number;
  statusText?: string;
}

export interface MockRpcCall {
  functionName: string;
  params: unknown;
  timestamp: number;
}

export interface MockQueryCall {
  table: string;
  operation: "select" | "insert" | "update" | "delete" | "upsert";
  data?: unknown;
  filters: Array<{ column: string; operator: string; value: unknown }>;
  timestamp: number;
}

// =============================================================================
// Data Factories
// =============================================================================

/**
 * Create a mock Supabase User
 */
export function createMockUser(overrides?: Partial<User>): User {
  const id = overrides?.id || crypto.randomUUID();
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: overrides?.email || `user-${id.slice(0, 8)}@test.com`,
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    role: "authenticated",
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock Supabase Session
 */
export function createMockSession(overrides?: {
  user?: Partial<User>;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
}): Session {
  const user = createMockUser(overrides?.user);
  return {
    access_token: overrides?.accessToken || "mock-access-token-" + Date.now(),
    refresh_token: overrides?.refreshToken || "mock-refresh-token-" + Date.now(),
    expires_in: overrides?.expiresIn || 3600,
    expires_at: overrides?.expiresAt || Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
}

/**
 * Create a mock blueprint row
 */
export function createMockBlueprint(overrides?: {
  id?: string;
  userId?: string;
  title?: string;
  content?: unknown;
  formData?: unknown;
  createdAt?: string;
  updatedAt?: string;
}): {
  id: string;
  user_id: string;
  title: string;
  content: unknown;
  form_data: unknown;
  created_at: string;
  updated_at: string;
} {
  const now = new Date().toISOString();
  return {
    id: overrides?.id || crypto.randomUUID(),
    user_id: overrides?.userId || crypto.randomUUID(),
    title: overrides?.title || "Test Blueprint",
    content: overrides?.content || { sections: [] },
    form_data: overrides?.formData || {},
    created_at: overrides?.createdAt || now,
    updated_at: overrides?.updatedAt || now,
  };
}

/**
 * Create a mock blueprint chunk for RAG
 */
export function createMockBlueprintChunk(overrides?: {
  id?: string;
  blueprintId?: string;
  chunkIndex?: number;
  content?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}): {
  id: string;
  blueprint_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
} {
  return {
    id: overrides?.id || crypto.randomUUID(),
    blueprint_id: overrides?.blueprintId || crypto.randomUUID(),
    chunk_index: overrides?.chunkIndex || 0,
    content: overrides?.content || "Test chunk content",
    embedding: overrides?.embedding || Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
    metadata: overrides?.metadata || { section: "test" },
  };
}

/**
 * Create a mock shared blueprint
 */
export function createMockSharedBlueprint(overrides?: {
  id?: string;
  blueprintId?: string;
  token?: string;
  viewCount?: number;
  expiresAt?: string | null;
  createdAt?: string;
}): {
  id: string;
  blueprint_id: string;
  token: string;
  view_count: number;
  expires_at: string | null;
  created_at: string;
} {
  const now = new Date().toISOString();
  return {
    id: overrides?.id || crypto.randomUUID(),
    blueprint_id: overrides?.blueprintId || crypto.randomUUID(),
    token: overrides?.token || `share-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    view_count: overrides?.viewCount || 0,
    expires_at: overrides?.expiresAt ?? null,
    created_at: overrides?.createdAt || now,
  };
}

// =============================================================================
// Error Helpers
// =============================================================================

/**
 * Create a mock Supabase error
 */
export function mockSupabaseError(
  code: string,
  message: string
): { code: string; message: string } {
  return { code, message };
}

/**
 * Common Supabase error codes
 */
export const SUPABASE_ERRORS = {
  NOT_FOUND: mockSupabaseError("PGRST116", "The result contains 0 rows"),
  UNAUTHORIZED: mockSupabaseError("42501", "permission denied"),
  UNIQUE_VIOLATION: mockSupabaseError("23505", "duplicate key value violates unique constraint"),
  FOREIGN_KEY_VIOLATION: mockSupabaseError("23503", "foreign key constraint violation"),
  INVALID_INPUT: mockSupabaseError("22P02", "invalid input syntax"),
  RATE_LIMIT: mockSupabaseError("429", "rate limit exceeded"),
};

// =============================================================================
// Mock Query Builder
// =============================================================================

/**
 * Creates a chainable mock query builder that mimics Supabase's query builder pattern.
 */
function createMockQueryBuilder<T = unknown>(
  table: string,
  config: MockSupabaseConfig,
  callRecorder: (call: MockQueryCall) => void,
  responseQueue: Map<string, MockQueryResult<T>[]>
) {
  let operation: MockQueryCall["operation"] = "select";
  let operationData: unknown;
  const filters: MockQueryCall["filters"] = [];
  let limitCount: number | undefined;
  let singleRow = false;
  let maybeSingleRow = false;

  const getQueueKey = () => `${table}:${operation}`;

  const executeQuery = (): MockQueryResult<T> => {
    // Record the call
    callRecorder({
      table,
      operation,
      data: operationData,
      filters,
      timestamp: Date.now(),
    });

    // Check for configured error
    if (config.queryError) {
      return {
        data: null,
        error: config.queryError,
        status: 500,
        statusText: "Internal Server Error",
      };
    }

    // Check response queue
    const queueKey = getQueueKey();
    const queue = responseQueue.get(queueKey);
    if (queue && queue.length > 0) {
      const response = queue.shift()!;
      // Handle single() - return single item or error
      if (singleRow && Array.isArray(response.data)) {
        if (response.data.length === 0) {
          return {
            data: null,
            error: SUPABASE_ERRORS.NOT_FOUND,
            status: 406,
            statusText: "Not Acceptable",
          };
        }
        if (response.data.length > 1) {
          return {
            data: null,
            error: mockSupabaseError("PGRST116", "Multiple rows returned"),
            status: 406,
            statusText: "Not Acceptable",
          };
        }
        return {
          data: response.data[0] as T,
          error: null,
          status: 200,
          statusText: "OK",
        };
      }
      // Handle maybeSingle() - return single item or null
      if (maybeSingleRow && Array.isArray(response.data)) {
        return {
          data: (response.data[0] || null) as T,
          error: null,
          status: 200,
          statusText: "OK",
        };
      }
      return response;
    }

    // Default empty response
    const emptyData = operation === "select" ? ([] as T) : (null as T);
    return {
      data: emptyData,
      error: null,
      status: 200,
      statusText: "OK",
    };
  };

  const builder = {
    // Query operations
    select: (columns?: string) => {
      operation = "select";
      operationData = columns;
      return builder;
    },

    insert: (data: unknown) => {
      operation = "insert";
      operationData = data;
      return builder;
    },

    update: (data: unknown) => {
      operation = "update";
      operationData = data;
      return builder;
    },

    upsert: (data: unknown) => {
      operation = "upsert";
      operationData = data;
      return builder;
    },

    delete: () => {
      operation = "delete";
      return builder;
    },

    // Filters
    eq: (column: string, value: unknown) => {
      filters.push({ column, operator: "eq", value });
      return builder;
    },

    neq: (column: string, value: unknown) => {
      filters.push({ column, operator: "neq", value });
      return builder;
    },

    gt: (column: string, value: unknown) => {
      filters.push({ column, operator: "gt", value });
      return builder;
    },

    gte: (column: string, value: unknown) => {
      filters.push({ column, operator: "gte", value });
      return builder;
    },

    lt: (column: string, value: unknown) => {
      filters.push({ column, operator: "lt", value });
      return builder;
    },

    lte: (column: string, value: unknown) => {
      filters.push({ column, operator: "lte", value });
      return builder;
    },

    like: (column: string, pattern: string) => {
      filters.push({ column, operator: "like", value: pattern });
      return builder;
    },

    ilike: (column: string, pattern: string) => {
      filters.push({ column, operator: "ilike", value: pattern });
      return builder;
    },

    in: (column: string, values: unknown[]) => {
      filters.push({ column, operator: "in", value: values });
      return builder;
    },

    contains: (column: string, value: unknown) => {
      filters.push({ column, operator: "contains", value });
      return builder;
    },

    containedBy: (column: string, value: unknown) => {
      filters.push({ column, operator: "containedBy", value });
      return builder;
    },

    is: (column: string, value: unknown) => {
      filters.push({ column, operator: "is", value });
      return builder;
    },

    // Modifiers
    order: (_column: string, _options?: { ascending?: boolean }) => builder,
    limit: (count: number) => {
      limitCount = count;
      return builder;
    },
    range: (_from: number, _to: number) => builder,

    single: () => {
      singleRow = true;
      return builder;
    },

    maybeSingle: () => {
      maybeSingleRow = true;
      return builder;
    },

    // Execute - returns a promise
    then: <TResult1 = MockQueryResult<T>, TResult2 = never>(
      onfulfilled?: ((value: MockQueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> => {
      const result = executeQuery();
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };

  return builder;
}

// =============================================================================
// Mock Supabase Client
// =============================================================================

export class MockSupabaseClient {
  private config: MockSupabaseConfig;

  // Call history
  public queryCalls: MockQueryCall[] = [];
  public rpcCalls: MockRpcCall[] = [];
  public authCalls: Array<{ method: string; args: unknown[]; timestamp: number }> = [];

  // Response queues (keyed by "table:operation" or "rpc:functionName")
  private queryResponseQueue = new Map<string, MockQueryResult[]>();
  private rpcResponseQueue = new Map<string, MockQueryResult[]>();

  constructor(config: MockSupabaseConfig = {}) {
    this.config = config;
  }

  /**
   * Queue a response for a query operation
   * @param table - Table name
   * @param operation - Operation type (select, insert, update, delete, upsert)
   * @param response - Response to return
   */
  queueQueryResponse<T>(
    table: string,
    operation: MockQueryCall["operation"],
    response: MockQueryResult<T>
  ): void {
    const key = `${table}:${operation}`;
    if (!this.queryResponseQueue.has(key)) {
      this.queryResponseQueue.set(key, []);
    }
    this.queryResponseQueue.get(key)!.push(response as MockQueryResult);
  }

  /**
   * Queue a response for an RPC call
   */
  queueRpcResponse<T>(functionName: string, response: MockQueryResult<T>): void {
    const key = `rpc:${functionName}`;
    if (!this.rpcResponseQueue.has(key)) {
      this.rpcResponseQueue.set(key, []);
    }
    this.rpcResponseQueue.get(key)!.push(response as MockQueryResult);
  }

  /**
   * Reset all call history and queued responses
   */
  reset(): void {
    this.queryCalls = [];
    this.rpcCalls = [];
    this.authCalls = [];
    this.queryResponseQueue.clear();
    this.rpcResponseQueue.clear();
  }

  /**
   * Get query calls for a specific table
   */
  getQueryCalls(table?: string): MockQueryCall[] {
    if (!table) return this.queryCalls;
    return this.queryCalls.filter((c) => c.table === table);
  }

  /**
   * Get RPC calls for a specific function
   */
  getRpcCalls(functionName?: string): MockRpcCall[] {
    if (!functionName) return this.rpcCalls;
    return this.rpcCalls.filter((c) => c.functionName === functionName);
  }

  /**
   * Table query builder - from()
   */
  from<T = unknown>(table: string) {
    return createMockQueryBuilder<T>(
      table,
      this.config,
      (call) => this.queryCalls.push(call),
      this.queryResponseQueue as Map<string, MockQueryResult<T>[]>
    );
  }

  /**
   * RPC function call
   */
  rpc<T = unknown>(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<MockQueryResult<T>> {
    // Record the call
    this.rpcCalls.push({
      functionName,
      params,
      timestamp: Date.now(),
    });

    // Check for configured error
    if (this.config.queryError) {
      return Promise.resolve({
        data: null,
        error: this.config.queryError,
      });
    }

    // Check response queue
    const key = `rpc:${functionName}`;
    const queue = this.rpcResponseQueue.get(key);
    if (queue && queue.length > 0) {
      return Promise.resolve(queue.shift() as MockQueryResult<T>);
    }

    // Default empty response
    return Promise.resolve({
      data: null as T,
      error: null,
    });
  }

  /**
   * Auth methods
   */
  get auth() {
    const recordAuthCall = (method: string, args: unknown[]) => {
      this.authCalls.push({ method, args, timestamp: Date.now() });
    };

    return {
      getUser: async () => {
        recordAuthCall("getUser", []);

        if (this.config.authError) {
          return {
            data: { user: null },
            error: this.config.authError as AuthError,
          };
        }

        if (this.config.defaultUser === null) {
          return {
            data: { user: null },
            error: null,
          };
        }

        return {
          data: { user: createMockUser(this.config.defaultUser) },
          error: null,
        };
      },

      getSession: async () => {
        recordAuthCall("getSession", []);

        if (this.config.authError) {
          return {
            data: { session: null },
            error: this.config.authError as AuthError,
          };
        }

        if (this.config.defaultSession === null) {
          return {
            data: { session: null },
            error: null,
          };
        }

        const user = this.config.defaultUser
          ? createMockUser(this.config.defaultUser)
          : undefined;
        return {
          data: {
            session: createMockSession({
              user,
              ...this.config.defaultSession,
            }),
          },
          error: null,
        };
      },

      signInWithPassword: async (credentials: { email: string; password: string }) => {
        recordAuthCall("signInWithPassword", [credentials]);

        if (this.config.authError) {
          return {
            data: { user: null, session: null },
            error: this.config.authError as AuthError,
          };
        }

        const user = createMockUser({ email: credentials.email });
        const session = createMockSession({ user });
        return {
          data: { user, session },
          error: null,
        };
      },

      signInWithOAuth: async (options: { provider: string; options?: unknown }) => {
        recordAuthCall("signInWithOAuth", [options]);

        if (this.config.authError) {
          return {
            data: { provider: options.provider, url: null },
            error: this.config.authError as AuthError,
          };
        }

        return {
          data: {
            provider: options.provider,
            url: `https://auth.example.com/${options.provider}`,
          },
          error: null,
        };
      },

      signUp: async (credentials: { email: string; password: string }) => {
        recordAuthCall("signUp", [credentials]);

        if (this.config.authError) {
          return {
            data: { user: null, session: null },
            error: this.config.authError as AuthError,
          };
        }

        const user = createMockUser({ email: credentials.email });
        return {
          data: { user, session: null },
          error: null,
        };
      },

      signOut: async () => {
        recordAuthCall("signOut", []);

        if (this.config.authError) {
          return { error: this.config.authError as AuthError };
        }

        return { error: null };
      },

      exchangeCodeForSession: async (code: string) => {
        recordAuthCall("exchangeCodeForSession", [code]);

        if (this.config.authError) {
          return {
            data: { user: null, session: null },
            error: this.config.authError as AuthError,
          };
        }

        const user = createMockUser();
        const session = createMockSession({ user });
        return {
          data: { user, session },
          error: null,
        };
      },

      onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        recordAuthCall("onAuthStateChange", [callback]);
        // Return unsubscribe function
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      },
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient(
  config?: MockSupabaseConfig
): MockSupabaseClient {
  return new MockSupabaseClient(config);
}

/**
 * Create vi.fn() mocks for Supabase client modules
 * Use with vi.mock() to replace actual imports
 */
export function createSupabaseClientMock(config?: MockSupabaseConfig) {
  const mockClient = new MockSupabaseClient(config);
  return {
    createClient: vi.fn(() => mockClient),
    createBrowserClient: vi.fn(() => mockClient),
    createServerClient: vi.fn(() => mockClient),
    // Expose the mock instance for test assertions
    __mockInstance: mockClient,
  };
}
