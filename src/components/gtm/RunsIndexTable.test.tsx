import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  RunsIndexTable,
  type GtmRunListItem,
} from "@/components/gtm/RunsIndexTable";

const now = Date.now();

const run: GtmRunListItem = {
  run_id: "run_airtable",
  input_url: "https://airtable.com/",
  status: "queued",
  created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(now - 30 * 60 * 1000).toISOString(),
};

describe("RunsIndexTable", () => {
  it("renders the empty state", () => {
    render(<RunsIndexTable runs={[]} />);

    expect(screen.getByText("No GTM runs yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New run" })).toHaveAttribute(
      "href",
      "/gtm/new"
    );
  });

  it("renders a single run row", () => {
    render(<RunsIndexTable runs={[run]} />);

    expect(screen.getByText("run_airtable")).toBeInTheDocument();
    expect(screen.getByText("https://airtable.com/")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "run_airtable" })).toHaveAttribute(
      "href",
      "/gtm/run_airtable"
    );
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });

  it("renders the status badge with the matching status marker", () => {
    render(
      <RunsIndexTable
        runs={[
          {
            ...run,
            status: "awaiting_user",
          },
        ]}
      />
    );

    const badge = screen.getByText("Awaiting user");

    expect(badge).toHaveAttribute("data-status", "awaiting_user");
    expect(badge).toHaveClass("text-yellow-700");
  });
});
