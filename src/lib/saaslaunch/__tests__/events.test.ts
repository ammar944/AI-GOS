import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LandingSiteConfigError,
  recordLandingEvent,
} from '@/lib/saaslaunch/events';
import { LandingEventValidationError } from '@/lib/saaslaunch/event-contract';

interface QueryResult<T> {
  data: T;
  error: { message: string } | null;
}

interface QueryState {
  table: string;
  filters: Array<{ column: string; value: string | boolean }>;
  insertValue: Record<string, unknown> | null;
}

class MockQueryBuilder implements PromiseLike<QueryResult<Record<string, unknown>[] | null>> {
  constructor(
    private readonly state: QueryState,
    private readonly db: MockSupabase,
  ) {}

  select(): MockQueryBuilder {
    return this;
  }

  insert(value: Record<string, unknown>): MockQueryBuilder {
    this.state.insertValue = value;
    return this;
  }

  eq(column: string, value: string | boolean): MockQueryBuilder {
    this.state.filters.push({ column, value });
    return this;
  }

  async maybeSingle(): Promise<QueryResult<Record<string, unknown> | null>> {
    const rows = this.db.selectRows(this.state);
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<QueryResult<Record<string, unknown>>> {
    if (this.state.insertValue) {
      const row = this.db.insertRow(this.state.table, this.state.insertValue);
      return { data: row, error: null };
    }

    const rows = this.db.selectRows(this.state);
    return { data: rows[0] ?? {}, error: null };
  }

  then<TResult1 = QueryResult<Record<string, unknown>[] | null>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<Record<string, unknown>[] | null>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const result = this.state.insertValue
      ? {
          data: [this.db.insertRow(this.state.table, this.state.insertValue)],
          error: null,
        }
      : {
          data: this.db.selectRows(this.state),
          error: null,
        };

    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

class MockSupabase {
  readonly rows: Record<string, Record<string, unknown>[]>;

  constructor() {
    this.rows = {
      agency_clients: [
        {
          id: 'client-anura',
          slug: 'anura',
          display_name: 'Anura',
          status: 'active',
        },
      ],
      agency_client_sites: [
        {
          id: 'site-anura',
          client_id: 'client-anura',
          slug: 'try-anura',
          display_name: 'Try Anura',
          live_url: 'https://try.anura.io',
          allowed_origins: ['https://try.anura.io'],
          tracker_status: 'planned',
        },
      ],
      landing_event_definitions: [
        {
          id: 'event-cta',
          site_id: 'site-anura',
          event_key: 'cta_clicked',
          is_active: true,
        },
      ],
      landing_event_property_definitions: [
        {
          event_definition_id: 'event-cta',
          property_key: 'cta_id',
          property_type: 'string',
          is_required: false,
          enum_values: [],
          max_length: 120,
          is_active: true,
        },
      ],
      landing_events: [],
      landing_event_rejections: [],
    };
  }

  from(table: string): MockQueryBuilder {
    return new MockQueryBuilder({ table, filters: [], insertValue: null }, this);
  }

  selectRows(state: QueryState): Record<string, unknown>[] {
    return (this.rows[state.table] ?? []).filter((row): boolean =>
      state.filters.every((filter): boolean => row[filter.column] === filter.value),
    );
  }

  insertRow(table: string, value: Record<string, unknown>): Record<string, unknown> {
    const row = {
      id: `${table}-${this.rows[table]?.length ?? 0}`,
      ...value,
    };
    this.rows[table] = [...(this.rows[table] ?? []), row];
    return row;
  }
}

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));

function validPayload(): Record<string, unknown> {
  return {
    event_name: 'cta_clicked',
    client_slug: 'anura',
    site_slug: 'try-anura',
    page_url: 'https://try.anura.io/?utm_source=meta&email=drop',
    path: '/',
    occurred_at: '2026-06-11T08:00:00.000Z',
    session_id: 'sl_session_123',
    utm_source: 'meta',
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    referrer: null,
    device_type: 'desktop',
    browser: 'chrome',
    properties: {
      cta_id: 'hero',
    },
  };
}

describe('recordLandingEvent', (): void => {
  let db: MockSupabase;

  beforeEach((): void => {
    db = new MockSupabase();
    mocks.createAdminClient.mockReturnValue(db);
  });

  it('inserts an accepted registry-backed event', async (): Promise<void> => {
    const result = await recordLandingEvent({
      payload: validPayload(),
      origin: 'https://try.anura.io',
      userAgent: 'vitest',
    });

    expect(result.id).toBe('landing_events-0');
    expect(db.rows.landing_events).toHaveLength(1);
    expect(db.rows.landing_events[0]).toMatchObject({
      client_id: 'client-anura',
      site_id: 'site-anura',
      event_definition_id: 'event-cta',
      event_key: 'cta_clicked',
      page_url: 'https://try.anura.io/?utm_source=meta',
      origin: 'https://try.anura.io',
    });
    expect(db.rows.landing_event_rejections).toHaveLength(0);
  });

  it('rejects properties missing from the site event registry', async (): Promise<void> => {
    await expect(
      recordLandingEvent({
        payload: {
          ...validPayload(),
          properties: { cta_id: 'hero', unknown_safe_key: 'value' },
        },
        origin: 'https://try.anura.io',
        userAgent: 'vitest',
      }),
    ).rejects.toBeInstanceOf(LandingEventValidationError);

    expect(db.rows.landing_events).toHaveLength(0);
    expect(db.rows.landing_event_rejections).toHaveLength(1);
    expect(db.rows.landing_event_rejections[0]?.reason).toContain(
      'Unknown landing event property',
    );
  });

  it('rejects origins outside the site allowlist', async (): Promise<void> => {
    await expect(
      recordLandingEvent({
        payload: validPayload(),
        origin: 'https://evil.example',
        userAgent: 'vitest',
      }),
    ).rejects.toBeInstanceOf(LandingSiteConfigError);

    expect(db.rows.landing_events).toHaveLength(0);
    expect(db.rows.landing_event_rejections).toHaveLength(1);
    expect(db.rows.landing_event_rejections[0]).toMatchObject({
      client_slug: 'anura',
      site_slug: 'try-anura',
      event_key: 'cta_clicked',
      origin: 'https://evil.example',
    });
  });
});
