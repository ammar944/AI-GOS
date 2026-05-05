import { auth } from "@clerk/nextjs/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
  buildGtmPrefillManifestFromDiscovery,
  buildInitialGtmPrefillManifest,
  type GtmPrefillManifest,
} from "@/lib/gtm/onboarding/prefill";
import { POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockAuth = vi.mocked(auth);
const mockCreateClient = vi.mocked(createClient);

const NOW = "2026-05-04T12:00:00.000Z";

describe("GTM prefill route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<ReturnType<typeof auth>>);
  });

  it("persists a review draft from sourced discover-url output", async () => {
    const updates: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        run: {
          run_id: "run_1",
          user_id: "user_1",
          input_url: "https://acme.ai/",
          status: "partial",
          manifest: {
            gtm_prefill: buildInitialGtmPrefillManifest({
              runId: "run_1",
              inputUrl: "https://acme.ai/",
              now: NOW,
            }),
          },
          stages: {
            "discover-url": {
              status: "complete",
              output: buildDiscoverUrlOutput(),
            },
          },
        },
      }) as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(
      buildRequest({ action: "build_from_discovery" }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(getUpdatedPrefill(updates[0])).toMatchObject({
      status: "ready_for_review",
      reviewRequired: true,
      researchUnlocked: false,
    });
    expect(getUpdatedPrefill(updates[0]).draft.fields.companyName).toMatchObject({
      value: "Acme AI",
      status: "suggested",
      confidence: "high",
    });
    expect(payload.prefill).toMatchObject({
      status: "ready_for_review",
      researchUnlocked: false,
    });
  });

  it("confirms reviewed fields and unlocks downstream research", async () => {
    const updates: unknown[] = [];
    const readyPrefill = buildGtmPrefillManifestFromDiscovery({
      runId: "run_1",
      inputUrl: "https://acme.ai/",
      output: buildDiscoverUrlOutput(),
      now: NOW,
    });
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        run: {
          run_id: "run_1",
          user_id: "user_1",
          input_url: "https://acme.ai/",
          status: "partial",
          manifest: {
            gtm_prefill: readyPrefill,
          },
          stages: {
            "discover-url": {
              status: "complete",
              output: buildDiscoverUrlOutput(),
            },
          },
        },
      }) as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(
      buildRequest({
        action: "confirm_review",
        fields: {
          companyName: "Acme AI",
          pricingTiers: "$599/mo Growth plan",
        },
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );

    expect(response.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(getUpdatedPrefill(updates[0])).toMatchObject({
      status: "confirmed",
      reviewRequired: false,
      researchUnlocked: true,
    });
    expect(getUpdatedPrefill(updates[0]).draft.fields.companyName.status).toBe("confirmed");
    expect(getUpdatedPrefill(updates[0]).draft.fields.pricingTiers).toMatchObject({
      value: "$599/mo Growth plan",
      status: "confirmed",
      updatedBy: "user",
    });
  });

  it("rejects confirm_review with empty fields and does not unlock", async () => {
    const updates: unknown[] = [];
    const readyPrefill = buildGtmPrefillManifestFromDiscovery({
      runId: "run_1",
      inputUrl: "https://acme.ai/",
      output: buildDiscoverUrlOutput(),
      now: NOW,
    });
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        run: buildRun({ manifest: { gtm_prefill: readyPrefill } }),
      }) as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(
      buildRequest({
        action: "confirm_review",
        fields: {},
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "gtm_prefill_review_required",
      run_id: "run_1",
    });
    expect(updates).toEqual([]);
  });

  it("rejects confirm_review with only unknown field keys and does not unlock", async () => {
    const updates: unknown[] = [];
    const readyPrefill = buildGtmPrefillManifestFromDiscovery({
      runId: "run_1",
      inputUrl: "https://acme.ai/",
      output: buildDiscoverUrlOutput(),
      now: NOW,
    });
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        run: buildRun({ manifest: { gtm_prefill: readyPrefill } }),
      }) as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(
      buildRequest({
        action: "confirm_review",
        fields: {
          unknownField: "Acme AI",
        },
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "gtm_prefill_review_required",
      run_id: "run_1",
    });
    expect(updates).toEqual([]);
  });

  it("rejects confirm_review when no website-backed fields are reviewable", async () => {
    const updates: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        run: buildRun({
          manifest: {
            gtm_prefill: buildReadyPrefillWithoutWebsiteEvidence(),
          },
        }),
      }) as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(
      buildRequest({
        action: "confirm_review",
        fields: {
          companyUrl: "https://acme.ai/",
        },
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "gtm_prefill_review_required",
      run_id: "run_1",
    });
    expect(updates).toEqual([]);
  });
});

