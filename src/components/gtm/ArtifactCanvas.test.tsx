import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArtifactCanvas } from "./ArtifactCanvas";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";

const sample: GtmArtifact = {
  id: "11111111-1111-1111-1111-111111111111",
  run_id: "run_x",
  user_id: "user_x",
  skill: "research-icp",
  version: 1,
  parent_id: null,
  content_md: "## ICP\n\nMid-market.\n",
  source: "skill_output",
  created_by: "orchestrator",
  metadata: {},
  created_at: "2026-05-01T12:00:00.000Z",
};

describe("ArtifactCanvas", () => {
  it("renders header pieces (skill, version, source, back link)", () => {
    render(<ArtifactCanvas artifact={sample} runId="run_x" />);
    expect(screen.getByText("research-icp", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    const back = screen.getByRole("link", { name: /back to chat/i });
    expect(back).toHaveAttribute("href", "/gtm/run_x");
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it("renders both rendered markdown and raw markdown panes", () => {
    render(<ArtifactCanvas artifact={sample} runId="run_x" />);
    expect(
      screen.getByRole("region", { name: /rendered markdown/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /raw markdown/i }),
    ).toBeInTheDocument();
    // Rendered: H2 element
    expect(
      screen.getByRole("heading", { level: 2, name: /ICP/ }),
    ).toBeInTheDocument();
    // Raw: textarea with the source
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe(sample.content_md);
    expect(textarea.readOnly).toBe(true);
  });
});
