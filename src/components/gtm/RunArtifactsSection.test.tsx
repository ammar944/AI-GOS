import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunArtifactsSection } from "@/components/gtm/RunArtifactsSection";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";

const baseArtifact: GtmArtifact = {
  id: "11111111-1111-1111-1111-111111111111",
  run_id: "run_test",
  user_id: "user_test",
  skill: "research-icp",
  version: 1,
  parent_id: null,
  content_md:
    "## Buyer ICP\n\nMid-market SaaS teams with attribution gaps.\n\n- Buyer: VP Marketing\n",
  source: "skill_output",
  created_by: "orchestrator",
  metadata: {},
  created_at: "2026-05-01T12:00:00.000Z",
};

describe("RunArtifactsSection", () => {
  it("renders the empty artifact state", () => {
    render(<RunArtifactsSection artifacts={[]} runId="run_test" />);

    expect(
      screen.getByRole("heading", { name: /run artifacts/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("No artifacts produced yet.")).toBeInTheDocument();
  });

  it("groups artifact versions by skill", () => {
    render(
      <RunArtifactsSection
        artifacts={[baseArtifact, makeArtifact({ id: "artifact_v2", version: 2 })]}
        runId="run_test"
      />,
    );

    expect(screen.getAllByTestId("run-artifact-group")).toHaveLength(1);
  });

  it("shows the latest version and total version count", () => {
    render(
      <RunArtifactsSection
        artifacts={[
          baseArtifact,
          makeArtifact({
            id: "artifact_v2",
            version: 2,
            source: "agent_patch",
            created_at: "2026-05-01T13:00:00.000Z",
          }),
        ]}
        runId="run_test"
      />,
    );

    expect(screen.getByText("Latest v2")).toBeInTheDocument();
    expect(screen.getByText("2 versions")).toBeInTheDocument();
  });

  it("orders canonical stage artifacts before unknown artifacts", () => {
    render(
      <RunArtifactsSection
        artifacts={[
          makeArtifact({
            id: "artifact_unknown",
            skill: "custom-analysis",
            content_md: "## Custom\n\nCustom output.",
          }),
          makeArtifact({
            id: "artifact_competitor",
            skill: "research-competitor",
            content_md: "## Competitors\n\nCompetitor output.",
          }),
          makeArtifact({
            id: "artifact_url",
            skill: "discover-url",
            content_md: "## URL\n\nURL output.",
          }),
        ]}
        runId="run_test"
      />,
    );

    const labels = screen
      .getAllByTestId("run-artifact-group-label")
      .map((label) => label.textContent);

    expect(labels).toEqual([
      "discover-url",
      "research-competitor",
      "custom-analysis",
    ]);
  });

  it("shows the latest artifact source in human-readable copy", () => {
    render(
      <RunArtifactsSection
        artifacts={[
          baseArtifact,
          makeArtifact({
            id: "artifact_patch",
            version: 2,
            source: "agent_patch",
          }),
        ]}
        runId="run_test"
      />,
    );

    expect(screen.getByText("Latest source: Agent patch")).toBeInTheDocument();
  });

  it("shows a markdown-derived preview without raw markdown noise", () => {
    render(
      <RunArtifactsSection
        artifacts={[
          makeArtifact({
            content_md:
              "## Buyer ICP\n\n- **Pain:** attribution gaps\n- [Source](https://example.com)\n",
          }),
        ]}
        runId="run_test"
      />,
    );

    const preview = screen.getByTestId("run-artifact-preview");
    expect(preview).toHaveTextContent("Buyer ICP Pain: attribution gaps Source");
    expect(preview).not.toHaveTextContent("##");
    expect(preview).not.toHaveTextContent("**");
    expect(preview).not.toHaveTextContent("](https://example.com)");
  });

  it("links to the latest artifact canvas URL", () => {
    const latestArtifact = makeArtifact({
      id: "22222222-2222-2222-2222-222222222222",
      version: 2,
    });

    render(
      <RunArtifactsSection
        artifacts={[baseArtifact, latestArtifact]}
        runId="run_test"
      />,
    );

    expect(
      screen.getByRole("link", { name: /open latest in canvas/i }),
    ).toHaveAttribute("href", `/gtm/run_test/artifacts/${latestArtifact.id}`);
  });

  it("preserves the ability to render the markdown artifact body", () => {
    render(<RunArtifactsSection artifacts={[baseArtifact]} runId="run_test" />);

    expect(
      screen.queryByRole("heading", { level: 2, name: /Buyer ICP/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand/i }));

    expect(
      screen.getByRole("heading", { level: 2, name: /Buyer ICP/i }),
    ).toBeInTheDocument();
  });
});

function makeArtifact(overrides: Partial<GtmArtifact>): GtmArtifact {
  return {
    ...baseArtifact,
    ...overrides,
    id: overrides.id ?? baseArtifact.id,
    version: overrides.version ?? baseArtifact.version,
    parent_id: overrides.parent_id ?? null,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? baseArtifact.created_at,
  };
}