interface TestRunRow {
  run_id: string;
  user_id: string;
  input_url: string;
  status: string;
  manifest: Record<string, unknown> | null;
  stages: Record<string, unknown> | null;
}

function buildSupabaseMock(input: {
  updates: unknown[];
  run: TestRunRow | null;
}): unknown {
  const selectBuilder = {
    eq: vi.fn(() => selectBuilder),
    maybeSingle: vi.fn(async () => ({
      data: input.run,
      error: null,
    })),
  };
  const updateBuilder = {
    error: null,
    eq: vi.fn(() => updateBuilder),
  };

  return {
    from(table: string) {
      if (table !== "gtm_runs") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => selectBuilder),
        update: vi.fn((payload: unknown) => {
          input.updates.push(payload);
          return updateBuilder;
        }),
      };
    },
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/gtm/runs/run_1/prefill", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function buildRun(overrides: Partial<TestRunRow> = {}): TestRunRow {
  return {
    run_id: "run_1",
    user_id: "user_1",
    input_url: "https://acme.ai/",
    status: "partial",
    manifest: null,
    stages: {
      "discover-url": {
        status: "complete",
        output: buildDiscoverUrlOutput(),
      },
    },
    ...overrides,
  };
}

function buildReadyPrefillWithoutWebsiteEvidence(): GtmPrefillManifest {
  return {
    ...buildInitialGtmPrefillManifest({
      runId: "run_1",
      inputUrl: "https://acme.ai/",
      now: NOW,
    }),
    status: "ready_for_review",
    updatedAt: NOW,
    discoveredAt: NOW,
  };
}

function getUpdatedPrefill(update: unknown): {
  status: string;
  reviewRequired: boolean;
  researchUnlocked: boolean;
  draft: {
    fields: {
      companyName: Record<string, unknown>;
      pricingTiers: Record<string, unknown>;
    };
  };
} {
  if (!isRecord(update) || !isRecord(update.manifest) || !isRecord(update.manifest.gtm_prefill)) {
    throw new Error("Expected update payload with manifest.gtm_prefill.");
  }

  const prefill = update.manifest.gtm_prefill;
  if (!isRecord(prefill.draft) || !isRecord(prefill.draft.fields)) {
    throw new Error("Expected prefill draft fields.");
  }

  return {
    status: String(prefill.status),
    reviewRequired: prefill.reviewRequired === true,
    researchUnlocked: prefill.researchUnlocked === true,
    draft: {
      fields: {
        companyName: prefill.draft.fields.companyName as Record<string, unknown>,
        pricingTiers: prefill.draft.fields.pricingTiers as Record<string, unknown>,
      },
    },
  };
}

function buildDiscoverUrlOutput(): Record<string, unknown> {
  return {
    run_id: "run_1",
    stage: "discover-url",
    input_url: "https://acme.ai/",
    canonical_url: {
      value: "https://acme.ai/",
      source_url: "https://acme.ai/",
      retrieved_at: NOW,
    },
    company_name: {
      value: "Acme AI",
      source_url: "https://acme.ai/",
      retrieved_at: NOW,
    },
    discovered_pages: [],
    prefilled_fields: [
      {
        field_key: "companyName",
        label: "Company Name",
        value: "Acme AI",
        confidence: "high",
        evidence: [
          {
            value: "Acme AI builds revenue automation for SaaS teams.",
            source_url: "https://acme.ai/",
            retrieved_at: NOW,
          },
        ],
        reason: "Homepage hero names the company.",
      },
      {
        field_key: "pricingTiers",
        label: "Pricing Tiers",
        value: "$499/mo Growth plan",
        confidence: "medium",
        evidence: [
          {
            value: "$499/mo Growth plan",
            source_url: "https://acme.ai/pricing",
            retrieved_at: NOW,
          },
        ],
        reason: "Pricing page lists the Growth plan.",
      },
    ],
    unresolved_fields: [],
    source_gaps: [],
    generated_at: NOW,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
