import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildGtmPrefillManifestFromDiscovery } from "@/lib/gtm/onboarding/prefill";
import { GtmPrefillReviewPanel } from "./GtmPrefillReviewPanel";

const NOW = "2026-05-04T12:00:00.000Z";

describe("GtmPrefillReviewPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows sourced fields, gaps, and a confirmation action", () => {
    render(
      <GtmPrefillReviewPanel
        runId="run_1"
        prefill={buildPrefill()}
      />,
    );

    expect(screen.getByRole("heading", { name: /review product identity/i })).toBeInTheDocument();
    expect(screen.getByText("2 website-backed fields ready")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Acme AI")).toBeInTheDocument();
    expect(screen.getByText("List your pricing tiers")).toBeInTheDocument();
    expect(screen.getByText(/No ACV found on the public site/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm reviewed draft/i })).toBeEnabled();
  });

  it("posts reviewed field edits to the prefill route", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          prefill: {
            ...buildPrefill(),
            status: "confirmed",
            reviewRequired: false,
            researchUnlocked: true,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const onConfirmed = vi.fn();

    render(
      <GtmPrefillReviewPanel
        runId="run_1"
        prefill={buildPrefill()}
        onConfirmed={onConfirmed}
      />,
    );

    fireEvent.change(screen.getByLabelText("Company Name"), {
      target: { value: "Acme AI Labs" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm reviewed draft/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gtm/runs/run_1/prefill",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "confirm_review",
            fields: {
              companyName: "Acme AI Labs",
              pricingTiers: "$499/mo Growth plan",
            },
          }),
        }),
      );
    });
    expect(onConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "confirmed",
        researchUnlocked: true,
      }),
    );
  });

  it("keeps research visibly locked while discovery is still running", () => {
    render(
      <GtmPrefillReviewPanel
        runId="run_1"
        prefill={{
          ...buildPrefill(),
          status: "discovering",
          reviewRequired: true,
          researchUnlocked: false,
        }}
      />,
    );

    expect(screen.getByText(/Website discovery is running/i)).toBeInTheDocument();
    expect(screen.getByText(/Research sections stay locked/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm reviewed draft/i })).not.toBeInTheDocument();
  });
});

function buildPrefill(): ReturnType<typeof buildGtmPrefillManifestFromDiscovery> {
  return buildGtmPrefillManifestFromDiscovery({
    runId: "run_1",
    inputUrl: "https://acme.ai/",
    now: NOW,
    output: {
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
      source_gaps: [
        {
          field: "avgAcv",
          reason: "No ACV found on the public site.",
          remediation: "Ask the user for average contract value during review.",
          severity: "warn",
          confidence: 7,
        },
      ],
      generated_at: NOW,
    },
  });
}
