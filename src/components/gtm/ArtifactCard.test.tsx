/**
 * Tests for ArtifactCard.tsx (T8).
 *
 * jsdom-based render assertions. Radix Select's dropdown interaction is hard
 * to drive in jsdom without polyfills, so we verify:
 *   - Header pieces (skill, version badge, source badge, timestamp)
 *   - Markdown body renders into real DOM nodes (heading, list, link)
 *   - Multi-version: dropdown trigger is present
 *   - Single-version: dropdown trigger is absent
 *   - Open-in-canvas link uses /gtm/[runId]/artifacts/[artifactId]
 *   - Collapsible toggle hides content
 */

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ArtifactCard } from "./ArtifactCard";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";

const baseArtifact: GtmArtifact = {
  id: "11111111-1111-1111-1111-111111111111",
  run_id: "run_x",
  user_id: "user_x",
  skill: "research-icp",
  version: 1,
  parent_id: null,
  content_md: "## ICP\n\nMid-market SaaS buyers.\n\n- Buyer: VP Marketing\n- Pain: attribution\n\n[More](https://example.com)\n",
  source: "skill_output",
  created_by: "orchestrator",
  metadata: {},
  created_at: "2026-05-01T12:00:00.000Z",
};

const v2Artifact: GtmArtifact = {
  ...baseArtifact,
  id: "22222222-2222-2222-2222-222222222222",
  version: 2,
  parent_id: baseArtifact.id,
  content_md: "## ICP (refined)\n\nEnterprise mid-market only.\n",
  source: "agent_patch",
  created_by: "user_x",
  created_at: "2026-05-01T13:00:00.000Z",
};

describe("ArtifactCard", () => {
  it("returns null when versions array is empty", () => {
    const { container } = render(
      <ArtifactCard versions={[]} runId="run_x" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the latest version's header pieces", () => {
    render(<ArtifactCard versions={[baseArtifact, v2Artifact]} runId="run_x" />);
    expect(screen.getByText("research-icp", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    // 'patched' appears in the badge and (hidden) Select option for v2.
    expect(screen.getAllByText(/patched/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders content_md as real markdown DOM (h2 + list + link)", () => {
    render(<ArtifactCard versions={[baseArtifact]} runId="run_x" />);
    expect(screen.getByRole("heading", { level: 2, name: /ICP/ })).toBeInTheDocument();
    expect(screen.getByText("VP Marketing", { exact: false })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /more/i });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("renders an open-in-canvas link with the latest artifact id", () => {
    render(<ArtifactCard versions={[baseArtifact, v2Artifact]} runId="run_x" />);
    const canvasLink = screen.getByRole("link", { name: /open in canvas/i });
    expect(canvasLink).toHaveAttribute(
      "href",
      `/gtm/run_x/artifacts/${v2Artifact.id}`,
    );
  });

  it("does not render version dropdown when only one version exists", () => {
    render(<ArtifactCard versions={[baseArtifact]} runId="run_x" />);
    expect(screen.queryByRole("combobox", { name: /select version/i })).toBeNull();
  });

  it("renders version dropdown trigger when multiple versions exist", () => {
    render(<ArtifactCard versions={[baseArtifact, v2Artifact]} runId="run_x" />);
    expect(
      screen.getByRole("combobox", { name: /select version/i }),
    ).toBeInTheDocument();
  });

  it("collapses body when the toggle is clicked", () => {
    render(<ArtifactCard versions={[baseArtifact]} runId="run_x" />);
    expect(screen.getByRole("heading", { level: 2, name: /ICP/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
    expect(screen.queryByRole("heading", { level: 2, name: /ICP/ })).toBeNull();
  });

  it("respects defaultExpanded=false", () => {
    render(
      <ArtifactCard
        versions={[baseArtifact]}
        runId="run_x"
        defaultExpanded={false}
      />,
    );
    expect(screen.queryByRole("heading", { level: 2, name: /ICP/ })).toBeNull();
  });
});
